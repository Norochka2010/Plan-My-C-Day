import {readAccountProgress} from './explore-account-progress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { parseInspirationMessages, parseInspirationState, selectInspiration, type InspirationContext, type InspirationAction, type InspirationMessage } from './home-inspiration-model';
async function readMessages(): Promise<InspirationMessage[]> {
  const rows: unknown[]=[];
  for(let offset=0;;offset+=100) {
    const {data,error}=await supabase.from('home_inspiration_messages').select('message_id,message_text,theme,message_type,trigger_key,review_status,active').eq('active',true).eq('review_status','approved').order('message_id').range(offset,offset+99);
    if(error)throw error;if(!data)throw Error('Inspiration unavailable');rows.push(...data);if(data.length<100)return parseInspirationMessages(rows);
  }
}
async function readContext(userId: string, now: number): Promise<InspirationContext> {
  const {data:future,error}=await supabase.from('c_day_events').select('event_start_at').eq('user_id',userId).eq('status','planned').gt('event_start_at',new Date(now).toISOString()).order('event_start_at').limit(1);
  if(error)throw error;if(!future)throw Error('Context unavailable');
  const actions: InspirationAction[]=[];
  for(let offset=0;;offset+=100) {
    const {data,error:actionError}=await supabase.from('c_day_actions')
      .select('id,action_library_id,source_snapshot,created_at,completion_status,difficulty,completed_at,scheduled_at,reschedule_count,updated_at,c_day_events!inner(user_id,status)')
      .eq('c_day_events.user_id',userId).in('c_day_events.status',['draft','planned']).order('id').range(offset,offset+99);
    if(actionError)throw actionError;if(!data)throw Error('Action context unavailable');actions.push(...data as InspirationAction[]);if(data.length<100)break;
  }
  const events: NonNullable<InspirationContext['events']>=[];
  for(let offset=0;;offset+=100) {
    const {data,error}=await supabase.from('c_day_events').select('id,status,updated_at').eq('user_id',userId).in('status',['draft','planned']).order('id').range(offset,offset+99);
    if(error)throw error;if(!data)throw Error('Event context unavailable');events.push(...data);if(data.length<100)break;
  }
  return {nextPlannedAt:future[0]?.event_start_at??null,actions,events};
}
// Observe account-backed completion dates only; reflection and XP do not enter selection.
let observedAccount: string | null = null;
let exploreSince = Infinity;
async function readExploreCompletions(): Promise<NonNullable<InspirationContext['exploreCompletions']>> {
 return (await readAccountProgress()).filter(p=>p.status==='completed' && !p.imported_from_device && p.completed_at && Date.parse(p.completed_at)>exploreSince).map(p=>({id:p.content_id,completedAt:p.completed_at!}));
}
export type InspirationDisplay = { message: InspirationMessage; validUntil: number };
let queue: Promise<unknown> = Promise.resolve();
/** Account-scoped local display state; no writes to Plan, Explore, XP, or auth. */
export function readHomeInspiration(userId: string | null): Promise<InspirationDisplay | null> {
  const run=queue.then(async()=>{
    const now=new Date();
    if(observedAccount!==userId) {observedAccount=userId;exploreSince=now.getTime();}
    const messages=await readMessages();
    const context=userId?await readContext(userId,now.getTime()).catch(()=>null):null;
    if(context)context.exploreCompletions=await readExploreCompletions().catch(()=>[]);
    const account=userId??'guest',key=`home-inspiration:v1:${account}`;
    const state=parseInspirationState(await AsyncStorage.getItem(key));
    const result=selectInspiration(messages,state,context,account,now);
    await AsyncStorage.setItem(key,JSON.stringify(result.state));
    if (!result.message) return null;
    const midnight=new Date(now);midnight.setHours(24,0,0,0);
    const validUntil=result.state.active?.messageId===result.message.message_id ? Math.min(result.state.active.expires,midnight.getTime()) : midnight.getTime();
    return {message:result.message,validUntil};
  });queue=run.catch(()=>undefined);return run;
}
