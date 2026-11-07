import Constants from 'expo-constants';
/** Explicit beta setting: release builds must include the same review catalog as development. */
export const expertReviewBeta = Constants.expoConfig?.extra?.expertReviewBeta === true;
export const reviewCardStyle = { backgroundColor: '#FDE8E7', borderColor: '#BD3935', borderWidth: 2 };
export const reviewLabelStyle = { color: '#962A27', fontWeight: '700' as const, fontSize: 14, lineHeight: 21 };
/** Named references count even when the original author did not supply a URL. */
export function hasCitedSource(row: {source_url?: string | null; source_organization?: string | null}) {
  if (/^https?:\/\//i.test(row.source_url?.trim() ?? '')) return true;
  const references = (row.source_organization ?? '').split(/[;+]/).map(part => part.trim());
  return references.some(part => part.length > 0 && !/^(teen\b|expert[ /]|clinical review|no source|none$)/i.test(part));
}
export function needsExpertReview(row: { source_url?: string | null; source_organization?: string | null; content_id?: string; content_type?: string; development_preview?: boolean; medical_review_required?: boolean; expert_reviewer?: string | null; expert_review_required?: boolean }) {
  // Myth or Fact uses source attribution without a reader-facing review banner.
  // Keep underlying review metadata unchanged; this is a presentation decision.
  if (row.content_type === 'MYTH_OR_FACT') return false;
  if (row.content_type === 'REAL_LIFE_CHALLENGE') {
    const reviewed = require('../content/reviewed-challenges.json') as {content_id: string}[];
    if (reviewed.some(item => item.content_id === row.content_id)) return false;
    return !hasCitedSource(row);
  }
  // Practice publication restrictions were removed by the app owner.
  if (row.content_type === 'PRACTICE_A_SKILL') return false;
  // Quick Learn publication restrictions were removed by the app owner.
  if (row.content_type === 'QUICK_LEARN') return false;
  return row.expert_review_required === true || row.development_preview === true || (row.medical_review_required === true && !row.expert_reviewer?.trim());
}
