import { supabase } from "./supabase";
import type { CDayAction, CDayEvent, Difficulty } from "./c-day-model";

export type HistoricalAction = Pick<
  CDayAction,
  | "id"
  | "c_day_event_id"
  | "action_library_id"
  | "action_text_snapshot"
  | "source_snapshot"
  | "source_version_snapshot"
  | "scheduled_at"
  | "difficulty"
  | "completion_status"
  | "xp_awarded"
>;
export type HistoricalCDay = Pick<
  CDayEvent,
  | "id"
  | "user_id"
  | "event_type"
  | "title"
  | "event_start_at"
  | "event_timezone"
  | "status"
> & { actions: HistoricalAction[] };
export type DifficultyCounts = Record<Difficulty, number> & {
  unrecorded: number;
};
export type ActionHistory = {
  actionLibraryId: string;
  title: string;
  counts: DifficultyCounts;
  occasions: { event: HistoricalCDay; action: HistoricalAction }[];
};
const emptyCounts = (): DifficultyCounts => ({
  easy: 0,
  moderate: 0,
  hard: 0,
  unrecorded: 0,
});

/** Existing owner RLS plus an explicit account filter. No persistent summary dataset. */
export async function getCompletedCDayHistory(
  userId: string,
): Promise<HistoricalCDay[]> {
  const rows: HistoricalCDay[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase
      .from("c_day_events")
      .select(
        "id,user_id,event_type,title,event_start_at,event_timezone,status,actions:c_day_actions(id,c_day_event_id,action_library_id,action_text_snapshot,source_snapshot,source_version_snapshot,scheduled_at,difficulty,completion_status,xp_awarded)",
      )
      .eq("user_id", userId)
      .eq("event_type", "dinner_with_friends")
      .eq("status", "completed")
      .order("event_start_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + 99);
    if (error) throw error;
    rows.push(...(data as HistoricalCDay[]));
    if (data.length < 100) return rows;
  }
}

export function summarizeCDayHistory(rows: HistoricalCDay[], userId: string) {
  const events = [
    ...new Map(
      rows
        .filter(
          (event) =>
            event.user_id === userId &&
            event.event_type === "dinner_with_friends" &&
            event.status === "completed",
        )
        .map((event) => [event.id, event]),
    ).values(),
  ].sort(
    (a, b) =>
      Date.parse(b.event_start_at) - Date.parse(a.event_start_at) ||
      a.id.localeCompare(b.id),
  );
  const groups = new Map<string, ActionHistory>(),
    seen = new Set<string>(),
    counts = emptyCounts();
  let doneActions = 0,
    earnedXP = 0;
  for (const event of events)
    for (const action of event.actions) {
      if (action.c_day_event_id !== event.id || seen.has(action.id)) continue;
      seen.add(action.id);
      let group = groups.get(action.action_library_id);
      if (!group) {
        // Display the most recent historical snapshot, never current library wording.
        group = {
          actionLibraryId: action.action_library_id,
          title: action.action_text_snapshot,
          counts: emptyCounts(),
          occasions: [],
        };
        groups.set(action.action_library_id, group);
      }
      group.occasions.push({ event, action });
      const difficulty =
        action.difficulty === "easy" ||
        action.difficulty === "moderate" ||
        action.difficulty === "hard"
          ? action.difficulty
          : "unrecorded";
      group.counts[difficulty]++;
      counts[difficulty]++;
      if (action.completion_status === "done") {
        doneActions++;
        if (Number.isSafeInteger(action.xp_awarded) && action.xp_awarded! >= 0)
          earnedXP += action.xp_awarded!;
      }
    }
  return {
    completedCDays: events.length,
    doneActions,
    earnedXP,
    counts,
    actions: [...groups.values()].sort(
      (a, b) =>
        a.title.localeCompare(b.title) ||
        a.actionLibraryId.localeCompare(b.actionLibraryId),
    ),
  };
}
