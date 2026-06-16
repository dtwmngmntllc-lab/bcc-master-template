-- =========================================================================
-- MIGRATION 011 — Automation Runner
-- =========================================================================
-- This migration adds the engine that drives the automation_recipes table.
-- Recipes live in Supabase (defined in 001). pg_cron schedules the tick.
-- The tick function calls the automation-runner Edge Function for each
-- due recipe. The Edge Function executes the Composio call and writes
-- results back to Supabase.
--
-- ARCHITECTURE:
--   pg_cron (every minute)
--     -> run_due_automation_recipes()         (this migration)
--        -> for each due recipe:
--           net.http_post -> automation-runner Edge Function
--             -> Composio backend.composio.dev/api/v3/tools/execute
--             -> writes results to recipe.output_table
--             -> writes to automation_run_log
--             -> updates recipe.last_run_at + last_run_status
--
-- This pattern matches the proven cron+Edge Function pattern in the
-- Imaginary Farms ops project (linkedin-poster, gmail-inbox-archiver,
-- 16 other production recipes). The credential storage is adapted from
-- the ops project's brand_kit table to the master template's settings
-- table (key/value, agency-scoped).
-- =========================================================================

-- DEPENDENCIES (must already exist):
--   - automation_recipes table (migration 001)
--   - automation_run_log table (migration 001)
--   - agency table (migration 001)
--   - settings table (migration 001) with agency_id-scoped key/value rows
--   - pg_net extension  (NOT pre-enabled on fresh Supabase projects;
--                        the project owner must run CREATE EXTENSION pg_net;
--                        before applying this migration. This file does it
--                        for you via CREATE EXTENSION IF NOT EXISTS below.)
--   - pg_cron extension (project owner enables in Supabase Studio)
--   - automation-runner Edge Function deployed in the same project
--
-- CREDENTIAL STORAGE:
--   All runner credentials are stored as rows in the public.settings table.
--   Each row is scoped to a single agency_id (the agency that owns the BCC).
--   Required keys:
--     automation_runner_cron_secret  - random 64-char hex string
--     supabase_url                   - this project's https URL
--     composio_api_key               - Composio API key
--     composio_user_id               - Composio user ID for this agency
--     composio_<conn>_account_id     - one per Composio connection used
--                                      (e.g. composio_gmail_account_id)
--     (no separate LLM key needed — runner uses COMPOSIO_SEARCH_GROQ_CHAT via composio_api_key)
--     telegram_bot_token             - OPTIONAL; failure alerts only
--     telegram_chat_id               - OPTIONAL; failure alerts only
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================================
-- get_setting(agency_id, setting_key) — typed helper for credential lookup
-- =========================================================================
-- Returns NULL if the row doesn't exist. Used by run_automation_recipe
-- below to resolve the supabase_url and shared secret. Recipes themselves
-- read settings via the Edge Function (TypeScript getSetting helper).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_setting(
  p_agency_id UUID,
  p_setting_key TEXT
) RETURNS TEXT
LANGUAGE sql
STABLE
AS $func$
  SELECT setting_value
  FROM public.settings
  WHERE agency_id = p_agency_id
    AND setting_key = p_setting_key
  LIMIT 1;
$func$;


-- Helper: cron expression matcher.
-- Returns TRUE if the given cron expression should fire at the given timestamp.
-- Supports: literal numbers, *, */N, A-B ranges, comma-separated lists.
-- Does NOT support: @yearly/@monthly/etc shortcuts, day-name literals.
-- This covers all 12 canonical recipe schedules.
CREATE OR REPLACE FUNCTION public.cron_expression_matches(
  p_cron TEXT,
  p_at   TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v_parts        TEXT[];
  v_minute_part  TEXT;
  v_hour_part    TEXT;
  v_dom_part     TEXT;
  v_month_part   TEXT;
  v_dow_part     TEXT;
  v_at           TIMESTAMPTZ := date_trunc('minute', p_at);
  v_minute       INT := EXTRACT(MINUTE FROM v_at)::INT;
  v_hour         INT := EXTRACT(HOUR FROM v_at)::INT;
  v_dom          INT := EXTRACT(DAY FROM v_at)::INT;
  v_month        INT := EXTRACT(MONTH FROM v_at)::INT;
  v_dow          INT := EXTRACT(DOW FROM v_at)::INT;  -- 0=Sun..6=Sat
BEGIN
  v_parts := regexp_split_to_array(trim(p_cron), '\s+');
  IF array_length(v_parts, 1) <> 5 THEN
    RETURN FALSE;
  END IF;

  v_minute_part := v_parts[1];
  v_hour_part   := v_parts[2];
  v_dom_part    := v_parts[3];
  v_month_part  := v_parts[4];
  v_dow_part    := v_parts[5];

  RETURN
    public.cron_field_matches(v_minute_part, v_minute, 0,  59) AND
    public.cron_field_matches(v_hour_part,   v_hour,   0,  23) AND
    public.cron_field_matches(v_dom_part,    v_dom,    1,  31) AND
    public.cron_field_matches(v_month_part,  v_month,  1,  12) AND
    public.cron_field_matches(v_dow_part,    v_dow,    0,   6);
END;
$func$;

-- Helper: single cron field matcher.
CREATE OR REPLACE FUNCTION public.cron_field_matches(
  p_field    TEXT,
  p_value    INT,
  p_min      INT,
  p_max      INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v_token   TEXT;
  v_step    INT;
  v_lo      INT;
  v_hi      INT;
  v_n       INT;
  v_token_main TEXT;
BEGIN
  -- Comma-separated list: any token matching wins
  IF position(',' IN p_field) > 0 THEN
    FOREACH v_token IN ARRAY string_to_array(p_field, ',') LOOP
      IF public.cron_field_matches(trim(v_token), p_value, p_min, p_max) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
    RETURN FALSE;
  END IF;

  -- Step (e.g. */5  or  0-30/10)
  IF position('/' IN p_field) > 0 THEN
    v_token_main := split_part(p_field, '/', 1);
    v_step := split_part(p_field, '/', 2)::INT;
    IF v_token_main = '*' THEN
      v_lo := p_min;
      v_hi := p_max;
    ELSIF position('-' IN v_token_main) > 0 THEN
      v_lo := split_part(v_token_main, '-', 1)::INT;
      v_hi := split_part(v_token_main, '-', 2)::INT;
    ELSE
      v_lo := v_token_main::INT;
      v_hi := p_max;
    END IF;
    RETURN p_value BETWEEN v_lo AND v_hi
       AND ((p_value - v_lo) % v_step) = 0;
  END IF;

  -- Range (e.g. 9-17)
  IF position('-' IN p_field) > 0 THEN
    v_lo := split_part(p_field, '-', 1)::INT;
    v_hi := split_part(p_field, '-', 2)::INT;
    RETURN p_value BETWEEN v_lo AND v_hi;
  END IF;

  -- Wildcard
  IF p_field = '*' THEN
    RETURN TRUE;
  END IF;

  -- Literal
  v_n := p_field::INT;
  RETURN p_value = v_n;
EXCEPTION WHEN OTHERS THEN
  -- Bad expression: never match (safer than crashing the tick)
  RETURN FALSE;
END;
$func$;


-- =========================================================================
-- run_automation_recipe(recipe_id) — execute a single recipe NOW
-- =========================================================================
-- Posts to the automation-runner Edge Function. Does NOT wait for the
-- response (uses pg_net async). Run-log writes happen inside the Edge
-- Function so a slow Composio call never blocks Postgres.
--
-- USAGE:
--   SELECT public.run_automation_recipe('uuid-here');
--
-- Returns: the request_id from pg_net (usable for debug via net._http_response).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.run_automation_recipe(
  p_recipe_id UUID,
  p_triggered_by TEXT DEFAULT 'manual'
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_recipe        RECORD;
  v_supabase_url  TEXT;
  v_runner_secret TEXT;
  v_request_id    BIGINT;
BEGIN
  -- Fetch the recipe
  SELECT * INTO v_recipe
  FROM public.automation_recipes
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe % not found', p_recipe_id;
  END IF;

  IF v_recipe.agency_id IS NULL THEN
    RAISE EXCEPTION
      'Recipe % has no agency_id set. Every recipe must belong to an agency so its credentials can be resolved from settings.', p_recipe_id;
  END IF;

  -- Resolve Supabase URL from settings (scoped to the recipe's agency).
  -- The Edge Function URL is always {SUPABASE_URL}/functions/v1/automation-runner.
  v_supabase_url := public.get_setting(v_recipe.agency_id, 'supabase_url');

  IF v_supabase_url IS NULL THEN
    RAISE EXCEPTION
      'settings.supabase_url is missing for agency %. Insert it before running recipes. Example: INSERT INTO settings (agency_id, setting_key, setting_value, setting_type) VALUES (''%''::uuid, ''supabase_url'', ''https://YOUR-PROJECT.supabase.co'', ''string'');',
      v_recipe.agency_id, v_recipe.agency_id;
  END IF;

  -- Resolve the shared secret used to authenticate Postgres -> Edge Function calls
  v_runner_secret := public.get_setting(v_recipe.agency_id, 'automation_runner_cron_secret');

  IF v_runner_secret IS NULL THEN
    RAISE EXCEPTION
      'settings.automation_runner_cron_secret is missing for agency %. Generate a random secret and insert it. Example: INSERT INTO settings (agency_id, setting_key, setting_value, setting_type) VALUES (''%''::uuid, ''automation_runner_cron_secret'', encode(gen_random_bytes(32), ''hex''), ''string'');',
      v_recipe.agency_id, v_recipe.agency_id;
  END IF;

  -- Fire-and-forget POST to the Edge Function. The function does the actual
  -- work (Composio call, output write, run-log write, recipe status update).
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/automation-runner',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'shared_secret', v_runner_secret,
      'recipe_id',     p_recipe_id::text,
      'triggered_by',  p_triggered_by
    ),
    timeout_milliseconds := 240000  -- 4 minute soft cap; Edge Functions max ~150s anyway
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$func$;


-- =========================================================================
-- run_due_automation_recipes() — the tick function
-- =========================================================================
-- Called by pg_cron every minute. Finds every active recipe whose
-- cron_expression matches the current minute AND that hasn't already run
-- in this minute (debounce via last_run_at). Fires each one async.
--
-- Skips recipes that:
--   - have is_active = FALSE
--   - have trigger_type != 'cron'
--   - have NULL or empty cron_expression
--   - already ran in the current minute (idempotent against duplicate ticks)
--
-- Returns: number of recipes fired this tick.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.run_due_automation_recipes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_now           TIMESTAMPTZ := date_trunc('minute', NOW());
  v_recipe        RECORD;
  v_fired_count   INTEGER := 0;
BEGIN
  FOR v_recipe IN
    SELECT id, agency_id, recipe_name, cron_expression, last_run_at
    FROM public.automation_recipes
    WHERE is_active = TRUE
      AND trigger_type = 'cron'
      AND cron_expression IS NOT NULL
      AND length(trim(cron_expression)) > 0
      AND (last_run_at IS NULL OR date_trunc('minute', last_run_at) < v_now)
  LOOP
    IF public.cron_expression_matches(v_recipe.cron_expression, v_now) THEN
      BEGIN
        PERFORM public.run_automation_recipe(v_recipe.id, 'pg_cron');
        v_fired_count := v_fired_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Don't let one bad recipe crash the tick. Log to run_log and move on.
        INSERT INTO public.automation_run_log (
          agency_id, recipe_id, status, error_message, output_summary, run_at
        ) VALUES (
          v_recipe.agency_id,
          v_recipe.id,
          'failed',
          SQLERRM,
          'tick dispatch failed: ' || v_recipe.recipe_name,
          NOW()
        );
      END;
    END IF;
  END LOOP;

  RETURN v_fired_count;
END;
$func$;


-- =========================================================================
-- Permissions
-- =========================================================================
-- run_due_automation_recipes is the cron entrypoint — only postgres needs it.
-- run_automation_recipe is also useful for manual triggers from the BCC web
-- app's Automations module via authenticated calls.
GRANT EXECUTE ON FUNCTION public.get_setting(UUID, TEXT)                   TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.run_automation_recipe(UUID, TEXT)         TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.run_due_automation_recipes()              TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.cron_expression_matches(TEXT, TIMESTAMPTZ) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_field_matches(TEXT, INT, INT, INT)    TO postgres, service_role, authenticated;


-- =========================================================================
-- Idempotent: this migration is safe to re-run.
-- All function definitions use CREATE OR REPLACE.
-- No DDL changes to existing tables, no data writes.
-- =========================================================================
