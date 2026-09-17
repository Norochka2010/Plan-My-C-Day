import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { CDayAction, CDayEvent } from '@/lib/c-day-model';
import { cDayCalendar, calendarUnavailableMessage } from '@/lib/c-day-calendar';
import { saveCalendarResult } from '@/lib/c-day-data';
export function CDayCalendarPanel({event,actions,onUpdate}:{event:CDayEvent;actions:CDayAction[];onUpdate:(action:CDayAction)=>void}) {
 const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function sync(remove=false){if(busy)return;setBusy(true);setMessage('Updating your iPhone calendar…');
 try {
  const results=[];
  const eventRequest={actionId:`event:${event.id}`,title:event.title,startsAt:event.event_start_at,timeZone:event.event_timezone,nativeEventId:null,durationMinutes:60,location:event.venue_name??undefined};
  results.push(await (remove?cDayCalendar.remove(eventRequest):cDayCalendar.create(eventRequest)));
  // Permission denial or unavailable module needs one explanation, not repeated prompts.
  if(['denied','pending'].includes(results[0].status)){setMessage(results[0].message||'Your plan is saved.');return;}
  for(const action of actions.filter(a=>a.scheduled_at && (remove || a.completion_status==='planned' || (a.completion_status==='not_needed' && a.native_calendar_event_id)))){
   const request={actionId:action.id,title:action.action_text_snapshot,startsAt:action.scheduled_at!,timeZone:event.event_timezone,nativeEventId:action.native_calendar_event_id};
   const removing=remove || action.completion_status==='not_needed';
   const result=await (removing?cDayCalendar.remove(request):cDayCalendar.create(request));results.push(result);
   // Calendar work never changes schedule, completion, difficulty or XP.
   try {const updated=await saveCalendarResult(action,result,!removing);if(!updated)throw Error("Plan changed during calendar sync");onUpdate(updated);}catch{setMessage('Calendar entries were processed, but a status could not be saved. My Plan is unchanged. Retry to check the entries.');return;}
  }
  const failure=results.find(r=>r.status==='failed'||r.status==='denied'||r.status==='pending');
  setMessage(failure?failure.message||'Some entries could not sync. Your plan is saved.':remove?'Removed the C-Day and its planned activities from your iPhone calendar.':`Added or updated ${results.length} calendar entries. Your plan is saved.`);
 }catch{setMessage('Calendar could not finish. Your in-app plan is unchanged.');}finally{setBusy(false)}}
 return <View style={{gap:8,padding:12,borderRadius:18,backgroundColor:'#E8EFDF'}}>
 <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
 <Text style={{fontSize:17,fontWeight:'700',color:'#334B37',flex:1}}>Calendar status</Text><Text style={{fontSize:16,color:'#334B37'}}>{expanded?'Hide −':'Manage +'}</Text>
 </Pressable>
 {expanded && <>
 <Text style={{color:'#52465E'}}>Optional · Event: 1 hour. Actions: 15 minutes.</Text>
 <Text style={{color:'#52465E'}}>Uses your default calendar. Edits there don’t change My Plan.</Text>
 {!cDayCalendar.available&&<Text>{calendarUnavailableMessage}</Text>}
 <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void sync()} style={{padding:14,borderRadius:14,backgroundColor:busy?'#C6C6C6':'#506B3E'}}><Text style={{color:'#FFFFFF',fontWeight:'700',textAlign:'center'}}>{busy?'Updating…':'Add / update iPhone calendar'}</Text></Pressable>
 <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void sync(true)} style={{padding:12}}><Text style={{color:'#334B37',textAlign:'center'}}>Remove these calendar entries</Text></Pressable>
 </>}
 {!!message&&<Text accessibilityLiveRegion="polite" style={{color:'#52465E'}}>{message}</Text>}
 </View>;
}
