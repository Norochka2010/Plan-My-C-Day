import { CDayExploreSupport } from "./c-day-explore-support";
import { CDayAgenda } from "./c-day-agenda";
import {
  initialAgendaState,
  nearestDraft,
  activeCDays,
} from "@/lib/c-day-agenda";
import { CDayActionSelector } from "./c-day-action-selector";
import { PlanDateField, PlanTimeField } from "./c-day-date-time";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { LeafCharacter } from "@/components/leaf-character";
import { Fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import {
  getPlan,
  submitCDayReflection,
  listCDays,
  planError,
  saveCDay,
  saveCDayAction,
  saveCalendarResult,
  savePlanRating,
  finalizeCDay,
  getCDay,
  followThroughAction,
  addDraftAction,
  removeDraftAction,
} from "@/lib/c-day-data";
import { cDayCalendar, prepareCalendarSync } from "@/lib/c-day-calendar";
import {
  actionCategory,
  cDayEarnedXP,
  helpfulnessOptions,
  reflectionTagOptions,
  sortActions,
  finalizationIssue,
  categories,
  eventTypes,
  formatMoment,
  formatEventMoment,
  localFields,
  newId,
  relativeSchedule,
  todaySchedule,
  resolveDateTime,
  validateSchedule,
  type CDayAction,
  type CDayEvent,
  type Difficulty,
  type LibraryAction,
} from "@/lib/c-day-model";
function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  polished = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  polished?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondaryButton,
        polished && (secondary ? s.polishedSecondary : s.polishedPrimary),
        disabled && s.disabledButton,
        pressed && !disabled && s.dim,
      ]}
    >
      <Text style={[s.buttonText, polished && (secondary ? s.polishedSecondaryText : s.polishedPrimaryText), disabled && s.disabledText]}>{label}</Text>
    </Pressable>
  );
}
function PlanRewards({ rating, xp }: { rating?: number | null; xp: number }) {
  return (
    <View style={s.rewardsCard}>
      {rating != null && (
        <View
          accessible
          accessibilityLabel={`Your plan rating: ${rating} out of 5 stars`}
          style={[s.rewardTile, s.ratingSummary]}
        >
          <Text style={s.rewardLabel}>Your plan rating</Text>
          <View style={s.rewardRow}>
            <Text style={s.ratingStars}>
              {"★".repeat(rating)}
              <Text style={s.emptyStars}>{"☆".repeat(5 - rating)}</Text>
            </Text>
            <Text style={s.ratingValue}>{rating} / 5</Text>
          </View>
        </View>
      )}
      <View
        style={[s.rewardTile, s.xpSummary, rating == null && s.soloReward]}
        accessible
        accessibilityLabel={`${xp} XP earned from completed actions`}
        accessibilityLiveRegion="polite"
      >
        <Text style={s.rewardLabel}>✦ Your earned XP</Text>
        <Text style={s.xpValue}>
          {xp}
          <Text style={s.xpUnit}> XP</Text>
        </Text>
        <Text style={s.rewardCaption}>From completed actions</Text>
      </View>
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={s.gap}>
      <Text style={s.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#82768B"
        editable={editable}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        style={s.input}
      />
    </View>
  );
}
type PlanEntry = {
  entryEventId?: string;
  entryActionId?: string;
  entryKey?: string;
  entryView?: "history";
};
export function CDayPlanner(entry: PlanEntry = {}) {
  const [user, setUser] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true,
      changed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) {
        setUser(session?.user.id ?? null);
        setReady(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active && !changed) {
          setUser(data.session?.user.id ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!ready)
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator accessibilityLabel="Loading your account" />
      </SafeAreaView>
    );
  if (!user)
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
        <View style={s.content}>
          <LeafCharacter size={120} />
          <Text style={s.title}>Plan My C-Day</Text>
          <Text style={s.body}>
            Sign in through the Me tab to save your plans to your account. Then
            return here to get started.
          </Text>
        </View>
      </SafeAreaView>
    );
  return (
    <Planner
      key={`${user}:${entry.entryKey ?? entry.entryEventId ?? "landing"}`}
      userId={user}
      {...entry}
    />
  );
}
type Step =
  | "home"
  | "types"
  | "details"
  | "categories"
  | "call"
  | "schedule"
  | "difficulty"
  | "calendar"
  | "plan"
  | "confirmed"
  | "reflection"
  | "complete"
  | "history";
function Planner({
  userId,
  entryEventId,
  entryActionId,
  entryView,
}: { userId: string } & PlanEntry) {
  const router = useRouter();
  const homeAction = useRef(entryActionId ?? null);
  const [step, setStep] = useState<Step>(
      entryEventId ? "plan" : (entryView ?? "home"),
    ),
    [events, setEvents] = useState<CDayEvent[]>([]);
  const [event, setEvent] = useState<CDayEvent | null>(null),
    [actions, setActions] = useState<CDayAction[]>([]),
    [configuredAction, setConfiguredAction] = useState<CDayAction | null>(null);
  const [agendaState, setAgendaState] = useState(initialAgendaState);
  const [items, setItems] = useState<LibraryAction[]>([]);
  const [helpfulness, setHelpfulness] = useState<string | null>(null);
  const [reflectionTags, setReflectionTags] = useState<string[]>([]);
  const [reflectionNotes, setReflectionNotes] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const [category, setCategory] = useState<string>("CALL");
  const [id, setId] = useState(""),
    [title, setTitle] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [venue, setVenue] = useState(""),
    [zone, setZone] = useState("");
  const [actionId, setActionId] = useState(""),
    [editing, setEditing] = useState(false),
    [actionDate, setActionDate] = useState(""),
    [actionTime, setActionTime] = useState("");
  const [relative, setRelative] = useState<{
    value: number | null;
    unit: "days" | "weeks" | "custom";
  }>({ value: null, unit: "custom" });
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null),
    [sync, setSync] = useState(false);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const locked = useRef(false),
    alive = useRef(true),
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listCDays(userId);
      if (alive.current) setEvents(list);
    } catch (e) {
      if (alive.current) setError(planError(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      if (step === "home" || step === "history") void refresh();
    }, [step, refresh]),
  );
  async function operation(fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(planError(e));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const [entryLoading, setEntryLoading] = useState(!!entryEventId);
  const [entryError, setEntryError] = useState("");
  const [focusedAction, setFocusedAction] = useState<string | null>(null);
  const entryGeneration = useRef(0),
    focusPending = useRef(false),
    focusY = useRef<number | null>(null);
  const loadEntry = useCallback(async () => {
    if (!entryEventId) return;
    const generation = ++entryGeneration.current;
    setEntryLoading(true);
    setEntryError("");
    try {
      const current = await getCDay(entryEventId);
      if (current.user_id !== userId)
        throw Error("This plan is not available for this account.");
      const plan = await getPlan(current.id, current.status !== "completed");
      if (!alive.current || generation !== entryGeneration.current) return;
      setEvent(current);
      setActions(plan.actions);
      setItems(plan.items);
      setStep("plan");
      const target = plan.actions.find((action) => action.id === entryActionId);
      setFocusedAction(target?.id ?? null);
      focusPending.current = !!target;
      focusY.current = null;
      if (entryActionId && !target)
        setNotice(
          "That action is no longer in this plan. Here is your current plan.",
        );
    } catch (e) {
      if (alive.current && generation === entryGeneration.current)
        setEntryError(planError(e));
    } finally {
      if (alive.current && generation === entryGeneration.current)
        setEntryLoading(false);
    }
  }, [entryEventId, entryActionId, userId]);
  useEffect(() => {
    void loadEntry();
    return () => {
      entryGeneration.current++;
    };
  }, [loadEntry]);
  function focusEntryAction() {
    if (!focusPending.current || focusY.current === null) return;
    requestAnimationFrame(() => {
      if (alive.current && focusPending.current && focusY.current !== null) {
        scroll.current?.scrollTo({
          y: Math.max(0, focusY.current - 16),
          animated: false,
        });
        focusPending.current = false;
      }
    });
  }
  function candidate(): CDayEvent {
    if (!title.trim()) throw Error("Give your C-Day a name.");
    const start = resolveDateTime(date, time, zone);
    if (Date.parse(start) <= Date.now())
      throw Error("Choose a future date and time for your C-Day.");
    return {
      id,
      user_id: userId,
      event_type: "dinner_with_friends",
      title: title.trim(),
      venue_name: venue.trim() || null,
      event_start_at: start,
      event_timezone: zone,
      status: "draft",
    };
  }
  // Debounced, idempotent draft saving starts as soon as required fields are valid.
  useEffect(() => {
    if (step !== "details" || !id) return;
    let draft: CDayEvent;
    try {
      draft = candidate();
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      if (!locked.current)
        void operation(async () => {
          const saved = await saveCDay(draft);
          if (alive.current) {
            setEvent(saved);
            setNotice("Draft saved to your account.");
          }
        });
    }, 900);
    return () => clearTimeout(timer);
    // These are precisely the editable draft fields. Saves do not restart this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, id, title, date, time, venue, zone]);
  function start() {
    setId(newId());
    setEvent(null);
    setActions([]);
    setConfiguredAction(null);
    setTitle("Dinner With Friends");
    setDate("");
    setTime("");
    setVenue("");
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setNotice("");
    setError("");
    setStep("types");
  }
  async function continueDetails() {
    let draft: CDayEvent;
    try {
      draft = candidate();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    await operation(async () => {
      const saved = await saveCDay(draft),
        plan = await getPlan(saved.id);
      if (alive.current) {
        setEvent(saved);
        setActions(plan.actions);
        setItems(plan.items);
        setNotice("Draft saved.");
        setStep("categories");
      }
    });
  }
  async function openDraft(draft: CDayEvent) {
    await operation(async () => {
      const current = await getCDay(draft.id);
      const plan = await getPlan(draft.id, current.status !== "completed");
      if (alive.current) {
        setEvent(current);
        setActions(plan.actions);
        setItems(plan.items);
        setNotice("");
        setStep("plan");
      }
    });
  }
  function beginReflection() {
    setHelpfulness(null);
    setReflectionTags([]);
    setReflectionNotes("");
    setNotice("");
    setError("");
    setStep("reflection");
  }
  async function completeReflection() {
    if (!event || !helpfulness || event.status !== "planned") return;
    await operation(async () => {
      try {
        await submitCDayReflection(
          event.id,
          helpfulness,
          reflectionTags,
          reflectionNotes,
        );
        const current = await getCDay(event.id);
        const historicalPlan = await getPlan(event.id, false);
        if (alive.current) {
          setActions(historicalPlan.actions);
          setEvent(current);
          setNotice("");
          setStep("complete");
        }
      } catch (e) {
        // A lost response can follow a successful commit. Read before inviting a retry.
        try {
          const current = await getCDay(event.id);
          if (current.status === "completed") {
            const historicalPlan = await getPlan(event.id, false);
            if (alive.current) {
              setActions(historicalPlan.actions);
              setEvent(current);
              setNotice("");
              setStep("complete");
            }
            return;
          }
        } catch {
          /* Keep all reflection entries for a retry. */
        }
        throw e;
      }
    });
  }
  async function ratePlan(rating: number) {
    if (!event || event.status !== "draft") return;
    await operation(async () => {
      const updated = await savePlanRating(event.id, rating);
      if (alive.current) {
        setEvent(updated);
        setNotice("Plan rating saved.");
      }
    });
  }
  async function finalizePlan() {
    if (
      !event ||
      event.status !== "draft" ||
      !event.plan_rating ||
      finalizationIssue(actions)
    )
      return;
    await operation(async () => {
      try {
        const updated = await finalizeCDay(event.id, event.plan_rating!);
        const plan = await getPlan(updated.id);
        if (alive.current) {
          setEvent(updated);
          setActions(plan.actions);
          setNotice("");
          setStep("confirmed");
        }
      } catch {
        try {
          const [current, plan] = await Promise.all([
            getCDay(event.id),
            getPlan(event.id),
          ]);
          if (alive.current) {
            setEvent(current);
            setActions(plan.actions);
            if (current.status === "planned") {
              setError("");
              setStep("confirmed");
            } else
              setError(
                finalizationIssue(plan.actions) ??
                  "Your plan could not be finalized. Please try again.",
              );
          }
        } catch {
          if (alive.current)
            setError(
              "We could not confirm whether finalization finished. Reopen your plan when connected, or try again.",
            );
        }
      }
    });
  }
  async function addSelection(item: LibraryAction) {
    if (!event || locked.current) return;
    if (
      actions.filter((a) => a.completion_status !== "not_needed").length >= 6
    ) {
      setError("Your draft already has six actions. Remove one first.");
      return;
    }
    await operation(async () => {
      const selected = await addDraftAction(event.id, item);
      if (alive.current) {
        setActions((current) => sortActions([...current, selected]));
        setNotice("Action added to your draft.");
        if (item.id === "call_01") chooseAction(selected);
      }
    });
  }
  async function removeSelection(action: CDayAction) {
    await operation(async () => {
      await removeDraftAction(action.id);
      if (alive.current) {
        setActions((current) => current.filter((a) => a.id !== action.id));
        setNotice("Action removed from your draft.");
      }
    });
  }
  function returnHomeAfterDone(action: CDayAction, choice: string) {
    if (
      choice === "done" &&
      action.completion_status === "done" &&
      homeAction.current === action.id
    ) {
      homeAction.current = null;
      router.push("/");
    }
  }
  async function followThrough(
    action: CDayAction,
    choice: "done" | "reschedule" | "not_needed",
    scheduled?: string,
  ) {
    if (
      !event ||
      event.status !== "planned" ||
      action.completion_status !== "planned"
    )
      return;
    await operation(async () => {
      try {
        const updated = await followThroughAction(
          action.id,
          choice,
          scheduled
            ? {
                scheduled_at: scheduled,
                schedule_value: relative.value,
                schedule_unit: relative.unit,
              }
            : undefined,
        );
        if (alive.current) {
          setActions((current) =>
            sortActions(
              current.map((a) => (a.id === updated.id ? updated : a)),
            ),
          );
          setNotice(
            choice === "done"
              ? "Marked as done."
              : choice === "not_needed"
                ? "This action is marked as not needed."
                : "Your new time is saved.",
          );
          if (choice === "reschedule") setStep("plan");
          returnHomeAfterDone(updated, choice);
        }
      } catch (e) {
        try {
          const plan = await getPlan(event.id),
            current = plan.actions.find((a) => a.id === action.id);
          if (alive.current) {
            setActions(plan.actions);
            if (
              current &&
              (current.completion_status === choice ||
                (choice === "reschedule" &&
                  current.completion_status === "planned" &&
                  current.scheduled_at &&
                  scheduled &&
                  Date.parse(current.scheduled_at) === Date.parse(scheduled)))
            ) {
              setNotice(
                choice === "done"
                  ? "Marked as done."
                  : choice === "not_needed"
                    ? "This action is marked as not needed."
                    : "Your new time is saved.",
              );
              setStep("plan");
              returnHomeAfterDone(current, choice);
              return;
            }
            if (current && current.completion_status !== "planned")
              setStep("plan");
          }
        } catch {}
        throw e;
      }
    });
  }
  function chooseAction(existing: CDayAction) {
    setConfiguredAction(existing);
    setEditing(!!existing);
    setActionId(existing?.id ?? newId());
    setDifficulty(existing?.difficulty ?? null);
    setSync(existing?.calendar_sync_enabled ?? false);
    if (existing?.scheduled_at && event) {
      const f = localFields(existing.scheduled_at, event.event_timezone);
      setActionDate(f.date);
      setActionTime(f.time);
      setRelative({
        value: existing.schedule_value,
        unit:
          existing.schedule_unit === "weeks"
            ? "weeks"
            : existing.schedule_unit === "days"
              ? "days"
              : "custom",
      });
    } else {
      setActionDate("");
      setActionTime("");
      setRelative({ value: null, unit: "custom" });
    }
    setError("");
    setNotice("");
    setStep("schedule");
  }
  const [presetVisit, setPresetVisit] = useState(0);
  const [presetMessage, setPresetMessage] = useState("");
  const [presetError, setPresetError] = useState("");
  const presetScrollPending = useRef(false);
  useEffect(() => { setPresetMessage(""); setPresetError(""); presetScrollPending.current = false; }, [step, actionId]);
  function pickSchedule(days: number | null) {
    if (!event) return;
    try {
      const iso =
        days === null ? todaySchedule(event) : relativeSchedule(event, days);
      validateSchedule(iso, event);
      const f = localFields(iso, event.event_timezone);
      setActionDate(f.date);
      setActionTime(f.time);
      setRelative(
        days === null
          ? { value: null, unit: "custom" }
          : days === 7
            ? { value: 1, unit: "weeks" }
            : { value: days, unit: "days" },
      );
      setError("");
      setPresetError("");
      setPresetMessage("✓ Date and time selected. Review or adjust them below.");
      presetScrollPending.current = true;
      setPresetVisit(v => v + 1);
    } catch (e) {
      presetScrollPending.current = false;
      setPresetMessage("");
      setPresetError((e as Error).message);
      setError("");
    }
  }
  let resolved: string | null = null;
  if (event && actionDate && actionTime) {
    try {
      resolved = resolveDateTime(actionDate, actionTime, event.event_timezone);
    } catch {}
  }
  function continueSchedule() {
    if (!event) return;
    try {
      const iso = resolveDateTime(actionDate, actionTime, event.event_timezone);
      validateSchedule(iso, event);
      setError("");
      if (event.status === "planned" && configuredAction) {
        void followThrough(configuredAction, "reschedule", iso);
        return;
      }
      setStep("difficulty");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveAction() {
    if (!event || !configuredAction || !difficulty) return;
    let scheduled: string;
    try {
      scheduled = resolveDateTime(actionDate, actionTime, event.event_timezone);
      validateSchedule(scheduled, event);
    } catch (e) {
      setError((e as Error).message);
      setStep("schedule");
      return;
    }
    await operation(async () => {
      const prior = actions.find((a) => a.id === actionId);
      const saved = await saveCDayAction({
        id: actionId,
        c_day_event_id: event.id,
        action_library_id: configuredAction.action_library_id,
        scheduled_at: scheduled,
        schedule_value: relative.value,
        schedule_unit: relative.unit,
        difficulty,
        calendar_sync_enabled: sync,
        calendar_sync_status:
          sync || prior?.native_calendar_event_id ? "pending" : "not_requested",
        native_calendar_event_id: prior?.native_calendar_event_id ?? null,
        calendar_sync_message: null,
      });
      // The in-app action is persisted before optional calendar work starts.
      if (alive.current) {
        setActions((current) =>
          sortActions([...current.filter((a) => a.id !== saved.id), saved]),
        );
        setNotice("Your draft plan is saved.");
        setStep("plan");
      }
      void (async () => {
        const cal = await prepareCalendarSync(sync, {
          actionId,
          title: configuredAction.action_text_snapshot,
          startsAt: scheduled,
          timeZone: event.event_timezone,
          nativeEventId: prior?.native_calendar_event_id ?? null,
        });
        const updated = await saveCalendarResult(saved, cal);
        if (alive.current && updated)
          setActions((current) =>
            current.map((a) => (a.id === updated.id ? updated : a)),
          );
      })().catch(() => {
        if (alive.current)
          setNotice(
            "Your draft is saved. Calendar status could not be updated; it will remain pending until checked.",
          );
      });
    });
  }
  function back() {
    setError("");
    setNotice("");
    const previous: Record<Step, Step> = {
      home: "home",
      types: "home",
      details: "types",
      categories: "plan",
      call: "categories",
      schedule: editing ? "plan" : "call",
      difficulty: "schedule",
      calendar: "difficulty",
      plan: event?.status === "completed" ? "history" : "home",
      reflection: "plan",
      complete: "home",
      history: "home",
      confirmed: "home",
    };
    if (previous[step] === "home" || previous[step] === "history")
      homeAction.current = null;
    setStep(previous[step]);
  }
  const activeActions = sortActions(actions).filter(
    (a) => a.completion_status !== "not_needed",
  );
  const displayedActions =
    event?.status !== "draft" ? sortActions(actions) : activeActions;
  const nextEvent = nearestDraft(events, now);
  if (entryLoading || entryError)
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
        <View style={s.content}>
          <LeafCharacter size={100} />
          <Text style={s.title}>Your C-Day</Text>
          {entryLoading ? (
            <>
              <ActivityIndicator />
              <Text style={s.body}>Loading your plan…</Text>
            </>
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" style={s.body}>
                {entryError}
              </Text>
              <Button label="Try again" onPress={() => void loadEntry()} />
            </>
          )}
          <Button
            label="Open Plan My C-Day"
            secondary
            onPress={() => {
              entryGeneration.current++;
              setEntryLoading(false);
              setEntryError("");
              setStep("home");
            }}
          />
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={focusEntryAction}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
      >
        {step !== "home" && (
          <Button label="‹ Back" onPress={back} disabled={busy} secondary />
        )}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>PLAN MY C-DAY</Text>
          {step !== "home" && <LeafCharacter size={48} />}
        </View>
        {busy && (
          <Text accessibilityLiveRegion="polite" style={s.statusBox}>
            {step === "reflection"
              ? "Saving your reflection…"
              : step === "home" || step === "history"
                ? "Loading your plan…"
                : "Saving…"}
          </Text>
        )}
        {step === "home" && (
          <>
            <View style={s.welcomeRow}>
              <View style={s.welcomeText}>
                <Text style={s.title}>Plan My C-Day</Text>
                <Text style={s.body}>What’s coming up? Let’s make a plan.</Text>
              </View>
              <LeafCharacter size={76} />
            </View>
            {loading ? (
              <ActivityIndicator accessibilityLabel="Loading your plans" />
            ) : nextEvent ? (
              <View style={[s.card, s.eventSummary]}>
                <Text style={s.statusBadge}>○ Your next draft</Text>
                <Text style={s.heading}>{nextEvent.title}</Text>
                <Text style={s.body}>
                  {formatEventMoment(
                    nextEvent.event_start_at,
                    nextEvent.event_timezone,
                  )}
                </Text>
                <Button polished
                  label="Continue My Plan"
                  onPress={() => void openDraft(nextEvent)}
                  disabled={busy}
                />
              </View>
            ) : (
              !error &&
              activeCDays(events).length === 0 && (
                <Text style={s.body}>Your next C-Day can start here.</Text>
              )
            )}
            <Button polished
              label="+ Plan a New C-Day"
              onPress={start}
              disabled={busy || loading}
            />
            {!loading && !error && (
              <CDayAgenda
                events={events}
                now={now}
                featuredId={nextEvent?.id}
                busy={busy}
                state={agendaState}
                onChange={setAgendaState}
                onOpen={(selected) => void openDraft(selected)}
              />
            )}
            <Button polished
              secondary
              label="Past C-Days"
              onPress={() => {
                setError("");
                setNotice("");
                setStep("history");
              }}
              disabled={busy}
            />
            {!!error && (
              <Button polished
                label="Retry loading plans"
                onPress={() => void refresh()}
                disabled={loading || busy}
              />
            )}
          </>
        )}
        {step === "history" && (
          <>
            <Text style={s.title}>Past C-Days</Text>
            {loading ? (
              <ActivityIndicator accessibilityLabel="Loading past C-Days" />
            ) : (
              <>
                {!error && !events.some((e) => e.status === "completed") && (
                  <Text style={s.body}>
                    Your completed C-Days will appear here after reflection.
                  </Text>
                )}
                {events
                  .filter((e) => e.status === "completed")
                  .sort(
                    (a, b) =>
                      Date.parse(b.event_start_at) -
                      Date.parse(a.event_start_at),
                  )
                  .map((e) => (
                    <Button
                      key={e.id}
                      secondary
                      label={`${e.title} · ${formatEventMoment(e.event_start_at, e.event_timezone)}`}
                      onPress={() => void openDraft(e)}
                      disabled={busy}
                    />
                  ))}
              </>
            )}
            {!!error && (
              <Button
                label="Retry loading history"
                onPress={() => void refresh()}
                disabled={loading || busy}
              />
            )}
          </>
        )}
        {step === "reflection" && event && (
          <>
            <Text style={s.title}>A moment to reflect</Text>
            <Text style={s.heading}>{event.title}</Text>
            <Text style={s.heading}>How helpful did your plan feel?</Text>
            {helpfulnessOptions.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: helpfulness === value,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => setHelpfulness(value)}
                style={[
                  s.button,
                  s.secondaryButton,
                  helpfulness === value && {
                    backgroundColor: "#C5DDB5",
                    borderWidth: 2,
                    borderColor: "#496B36",
                  },
                ]}
              >
                <Text style={s.buttonText}>
                  {helpfulness === value ? "✓ " : ""}
                  {value}
                </Text>
              </Pressable>
            ))}
            <Text style={s.heading}>What worked? (optional)</Text>
            {reflectionTagOptions.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: reflectionTags.includes(tag),
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() =>
                  setReflectionTags((current) =>
                    current.includes(tag)
                      ? current.filter((t) => t !== tag)
                      : [...current, tag],
                  )
                }
                style={[
                  s.button,
                  s.secondaryButton,
                  reflectionTags.includes(tag) && {
                    backgroundColor: "#C5DDB5",
                    borderWidth: 2,
                    borderColor: "#496B36",
                  },
                ]}
              >
                <Text style={s.buttonText}>
                  {reflectionTags.includes(tag) ? "✓ " : ""}
                  {tag}
                </Text>
              </Pressable>
            ))}
            <Text style={s.heading}>
              Anything you’d do differently next time?
            </Text>
            <Text style={s.small}>Optional · up to 2,000 characters</Text>
            <TextInput
              accessibilityLabel="Anything you’d do differently next time? Optional"
              multiline
              textAlignVertical="top"
              maxLength={2000}
              value={reflectionNotes}
              onChangeText={setReflectionNotes}
              editable={!busy}
              style={[s.input, { minHeight: 120 }]}
            />
            <Text style={s.small}>
              This saves your reflection and moves this C-Day to history. Your
              actions will stay as recorded.
            </Text>
            <Button
              label={busy ? "Saving…" : "Complete my C-Day"}
              onPress={() => void completeReflection()}
              disabled={busy || !helpfulness}
            />
            {!helpfulness && (
              <Text style={s.small}>
                Choose how helpful your plan felt to continue.
              </Text>
            )}
          </>
        )}
        {step === "complete" && event && (
          <>
            <LeafCharacter size={140} />
            <Text style={s.title}>Your C-Day is complete.</Text>
            <Text style={s.body}>Your plan and reflection are saved.</Text>
            <PlanRewards xp={cDayEarnedXP(actions)} />
            <Button label="View My C-Day" onPress={() => setStep("plan")} />
            <Button
              secondary
              label="Back to Plan My C-Day"
              onPress={() => setStep("home")}
            />
          </>
        )}
        {step === "types" && (
          <>
            <Text style={s.title}>Choose a C-Day</Text>
            {eventTypes.map(([key, label]) => (
              <Button
                key={key}
                label={
                  key === "dinner_with_friends"
                    ? label
                    : `${label} · Coming soon`
                }
                disabled={key !== "dinner_with_friends"}
                onPress={() => setStep("details")}
              />
            ))}
          </>
        )}
        {step === "details" && (
          <>
            <Text style={s.title}>Dinner With Friends</Text>
            <Field
              label="C-Day name"
              value={title}
              onChange={setTitle}
              editable={!busy}
            />
            <PlanDateField
              label="Date"
              value={date}
              onChange={setDate}
              editable={!busy}
            />
            <PlanTimeField
              label="Time"
              value={time}
              onChange={setTime}
              editable={!busy}
            />
            <Field
              label="Place or restaurant (optional)"
              value={venue}
              onChange={setVenue}
              editable={!busy}
            />
            <Text style={s.small}>
              Time zone: {zone}. Your draft saves when the name, date and time
              are valid.
            </Text>
            <Button
              label={busy ? "Saving…" : "Choose my actions"}
              onPress={() => void continueDetails()}
              disabled={busy}
            />
          </>
        )}
        {step === "categories" && (
          <>
            <Text style={s.title}>What could help you get ready?</Text>
            <Text style={s.body}>Choose up to 6 actions for your draft.</Text>
            <Text accessibilityLiveRegion="polite" style={s.selectionCount}>
              {activeActions.length} of 6 selected
            </Text>
            <View style={s.categoryGrid}>
              {categories.map((c) => {
                const count = activeActions.filter(action => actionCategory(action.action_library_id) === c).length;
                return <Pressable key={c} accessibilityRole="button"
                  accessibilityLabel={`${c}, ${count} selected actions`}
                  accessibilityState={{ disabled: busy }} disabled={busy}
                  style={({ pressed }) => [s.categoryTile, count > 0 && s.categoryHasSelection, pressed && s.dim]}
                  onPress={() => { setCategory(c); setStep("call"); setNotice(""); }}>
                  <Text style={s.categoryLabel}>{c}</Text>
                  <View style={s.categoryFooter}>
                    <Text style={s.small}>{count ? `${count} selected` : "View actions"}</Text>
                    <Text style={s.categoryArrow}>›</Text>
                  </View>
                </Pressable>;
              })}
            </View>
            <Button polished
              label="View draft plan"
              disabled={busy}
              onPress={() => setStep("plan")}
            />
          </>
        )}
        {step === "call" && (
          <>
            <Text style={s.title}>{category}</Text>
            <CDayActionSelector
              category={category}
              items={items}
              selected={activeActions}
              busy={busy}
              onAdd={(item) => void addSelection(item)}
              onRemove={(a) => void removeSelection(a)}
              onConfigure={chooseAction}
            />
            <Button polished
              secondary
              label="Back to categories"
              disabled={busy}
              onPress={() => setStep("categories")}
            />
            <Button polished
              label="View draft plan"
              disabled={busy}
              onPress={() => setStep("plan")}
            />
          </>
        )}
        {step === "schedule" && event && (
          <>
            <Text style={s.title}>When would you like to do this?</Text>
            <Text style={s.body}>{configuredAction?.action_text_snapshot}</Text>
            <Text style={s.small}>
              C-Day:{" "}
              {formatEventMoment(event.event_start_at, event.event_timezone)}
            </Text>
            <Button
              label="Today · in about 15 minutes"
              disabled={busy}
              onPress={() => pickSchedule(null)}
            />
            {[1, 2, 3, 7].map((d) => (
              <Button
                key={d}
                label={
                  d === 7
                    ? "1 week before"
                    : `${d} ${d === 1 ? "day" : "days"} before`
                }
                disabled={busy}
                onPress={() => pickSchedule(d)}
              />
            ))}
            {!!presetError && <Text accessibilityLiveRegion="polite" style={s.errorBox}>{presetError}</Text>}
            <View key={`schedule-fields-${presetVisit}`} style={s.gap} onLayout={e => {
              if (presetScrollPending.current) {
                presetScrollPending.current = false;
                scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 16), animated: false });
              }
            }}>
            {!!presetMessage && <Text accessibilityLiveRegion="polite" style={s.statusBox}>{presetMessage}</Text>}
            <Text style={s.heading}>Choose date & time</Text>
            <PlanDateField
              label="Action date"
              editable={!busy}
              value={actionDate}
              onChange={(v) => {
                setPresetMessage(""); setPresetError("");
                setActionDate(v);
                setRelative({ value: null, unit: "custom" });
              }}
            />
            <PlanTimeField
              label="Action time"
              editable={!busy}
              value={actionTime}
              onChange={(v) => {
                setPresetMessage(""); setPresetError("");
                setActionTime(v);
                setRelative({ value: null, unit: "custom" });
              }}
            />
            {resolved && (
              <View style={s.card}>
                <Text style={s.body}>
                  {formatMoment(resolved, event.event_timezone)}
                </Text>
              </View>
            )}
            <Button polished
              label={
                busy
                  ? "Saving…"
                  : event.status === "planned"
                    ? "Save new time"
                    : "Continue"
              }
              disabled={busy}
              onPress={continueSchedule}
            />
            </View>
          </>
        )}
        {step === "difficulty" && (
          <>
            <Text style={s.title}>
              For this C-Day, how does this task feel?
            </Text>
            <Text style={s.body}>{configuredAction?.action_text_snapshot}</Text>
            {(
              [
                ["easy", "Easy", "I feel pretty comfortable doing this."],
                ["moderate", "Moderate", "It takes some effort or confidence."],
                ["hard", "Hard", "This feels challenging for me right now."],
              ] as const
            ).map(([value, label, copy]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: difficulty === value }}
                onPress={() => setDifficulty(value)}
                style={[s.choiceCard, difficulty === value && s.selected]}
              >
                <Text style={s.heading}>
                  {difficulty === value ? "✓ " : ""}
                  {label}
                </Text>
                <Text style={s.body}>{copy}</Text>
              </Pressable>
            ))}
            <Text style={s.small}>
              There isn’t a right answer. The same task can feel different in
              different situations.
            </Text>
            <Button
              label="Continue"
              onPress={() => setStep("calendar")}
              disabled={!difficulty}
            />
          </>
        )}
        {step === "calendar" && (
          <>
            <Text style={s.title}>Keep your plan handy</Text>
            <View style={s.card}>
              <Text style={s.heading}>Add to my phone calendar</Text>
              <Switch
                accessibilityLabel="Add to my phone calendar"
                value={sync}
                onValueChange={setSync}
                disabled={busy}
                trackColor={{ true: "#769E62", false: "#D9D1DF" }}
              />
              <Text style={s.body}>
                {cDayCalendar.available
                  ? "Calendar sync is optional."
                  : "Phone calendar sync is not available in Expo Go. You can save your preference now; this will not create a phone event."}
              </Text>
            </View>
            {sync && (
              <Text style={s.small}>
                Your request will stay pending. My Plan works without calendar
                access.
              </Text>
            )}
            <Button
              label={busy ? "Saving…" : "Save to My Plan"}
              onPress={() => void saveAction()}
              disabled={busy}
            />
          </>
        )}
        {step === "plan" && event && (
          <>
            <Text style={s.title}>
              {event.status === "completed" ? "My C-Day" : "My Plan"}
            </Text>
            <View style={[s.card, s.eventSummary]}>
              <Text style={s.heading}>{event.title}</Text>
              <Text style={s.body}>
                {formatEventMoment(event.event_start_at, event.event_timezone)}
              </Text>
              <Text style={s.statusBadge}>
                {event.status === "completed"
                  ? "Completed"
                  : event.status === "planned"
                    ? "Planned"
                    : "Draft"}
              </Text>
              {!!event.venue_name && (
                <Text style={s.body}>{event.venue_name}</Text>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="View event time zone"
                onPress={() => Alert.alert("Event time zone", `${event.event_timezone.replace(/_/g, " ")}\nAll dates and action times in this plan use this saved time zone.`)}
                style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                <Text style={s.small}>Time zone ⓘ</Text>
              </Pressable>
            </View>
            {event.status !== "draft" && (
              <PlanRewards
                rating={event.plan_rating}
                xp={cDayEarnedXP(actions)}
              />
            )}
            <Text style={s.body}>
              {event.status !== "draft"
                ? `${actions.filter((a) => a.completion_status === "planned").length} planned · ${actions.filter((a) => a.completion_status === "done").length} done · ${actions.filter((a) => a.completion_status === "not_needed").length} not needed`
                : `${activeActions.length} of 6 actions selected`}
            </Text>
            {event.status === "planned" && (
              <View style={s.card}>
                {Date.parse(event.event_start_at) <= now ? (
                  <Button polished
                    label="Reflect on this C-Day"
                    onPress={beginReflection}
                    disabled={busy}
                  />
                ) : (
                  <Text style={s.small}>
                    Reflection will be available after your C-Day event time.
                  </Text>
                )}
              </View>
            )}
            {event.status === "draft" && activeActions.length === 0 && (
              <Text style={s.body}>
                Your draft is saved. Choose an action when you’re ready.
              </Text>
            )}
            {displayedActions.map((a) => (
              <View
                key={a.id}
                onLayout={(layout) => {
                  if (a.id === focusedAction && focusPending.current) {
                    focusY.current = layout.nativeEvent.layout.y;
                    focusEntryAction();
                  }
                }}
                style={[
                  s.card,
                  s.timelineCard,
                  a.id === focusedAction && {
                    borderColor: "#9472AD",
                    borderWidth: 2,
                  },
                  event.status !== "draft" &&
                    a.completion_status === "done" &&
                    s.doneCard,
                  event.status !== "draft" &&
                    a.completion_status === "not_needed" &&
                    s.notNeededCard,
                ]}
              >
                <View style={s.timelineHeader}>
                  <View style={[s.timelineDot, a.completion_status === "done" && s.timelineDotDone]} />
                  <Text style={s.scheduleLabel}>
                    {a.scheduled_at ? formatMoment(a.scheduled_at, event.event_timezone) : "Schedule not set"}
                  </Text>
                </View>
                {a.id === focusedAction && (
                  <Text style={s.small}>Selected from Home</Text>
                )}
                {event.status !== "draft" && (
                  <Text style={s.statusBadge}>
                    {a.completion_status === "done"
                      ? "✓ Done"
                      : a.completion_status === "not_needed"
                        ? "Not needed"
                        : event.status === "completed"
                          ? "Planned · no outcome recorded"
                          : a.scheduled_at &&
                              Date.parse(a.scheduled_at) > Date.now()
                            ? "Upcoming · Planned"
                            : "Planned"}
                  </Text>
                )}
                {a.completion_status === "done" && (a.xp_awarded ?? 0) > 0 && (
                  <Text style={s.small}>{a.xp_awarded} XP earned</Text>
                )}
                {a.completion_status === "done" && a.completed_at && (
                  <Text style={s.small}>
                    Completed{" "}
                    {formatMoment(a.completed_at, event.event_timezone)}
                  </Text>
                )}
                <Text style={s.small}>
                  {actionCategory(a.action_library_id)}
                </Text>
                <Text style={s.heading}>{a.action_text_snapshot}</Text>
                <Text style={s.difficultyBadge}>
                  Difficulty:{" "}
                  {a.difficulty
                    ? a.difficulty[0].toUpperCase() + a.difficulty.slice(1)
                    : "Not set"}
                </Text>
                <Text style={s.small}>
                  Calendar:{" "}
                  {a.calendar_sync_status === "not_requested"
                    ? "Not requested"
                    : a.calendar_sync_status === "pending"
                      ? "Deferred · saved in My Plan only"
                      : a.calendar_sync_status}
                </Text>
                <CDayExploreSupport
                  action={a}
                  eventType={event.event_type}
                  eventStatus={event.status}
                  origin="plan"
                  disabled={busy}
                />
                {!!a.calendar_sync_message && (
                  <Text style={s.small}>{a.calendar_sync_message}</Text>
                )}
                {event.status === "planned" &&
                  a.completion_status === "planned" &&
                  a.scheduled_at && (
                    <>
                      <Button polished
                        label="Done"
                        disabled={busy}
                        onPress={() => void followThrough(a, "done")}
                      />
                      <Button polished
                        secondary
                        label="Reschedule"
                        disabled={busy}
                        onPress={() => chooseAction(a)}
                      />
                      <Button polished
                        secondary
                        label="I don’t need this anymore"
                        disabled={busy}
                        onPress={() => void followThrough(a, "not_needed")}
                      />
                    </>
                  )}
                {event.status === "draft" && (
                  <>
                    <Button polished
                      secondary
                      label={
                        a.scheduled_at
                          ? "Edit schedule or difficulty"
                          : "Schedule this action"
                      }
                      onPress={() => chooseAction(a)}
                      disabled={busy}
                    />
                    <Button polished
                      secondary
                      label="Remove from draft"
                      disabled={busy}
                      onPress={() => void removeSelection(a)}
                    />
                  </>
                )}
              </View>
            ))}
            {event.status === "draft" && (
              <>
                <Button polished
                  label={
                    activeActions.length >= 6
                      ? "Review action categories"
                      : "Add another action"
                  }
                  onPress={() => setStep("categories")}
                  disabled={busy}
                />
                <View style={s.card}>
                  <Text style={s.heading}>
                    How do you feel about your plan?
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 4,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={`${value} ${value === 1 ? "star" : "stars"} for my plan`}
                        accessibilityState={{
                          checked: event.plan_rating === value,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() => void ratePlan(value)}
                        style={{
                          minHeight: 48,
                          minWidth: 44,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 12,
                          backgroundColor:
                            event.plan_rating === value
                              ? "#C5DDB5"
                              : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 28, color: "#496B36" }}>
                          {value <= (event.plan_rating ?? 0) ? "★" : "☆"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={s.small}>
                    1 = I need to rethink my plan{"\n"}3 = My plan feels okay
                    {"\n"}5 = I feel good about my plan
                  </Text>
                  {!!event.plan_rating && (
                    <Text accessibilityLiveRegion="polite" style={s.small}>
                      Your plan rating: {event.plan_rating} of 5
                    </Text>
                  )}
                </View>
                <View style={s.finalizeBox}>
                  <Button polished
                    label={busy ? "Saving…" : "Finalize plan"}
                    disabled={
                      busy || !!finalizationIssue(actions) || !event.plan_rating
                    }
                    onPress={() => void finalizePlan()}
                  />
                  {(finalizationIssue(actions) || !event.plan_rating) && (
                    <Text style={s.small}>
                      {finalizationIssue(actions) ??
                        "Choose a star rating for your plan before finalizing."}
                    </Text>
                  )}
                </View>
              </>
            )}

            {event.status === "completed" && (
              <View style={s.card}>
                <Text style={s.heading}>Your reflection</Text>
                <Text style={s.body}>
                  How helpful your plan felt:{" "}
                  {event.reflection_helpfulness ?? "Not recorded"}
                </Text>
                <Text style={s.body}>
                  What worked:{" "}
                  {event.reflection_tags?.length
                    ? event.reflection_tags.map((t) => t.tag).join(" · ")
                    : "No tags selected"}
                </Text>
                <Text style={s.heading}>
                  Anything you’d do differently next time?
                </Text>
                <Text style={s.body}>
                  {event.reflection_notes ?? "No note added"}
                </Text>
                <Text style={s.small}>Saved history · read only</Text>
              </View>
            )}
            <Button polished
              secondary
              label="Back to Plan My C-Day"
              onPress={() => setStep("home")}
              disabled={busy}
            />
          </>
        )}
        {step === "confirmed" && event && (
          <>
            <LeafCharacter size={140} />
            <Text style={s.title}>Your C-Day is planned.</Text>
            <Text style={s.heading}>{event.title}</Text>
            <Text style={s.body}>{activeActions.length} actions planned</Text>
            {(() => {
              const next = activeActions
                .filter((a) => a.completion_status === "planned")
                .find(
                  (a) =>
                    a.scheduled_at && Date.parse(a.scheduled_at) > Date.now(),
                );
              return next ? (
                <View style={s.card}>
                  <Text style={s.small}>Next scheduled action</Text>
                  <Text style={s.heading}>{next.action_text_snapshot}</Text>
                  <Text style={s.body}>
                    {formatMoment(next.scheduled_at!, event.event_timezone)}
                  </Text>
                  </View>
              ) : (
                <Text style={s.body}>No upcoming scheduled actions.</Text>
              );
            })()}
            <Button label="View My Plan" onPress={() => setStep("plan")} />
            <Button
              secondary
              label="Back to Plan My C-Day"
              onPress={() => setStep("home")}
            />
          </>
        )}
        {!!notice && (
          <Text accessibilityLiveRegion="polite" style={s.statusBox}>
            {notice}
          </Text>
        )}
        {!!error && (
          <Text
            onLayout={() => scroll.current?.scrollToEnd({ animated: false })}
            accessibilityRole="alert"
            style={s.errorBox}
          >
            {error}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  selectionCount: { alignSelf: "flex-start", backgroundColor: "#E9EFDF", color: "#405D35", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryTile: { flexGrow: 1, flexBasis: "46%", minWidth: 140, minHeight: 90, backgroundColor: "#FFFFFF", borderColor: "#DFE4D7", borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  categoryHasSelection: { backgroundColor: "#F3EDF7", borderColor: "#B9A5C8" },
  categoryLabel: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: "#432B58" },
  categoryFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  categoryArrow: { fontSize: 24, color: "#705384" },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  welcomeText: { flex: 1, minWidth: 0, gap: 8 },
  eventSummary: { backgroundColor: "#F4F7EE", borderColor: "#DDE5D4", padding: 18, gap: 10 },
  statusBadge: { alignSelf: "flex-start", backgroundColor: "#E6EEDA", color: "#405D35", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  timelineCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E5DA", borderLeftWidth: 3, borderLeftColor: "#B4CCA2", padding: 16, gap: 10 },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF", borderColor: "#789666", borderWidth: 2 },
  timelineDotDone: { backgroundColor: "#426B43" },
  scheduleLabel: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: "700", color: "#405D35" },
  difficultyBadge: { alignSelf: "flex-start", backgroundColor: "#F0E9F5", color: "#59426C", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, fontSize: 14, lineHeight: 21 },
  polishedPrimary: { backgroundColor: "#426B43" },
  polishedPrimaryText: { color: "#FFFFFF" },
  polishedSecondary: { backgroundColor: "#EAF0F7", borderColor: "#D1DDEA" },
  polishedSecondaryText: { color: "#354F70" },

  screen: { flex: 1, backgroundColor: "#FFFCF7" },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  gap: { gap: 8 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    color: "#62556E",
    fontWeight: "700",
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    lineHeight: 38,
    color: "#241638",
    fontWeight: "600",
  },
  heading: {
    fontFamily: Fonts.rounded,
    fontSize: 19,
    lineHeight: 27,
    color: "#302040",
    fontWeight: "600",
  },
  body: { fontSize: 16, lineHeight: 25, color: "#62556E" },
  small: { fontSize: 14, lineHeight: 22, color: "#62556E" },
  doneCard: { backgroundColor: "#E1EED7", borderColor: "#86A573" },
  notNeededCard: { backgroundColor: "#F3F0E9", borderColor: "#D5CEC2" },
  card: {
    backgroundColor: "#EDF5E7",
    borderColor: "#C5DDB5",
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  selected: {
    borderColor: "#557A40",
    borderWidth: 2,
    backgroundColor: "#EDF5E7",
  },
  choiceCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D5DDCF",
    borderWidth: 2,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#C5DDB5",
  },
  disabledButton: {
    backgroundColor: "#EEEFEA",
    borderWidth: 1,
    borderColor: "#DADDD3",
  },
  disabledText: { color: "#676B61" },
  statusBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EDF5E7",
    color: "#354C29",
    fontSize: 14,
    lineHeight: 22,
  },
  errorBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFF1E5",
    borderWidth: 1,
    borderColor: "#DABAA0",
    color: "#653F2B",
    fontSize: 16,
    lineHeight: 24,
  },
  rewardsCard: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  rewardTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 132,
    padding: 12,
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#B8CEA5",
    justifyContent: "center",
    alignItems: "center",
  },
  ratingSummary: { backgroundColor: "#FFF9EB" },
  soloReward: { flex: 0, width: 160 },
  rewardLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: "700",
    color: "#354C29",
    textAlign: "center",
  },
  rewardRow: { alignItems: "center", gap: 3 },
  ratingStars: { fontSize: 21, color: "#946B15" },
  emptyStars: { color: "#8C8068" },
  ratingValue: { fontSize: 18, fontWeight: "700", color: "#51452C" },
  rewardCaption: {
    fontSize: 12,
    lineHeight: 17,
    color: "#526347",
    textAlign: "center",
  },
  xpSummary: { backgroundColor: "#E1EED7" },
  xpValue: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: "800",
    color: "#354C29",
  },
  xpUnit: { fontSize: 18, fontWeight: "600" },
  finalizeBox: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F3F3ED",
    gap: 12,
  },
  button: {
    minHeight: 50,
    backgroundColor: "#E1EED7",
    borderRadius: 16,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 23,
    color: "#354C29",
    fontWeight: "600",
    textAlign: "center",
  },
  dim: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: "#C5DDB5",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#302040",
    backgroundColor: "#FFFFFF",
    minHeight: 50,
  },
});
