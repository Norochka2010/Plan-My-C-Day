import { CDayExploreSupport } from "./c-day-explore-support";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  formatEventMoment,
  formatMoment,
  newId,
} from "@/lib/c-day-model";
import {
  listUpcomingCDays,
  nextUpcomingAction,
  upcomingCDays,
  type UpcomingCDay,
} from "@/lib/c-day-upcoming";

export function HomeUpcomingCDays() {
  const [account, setAccount] = useState<{ ready: boolean; id: string | null }>(
    { ready: false, id: null },
  );
  useEffect(() => {
    let active = true,
      changed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) setAccount({ ready: true, id: session?.user.id ?? null });
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active && !changed)
          setAccount({ ready: true, id: data.session?.user.id ?? null });
      })
      .catch(() => {
        if (active && !changed) setAccount({ ready: true, id: null });
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Upcoming C-Days</Text>
      {!account.ready ? (
        <ActivityIndicator accessibilityLabel="Loading your account" />
      ) : account.id ? (
        <UpcomingCards key={account.id} userId={account.id} />
      ) : (
        <View style={s.card}>
          <Text style={s.title}>Your next C-Day</Text>
          <Text style={s.body}>
            Sign in through Me to see your saved plans here.
          </Text>
        </View>
      )}
    </View>
  );
}

function UpcomingCards({ userId }: { userId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<UpcomingCDay[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now()),
    [width, setWidth] = useState(0),
    [page, setPage] = useState(0);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const generation = useRef(0),
    mounted = useRef(true),
    carousel = useRef<ScrollView>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(false);
    setNow(Date.now());
    try {
      const result = await listUpcomingCDays(userId);
      if (mounted.current && generation.current === request) setEvents(result);
    } catch {
      if (mounted.current && generation.current === request) setError(true);
    } finally {
      if (mounted.current && generation.current === request) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => setNow(Date.now()), 15000);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      return () => {
        clearInterval(timer);
        listener.remove();
        generation.current++;
      };
    }, [refresh]),
  );
  const visible = upcomingCDays(events, now);
  const activeEvent = visible[Math.min(page, visible.length - 1)];
  const activeHeight = activeEvent ? cardHeights[`${width}:${activeEvent.id}`] : undefined;
  const identity = visible.map((event) => event.id).join(",");
  useEffect(() => {
    setPage(0);
    carousel.current?.scrollTo({ x: 0, animated: false });
  }, [identity, width]);
  function browse(index: number) {
    const next = Math.max(0, Math.min(visible.length - 1, index));
    setPage(next);
    carousel.current?.scrollTo({ x: next * width, animated: false });
  }
  function open(eventId: string, actionId?: string) {
    // push becomes NAVIGATE for this non-stack tab navigator. Unlike its JUMP_TO
    // shortcut, this updates params even when Plan has already been visited.
    router.push({
      pathname: "/plan",
      params: { eventId, actionId: actionId ?? "", entry: newId() },
    });
  }
  return (
    <View
      style={s.section}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {loading && (
        <View style={s.row}>
          <ActivityIndicator size="small" />
          <Text style={s.body}>Updating your plans…</Text>
        </View>
      )}
      {error && (
        <View style={s.card} accessibilityLiveRegion="polite">
          <Text style={s.body}>
            We couldn’t refresh your plans. Check your connection and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={s.link}
          >
            <Text style={s.linkText}>Try again</Text>
          </Pressable>
          {visible.length > 0 && (
            <Text style={s.small}>Showing your last loaded plans.</Text>
          )}
        </View>
      )}
      {!loading && !error && visible.length === 0 && (
        <View style={s.card}>
          <Text style={s.title}>Your next C-Day</Text>
          <Text style={s.body}>
            No upcoming C-Days yet. Your next plan will appear here.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.link}
            onPress={() => router.push("/plan")}
          >
            <Text style={s.linkText}>Open Plan My C-Day →</Text>
          </Pressable>
        </View>
      )}
      {width > 0 && visible.length > 0 && (
        <>
          <ScrollView
            ref={carousel}
            horizontal
            style={{ flexGrow: 0, height: activeHeight }}
            contentContainerStyle={{ alignItems: "flex-start" }}
            removeClippedSubviews={false}
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(
                Math.max(
                  0,
                  Math.min(
                    visible.length - 1,
                    Math.round(e.nativeEvent.contentOffset.x / width),
                  ),
                ),
              )
            }
          >
            {visible.map((event, index) => {
              const action = nextUpcomingAction(event, now);
              return (
                <View key={event.id} style={{ width, paddingHorizontal: 1, flexShrink: 0 }}>
                  <View style={s.eventCard} onLayout={(e) => {
                    // Size the carousel to the current card, not the tallest offscreen plan.
                    const measured = Math.ceil(e.nativeEvent.layout.height);
                    const key = `${width}:${event.id}`;
                    if (measured > 0) setCardHeights(previous => previous[key] === measured ? previous : { ...previous, [key]: measured });
                  }}>
                    <View style={s.cardHeader}>
                      <View style={s.statusGroup}>
                        <View style={s.badge}><Text style={s.icon}>▦</Text></View>
                        <Text style={s.status}>{event.status === "draft" ? "○ Draft" : "★ Planned"}</Text>
                      </View>
                      {visible.length > 1 && <View style={s.browseButtons}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Previous C-Day"
                          accessibilityState={{ disabled: index === 0 }} disabled={index === 0}
                          onPress={() => browse(index - 1)}
                          style={({ pressed }) => [s.browseButton, index === 0 && s.disabledArrow, pressed && s.pressed]}>
                          <Text style={s.arrow}>‹</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Next C-Day"
                          accessibilityState={{ disabled: index === visible.length - 1 }} disabled={index === visible.length - 1}
                          onPress={() => browse(index + 1)}
                          style={({ pressed }) => [s.browseButton, index === visible.length - 1 && s.disabledArrow, pressed && s.pressed]}>
                          <Text style={s.arrow}>›</Text>
                        </Pressable>
                      </View>}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${event.title}, ${event.status}`}
                      onPress={() => open(event.id)}
                      style={({ pressed }) => [
                        s.eventButton,
                        pressed && s.pressed,
                      ]}
                    >
                      <Text style={s.title}>{event.title}</Text>
                      <Text style={s.body}>
                        {formatEventMoment(
                          event.event_start_at,
                          event.event_timezone,
                        )}
                      </Text>
                      {!!event.venue_name && (
                        <Text style={s.body}>{event.venue_name}</Text>
                      )}
                      <Text style={s.linkText}>
                        {event.status === "draft"
                          ? "Continue your draft →"
                          : "View your plan →"}
                      </Text>
                    </Pressable>
                    {action ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open next action: ${action.action_text_snapshot}`}
                        onPress={() => open(event.id, action.id)}
                        style={({ pressed }) => [
                          s.action,
                          pressed && s.pressed,
                        ]}
                      >
                        <Text style={s.small}>NEXT SCHEDULED ACTION</Text>
                        <Text style={s.actionTitle}>
                          {action.action_text_snapshot}
                        </Text>
                        <Text style={s.body}>
                          {formatMoment(
                            action.scheduled_at!,
                            event.event_timezone,
                          )}
                        </Text>
                        <Text style={s.linkText}>Open action →</Text>
                      </Pressable>
                    ) : (
                      <View style={s.action}>
                        <Text style={s.body}>
                          No upcoming action scheduled.
                        </Text>
                      </View>
                    )}
                    {action && index === page && (
                      <View
                        style={{ paddingHorizontal: 18, paddingBottom: 14 }}
                      >
                        <CDayExploreSupport
                          action={action}
                          eventType={event.event_type}
                          eventStatus={event.status}
                          origin="home"
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#35204E",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  card: {
    borderWidth: 1.5,
    borderColor: "#D5C0E3",
    borderRadius: 18,
    backgroundColor: "#FFFDFA",
    padding: 18,
    gap: 10,
  },
  eventCard: {
    borderWidth: 1.5,
    borderColor: "#D5C0E3",
    borderRadius: 18,
    backgroundColor: "#FFFDFA",
    overflow: "hidden",
  },
  eventButton: { padding: 18, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F2EAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 27, color: "#5D4277" },
  status: { color: "#5D4277", fontSize: 14, fontWeight: "600" },
  title: { color: "#241638", fontSize: 20, lineHeight: 27, fontWeight: "600" },
  body: { color: "#62556E", fontSize: 14, lineHeight: 21 },
  small: { color: "#6E6577", fontSize: 12, lineHeight: 18 },
  action: {
    padding: 18,
    gap: 7,
    backgroundColor: "#F4EEF7",
    borderTopWidth: 1,
    borderTopColor: "#DED0E7",
  },
  actionTitle: {
    color: "#35204E",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: {
    color: "#5D4277",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  cardHeader: { paddingHorizontal: 18, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusGroup: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  browseButtons: { flexDirection: "row", gap: 4 },
  browseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F2EAF7", alignItems: "center", justifyContent: "center" },
  arrow: { color: "#5D4277", fontSize: 28, lineHeight: 32 },
  disabledArrow: { opacity: 0.3 },
  pressed: { opacity: 0.65 },
});
