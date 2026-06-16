-- =========================================================================
-- 022_processor_recipes_to_internal.sql
-- =========================================================================
-- S14 (2026-06-16): Backport the 6 "Processor" recipes from V0 (bare
-- GMAIL_FETCH_EMAILS, no Drive routing) to the multi-step dispatcher
-- pattern, routing to the new `document-processor` Edge Function.
--
-- Each recipe's input_config gains a `fixed_category` value (from the
-- canonical set in docs/DRIVE_FOLDER_SETUP.md §2) that document-processor
-- uses instead of the rule-based classifyAttachment() in email-archiver.
-- `query` and `max_results` are preserved verbatim.
--
-- composio_action: 'GMAIL_FETCH_EMAILS' -> 'INTERNAL'
-- internal_handler: NULL -> 'dispatch_<recipe>_processor'
--
-- The companion migration 023_processor_dispatchers.sql creates the 6
-- plpgsql dispatch functions referenced here.
--
-- ROLLBACK guidance (per-recipe, no rollback migration shipped):
--   UPDATE automation_recipes
--   SET composio_action  = 'GMAIL_FETCH_EMAILS',
--       internal_handler = NULL,
--       input_config     = input_config - 'fixed_category' - 'archive_after_processing'
--   WHERE recipe_name = '<recipe>';
-- =========================================================================

DO $migration$
DECLARE
  v_count INTEGER;
BEGIN

  -- 1. Bank Statement Processor → bank_statements
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_bank_statement_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'bank_statements')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'Bank Statement Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for Bank Statement Processor, got %', v_count;
  END IF;

  -- 2. Credit Card Statement Processor → credit_card_statements
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_credit_card_statement_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'credit_card_statements')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'Credit Card Statement Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for Credit Card Statement Processor, got %', v_count;
  END IF;

  -- 3. Deduction Statement Processor → deductions
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_deduction_statement_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'deductions')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'Deduction Statement Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for Deduction Statement Processor, got %', v_count;
  END IF;

  -- 4. Payroll Processor → payroll
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_payroll_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'payroll')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'Payroll Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for Payroll Processor, got %', v_count;
  END IF;

  -- 5. Producer Production Report Processor → production_reports
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_producer_production_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'production_reports')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'Producer Production Report Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for Producer Production Report Processor, got %', v_count;
  END IF;

  -- 6. SF Daily Comp Processor → comp_recap
  UPDATE automation_recipes
  SET composio_action  = 'INTERNAL',
      internal_handler = 'dispatch_sf_daily_comp_processor',
      input_config     = input_config
                         || jsonb_build_object('fixed_category', 'comp_recap')
                         || jsonb_build_object('archive_after_processing', true),
      updated_at       = NOW()
  WHERE recipe_name = 'SF Daily Comp Processor';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Migration 022: expected exactly 1 row for SF Daily Comp Processor, got %', v_count;
  END IF;

END;
$migration$;

-- Post-migration sanity check: every Processor recipe must now be INTERNAL
-- with a non-null internal_handler and a fixed_category in input_config.
DO $check$
DECLARE
  v_bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bad
  FROM automation_recipes
  WHERE recipe_name LIKE '%Processor%'
    AND (
      composio_action <> 'INTERNAL'
      OR internal_handler IS NULL
      OR (input_config->>'fixed_category') IS NULL
    );
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'Migration 022 post-check failed: % Processor recipe(s) still not fully migrated', v_bad;
  END IF;
END;
$check$;
