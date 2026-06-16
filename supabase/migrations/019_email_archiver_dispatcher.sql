-- =========================================================================
-- MIGRATION 019 — Email Archiver: INTERNAL dispatcher + recipe rewire
-- =========================================================================
-- Closes S6 Discovery 2.
--
-- Email Archiver is a multi-step Composio workflow (fetch IDs → modify
-- labels → log to documents). The generic automation-runner can't express
-- this — and pure plpgsql can't either, because of the MVCC visibility
-- limit we hit on Daily Briefing (a function can't read net._http_response
-- rows that pg_net workers insert during the function's own transaction).
--
-- The fix: a dedicated email-archiver Edge Function (Deno can read its
-- own HTTP responses synchronously) plus this thin Postgres dispatcher.
-- The runner calls dispatch_email_archiver via run_internal_recipe, the
-- dispatcher fires the Edge Function via pg_net, and the Edge Function
-- writes its own automation_run_log row with the real outcome.
--
-- V1 SCOPE: archive (modify labels) + documents-table logging.
-- DEFERRED to V2: attachment extraction + Drive folder routing
--   (BCC/Documents/YYYY-MM/<category>/) per docs/DRIVE_FOLDER_SETUP.md.
--
-- The Edge Function (deployed as `email-archiver` slug, version 1,
-- sha256 180b14f363a49cace0abfac17598251017107fa76e3ab9f3484ae30a446ba4cd)
-- is NOT yet committed to the repo. Commit when GitHub MCP gets write.
-- =========================================================================

-- =========================================================================
-- Dispatcher: thin shim that pg_net.http_post's to the Edge Function
-- =========================================================================
CREATE OR REPLACE FUNCTION public.dispatch_email_archiver(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_supabase_url    TEXT;
  v_shared_secret   TEXT;
  v_endpoint_url    TEXT;
  v_request_id      BIGINT;
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/email-archiver';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json'
               ),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_email_archiver'
               ),
    timeout_milliseconds := 240000  -- 4 minutes; matches runner's budget
  ) INTO v_request_id;

  -- Fire-and-trust: the Edge Function writes its own automation_run_log row
  -- with the actual archive count. This dispatcher's return value is just
  -- the dispatch acknowledgement, recorded by the generic runner's INTERNAL
  -- branch as the FIRST log row for this invocation.
  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to email-archiver Edge Function via pg_net (request_id=' ||
      v_request_id || '). The Edge Function writes a second automation_run_log ' ||
      'row with the real archive count when it completes.'
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.dispatch_email_archiver(UUID, UUID) TO postgres, service_role;


-- =========================================================================
-- Rewire the Email Archiver recipe for Godley.
-- Scoped to this agency only; other installs unaffected.
-- =========================================================================
UPDATE public.automation_recipes
   SET composio_action  = 'INTERNAL',
       internal_handler = 'dispatch_email_archiver',
       input_config     = jsonb_build_object(
         'archive_older_than_days',    30,
         'preserve_starred',           true,
         'max_per_run',                100,
         'route_attachments_to_drive', false,   -- V2; see DRIVE_FOLDER_SETUP.md
         'add_archive_label_id',       null,    -- optional custom Label_XXX
         '_archive_query_override',    null,    -- if set, used verbatim instead of computed
         '_note',                      'V1: archive (modify labels) + documents log only. Attachment-to-Drive routing is V2.'
       ),
       output_table  = 'documents',
       output_config = jsonb_build_object(
         'on_conflict', 'ignore'
       ),
       updated_at = NOW()
 WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
   AND recipe_name = 'Email Archiver';;
