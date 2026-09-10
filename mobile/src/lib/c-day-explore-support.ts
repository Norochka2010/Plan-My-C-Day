import { supabase } from "./supabase";
import { actionCategory, type CDayAction } from "./c-day-model";
import type { ExploreSummary, ExploreContent } from "./explore-content";

export type SupportAction = Pick<
  CDayAction,
  "id" | "action_library_id" | "difficulty" | "completion_status"
>;
export type SupportContent = ExploreSummary &
  Pick<
    ExploreContent,
    "active" | "review_status" | "medical_review_required" | "expert_reviewer"
  >;
export const supportTypes = [
  "QUICK_LEARN",
  "MYTH_OR_FACT",
  "PRACTICE_A_SKILL",
] as const;
export function supportLimit(
  action: SupportAction,
  eventType: string,
  eventStatus: string,
) {
  if (
    eventType !== "dinner_with_friends" ||
    !["draft", "planned"].includes(eventStatus) ||
    action.completion_status !== "planned"
  )
    return 0;
  return action.difficulty === "hard"
    ? 2
    : action.difficulty === "moderate"
      ? 1
      : 0;
}
export function publishedSupport(
  row: Pick<
    ExploreContent,
    | "active"
    | "review_status"
    | "source_type"
    | "medical_review_required"
    | "expert_reviewer"
    | "development_preview"
  >,
) {
  return (
    row.active &&
    row.review_status === "APPROVED" &&
    row.source_type !== "COMMUNITY" &&
    !row.development_preview &&
    (!row.medical_review_required || !!row.expert_reviewer?.trim())
  );
}
export function orderedSupport(
  ids: string[],
  rows: SupportContent[],
  limit: number,
) {
  const available = new Map(
    rows
      .filter(
        (row) =>
          publishedSupport(row) &&
          (supportTypes as readonly string[]).includes(row.content_type),
      )
      .map((row) => [row.content_id, row]),
  );
  return [...new Set(ids)]
    .flatMap((id) => (available.has(id) ? [available.get(id)!] : []))
    .slice(0, limit);
}
export async function getActionExploreSupport(
  action: SupportAction,
  eventType: string,
  eventStatus: string,
): Promise<ExploreSummary[]> {
  const limit = supportLimit(action, eventType, eventStatus);
  if (!limit) return [];
  const { data: library, error } = await supabase
    .from("action_library")
    .select(
      "id,category,source,active,review_status,related_explore_content_ids",
    )
    .eq("id", action.action_library_id)
    .eq("source", "Meyer_2021")
    .eq("active", true)
    .eq("review_status", "approved")
    .maybeSingle();
  if (error) throw error;
  if (!library || library.category !== actionCategory(action.action_library_id))
    return [];
  const ids = library.related_explore_content_ids as string[];
  if (!ids?.length) return [];
  const { data, error: contentError } = await supabase
    .from("explore_content")
    .select(
      "content_id,content_type,title,subtitle,domain,estimated_minutes,source_type,active,review_status,medical_review_required,expert_reviewer",
    )
    .in("content_id", ids)
    .eq("active", true)
    .eq("review_status", "APPROVED")
    .neq("source_type", "COMMUNITY");
  if (contentError) throw contentError;
  return orderedSupport(ids, data as SupportContent[], limit);
}
