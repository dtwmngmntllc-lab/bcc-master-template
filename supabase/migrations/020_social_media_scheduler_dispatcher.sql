-- =========================================================================
-- MIGRATION 020 — Social Media Scheduler: INTERNAL dispatcher + recipe rewire
-- =========================================================================
-- Closes S6 Discovery 3. Same architectural pattern as Email Archiver
-- (migration 019): a dedicated Edge Function (`social-media-scheduler`,
-- deployed version 1, sha256 fe8f95f4693ba40973394b62b107902e1f9a637c21e877f3611c74df22a3fbe5)
-- does the multi-platform orchestration; a thin Postgres dispatcher
-- pg_net's it; the runner calls the dispatcher via run_internal_recipe.
--
-- V1 capabilities:
--   - Facebook text + photo posts (auto, requires composio_facebook_account_id + facebook_page_id)
--   - LinkedIn text posts (auto, requires composio_linkedin_account_id + linkedin_author_urn)
--   - Instagram (always manual — no public API)
--   - Graceful degradation: missing platform connection => requires_manual + alert
--
-- DEFERRED to V2: LinkedIn image posts (3-step upload flow).
-- Activation in this install is safe: with no FB/LinkedIn connections and
-- an empty content_calendar, the recipe returns "0 posts due" daily until
-- the operator (a) connects a platform in Composio, (b) adds the required
-- settings rows, and (c) starts seeding content_calendar entries.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.dispatch_social_media_scheduler(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_supabase_url  TEXT;
  v_shared_secret TEXT;
  v_endpoint_url  TEXT;
  v_request_id    BIGINT;
BEGIN
  v_supabase_url  := public.get_setting(p_agency_id, 'supabase_url');
  v_shared_secret := public.get_setting(p_agency_id, 'automation_runner_cron_secret');

  IF v_supabase_url IS NULL OR length(v_supabase_url) = 0 THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary',    'Skipped: settings.supabase_url is missing for agency ' || p_agency_id::text
    );
  END IF;

  IF v_shared_secret IS NULL OR length(v_shared_secret) = 0 THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary',    'Skipped: settings.automation_runner_cron_secret is missing for agency ' || p_agency_id::text
    );
  END IF;

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/social-media-scheduler';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_social_media_scheduler'
               ),
    timeout_milliseconds := 240000  -- 4 min budget (matches runner)
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to social-media-scheduler Edge Function (pg_net request_id=' || v_request_id ||
      '). The Edge Function writes a second automation_run_log row with the real per-platform breakdown when it completes.'
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.dispatch_social_media_scheduler(UUID, UUID) TO postgres, service_role;


-- =========================================================================
-- Rewire the Social Media Scheduler recipe for Godley.
-- Scoped to this agency only.
-- =========================================================================
UPDATE public.automation_recipes
   SET composio_action  = 'INTERNAL',
       internal_handler = 'dispatch_social_media_scheduler',
       input_config     = jsonb_build_object(
         'lookback_days',  0,        -- 0 = today only; raise to catch missed-day backfills
         '_v1_capabilities', jsonb_build_object(
           'facebook',   'text + photo (requires composio_facebook_account_id + facebook_page_id)',
           'linkedin',   'text only (requires composio_linkedin_account_id + linkedin_author_urn) — image posts are V2',
           'instagram',  'always manual (no public API)',
           'other',      'always manual'
         ),
         '_required_settings_when_connected', jsonb_build_array(
           'composio_facebook_account_id',
           'facebook_page_id',
           'composio_linkedin_account_id',
           'linkedin_author_urn'
         )
       ),
       output_table  = 'content_calendar',
       output_config = jsonb_build_object(
         'on_conflict', 'update',
         'unique_on',   jsonb_build_array('id')
       ),
       updated_at = NOW()
 WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
   AND recipe_name = 'Social Media Scheduler';;
