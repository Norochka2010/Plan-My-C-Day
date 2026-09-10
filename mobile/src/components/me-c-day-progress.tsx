import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  getCompletedCDayHistory,
  summarizeCDayHistory,
  type HistoricalCDay,
  type DifficultyCounts,
} from "@/lib/c-day-progress";
import { formatEventMoment, formatMoment, newId } from "@/lib/c-day-model";

function Counts({ counts }: { counts: DifficultyCounts }) {
  return (
    <Text style={s.body}>
      {counts.easy} Easy · {counts.moderate} Moderate · {counts.hard} Hard
      {counts.unrecorded > 0 ? ` · ${counts.unrecorded} not recorded` : ""}
    </Text>
  );
}
export function MeCDayProgress({ userId }: { userId: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<HistoricalCDay[]>([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const generation = useRef(0),
    focused = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setFailed(false);
    try {
      const rows = await getCompletedCDayHistory(userId);
      if (focused.current && generation.current === request) setRecords(rows);
    } catch {
      if (focused.current && generation.current === request) setFailed(true);
    } finally {
      if (focused.current && generation.current === request) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      return () => {
        focused.current = false;
        generation.current++;
        listener.remove();
      };
    }, [refresh]),
  );
  const summary = summarizeCDayHistory(records, userId);
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.heading}>
        Your Plan My C-Day history
      </Text>
      <Text style={s.small}>Private to your account · Dinner With Friends</Text>
      <Text style={s.small}>
        Includes C-Days completed after saving a reflection. Actions and XP from
        ongoing plans aren’t included here yet.
      </Text>
      {loading && (
        <View style={s.loading}>
          <ActivityIndicator />
          <Text style={s.body}>Loading your history…</Text>
        </View>
      )}
      {failed && (
        <View accessibilityLiveRegion="polite" style={s.gap}>
          <Text style={s.body}>
            We couldn’t refresh your history. Check your connection and try
            again.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => void refresh()}
          >
            <Text style={s.link}>Try again</Text>
          </Pressable>
          {records.length > 0 && (
            <Text style={s.small}>Showing your last loaded history.</Text>
          )}
        </View>
      )}
      {!loading && !failed && summary.completedCDays === 0 && (
        <Text style={s.body}>
          Your history will appear here after an event has passed and you save
          its reflection. There’s no rush.
        </Text>
      )}
      {summary.completedCDays > 0 && (
        <>
          <View style={s.tiles}>
            <View style={s.tile}>
              <Text style={s.number}>{summary.completedCDays}</Text>
              <Text style={s.small}>Completed C-Days</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.number}>{summary.doneActions}</Text>
              <Text style={s.small}>Actions marked Done</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.number}>{summary.earnedXP}</Text>
              <Text style={s.small}>Plan action XP earned</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{expanded:showPatterns}} style={s.button} onPress={()=>setShowPatterns(v=>!v)}>
            <Text style={s.link}>{showPatterns ? "Hide action history −" : "Explore action history +"}</Text>
          </Pressable>
          {showPatterns && <View style={s.gap}>
      <Text style={s.body}>
        The same task can feel different in different situations. These are your
        own ratings for those moments—not a score or a measure of improvement.
      </Text>
          <Text style={s.subheading}>How tasks felt in those plans</Text>
          <Counts counts={summary.counts} />
          <Text style={s.small}>
            Includes all selected actions, even ones later marked not needed or
            left planned.
          </Text>
          <Text style={s.subheading}>Look back by action</Text>
          <Text style={s.small}>
            As more occasions are saved, you’ll have more context to look back
            on. Tap an action to see its individual occasions.
          </Text>
          {summary.actions.map((group) => (
            <View style={s.action} key={group.actionLibraryId}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  expanded: expanded === group.actionLibraryId,
                }}
                style={s.actionButton}
                onPress={() =>
                  setExpanded((value) =>
                    value === group.actionLibraryId
                      ? null
                      : group.actionLibraryId,
                  )
                }
              >
                <Text style={s.subheading}>{group.title}</Text>
                <Text style={s.body}>
                  Selected {group.occasions.length}{" "}
                  {group.occasions.length === 1 ? "time" : "times"} in completed
                  C-Days.
                </Text>
                <Counts counts={group.counts} />
                <Text style={s.link}>
                  {expanded === group.actionLibraryId
                    ? "Hide occasions −"
                    : "View occasions +"}
                </Text>
              </Pressable>
              {expanded === group.actionLibraryId && (
                <View style={s.gap}>
                  <Text style={s.small}>
                    Heading uses the most recent saved wording. Each occasion
                    keeps its original wording and context.
                  </Text>
                  {group.occasions.map(({ event, action }) => (
                    <View style={s.occasion} key={action.id}>
                      <Text style={s.subheading}>{event.title}</Text>
                      <Text style={s.small}>
                        {formatEventMoment(
                          event.event_start_at,
                          event.event_timezone,
                        )}
                      </Text>
                      <Text style={s.body}>{action.action_text_snapshot}</Text>
                      <Text style={s.body}>
                        Felt {action.difficulty ?? "unrecorded"} for this C-Day
                      </Text>
                      {!!action.scheduled_at && (
                        <Text style={s.small}>
                          Scheduled:{" "}
                          {formatMoment(
                            action.scheduled_at,
                            event.event_timezone,
                          )}
                        </Text>
                      )}
                      <Text style={s.small}>
                        {action.completion_status === "done"
                          ? "Done"
                          : action.completion_status === "not_needed"
                            ? "Not needed"
                            : "Planned · no outcome recorded"}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        style={s.button}
                        onPress={() =>
                          router.push({
                            pathname: "/plan",
                            params: { eventId: event.id, entry: newId() },
                          })
                        }
                      >
                        <Text style={s.link}>View this past C-Day →</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          </View>}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        style={[s.button, {backgroundColor:"#426B43"}]}
        onPress={() =>
          router.push({
            pathname: "/plan",
            params: { view: "history", entry: newId() },
          })
        }
      >
        <Text style={[s.link,{color:"#FFFFFF",textAlign:"center"}]}>Past C-Days →</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  section: {
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E5DA",
    borderRadius: 22,
    padding: 18,
  },
  heading: {
    color: "#302040",
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "600",
  },
  subheading: {
    color: "#35204E",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  body: { color: "#62556E", fontSize: 14, lineHeight: 22 },
  small: { color: "#716579", fontSize: 12, lineHeight: 19 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: 100,
    gap: 5,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#EDF5E7",
  },
  number: { color: "#36552F", fontSize: 26, fontWeight: "600" },
  button: { minHeight: 48, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#EAF0F7" },
  link: { color: "#5D4277", fontSize: 14, fontWeight: "600", lineHeight: 22 },
  action: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#DDD2E4",
    paddingTop: 10,
  },
  actionButton: { gap: 8, paddingVertical: 8 },
  occasion: {
    backgroundColor: "#F4EEF7",
    padding: 12,
    gap: 8,
    borderRadius: 14,
  },
  gap: { gap: 10 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center" },
});
