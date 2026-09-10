export type RealLifeChallenge = {
  content_id: string; challenge_id: string; title: string; domain: string;
  skill: string; difficulty: string; instruction: string; steps: string[];
  safety_note: string; reflection_options: string[]; completion_message: string;
  source_basis: string; source_url: string | null; xp: number;
  related: { type: 'QUICK_LEARN' | 'PRACTICE_A_SKILL'; code: string; uuid: string }[];
};
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
export function parseRealLifeChallenge(value: unknown): RealLifeChallenge | null {
  const r = object(value), b = object(r.content_body);
  if (r.content_type !== 'REAL_LIFE_CHALLENGE' || b.format !== 'real_life_challenge_v1' || !text(r.content_id) || !text(r.title)) return null;
  if (!['challenge_id','domain','skill','difficulty','instruction','safety_note','completion_message','source_basis'].every(k => text(b[k]))) return null;
  if (!Array.isArray(b.steps) || !b.steps.length || !b.steps.every(text) || !Array.isArray(b.reflection_options) || b.reflection_options.length !== 5 || !b.reflection_options.every(text) || new Set(b.reflection_options).size !== 5) return null;
  if (!Number.isSafeInteger(r.xp_value) || r.xp_value < 0) return null;
  const related: RealLifeChallenge['related'] = [];
  for (const [type, code, uuid] of [['QUICK_LEARN',b.related_quick_learn_id,b.related_quick_learn_uuid],['PRACTICE_A_SKILL',b.related_practice_id,b.related_practice_uuid]] as const) {
    if (text(code) && text(uuid)) related.push({ type, code, uuid });
  }
  return { content_id:r.content_id, challenge_id:b.challenge_id, title:r.title, domain:b.domain, skill:b.skill, difficulty:b.difficulty, instruction:b.instruction, steps:b.steps, safety_note:b.safety_note, reflection_options:b.reflection_options, completion_message:b.completion_message, source_basis:b.source_basis, source_url:text(r.source_url)?r.source_url:null, xp:r.xp_value, related };
}
export function matchesChallengeRelation(value: unknown, link: RealLifeChallenge['related'][number]): boolean {
  const r=object(value),b=object(r.content_body);
  return r.content_id===link.uuid && r.content_type===link.type && (link.type==='QUICK_LEARN'?b.content_id:b.scenario_id)===link.code;
}
