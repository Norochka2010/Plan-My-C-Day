export type Difficulty = "easy" | "moderate" | "hard";
export type CalendarStatus =
  "not_requested" | "pending" | "synced" | "denied" | "failed";
export type CDayEvent = {
  custom_context?: { answers: Record<string,string[]>; tags: string[] } | null;
  builder_version?: string | null;
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  venue_name: string | null;
  plan_rating?: number | null;
  reflection_helpfulness?: string | null;
  reflection_notes?: string | null;
  reflected_at?: string | null;
  reflection_tags?: { tag: string }[];
  event_start_at: string;
  event_timezone: string;
  status: "draft" | "planned" | "completed" | "cancelled";
};
export type LibraryAction = {
  event_tags?: string[];
  context_tags?: string[];
  id: string;
  category: string;
  action_text: string;
  source: string;
  content_version: number;
  active: boolean;
};
export type CDayAction = {
  id: string;
  c_day_event_id: string;
  action_library_id: string;
  action_text_snapshot: string;
  source_snapshot: string;
  source_version_snapshot: number;
  scheduled_at: string | null;
  schedule_value: number | null;
  schedule_unit: "hours" | "days" | "weeks" | "custom";
  difficulty: Difficulty | null;
  completion_status: "planned" | "done" | "not_needed";
  completed_at?: string | null;
  xp_awarded?: number;
  reschedule_count: number;
  calendar_sync_enabled: boolean;
  calendar_sync_status: CalendarStatus;
  native_calendar_event_id: string | null;
  calendar_sync_message: string | null;
};
export const categories = [
  "ASK",
  "PREPARE",
  "CHECK",
  "AVOID",
  "TAKE",
  "COLLABORATE",
  "CALL",
  "SAY",
] as const;
export { eventTypes } from "./c-day-event-types";
export function newId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}
export function localFields(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (name: string) => parts.find((p) => p.type === name)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
/** Reject nonexistent or ambiguous wall times rather than silently shift a user's plan. */
export function resolveDateTime(
  date: string,
  time: string,
  zone: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw Error("Enter a date as MM-DD-YYYY and a time with AM or PM.");
  const [y, m, d] = date.split("-").map(Number),
    [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min),
    check = new Date(wall);
  if (
    y < 2000 ||
    m < 1 ||
    m > 12 ||
    h > 23 ||
    min > 59 ||
    check.getUTCDate() !== d
  )
    throw Error("Enter a valid date and time.");
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = wall + delta * 3600000,
      f = localFields(new Date(probe).toISOString(), zone);
    offsets.add(Date.parse(`${f.date}T${f.time}:00Z`) - probe);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wall - offset).toISOString())
    .filter((iso) => {
      const f = localFields(iso, zone);
      return f.date === date && f.time === time;
    });
  if (candidates.length === 0)
    throw Error(
      "That time does not exist because the clocks change. Choose another time.",
    );
  if (candidates.length > 1)
    throw Error(
      "That time occurs twice because the clocks change. Choose a time outside that repeated hour.",
    );
  return candidates[0];
}
/** Presets round forward in the event's wall clock; custom input is never rounded. */
export function roundPresetTime(iso: string, zone: string): string {
  const fields = localFields(iso, zone);
  const instant = new Date(iso);
  const wall = Date.parse(`${fields.date}T${fields.time}:00Z`) +
    instant.getUTCSeconds() * 1000 + instant.getUTCMilliseconds();
  const rounded = new Date(Math.ceil(wall / (15 * 60000)) * 15 * 60000).toISOString();
  return resolveDateTime(rounded.slice(0, 10), rounded.slice(11, 16), zone);
}
export function relativeSchedule(event: CDayEvent, days: number) {
  const f = localFields(event.event_start_at, event.event_timezone);
  const date = new Date(`${f.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return roundPresetTime(resolveDateTime(
    date.toISOString().slice(0, 10),
    f.time,
    event.event_timezone,
  ), event.event_timezone);
}
export function validateSchedule(
  iso: string,
  event: CDayEvent,
  now = Date.now(),
) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= now)
    throw Error("Choose a future time for this action.");
  if (t > Date.parse(event.event_start_at) + 15 * 60000)
    throw Error("Choose a time no later than 15 minutes after your C-Day starts.");
}
export function formatMoment(iso: string, zone: string) {
  const f = localFields(iso, zone),
    h = Number(f.time.slice(0, 2));
  return `${Number(f.date.slice(5, 7))}-${f.date.slice(8)}-${f.date.slice(0, 4)} · ${h % 12 || 12}:${f.time.slice(3)} ${h >= 12 ? "PM" : "AM"}${eventTimezoneIndicator(iso, zone)}`;
}
export function canFinalize(actions: Pick<CDayAction, "completion_status">[]) {
  const n = actions.filter((a) => a.completion_status !== "not_needed").length;
  return n >= 2 && n <= 6;
}

export function actionCategory(id: string): string {
  return id.split("_")[0].toUpperCase();
}
export function sortActions(actions: CDayAction[]): CDayAction[] {
  return [...actions].sort(
    (a, b) =>
      (a.scheduled_at ? Date.parse(a.scheduled_at) : Infinity) -
      (b.scheduled_at ? Date.parse(b.scheduled_at) : Infinity),
  );
}

/** Today stays on today's calendar date in the event timezone, even near midnight. */
export function todaySchedule(event: CDayEvent, now = Date.now()): string {
  const result = roundPresetTime(
    new Date(now + 15 * 60000).toISOString(), event.event_timezone,
  );
  if (
    localFields(result, event.event_timezone).date !==
    localFields(new Date(now).toISOString(), event.event_timezone).date
  )
    throw Error(
      "The next available 15-minute time is tomorrow. Choose a date and time instead.",
    );
  validateSchedule(result, event, now);
  return result;
}

export function finalizationIssue(actions: CDayAction[]): string | null {
  const selected = actions.filter((a) => a.completion_status !== "not_needed");
  if (selected.length < 2)
    return "Choose at least 2 actions before finalizing. Your draft is saved.";
  if (selected.length > 6)
    return "Choose no more than 6 actions before finalizing.";
  if (
    selected.some(
      (a) =>
        !a.scheduled_at ||
        !Number.isFinite(Date.parse(a.scheduled_at)) ||
        !a.difficulty,
    )
  )
    return "Set a schedule and difficulty for every selected action before finalizing.";
  return null;
}

export const helpfulnessOptions = [
  "Not helpful yet",
  "A little helpful",
  "Helpful",
  "Very helpful",
  "Not sure",
] as const;
export const reflectionTagOptions = [
  "Planning ahead",
  "Asking questions",
  "Getting support",
  "Communicating my needs",
  "Using reminders",
  "Adapting my plan",
] as const;

/** Display persisted awards only; never infer awards from difficulty on the client. */
export function cDayEarnedXP(
  actions: Pick<CDayAction, "completion_status" | "xp_awarded">[],
): number {
  return actions.reduce(
    (total, action) =>
      total +
      (action.completion_status === "done" &&
      Number.isSafeInteger(action.xp_awarded) &&
      action.xp_awarded! > 0
        ? action.xp_awarded!
        : 0),
    0,
  );
}

/** Event display only. Input and action schedule formats remain unchanged. */
export function formatEventMoment(iso: string, zone: string): string {
  const instant = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(instant)
    .replace(/\s/g, "");
  return `${date}, ${time}${eventTimezoneIndicator(iso, zone)}`;
}

/** Display-only cue: dates remain in the saved event zone, never converted for display to the phone zone. */
export function eventTimezoneIndicator(iso: string, zone: string, phoneZone?: string): string {
  try {
    const canonical = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    const local = phoneZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (canonical(zone) === canonical(local)) return "";
    const abbreviation = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(new Date(iso)).find(part => part.type === "timeZoneName")?.value;
    return abbreviation ? ` · ${abbreviation}` : ` · ${zone.replace(/_/g, " ")}`;
  } catch {
    return "";
  }
}
