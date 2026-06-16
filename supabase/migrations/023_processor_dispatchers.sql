-- =========================================================================
-- 023_processor_dispatchers.sql
-- =========================================================================
-- S14 (2026-06-16): Six dispatcher functions, one per Processor recipe.
-- Each is modeled on dispatch_email_archiver (migration 019). Differences:
--   - Endpoint URL points to `document-processor` Edge Function (not
--     `email-archiver`)
--   - Body includes a `triggered_by` value naming this dispatcher, useful
--     when reading net._http_response or function logs
--
-- All six dispatchers share the same body verbatim except for the
-- triggered_by value. The repetition is intentional and matches the
-- existing dispatcher pattern (migrations 018, 019, 020) — keeping
-- each dispatcher independently inspectable via \df+ rather than hiding
-- behind a helper.
--
-- ROLLBACK guidance:
--   DROP FUNCTION IF EXISTS public.dispatch_bank_statement_processor(uuid, uuid);
--   ...and so on for the other five.
-- =========================================================================

-- 1. Bank Statement Processor
CREATE OR REPLACE FUNCTION public.dispatch_bank_statement_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_bank_statement_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_bank_statement_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;

-- 2. Credit Card Statement Processor
CREATE OR REPLACE FUNCTION public.dispatch_credit_card_statement_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_credit_card_statement_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_credit_card_statement_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;

-- 3. Deduction Statement Processor
CREATE OR REPLACE FUNCTION public.dispatch_deduction_statement_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_deduction_statement_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_deduction_statement_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;

-- 4. Payroll Processor
CREATE OR REPLACE FUNCTION public.dispatch_payroll_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_payroll_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_payroll_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;

-- 5. Producer Production Report Processor
CREATE OR REPLACE FUNCTION public.dispatch_producer_production_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_producer_production_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_producer_production_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;

-- 6. SF Daily Comp Processor
CREATE OR REPLACE FUNCTION public.dispatch_sf_daily_comp_processor(p_agency_id uuid, p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  v_endpoint_url := rtrim(v_supabase_url, '/') || '/functions/v1/document-processor';

  SELECT net.http_post(
    url     := v_endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'recipe_id',     p_recipe_id,
                 'shared_secret', v_shared_secret,
                 'triggered_by',  'dispatch_sf_daily_comp_processor'
               ),
    timeout_milliseconds := 240000
  ) INTO v_request_id;

  RETURN jsonb_build_object(
    'records_processed', 0,
    'output_summary',
      'Dispatched to document-processor Edge Function via pg_net (request_id=' ||
      v_request_id || ', triggered_by=dispatch_sf_daily_comp_processor). ' ||
      'The Edge Function writes a second automation_run_log row with the real ' ||
      'record count when it completes.'
  );
END;
$function$;
