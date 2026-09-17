import { ExploreActionButton as Action } from '@/components/explore-action-button';
import { useEffect, useRef, useState } from "react";
import {
  parseQuickLearn,
  isRelatedPractice,
  type QuickLearnLesson,
} from "@/lib/quick-learn-model";
import {
  emptyQuickLearnProgress,
  readQuickLearnProgress,
  updateQuickLearnProgress,
} from "@/lib/quick-learn-progress";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import {
  getExploreContent,
  type ExploreContent,
  type ExploreSummary,
} from "@/lib/explore-content";


/** One template for every Quick Learn record. Lesson copy lives in Supabase. */
export function QuickLearn({
  contentId,
  catalog,
  onClose,
  onNext,
  onPractice,
  publishedOnly = false,
}: {
  publishedOnly?: boolean;
  contentId: string;
  catalog: ExploreSummary[];
  onClose: () => void;
  onNext: (id: string) => void;
  onPractice: (item?: ExploreSummary) => void;
}) {
  const [lesson, setLesson] = useState<QuickLearnLesson | null>(null);
  const [related, setRelated] = useState<ExploreContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState(emptyQuickLearnProgress);
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedFailed, setRelatedFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setLesson(null);
    setRelated([]);
    setRelatedLoading(false);
    setRelatedFailed(false);
    setProgress(emptyQuickLearnProgress());
    setStorageReady(false);
    setMessage("");
    getExploreContent(contentId, { publishedOnly })
      .then(async (item) => {
        if (!active) return;
        const parsed = parseQuickLearn(item);
        if (!parsed || !item) {
          setLoading(false);
          return;
        }
        setLesson(parsed);
        setLoading(false);
        setRelatedLoading(true);
        const results = await Promise.allSettled(
          (item.related_content_ids ?? []).map((id) =>
            getExploreContent(id, { publishedOnly }),
          ),
        );
        if (active) {
          setRelated(
            results.flatMap((result) =>
              result.status === "fulfilled" &&
              isRelatedPractice(result.value, parsed.relatedPracticeCode)
                ? [result.value]
                : [],
            ),
          );
          setRelatedFailed(
            results.some((result) => result.status === "rejected"),
          );
          setRelatedLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });
    readQuickLearnProgress(contentId)
      .then((stored) => {
        if (active) {
          setProgress(stored);
          setStorageReady(true);
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Device storage is unavailable. Tap Retry progress before completing.",
          );
      });
    return () => {
      active = false;
    };
  }, [contentId, retry, publishedOnly]);
  async function update(kind: "saved" | "complete") {
    if (
      lock.current ||
      !storageReady ||
      !lesson ||
      (kind === "complete" && progress.complete)
    )
      return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const next = await updateQuickLearnProgress(
        contentId,
        kind,
        lesson.record.xp_value,
      );
      setProgress(next);
      setMessage(
        kind === "complete"
          ? `Lesson completed. ${next.xp} XP for learning.`
          : next.saved
            ? "Saved to your account."
            : "Removed from saved lessons.",
      );
    } catch {
      setMessage("That did not save. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const lessons = catalog.filter((item) => item.content_type === "QUICK_LEARN");
  const index = lessons.findIndex((item) => item.content_id === contentId);
  const next = index >= 0 ? lessons[index + 1] : undefined;
  const row = lesson?.record;
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Action variant="navigation" label="‹ Back to Explore" onPress={onClose} disabled={busy} />
        <Text style={s.eyebrow}>QUICK LEARN</Text>
        {loading ? (
          <Text style={s.body}>Loading your lesson…</Text>
        ) : failed ? (
          <>
            <Text style={s.body}>We couldn’t load this lesson.</Text>
            <Action label="Try again" onPress={() => setRetry((v) => v + 1)} />
          </>
        ) : !lesson || !row ? (
          <Text style={s.body}>This lesson isn’t available right now.</Text>
        ) : (
          <>
            <Text accessibilityRole="header" style={s.title}>
              {row.title}
            </Text>
            {!!row.subtitle && <Text style={s.subtitle}>{row.subtitle}</Text>}
            <View style={s.meta}>
              <View style={s.chip}>
                <Text style={s.small}>{row.domain}</Text>
              </View>
              {!!lesson.estimatedTime && (
                <Text style={s.body}>{lesson.estimatedTime}</Text>
              )}
            </View>
            {!!row.intro && <Text style={s.body}>{row.intro}</Text>}
            {lesson.cards.map((card, i) => (
              <View key={i} style={s.card}>
                {!!card.title && (
                  <Text accessibilityRole="header" style={s.heading}>
                    {card.title}
                  </Text>
                )}
                {card.paragraphs.map((paragraph, j) => (
                  <Text key={j} style={s.body}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
            {!!row.teaching_point && (
              <View style={[s.card, s.green]}>
                <Text accessibilityRole="header" style={s.heading}>
                  Key Takeaway
                </Text>
                <Text style={s.body}>{row.teaching_point}</Text>
              </View>
            )}
            {!!row.next_step && (
              <View style={s.card}>
                <Text accessibilityRole="header" style={s.heading}>
                  Try This
                </Text>
                <Text style={s.body}>{row.next_step}</Text>
              </View>
            )}
            <View style={s.card}>
              <Text accessibilityRole="header" style={s.heading}>
                Related Practice
              </Text>
              {relatedLoading ? (
                <Text style={s.body}>Loading related Practice…</Text>
              ) : related.length ? (
                related.map((item) => (
                  <View key={item.content_id}>
                    <Text style={s.heading}>{item.title}</Text>
                    {!!item.subtitle && (
                      <Text style={s.body}>{item.subtitle}</Text>
                    )}
                    <Action variant="navigation"
                      label={`Open Practice: ${item.title}`}
                      onPress={() => onPractice(item)}
                      disabled={busy}
                    />
                  </View>
                ))
              ) : (
                <>
                  <Text style={s.body}>
                    {relatedFailed
                      ? "Related Practice could not load. You can still complete this lesson."
                      : "The related Practice activity isn’t available right now. You can still complete this lesson."}
                  </Text>
                  <Action variant="navigation"
                    label="Explore Practice a Skill"
                    onPress={() => onPractice()}
                    disabled={busy}
                  />
                </>
              )}
            </View>
            <View style={s.card}>
              <Text accessibilityRole="header" style={s.heading}>
                Source / Evidence Basis
              </Text>
              {lesson.sourceEvidence ? (
                <Text style={s.body}>{lesson.sourceEvidence}</Text>
              ) : (
                <>
                  <Text style={s.body}>
                    {row.source_organization || "Source not provided"}
                  </Text>
                  {!!row.source_title && (
                    <Text style={s.body}>{row.source_title}</Text>
                  )}
                </>
              )}
              {!!row.source_url && /^https?:\/\//i.test(row.source_url) && (
                <Action variant="navigation"
                  label="Read the source ↗"
                  onPress={() => {
                    Linking.openURL(row.source_url!).catch(() =>
                      setMessage(
                        "The source link could not open. Please try again.",
                      ),
                    );
                  }}
                />
              )}
              <Text style={s.small}>
                Source-informed learning content
                {row.expert_reviewer
                  ? ` · Reviewed by ${row.expert_reviewer}`
                  : " · No expert review recorded"}
                .
              </Text>
            </View>
            <Text style={s.small}>
              Saved lessons, completion and Quick Learn XP are saved to your account.
              XP rewards learning. Each lesson earns XP once.
            </Text>
            {!storageReady && (
              <Action
                label="Retry progress"
                onPress={() => setRetry((v) => v + 1)}
                disabled={busy}
              />
            )}
            {!!message && (
              <Text accessibilityLiveRegion="polite" style={s.body}>
                {message}
              </Text>
            )}
            <View style={s.actions}>
              <Action
                label={
                  progress.complete
                    ? `Completed ✓ · ${progress.xp} XP`
                    : busy
                      ? "Saving…"
                      : `Mark Complete · ${row.xp_value} XP`
                }
                onPress={() => update("complete")}
                disabled={busy || !storageReady || progress.complete}
              />
              <Action variant="navigation"
                label={progress.saved ? "Saved ✓ — Unsave" : "Save"}
                onPress={() => update("saved")}
                disabled={busy || !storageReady}
              />
              <Action variant="navigation"
                label="Next"
                onPress={() => (next ? onNext(next.content_id) : onClose())}
                disabled={busy}
              />
            </View>
            {!next && (
              <Text style={s.small}>
                You’ve reached the last available lesson. Next returns to
                Explore.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFCF7" },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 24,
    gap: 18,
    paddingBottom: 40,
  },
  eyebrow: {
    color: "#594366",
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "700",
  },
  title: {
    color: "#241638",
    fontSize: 32,
    lineHeight: 40,
    fontFamily: Fonts.rounded,
    fontWeight: "600",
  },
  subtitle: { color: "#62556E", fontSize: 18, lineHeight: 27 },
  heading: {
    color: "#302040",
    fontSize: 19,
    lineHeight: 27,
    fontFamily: Fonts.rounded,
    fontWeight: "600",
  },
  body: { color: "#62556E", fontSize: 16, lineHeight: 26 },
  small: { color: "#716579", fontSize: 14, lineHeight: 21 },
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#D9C4E5",
    backgroundColor: "#F4EBF7",
  },
  green: { backgroundColor: "#EDF5E7", borderColor: "#C5DDB5" },
  button: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EEE4F4",
  },
  buttonText: { color: "#432B58", fontSize: 16, fontWeight: "600" },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#EDF5E7",
  },
  actions: { gap: 10 },
});
