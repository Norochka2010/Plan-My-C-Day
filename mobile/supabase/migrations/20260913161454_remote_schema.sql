


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."explore_interaction_type" AS ENUM (
    'KNOWLEDGE',
    'CHOICE',
    'REFLECTION'
);


ALTER TYPE "public"."explore_interaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_interact"("p_id" "uuid", "p_action" "text", "p_enabled" boolean DEFAULT true, "p_reason" "text" DEFAULT ''::"text", "p_note" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare u uuid:=auth.uid(); r public.community_recipes; begin
 if u is null then raise exception 'Sign in to use Community.'; end if;
 select * into r from public.community_recipes where id=p_id for update;
 if r.id is null or r.status<>'published' then raise exception 'This recipe is no longer published.'; end if;
 if p_action='save' then
 if p_enabled then insert into public.community_recipe_saves(recipe_id,user_id) values(p_id,u) on conflict do nothing; else delete from public.community_recipe_saves where recipe_id=p_id and user_id=u; end if;
 elsif p_action='helpful' then
 if p_enabled then insert into public.community_recipe_reactions(recipe_id,user_id) values(p_id,u) on conflict do nothing; else delete from public.community_recipe_reactions where recipe_id=p_id and user_id=u; end if;
 elsif p_action='hide' then
 insert into public.community_recipe_hides(recipe_id,user_id) values(p_id,u) on conflict do nothing;
 elsif p_action='report' then
 insert into public.community_reports(recipe_id,reporter_user_id,reason_code,optional_note) values(p_id,u,p_reason,coalesce(p_note,'')) on conflict(recipe_id,reporter_user_id) do nothing;
 insert into public.community_recipe_hides(recipe_id,user_id) values(p_id,u) on conflict do nothing;
 update public.community_recipes set review_required=true where id=p_id;
 else raise exception 'Unknown action.'; end if;
 return jsonb_build_object('ok',true);
end $$;


ALTER FUNCTION "public"."community_interact"("p_id" "uuid", "p_action" "text", "p_enabled" boolean, "p_reason" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_is_moderator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select exists(select 1 from public.community_moderators where user_id=auth.uid() and active)
$$;


ALTER FUNCTION "public"."community_is_moderator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_moderate"("p_id" "uuid", "p_action" "text", "p_reason" "text" DEFAULT ''::"text", "p_note" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.community_recipes; next_status text; begin
 if not public.community_is_moderator() then raise exception 'Moderator access required.'; end if;
 if p_action not in ('approve','hide','remove','restore','resolve_reports') or p_action is null then raise exception 'Unknown moderation action.'; end if;
 if p_action<>'approve' and length(btrim(coalesce(p_reason,'')))=0 then raise exception 'A reason is required.'; end if;
 if length(coalesce(p_reason,''))>100 or length(coalesce(p_note,''))>1000 then raise exception 'Moderation note is too long.'; end if;
 select * into r from public.community_recipes where id=p_id for update;
 if r.id is null or r.status='draft' then raise exception 'Only submitted recipes can be moderated.'; end if;
 if p_action='approve' and r.status<>'pending_review' then raise exception 'Only pending recipes can be approved.'; end if;
 if p_action='restore' and r.status not in ('hidden','removed','flagged') then raise exception 'Only hidden or removed recipes can be restored.'; end if;
 next_status:=case p_action when 'approve' then 'published' when 'restore' then case when r.published_at is null then 'pending_review' else 'published' end when 'hide' then 'hidden' when 'remove' then 'removed' else r.status end;
 update public.community_recipes set status=next_status,review_required=(next_status='pending_review'),published_at=case when p_action='approve' then now() else published_at end,updated_at=now(),revision=revision+1 where id=p_id returning * into r;
 update public.community_reports set status='resolved',resolved_at=now() where recipe_id=p_id and status<>'resolved';
 insert into public.community_moderation_actions(recipe_id,action,moderator_user_id,reason_code,note) values(p_id,p_action,auth.uid(),coalesce(nullif(btrim(p_reason),''),'publication_review'),coalesce(p_note,''));
 return public.community_recipe_json(r);
end $$;


ALTER FUNCTION "public"."community_moderate"("p_id" "uuid", "p_action" "text", "p_reason" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_read"("p_mode" "text" DEFAULT 'browse'::"text", "p_id" "uuid" DEFAULT NULL::"uuid", "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare u uuid:=auth.uid(); m boolean:=public.community_is_moderator(); result jsonb; r public.community_recipes;
begin
 if u is null then raise exception 'Sign in to use Community.'; end if;
 if p_mode='role' then return jsonb_build_object('moderator',m); end if;
 if p_mode='detail' then
 select * into r from public.community_recipes where id=p_id;
 if not found or not (r.author_user_id=u or m or (r.status='published' and not exists(select 1 from public.community_recipe_hides where recipe_id=p_id and user_id=u))) then raise exception 'This recipe is not available.'; end if;
 result:=public.community_recipe_json(r);
 if m then result:=result||jsonb_build_object('review_required',r.review_required,'prescreen_status',r.prescreen_status,'prescreen_flags',r.prescreen_flags,'acknowledgements',r.acknowledgements,'acknowledgement_version',r.acknowledgement_version,
 'reports',coalesce((select jsonb_agg(jsonb_build_object('reason',reason_code,'note',optional_note,'status',status,'created_at',created_at) order by created_at) from public.community_reports where recipe_id=p_id),'[]'),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason_code,'note',note,'created_at',created_at) order by created_at) from public.community_moderation_actions where recipe_id=p_id),'[]')); end if;
 return result;
 end if;
 if p_mode not in ('browse','mine','saved','queue') or (p_mode='queue' and not m) then raise exception 'Not authorized.'; end if;
 select coalesce(jsonb_agg(item order by ordering),'[]') into result from (
 select public.community_recipe_json(c) || case when p_mode='queue' then jsonb_build_object('review_required',c.review_required,'prescreen_status',c.prescreen_status) else '{}'::jsonb end as item,
 row_number() over(order by case when p_mode='queue' then coalesce(c.submitted_at,c.created_at) end asc,c.updated_at desc,c.id) ordering
 from public.community_recipes c where
 (p_mode='mine' and c.author_user_id=u) or
 (p_mode='queue' and (c.status in ('pending_review','flagged','hidden','removed') or c.review_required)) or
 (p_mode in ('browse','saved') and c.status='published' and not exists(select 1 from public.community_recipe_hides h where h.recipe_id=c.id and h.user_id=u)
 and (p_mode='browse' or exists(select 1 from public.community_recipe_saves b where b.recipe_id=c.id and b.user_id=u)))
 order by ordering limit 30 offset greatest(coalesce(p_offset,0),0)
 ) q;
 return result;
end $$;


ALTER FUNCTION "public"."community_read"("p_mode" "text", "p_id" "uuid", "p_offset" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."community_recipes" (
    "id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT ''::"text" NOT NULL,
    "effort_level" "text" DEFAULT ''::"text" NOT NULL,
    "ingredients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "double_check_tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "use_case_tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "friend_tip" "text" DEFAULT ''::"text" NOT NULL,
    "photo_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "review_required" boolean DEFAULT false NOT NULL,
    "prescreen_status" "text" DEFAULT 'not_connected'::"text" NOT NULL,
    "prescreen_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "acknowledgement_version" "text",
    "acknowledgements" "jsonb",
    "submitted_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revision" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "community_recipes_friend_tip_check" CHECK (("length"("friend_tip") <= 600)),
    CONSTRAINT "community_recipes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'published'::"text", 'flagged'::"text", 'hidden'::"text", 'removed'::"text"]))),
    CONSTRAINT "community_recipes_title_check" CHECK (("length"("title") <= 100))
);


ALTER TABLE "public"."community_recipes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_recipe_json"("r" "public"."community_recipes") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'effort_level',r.effort_level,
 'ingredients',r.ingredients,'steps',r.steps,'double_check_tags',r.double_check_tags,'use_case_tags',r.use_case_tags,'friend_tip',r.friend_tip,
 'status',r.status,'revision',r.revision,'submitted_at',r.submitted_at,'published_at',r.published_at,
 'is_author',r.author_user_id=auth.uid(),
 'saved',exists(select 1 from public.community_recipe_saves where recipe_id=r.id and user_id=auth.uid()),
 'helpful',exists(select 1 from public.community_recipe_reactions where recipe_id=r.id and user_id=auth.uid()))
$$;


ALTER FUNCTION "public"."community_recipe_json"("r" "public"."community_recipes") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_save_draft"("p_id" "uuid", "p_data" "jsonb", "p_revision" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare u uuid:=auth.uid(); r public.community_recipes; x jsonb;
begin
 if u is null then raise exception 'Sign in to save a recipe.'; end if;
 if p_id is null or p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>25000 then raise exception 'Recipe data is invalid or too long.'; end if;
 if jsonb_typeof(p_data->'ingredients') is distinct from 'array' or jsonb_typeof(p_data->'steps') is distinct from 'array' or jsonb_typeof(p_data->'double_check_tags') is distinct from 'array' or jsonb_typeof(p_data->'use_case_tags') is distinct from 'array' then raise exception 'Recipe lists are invalid.'; end if;
 if jsonb_array_length(p_data->'ingredients')>30 or jsonb_array_length(p_data->'steps')>30 then raise exception 'Use no more than 30 ingredients or steps.'; end if;
 if coalesce(p_data->>'category','') not in ('','Breakfast','Lunch','Dinner','Snack','Dessert','Drink','Sauce/Dip','Other') or coalesce(p_data->>'effort_level','') not in ('','Quick & Easy','A Little Prep','Weekend Project') then raise exception 'Choose a listed category and effort.'; end if;
 for x in select value from jsonb_array_elements(p_data->'ingredients') loop
 if jsonb_typeof(x)<>'object' or jsonb_typeof(x->'ingredient_text') is distinct from 'string' or jsonb_typeof(x->'amount_text') is distinct from 'string' or length(x->>'ingredient_text')>200 or length(x->>'amount_text')>80 then raise exception 'Check ingredient names and amounts.'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_data->'steps') loop
 if jsonb_typeof(x)<>'string' or length(x#>>'{}')>600 then raise exception 'Keep each step under 600 characters.'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_data->'double_check_tags') loop
 if jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('Brand matters','Check the label','Cross-contact may matter','Use a GF-certified/labeled version','Nothing special','Not sure') then raise exception 'Choose listed double-check tags.'; end if;
 end loop;
 if (p_data->'double_check_tags') ? 'Nothing special' and jsonb_array_length(p_data->'double_check_tags')>1 then raise exception 'Nothing special cannot be combined with other checks.'; end if;
 for x in select value from jsonb_array_elements(p_data->'use_case_tags') loop
 if jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('School lunch','After school','Family dinner','Party','Travel','Make ahead') then raise exception 'Choose listed use-case tags.'; end if;
 end loop;
 insert into public.community_member_reputation(user_id) values(u) on conflict do nothing;
 -- Insert first to serialize retries creating the same draft; then lock and check revision.
 insert into public.community_recipes(id,author_user_id,revision) values(p_id,u,0) on conflict do nothing;
 select * into r from public.community_recipes where id=p_id for update;
 if r.author_user_id<>u or r.status<>'draft' then raise exception 'Only your own draft can be edited.'; end if;
 if r.revision<>p_revision then raise exception 'This draft changed elsewhere. Reopen it before editing.'; end if;
 update public.community_recipes set title=coalesce(p_data->>'title',''),category=coalesce(p_data->>'category',''),effort_level=coalesce(p_data->>'effort_level',''),
 ingredients=p_data->'ingredients',steps=p_data->'steps',double_check_tags=p_data->'double_check_tags',use_case_tags=p_data->'use_case_tags',friend_tip=coalesce(p_data->>'friend_tip',''),updated_at=now(),revision=revision+1
 where id=p_id returning * into r;
 return public.community_recipe_json(r);
end $$;


ALTER FUNCTION "public"."community_save_draft"("p_id" "uuid", "p_data" "jsonb", "p_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_submit"("p_id" "uuid", "p_revision" integer, "p_ack" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.community_recipes; begin
 select * into r from public.community_recipes where id=p_id for update;
 if auth.uid() is null or r.id is null or r.author_user_id<>auth.uid() then raise exception 'Not authorized.'; end if;
 if r.status='pending_review' then return public.community_recipe_json(r); end if;
 if r.status<>'draft' or r.revision<>p_revision then raise exception 'Reopen your draft before submitting.'; end if;
 if p_ack is distinct from '[true,true,true]'::jsonb then raise exception 'Please accept all three acknowledgements.'; end if;
 if length(btrim(r.title))=0 or r.category='' or r.effort_level='' or jsonb_array_length(r.ingredients)=0 or jsonb_array_length(r.steps)=0
 or exists(select 1 from jsonb_array_elements(r.ingredients) x where length(btrim(x->>'ingredient_text'))=0 or length(btrim(x->>'amount_text'))=0)
 or exists(select 1 from jsonb_array_elements_text(r.steps) x where length(btrim(x))=0) then raise exception 'Add a title, category, effort, ingredients with amounts, and steps.'; end if;
 update public.community_recipes set status='pending_review',review_required=true,acknowledgement_version='community-v1',acknowledgements=p_ack,submitted_at=now(),updated_at=now(),revision=revision+1 where id=p_id returning * into r;
 return public.community_recipe_json(r);
end $$;


ALTER FUNCTION "public"."community_submit"("p_id" "uuid", "p_revision" integer, "p_ack" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."c_day_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "venue_name" "text",
    "event_start_at" timestamp with time zone NOT NULL,
    "event_timezone" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_rating" smallint,
    "reflection_helpfulness" "text",
    "reflection_notes" "text",
    "reflected_at" timestamp with time zone,
    CONSTRAINT "c_day_events_plan_rating_check" CHECK ((("plan_rating" >= 1) AND ("plan_rating" <= 5))),
    CONSTRAINT "c_day_events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'planned'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "c_day_events_title_check" CHECK (("length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "c_day_reflection_helpfulness_check" CHECK (("reflection_helpfulness" = ANY (ARRAY['Not helpful yet'::"text", 'A little helpful'::"text", 'Helpful'::"text", 'Very helpful'::"text", 'Not sure'::"text"]))),
    CONSTRAINT "c_day_reflection_notes_check" CHECK (("char_length"("reflection_notes") <= 2000))
);


ALTER TABLE "public"."c_day_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_notes" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."c_day_events"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.c_day_events;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if target.status='completed' then return next target; return; end if;
 if target.status<>'planned' or target.event_type<>'dinner_with_friends' or target.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
 if p_helpfulness is null then raise exception 'Choose how helpful your plan felt'; end if;
 delete from public.c_day_reflection_tags where c_day_event_id=p_event_id;
 insert into public.c_day_reflection_tags(c_day_event_id,tag) select p_event_id,t from (select distinct unnest(p_tags) t) tags;
 update public.c_day_events set reflection_helpfulness=p_helpfulness,reflection_notes=nullif(btrim(p_notes),''),status='completed' where id=p_event_id returning * into target;
 return next target;
end $$;


ALTER FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[], "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_c_day"("p_event_id" "uuid", "p_rating" smallint) RETURNS SETOF "public"."c_day_events"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.c_day_events; total integer; configured integer;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 -- A retry after a lost response must not modify the already-finalized plan.
 if target.status='planned' then return next target; return; end if;
 if target.status<>'draft' then raise exception 'Only a draft can be finalized'; end if;
 if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a plan rating from 1 to 5'; end if;
 select count(*),count(*) filter (where scheduled_at is not null and difficulty is not null)
 into total,configured from public.c_day_actions where c_day_event_id=target.id and completion_status<>'not_needed';
 if total<2 or total>6 or configured<>total then raise exception 'Finalization requires 2–6 configured actions'; end if;
 update public.c_day_events set plan_rating=p_rating,status='planned' where id=target.id returning * into target;
 return next target;
end $$;


ALTER FUNCTION "public"."finalize_c_day"("p_event_id" "uuid", "p_rating" smallint) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."c_day_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "c_day_event_id" "uuid" NOT NULL,
    "action_library_id" "text" NOT NULL,
    "action_text_snapshot" "text" NOT NULL,
    "source_snapshot" "text" NOT NULL,
    "source_version_snapshot" numeric NOT NULL,
    "scheduled_at" timestamp with time zone,
    "schedule_value" integer,
    "schedule_unit" "text" DEFAULT 'custom'::"text" NOT NULL,
    "difficulty" "text",
    "completion_status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "reschedule_count" integer DEFAULT 0 NOT NULL,
    "calendar_sync_enabled" boolean DEFAULT false NOT NULL,
    "calendar_sync_status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "native_calendar_event_id" "text",
    "calendar_sync_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "xp_awarded" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "c_day_action_xp_check" CHECK ((("xp_awarded" >= 0) AND (("completion_status" = 'done'::"text") OR ("xp_awarded" = 0)))),
    CONSTRAINT "c_day_actions_calendar_sync_status_check" CHECK (("calendar_sync_status" = ANY (ARRAY['not_requested'::"text", 'pending'::"text", 'synced'::"text", 'denied'::"text", 'failed'::"text"]))),
    CONSTRAINT "c_day_actions_check" CHECK (((("schedule_unit" = 'custom'::"text") AND ("schedule_value" IS NULL)) OR (("schedule_unit" <> 'custom'::"text") AND ("schedule_value" > 0)))),
    CONSTRAINT "c_day_actions_check1" CHECK ((("calendar_sync_status" <> 'synced'::"text") OR ("native_calendar_event_id" IS NOT NULL))),
    CONSTRAINT "c_day_actions_completion_status_check" CHECK (("completion_status" = ANY (ARRAY['planned'::"text", 'done'::"text", 'not_needed'::"text"]))),
    CONSTRAINT "c_day_actions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'moderate'::"text", 'hard'::"text"]))),
    CONSTRAINT "c_day_actions_reschedule_count_check" CHECK (("reschedule_count" >= 0)),
    CONSTRAINT "c_day_actions_schedule_unit_check" CHECK (("schedule_unit" = ANY (ARRAY['hours'::"text", 'days'::"text", 'weeks'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."c_day_actions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."follow_through_c_day_action"("p_action_id" "uuid", "p_choice" "text", "p_scheduled_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_schedule_value" integer DEFAULT NULL::integer, "p_schedule_unit" "text" DEFAULT 'custom'::"text") RETURNS SETOF "public"."c_day_actions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare event_id uuid; parent public.c_day_events; target public.c_day_actions;
begin
 if p_choice not in ('done','reschedule','not_needed') or p_choice is null then raise exception 'Invalid follow-through choice'; end if;
 select c_day_event_id into event_id from public.c_day_actions where id=p_action_id;
 select * into parent from public.c_day_events where id=event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if parent.status<>'planned' then raise exception 'Follow-through requires a finalized C-Day'; end if;
 select * into target from public.c_day_actions where id=p_action_id for update;
 if not found or target.scheduled_at is null then raise exception 'Scheduled action not found'; end if;
 if target.completion_status=p_choice then return next target; return; end if;
 if target.completion_status<>'planned' then raise exception 'This action already has a follow-through result'; end if;
 if p_choice='reschedule' then
  if p_scheduled_at is null then raise exception 'Choose a date and time'; end if;
  if target.scheduled_at=p_scheduled_at then return next target; return; end if;
  if p_scheduled_at<=now() or p_scheduled_at>parent.event_start_at then raise exception 'Choose a future time no later than your C-Day'; end if;
  update public.c_day_actions set scheduled_at=p_scheduled_at,schedule_value=p_schedule_value,schedule_unit=p_schedule_unit,
   completion_status='planned',calendar_sync_status=case when calendar_sync_enabled or native_calendar_event_id is not null then 'pending' else 'not_requested' end,
   calendar_sync_message=case when calendar_sync_enabled or native_calendar_event_id is not null then 'Calendar changes are deferred. Saved in My Plan only.' else null end
  where id=p_action_id returning * into target;
 else
  update public.c_day_actions set completion_status=p_choice,
   calendar_sync_status=case when p_choice='not_needed' and (calendar_sync_enabled or native_calendar_event_id is not null) then 'pending' else calendar_sync_status end,
   calendar_sync_message=case when p_choice='not_needed' and (calendar_sync_enabled or native_calendar_event_id is not null) then 'Calendar changes are deferred. No phone calendar event was changed.' else calendar_sync_message end
  where id=p_action_id returning * into target;
 end if;
 return next target;
end $$;


ALTER FUNCTION "public"."follow_through_c_day_action"("p_action_id" "uuid", "p_choice" "text", "p_scheduled_at" timestamp with time zone, "p_schedule_value" integer, "p_schedule_unit" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_c_day_action"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare parent public.c_day_events; item public.action_library; selected_count integer;
begin
 if tg_op='DELETE' then
  select * into parent from public.c_day_events where id=old.c_day_event_id for update;
  if old.native_calendar_event_id is not null then raise exception 'Linked calendar event must be handled before removal'; end if;
  if found and parent.status<>'draft' then raise exception 'Only draft actions can be removed'; end if;
  return old;
 end if;
 select * into parent from public.c_day_events where id=new.c_day_event_id for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 -- Ignore client-supplied XP. Only the validated Done transition below can award it.
 if tg_op='INSERT' then new.xp_awarded:=0; else new.xp_awarded:=old.xp_awarded; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.c_day_event_id<>old.c_day_event_id or new.action_library_id<>old.action_library_id then raise exception 'Selected action identity cannot change'; end if;
  new.action_text_snapshot:=old.action_text_snapshot;
  new.source_snapshot:=old.source_snapshot;
  new.source_version_snapshot:=old.source_version_snapshot;
 end if;
 if parent.status='planned' then
  if tg_op<>'UPDATE' then raise exception 'Cannot add actions to a finalized plan'; end if;
  if (to_jsonb(new)-array['scheduled_at','schedule_value','schedule_unit','completion_status','completed_at','reschedule_count','calendar_sync_enabled','calendar_sync_status','native_calendar_event_id','calendar_sync_message','updated_at'])
   is distinct from (to_jsonb(old)-array['scheduled_at','schedule_value','schedule_unit','completion_status','completed_at','reschedule_count','calendar_sync_enabled','calendar_sync_status','native_calendar_event_id','calendar_sync_message','updated_at']) then
    raise exception 'Follow-through cannot change action difficulty or identity';
  end if;
  if old.completion_status<>'planned' and (new.completion_status<>old.completion_status or new.scheduled_at is distinct from old.scheduled_at or new.schedule_value is distinct from old.schedule_value or new.schedule_unit<>old.schedule_unit) then
   raise exception 'This action already has a follow-through result';
  end if;
  if new.scheduled_at is null or new.difficulty is null then raise exception 'A finalized action must stay configured'; end if;
  if new.scheduled_at is distinct from old.scheduled_at then
   if new.completion_status<>'planned' or new.scheduled_at<=now() then raise exception 'Choose a future time for rescheduling'; end if;
  end if;
  if new.completion_status='done' then new.completed_at:=coalesce(old.completed_at,now()); else new.completed_at:=null; end if;
 elsif parent.status='draft' then
  if new.completion_status<>'planned' then raise exception 'Finalize the C-Day before follow-through'; end if;
  new.completed_at:=null;
  select count(*) into selected_count from public.c_day_actions where c_day_event_id=new.c_day_event_id and id<>new.id and completion_status<>'not_needed';
  if selected_count>=6 then raise exception 'A draft can contain at most six actions'; end if;
  if tg_op='INSERT' then
   select * into item from public.action_library where id=new.action_library_id and active and review_status='approved';
   if not found then raise exception 'Action is not available'; end if;
   new.action_text_snapshot:=item.action_text;new.source_snapshot:=item.source;new.source_version_snapshot:=item.content_version;
  end if;
 else raise exception 'This C-Day cannot be changed in this stage';
 end if;
 if new.scheduled_at>parent.event_start_at then raise exception 'Action must be scheduled no later than the C-Day'; end if;
 if tg_op='INSERT' then new.reschedule_count:=0;
 else new.reschedule_count:=old.reschedule_count+case when new.scheduled_at <> old.scheduled_at then 1 else 0 end;
 end if;
 -- Store a single award atomically with Done; retries and later metadata writes retain it.
 if tg_op='UPDATE' and old.completion_status='planned' and new.completion_status='done' then
  new.xp_awarded:=case old.difficulty when 'easy' then 5 when 'moderate' then 7 when 'hard' then 9 else 0 end;
 end if;
 new.updated_at:=now();return new;
end $$;


ALTER FUNCTION "public"."guard_c_day_action"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_c_day_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare action_count integer;
begin
 if tg_op='UPDATE' and old.status='completed' then raise exception 'Completed C-Day history is read only'; end if;
 if new.status='completed' then
  if tg_op<>'UPDATE' then raise exception 'Complete a planned C-Day through reflection'; end if;
  if old.status<>'planned' or new.event_type<>'dinner_with_friends' or old.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
  if new.reflection_helpfulness is null then raise exception 'Choose how helpful your plan felt'; end if;
  if (to_jsonb(new)-array['reflection_helpfulness','reflection_notes','reflected_at','status','updated_at']) is distinct from
     (to_jsonb(old)-array['reflection_helpfulness','reflection_notes','reflected_at','status','updated_at']) then raise exception 'Reflection must preserve the original plan'; end if;
  new.reflected_at:=now();
 elsif new.reflection_helpfulness is not null or new.reflection_notes is not null or new.reflected_at is not null then
  raise exception 'Reflection is saved when completing a C-Day';
 end if;
 if not exists (select 1 from pg_timezone_names where name = new.event_timezone) then
  raise exception 'Invalid event timezone';
 end if;
 if tg_op = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id) then
  raise exception 'Event identity cannot change';
 end if;
 select count(*) into action_count from public.c_day_actions
  where c_day_event_id = new.id and completion_status <> 'not_needed';
 if action_count > 6 or (new.status in ('planned','completed') and action_count < 2 and (tg_op='INSERT' or old.status='draft')) then
  raise exception 'Finalized plans require 2–6 actions; drafts allow 0–6';
 end if;
 if exists (select 1 from public.c_day_actions where c_day_event_id = new.id and scheduled_at > new.event_start_at) then
  raise exception 'Event cannot be earlier than its preparation actions';
 end if;
 if new.status in ('planned','completed') and exists (select 1 from public.c_day_actions where c_day_event_id=new.id and completion_status <> 'not_needed' and (scheduled_at is null or difficulty is null)) then
  raise exception 'Actions must be configured before finalization';
 end if;
 if new.status in ('planned','completed') and new.plan_rating is null then raise exception 'Choose a plan rating before finalization'; end if;
 if tg_op='UPDATE' and old.status='planned' and new.status='draft' then raise exception 'Reopening a finalized plan is not supported in this stage'; end if;
 new.updated_at := now();
 return new;
end $$;


ALTER FUNCTION "public"."guard_c_day_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_c_day_reflection_tag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare parent public.c_day_events;
begin
 select * into parent from public.c_day_events where id=case when tg_op='DELETE' then old.c_day_event_id else new.c_day_event_id end for update;
 if not found or parent.status<>'planned' or parent.event_start_at>now() or parent.event_type<>'dinner_with_friends' then raise exception 'Reflection tags require a past planned C-Day; completed history is read only'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;


ALTER FUNCTION "public"."guard_c_day_reflection_tag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_inspiration_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ begin new.updated_at:=now();return new;end $$;


ALTER FUNCTION "public"."home_inspiration_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_completed_c_day"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
 if old.status='completed' then raise exception 'Completed C-Day history is read only'; end if;
 return old;
end $$;


ALTER FUNCTION "public"."protect_completed_c_day"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_explore_content_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_explore_content_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_app_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.users (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_app_user"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_library" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "action_text" "text" NOT NULL,
    "source" "text" NOT NULL,
    "content_version" numeric DEFAULT 1.0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "review_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "related_explore_content_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    CONSTRAINT "action_library_category_check" CHECK (("category" = ANY (ARRAY['ASK'::"text", 'PREPARE'::"text", 'CHECK'::"text", 'AVOID'::"text", 'TAKE'::"text", 'COLLABORATE'::"text", 'CALL'::"text", 'SAY'::"text"]))),
    CONSTRAINT "action_library_review_status_check" CHECK (("review_status" = ANY (ARRAY['approved'::"text", 'needs_review'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."action_library" OWNER TO "postgres";


COMMENT ON COLUMN "public"."action_library"."related_explore_content_ids" IS 'Ordered, editorial links to existing Explore content. Optional support; never a prerequisite. Only published/review-eligible content with an available screen may be suggested.';



CREATE TABLE IF NOT EXISTS "public"."explore_content" (
    "content_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "domain" "text",
    "topic" "text",
    "interaction_type" "public"."explore_interaction_type" DEFAULT 'KNOWLEDGE'::"public"."explore_interaction_type" NOT NULL,
    "difficulty" "text",
    "estimated_minutes" integer,
    "intro" "text",
    "content_body" "jsonb" DEFAULT '{}'::"jsonb",
    "choices" "jsonb" DEFAULT '[]'::"jsonb",
    "feedback" "jsonb" DEFAULT '{}'::"jsonb",
    "teaching_point" "text",
    "next_step" "text",
    "related_content_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "xp_value" integer DEFAULT 0 NOT NULL,
    "source_type" "text",
    "source_organization" "text",
    "source_title" "text",
    "source_url" "text",
    "author" "text",
    "review_status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "expert_reviewer" "text",
    "medical_review_required" boolean DEFAULT false NOT NULL,
    "content_version" integer DEFAULT 1 NOT NULL,
    "last_reviewed" timestamp with time zone,
    "active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "explore_content_content_version_check" CHECK (("content_version" >= 1)),
    CONSTRAINT "explore_content_estimated_minutes_check" CHECK ((("estimated_minutes" IS NULL) OR ("estimated_minutes" >= 0))),
    CONSTRAINT "explore_content_xp_value_check" CHECK (("xp_value" >= 0))
);


ALTER TABLE "public"."explore_content" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_explore_content" AS
 SELECT "content_id",
    "content_type",
    "title",
    "subtitle",
    "domain",
    "topic",
    "interaction_type",
    "difficulty",
    "estimated_minutes",
    "intro",
    "content_body",
    "choices",
    "feedback",
    "teaching_point",
    "next_step",
    "related_content_ids",
    "xp_value",
    "source_type",
    "source_organization",
    "source_title",
    "source_url",
    "author",
    "review_status",
    "expert_reviewer",
    "medical_review_required",
    "content_version",
    "last_reviewed",
    "active",
    "created_at",
    "updated_at"
   FROM "public"."explore_content"
  WHERE ("active" = true);


ALTER VIEW "public"."active_explore_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."c_day_reflection_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "c_day_event_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "c_day_reflection_tags_tag_check" CHECK (("tag" = ANY (ARRAY['Planning ahead'::"text", 'Asking questions'::"text", 'Getting support'::"text", 'Communicating my needs'::"text", 'Using reminders'::"text", 'Adapting my plan'::"text"])))
);


ALTER TABLE "public"."c_day_reflection_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_member_reputation" (
    "user_id" "uuid" NOT NULL,
    "tier" "text" DEFAULT 'new'::"text" NOT NULL,
    "approved_contribution_count" integer DEFAULT 0 NOT NULL,
    "upheld_report_count" integer DEFAULT 0 NOT NULL,
    "last_reviewed_at" timestamp with time zone,
    "manually_assigned" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_member_reputation_tier_check" CHECK (("tier" = ANY (ARRAY['new'::"text", 'member'::"text", 'trusted_contributor'::"text", 'community_contributor'::"text", 'moderator'::"text"])))
);


ALTER TABLE "public"."community_member_reputation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "moderator_user_id" "uuid" NOT NULL,
    "reason_code" "text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['approve'::"text", 'flag'::"text", 'hide'::"text", 'remove'::"text", 'restore'::"text", 'resolve_reports'::"text"])))
);


ALTER TABLE "public"."community_moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_moderators" (
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."community_moderators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_recipe_hides" (
    "recipe_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_recipe_hides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_recipe_reactions" (
    "recipe_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" DEFAULT 'helpful'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_recipe_reactions_reaction_type_check" CHECK (("reaction_type" = 'helpful'::"text"))
);


ALTER TABLE "public"."community_recipe_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_recipe_saves" (
    "recipe_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_recipe_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "reason_code" "text" NOT NULL,
    "optional_note" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "community_reports_optional_note_check" CHECK (("length"("optional_note") <= 500)),
    CONSTRAINT "community_reports_reason_code_check" CHECK (("reason_code" = ANY (ARRAY['Food-safety concern'::"text", 'Medical misinformation'::"text", 'Personal information'::"text", 'Bullying or harassment'::"text", 'Inappropriate content'::"text", 'Spam or advertising'::"text", 'Other'::"text"]))),
    CONSTRAINT "community_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."community_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."explore_nutrition_content" (
    "content_id" "text" NOT NULL,
    "parent_id" "text",
    "kind" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "title" "text" NOT NULL,
    "educational_state" "text",
    "body" "jsonb" NOT NULL,
    "source_metadata" "jsonb" NOT NULL,
    "review_status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "explore_nutrition_content_body_check" CHECK (("jsonb_typeof"("body") = 'object'::"text")),
    CONSTRAINT "explore_nutrition_content_check" CHECK (((("kind" = 'HUB'::"text") AND ("parent_id" IS NULL) AND ("educational_state" IS NULL)) OR (("kind" = 'SECTION'::"text") AND ("parent_id" IS NOT NULL)))),
    CONSTRAINT "explore_nutrition_content_educational_state_check" CHECK (("educational_state" = ANY (ARRAY['NATURALLY_GF'::"text", 'CHECK_DETAILS'::"text", 'CONTAINS_GLUTEN'::"text"]))),
    CONSTRAINT "explore_nutrition_content_kind_check" CHECK (("kind" = ANY (ARRAY['HUB'::"text", 'SECTION'::"text"]))),
    CONSTRAINT "explore_nutrition_content_review_status_check" CHECK (("review_status" = ANY (ARRAY['DRAFT'::"text", 'IN_REVIEW'::"text", 'APPROVED'::"text", 'ARCHIVED'::"text"]))),
    CONSTRAINT "explore_nutrition_content_sort_order_check" CHECK (("sort_order" >= 0)),
    CONSTRAINT "explore_nutrition_content_source_metadata_check" CHECK (("jsonb_typeof"("source_metadata") = 'object'::"text")),
    CONSTRAINT "explore_nutrition_content_title_check" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."explore_nutrition_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."explore_nutrition_content" IS 'Plan My C-Day in-app nutrition education. Separate from external expert resources and Community. No completion/XP behavior.';



CREATE TABLE IF NOT EXISTS "public"."home_inspiration_messages" (
    "message_id" "text" NOT NULL,
    "message_text" "text" NOT NULL,
    "theme" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "trigger_key" "text",
    "source_basis" "jsonb" NOT NULL,
    "review_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "expert_reviewed" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "content_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "home_inspiration_messages_check" CHECK (((("message_type" = 'DAILY_GENERAL'::"text") AND ("trigger_key" IS NULL)) OR (("message_type" = 'CONTEXTUAL'::"text") AND ("trigger_key" IS NOT NULL) AND ("trigger_key" = ANY (ARRAY['UPCOMING_CDAY'::"text", 'HARD_ACTION_DONE'::"text", 'ACTION_RESCHEDULED'::"text", 'NO_UPCOMING_CDAY'::"text", 'ACTION_NOT_NEEDED'::"text", 'EXPLORE_COMPLETED'::"text", 'PLAN_FINALIZED'::"text", 'SUPPORT_USED'::"text"]))))),
    CONSTRAINT "home_inspiration_messages_message_text_check" CHECK (("length"(TRIM(BOTH FROM "message_text")) > 0)),
    CONSTRAINT "home_inspiration_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['DAILY_GENERAL'::"text", 'CONTEXTUAL'::"text"]))),
    CONSTRAINT "home_inspiration_messages_review_status_check" CHECK (("review_status" = ANY (ARRAY['approved'::"text", 'needs_review'::"text", 'hidden'::"text"]))),
    CONSTRAINT "home_inspiration_messages_source_basis_check" CHECK (("jsonb_typeof"("source_basis") = 'array'::"text")),
    CONSTRAINT "home_inspiration_messages_theme_check" CHECK (("theme" = ANY (ARRAY['CONFIDENCE'::"text", 'SMALL_STEPS'::"text", 'SELF_TRUST'::"text", 'CONNECTION'::"text", 'FLEXIBILITY'::"text", 'LIFE_BEYOND_CELIAC'::"text"])))
);


ALTER TABLE "public"."home_inspiration_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."home_inspiration_messages" IS 'Original Plan My C-Day inspiration. source_basis describes supporting themes, not message authorship. No XP or Community content.';



CREATE TABLE IF NOT EXISTS "public"."rlc_adventures" (
    "content_id" "uuid" NOT NULL,
    "challenge_id" "text" NOT NULL,
    "adventure_version" "text" NOT NULL,
    "branching_enabled" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "review_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "expert_review_required" boolean DEFAULT true NOT NULL,
    "expert_reviewed" boolean DEFAULT false NOT NULL,
    "medical_review_required" boolean DEFAULT false NOT NULL,
    "medical_reviewed" boolean DEFAULT false NOT NULL,
    "source_document" "text" NOT NULL,
    "content_origin" "text" NOT NULL,
    "original_review_metadata" "jsonb" NOT NULL,
    "graph" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rlc_adventures_graph_check" CHECK (("jsonb_typeof"("graph") = 'object'::"text")),
    CONSTRAINT "rlc_adventures_review_status_check" CHECK (("review_status" = ANY (ARRAY['approved'::"text", 'needs_review'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."rlc_adventures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_library"
    ADD CONSTRAINT "action_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."c_day_actions"
    ADD CONSTRAINT "c_day_actions_c_day_event_id_action_library_id_key" UNIQUE ("c_day_event_id", "action_library_id");



ALTER TABLE ONLY "public"."c_day_actions"
    ADD CONSTRAINT "c_day_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."c_day_events"
    ADD CONSTRAINT "c_day_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."c_day_reflection_tags"
    ADD CONSTRAINT "c_day_reflection_tags_c_day_event_id_tag_key" UNIQUE ("c_day_event_id", "tag");



ALTER TABLE ONLY "public"."c_day_reflection_tags"
    ADD CONSTRAINT "c_day_reflection_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_member_reputation"
    ADD CONSTRAINT "community_member_reputation_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."community_moderation_actions"
    ADD CONSTRAINT "community_moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_moderators"
    ADD CONSTRAINT "community_moderators_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."community_recipe_hides"
    ADD CONSTRAINT "community_recipe_hides_pkey" PRIMARY KEY ("recipe_id", "user_id");



ALTER TABLE ONLY "public"."community_recipe_reactions"
    ADD CONSTRAINT "community_recipe_reactions_pkey" PRIMARY KEY ("recipe_id", "user_id", "reaction_type");



ALTER TABLE ONLY "public"."community_recipe_saves"
    ADD CONSTRAINT "community_recipe_saves_pkey" PRIMARY KEY ("recipe_id", "user_id");



ALTER TABLE ONLY "public"."community_recipes"
    ADD CONSTRAINT "community_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_recipe_id_reporter_user_id_key" UNIQUE ("recipe_id", "reporter_user_id");



ALTER TABLE ONLY "public"."explore_content"
    ADD CONSTRAINT "explore_content_pkey" PRIMARY KEY ("content_id");



ALTER TABLE ONLY "public"."explore_nutrition_content"
    ADD CONSTRAINT "explore_nutrition_content_pkey" PRIMARY KEY ("content_id");



ALTER TABLE ONLY "public"."home_inspiration_messages"
    ADD CONSTRAINT "home_inspiration_messages_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."rlc_adventures"
    ADD CONSTRAINT "rlc_adventures_challenge_id_key" UNIQUE ("challenge_id");



ALTER TABLE ONLY "public"."rlc_adventures"
    ADD CONSTRAINT "rlc_adventures_pkey" PRIMARY KEY ("content_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "c_day_actions_event_schedule" ON "public"."c_day_actions" USING "btree" ("c_day_event_id", "scheduled_at");



CREATE INDEX "c_day_events_owner_date" ON "public"."c_day_events" USING "btree" ("user_id", "status", "event_start_at");



CREATE INDEX "community_recipe_author_idx" ON "public"."community_recipes" USING "btree" ("author_user_id", "updated_at");



CREATE INDEX "community_recipe_status_idx" ON "public"."community_recipes" USING "btree" ("status", "submitted_at");



CREATE INDEX "explore_content_active_idx" ON "public"."explore_content" USING "btree" ("active");



CREATE INDEX "explore_content_domain_idx" ON "public"."explore_content" USING "btree" ("domain");



CREATE INDEX "explore_content_interaction_type_idx" ON "public"."explore_content" USING "btree" ("interaction_type");



CREATE INDEX "explore_content_topic_idx" ON "public"."explore_content" USING "btree" ("topic");



CREATE INDEX "explore_content_type_active_idx" ON "public"."explore_content" USING "btree" ("content_type", "active");



CREATE INDEX "explore_content_type_idx" ON "public"."explore_content" USING "btree" ("content_type");



CREATE OR REPLACE TRIGGER "c_day_action_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."c_day_actions" FOR EACH ROW EXECUTE FUNCTION "public"."guard_c_day_action"();



CREATE OR REPLACE TRIGGER "c_day_event_guard" BEFORE INSERT OR UPDATE ON "public"."c_day_events" FOR EACH ROW EXECUTE FUNCTION "public"."guard_c_day_event"();



CREATE OR REPLACE TRIGGER "guard_c_day_reflection_tag" BEFORE INSERT OR DELETE OR UPDATE ON "public"."c_day_reflection_tags" FOR EACH ROW EXECUTE FUNCTION "public"."guard_c_day_reflection_tag"();



CREATE OR REPLACE TRIGGER "home_inspiration_updated_at" BEFORE UPDATE ON "public"."home_inspiration_messages" FOR EACH ROW EXECUTE FUNCTION "public"."home_inspiration_touch_updated_at"();



CREATE OR REPLACE TRIGGER "protect_completed_c_day" BEFORE DELETE ON "public"."c_day_events" FOR EACH ROW EXECUTE FUNCTION "public"."protect_completed_c_day"();



CREATE OR REPLACE TRIGGER "set_explore_content_updated_at" BEFORE UPDATE ON "public"."explore_content" FOR EACH ROW EXECUTE FUNCTION "public"."set_explore_content_updated_at"();



ALTER TABLE ONLY "public"."c_day_actions"
    ADD CONSTRAINT "c_day_actions_action_library_id_fkey" FOREIGN KEY ("action_library_id") REFERENCES "public"."action_library"("id");



ALTER TABLE ONLY "public"."c_day_actions"
    ADD CONSTRAINT "c_day_actions_c_day_event_id_fkey" FOREIGN KEY ("c_day_event_id") REFERENCES "public"."c_day_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."c_day_events"
    ADD CONSTRAINT "c_day_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."c_day_reflection_tags"
    ADD CONSTRAINT "c_day_reflection_tags_c_day_event_id_fkey" FOREIGN KEY ("c_day_event_id") REFERENCES "public"."c_day_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_member_reputation"
    ADD CONSTRAINT "community_member_reputation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_moderation_actions"
    ADD CONSTRAINT "community_moderation_actions_moderator_user_id_fkey" FOREIGN KEY ("moderator_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_moderation_actions"
    ADD CONSTRAINT "community_moderation_actions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."community_recipes"("id");



ALTER TABLE ONLY "public"."community_moderators"
    ADD CONSTRAINT "community_moderators_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_moderators"
    ADD CONSTRAINT "community_moderators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_recipe_hides"
    ADD CONSTRAINT "community_recipe_hides_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."community_recipes"("id");



ALTER TABLE ONLY "public"."community_recipe_hides"
    ADD CONSTRAINT "community_recipe_hides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_recipe_reactions"
    ADD CONSTRAINT "community_recipe_reactions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."community_recipes"("id");



ALTER TABLE ONLY "public"."community_recipe_reactions"
    ADD CONSTRAINT "community_recipe_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_recipe_saves"
    ADD CONSTRAINT "community_recipe_saves_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."community_recipes"("id");



ALTER TABLE ONLY "public"."community_recipe_saves"
    ADD CONSTRAINT "community_recipe_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_recipes"
    ADD CONSTRAINT "community_recipes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."community_recipes"("id");



ALTER TABLE ONLY "public"."community_reports"
    ADD CONSTRAINT "community_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."explore_nutrition_content"
    ADD CONSTRAINT "explore_nutrition_content_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."explore_nutrition_content"("content_id");



ALTER TABLE ONLY "public"."rlc_adventures"
    ADD CONSTRAINT "rlc_adventures_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."explore_content"("content_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Explore content is publicly readable" ON "public"."explore_content" FOR SELECT USING (("active" = true));



CREATE POLICY "Read approved nutrition education" ON "public"."explore_nutrition_content" FOR SELECT TO "authenticated", "anon" USING (("active" AND ("review_status" = 'APPROVED'::"text")));



CREATE POLICY "Users can read their own record" ON "public"."users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own name" ON "public"."users" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."action_library" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_library_read" ON "public"."action_library" FOR SELECT TO "authenticated" USING (("active" AND ("review_status" = 'approved'::"text")));



ALTER TABLE "public"."c_day_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "c_day_actions_owner" ON "public"."c_day_actions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."c_day_events" "e"
  WHERE (("e"."id" = "c_day_actions"."c_day_event_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."c_day_events" "e"
  WHERE (("e"."id" = "c_day_actions"."c_day_event_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."c_day_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "c_day_events_owner" ON "public"."c_day_events" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."c_day_reflection_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "c_day_reflection_tags_owner" ON "public"."c_day_reflection_tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."c_day_events" "e"
  WHERE (("e"."id" = "c_day_reflection_tags"."c_day_event_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."c_day_events" "e"
  WHERE (("e"."id" = "c_day_reflection_tags"."c_day_event_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."community_member_reputation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_moderation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_moderators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_recipe_hides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_recipe_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_recipe_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."explore_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."explore_nutrition_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_inspiration_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inspiration_approved_read" ON "public"."home_inspiration_messages" FOR SELECT TO "authenticated", "anon" USING (("active" AND ("review_status" = 'approved'::"text")));



ALTER TABLE "public"."rlc_adventures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rlc_adventures_published" ON "public"."rlc_adventures" FOR SELECT TO "authenticated" USING (("active" AND "branching_enabled" AND ("review_status" = 'approved'::"text") AND ((NOT "expert_review_required") OR "expert_reviewed") AND ((NOT "medical_review_required") OR "medical_reviewed") AND (EXISTS ( SELECT 1
   FROM "public"."explore_content" "e"
  WHERE (("e"."content_id" = "rlc_adventures"."content_id") AND ("e"."content_type" = 'REAL_LIFE_CHALLENGE'::"text") AND (("e"."content_body" ->> 'challenge_id'::"text") = "rlc_adventures"."challenge_id") AND "e"."active" AND ("e"."review_status" = 'APPROVED'::"text") AND ("e"."source_type" <> 'COMMUNITY'::"text") AND ((NOT "e"."medical_review_required") OR (NULLIF("btrim"("e"."expert_reviewer"), ''::"text") IS NOT NULL)))))));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."community_interact"("p_id" "uuid", "p_action" "text", "p_enabled" boolean, "p_reason" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_interact"("p_id" "uuid", "p_action" "text", "p_enabled" boolean, "p_reason" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."community_interact"("p_id" "uuid", "p_action" "text", "p_enabled" boolean, "p_reason" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."community_is_moderator"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_is_moderator"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."community_moderate"("p_id" "uuid", "p_action" "text", "p_reason" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_moderate"("p_id" "uuid", "p_action" "text", "p_reason" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."community_moderate"("p_id" "uuid", "p_action" "text", "p_reason" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."community_read"("p_mode" "text", "p_id" "uuid", "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_read"("p_mode" "text", "p_id" "uuid", "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."community_read"("p_mode" "text", "p_id" "uuid", "p_offset" integer) TO "authenticated";



GRANT ALL ON TABLE "public"."community_recipes" TO "service_role";



REVOKE ALL ON FUNCTION "public"."community_recipe_json"("r" "public"."community_recipes") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_recipe_json"("r" "public"."community_recipes") TO "service_role";



REVOKE ALL ON FUNCTION "public"."community_save_draft"("p_id" "uuid", "p_data" "jsonb", "p_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_save_draft"("p_id" "uuid", "p_data" "jsonb", "p_revision" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."community_save_draft"("p_id" "uuid", "p_data" "jsonb", "p_revision" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."community_submit"("p_id" "uuid", "p_revision" integer, "p_ack" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_submit"("p_id" "uuid", "p_revision" integer, "p_ack" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."community_submit"("p_id" "uuid", "p_revision" integer, "p_ack" "jsonb") TO "authenticated";



GRANT ALL ON TABLE "public"."c_day_events" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."c_day_events" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[], "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[], "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[], "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_c_day"("p_event_id" "uuid", "p_rating" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_c_day"("p_event_id" "uuid", "p_rating" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_c_day"("p_event_id" "uuid", "p_rating" smallint) TO "service_role";



GRANT ALL ON TABLE "public"."c_day_actions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."c_day_actions" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."follow_through_c_day_action"("p_action_id" "uuid", "p_choice" "text", "p_scheduled_at" timestamp with time zone, "p_schedule_value" integer, "p_schedule_unit" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."follow_through_c_day_action"("p_action_id" "uuid", "p_choice" "text", "p_scheduled_at" timestamp with time zone, "p_schedule_value" integer, "p_schedule_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."follow_through_c_day_action"("p_action_id" "uuid", "p_choice" "text", "p_scheduled_at" timestamp with time zone, "p_schedule_value" integer, "p_schedule_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_c_day_action"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_c_day_action"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_c_day_action"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_c_day_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_c_day_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_c_day_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_c_day_reflection_tag"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_c_day_reflection_tag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_c_day_reflection_tag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."home_inspiration_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."home_inspiration_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_inspiration_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_completed_c_day"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_completed_c_day"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_completed_c_day"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_explore_content_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_explore_content_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_explore_content_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_app_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_app_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."action_library" TO "service_role";
GRANT SELECT ON TABLE "public"."action_library" TO "authenticated";



GRANT ALL ON TABLE "public"."explore_content" TO "anon";
GRANT ALL ON TABLE "public"."explore_content" TO "authenticated";
GRANT ALL ON TABLE "public"."explore_content" TO "service_role";



GRANT ALL ON TABLE "public"."active_explore_content" TO "anon";
GRANT ALL ON TABLE "public"."active_explore_content" TO "authenticated";
GRANT ALL ON TABLE "public"."active_explore_content" TO "service_role";



GRANT ALL ON TABLE "public"."c_day_reflection_tags" TO "anon";
GRANT ALL ON TABLE "public"."c_day_reflection_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."c_day_reflection_tags" TO "service_role";



GRANT ALL ON TABLE "public"."community_member_reputation" TO "service_role";



GRANT ALL ON TABLE "public"."community_moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."community_moderators" TO "service_role";



GRANT ALL ON TABLE "public"."community_recipe_hides" TO "service_role";



GRANT ALL ON TABLE "public"."community_recipe_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."community_recipe_saves" TO "service_role";



GRANT ALL ON TABLE "public"."community_reports" TO "service_role";



GRANT ALL ON TABLE "public"."explore_nutrition_content" TO "service_role";
GRANT SELECT ON TABLE "public"."explore_nutrition_content" TO "anon";
GRANT SELECT ON TABLE "public"."explore_nutrition_content" TO "authenticated";



GRANT ALL ON TABLE "public"."home_inspiration_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."home_inspiration_messages" TO "anon";
GRANT SELECT ON TABLE "public"."home_inspiration_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."rlc_adventures" TO "service_role";
GRANT SELECT ON TABLE "public"."rlc_adventures" TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("first_name") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("last_name") ON TABLE "public"."users" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "Read approved nutrition education" on "public"."explore_nutrition_content";

drop policy "inspiration_approved_read" on "public"."home_inspiration_messages";

revoke delete on table "public"."action_library" from "anon";

revoke insert on table "public"."action_library" from "anon";

revoke references on table "public"."action_library" from "anon";

revoke select on table "public"."action_library" from "anon";

revoke trigger on table "public"."action_library" from "anon";

revoke truncate on table "public"."action_library" from "anon";

revoke update on table "public"."action_library" from "anon";

revoke delete on table "public"."action_library" from "authenticated";

revoke insert on table "public"."action_library" from "authenticated";

revoke references on table "public"."action_library" from "authenticated";

revoke trigger on table "public"."action_library" from "authenticated";

revoke truncate on table "public"."action_library" from "authenticated";

revoke update on table "public"."action_library" from "authenticated";

revoke delete on table "public"."c_day_actions" from "anon";

revoke insert on table "public"."c_day_actions" from "anon";

revoke references on table "public"."c_day_actions" from "anon";

revoke select on table "public"."c_day_actions" from "anon";

revoke trigger on table "public"."c_day_actions" from "anon";

revoke truncate on table "public"."c_day_actions" from "anon";

revoke update on table "public"."c_day_actions" from "anon";

revoke references on table "public"."c_day_actions" from "authenticated";

revoke trigger on table "public"."c_day_actions" from "authenticated";

revoke truncate on table "public"."c_day_actions" from "authenticated";

revoke delete on table "public"."c_day_events" from "anon";

revoke insert on table "public"."c_day_events" from "anon";

revoke references on table "public"."c_day_events" from "anon";

revoke select on table "public"."c_day_events" from "anon";

revoke trigger on table "public"."c_day_events" from "anon";

revoke truncate on table "public"."c_day_events" from "anon";

revoke update on table "public"."c_day_events" from "anon";

revoke delete on table "public"."c_day_events" from "authenticated";

revoke references on table "public"."c_day_events" from "authenticated";

revoke trigger on table "public"."c_day_events" from "authenticated";

revoke truncate on table "public"."c_day_events" from "authenticated";

revoke delete on table "public"."community_member_reputation" from "anon";

revoke insert on table "public"."community_member_reputation" from "anon";

revoke references on table "public"."community_member_reputation" from "anon";

revoke select on table "public"."community_member_reputation" from "anon";

revoke trigger on table "public"."community_member_reputation" from "anon";

revoke truncate on table "public"."community_member_reputation" from "anon";

revoke update on table "public"."community_member_reputation" from "anon";

revoke delete on table "public"."community_member_reputation" from "authenticated";

revoke insert on table "public"."community_member_reputation" from "authenticated";

revoke references on table "public"."community_member_reputation" from "authenticated";

revoke select on table "public"."community_member_reputation" from "authenticated";

revoke trigger on table "public"."community_member_reputation" from "authenticated";

revoke truncate on table "public"."community_member_reputation" from "authenticated";

revoke update on table "public"."community_member_reputation" from "authenticated";

revoke delete on table "public"."community_moderation_actions" from "anon";

revoke insert on table "public"."community_moderation_actions" from "anon";

revoke references on table "public"."community_moderation_actions" from "anon";

revoke select on table "public"."community_moderation_actions" from "anon";

revoke trigger on table "public"."community_moderation_actions" from "anon";

revoke truncate on table "public"."community_moderation_actions" from "anon";

revoke update on table "public"."community_moderation_actions" from "anon";

revoke delete on table "public"."community_moderation_actions" from "authenticated";

revoke insert on table "public"."community_moderation_actions" from "authenticated";

revoke references on table "public"."community_moderation_actions" from "authenticated";

revoke select on table "public"."community_moderation_actions" from "authenticated";

revoke trigger on table "public"."community_moderation_actions" from "authenticated";

revoke truncate on table "public"."community_moderation_actions" from "authenticated";

revoke update on table "public"."community_moderation_actions" from "authenticated";

revoke delete on table "public"."community_moderators" from "anon";

revoke insert on table "public"."community_moderators" from "anon";

revoke references on table "public"."community_moderators" from "anon";

revoke select on table "public"."community_moderators" from "anon";

revoke trigger on table "public"."community_moderators" from "anon";

revoke truncate on table "public"."community_moderators" from "anon";

revoke update on table "public"."community_moderators" from "anon";

revoke delete on table "public"."community_moderators" from "authenticated";

revoke insert on table "public"."community_moderators" from "authenticated";

revoke references on table "public"."community_moderators" from "authenticated";

revoke select on table "public"."community_moderators" from "authenticated";

revoke trigger on table "public"."community_moderators" from "authenticated";

revoke truncate on table "public"."community_moderators" from "authenticated";

revoke update on table "public"."community_moderators" from "authenticated";

revoke delete on table "public"."community_recipe_hides" from "anon";

revoke insert on table "public"."community_recipe_hides" from "anon";

revoke references on table "public"."community_recipe_hides" from "anon";

revoke select on table "public"."community_recipe_hides" from "anon";

revoke trigger on table "public"."community_recipe_hides" from "anon";

revoke truncate on table "public"."community_recipe_hides" from "anon";

revoke update on table "public"."community_recipe_hides" from "anon";

revoke delete on table "public"."community_recipe_hides" from "authenticated";

revoke insert on table "public"."community_recipe_hides" from "authenticated";

revoke references on table "public"."community_recipe_hides" from "authenticated";

revoke select on table "public"."community_recipe_hides" from "authenticated";

revoke trigger on table "public"."community_recipe_hides" from "authenticated";

revoke truncate on table "public"."community_recipe_hides" from "authenticated";

revoke update on table "public"."community_recipe_hides" from "authenticated";

revoke delete on table "public"."community_recipe_reactions" from "anon";

revoke insert on table "public"."community_recipe_reactions" from "anon";

revoke references on table "public"."community_recipe_reactions" from "anon";

revoke select on table "public"."community_recipe_reactions" from "anon";

revoke trigger on table "public"."community_recipe_reactions" from "anon";

revoke truncate on table "public"."community_recipe_reactions" from "anon";

revoke update on table "public"."community_recipe_reactions" from "anon";

revoke delete on table "public"."community_recipe_reactions" from "authenticated";

revoke insert on table "public"."community_recipe_reactions" from "authenticated";

revoke references on table "public"."community_recipe_reactions" from "authenticated";

revoke select on table "public"."community_recipe_reactions" from "authenticated";

revoke trigger on table "public"."community_recipe_reactions" from "authenticated";

revoke truncate on table "public"."community_recipe_reactions" from "authenticated";

revoke update on table "public"."community_recipe_reactions" from "authenticated";

revoke delete on table "public"."community_recipe_saves" from "anon";

revoke insert on table "public"."community_recipe_saves" from "anon";

revoke references on table "public"."community_recipe_saves" from "anon";

revoke select on table "public"."community_recipe_saves" from "anon";

revoke trigger on table "public"."community_recipe_saves" from "anon";

revoke truncate on table "public"."community_recipe_saves" from "anon";

revoke update on table "public"."community_recipe_saves" from "anon";

revoke delete on table "public"."community_recipe_saves" from "authenticated";

revoke insert on table "public"."community_recipe_saves" from "authenticated";

revoke references on table "public"."community_recipe_saves" from "authenticated";

revoke select on table "public"."community_recipe_saves" from "authenticated";

revoke trigger on table "public"."community_recipe_saves" from "authenticated";

revoke truncate on table "public"."community_recipe_saves" from "authenticated";

revoke update on table "public"."community_recipe_saves" from "authenticated";

revoke delete on table "public"."community_recipes" from "anon";

revoke insert on table "public"."community_recipes" from "anon";

revoke references on table "public"."community_recipes" from "anon";

revoke select on table "public"."community_recipes" from "anon";

revoke trigger on table "public"."community_recipes" from "anon";

revoke truncate on table "public"."community_recipes" from "anon";

revoke update on table "public"."community_recipes" from "anon";

revoke delete on table "public"."community_recipes" from "authenticated";

revoke insert on table "public"."community_recipes" from "authenticated";

revoke references on table "public"."community_recipes" from "authenticated";

revoke select on table "public"."community_recipes" from "authenticated";

revoke trigger on table "public"."community_recipes" from "authenticated";

revoke truncate on table "public"."community_recipes" from "authenticated";

revoke update on table "public"."community_recipes" from "authenticated";

revoke delete on table "public"."community_reports" from "anon";

revoke insert on table "public"."community_reports" from "anon";

revoke references on table "public"."community_reports" from "anon";

revoke select on table "public"."community_reports" from "anon";

revoke trigger on table "public"."community_reports" from "anon";

revoke truncate on table "public"."community_reports" from "anon";

revoke update on table "public"."community_reports" from "anon";

revoke delete on table "public"."community_reports" from "authenticated";

revoke insert on table "public"."community_reports" from "authenticated";

revoke references on table "public"."community_reports" from "authenticated";

revoke select on table "public"."community_reports" from "authenticated";

revoke trigger on table "public"."community_reports" from "authenticated";

revoke truncate on table "public"."community_reports" from "authenticated";

revoke update on table "public"."community_reports" from "authenticated";

revoke delete on table "public"."explore_nutrition_content" from "anon";

revoke insert on table "public"."explore_nutrition_content" from "anon";

revoke references on table "public"."explore_nutrition_content" from "anon";

revoke trigger on table "public"."explore_nutrition_content" from "anon";

revoke truncate on table "public"."explore_nutrition_content" from "anon";

revoke update on table "public"."explore_nutrition_content" from "anon";

revoke delete on table "public"."explore_nutrition_content" from "authenticated";

revoke insert on table "public"."explore_nutrition_content" from "authenticated";

revoke references on table "public"."explore_nutrition_content" from "authenticated";

revoke trigger on table "public"."explore_nutrition_content" from "authenticated";

revoke truncate on table "public"."explore_nutrition_content" from "authenticated";

revoke update on table "public"."explore_nutrition_content" from "authenticated";

revoke delete on table "public"."home_inspiration_messages" from "anon";

revoke insert on table "public"."home_inspiration_messages" from "anon";

revoke references on table "public"."home_inspiration_messages" from "anon";

revoke trigger on table "public"."home_inspiration_messages" from "anon";

revoke truncate on table "public"."home_inspiration_messages" from "anon";

revoke update on table "public"."home_inspiration_messages" from "anon";

revoke delete on table "public"."home_inspiration_messages" from "authenticated";

revoke insert on table "public"."home_inspiration_messages" from "authenticated";

revoke references on table "public"."home_inspiration_messages" from "authenticated";

revoke trigger on table "public"."home_inspiration_messages" from "authenticated";

revoke truncate on table "public"."home_inspiration_messages" from "authenticated";

revoke update on table "public"."home_inspiration_messages" from "authenticated";

revoke delete on table "public"."rlc_adventures" from "anon";

revoke insert on table "public"."rlc_adventures" from "anon";

revoke references on table "public"."rlc_adventures" from "anon";

revoke select on table "public"."rlc_adventures" from "anon";

revoke trigger on table "public"."rlc_adventures" from "anon";

revoke truncate on table "public"."rlc_adventures" from "anon";

revoke update on table "public"."rlc_adventures" from "anon";

revoke delete on table "public"."rlc_adventures" from "authenticated";

revoke insert on table "public"."rlc_adventures" from "authenticated";

revoke references on table "public"."rlc_adventures" from "authenticated";

revoke trigger on table "public"."rlc_adventures" from "authenticated";

revoke truncate on table "public"."rlc_adventures" from "authenticated";

revoke update on table "public"."rlc_adventures" from "authenticated";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";


  create policy "Read approved nutrition education"
  on "public"."explore_nutrition_content"
  as permissive
  for select
  to anon, authenticated
using ((active AND (review_status = 'APPROVED'::text)));



  create policy "inspiration_approved_read"
  on "public"."home_inspiration_messages"
  as permissive
  for select
  to anon, authenticated
using ((active AND (review_status = 'approved'::text)));


CREATE TRIGGER sync_app_user AFTER INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_app_user();


