import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This worker has no caller-selected recipient or content. It drains only the
// private queue populated by the database when a recipe enters moderation.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MODERATION_EMAIL_FROM');
  if (!key || !from) return new Response('Email delivery is not configured', {status:503});
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:jobs,error} = await db.rpc('claim_recipe_notifications');
  if(error) return new Response('Queue unavailable',{status:503});
  for(const job of jobs ?? []) {
    const {data:recipe,error:readError} = await db.from('community_recipes').select('id,title,category,effort_level,ingredients,steps,friend_tip,status').eq('id',job.recipe_id).maybeSingle();
    if(readError) continue;
    let report: {status:string} | null = null;
    if(job.report_id) {
      const result = await db.from('community_reports').select('status').eq('id',job.report_id).maybeSingle();
      if(result.error) continue;
      report=result.data;
    }
    if(!recipe || (job.report_id ? !report || report.status==='resolved' : recipe.status !== 'pending_review')) {
      await db.from('recipe_email_queue').delete().eq('id',job.id);
      continue;
    }
    const ingredients = (recipe.ingredients ?? []).map((i: {amount_text:string;ingredient_text:string})=>`${i.amount_text} ${i.ingredient_text}`).join('\n');
    let text = `A recipe is waiting for moderation in Plan My C-Day.\n\n${recipe.title}\nCategory: ${recipe.category}\nEffort: ${recipe.effort_level}\n\nIngredients\n${ingredients}\n\nSteps\n${recipe.steps.map((s:string,i:number)=>`${i+1}. ${s}`).join('\n')}\n\nTip: ${recipe.friend_tip || 'None'}\n\nRecipe ID: ${recipe.id}\n\nOpen Community in Plan My C-Day with a moderator account to review. This email does not publish or approve the recipe.`;
    if(job.report_id) text = `A community recipe has been reported and needs moderator review.\n\nRecipe: ${recipe.title}\nRecipe ID: ${recipe.id}\nReport ID: ${job.report_id}\n\nOpen Community → Moderator review queue in Plan My C-Day to see the report reason and details. Reporter identity and report text are not included in this email. This notification does not remove or approve the recipe.`;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`recipe-review-${job.id}`},
        body:JSON.stringify({from,to:['support@mycday.com'],subject:job.report_id?'Plan My C-Day: reported recipe needs review':'Plan My C-Day: recipe awaiting moderation',text}),
        signal:AbortSignal.timeout(15000),
      });
      if(response.ok) await db.from('recipe_email_queue').update({sent_at:new Date().toISOString()}).eq('id',job.id);
      // Unsent jobs become eligible again when their lease expires.
    } catch { /* Keep the durable queue entry for retry. */ }
  }
  return new Response('Queue processed');
});
