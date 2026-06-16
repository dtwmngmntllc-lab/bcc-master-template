-- =============================================================================
-- BCC Recipe Seed 05b: Payroll GL Writer — TWO-ENTITY (intercompany)
-- =============================================================================
--
-- ⚠️ ONLY USE THIS IF THE CLIENT HAS A PARENT ENTITY ACTUALLY PAYING PAYROLL.
--
-- Use this variant when: the agency runs payroll through a parent S-Corp (or
-- other separate entity) and uses an intercompany due-to convention. Peter
-- Story State Farm is the reference case — PaperNewt LLC pays the payroll and
-- the agency books an intercompany payable.
--
-- POSTING CONVENTION:
--   DR  Payroll Costs (expense)
--   CR  Due to {{parent_entity_name}} (intercompany payable)
--
-- ❌ DO NOT USE 05b for typical agencies. Use 05a instead. Confirm entity
-- structure with the operator and ideally with the CPA before choosing this
-- variant — intercompany posting has tax and compliance implications.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}                       The client's agency UUID
--   {{parent_entity_name}}              Parent entity legal name (e.g. PaperNewt LLC)
--   {{intercompany_account_name}}       Liability account label
--                                       (e.g. "Due to PaperNewt LLC")
--   {{payroll_costs_account_path}}      Full chart path
--                                       (e.g. "0002 TEAM > Payroll Costs")
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
    'Posts post-cutover payroll_runs to journal_entries using the TWO-ENTITY intercompany convention. The parent entity ({{parent_entity_name}}) actually pays payroll; the agency books an intercompany payable. DR {{payroll_costs_account_path}}, CR {{intercompany_account_name}}. Pre-cutover runs are archive-only. Idempotent. Use this variant ONLY when entity structure genuinely requires it — verify with operator and CPA before activating.',
    'cron',
    '15 16 * * *',
    'INTERNAL',
    'payroll_gl_writer',
    '{
        "posting_convention": "two_entity_intercompany",
        "debit_account_path": "{{payroll_costs_account_path}}",
        "credit_account_name": "{{intercompany_account_name}}",
        "parent_entity_name": "{{parent_entity_name}}",
        "skip_pre_cutover": true,
        "idempotent": true,
        "cpa_verification_note": "Intercompany posting has tax/compliance implications. CPA should validate the convention at least annually."
    }'::jsonb,
    'journal_entries',
    '{
        "conflict_keys": ["agency_id", "source_table", "source_id"],
        "namespace_from_settings": "gl_chart_namespace",
        "cutover_from_settings": "gl_cutover_date"
    }'::jsonb,
    true
);
