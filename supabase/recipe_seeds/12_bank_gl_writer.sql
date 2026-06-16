-- =============================================================================
-- BCC Recipe Seed 12: Bank GL Writer
-- =============================================================================
-- Posts post-cutover bank_transactions to journal_entries. THIRD in the daily
-- GL chain (16:30 — after base GL at 16:00 and payroll at 16:15).
--
-- RESOLUTION WATERFALL (in order — first match wins):
--   1. category match
--   2. split label match
--   3. classification rules
--   4. suspense account (catch-all)
--
-- Bank side resolved from bank_account_id, which is set upstream by the
-- Document Processor when it parses the bank statement.
--
-- ⚠️ NEVER FAILS TO POST — anything unclassifiable lands in suspense for
-- human review rather than blocking the close. This is the safety net pattern
-- that lets the daily GL chain run unattended.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     bank_gl_writer
-- SCHEDULE:    30 16 * * *   (16:30 UTC daily — third in GL chain)
-- ACTIVE:      true
-- IDEMPOTENT:  yes
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
    'Bank GL Writer',
    'Posts post-cutover bank_transactions to journal_entries. Third in the daily GL chain (16:30) — runs after base GL writer and payroll writer so their dependencies settle first. Bank side resolved from bank_account_id, which is set upstream by the Document Processor when it parses the bank statement. Resolution waterfall: category match → split label match → classification rules → suspense account. Never fails to post — unclassifiable transactions land in suspense for human review. Pre-cutover transactions are archive-only. Idempotent.',
    'cron',
    '30 16 * * *',
    'INTERNAL',
    'bank_gl_writer',
    '{
        "source_table": "bank_transactions",
        "resolution_waterfall": [
            "category_match",
            "split_label_match",
            "classification_rules",
            "suspense_account"
        ],
        "skip_pre_cutover": true,
        "idempotent": true,
        "never_fail_to_post": true
    }'::jsonb,
    'journal_entries',
    '{
        "conflict_keys": ["agency_id", "source_table", "source_id"],
        "namespace_from_settings": "gl_chart_namespace",
        "cutover_from_settings": "gl_cutover_date"
    }'::jsonb,
    true
);
