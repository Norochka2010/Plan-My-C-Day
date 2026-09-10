import type { ExploreSummary } from './explore-content';
import { readQuickLearnProgress } from './quick-learn-progress';
import { readMythProgress } from './myth-progress';
import { readPracticeProgress } from './practice-progress';
import { readChallengeProgress } from './real-life-challenge-progress';
export const growthDomains = ['KNOW', 'MANAGE', 'SPEAK', 'TRUST', 'LIVE', 'LEAD'] as const;
export type GrowthDomain = typeof growthDomains[number];
export type GrowthBar = { domain: GrowthDomain; completed: number; available: number };
export function contentGrowthDomains(row: { domain: unknown; content_body?: unknown }): GrowthDomain[] {
  const body = row.content_body as { domains?: unknown; domain?: unknown; original_metadata?: { domain?: unknown } } | null;
  const value = body?.original_metadata?.domain ?? body?.domains ?? body?.domain ?? row.domain;
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter((v): v is GrowthDomain => (growthDomains as readonly string[]).includes(v)))];
}
const tracked = new Set(['QUICK_LEARN', 'MYTH_OR_FACT', 'PRACTICE_A_SKILL', 'REAL_LIFE_CHALLENGE']);
/** Read the existing ledgers only. No XP writes, new awards, or mastery scoring. */
export async function readExploreGrowth(catalog: ExploreSummary[]): Promise<GrowthBar[]> {
  const items = [...new Map(catalog.filter(item => tracked.has(item.content_type)).map(item => [item.content_id, item])).values()];
  const [myths, practices] = await Promise.all([readMythProgress(), readPracticeProgress()]);
  const completed = await Promise.all(items.map(async item => {
    switch (item.content_type) {
      case 'QUICK_LEARN': return (await readQuickLearnProgress(item.content_id)).complete;
      case 'MYTH_OR_FACT': return Object.hasOwn(myths, item.content_id);
      case 'PRACTICE_A_SKILL': return Object.hasOwn(practices, item.content_id);
      case 'REAL_LIFE_CHALLENGE': return (await readChallengeProgress(item.content_id))?.status === 'completed';
      default: return false;
    }
  }));
  return growthDomains.map(domain => items.reduce((bar, item, i) => {
    if ((item.growth_domains ?? contentGrowthDomains(item)).includes(domain)) {
      bar.available += 1; if (completed[i]) bar.completed += 1;
    }
    return bar;
  }, { domain, available: 0, completed: 0 }));
}
