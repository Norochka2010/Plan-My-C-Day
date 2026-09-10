export type Interaction = 'KNOWLEDGE' | 'CHOICE' | 'REFLECTION';
export type Scenario = {
  scenario_id: string; title: string; category: string | null; domain: string | null;
  skill: string | null; difficulty: string | null; interaction_type: Interaction;
  setting: string | null; setup: string; prompt: string;
  choices: { id: string; label: string }[];
  feedback: { by_choice_id: Record<string, string>; safety_issues: Record<string, string> };
  preferred_choice: string | null; teaching_point: string | null;
  source_name: string | null; source_url: string | null; xp: number;
  related_content: string[]; expert_reviewed: boolean; medical_review_required: boolean;
};
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v : null;
export function parseScenario(value: unknown): Scenario | null {
  const r = obj(value), body = obj(r.content_body), feedback = obj(r.feedback);
  const type = r.interaction_type as Interaction;
  if (r.content_type !== 'PRACTICE_A_SKILL' || !['KNOWLEDGE','CHOICE','REFLECTION'].includes(type) || !str(r.content_id) || !str(r.title) || !str(r.intro) || !str(body.prompt)) return null;
  if (!Array.isArray(r.choices) || r.choices.length < 2) return null;
  const choices: Scenario['choices'] = [];
  for (const v of r.choices) { const c = obj(v); if (!str(c.id) || !str(c.label)) return null; choices.push({id: c.id as string, label: c.label as string}); }
  if (new Set(choices.map(c => c.id)).size !== choices.length) return null;
  const byChoice = obj(feedback.by_choice_id), safety = obj(feedback.safety_issues);
  if (choices.some(c => !str(byChoice[c.id]))) return null;
  if (Object.entries(safety).some(([id, reason]) => !choices.some(c => c.id === id) || !str(reason))) return null;
  const preferred = str(feedback.preferred_choice);
  if (type === 'KNOWLEDGE' && (!choices.some(c => c.id === preferred) || !str(r.source_organization) || !/^https?:\/\//i.test(str(r.source_url) ?? ''))) return null;
  if (type !== 'KNOWLEDGE' && preferred) return null;
  if (type === 'REFLECTION' && Object.keys(safety).length) return null;
  if (preferred && safety[preferred]) return null;
  return {
    scenario_id: r.content_id as string, title: r.title as string, category: str(body.category), domain: str(r.domain), skill: str(r.topic), difficulty: str(r.difficulty), interaction_type: type,
    setting: str(body.setting), setup: r.intro as string, prompt: body.prompt as string, choices,
    feedback: {by_choice_id: byChoice as Record<string,string>, safety_issues: safety as Record<string,string>}, preferred_choice: preferred,
    teaching_point: str(r.teaching_point), source_name: str(r.source_organization), source_url: str(r.source_url),
    xp: typeof r.xp_value === 'number' && Number.isSafeInteger(r.xp_value) && r.xp_value >= 0 ? r.xp_value : 0,
    related_content: Array.isArray(r.related_content_ids) ? r.related_content_ids.filter((id): id is string => !!str(id)) : [],
    expert_reviewed: body.expert_reviewed === true && !!str(r.expert_reviewer), medical_review_required: r.medical_review_required === true,
  };
}
export function scenarioResponse(s: Scenario, choiceId: string) {
  const choice = s.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error('Choose an available response');
  const safety = s.interaction_type !== 'REFLECTION' ? s.feedback.safety_issues[choiceId] : null;
  const heading = safety ? 'A safety concern to consider' : s.interaction_type === 'REFLECTION' ? 'Thank you for checking in with yourself' : s.interaction_type === 'CHOICE' ? 'A reasonable option' : choiceId === s.preferred_choice ? 'The evidence-supported choice' : 'Let’s look at the evidence';
  return {heading, text: s.feedback.by_choice_id[choiceId], safety, preferred: s.interaction_type === 'KNOWLEDGE' ? s.choices.find(c => c.id === s.preferred_choice)?.label : null};
}
