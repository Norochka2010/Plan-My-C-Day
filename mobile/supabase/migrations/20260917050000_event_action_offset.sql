-- Permit an action to start up to 15 minutes into the event. Calendar duration remains 15 minutes.
DO $$
DECLARE f record; definition text; updated text;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('follow_through_c_day_action','guard_c_day_event','guard_c_day_action')
 LOOP
  definition := pg_get_functiondef(f.oid);
  updated := regexp_replace(definition, '(scheduled_at\s*>\s*)(parent|new)\.event_start_at', '\1(\2.event_start_at + interval ''15 minutes'')', 'g');
  IF updated = definition THEN RAISE EXCEPTION 'Expected scheduling check not found in %', f.oid::regprocedure; END IF;
  updated := replace(updated, 'no later than your C-Day', 'no later than 15 minutes after your C-Day starts');
  updated := replace(updated, 'no later than the C-Day', 'no later than 15 minutes after the C-Day starts');
  EXECUTE updated;
 END LOOP;
END $$;
