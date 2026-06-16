-- =============================================================================
-- BCC Recipe Seed 03: Producer Underperformance Watcher
-- =============================================================================
-- Daily check of each producer's MTD pace vs their 3-month rolling average.
-- Fires an alert when a producer is below 70% of pace through the current
-- point in the month.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (pure DB-to-DB)
-- HANDLER:     producer_underperformance_watcher
-- SCHEDULE:    0 12 * * *   (12:00 UTC daily)
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
    'Producer Underperformance Watcher',
    'Daily check of each producer''s month-to-date pace versus their 3-month rolling average. Fires an alert when a producer is tracking below 70% of expected pace through the current point in the month. Helps surface staffing/coaching issues before end of month.',
    'cron',
    '0 12 * * *',
    'INTERNAL',
    'producer_underperformance_watcher',
    '{
        "threshold_pct": 70,
        "rolling_window_months": 3,
        "alert_severity": "warning"
    }'::jsonb,
    'alerts',
    '{
        "conflict_keys": ["agency_id", "producer_id", "alert_date"],
        "skip_if_alerted_within_days": 7
    }'::jsonb,
    true
);
