import type { CalendarStatus } from "./c-day-model";
export type CalendarRequest = {
  actionId: string;
  title: string;
  startsAt: string;
  timeZone: string;
  nativeEventId: string | null;
};
export type CalendarResult = {
  status: CalendarStatus;
  nativeEventId: string | null;
  message: string | null;
};
export interface CDayCalendarService {
  readonly available: boolean;
  create(request: CalendarRequest): Promise<CalendarResult>;
  update(request: CalendarRequest): Promise<CalendarResult>;
  remove(request: CalendarRequest): Promise<CalendarResult>;
}
const message =
  "Saved in My Plan only. Phone calendar sync is not available in Expo Go. A development build with calendar support is needed.";
/** No native import: safe in Expo Go and web. Replace this adapter after native integration is authorized. */
export const cDayCalendar: CDayCalendarService = {
  available: false,
  async create(request) {
    return { status: "pending", nativeEventId: request.nativeEventId, message };
  },
  async update(request) {
    return { status: "pending", nativeEventId: request.nativeEventId, message };
  },
  async remove(request) {
    return {
      status: "pending",
      nativeEventId: request.nativeEventId,
      message:
        "Calendar removal is unavailable in this build. No phone event was changed.",
    };
  },
};
export async function prepareCalendarSync(
  enabled: boolean,
  request: CalendarRequest,
  service: CDayCalendarService = cDayCalendar,
): Promise<CalendarResult> {
  if (!enabled && !request.nativeEventId)
    return { status: "not_requested", nativeEventId: null, message: null };
  try {
    if (!enabled) return await service.remove(request);
    return request.nativeEventId
      ? await service.update(request)
      : await service.create(request);
  } catch {
    return {
      status: "failed",
      nativeEventId: request.nativeEventId,
      message:
        "Calendar sync could not finish. Your action can still be saved in My Plan.",
    };
  }
}
