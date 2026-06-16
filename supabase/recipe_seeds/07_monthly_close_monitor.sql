-- =============================================================================
-- BCC Recipe Seed 07: Monthly Close Monitor
-- =============================================================================
-- Daily check of monthly_close_checklist progress. Mid-month flags overdue
-- items via alerts; end-of-month rolls the next month's checklist by
-- triggering the Monthly Close Checklist Generator (recipe #10).
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     monthly_close_monitor
-- SCHEDULE:    0 14 * * *   (14:00 UTC daily)
-- ACTIVE:      true
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
    'Monthly Close Monitor',
    'Daily check of monthly_close_checklist progress. Mid-month flags items past their expected offset days as warning alerts. Near month-end raises severity to critical. On the last day, hands off to the Monthly Close Checklist Generator to roll the next month''s checklist. Keeps close on track without operator having to remember dates.',
    'cron',
    '0 14 * * *',
    'INTERNAL',
    'monthly_close_monitor',
    '{
        "mid_month_warn_offset_days": 2,
        "end_of_month_escalate": true,
        "alert_severity_warn": "warning",
        "alert_severity_critical": "critical"
    }'::jsonb,
    'alerts',
    '{
        "conflict_keys": ["agency_id", "checklist_item_id", "alert_date"],
        "skip_if_alerted_within_days": 1
    }'::jsonb,
    true
);
