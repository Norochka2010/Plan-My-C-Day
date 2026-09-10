import { localFields, type CDayEvent } from "./c-day-model";
export type AgendaState = {
  view: "list" | "calendar";
  month: string;
  selectedDate: string | null;
};
export function initialAgendaState(): AgendaState {
  const date = new Date();
  return {
    view: "list",
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    selectedDate: null,
  };
}
export function activeCDays(events: CDayEvent[]): CDayEvent[] {
  return events
    .filter((e) => e.status === "draft" || e.status === "planned")
    .sort(
      (a, b) =>
        Date.parse(a.event_start_at) - Date.parse(b.event_start_at) ||
        a.id.localeCompare(b.id),
    );
}
export function nearestDraft(
  events: CDayEvent[],
  now: number,
): CDayEvent | undefined {
  return activeCDays(events).find(
    (e) => e.status === "draft" && Date.parse(e.event_start_at) > now,
  );
}
export function agendaGroups(
  events: CDayEvent[],
  now: number,
  featuredId?: string,
) {
  const list = activeCDays(events).filter((e) => e.id !== featuredId);
  return {
    upcoming: list.filter((e) => Date.parse(e.event_start_at) > now),
    earlier: list.filter((e) => Date.parse(e.event_start_at) <= now).reverse(),
  };
}
export function eventsByDate(events: CDayEvent[]): Map<string, CDayEvent[]> {
  const dates = new Map<string, CDayEvent[]>();
  for (const event of activeCDays(events)) {
    const date = localFields(event.event_start_at, event.event_timezone).date;
    dates.set(date, [...(dates.get(date) ?? []), event]);
  }
  return dates;
}
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function monthCells(month: string): (string | null)[] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= count; d++)
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
