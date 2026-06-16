-- =============================================================================
-- BCC Recipe Seed 11: GL Entry Writer (base)
-- =============================================================================
--
-- 🌟 THE MOST IMPORTANT GL WRITER. Without this firing, the P&L stays at $0.
-- This is the single most common "why are my numbers zero" cause.
--
-- Daily cash-basis reconciliation. Walks unposted comp_recap rows and writes
-- journal_entries + journal_lines per chart_of_accounts splits. Runs FIRST in
-- the daily GL chain (16:00), before payroll (16:15), bank (16:30), and card
-- (16:45) writers so dependencies settle.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- Other config is read from the `settings` table (not the recipe row) so it
-- can be updated without redeploying the recipe:
--   - gl_chart_namespace               (e.g. "qbo", "xero")
--   - gl_cutover_date                  (e.g. "2026-05-01")
--   - gl_default_cash_account_name
--   - gl_default_sf_revenue_account_name
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     gl_entry_writer
-- SCHEDULE:    0 16 * * *   (16:00 UTC daily — FIRST in the daily GL chain)
-- ACTIVE:      true
-- IDEMPOTENT:  yes — re-running posts nothing already posted
-- CUTOVER:     pre-cutover comp_recap rows marked posted with note, NO JE
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
    'GL Entry Writer',
    'Daily cash-basis reconciliation writer. Walks unposted comp_recap rows and creates journal_entries + journal_lines using the agency''s chart_of_accounts splits. This is the FIRST writer in the daily GL chain (16:00) — payroll, bank, and card writers follow at 15-minute intervals so their dependencies settle. Without this firing, the P&L stays at $0. Pre-cutover rows are marked posted with a note and generate no JEs (already in imported history). Idempotent. Reads namespace, cutover date, and default account names from the settings table.',
    'cron',
    '0 16 * * *',
    'INTERNAL',
    'gl_entry_writer',
    '{
        "source_table": "comp_recap",
        "skip_pre_cutover": true,
        "idempotent": true,
        "config_source": "settings"
    }'::jsonb,
    'journal_entries',
    '{
        "conflict_keys": ["agency_id", "source_table", "source_id"],
        "namespace_from_settings": "gl_chart_namespace",
        "cutover_from_settings": "gl_cutover_date",
        "default_cash_from_settings": "gl_default_cash_account_name",
        "default_revenue_from_settings": "gl_default_sf_revenue_account_name"
    }'::jsonb,
    true
);
