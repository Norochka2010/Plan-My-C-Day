import AsyncStorage from '@react-native-async-storage/async-storage';
const key = 'practice:completion:v1';
type Entry = { xp: number; completedAt: string };
export type Progress = Record<string, Entry>;
export async function readPracticeProgress(): Promise<Progress> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.values(data).some((entry: any) => !entry || !Number.isSafeInteger(entry.xp) || entry.xp < 0 || typeof entry.completedAt !== 'string')) throw new Error('Invalid progress');
  return data;
}
// Serialize writes across mounted cards. Reopening an activity never awards XP twice.
let queue: Promise<unknown> = Promise.resolve();
export function completePractice(contentId: string, xp: number): Promise<Progress> {
  const operation = queue.then(async () => {
    const progress = await readPracticeProgress();
    if (!progress[contentId]) {
      progress[contentId] = { xp, completedAt: new Date().toISOString() };
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    }
    return progress;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
