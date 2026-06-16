-- =============================================================================
-- BCC Recipe Seed 13: Credit Card GL Writer
-- =============================================================================
-- Posts post-cutover credit_transactions to journal_entries. LAST in the
-- daily GL chain (16:45).
--
-- POSTING RULES:
--   Charge (−):  DR  expense account
--                CR  card liability account
--
--   Payment (+): DR  card liability account
--                CR  paying side (bank account, transfer, etc.)
--
-- RESOLUTION (charges only):
--   1. category match
--   2. classification rules
--   3. suspense account
--
-- ⚠️ NEVER FAILS TO POST — suspense is the catch-all.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     cc_gl_writer
-- SCHEDULE:    45 16 * * *   (16:45 UTC daily — LAST in GL chain)
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
    'Credit Card GL Writer',
    'Posts post-cutover credit_transactions to journal_entries. Last in the daily GL chain (16:45). Charges (negative amounts): DR expense, CR card liability. Payments to the card (positive amounts): DR card liability, CR paying side. Charge resolution waterfall: category match → classification rules → suspense. Never fails to post. Pre-cutover transactions are archive-only. Idempotent.',
    'cron',
    '45 16 * * *',
    'INTERNAL',
    'cc_gl_writer',
    '{
        "source_table": "credit_transactions",
        "charge_resolution_waterfall": [
            "category_match",
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
