-- =============================================================================
-- BCC Recipe Seed 05a: Payroll GL Writer — SINGLE-ENTITY
-- =============================================================================
--
-- ⚠️ THIS IS THE DEFAULT. USE THIS FOR 90% OF AGENCIES.
--
-- Use this variant when: the agency pays its own payroll out of its own
-- operating bank account. No parent entity. No intercompany due-to account.
-- This is the structure for almost every State Farm agent we onboard.
--
-- POSTING CONVENTION:
--   DR  Payroll Costs (expense)
--   CR  Operating Cash / Bank (the account that actually pays the payroll)
--
-- ❌ DO NOT USE 05a IF the client runs payroll through a parent entity that
-- bills the agency via intercompany. Use 05b instead. Confirm entity structure
-- with the operator BEFORE choosing.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}                         The client's agency UUID
--   {{payroll_cash_account_name}}         The bank account that pays payroll
--                                         (usually same as default_cash_account)
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     payroll_gl_writer
-- SCHEDULE:    15 16 * * *   (16:15 UTC daily — runs AFTER base GL writer at 16:00)
-- ACTIVE:      true
-- IDEMPOTENT:  yes — re-running posts nothing already posted
-- CUTOVER:     pre-cutover runs are archive-only (no JE generated)
-- =============================================================================

INSERT INTO automation_recipes (
    agency_id,
    recipe_name,
    recipe_description,
    trigger_type,
    cron_expression,
    composio_action,
    internal_handler,
    input_config,
    output_table,
    output_config,
    is_active
) VALUES (
    '{{agency_id}}'::uuid,
    'Payroll GL Writer',
    'Posts post-cutover payroll_runs to journal_entries using the single-entity convention: DR Payroll Costs, CR Operating Cash. The agency pays its own payroll out of its own bank account — no parent entity, no intercompany. Pre-cutover payroll runs are archive-only (already in the imported QBO/Xero history). Idempotent — safe to re-run.',
    'cron',
    '15 16 * * *',
    'INTERNAL',
    'payroll_gl_writer',
    '{
        "posting_convention": "single_entity",
        "credit_account_name": "{{payroll_cash_account_name}}",
        "skip_pre_cutover": true,
        "idempotent": true
    }'::jsonb,
    'journal_entries',
    '{
        "conflict_keys": ["agency_id", "source_table", "source_id"],
        "namespace_from_settings": "gl_chart_namespace",
        "cutover_from_settings": "gl_cutover_date"
    }'::jsonb,
    true
);
