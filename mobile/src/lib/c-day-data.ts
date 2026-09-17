import { supabase } from "./supabase";
import type { CDayAction, CDayEvent, LibraryAction } from "./c-day-model";
export async function listCDays(userId: string): Promise<CDayEvent[]> {
  const { data, error } = await supabase
    .from("c_day_events")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["draft", "planned", "completed"])
    .order("event_start_at");
  if (error) throw error;
  return data;
}
export async function saveCDay(event: CDayEvent): Promise<CDayEvent> {
  const { data, error } = await supabase
    .from("c_day_events")
    .upsert(event, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
export async function getPlan(
  eventId: string,
  includeLibrary = true,
): Promise<{
  actions: CDayAction[];
  library: LibraryAction | null;
  items: LibraryAction[];
}> {
  const [actions, library] = await Promise.all([
    supabase
      .from("c_day_actions")
      .select("*")
      .eq("c_day_event_id", eventId)
      .order("scheduled_at"),
    includeLibrary
      ? supabase
          .from("action_library")
          .select("id,category,action_text,source,content_version,active,event_tags,context_tags")
          .eq("active", true)
          .eq("source", "Meyer_2021")
          .order("id")
      : Promise.resolve({ data: [] as LibraryAction[], error: null }),
  ]);
  if (actions.error) throw actions.error;
  if (library.error) throw library.error;
  return {
    actions: actions.data,
    library: library.data.find((a) => a.id === "call_01") ?? null,
    items: library.data,
  };
}
export async function saveCDayAction(
  action: Pick<
    CDayAction,
    | "id"
    | "c_day_event_id"
    | "action_library_id"
    | "scheduled_at"
    | "schedule_value"
    | "schedule_unit"
    | "difficulty"
    | "calendar_sync_enabled"
    | "calendar_sync_status"
    | "native_calendar_event_id"
    | "calendar_sync_message"
  >,
): Promise<CDayAction> {
  const { data, error } = await supabase
    .from("c_day_actions")
    .update(action)
    .eq("id", action.id)
    .eq("c_day_event_id", action.c_day_event_id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
export function planError(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (
    ["42P01", "PGRST205", "42703", "PGRST202", "PGRST204"].includes(
      value?.code ?? "",
    )
  )
    return "Planning setup is not installed in Supabase yet. Run the supplied Plan setup SQL, then try again.";
  if (
    value?.code === "P0001" &&
    value.message ===
      "Reflection is available after your planned C-Day event time"
  )
    return "Reflection opens after your C-Day event time. Please check the event time and try again then.";
  if (value?.code === "42501")
    return "Your account cannot save this plan. Check that you are signed in and the Plan database policies are installed.";
  return "Your plan could not be saved or loaded. Check your connection and try again. Your current entries are still here.";
}

// Update only sync metadata; a late result must not overwrite a newer schedule/preference.
export async function saveCalendarResult(
  action: CDayAction,
  result: import("./c-day-calendar").CalendarResult,
  syncEnabled?: boolean,
): Promise<CDayAction | null> {
  const { data, error } = await supabase
    .from("c_day_actions")
    .update({
      ...(syncEnabled === undefined ? {} : { calendar_sync_enabled: syncEnabled }),
      calendar_sync_status: result.status,
      native_calendar_event_id: result.nativeEventId,
      calendar_sync_message: result.message,
    })
    .eq("id", action.id)
    .eq("scheduled_at", action.scheduled_at)
    .eq("calendar_sync_enabled", action.calendar_sync_enabled)
    .eq(
      "updated_at",
      (action as CDayAction & { updated_at: string }).updated_at,
    )
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addDraftAction(
  eventId: string,
  action: LibraryAction,
): Promise<CDayAction> {
  const { data, error } = await supabase
    .from("c_day_actions")
    .insert({
      c_day_event_id: eventId,
      action_library_id: action.id,
      scheduled_at: null,
      difficulty: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
export async function removeDraftAction(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("c_day_actions")
    .delete()
    .eq("id", id)
    .is("native_calendar_event_id", null)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw Error("Action could not be removed.");
}

export async function savePlanRating(
  eventId: string,
  rating: number,
): Promise<CDayEvent> {
  const { data, error } = await supabase
    .from("c_day_events")
    .update({ plan_rating: rating })
    .eq("id", eventId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
export async function finalizeCDay(
  eventId: string,
  rating: number,
): Promise<CDayEvent> {
  const { data, error } = await supabase
    .rpc("finalize_c_day", { p_event_id: eventId, p_rating: rating })
    .single();
  if (error) throw error;
  return data as CDayEvent;
}
export async function getCDay(eventId: string): Promise<CDayEvent> {
  const { data, error } = await supabase
    .from("c_day_events")
    .select("*, reflection_tags:c_day_reflection_tags(tag)")
    .eq("id", eventId)
    .single();
  if (error) throw error;
  return data;
}

export async function followThroughAction(
  actionId: string,
  choice: "done" | "reschedule" | "not_needed",
  schedule?: {
    scheduled_at: string;
    schedule_value: number | null;
    schedule_unit: string;
  },
): Promise<CDayAction> {
  const { data, error } = await supabase
    .rpc("follow_through_c_day_action", {
      p_action_id: actionId,
      p_choice: choice,
      p_scheduled_at: schedule?.scheduled_at ?? null,
      p_schedule_value: schedule?.schedule_value ?? null,
      p_schedule_unit: schedule?.schedule_unit ?? "custom",
    })
    .single();
  if (error) throw error;
  return data as CDayAction;
}

export async function submitCDayReflection(
  eventId: string,
  helpfulness: string,
  tags: string[],
  notes: string,
): Promise<void> {
  const { error } = await supabase.rpc("complete_c_day_reflection", {
    p_event_id: eventId,
    p_helpfulness: helpfulness,
    p_tags: tags,
    p_notes: notes.trim() || null,
  });
  if (error) throw error;
}

export async function deleteCDay(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_c_day", { p_event_id: id });
  if (error) throw error;
}
