-- QL_001 only. Reuses its existing UUID and existing Explore columns; no schema changes.
-- Original document ID/review strings/time/XP/version are preserved in content_body.original_metadata.
-- Technical mappings follow the existing Practice import convention:
-- approved_for_build -> APPROVED; +5 -> 5; 2 min -> 2; 1.0 -> 1.
-- EDITORIAL and KNOWLEDGE are existing engine classifications, not claims of expert review.
-- Unspecified optional values are NULL; choices/feedback remain empty engine containers.
-- Only the untouched QL_001 placeholder can be replaced. Exact reruns are no-ops.
-- Any conflicting edits or duplicate logical IDs abort without changing records.
begin;
-- Serialize this import so concurrent reruns cannot create a duplicate logical record.
lock table public.explore_content in share row exclusive mode;
do $import$
declare
 wanted jsonb := $record${"content_id": "7052ee99-98ef-558b-ac3e-23a25f328e5b", "content_type": "QUICK_LEARN", "title": "Cross-Contact: What Actually Happens?", "subtitle": "Gluten-free food can pick up gluten along the way.", "domain": "KNOW", "topic": null, "interaction_type": "KNOWLEDGE", "difficulty": null, "estimated_minutes": 2, "intro": null, "content_body": {"format": "quick_learn_v1", "content_id": "QL_001", "cards": [{"title": "1 | The basic idea", "body": "Cross-contact happens when a food that is gluten-free comes into contact with gluten. It can happen during growing, processing, storage, preparation, or serving."}, {"title": "2 | Think beyond ingredients", "body": "A food can start with gluten-free ingredients and still be affected by how it is handled. Shared utensils, preparation surfaces, serving areas, or other food-contact situations can matter."}, {"title": "3 | Your job isn't to panic", "body": "Your job is to gather the information that matters for the situation. Ask what the food contains and how it was prepared or served. If you still don't have enough information, you can choose another option."}], "related_practice_id": "PRACTICE_005", "source_evidence": "NIDDK — Eating, Diet, & Nutrition for Celiac Disease", "expert_reviewed": false, "original_metadata": {"content_id": "QL_001", "content_type": "QUICK_LEARN", "domain": "KNOW", "subtitle": "Gluten-free food can pick up gluten along the way.", "estimated_minutes": "2 min", "xp_value": "+5", "related_practice_id": "PRACTICE_005", "review_status": "approved_for_build", "expert_reviewed": "not required for coding", "medical_review_required": "false", "content_version": "1.0", "active": "true", "title": "Cross-Contact: What Actually Happens?", "source_type": null, "key_takeaway": "Ingredients matter. Preparation and handling matter too.", "try_this": "Next time you see “GF,” ask yourself: Do I know both what is in it and how it was prepared?", "source_evidence": "NIDDK — Eating, Diet, & Nutrition for Celiac Disease", "source_url": "https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/eating-diet-nutrition", "related_practice": "PRACTICE_005 — The Shared Snack Bowl"}}, "choices": [], "feedback": {}, "teaching_point": "Ingredients matter. Preparation and handling matter too.", "next_step": "Next time you see “GF,” ask yourself: Do I know both what is in it and how it was prepared?", "related_content_ids": ["75eac941-7d8a-560a-898f-60925ac5f815"], "xp_value": 5, "source_type": "EDITORIAL", "source_organization": "NIDDK", "source_title": "Eating, Diet, & Nutrition for Celiac Disease", "source_url": "https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/eating-diet-nutrition", "author": null, "review_status": "APPROVED", "expert_reviewer": null, "medical_review_required": false, "content_version": 1, "last_reviewed": null, "active": true}$record$::jsonb;
 placeholder jsonb := $placeholder${"content_id": "7052ee99-98ef-558b-ac3e-23a25f328e5b", "content_type": "QUICK_LEARN", "title": "QL_001 Cross-Contact: What Actually Happens?", "subtitle": null, "domain": null, "topic": null, "interaction_type": "KNOWLEDGE", "difficulty": null, "estimated_minutes": null, "intro": null, "content_body": [], "choices": [], "feedback": {}, "teaching_point": null, "next_step": null, "related_content_ids": [], "xp_value": 0, "source_type": "EDITORIAL", "source_organization": null, "source_title": null, "source_url": null, "author": null, "review_status": "DRAFT", "expert_reviewer": null, "medical_review_required": true, "content_version": 1, "last_reviewed": null, "active": false}$placeholder$::jsonb;
 incoming public.explore_content%rowtype;
 current_row public.explore_content%rowtype;
 row_exists boolean;
begin
 select * into incoming from jsonb_populate_record(null::public.explore_content, wanted);
 if exists(select 1 from public.explore_content where content_body->>'content_id'='QL_001' and content_id<>incoming.content_id) then
  raise exception 'QL_001 already uses a different UUID. No changes made.';
 end if;
 if not exists(select 1 from public.explore_content where content_id='75eac941-7d8a-560a-898f-60925ac5f815'::uuid and content_type='PRACTICE_A_SKILL' and content_body->>'scenario_id'='PRACTICE_005' and title='The Shared Snack Bowl') then
  raise exception 'Expected PRACTICE_005 mapping is missing or changed. No changes made.';
 end if;
 select * into current_row from public.explore_content where content_id=incoming.content_id for update;
 row_exists := found;
 if row_exists and not exists(select 1 from jsonb_each(wanted) f where to_jsonb(current_row)->f.key is distinct from f.value) then
  return;
 end if;
 if row_exists and exists(select 1 from jsonb_each(placeholder) f where to_jsonb(current_row)->f.key is distinct from f.value) then
  raise exception 'QL_001 differs from the original empty placeholder. Review it before replacing content. No changes made.';
 end if;
 if row_exists then
  update public.explore_content set
   content_type=incoming.content_type, title=incoming.title, subtitle=incoming.subtitle, domain=incoming.domain, topic=incoming.topic, interaction_type=incoming.interaction_type, difficulty=incoming.difficulty, estimated_minutes=incoming.estimated_minutes, intro=incoming.intro, content_body=incoming.content_body, choices=incoming.choices, feedback=incoming.feedback, teaching_point=incoming.teaching_point, next_step=incoming.next_step, related_content_ids=incoming.related_content_ids, xp_value=incoming.xp_value, source_type=incoming.source_type, source_organization=incoming.source_organization, source_title=incoming.source_title, source_url=incoming.source_url, author=incoming.author, review_status=incoming.review_status, expert_reviewer=incoming.expert_reviewer, medical_review_required=incoming.medical_review_required, content_version=incoming.content_version, last_reviewed=incoming.last_reviewed, active=incoming.active
  where content_id=incoming.content_id;
 else
  insert into public.explore_content (content_id, content_type, title, subtitle, domain, topic, interaction_type, difficulty, estimated_minutes, intro, content_body, choices, feedback, teaching_point, next_step, related_content_ids, xp_value, source_type, source_organization, source_title, source_url, author, review_status, expert_reviewer, medical_review_required, content_version, last_reviewed, active) values (incoming.content_id, incoming.content_type, incoming.title, incoming.subtitle, incoming.domain, incoming.topic, incoming.interaction_type, incoming.difficulty, incoming.estimated_minutes, incoming.intro, incoming.content_body, incoming.choices, incoming.feedback, incoming.teaching_point, incoming.next_step, incoming.related_content_ids, incoming.xp_value, incoming.source_type, incoming.source_organization, incoming.source_title, incoming.source_url, incoming.author, incoming.review_status, incoming.expert_reviewer, incoming.medical_review_required, incoming.content_version, incoming.last_reviewed, incoming.active);
 end if;
end $import$;
commit;
select content_body->>'content_id' as lesson_id,content_id,title,domain,estimated_minutes,xp_value,
 jsonb_array_length(content_body->'cards') as card_count,
 content_body->>'related_practice_id' as related_practice_id,related_content_ids,
 content_body->'original_metadata'->>'review_status' as original_review_status,
 content_body->'original_metadata'->>'expert_reviewed' as original_expert_reviewed,
 review_status,medical_review_required,content_version,active
from public.explore_content where content_id='7052ee99-98ef-558b-ac3e-23a25f328e5b'::uuid;
