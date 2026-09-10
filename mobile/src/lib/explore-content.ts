import { contentGrowthDomains, type GrowthDomain } from './explore-growth';
import { publishedSupport } from './c-day-explore-support';
import { supabase } from './supabase';

export type ContentType = 'QUICK_LEARN' | 'MYTH_OR_FACT' | 'PRACTICE_A_SKILL' | 'REAL_LIFE_CHALLENGE' | 'EXPERT_RESOURCE';
export type Domain = 'KNOW' | 'MANAGE' | 'SPEAK' | 'TRUST' | 'LIVE' | 'LEAD';
export interface ExploreContent {
  development_preview?: boolean;
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
export type ExploreSummary = Pick<ExploreContent, 'content_id' | 'content_type' | 'title' | 'subtitle' | 'domain' | 'estimated_minutes' | 'source_type' | 'development_preview'> & { growth_domains?: GrowthDomain[] };

/** Metro excludes this guarded local snapshot from release builds. Never bypass RLS. */
function developmentPracticePreviews(): ExploreContent[] {
  if (__DEV__) {
    const records = require('../dev/practice-review-preview.json') as ExploreContent[];
    return records.filter(row => row.content_type === 'PRACTICE_A_SKILL' && row.review_status === 'IN_REVIEW')
      .map(row => ({ ...row, development_preview: true }));
  }
  return [];
}

/** Review-required Quick Learn source is available only in development, never through RLS bypass. */
function developmentQuickLearnPreviews(): ExploreContent[] {
  if (__DEV__) {
    const records = require('../dev/quick-learn-review-preview.json') as unknown as ExploreContent[];
    return records.filter(row => row.content_type === 'QUICK_LEARN' && row.active && row.review_status === 'IN_REVIEW')
      .map(row => ({ ...row, development_preview: true }));
  }
  return [];
}

/** Source-faithful Myth or Fact review cards are bundled only for development. */
function developmentMythPreviews(): ExploreContent[] {
  if (__DEV__) {
    const records = require('../dev/myth-review-preview.json') as unknown as ExploreContent[];
    return records.filter(row => row.content_type === 'MYTH_OR_FACT' && row.active && row.review_status === 'IN_REVIEW')
      .map(row => ({ ...row, development_preview: true }));
  }
  return [];
}

/** Review-required Real-Life Challenges are source snapshots for development only. */
export function developmentChallengePreviews(): ExploreContent[] {
  if (__DEV__) {
    const records = require('../dev/real-life-challenge-review-preview.json') as unknown as ExploreContent[];
    return records.filter(row => row.content_type === 'REAL_LIFE_CHALLENGE' && row.active && row.review_status === 'IN_REVIEW')
      .map(row => ({ ...row, development_preview: true }));
  }
  return [];
}

/** Paginate so the catalog does not silently stop at Supabase's row limit. */
export async function getExploreCatalog({ publishedOnly = false }: { publishedOnly?: boolean } = {}): Promise<ExploreSummary[]> {
  const result: ExploreSummary[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('explore_content')
      .select('content_id,content_type,title,subtitle,domain,estimated_minutes,source_type,content_body,active,review_status,medical_review_required,expert_reviewer')
      .eq('active', true).eq('review_status', 'APPROVED').neq('source_type', 'COMMUNITY')
      .order('title').order('content_id').range(offset, offset + 99);
    if (error) throw error;
    result.push(...(publishedOnly ? (data as ExploreContent[]).filter(publishedSupport) : data as ExploreSummary[]));
    if (data.length < 100) {
      const ids = new Set(result.map(row => row.content_id));
      if (publishedOnly) return result.map(row => ({ ...row, growth_domains: contentGrowthDomains(row) }));
      return [...result, ...[...developmentPracticePreviews(), ...developmentQuickLearnPreviews(), ...developmentMythPreviews(), ...developmentChallengePreviews()].filter(row => !ids.has(row.content_id))].map(row => ({ ...row, growth_domains: contentGrowthDomains(row) }));
    }
  }
}

/** Shared retrieval for future activity screens; RLS also protects direct requests. */
export async function getExploreContent(contentId: string, { publishedOnly = false }: { publishedOnly?: boolean } = {}): Promise<ExploreContent | null> {
  const { data, error } = await supabase.from('explore_content').select('*')
    .eq('content_id', contentId).eq('active', true).eq('review_status', 'APPROVED')
    .neq('source_type', 'COMMUNITY').maybeSingle();
  if (error) throw error;
  if (publishedOnly) return data && publishedSupport(data as ExploreContent) ? data as ExploreContent : null;
  return data as ExploreContent | null ?? [...developmentPracticePreviews(), ...developmentQuickLearnPreviews(), ...developmentMythPreviews(), ...developmentChallengePreviews()].find(row => row.content_id === contentId) ?? null;
}
