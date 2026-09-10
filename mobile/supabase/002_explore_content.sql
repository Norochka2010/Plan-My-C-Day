begin;
create table public.explore_content (
  content_id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('QUICK_LEARN','MYTH_OR_FACT','PRACTICE_A_SKILL','REAL_LIFE_CHALLENGE','EXPERT_RESOURCE')),
  title text not null check (length(trim(title)) > 0),
  subtitle text,
  domain text not null check (domain in ('KNOW','MANAGE','SPEAK','TRUST','LIVE','LEAD')),
  topic text,
  interaction_type text not null check (interaction_type in ('KNOWLEDGE','CHOICE','REFLECTION')),
  difficulty text check (difficulty in ('INTRODUCTORY','BUILDING','EXTENDING')),
  estimated_minutes integer check (estimated_minutes > 0),
  intro text,
  content_body jsonb not null default '[]'::jsonb check (jsonb_typeof(content_body) = 'array'),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(feedback) = 'object'),
  teaching_point text,
  next_step text,
  related_content_ids uuid[] not null default '{}',
  xp_value integer not null default 0 check (xp_value >= 0),
  source_type text not null default 'EDITORIAL' check (source_type in ('EDITORIAL','EXPERT','COMMUNITY')),
  source_organization text,
  source_title text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  author text,
  review_status text not null default 'DRAFT' check (review_status in ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED')),
  expert_reviewer text,
  medical_review_required boolean not null default true,
  content_version integer not null default 1 check (content_version > 0),
  last_reviewed timestamptz,
  active boolean not null default false,
  constraint publication_review check (not active or (review_status = 'APPROVED' and last_reviewed is not null)),
  constraint medical_review check (not active or not medical_review_required or nullif(trim(expert_reviewer), '') is not null),
  constraint expert_attribution check (content_type <> 'EXPERT_RESOURCE' or (source_type = 'EXPERT' and source_url is not null and source_organization is not null)),
  constraint reflection_unscored check (interaction_type <> 'REFLECTION' or not (feedback ? 'correct_choice_ids'))
);

alter table public.explore_content enable row level security;
revoke all on public.explore_content from anon, authenticated;
grant select on public.explore_content to anon, authenticated;
create policy "Read published Explore content"
  on public.explore_content for select to anon, authenticated
  using (active and review_status = 'APPROVED' and source_type <> 'COMMUNITY');
create index explore_content_published_type on public.explore_content(content_type, title)
  where active and review_status = 'APPROVED' and source_type <> 'COMMUNITY';
comment on table public.explore_content is 'Reusable Explore content. Publish only reviewed content. Community submissions are not exposed through Explore.';
comment on column public.explore_content.content_body is 'Array of blocks: {type: paragraph|heading, text: string}.';
comment on column public.explore_content.choices is 'Array of {id: string, label: string}. Food decisions must allow Needs More Information.';
comment on column public.explore_content.feedback is 'Object: {summary?: string, by_choice_id?: {id: string}, correct_choice_ids?: string[]}. Omit correctness for reflection; choices may have multiple reasonable responses.';
comment on column public.explore_content.xp_value is 'Metadata only. No client-side award authority. Never award XP for food exposure or unsafe risk-taking.';
commit;
