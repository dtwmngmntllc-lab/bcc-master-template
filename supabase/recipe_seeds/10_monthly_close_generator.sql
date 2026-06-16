-- =============================================================================
-- BCC Recipe Seed 10: Monthly Close Checklist Generator
-- =============================================================================
--
-- 🌟 THE MOST VALUABLE RECIPE IN THE SET.
--
-- On the 1st of each month, generates the PRIOR month's close checklist from
-- the standard SF-agent template embedded in input_config. Idempotent — skips
-- a (period_year, period_month) that already has rows.
--
-- This is the cleanest example of encoding human accounting judgment into
-- recipe config. The `items[]` block is the standard SF-agent monthly close.
-- The `balance_review_items[]` block lists accounts that must be confirmed
-- each close UNTIL the CPA formally adjusts them — with the explicit standing
-- rule that Claude must NOT reclassify autonomously.
--
-- PLACEHOLDERS TO REPLACE (per client):
--   {{agency_id}}                  The client's agency UUID
--   {{bank_income_account_code}}   Client's income/deposit bank account code
--   {{bank_expenses_account_code}} Client's expenses bank account code
--   {{primary_card_label}}         Card label (e.g. "SF Card — Owner")
--   {{primary_card_code}}          Card account code
--   {{secondary_card_label}}       (optional) Second card label or DELETE the line
--   {{secondary_card_code}}        (optional) Second card account code
--
-- BALANCE-REVIEW PLACEHOLDERS (delete any that don't apply to the client):
--   {{personal_distribution_account_*}}  Personal/distribution accounts the CPA
--                                        hasn't yet adjusted to equity/distributions
--   {{legacy_personal_card_*}}           Personal cards on the books awaiting CPA
--
-- ⚠️ CRITICAL RULE preserved in config: balance_review_note instructs that
-- balance-review accounts MUST NOT be reclassified autonomously by Claude or
-- by automations — they are flagged for human/CPA review only.
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     monthly_close_generator
-- SCHEDULE:    0 14 1 * *   (14:00 UTC on the 1st of each month)
-- ACTIVE:      true
-- IDEMPOTENT:  yes — skip_if_exists prevents re-seeding
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
    'Monthly Close Checklist Generator',
    'On the 1st of each month, generates the prior month''s close checklist from the standard SF-agent template embedded in input_config. The template encodes accounting policy and required documents in the right order with realistic offset days. The balance_review_items block carries accounts that the CPA has not yet formally adjusted, with an explicit rule that Claude must NOT reclassify them autonomously. Idempotent — skip_if_exists guards against re-seeding the same period. Feeds the Monthly Close Monitor (recipe #07).',
    'cron',
    '0 14 1 * *',
    'INTERNAL',
    'monthly_close_generator',
    '{
        "generate_for": "previous_month",
        "skip_if_exists": true,
        "items": [
            {
                "doc_label": "SF Daily Comp Recaps — full month",
                "doc_category": "comp_recap_daily",
                "expected_offset_days": 3
            },
            {
                "doc_label": "Payroll Reports — all runs",
                "doc_category": "payroll",
                "expected_offset_days": 3
            },
            {
                "doc_label": "SF Deduction Statement",
                "doc_category": "deduction_statement",
                "expected_offset_days": 5
            },
            {
                "doc_label": "Producer Production Report (new premium Auto/Fire/Health by producer)",
                "doc_category": "production_report",
                "expected_offset_days": 5
            },
            {
                "doc_label": "Bank — Income/Deposit account statement",
                "account_code": "{{bank_income_account_code}}",
                "doc_category": "bank_statement",
                "expected_offset_days": 8
            },
            {
                "doc_label": "Bank — Expenses account statement",
                "account_code": "{{bank_expenses_account_code}}",
                "doc_category": "bank_statement",
                "expected_offset_days": 8
            },
            {
                "doc_label": "{{primary_card_label}} — statement",
                "account_code": "{{primary_card_code}}",
                "doc_category": "cc_statement",
                "expected_offset_days": 10
            },
            {
                "doc_label": "{{secondary_card_label}} — statement",
                "account_code": "{{secondary_card_code}}",
                "doc_category": "cc_statement",
                "expected_offset_days": 10
            },
            {
                "doc_label": "Reconcile COMP_RECAP to GL before closing",
                "doc_category": "reconciliation",
                "expected_offset_days": 10
            },
            {
                "doc_label": "Review imported transactions — flag uncategorized / suspense items",
                "doc_category": "review",
                "expected_offset_days": 10
            }
        ],
        "balance_review_note": "Carry these accounts on every monthly close until CPA formally adjusts them off the balance sheet (likely to distributions/equity). Do NOT reclassify autonomously. Remove from template once adjusted.",
        "balance_review_items": [
            {
                "doc_label": "Confirm balance: {{personal_distribution_account_1_label}} — carry until CPA adjusts",
                "account_code": "{{personal_distribution_account_1_code}}",
                "doc_category": "balance_review",
                "expected_offset_days": 10
            },
            {
                "doc_label": "Confirm balance: {{legacy_personal_card_1_label}} — carry until CPA adjusts",
                "account_code": "{{legacy_personal_card_1_code}}",
                "doc_category": "balance_review",
                "expected_offset_days": 10
            }
        ]
    }'::jsonb,
    'monthly_close_checklist',
    '{
        "conflict_keys": ["agency_id", "period_year", "period_month", "doc_label"],
        "log_to_run_log": true
    }'::jsonb,
    true
);
