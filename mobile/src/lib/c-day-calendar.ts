import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { CalendarStatus } from './c-day-model';
export type CalendarRequest = { actionId: string; title: string; startsAt: string; timeZone: string; nativeEventId: string | null; durationMinutes?: number; location?: string };
export type CalendarResult = { status: CalendarStatus; nativeEventId: string | null; message: string | null };
export interface CDayCalendarService { readonly available: boolean; create(request: CalendarRequest): Promise<CalendarResult>; update(request: CalendarRequest): Promise<CalendarResult>; remove(request: CalendarRequest): Promise<CalendarResult> }
type Link = { id?: string; calendarId: string; startsAt: string };
const queues = new Map<string, Promise<CalendarResult>>();
function available() { try { return Platform.OS === 'ios' && !!requireOptionalNativeModule('ExpoCalendar'); } catch { return false; } }
export const calendarUnavailableMessage = 'Calendar support is missing from this app build. Rebuild and reinstall the iPhone development app, then reload. Your plan is saved without calendar access.';
async function perform(request: CalendarRequest, remove: boolean): Promise<CalendarResult> {
 const key = `c-day-calendar-device:v1:${request.actionId}`;
 let link: Link | null = null;
 try {
  link = JSON.parse(await AsyncStorage.getItem(key) || 'null');
  if (!available()) return {status:'pending',nativeEventId:link?.id ?? null,message:calendarUnavailableMessage};
  // Lazy import prevents missing native modules from crashing the rest of the app.
  const Calendar: typeof import('expo-calendar/legacy') = require('expo-calendar/legacy');
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) return {status:'denied',nativeEventId:link?.id ?? null,message:'Calendar access was not granted. Your plan is saved. You can allow Full Access in iPhone Settings and try again.'};
  const starts = new Date(request.startsAt);
  if (!Number.isFinite(starts.getTime())) throw Error('Invalid calendar time');
  const marker = `Plan My C-Day reference: ${request.actionId}`;
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  let calendar = link ? calendars.find(c=>c.id===link!.calendarId && c.allowsModifications) : undefined;
  if (!link) { const preferred = await Calendar.getDefaultCalendarAsync(); calendar = calendars.find(c=>c.id===preferred.id && c.allowsModifications); }
  if (!calendar) return {status:'failed',nativeEventId:link?.id ?? null,message:'No writable linked/default calendar is available. Check your iPhone Calendar settings. Your plan is saved.'};
  // Recover interrupted creates using a stable marker and the saved original time.
  if (!link?.id) {
   const anchor = new Date(link?.startsAt ?? request.startsAt).getTime();
   const matches = await Calendar.getEventsAsync([calendar.id],new Date(anchor-86400000),new Date(anchor+86400000));
   const found = matches.find(e=>e.notes===marker);
   if (found) link={calendarId:calendar.id,startsAt:request.startsAt,id:found.id};
  }
  if(remove) {
   if(link?.id) { const existing=await Calendar.getEventAsync(link.id); if(existing.notes!==marker) throw Error('Calendar link does not match'); await Calendar.deleteEventAsync(link.id); }
   await AsyncStorage.removeItem(key);
   return {status:'not_requested',nativeEventId:null,message:'Removed this app’s entry from your iPhone calendar.'};
  }
  const details = {title:request.title,startDate:starts,endDate:new Date(starts.getTime()+(request.durationMinutes ?? 15)*60000),timeZone:request.timeZone,location:request.location,notes:marker};
  if(link?.id) {
   // Verify ownership marker before changing anything; never change another calendar entry.
   const existing=await Calendar.getEventAsync(link.id);
   if(existing.notes!==marker) throw Error('Calendar link does not match');
   await Calendar.updateEventAsync(link.id,details);
  } else {
   link={calendarId:calendar.id,startsAt:request.startsAt};
   await AsyncStorage.setItem(key,JSON.stringify(link));
   link.id=await Calendar.createEventAsync(calendar.id,details);
  }
  link.startsAt=request.startsAt;
  await AsyncStorage.setItem(key,JSON.stringify(link));
  return {status:'synced',nativeEventId:link.id!,message:'Added to your iPhone calendar. Changes in Calendar do not change My Plan.'};
 } catch {
  return {status:'failed',nativeEventId:link?.id ?? null,message:'Calendar sync could not finish. Your plan is saved. Check calendar access and try again. If you deleted the entry directly in Calendar, its saved link may need repair.'};
 }
}
function enqueue(request:CalendarRequest,remove=false) {
 const previous=queues.get(request.actionId) ?? Promise.resolve({} as CalendarResult);
 const next=previous.catch(()=>({} as CalendarResult)).then(()=>perform(request,remove));
 queues.set(request.actionId,next);void next.finally(()=>{if(queues.get(request.actionId)===next)queues.delete(request.actionId)});return next;
}
export const cDayCalendar:CDayCalendarService={get available(){return available()},create:r=>enqueue(r),update:r=>enqueue(r),remove:r=>enqueue(r,true)};
export async function prepareCalendarSync(enabled:boolean,request:CalendarRequest,service:CDayCalendarService=cDayCalendar):Promise<CalendarResult>{
 if(!enabled&&!request.nativeEventId)return {status:'not_requested',nativeEventId:null,message:null};
 try {return !enabled?await service.remove(request):request.nativeEventId?await service.update(request):await service.create(request)}catch{return {status:'failed',nativeEventId:request.nativeEventId,message:'Calendar sync could not finish. Your plan is saved.'}}
}
