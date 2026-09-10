import { supabase } from "./supabase";
import type { CDayAction, CDayEvent } from "./c-day-model";

export type UpcomingAction = Pick<
  CDayAction,
  | "id"
  | "action_text_snapshot"
  | "scheduled_at"
  | "completion_status"
  | "action_library_id"
  | "difficulty"
>;
export type UpcomingCDay = CDayEvent & { actions: UpcomingAction[] };

// Left embedding keeps drafts with no actions. Existing owner RLS applies to both tables.
export async function listUpcomingCDays(
  userId: string,
  now = Date.now(),
): Promise<UpcomingCDay[]> {
  const records: UpcomingCDay[] = [];
  const cutoff = new Date(now).toISOString();
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase
      .from("c_day_events")
      .select(
        "id,user_id,event_type,title,venue_name,event_start_at,event_timezone,status,actions:c_day_actions(id,action_text_snapshot,scheduled_at,completion_status,action_library_id,difficulty)",
      )
      .eq("user_id", userId)
      .in("status", ["draft", "planned"])
      .gt("event_start_at", cutoff)
      .order("event_start_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + 99);
    if (error) throw error;
    records.push(...(data as UpcomingCDay[]));
    if (data.length < 100) break;
  }
  return upcomingCDays(records, now);
}

export function upcomingCDays(events: UpcomingCDay[], now: number) {
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .filter(
      (event) =>
        (event.status === "draft" || event.status === "planned") &&
        Date.parse(event.event_start_at) > now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.event_start_at) - Date.parse(b.event_start_at) ||
        a.id.localeCompare(b.id),
    );
}

export function nextUpcomingAction(
  event: UpcomingCDay,
  now: number,
): UpcomingAction | null {
  return (
    event.actions
      .filter(
        (action) =>
          action.completion_status === "planned" &&
          action.scheduled_at &&
          Date.parse(action.scheduled_at) > now &&
          Date.parse(action.scheduled_at) <= Date.parse(event.event_start_at),
      )
      .sort(
        (a, b) =>
          Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!) ||
          a.id.localeCompare(b.id),
      )[0] ?? null
  );
}
