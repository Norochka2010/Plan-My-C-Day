import AsyncStorage from "@react-native-async-storage/async-storage";
export type QuickLearnProgress = {
  saved: boolean;
  complete: boolean;
  xp: number;
  completedAt: string | null;
};
export const emptyQuickLearnProgress = (): QuickLearnProgress => ({
  saved: false,
  complete: false,
  xp: 0,
  completedAt: null,
});
const key = (id: string) => `quick-learn:v1:${id}`;
export async function readQuickLearnProgress(
  id: string,
): Promise<QuickLearnProgress> {
  const raw = await AsyncStorage.getItem(key(id));
  if (!raw) return emptyQuickLearnProgress();
  const p = JSON.parse(raw);
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    typeof p.saved !== "boolean" ||
    typeof p.complete !== "boolean" ||
    (p.xp !== undefined && (!Number.isSafeInteger(p.xp) || p.xp < 0)) ||
    (p.completedAt != null && typeof p.completedAt !== "string")
  )
    throw Error("Invalid Quick Learn progress");
  // Existing completed lessons retain their completion; no retroactive XP award.
  return {
    saved: p.saved,
    complete: p.complete,
    xp: p.complete ? (p.xp ?? 0) : 0,
    completedAt: p.completedAt ?? null,
  };
}
// As in Practice, serialize device writes and re-read stored completion before awarding.
let queue: Promise<unknown> = Promise.resolve();
export function updateQuickLearnProgress(
  id: string,
  kind: "saved" | "complete",
  xp: number,
): Promise<QuickLearnProgress> {
  const operation = queue.then(async () => {
    if (!Number.isSafeInteger(xp) || xp < 0) throw Error("Invalid XP");
    const p = await readQuickLearnProgress(id);
    if (kind === "complete") {
      if (p.complete) return p;
      p.complete = true;
      p.xp = xp;
      p.completedAt = new Date().toISOString();
    } else p.saved = !p.saved;
    await AsyncStorage.setItem(key(id), JSON.stringify(p));
    return p;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

/** Derive ME totals from existing awards; never award again or maintain a second ledger. */
export async function readQuickLearnTotals(): Promise<{ completedLessons: number; xp: number }> {
  await queue;
  const prefix = 'quick-learn:v1:';
  const keys = [...new Set(await AsyncStorage.getAllKeys())].filter(k => k.startsWith(prefix) && k.length > prefix.length);
  const entries = await Promise.all(keys.map(k => readQuickLearnProgress(k.slice(prefix.length))));
  return entries.reduce((total, entry) => ({
    completedLessons: total.completedLessons + (entry.complete ? 1 : 0),
    xp: total.xp + (entry.complete ? entry.xp : 0),
  }), { completedLessons: 0, xp: 0 });
}
