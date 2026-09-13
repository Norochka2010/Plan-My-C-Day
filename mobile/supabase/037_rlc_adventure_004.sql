-- RLC_004 proposed branching layer only. Run as Supabase database owner.
-- Does not update any original explore_content or progress/XP records.
begin;
create table if not exists public.rlc_adventures (
 content_id uuid primary key references public.explore_content(content_id),
 challenge_id text not null unique,
 adventure_version text not null,
 branching_enabled boolean not null default false,
 active boolean not null default true,
 review_status text not null default 'needs_review' check(review_status in ('approved','needs_review','hidden')),
 expert_review_required boolean not null default true,
 expert_reviewed boolean not null default false,
 medical_review_required boolean not null default false,
 medical_reviewed boolean not null default false,
 source_document text not null,
 content_origin text not null,
 original_review_metadata jsonb not null,
 graph jsonb not null check(jsonb_typeof(graph)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.rlc_adventures enable row level security;
revoke all on public.rlc_adventures from public,anon,authenticated;
grant select on public.rlc_adventures to authenticated;
drop policy if exists rlc_adventures_published on public.rlc_adventures;
create policy rlc_adventures_published on public.rlc_adventures for select to authenticated using (
 active and branching_enabled and review_status='approved'
 and (not expert_review_required or expert_reviewed)
 and (not medical_review_required or medical_reviewed)
 and exists (
  select 1 from public.explore_content e
  where e.content_id=rlc_adventures.content_id and e.content_type='REAL_LIFE_CHALLENGE'
  and e.content_body->>'challenge_id'=rlc_adventures.challenge_id
  and e.active and e.review_status='APPROVED' and e.source_type<>'COMMUNITY'
  and (not e.medical_review_required or nullif(btrim(e.expert_reviewer),'') is not null)
 )
);
do $migration$
declare item jsonb := $record${"content_id": "9cd832de-83ec-5b80-9da4-a03f989f8df1", "challenge_id": "RLC_004", "adventure_version": "2.0-prototype.1", "branching_enabled": true, "active": true, "review_status": "needs_review", "expert_review_required": true, "expert_reviewed": false, "medical_review_required": false, "medical_reviewed": false, "source_document": "Plan_My_C-Day_RLC_Branching_Adventure_Content_Architecture_v2.docx", "content_origin": "Proposed V2 branching extension", "original_review_metadata": {"challenge_id": "RLC_004", "content_type": "REAL_LIFE_CHALLENGE", "domain": "MANAGE", "skill": "Focused planning", "difficulty": "Medium", "xp_value": "+15", "related_quick_learn_id": "QL_007", "related_practice_id": "PRACTICE_014", "source_type": "behavioral_extension", "review_status": "expert_review", "expert_reviewed": "false", "medical_review_required": "false", "content_version": "1.0", "active": "true", "title": "Make a 5-Minute Restaurant Plan", "instruction": "Choose one restaurant situation and see whether you can make a useful plan without researching forever.", "safety_note": "This challenge is about practicing focused planning, not proving that five minutes is always enough for every restaurant.", "completion_message": "You tried the skill. That counts. +15 XP", "source_basis": "Meyer & Naveh self-management framework; NIDDK dining guidance", "steps": ["Set a short planning window—about five minutes for this challenge.", "Check the restaurant/menu and identify the one or two questions that matter most.", "Choose a backup if you need one, then stop researching."], "reflection_options": ["😊 Easier than expected", "🙂 Pretty good", "😐 Okay", "😬 Awkward", "🔄 Didn't go as planned"], "source_url": "https://doi.org/10.3390/nu13051401", "review_note": "Keep this challenge flagged for expert review before public release. It translates evidence and/or teen lived experience into a real-world self-management activity."}, "graph": {"format": "rlc_branching_v1", "start_node_id": "RLC_004_V2_OPEN", "nodes": [{"id": "RLC_004_V2_OPEN", "type": "opening", "text": "Friends suggest a restaurant you have not planned for. You want enough information to make a useful plan without researching forever.", "next_node_id": "RLC_004_V2_D1"}, {"id": "RLC_004_V2_D1_AFTER1", "type": "consequence", "text": "You quickly identify what the restaurant says about its food.", "next_node_id": "RLC_004_V2_D2"}, {"id": "RLC_004_V2_D1_AFTER2", "type": "consequence", "text": "You narrow the task instead of trying to investigate everything.", "next_node_id": "RLC_004_V2_D2"}, {"id": "RLC_004_V2_D1_AFTER3", "type": "consequence", "text": "You make sure the evening can still work if the food information stays unclear.", "next_node_id": "RLC_004_V2_D2"}, {"id": "RLC_004_V2_D1", "type": "decision", "text": "You start a short planning window. What do you focus on first?", "choices": [{"id": "RLC_004_V2_D1_C1", "text": "Restaurant/menu information", "next_node_id": "RLC_004_V2_D1_AFTER1"}, {"id": "RLC_004_V2_D1_C2", "text": "The one or two questions that matter most", "next_node_id": "RLC_004_V2_D1_AFTER2"}, {"id": "RLC_004_V2_D1_C3", "text": "A backup plan", "next_node_id": "RLC_004_V2_D1_AFTER3"}]}, {"id": "RLC_004_V2_D2_AFTER1", "type": "consequence", "text": "You focus on the missing information.", "next_node_id": "RLC_004_V2_D3"}, {"id": "RLC_004_V2_D2_AFTER2", "type": "consequence", "text": "You use the rest of your planning window for a targeted check.", "next_node_id": "RLC_004_V2_D3"}, {"id": "RLC_004_V2_D2_AFTER3", "type": "consequence", "text": "You decide you have reached your planning limit for now.", "next_node_id": "RLC_004_V2_D3"}, {"id": "RLC_004_V2_D2_AFTER4", "type": "consequence", "text": "You separate joining the event from making the food decision now.", "next_node_id": "RLC_004_V2_D3"}, {"id": "RLC_004_V2_D2", "type": "decision", "text": "You find a gluten-free option listed, but preparation details are unclear. What next?", "choices": [{"id": "RLC_004_V2_D2_C1", "text": "Ask about preparation", "next_node_id": "RLC_004_V2_D2_AFTER1"}, {"id": "RLC_004_V2_D2_C2", "text": "Check one more trusted source or restaurant detail", "next_node_id": "RLC_004_V2_D2_AFTER2"}, {"id": "RLC_004_V2_D2_C3", "text": "Keep your backup and stop researching", "next_node_id": "RLC_004_V2_D2_AFTER3"}, {"id": "RLC_004_V2_D2_C4", "text": "Decide about food when you have more information later", "next_node_id": "RLC_004_V2_D2_AFTER4"}]}, {"id": "RLC_004_V2_D3_AFTER1", "type": "consequence", "text": "You stop researching and carry a flexible plan forward.", "next_node_id": "RLC_004_V2_END"}, {"id": "RLC_004_V2_D3_AFTER2", "type": "consequence", "text": "You leave one question for the real situation.", "next_node_id": "RLC_004_V2_END"}, {"id": "RLC_004_V2_D3_AFTER3", "type": "consequence", "text": "You decide the available information is not enough for this plan.", "next_node_id": "RLC_004_V2_END"}, {"id": "RLC_004_V2_D3", "type": "decision", "text": "Your planning time is up and you still do not have perfect certainty. What do you do?", "choices": [{"id": "RLC_004_V2_D3_C1", "text": "Use the plan and backup you made", "next_node_id": "RLC_004_V2_D3_AFTER1"}, {"id": "RLC_004_V2_D3_C2", "text": "Ask when you arrive before deciding", "next_node_id": "RLC_004_V2_D3_AFTER2"}, {"id": "RLC_004_V2_D3_C3", "text": "Choose another option", "next_node_id": "RLC_004_V2_D3_AFTER3"}]}, {"id": "RLC_004_V2_END", "type": "ending", "text": "You practiced focused planning: identify what matters, make a backup if useful, and know when to stop researching.", "skill_tags": ["MANAGE", "CHECK", "PREPARE", "TRUST"]}]}}$record$::jsonb;
begin
 if not exists (select 1 from public.explore_content where content_id=(item->>'content_id')::uuid and content_type='REAL_LIFE_CHALLENGE' and content_body->>'challenge_id'='RLC_004') then
  raise exception 'The original RLC_004 must be loaded before this optional adventure layer.';
 end if;
 insert into public.rlc_adventures (content_id,challenge_id,adventure_version,branching_enabled,active,review_status,expert_review_required,expert_reviewed,medical_review_required,medical_reviewed,source_document,content_origin,original_review_metadata,graph)
 values ((item->>'content_id')::uuid,item->>'challenge_id',item->>'adventure_version',true,true,'needs_review',true,false,false,false,item->>'source_document',item->>'content_origin',item->'original_review_metadata',item->'graph')
 on conflict(content_id) do nothing;
 -- Do not overwrite reviewed/edited content if this proof is rerun.
 if exists (select 1 from public.rlc_adventures where content_id=(item->>'content_id')::uuid and (graph is distinct from item->'graph' or adventure_version is distinct from item->>'adventure_version')) then
  raise exception 'An adventure version/content already exists and differs; review it before replacing.';
 end if;
end $migration$;
commit;
select challenge_id,adventure_version,review_status,expert_reviewed,
 jsonb_array_length(graph->'nodes') as node_count,
 (select sum(jsonb_array_length(coalesce(n->'choices','[]'::jsonb))) from jsonb_array_elements(graph->'nodes') n) as choice_count
from public.rlc_adventures where challenge_id='RLC_004';
