import type { ExploreContent } from "./explore-content";
export type LessonCard = { title: string | null; paragraphs: string[] };
export type QuickLearnLesson = {
  record: ExploreContent;
  code: string | null;
  cards: LessonCard[];
  estimatedTime: string | null;
  sourceEvidence: string | null;
  relatedPracticeCode: string | null;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
/** Normalize current cards and legacy heading/paragraph blocks without changing their copy. */
export function parseQuickLearn(value: unknown): QuickLearnLesson | null {
  const r = obj(value),
    body = obj(r.content_body),
    metadata = obj(body.original_metadata);
  if (r.content_type !== "QUICK_LEARN" || !text(r.content_id) || !text(r.title))
    return null;
  const cards: LessonCard[] = [];
  if (body.format === "quick_learn_v1" && Array.isArray(body.cards)) {
    for (const value of body.cards) {
      const card = obj(value);
      if (!text(card.title) || !text(card.body)) return null;
      cards.push({
        title: card.title as string,
        paragraphs: [card.body as string],
      });
    }
  } else if (Array.isArray(r.content_body)) {
    for (const value of r.content_body) {
      const block = obj(value);
      if (
        !text(block.text) ||
        !["heading", "paragraph"].includes(block.type as string)
      )
        return null;
      if (block.type === "heading")
        cards.push({ title: block.text as string, paragraphs: [] });
      else {
        if (!cards.length) cards.push({ title: null, paragraphs: [] });
        cards[cards.length - 1].paragraphs.push(block.text as string);
      }
    }
  } else return null;
  if (!cards.length || cards.some((c) => !c.paragraphs.length)) return null;
  if (!Number.isSafeInteger(r.xp_value) || (r.xp_value as number) < 0)
    return null;
  return {
    record: value as ExploreContent,
    cards,
    code: text(body.content_id),
    estimatedTime:
      text(metadata.estimated_minutes) ??
      (typeof r.estimated_minutes === "number"
        ? `${r.estimated_minutes} min`
        : null),
    sourceEvidence: text(body.source_evidence),
    relatedPracticeCode: text(body.related_practice_id),
  };
}
export function isRelatedPractice(
  value: unknown,
  code: string | null,
): value is ExploreContent {
  const row = obj(value);
  return (
    row.content_type === "PRACTICE_A_SKILL" &&
    !!text(row.content_id) &&
    (!code || obj(row.content_body).scenario_id === code)
  );
}
