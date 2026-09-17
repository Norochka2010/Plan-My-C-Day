import type { CDayEvent } from './c-day-model';
/** Derived archive: preserve original outcomes and allow a later reflection. */
export function isArchivedCDay(event: Pick<CDayEvent, 'status' | 'event_start_at'>, now = Date.now()): boolean {
  return event.status === 'planned' && Date.parse(event.event_start_at) <= now - 30 * 24 * 60 * 60 * 1000;
}
