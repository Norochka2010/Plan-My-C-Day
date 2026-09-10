export const ANSWER_TYPES = ['FACT', 'MYTH', 'IT_DEPENDS', 'LETS_RETHINK_IT'] as const;
export type AnswerType = typeof ANSWER_TYPES[number];
export type MythCard = {
  content_id: string; statement: string; answer_type: AnswerType; explanation: string;
  takeaway: string | null; topic: string | null; development_preview: boolean; domain: string | null; source: string | null; source_url: string | null;
  related_content_id: string | null; xp_value: number;
};
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : null;
/** Maps the existing Explore fields; no new table or schema is needed. */
export function parseMythCard(value: unknown): MythCard | null {
  const row = object(value), feedback = object(row.feedback), metadata = object(object(row.content_body).original_metadata);
  if (row.content_type !== 'MYTH_OR_FACT' || !text(row.content_id) || !text(row.title) ||
    !ANSWER_TYPES.includes(feedback.answer_type as AnswerType) || !text(feedback.summary)) return null;
  const ids = Array.isArray(row.related_content_ids) ? row.related_content_ids : [];
  return {
    content_id: row.content_id as string, statement: row.title as string,
    answer_type: feedback.answer_type as AnswerType, explanation: feedback.summary as string,
    takeaway: text(row.teaching_point), topic: text(row.topic), development_preview: row.development_preview === true,
    domain: text(metadata.domain) ?? text(row.domain), source: text(row.source_organization), source_url: text(row.source_url),
    related_content_id: text(ids[0]), xp_value: typeof row.xp_value === 'number' && Number.isSafeInteger(row.xp_value) && row.xp_value >= 0 ? row.xp_value : 0,
  };
}
export function responseHeading(answer: AnswerType, guess: 'FACT' | 'MYTH' | null): string {
  if (answer === 'IT_DEPENDS') return 'It depends — context matters.';
  if (answer === 'LETS_RETHINK_IT') return 'Let’s rethink it — there’s another way to look at this.';
  return guess === answer ? `You’ve got it — ${answer === 'FACT' ? 'fact' : 'myth'}.` : `This one is ${answer === 'FACT' ? 'a fact' : 'a myth'}. Let’s explore why.`;
}
