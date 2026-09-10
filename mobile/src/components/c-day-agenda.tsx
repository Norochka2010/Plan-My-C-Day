import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fonts } from "@/constants/theme";
import { formatEventMoment, type CDayEvent } from "@/lib/c-day-model";
import {
  agendaGroups,
  eventsByDate,
  initialAgendaState,
  monthCells,
  shiftMonth,
  type AgendaState,
} from "@/lib/c-day-agenda";

export function CDayAgenda({
  events,
  now,
  featuredId,
  busy,
  state,
  onChange,
  onOpen,
}: {
  events: CDayEvent[];
  now: number;
  featuredId?: string;
  busy: boolean;
  state: AgendaState;
  onChange: (state: AgendaState) => void;
  onOpen: (event: CDayEvent) => void;
}) {
  const groups = agendaGroups(events, now, featuredId);
  const dates = eventsByDate(events);
  const selected = state.selectedDate
    ? (dates.get(state.selectedDate) ?? [])
    : [];
  const monthTitle = new Date(`${state.month}-01T12:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const inMonth = [...dates.keys()].filter((date) =>
    date.startsWith(state.month),
  );
  const dayTitle = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  function changeMonth(month: string) {
    onChange({ ...state, month, selectedDate: null });
  }
  function eventCard(event: CDayEvent) {
    return (
      <Pressable
        key={event.id}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${event.status === "draft" ? "Draft" : "Planned"}, ${formatEventMoment(event.event_start_at, event.event_timezone)}`}
        disabled={busy}
        accessibilityState={{ disabled: busy }}
        onPress={() => onOpen(event)}
        style={({ pressed }) => [
          s.eventCard,
          pressed && s.pressed,
          busy && s.disabled,
        ]}
      >
        <Text style={[s.status, s.statusBadge]}>
          {event.status === "draft" ? "○ Draft" : "★ Planned"}
        </Text>
        <Text style={s.eventTitle}>{event.title}</Text>
        <Text style={s.body}>
          {formatEventMoment(event.event_start_at, event.event_timezone)}
        </Text>
        <Text style={s.openText}>
          {event.status === "draft" ? "Continue draft ›" : "View plan ›"}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={s.section}>
      <Text style={s.heading}>Your C-Days</Text>
      <View style={s.toggle}>
        {(["list", "calendar"] as const).map((view) => (
          <Pressable
            key={view}
            accessibilityRole="tab"
            accessibilityState={{
              selected: state.view === view,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => onChange({ ...state, view })}
            style={[s.toggleButton, state.view === view && s.toggleSelected]}
          >
            <Text
              style={[
                s.toggleText,
                state.view === view && s.toggleSelectedText,
              ]}
            >
              {view === "list" ? "List" : "Calendar"}
            </Text>
          </Pressable>
        ))}
      </View>
      {state.view === "list" ? (
        <>
          {groups.upcoming.length > 0 && (
            <>
              <Text style={s.subheading}>Coming up · nearest first</Text>
              {groups.upcoming.map(eventCard)}
            </>
          )}
          {!groups.upcoming.length && (
            <Text style={s.body}>
              {featuredId
                ? "Your next draft is shown above. No other upcoming C-Days yet."
                : "No upcoming C-Days yet."}
            </Text>
          )}
          {groups.earlier.length > 0 && (
            <>
              <Text style={s.subheading}>Earlier dates</Text>
              <Text style={s.caption}>
                Drafts and plans you haven’t completed yet.
              </Text>
              {groups.earlier.map(eventCard)}
            </>
          )}
        </>
      ) : (
        <View style={s.calendar}>
          <View style={s.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              disabled={busy}
              style={s.monthButton}
              onPress={() => changeMonth(shiftMonth(state.month, -1))}
            >
              <Text style={s.arrow}>‹</Text>
            </Pressable>
            <Text accessibilityRole="header" style={s.monthTitle}>
              {monthTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={busy}
              style={s.monthButton}
              onPress={() => changeMonth(shiftMonth(state.month, 1))}
            >
              <Text style={s.arrow}>›</Text>
            </Pressable>
          </View>
          <View style={s.legend}>
            <Text style={s.status}>○ Draft</Text>
            <Text style={s.status}>★ Planned</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => changeMonth(initialAgendaState().month)}
              style={s.todayButton}
            >
              <Text style={s.openText}>This month</Text>
            </Pressable>
          </View>
          <View style={s.grid}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <View key={day} style={s.weekday}>
                <Text style={s.weekdayText}>{day}</Text>
              </View>
            ))}
            {monthCells(state.month).map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={s.day} />;
              const dayEvents = dates.get(date) ?? [];
              const draftCount = dayEvents.filter(
                (e) => e.status === "draft",
              ).length;
              const planCount = dayEvents.filter(
                (e) => e.status === "planned",
              ).length;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayTitle(date)}. ${draftCount} draft, ${planCount} planned.`}
                  accessibilityState={{
                    selected: state.selectedDate === date,
                    disabled: busy || !dayEvents.length,
                  }}
                  disabled={busy || !dayEvents.length}
                  style={[
                    s.day,
                    dayEvents.length > 0 && s.markedDay,
                    state.selectedDate === date && s.selectedDay,
                  ]}
                  onPress={() => {
                    onChange({ ...state, selectedDate: date });
                    if (dayEvents.length === 1) onOpen(dayEvents[0]);
                  }}
                >
                  <Text
                    style={[
                      s.dayNumber,
                      dayEvents.length > 0 && s.dayNumberMarked,
                    ]}
                  >
                    {Number(date.slice(-2))}
                  </Text>
                  <Text style={s.markers}>
                    {draftCount > 0 ? "○" : ""}
                    {planCount > 0 ? "★" : ""}
                    {dayEvents.length > 1 ? ` ${dayEvents.length}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.caption}>
            {inMonth.length
              ? "Tap a marked date to open a plan. A number means more than one C-Day."
              : "No draft or planned C-Days this month."}
          </Text>
          <Text style={s.caption}>Dates use each C-Day’s saved time zone.</Text>
          {state.selectedDate && selected.length > 1 && (
            <View style={s.section}>
              <Text accessibilityLiveRegion="polite" style={s.subheading}>
                {dayTitle(state.selectedDate)}
              </Text>
              {selected.map(eventCard)}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 12 },
  heading: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: "700",
    color: "#302040",
  },
  subheading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#354C29",
    marginTop: 4,
  },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 18,
    backgroundColor: "#EEF0E8",
    borderWidth: 1,
    borderColor: "#D5DDCF",
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 14,
  },
  toggleSelected: {
    backgroundColor: "#D8E9CA",
    borderWidth: 1,
    borderColor: "#7B9B65",
  },
  toggleText: { fontSize: 16, color: "#62556E" },
  toggleSelectedText: { fontWeight: "700", color: "#354C29" },
  eventCard: {
    padding: 16,
    gap: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E5DA",
    borderLeftWidth: 3,
    borderLeftColor: "#B4CCA2",
  },
  eventTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    fontWeight: "600",
    color: "#302040",
  },
  body: { fontSize: 15, lineHeight: 23, color: "#62556E" },
  caption: { fontSize: 13, lineHeight: 20, color: "#62556E" },
  status: { fontSize: 14, fontWeight: "600", color: "#496B36" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: "#EDF2E6" },
  openText: { fontSize: 14, fontWeight: "600", color: "#354C29" },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.6 },
  calendar: {
    padding: 12,
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#C5DDB5",
  },
  monthHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.rounded,
    fontSize: 19,
    fontWeight: "700",
    color: "#354C29",
  },
  monthButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#E1EED7",
  },
  arrow: { fontSize: 25, color: "#354C29" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  todayButton: {
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: "14.2857%", alignItems: "center", paddingVertical: 6 },
  weekdayText: { fontSize: 11, color: "#62556E" },
  day: {
    width: "14.2857%",
    minHeight: 58,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  markedDay: { backgroundColor: "#EDF5E7" },
  selectedDay: { borderColor: "#557A40", backgroundColor: "#D8E9CA" },
  dayNumber: { fontSize: 16, color: "#62556E" },
  dayNumberMarked: { fontWeight: "700", color: "#354C29" },
  markers: { fontSize: 12, minHeight: 18, color: "#496B36" },
});
