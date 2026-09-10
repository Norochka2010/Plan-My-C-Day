export const expertCategories = [
  'Nutrition & Eating Well', 'School & 504 Plans', 'Eating & Food Safety', 'Newly Diagnosed',
  'Travel & Independence', 'Social & Emotional Well-Being', 'Research & Treatment', 'Advocacy & Getting Involved',
] as const;
export type ExpertCategory = typeof expertCategories[number];
export type ExpertResource = {
  contentId: string; resourceId: string; title: string; organization: string; category: ExpertCategory;
  description: string; tags: string[]; url: string; domains: string[] | null; reviewedDate: string;
};
export const expertMiniHubs: readonly ExpertCategory[] = ['Nutrition & Eating Well'];
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function validExpertUrl(value: unknown): value is string {
  if (!text(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
/** Type, publication and provenance must all match before the trusted label is rendered. */
export function parseExpertResource(value: unknown): ExpertResource | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>, b = r.content_body as Record<string, unknown> | null;
  if (r.content_type !== 'EXPERT_RESOURCE' || r.source_type !== 'EXPERT' || r.review_status !== 'APPROVED' || r.active !== true || !b ||
    b.format !== 'expert_resource_v1' || b.content_type !== 'EXPERT_RESOURCE' || b.source_type !== 'AUTHORITATIVE_EXTERNAL_RESOURCE' || b.active !== true ||
    !text(r.content_id) || !text(b.resource_id) || !/^EXP_\d{3}$/.test(b.resource_id) || !text(b.title) || b.title !== r.title ||
    !text(b.organization) || b.organization !== r.source_organization || !text(b.description) || !validExpertUrl(b.url) || b.url !== r.source_url ||
    !expertCategories.includes(b.category as ExpertCategory) || !Array.isArray(b.good_for_tags) || !b.good_for_tags.every(text) ||
    !(b.domain === null || (Array.isArray(b.domain) && b.domain.every(text))) || !text(b.reviewed_date)) return null;
  return { contentId: r.content_id, resourceId: b.resource_id, title: b.title, organization: b.organization,
    category: b.category as ExpertCategory, description: b.description, tags: b.good_for_tags,
    url: b.url, domains: b.domain as string[] | null, reviewedDate: b.reviewed_date };
}
export function filterExpertResources(resources: ExpertResource[], category: ExpertCategory | null): ExpertResource[] {
  return category ? resources.filter(r => r.category === category) : resources;
}
