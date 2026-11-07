import { expertReviewBeta } from './explore-review';
import { contentGrowthDomains, type GrowthDomain } from './explore-growth';
import { publishedSupport } from './c-day-explore-support';
import { supabase } from './supabase';

export type ContentType = 'QUICK_LEARN' | 'MYTH_OR_FACT' | 'PRACTICE_A_SKILL' | 'REAL_LIFE_CHALLENGE' | 'EXPERT_RESOURCE';
export type Domain = 'KNOW' | 'MANAGE' | 'SPEAK' | 'TRUST' | 'LIVE' | 'LEAD';
export interface ExploreContent {
  development_preview?: boolean;
  expert_review_required?: boolean;
  content_id: string; content_type: ContentType; title: string; subtitle: string | null;
  domain: Domain; topic: string | null; interaction_type: 'KNOWLEDGE' | 'CHOICE' | 'REFLECTION';
  difficulty: 'INTRODUCTORY' | 'BUILDING' | 'EXTENDING' | null; estimated_minutes: number | null;
  intro: string | null; content_body: { type: 'paragraph' | 'heading'; text: string }[];
  choices: { id: string; label: string }[];
  feedback: { summary?: string; by_choice_id?: Record<string, string>; correct_choice_ids?: string[] };
  teaching_point: string | null; next_step: string | null; related_content_ids: string[]; xp_value: number;
  source_type: 'EDITORIAL' | 'EXPERT' | 'COMMUNITY'; source_organization: string | null;
  source_title: string | null; source_url: string | null; author: string | null;
  review_status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED'; expert_reviewer: string | null;
  medical_review_required: boolean; content_version: number; last_reviewed: string | null; active: boolean;
}
export type ExploreSummary = Pick<ExploreContent, 'content_id' | 'content_type' | 'title' | 'subtitle' | 'domain' | 'estimated_minutes' | 'source_type' | 'source_url' | 'source_organization' | 'development_preview' | 'medical_review_required' | 'expert_reviewer' | 'expert_review_required'> & { growth_domains?: GrowthDomain[]; xp_value?: number };

const publicationApprovedContent = [
  ...require('../content/reviewed-challenges.json'),
  ...require('../content/published-quick-learn.json'),
  ...require('../content/published-practice.json'),
] as ExploreContent[];

/** Authored review material is deliberately included in the adult TestFlight beta. */
function reviewSnapshots(): ExploreContent[] {
  if (!expertReviewBeta && !__DEV__) return [];
  const records = [
    ...require('../dev/practice-review-preview.json'),
    ...require('../dev/quick-learn-review-preview.json'),
    ...require('../dev/myth-review-preview.json'),
    ...require('../dev/real-life-challenge-review-preview.json'),
  ] as ExploreContent[];
  return records.filter(row => row.active && row.review_status === 'IN_REVIEW')
    .map(row => ({ ...row, development_preview: true, expert_review_required: true }));
}
export function developmentChallengePreviews(): ExploreContent[] {
  return reviewSnapshots().filter(row => row.content_type === 'REAL_LIFE_CHALLENGE');
}
function betaCatalog(): ExploreContent[] {
  if (!expertReviewBeta && !__DEV__) return [];
  const approved = require('../content/beta-approved-explore.json') as ExploreContent[];
  const journeys = require('../dev/rlc-adventure-review-preview.json') as { content_id: string; review_status: string; expert_review_required: boolean; medical_review_required: boolean }[];
  const journeyIds = new Set(journeys.filter(row => row.review_status === 'needs_review' && (row.expert_review_required || row.medical_review_required)).map(row => row.content_id));
  const rows = new Map([...approved, ...reviewSnapshots(), ...publicationApprovedContent].map(row => [row.content_id, row]));
  return [...rows.values()].map(row => ({ ...row, expert_review_required: row.expert_review_required || journeyIds.has(row.content_id) }));
}
/** Beta content is pinned to this build, so reviewers see the same complete catalog offline. */
export async function getExploreCatalog({ publishedOnly = false }: { publishedOnly?: boolean } = {}): Promise<ExploreSummary[]> {
  if (expertReviewBeta || __DEV__) return betaCatalog().sort((a,b) => a.title.localeCompare(b.title))
    .map(row => ({ ...row, growth_domains: contentGrowthDomains(row) }));
  const result: ExploreContent[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('explore_content')
      .select('*').eq('active', true).eq('review_status', 'APPROVED').neq('source_type', 'COMMUNITY')
      .order('title').order('content_id').range(offset, offset + 99);
    if (error) throw error;
    result.push(...(publishedOnly ? (data as ExploreContent[]).filter(publishedSupport) : data as ExploreContent[]));
    if (data.length < 100) break;
  }
  const rows = new Map([...result, ...(!publishedOnly ? reviewSnapshots() : []), ...publicationApprovedContent].map(row => [row.content_id,row]));
  return [...rows.values()].map(row => ({ ...row, growth_domains: contentGrowthDomains(row) }));
}
export async function getExploreContent(contentId: string, { publishedOnly = false }: { publishedOnly?: boolean } = {}): Promise<ExploreContent | null> {
  if (expertReviewBeta || __DEV__) return betaCatalog().find(row => row.content_id === contentId) ?? null;
  const reviewed = publicationApprovedContent.find(row => row.content_id === contentId);
  if (reviewed) return reviewed;
  const { data, error } = await supabase.from('explore_content').select('*')
    .eq('content_id', contentId).eq('active', true).eq('review_status', 'APPROVED')
    .neq('source_type', 'COMMUNITY').maybeSingle();
  if (error) throw error;
  if (publishedOnly) return data && publishedSupport(data as ExploreContent) ? data as ExploreContent : null;
  return data as ExploreContent | null ?? reviewSnapshots().find(row => row.content_id === contentId) ?? null;
}
