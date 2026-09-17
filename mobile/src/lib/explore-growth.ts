import {readAccountProgress} from './explore-account-progress';
import type { ExploreSummary } from './explore-content';
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
  const done = new Set((await readAccountProgress()).filter(p=>p.status==='completed').map(p=>p.content_id));
  const completed = items.map(item=>done.has(item.content_id));
  return growthDomains.map(domain => items.reduce((bar, item, i) => {
    if ((item.growth_domains ?? contentGrowthDomains(item)).includes(domain)) {
      bar.available += 1; if (completed[i]) bar.completed += 1;
    }
    return bar;
  }, { domain, available: 0, completed: 0 }));
}