import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withLogging } from '../_shared/logger.ts';

// This worker has no caller-selected recipient or content. It drains only the
// private queue populated by the database when a recipe enters moderation.
Deno.serve(withLogging('recipe-moderation-email', async (request, log) => {
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MODERATION_EMAIL_FROM');
  if (!key || !from) { log.error('email_not_configured', { has_resend_key: !!key, has_from: !!from }); return new Response('Email delivery is not configured', {status:503}); }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:jobs,error} = await db.rpc('claim_recipe_notifications');
  if(error) { log.error('queue_claim_failed', { error }); return new Response('Queue unavailable',{status:503}); }
  const tally = { claimed: jobs?.length ?? 0, sent: 0, skipped: 0, failed: 0 };
  log.info('queue_claimed', { job_count: tally.claimed });
  for(const job of jobs ?? []) {
    const jobFields = { job_id: job.id, recipe_id: job.recipe_id, report_id: job.report_id ?? null, kind: job.report_id ? 'report' : 'pending_review' };
    const {data:recipe,error:readError} = await db.from('community_recipes').select('id,title,category,effort_level,ingredients,steps,friend_tip,status').eq('id',job.recipe_id).maybeSingle();
    if(readError) { tally.failed++; log.warn('recipe_read_failed', { ...jobFields, error: readError }); continue; }
    let report: {status:string} | null = null;
    if(job.report_id) {
      const result = await db.from('community_reports').select('status').eq('id',job.report_id).maybeSingle();
      if(result.error) { tally.failed++; log.warn('report_read_failed', { ...jobFields, error: result.error }); continue; }
      report=result.data;
    }
    if(!recipe || (job.report_id ? !report || report.status==='resolved' : recipe.status !== 'pending_review')) {
      const reason = !recipe ? 'recipe_missing' : job.report_id ? (!report ? 'report_missing' : 'report_resolved') : `recipe_status_${recipe.status}`;
      const {error:deleteError} = await db.from('recipe_email_queue').delete().eq('id',job.id);
      tally.skipped++;
      log[deleteError ? 'warn' : 'info']('job_skipped', { ...jobFields, reason, delete_error: deleteError ?? undefined });
      continue;
    }
    const ingredients = (recipe.ingredients ?? []).map((i: {amount_text:string;ingredient_text:string})=>`${i.amount_text} ${i.ingredient_text}`).join('\n');
    let text = `A recipe is waiting for moderation in Plan My C-Day.\n\n${recipe.title}\nCategory: ${recipe.category}\nEffort: ${recipe.effort_level}\n\nIngredients\n${ingredients}\n\nSteps\n${recipe.steps.map((s:string,i:number)=>`${i+1}. ${s}`).join('\n')}\n\nTip: ${recipe.friend_tip || 'None'}\n\nRecipe ID: ${recipe.id}\n\nOpen Community in Plan My C-Day with a moderator account to review. This email does not publish or approve the recipe.`;
    if(job.report_id) text = `A community recipe has been reported and needs moderator review.\n\nRecipe: ${recipe.title}\nRecipe ID: ${recipe.id}\nReport ID: ${job.report_id}\n\nOpen Community → Moderator review queue in Plan My C-Day to see the report reason and details. Reporter identity and report text are not included in this email. This notification does not remove or approve the recipe.`;
    const sendStarted = Date.now();
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`recipe-review-${job.id}`},
        body:JSON.stringify({from,to:['support@mycday.com'],subject:job.report_id?'Plan My C-Day: reported recipe needs review':'Plan My C-Day: recipe awaiting moderation',text}),
        signal:AbortSignal.timeout(15000),
      });
      if(response.ok) {
        const {error:markError} = await db.from('recipe_email_queue').update({sent_at:new Date().toISOString()}).eq('id',job.id);
        tally.sent++;
        log[markError ? 'warn' : 'info']('email_sent', { ...jobFields, resend_status: response.status, duration_ms: Date.now() - sendStarted, mark_sent_error: markError ?? undefined });
      } else {
        // Unsent jobs become eligible again when their lease expires.
        tally.failed++;
        log.warn('email_send_rejected', { ...jobFields, resend_status: response.status, resend_body: (await response.text().catch(() => '')).slice(0, 500), duration_ms: Date.now() - sendStarted });
      }
    } catch (error) { tally.failed++; log.warn('email_send_error', { ...jobFields, error, duration_ms: Date.now() - sendStarted }); /* Keep the durable queue entry for retry. */ }
  }
  log.info('queue_processed', tally);
  return new Response('Queue processed');
}));
