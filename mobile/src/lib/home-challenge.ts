import { developmentChallengePreviews } from './explore-content';
import { supabase } from './supabase';
import { publishedSupport } from './c-day-explore-support';
import { upcomingCDays, type UpcomingCDay } from './c-day-upcoming';
import { actionCategory } from './c-day-model';
import { parseRealLifeChallenge, type RealLifeChallenge } from './real-life-challenge-model';
import { readChallengeProgress, type ChallengeProgress } from './real-life-challenge-progress';
export type ChallengeCandidate = { developmentPreview?: boolean; card: RealLifeChallenge; progress: ChallengeProgress | null };
export type LibraryLink = { id: string; category: string; related_explore_content_ids: string[] };
export type ChallengeSuggestion = ChallengeCandidate & { eventTitle: string | null; match: 'linked' | 'theme' | 'general' };
const categoryDomains: Record<string, string[]> = {
  ASK: ['SPEAK'], PREPARE: ['MANAGE'], CHECK: ['KNOW', 'MANAGE'], AVOID: ['KNOW', 'MANAGE'],
  TAKE: ['MANAGE'], COLLABORATE: ['SPEAK', 'LIVE', 'LEAD'], CALL: ['SPEAK'], SAY: ['SPEAK'],
};
/** Inspectable relevance only. Never assess health, success, or skill from a difficulty rating. */
export function chooseHomeChallenge(candidates: ChallengeCandidate[], events: UpcomingCDay[], library: LibraryLink[], now: number): ChallengeSuggestion | null {
  const plans = upcomingCDays(events, now).slice(0, 3);
  const links = new Map(library.map(row => [row.id, row]));
  const ranked = candidates.filter(c => c.progress?.status !== 'completed').map(candidate => {
    let score = 0, best = 0, eventTitle: string | null = null, match: ChallengeSuggestion['match'] = 'general';
    const domains = candidate.card.domain.split(',').map(d => d.trim());
    for (let index = 0; index < plans.length; index++) {
      const event = plans[index]; let strength = 0, linked = false;
      for (const action of event.actions.filter(a => a.completion_status === 'planned')) {
        const row = links.get(action.action_library_id);
        if (!row || row.category !== actionCategory(action.action_library_id)) continue;
        if (candidate.card.related.some(relation => row.related_explore_content_ids?.includes(relation.uuid))) { strength = 100; linked = true; }
        else if (!linked && categoryDomains[row.category]?.some(d => domains.includes(d))) strength = Math.max(strength, 10);
      }
      // Only Dinner With Friends has a defined theme in this prototype.
      if (!strength && event.event_type === 'dinner_with_friends' && domains.some(d => ['MANAGE', 'SPEAK', 'LIVE'].includes(d))) strength = 1;
      const weighted = strength * (3 - index); score += weighted;
      if (weighted > best) { best = weighted; eventTitle = event.title; match = linked ? 'linked' : 'theme'; }
    }
    return { ...candidate, eventTitle, match, score };
  });
  ranked.sort((a, b) => b.score - a.score || Number(!!b.progress) - Number(!!a.progress) || a.card.challenge_id.localeCompare(b.card.challenge_id));
  return ranked[0] ?? null;
}
export async function getHomeChallenge(userId: string | null, now = Date.now()): Promise<ChallengeSuggestion | null> {
  const candidates: ChallengeCandidate[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('explore_content').select('*')
      .eq('content_type', 'REAL_LIFE_CHALLENGE').eq('active', true).eq('review_status', 'APPROVED')
      .neq('source_type', 'COMMUNITY').order('content_id').range(offset, offset + 99);
    if (error) throw error;
    if (!data) throw Error('Challenge collection unavailable');
    for (const row of data) {
      if (!publishedSupport(row)) continue;
      const card = parseRealLifeChallenge(row);
      if (card) candidates.push({ card, progress: await readChallengeProgress(card.content_id) });
    }
    if (data.length < 100) break;
  }
  // Reuse the existing development-only source snapshots. Never change publication flags or RLS.
  const idsSeen = new Set(candidates.map(candidate => candidate.card.content_id));
  for (const row of developmentChallengePreviews()) {
    if (idsSeen.has(row.content_id)) continue;
    const card = parseRealLifeChallenge(row);
    if (card) { candidates.push({ card, developmentPreview: true, progress: await readChallengeProgress(card.content_id) }); idsSeen.add(card.content_id); }
  }
  let events: UpcomingCDay[] = [];
  if (userId) {
    const { data, error } = await supabase.from('c_day_events')
      .select('id,user_id,event_type,title,venue_name,event_start_at,event_timezone,status,actions:c_day_actions(id,action_text_snapshot,scheduled_at,completion_status,action_library_id,difficulty)')
      .eq('user_id', userId).in('status', ['draft', 'planned']).gt('event_start_at', new Date(now).toISOString())
      .order('event_start_at').order('id').limit(3);
    if (error) throw error;
    if (!data) throw Error('Plans unavailable');
    events = data as UpcomingCDay[];
  }
  const ids = [...new Set(events.flatMap(e => e.actions.filter(a => a.completion_status === 'planned').map(a => a.action_library_id)))];
  let library: LibraryLink[] = [];
  if (ids.length) {
    const { data, error } = await supabase.from('action_library').select('id,category,related_explore_content_ids')
      .in('id', ids).eq('source', 'Meyer_2021').eq('active', true).eq('review_status', 'approved');
    if (error) throw error;
    library = (data ?? []) as LibraryLink[];
  }
  return chooseHomeChallenge(candidates, events, library, now);
}
