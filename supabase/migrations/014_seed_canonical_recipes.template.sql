-- ============================================================================
-- TEMPLATE FILE — substitute the following placeholders at install time:
--   AGENT_FULL_NAME            -> full name of the agent (e.g. "Jane Doe")
--   BRIEFING_RECIPIENT_EMAIL   -> email address for the morning briefing
-- agency_id is resolved dynamically via (SELECT id FROM public.agency LIMIT 1);
-- 004_seed_agency_record.sql must run first.
-- ============================================================================

-- =============================================================================
-- Migration: 014_seed_canonical_recipes (template — see header)
-- =============================================================================
-- Seeds the canonical 12 automation recipes for the AGENT_FULL_NAME BCC install,
-- per docs/AUTOMATIONS_INSTALL.md.
--
-- Set chosen: AUTOMATIONS_INSTALL.md 12-recipe set (the per-document-type
-- fetcher pattern). The alternative seed_bcc_automations() 13-recipe set in
-- the repo would require 8 additional INTERNAL handlers not shipped by mig 012.
--
-- All recipes are agency-scoped to the single row in public.agency.
-- 11 active; Social Media Scheduler inactive until FB/LinkedIn connections land.
-- =============================================================================

DO $$
DECLARE
    v_agency UUID := (SELECT id FROM public.agency LIMIT 1);
    v_existing INT;
BEGIN
    SELECT COUNT(*) INTO v_existing
    FROM public.automation_recipes WHERE agency_id = v_agency;

    IF v_existing > 0 THEN
        RAISE NOTICE 'Agency % already has % recipes - skipping seed.', v_agency, v_existing;
        RETURN;
    END IF;

    -- 1. SF Daily Comp Processor (10:00 AM CDT = 15:00 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'SF Daily Comp Processor',
        'Pulls State Farm daily comp emails, parses individual line items via Groq, writes to comp_recap. Primary daily income feed.',
        'cron', '0 15 * * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a State Farm daily compensation notice. Extract every line item with: period_year, period_month, comp_type (new_business, renewal, scoreboard, aipp, other), comp_category (auto, home, life, health, fs, umbrella), amount, is_aipp_eligible, is_scoreboard_eligible, description.',
        jsonb_build_object(
            'gmail_query', 'from:no-reply@statefarm.com subject:"daily comp" newer_than:2d',
            'attachment_required', false
        ),
        'comp_recap',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','period_year','period_month','comp_type','comp_category','description'],
            'on_conflict', 'update'
        ),
        true
    );

    -- 2. Deduction Statement Processor (every 6 hours)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Deduction Statement Processor',
        'Parses State Farm deduction statements, writes deductions (negative amounts) to comp_recap.',
        'cron', '0 */6 * * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a State Farm deduction statement. Extract each deduction line as a comp_recap row with NEGATIVE amount. Fields: period_year, period_month, comp_type=''other'', comp_category (use the LOB or ''other''), description (the deduction reason), amount (negative). Set is_aipp_eligible=false, is_scoreboard_eligible=false.',
        jsonb_build_object(
            'gmail_query', 'from:no-reply@statefarm.com subject:"deduction statement" newer_than:14d',
            'attachment_required', true,
            'expected_format', 'pdf'
        ),
        'comp_recap',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','period_year','period_month','comp_type','comp_category','description'],
            'on_conflict', 'update'
        ),
        true
    );

    -- 3. Bank Statement Processor (every 6 hours)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Bank Statement Processor',
        'Parses bank statement emails, posts to journal_entries. Dedups via reference_number.',
        'cron', '0 */6 * * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a bank statement email or attached PDF. For each transaction, output a journal_entries row: entry_date (YYYY-MM-DD), entry_type (''bank_deposit'' for deposits, ''bank_withdrawal'' for withdrawals), reference_number (the bank''s transaction ID — REQUIRED for dedup), description, memo, source=''bank_statement''. Skip the running balance line.',
        jsonb_build_object(
            'gmail_query', '(from:notify@bank OR from:alerts@bank OR subject:"bank statement" OR subject:"account statement") newer_than:14d',
            'attachment_required', false
        ),
        'journal_entries',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','reference_number'],
            'on_conflict', 'skip'
        ),
        true
    );

    -- 4. Credit Card Statement Processor (every 6 hours)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Credit Card Statement Processor',
        'Parses credit card statements, writes to credit_transactions. Pairs with Bank Statement Processor for full cash-basis reconciliation.',
        'cron', '0 */6 * * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a credit card statement email or attached PDF. For each transaction, output a credit_transactions row: transaction_date (YYYY-MM-DD), description (merchant or memo line), amount (positive for charges, negative for payments/credits), transaction_type (''charge'' or ''payment''), category (best-guess: meals, supplies, software, travel, fuel, marketing, or null).',
        jsonb_build_object(
            'gmail_query', '(subject:"credit card statement" OR subject:"your statement is ready" OR from:alerts@chase OR from:noreply@americanexpress) newer_than:14d',
            'attachment_required', false
        ),
        'credit_transactions',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','transaction_date','amount','description'],
            'on_conflict', 'skip'
        ),
        true
    );

    -- 5. Payroll Processor (every 6 hours) — single_entity variant
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Payroll Processor',
        'Parses payroll provider notifications (Gusto, ADP, etc.), writes one row to payroll_runs per pay date. SINGLE-ENTITY variant.',
        'cron', '0 */6 * * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a payroll provider notification (Gusto, ADP, QuickBooks Payroll, Paychex). Output ONE payroll_runs row: pay_period_start (YYYY-MM-DD), pay_period_end, pay_date, payroll_provider (gusto|adp|quickbooks|paychex|other), gross_payroll (decimal), employer_taxes (decimal), net_payroll (decimal), status=''posted''. If gross/taxes/net not present in the email, set them to 0 and the recipe will mark the run for manual fill-in.',
        jsonb_build_object(
            'gmail_query', '(from:noreply@gusto OR from:no-reply@adp OR from:quickbooks@intuit OR subject:"payroll has been processed" OR subject:"payroll run") newer_than:14d',
            'attachment_required', false
        ),
        'payroll_runs',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','pay_date','payroll_provider'],
            'on_conflict', 'skip'
        ),
        true
    );

    -- 6. Producer Production Report Processor (Monthly 1st @ 4 AM CDT = 9 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Producer Production Report Processor',
        'Monthly: parses producer monthly production reports (forwarded by AGENT_FULL_NAME), extracts issued premium per producer per line of business via Groq, writes to producer_production. Feeds the HR & People Performance tab.',
        'cron', '0 9 1 * *',
        'GMAIL_FETCH_EMAILS', 'gmail',
        'You are parsing a State Farm producer production report. The report lists each producer (LSP) by name with policies issued and premium issued in the prior month, broken out by line of business (auto, fire/home, life, health, financial services). Extract one row per producer per LOB. Match producer names to the staff table by first_name+last_name (case-insensitive).',
        jsonb_build_object(
            'gmail_query', 'subject:"producer production" newer_than:7d',
            'attachment_required', true,
            'expected_format', 'pdf or xlsx'
        ),
        'producer_production',
        jsonb_build_object(
            'unique_on', ARRAY['agency_id','staff_id','period_year','period_month','line_of_business'],
            'on_conflict', 'update'
        ),
        true
    );

    -- 7. Email Archiver (8:00 AM CDT = 13:00 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        input_config,
        is_active
    ) VALUES (
        v_agency,
        'Email Archiver',
        'Archives older email and applies labels by subject/sender rules. Preserves starred. Primary inbox-maintenance recipe.',
        'cron', '0 13 * * *',
        'GMAIL_MODIFY_LABELS', 'gmail',
        jsonb_build_object(
            'gmail_query', '-is:starred -in:archive newer_than:60d older_than:30d',
            'add_labels', ARRAY['BCC/Archived'],
            'remove_labels', ARRAY['INBOX'],
            'preserve_starred', true,
            'archive_older_than_days', 30
        ),
        true
    );

    -- 8. GL Entry Writer (INTERNAL, 11:00 AM CDT = 16:00 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, internal_handler,
        is_active
    ) VALUES (
        v_agency,
        'GL Entry Writer',
        'Daily cash-basis reconciliation: walks unposted comp_recap rows and writes journal_entries per chart_of_accounts splits. Without this firing, Financials P&L stays at $0 even when comp_recap has rows.',
        'cron', '0 16 * * *',
        'INTERNAL', 'gl_entry_writer',
        true
    );

    -- 9. Daily Briefing Email (7:00 AM CDT = 12:00 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        groq_prompt, input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Daily Briefing Email',
        'Composes morning briefing via Groq from real data — revenue YTD, AIPP, top tasks, alerts, today social posts. Sends to AGENT_FULL_NAME via Gmail.',
        'cron', '0 12 * * *',
        'GMAIL_SEND_EMAIL', 'gmail',
        'You are writing the morning briefing for AGENT_FULL_NAME. Tone: warm, direct, partner-not-assistant. Open with one sentence on what matters most today, then the standard sections (where we are, today''s priorities, compliance upcoming, what I''m watching, what to ask me).',
        jsonb_build_object(
            'recipient', 'BRIEFING_RECIPIENT_EMAIL',
            'subject_template', 'Morning briefing — {{date}}'
        ),
        NULL,
        jsonb_build_object('log_to', 'daily_briefing_log'),
        true
    );

    -- 10. Social Media Scheduler (9:00 AM CDT = 14:00 UTC) — INACTIVE pending FB/LI connections
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, composio_connection,
        input_config, output_table, output_config,
        is_active
    ) VALUES (
        v_agency,
        'Social Media Scheduler',
        'Pulls today content_calendar items and posts to Facebook. Marks status=posted, saves post_url. INACTIVE until composio_facebook_account_id is added to settings (and a sibling LinkedIn recipe is split out for LINKEDIN_CREATE_POST).',
        'cron', '0 14 * * *',
        'FACEBOOK_POST_TO_PAGE', 'facebook',
        jsonb_build_object(
            'platform_filter', 'facebook',
            'status_filter', 'scheduled',
            'date_filter', 'today',
            'required_settings', ARRAY['composio_facebook_account_id','facebook_page_id']
        ),
        'content_calendar',
        jsonb_build_object(
            'unique_on', ARRAY['id'],
            'on_conflict', 'update',
            'update_fields', ARRAY['status','posted_at','post_url']
        ),
        false  -- inactive: connection not yet established
    );

    -- 11. Monthly Close Monitor (INTERNAL, 9:00 AM CDT = 14:00 UTC)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, internal_handler,
        is_active
    ) VALUES (
        v_agency,
        'Monthly Close Monitor',
        'Daily check of monthly_close_checklist. Mid-month flags overdue items via alerts. End-of-month creates next month''s checklist by template.',
        'cron', '0 14 * * *',
        'INTERNAL', 'monthly_close_monitor',
        true
    );

    -- 12. Producer Underperformance Watcher (INTERNAL, 12:00 UTC = 7:00 AM CDT)
    INSERT INTO public.automation_recipes (
        agency_id, recipe_name, recipe_description,
        trigger_type, cron_expression,
        composio_action, internal_handler,
        is_active
    ) VALUES (
        v_agency,
        'Producer Underperformance Watcher',
        'Daily check of each producer''s MTD pace vs 3-month rolling average. Fires alert + persistent_memory entry when any producer falls below 70% of pace.',
        'cron', '0 12 * * *',
        'INTERNAL', 'producer_underperformance_watcher',
        true
    );

    RAISE NOTICE 'Seeded 12 canonical recipes for agency %', v_agency;
END $$;;