-- Optional support only. Does not change Meyer wording, review flags, plans or XP.
begin;
alter table public.action_library add column if not exists related_explore_content_ids uuid[] not null default '{}';
comment on column public.action_library.related_explore_content_ids is 'Ordered, editorial links to existing Explore content. Optional support; never a prerequisite. Only published/review-eligible content with an available screen may be suggested.';
-- Seed only currently empty linkage metadata; reruns preserve later editorial changes.
with links(id, content_ids) as (values
  ('ask_01', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('ask_02', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('ask_03', ARRAY['3f076ccb-6266-5cb7-ad14-5772e7b9e213'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('ask_04', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid,'da405da2-bdef-5350-8574-dfb14bb71afb'::uuid]),
  ('ask_06', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('ask_07', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('ask_08', ARRAY['2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('ask_09', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('ask_10', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('prepare_02', ARRAY['87aca241-c8d5-4c45-b7d6-b786b08f7d01'::uuid]),
  ('prepare_05', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid]),
  ('prepare_06', ARRAY['191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('prepare_07', ARRAY['87aca241-c8d5-4c45-b7d6-b786b08f7d01'::uuid]),
  ('check_03', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid]),
  ('check_05', ARRAY['f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid,'87aca241-c8d5-4c45-b7d6-b786b08f7d01'::uuid]),
  ('check_06', ARRAY['4cab56b8-ea49-5204-9dc2-f03df42ab0e5'::uuid]),
  ('check_07', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('check_08', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('check_09', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('avoid_03', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid]),
  ('avoid_06', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid]),
  ('take_01', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('take_03', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('take_04', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('take_08', ARRAY['4cab56b8-ea49-5204-9dc2-f03df42ab0e5'::uuid]),
  ('collaborate_01', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('collaborate_02', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid,'2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid]),
  ('collaborate_03', ARRAY['87aca241-c8d5-4c45-b7d6-b786b08f7d01'::uuid]),
  ('collaborate_04', ARRAY['2e2e2694-889d-53fd-a23f-f599f0b35b22'::uuid,'191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('collaborate_05', ARRAY['da405da2-bdef-5350-8574-dfb14bb71afb'::uuid,'2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid]),
  ('collaborate_06', ARRAY['2e2e2694-889d-53fd-a23f-f599f0b35b22'::uuid,'191d843a-1070-523e-af2a-5963476e7bca'::uuid]),
  ('collaborate_07', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('call_01', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('call_02', ARRAY['3f076ccb-6266-5cb7-ad14-5772e7b9e213'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('call_03', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('call_04', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('call_05', ARRAY['2eb97e20-58a4-542c-8e86-e5e362e7f03d'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('call_06', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('call_07', ARRAY['f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid,'87aca241-c8d5-4c45-b7d6-b786b08f7d01'::uuid]),
  ('say_01', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid,'da405da2-bdef-5350-8574-dfb14bb71afb'::uuid]),
  ('say_02', ARRAY['155cbeba-df91-574e-9cc4-de5e31c7fd78'::uuid,'f7e4d7d3-b640-56c1-a6b4-e043bb612326'::uuid]),
  ('say_03', ARRAY['cb10e2e5-7e72-58f8-8b4b-ad5a14fe2e5a'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_05', ARRAY['cb10e2e5-7e72-58f8-8b4b-ad5a14fe2e5a'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_06', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_07', ARRAY['cb10e2e5-7e72-58f8-8b4b-ad5a14fe2e5a'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_08', ARRAY['cb10e2e5-7e72-58f8-8b4b-ad5a14fe2e5a'::uuid,'91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_09', ARRAY['91453ad5-311b-585f-8647-cc1694d781b0'::uuid]),
  ('say_10', ARRAY['4cab56b8-ea49-5204-9dc2-f03df42ab0e5'::uuid])
)
update public.action_library a set related_explore_content_ids=links.content_ids
from links where a.id=links.id and a.source='Meyer_2021' and a.review_status='approved'
  and cardinality(a.related_explore_content_ids)=0;
commit;
select id,category,related_explore_content_ids from public.action_library
where source='Meyer_2021' and cardinality(related_explore_content_ids)>0 order by category,id;
