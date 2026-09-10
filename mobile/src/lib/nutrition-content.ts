import { supabase } from './supabase';
export type NutritionState = 'NATURALLY_GF' | 'CHECK_DETAILS' | 'CONTAINS_GLUTEN';
export type NutritionSection = {
  layout: 'list' | 'grid' | 'numbered'; itemLabel: string | null; itemNote: string | null;
  id: string; title: string; order: number; state: NutritionState | null;
  intro: string | null; items: string[]; safetyNote: string | null;
  qualifier: string | null; uncertaintyLabel: string | null; visualAssetId: string | null;
};
export type NutritionHub = { title: string; subtitle: string; sections: NutritionSection[] };
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const optionalText = (x: unknown) => x === null || text(x);
const states: NutritionState[] = ['NATURALLY_GF', 'CHECK_DETAILS', 'CONTAINS_GLUTEN'];
/** Validate the educational state without turning it into a food-safety verdict. */
export function parseNutritionHub(rows: unknown[]): NutritionHub | null {
  const records = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .filter(r => r.active === true && r.review_status === 'APPROVED');
  const home = records.find(r => r.content_id === 'NUT_HOME' && r.kind === 'HUB');
  const body = home?.body as Record<string, unknown> | undefined;
  if (!home || !text(home.title) || !body || !text(body.subtitle)) return null;
  const sections: NutritionSection[] = [];
  const seen = new Set<string>();
  for (const row of records.filter(r => r.kind === 'SECTION' && r.parent_id === 'NUT_HOME')) {
    const b = row.body as Record<string, unknown> | undefined;
    if (!b || !text(row.content_id) || seen.has(row.content_id) || !text(row.title) || !Number.isSafeInteger(row.sort_order) || Number(row.sort_order) < 0 ||
      !(row.educational_state === null || states.includes(row.educational_state as NutritionState)) ||
      !optionalText(b.intro) || !Array.isArray(b.items) || (!b.items.length && !text(b.intro)) || !b.items.every(text) || !optionalText(b.safety_note) ||
      !optionalText(b.qualifier) || !optionalText(b.uncertainty_label) || !optionalText(b.visual_asset_id)) throw Error('Nutrition section could not be read');
    if (row.educational_state === 'NATURALLY_GF' && (!text(b.intro) || !text(b.safety_note))) throw Error('Nutrition context is missing');
    if (row.educational_state === 'CHECK_DETAILS' && (!text(b.intro) || b.uncertainty_label !== 'Needs More Information')) throw Error('Nutrition context is missing');
    if (row.educational_state === 'CONTAINS_GLUTEN' && !text(b.qualifier)) throw Error('Nutrition context is missing');
    if (b.layout !== undefined && !['list', 'grid', 'numbered'].includes(String(b.layout))) throw Error('Nutrition layout could not be read');
    if (b.layout === 'grid' && (!text(b.item_label) || !text(b.item_note))) throw Error('Nutrition grid context is missing');
    seen.add(row.content_id);
    sections.push({ layout: (b.layout ?? 'list') as NutritionSection['layout'], itemLabel: text(b.item_label) ? b.item_label : null, itemNote: text(b.item_note) ? b.item_note : null, id: row.content_id, title: row.title, order: Number(row.sort_order), state: row.educational_state as NutritionState | null,
      intro: b.intro as string | null, items: b.items as string[], safetyNote: b.safety_note as string | null,
      qualifier: b.qualifier as string | null, uncertaintyLabel: b.uncertainty_label as string | null, visualAssetId: b.visual_asset_id as string | null });
  }
  return { title: home.title, subtitle: body.subtitle, sections: sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)) };
}
export async function getNutritionHub(): Promise<NutritionHub | null> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('explore_nutrition_content').select('*')
      .eq('active', true).eq('review_status', 'APPROVED').order('sort_order').order('content_id').range(offset, offset + 99);
    if (error) throw error;
    if (!data) throw Error('Nutrition content could not load');
    rows.push(...data);
    if (data.length < 100) return parseNutritionHub(rows);
  }
}
