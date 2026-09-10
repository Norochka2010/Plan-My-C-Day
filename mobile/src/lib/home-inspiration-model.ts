export const inspirationThemes = ['CONFIDENCE','SMALL_STEPS','SELF_TRUST','CONNECTION','FLEXIBILITY','LIFE_BEYOND_CELIAC'] as const;
export type InspirationTrigger = 'UPCOMING_CDAY' | 'HARD_ACTION_DONE' | 'ACTION_RESCHEDULED' | 'NO_UPCOMING_CDAY' | 'ACTION_NOT_NEEDED' | 'EXPLORE_COMPLETED' | 'PLAN_FINALIZED' | 'SUPPORT_USED';
const triggers: InspirationTrigger[] = ['UPCOMING_CDAY','HARD_ACTION_DONE','ACTION_RESCHEDULED','NO_UPCOMING_CDAY','ACTION_NOT_NEEDED','EXPLORE_COMPLETED','PLAN_FINALIZED','SUPPORT_USED'];
export type InspirationMessage = { message_id: string; message_text: string; theme: string; message_type: 'DAILY_GENERAL' | 'CONTEXTUAL'; trigger_key: InspirationTrigger | null };
export type InspirationAction = { id: string; completion_status: string; difficulty: string | null; completed_at: string | null; scheduled_at: string | null; reschedule_count: number; updated_at: string; action_library_id?: string; source_snapshot?: string; created_at?: string };
export type InspirationContext = { nextPlannedAt: string | null; actions: InspirationAction[]; events?: { id: string; status: string; updated_at: string }[]; exploreCompletions?: { id: string; completedAt: string }[] };
type Baseline = { count: number; schedule: string | null; status?: string };
type Active = { key: string; messageId: string; expires: number; priority: number };
export type InspirationState = { version: 1; days: Record<string,string>; seen: Record<string,number>; baselines: Record<string,Baseline>; active: Active | null; eventStatuses?: Record<string,string> };
export const emptyInspirationState = (): InspirationState => ({ version: 1, days: {}, seen: {}, baselines: {}, active: null });
export const contextLifetime = 30 * 60 * 1000;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseInspirationState(raw: string | null): InspirationState {
  if (!raw) return emptyInspirationState();
  const s = JSON.parse(raw);
  if (!object(s) || s.version !== 1 || !object(s.days) || !object(s.seen) || !object(s.baselines) ||
    !Object.values(s.days).every(v => typeof v === 'string') || !Object.values(s.seen).every(Number.isFinite) ||
    !Object.values(s.baselines).every(v => object(v) && Number.isSafeInteger(v.count) && v.count >= 0 && (v.schedule === null || typeof v.schedule === 'string')) ||
    !(s.active === null || (object(s.active) && typeof s.active.key === 'string' && typeof s.active.messageId === 'string' && Number.isFinite(s.active.expires) && Number.isFinite(s.active.priority)))) throw Error('Inspiration state unavailable');
  if (s.eventStatuses !== undefined && (!object(s.eventStatuses) || !Object.values(s.eventStatuses).every(v=>typeof v==='string'))) throw Error('Inspiration state unavailable');
  return s as InspirationState;
}
export function parseInspirationMessages(rows: unknown[]): InspirationMessage[] {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (!object(row) || row.active !== true || row.review_status !== 'approved' || typeof row.message_id !== 'string' || !row.message_id || seen.has(row.message_id) || typeof row.message_text !== 'string' || !row.message_text.trim() || !(inspirationThemes as readonly string[]).includes(row.theme)) return [];
    if (!(row.message_type === 'DAILY_GENERAL' && row.trigger_key === null) && !(row.message_type === 'CONTEXTUAL' && triggers.includes(row.trigger_key))) return [];
    seen.add(row.message_id); return [row as InspirationMessage];
  }).sort((a,b) => a.message_id.localeCompare(b.message_id));
}
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function hash(value: string) { let n = 0; for (let i=0;i<value.length;i++) n = (Math.imul(31,n)+value.charCodeAt(i))>>>0; return n; }
/** Inputs are only explicit app states. No free text, personal profile, mood, or health data. */
export function selectInspiration(messages: InspirationMessage[], previous: InspirationState, context: InspirationContext | null, accountKey: string, date = new Date()): { message: InspirationMessage | null; state: InspirationState } {
  const now = date.getTime(), day = localDay(date), yesterday = new Date(date); yesterday.setDate(date.getDate()-1);
  const state: InspirationState = { ...previous, days: { ...previous.days }, seen: Object.fromEntries(Object.entries(previous.seen).filter(([,t]) => now-t < 2*86400000)), baselines: { ...previous.baselines }, active: previous.active ? {...previous.active} : null };
  const general = messages.filter(m => m.message_type === 'DAILY_GENERAL');
  let daily = general.find(m => m.message_id === state.days[day]) ?? null;
  if (!daily && general.length) {
    const ordinal = Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
    let index = (hash(accountKey)+ordinal)%general.length;
    if (general.length>1 && general[index].message_id === state.days[localDay(yesterday)]) index=(index+1)%general.length;
    daily=general[index];state.days[day]=daily.message_id;
  }
  state.days=Object.fromEntries(Object.entries(state.days).sort(([a],[b])=>b.localeCompare(a)).slice(0,14));
  if (!context) return { message: daily, state }; // Unknown context is never treated as no plans.
  const candidates: { key: string; trigger: InspirationTrigger; expires: number; priority: number }[] = [];
  const future = context.nextPlannedAt && Date.parse(context.nextPlannedAt)>now ? Date.parse(context.nextPlannedAt) : null;
  const trigger = future ? 'UPCOMING_CDAY' : 'NO_UPCOMING_CDAY';
  candidates.push({key:`${trigger}:${day}`,trigger,expires:Math.min(now+contextLifetime,future??Infinity),priority:1});
  const nextBaselines: Record<string,Baseline> = {};
  for (const action of context.actions) {
    const completed = action.completed_at ? Date.parse(action.completed_at) : NaN;
    if (action.completion_status === 'done' && action.difficulty === 'hard' && completed<=now && completed+contextLifetime>now)
      candidates.push({key:`hard:${action.id}:${action.completed_at}`,trigger:'HARD_ACTION_DONE',expires:completed+contextLifetime,priority:3});
    const baseline = state.baselines[action.id], key=`reschedule:${action.id}:${action.reschedule_count}:${action.scheduled_at}`;
    const updated = Date.parse(action.updated_at);
    if (action.completion_status === 'planned' && action.scheduled_at && Number.isSafeInteger(action.reschedule_count) && action.reschedule_count>0 && updated<=now && updated+contextLifetime>now &&
      ((baseline && action.reschedule_count>baseline.count && action.scheduled_at!==baseline.schedule) || state.active?.key===key))
      candidates.push({key,trigger:'ACTION_RESCHEDULED',expires:updated+contextLifetime,priority:2});
    const notNeededKey=`not-needed:${action.id}:${action.updated_at}`;
    if (action.completion_status==='not_needed' && updated<=now && updated+contextLifetime>now &&
      (baseline?.status==='planned' || state.active?.key===notNeededKey))
      candidates.push({key:notNeededKey,trigger:'ACTION_NOT_NEEDED',expires:updated+contextLifetime,priority:2});
    // Stable Meyer COLLABORATE IDs represent explicit support selections, never inferred feelings.
    if (action.source_snapshot==='Meyer_2021' && /^collaborate_\d+$/.test(action.action_library_id??'') && action.completion_status!=='not_needed') {
      const used=action.completion_status==='done' ? completed : Date.parse(action.created_at??'');
      if (used<=now && used+contextLifetime>now)
        candidates.push({key:`support:${action.id}:${used}`,trigger:'SUPPORT_USED',expires:used+contextLifetime,priority:2});
    }
    nextBaselines[action.id]={count:action.reschedule_count,schedule:action.scheduled_at,status:action.completion_status};
  }
  state.baselines=nextBaselines;
  for (const event of context.events??[]) {
    const updated=Date.parse(event.updated_at), key=`finalized:${event.id}:${event.updated_at}`;
    if(event.status==='planned' && updated<=now && updated+contextLifetime>now &&
      (state.eventStatuses?.[event.id]==='draft' || state.active?.key===key))
      candidates.push({key,trigger:'PLAN_FINALIZED',expires:updated+contextLifetime,priority:2});
  }
  if(context.events) state.eventStatuses=Object.fromEntries(context.events.map(e=>[e.id,e.status]));
  for(const entry of context.exploreCompletions??[]) {
    const completed=Date.parse(entry.completedAt);
    if(completed<=now && completed+contextLifetime>now)
      candidates.push({key:`explore:${entry.id}:${entry.completedAt}`,trigger:'EXPLORE_COMPLETED',expires:completed+contextLifetime,priority:2});
  }
  const activeCandidate=candidates.find(c=>c.key===state.active?.key);
  if (!activeCandidate || !state.active || state.active.expires<=now || !messages.some(m=>m.message_id===state.active?.messageId && m.trigger_key===activeCandidate.trigger)) state.active=null;
  const options=candidates.filter(c=>!Object.hasOwn(state.seen,c.key) && messages.some(m=>m.trigger_key===c.trigger)).sort((a,b)=>b.priority-a.priority || b.expires-a.expires || a.key.localeCompare(b.key));
  const next=options[0];
  if (next && (!state.active || next.priority>state.active.priority)) {
    const variants=messages.filter(m=>m.trigger_key===next.trigger);
    const message=variants[hash(`${accountKey}:${next.key}`)%variants.length];
    state.active={key:next.key,messageId:message.message_id,expires:next.expires,priority:next.priority};state.seen[next.key]=now;
  }
  return { message: messages.find(m=>m.message_id===state.active?.messageId) ?? daily, state };
}
