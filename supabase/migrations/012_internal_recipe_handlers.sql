-- =========================================================================
-- MIGRATION 012 — Internal Recipe Handlers
-- =========================================================================
-- Three of the 12 canonical recipes do not call Composio. They operate
-- entirely on data already in Supabase: GL Entry Writer (#8), Monthly Close
-- Monitor (#11), Producer Underperformance Watcher (#12). The runner shipped
-- in migration 011 has no path for these — it tries to call Composio with
-- composio_action='INTERNAL' as the tool slug and fails. This migration
-- ships the handlers and adds the dispatch column the runner needs.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds automation_recipes.internal_handler column (TEXT, nullable)
--      - For Composio recipes: NULL
--      - For INTERNAL recipes: the name of the SQL function to call
--   2. Adds comp_recap.posted_at column (so GL Entry Writer can dedupe)
--   3. Creates three SQL functions, one per INTERNAL recipe
--   4. Creates run_internal_recipe(recipe_id) which the Edge Function calls
--      via Postgres for the INTERNAL path
--
-- The Edge Function update (in this same commit) detects when
-- composio_action='INTERNAL' and calls run_internal_recipe instead of
-- calling Composio.
-- =========================================================================

-- =========================================================================
-- Schema additions
-- =========================================================================

ALTER TABLE public.automation_recipes
  ADD COLUMN IF NOT EXISTS internal_handler TEXT;

COMMENT ON COLUMN public.automation_recipes.internal_handler IS
  'For recipes with composio_action=''INTERNAL'': the name of the SQL function to call (must be in public schema, must accept p_agency_id UUID and p_recipe_id UUID, must return jsonb). NULL for Composio-driven recipes.';

-- comp_recap needs a "posted to GL" timestamp so GL Entry Writer can dedupe
ALTER TABLE public.comp_recap
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.comp_recap.posted_at IS
  'Set by gl_entry_writer when a journal_entries row has been created from this comp_recap row. NULL = unposted.';


-- =========================================================================
-- Handler #1: gl_entry_writer
-- =========================================================================
-- Daily reconciliation: walks comp_recap rows that don't yet have a posted_at
-- timestamp, writes the GL entries (cash basis), per chart_of_accounts splits.
--
-- This is the single most important INTERNAL recipe — without it, comp_recap
-- rows accumulate but never become journal_lines, which means
-- v_income_statement stays at 0, which means the Financials → P&L tab in
-- the BCC web app stays empty. End user impact: agent sees comp data in
-- the SF Compensation tab but $0 revenue everywhere else.
--
-- Mapping (cash basis, can be customized per agency by editing chart_of_accounts):
--   comp_type='new_business' → 4010 Commission Income - New Business
--   comp_type='renewal'      → 4020 Commission Income - Renewal
--   comp_type='scoreboard'   → 4030 ScoreBoard Bonus
--   comp_type='aipp'         → 4040 AIPP Income
--   else (other/deduction)   → 4050 Other SF Compensation
-- For the credit side (cash), uses 1010 (Operating Bank) as default unless
-- the agency has a different "default_cash_account_code" in settings.
--
-- Returns: jsonb with {'records_processed': int, 'output_summary': text}
-- =========================================================================

CREATE OR REPLACE FUNCTION public.gl_entry_writer(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_count           INTEGER := 0;
  v_unposted        RECORD;
  v_revenue_acct_id UUID;
  v_cash_acct_id    UUID;
  v_revenue_code    TEXT;
  v_cash_code       TEXT;
  v_entry_id        UUID;
  v_now             TIMESTAMPTZ := NOW();
BEGIN
  -- Resolve default cash account code from settings (fallback to '1010')
  SELECT setting_value INTO v_cash_code
  FROM public.settings
  WHERE agency_id = p_agency_id AND setting_key = 'default_cash_account_code'
  LIMIT 1;
  IF v_cash_code IS NULL THEN v_cash_code := '1010'; END IF;

  -- Resolve cash account UUID
  SELECT id INTO v_cash_acct_id
  FROM public.chart_of_accounts
  WHERE agency_id = p_agency_id AND account_code = v_cash_code
  LIMIT 1;

  IF v_cash_acct_id IS NULL THEN
    -- Bail early: no cash account means we can't write any GL entries
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary', 'Skipped: chart_of_accounts has no row with account_code=' || v_cash_code || '. Agent must seed chart_of_accounts (migration 003) or add a default_cash_account_code row in settings pointing to an existing account.'
    );
  END IF;

  -- Walk unposted comp_recap rows for this agency
  FOR v_unposted IN
    SELECT id, period_year, period_month, comp_type, comp_category, amount,
           description, is_aipp_eligible, is_scoreboard_eligible
    FROM public.comp_recap
    WHERE agency_id = p_agency_id
      AND posted_at IS NULL
      AND amount IS NOT NULL
      AND amount != 0
      AND period_year IS NOT NULL
      AND period_month IS NOT NULL
    ORDER BY period_year, period_month, id
    LIMIT 500  -- safety cap per run; if more, next run picks them up
  LOOP
    -- Pick a revenue account code based on comp_type
    v_revenue_code := CASE LOWER(COALESCE(v_unposted.comp_type, ''))
      WHEN 'new_business' THEN '4010'
      WHEN 'renewal'      THEN '4020'
      WHEN 'scoreboard'   THEN '4030'
      WHEN 'aipp'         THEN '4040'
      ELSE                     '4050'
    END;

    -- Resolve revenue account UUID
    SELECT id INTO v_revenue_acct_id
    FROM public.chart_of_accounts
    WHERE agency_id = p_agency_id AND account_code = v_revenue_code
    LIMIT 1;

    IF v_revenue_acct_id IS NULL THEN
      -- Skip this row; the COA needs the account, agent's Claude or migration 003 must seed it
      CONTINUE;
    END IF;

    -- Create the journal entry header
    INSERT INTO public.journal_entries (
      agency_id, entry_date, entry_type, source, document_id, description, created_by, created_at
    ) VALUES (
      p_agency_id,
      MAKE_DATE(v_unposted.period_year, v_unposted.period_month, 1),
      'comp_revenue',
      'gl_entry_writer',
      NULL,  -- comp_recap row is not in documents table; reference via reference_number instead
      COALESCE(v_unposted.description,
               COALESCE(v_unposted.comp_type, '') || ' ' || COALESCE(v_unposted.comp_category, '')),
      'gl_entry_writer',
      v_now
    )
    RETURNING id INTO v_entry_id;

    -- Set reference_number to the comp_recap row id for traceability
    UPDATE public.journal_entries
    SET reference_number = 'comp_recap:' || v_unposted.id::text
    WHERE id = v_entry_id;

    -- Debit cash, credit revenue
    -- For deductions (negative amounts), this naturally reverses
    INSERT INTO public.journal_lines (
      journal_entry_id, agency_id, account_id, debit, credit, description, created_at
    ) VALUES
      (v_entry_id, p_agency_id, v_cash_acct_id,    v_unposted.amount, 0,
       'Cash receipt: ' || COALESCE(v_unposted.comp_category, v_unposted.comp_type, ''), v_now),
      (v_entry_id, p_agency_id, v_revenue_acct_id, 0, v_unposted.amount,
       COALESCE(v_unposted.comp_category, v_unposted.comp_type, ''), v_now);

    -- Mark comp_recap row as posted
    UPDATE public.comp_recap SET posted_at = v_now WHERE id = v_unposted.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'records_processed', v_count,
    'output_summary', v_count || ' journal entries written from comp_recap'
  );
END;
$func$;


-- =========================================================================
-- Handler #2: monthly_close_monitor
-- =========================================================================
-- Daily check of monthly_close_checklist progress.
--   - Mid-month (after the 5th): flags overdue items (expected_by < today, received_at IS NULL) with an alert
--   - End-of-month (last 3 days): creates next month's checklist by template
-- Idempotent: re-running on the same day doesn't duplicate alerts/checklists.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.monthly_close_monitor(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_today          DATE := CURRENT_DATE;
  v_last_day       DATE := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
  v_overdue_count  INTEGER := 0;
  v_created_count  INTEGER := 0;
  v_overdue        RECORD;
  v_target_year    INTEGER;
  v_target_month   INTEGER;
BEGIN
  -- Mid-month overdue alerts (only after the 5th of the month)
  IF EXTRACT(DAY FROM v_today)::INT >= 5 THEN
    FOR v_overdue IN
      SELECT id, doc_label
      FROM public.monthly_close_checklist
      WHERE agency_id = p_agency_id
        AND period_year = EXTRACT(YEAR FROM v_today)::INT
        AND period_month = EXTRACT(MONTH FROM v_today)::INT
        AND received_at IS NULL
        AND expected_by IS NOT NULL
        AND expected_by < v_today
    LOOP
      -- Insert alert if one doesn't already exist for today (deduped by module_reference)
      INSERT INTO public.alerts (
        agency_id, alert_type, severity, title, message, module_reference, is_read, is_resolved, created_at
      )
      SELECT p_agency_id, 'overdue_close_item', 'warning',
             'Monthly close item overdue: ' || v_overdue.doc_label,
             'Item from this month''s close checklist is past its expected_by date. Review in the Financials → Monthly Close tab.',
             'monthly_close_monitor:' || v_overdue.id::text,
             false, false, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.alerts
        WHERE agency_id = p_agency_id
          AND module_reference = 'monthly_close_monitor:' || v_overdue.id::text
          AND is_resolved = false
          AND created_at::date = v_today
      );
      v_overdue_count := v_overdue_count + 1;
    END LOOP;
  END IF;

  -- End-of-month: create next month's checklist (only run in the last 3 days of the month)
  IF v_today >= v_last_day - INTERVAL '2 days' THEN
    -- Compute next month
    IF EXTRACT(MONTH FROM v_today)::INT = 12 THEN
      v_target_year := EXTRACT(YEAR FROM v_today)::INT + 1;
      v_target_month := 1;
    ELSE
      v_target_year := EXTRACT(YEAR FROM v_today)::INT;
      v_target_month := EXTRACT(MONTH FROM v_today)::INT + 1;
    END IF;

    -- Only create if next month's checklist doesn't already have rows
    IF NOT EXISTS (
      SELECT 1 FROM public.monthly_close_checklist
      WHERE agency_id = p_agency_id
        AND period_year = v_target_year
        AND period_month = v_target_month
    ) THEN
      -- Copy template items: take this month's distinct doc_label/doc_category combos
      INSERT INTO public.monthly_close_checklist (
        agency_id, period_year, period_month, doc_category, doc_label, expected_by,
        received_at, document_id, status, is_closed, notes, created_at
      )
      SELECT p_agency_id, v_target_year, v_target_month, doc_category, doc_label,
             MAKE_DATE(v_target_year, v_target_month,
                       LEAST(EXTRACT(DAY FROM expected_by)::INT,
                             EXTRACT(DAY FROM (MAKE_DATE(v_target_year, v_target_month, 1) + INTERVAL '1 month - 1 day'))::INT)),
             NULL, NULL, 'pending', false, NULL, NOW()
      FROM (
        SELECT DISTINCT ON (doc_category, doc_label) doc_category, doc_label, expected_by
        FROM public.monthly_close_checklist
        WHERE agency_id = p_agency_id
          AND period_year = EXTRACT(YEAR FROM v_today)::INT
          AND period_month = EXTRACT(MONTH FROM v_today)::INT
          AND expected_by IS NOT NULL
        ORDER BY doc_category, doc_label, created_at DESC
      ) src;

      GET DIAGNOSTICS v_created_count = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'records_processed', v_overdue_count + v_created_count,
    'output_summary', v_overdue_count || ' overdue alerts, ' || v_created_count || ' next-month checklist items created'
  );
END;
$func$;


-- =========================================================================
-- Handler #3: producer_underperformance_watcher
-- =========================================================================
-- Daily check: each producer's MTD issued production vs their 3-month rolling
-- average. If MTD pace < 70% of 3MRA, fire alert (deduped per producer per day).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.producer_underperformance_watcher(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_today              DATE := CURRENT_DATE;
  v_curr_year          INT  := EXTRACT(YEAR FROM v_today)::INT;
  v_curr_month         INT  := EXTRACT(MONTH FROM v_today)::INT;
  v_day_of_month       INT  := EXTRACT(DAY FROM v_today)::INT;
  v_days_in_month      INT  := EXTRACT(DAY FROM (date_trunc('month', v_today) + INTERVAL '1 month - 1 day'))::INT;
  v_pace_factor        NUMERIC := v_day_of_month::numeric / NULLIF(v_days_in_month, 0)::numeric;
  v_alert_count        INTEGER := 0;
  v_producer           RECORD;
  v_mtd_premium        NUMERIC;
  v_3mra_premium       NUMERIC;
  v_pace_ratio         NUMERIC;
  v_mod_ref            TEXT;
BEGIN
  -- Only run when the day-of-month is >= 5 (need some MTD data to be meaningful)
  IF v_day_of_month < 5 THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary', 'Skipped: too early in month (day ' || v_day_of_month || ')'
    );
  END IF;

  FOR v_producer IN
    SELECT id, first_name, last_name, role
    FROM public.staff
    WHERE agency_id = p_agency_id
      AND COALESCE(is_active, true) = true
      AND role IS NOT NULL
      AND (role ILIKE '%LSP%' OR role ILIKE '%Producer%' OR role ILIKE '%Financial Services%')
  LOOP
    -- MTD premium for current month
    SELECT COALESCE(SUM(premium_issued), 0) INTO v_mtd_premium
    FROM public.producer_production
    WHERE agency_id = p_agency_id
      AND staff_id = v_producer.id
      AND period_year = v_curr_year
      AND period_month = v_curr_month;

    -- 3-month rolling average (3 months prior to current)
    SELECT COALESCE(AVG(monthly_total), 0) INTO v_3mra_premium
    FROM (
      SELECT period_year, period_month, SUM(premium_issued) AS monthly_total
      FROM public.producer_production
      WHERE agency_id = p_agency_id
        AND staff_id = v_producer.id
        AND (period_year, period_month) IN (
          SELECT EXTRACT(YEAR FROM (v_today - INTERVAL '1 month'))::int,
                 EXTRACT(MONTH FROM (v_today - INTERVAL '1 month'))::int
          UNION ALL SELECT EXTRACT(YEAR FROM (v_today - INTERVAL '2 month'))::int,
                 EXTRACT(MONTH FROM (v_today - INTERVAL '2 month'))::int
          UNION ALL SELECT EXTRACT(YEAR FROM (v_today - INTERVAL '3 month'))::int,
                 EXTRACT(MONTH FROM (v_today - INTERVAL '3 month'))::int
        )
      GROUP BY period_year, period_month
    ) prior_months;

    -- Skip if no rolling history yet (new producer)
    IF v_3mra_premium <= 0 THEN CONTINUE; END IF;

    -- Compute pace ratio
    v_pace_ratio := CASE
      WHEN v_3mra_premium * v_pace_factor > 0
        THEN v_mtd_premium / (v_3mra_premium * v_pace_factor)
      ELSE NULL
    END;

    IF v_pace_ratio IS NOT NULL AND v_pace_ratio < 0.70 THEN
      v_mod_ref := 'producer_underperformance_watcher:' || v_producer.id::text;
      INSERT INTO public.alerts (
        agency_id, alert_type, severity, title, message, module_reference, is_read, is_resolved, created_at
      )
      SELECT p_agency_id, 'producer_underperformance', 'warning',
             v_producer.first_name || ' ' || v_producer.last_name || ': MTD pace ' || ROUND(v_pace_ratio * 100, 0) || '% of 3MRA',
             'Through day ' || v_day_of_month || ' of ' || v_days_in_month || ', producer has issued $' ||
             ROUND(v_mtd_premium, 0) || ' in premium. 3-month rolling average through this point of month is $' ||
             ROUND(v_3mra_premium * v_pace_factor, 0) || '. Investigate via HR & People → Performance.',
             v_mod_ref,
             false, false, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.alerts
        WHERE agency_id = p_agency_id
          AND module_reference = v_mod_ref
          AND is_resolved = false
          AND created_at::date = v_today
      );
      v_alert_count := v_alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'records_processed', v_alert_count,
    'output_summary', v_alert_count || ' producers flagged as underperforming MTD'
  );
END;
$func$;


-- =========================================================================
-- Dispatch function: run_internal_recipe(recipe_id)
-- =========================================================================
-- Called by the automation-runner Edge Function when composio_action='INTERNAL'.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.run_internal_recipe(
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_recipe   RECORD;
  v_result   jsonb;
  v_query    TEXT;
BEGIN
  SELECT id, agency_id, recipe_name, internal_handler
  INTO v_recipe
  FROM public.automation_recipes
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe % not found', p_recipe_id;
  END IF;
  IF v_recipe.agency_id IS NULL THEN
    RAISE EXCEPTION 'Recipe % has no agency_id', p_recipe_id;
  END IF;
  IF v_recipe.internal_handler IS NULL OR length(trim(v_recipe.internal_handler)) = 0 THEN
    RAISE EXCEPTION 'Recipe % has composio_action=INTERNAL but no internal_handler set. Update the recipe row to point to one of: gl_entry_writer, monthly_close_monitor, producer_underperformance_watcher (or another agency-specific handler).', v_recipe.recipe_name;
  END IF;

  -- Whitelist: only allow handlers in public schema, no schema-qualified names, no spaces/quotes
  IF v_recipe.internal_handler !~ '^[a-z][a-z0-9_]{2,80}$' THEN
    RAISE EXCEPTION 'Recipe % has unsafe internal_handler value: %', v_recipe.recipe_name, v_recipe.internal_handler;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = v_recipe.internal_handler
  ) THEN
    RAISE EXCEPTION 'Recipe % references internal_handler "%" but no such function exists in the public schema. Apply migration 012 or define the handler.', v_recipe.recipe_name, v_recipe.internal_handler;
  END IF;

  v_query := format('SELECT public.%I($1, $2)', v_recipe.internal_handler);
  EXECUTE v_query USING v_recipe.agency_id, v_recipe.id INTO v_result;
  RETURN v_result;
END;
$func$;


-- =========================================================================
-- Permissions
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.gl_entry_writer(UUID, UUID)                          TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.monthly_close_monitor(UUID, UUID)                    TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.producer_underperformance_watcher(UUID, UUID)        TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.run_internal_recipe(UUID)                            TO postgres, service_role, authenticated;


-- =========================================================================
-- Backfill existing INTERNAL recipes if they were inserted before this migration
-- =========================================================================
UPDATE public.automation_recipes
SET internal_handler = CASE
  WHEN recipe_name ILIKE '%GL Entry Writer%'                  THEN 'gl_entry_writer'
  WHEN recipe_name ILIKE '%Monthly Close Monitor%'            THEN 'monthly_close_monitor'
  WHEN recipe_name ILIKE '%Producer Underperformance%'        THEN 'producer_underperformance_watcher'
  ELSE internal_handler
END
WHERE composio_action = 'INTERNAL'
  AND internal_handler IS NULL;


-- =========================================================================
-- Idempotent. Safe to re-run.
-- =========================================================================
