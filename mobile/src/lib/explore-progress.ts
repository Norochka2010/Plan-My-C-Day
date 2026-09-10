import { readChallengeTotals } from './real-life-challenge-progress';
import { readQuickLearnTotals } from './quick-learn-progress';
import { readMythProgress } from './myth-progress';
import { readPracticeProgress } from './practice-progress';

export type ExploreProgressSummary = {
  xp: number;
  categories: { title: string; xp: number | null; completed: number | null }[];
};
/** Read the original completion ledgers; never copy or re-award XP. */
export async function readExploreProgress(): Promise<ExploreProgressSummary> {
  const [quick, myth, practice, challenges] = await Promise.all([
    readQuickLearnTotals(), readMythProgress(), readPracticeProgress(), readChallengeTotals(),
  ]);
  const summarize = (title: string, entries: Record<string, { xp: number }>) => ({
    title, xp: Object.values(entries).reduce((total, entry) => total + entry.xp, 0),
    completed: Object.keys(entries).length,
  });
  const categories = [
    { title: 'Quick Learn', xp: quick.xp, completed: quick.completedLessons },
    summarize('Myth or Fact?', myth),
    summarize('Practice a Skill', practice),
    { title: 'Real-Life Challenges', xp: challenges.xp, completed: challenges.completedChallenges },
    { title: 'From the Experts', xp: null, completed: null },
  ];
  return { xp: categories.reduce((total, category) => total + (category.xp ?? 0), 0), categories };
}
