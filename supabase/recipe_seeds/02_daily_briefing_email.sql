-- =============================================================================
-- BCC Recipe Seed 02: Daily Briefing Email
-- =============================================================================
-- Composes a morning HTML briefing dynamically from live data — pulls
-- comp_recap MTD, tasks, alerts, compliance_calendar, staff, aipp_tracking,
-- producer_production — inserts a briefings row, then sends via Composio Gmail.
--
-- ⚠️ FIELD-NAME GOTCHA (IF STANDING RULE):
--   Composio GMAIL_SEND_EMAIL requires fields named `recipient_email` and `body`.
--   Earlier templates used `recipient` / `subject_template` — WRONG.
--   Verify the live Composio tool schema before any change.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}        The client's agency UUID
--   {{recipient_email}}  Operator's PERSONAL email (NEVER @statefarm.com)
--   {{timezone}}         IANA tz (e.g. America/New_York, America/Chicago)
--
-- TYPE:        Composio GMAIL_SEND_EMAIL + handler daily_briefing_composer
-- SCHEDULE:    0 12 * * *   (12:00 UTC daily — adjust if not Central time)
-- ACTIVE:      true (will fail gracefully if Gmail not yet connected; flip
--              inactive only if you want to suppress failures during setup)
-- REQUIRES:    composio_gmail_account_id in settings
--              (declared in input_config.required_settings for runtime check)
-- =============================================================================

INSERT INTO automation_recipes (
    agency_id,
    recipe_name,
    recipe_description,
    trigger_type,
    cron_expression,
    composio_action,
    composio_connection,
    internal_handler,
    input_config,
    output_table,
    output_config,
    is_active
) VALUES (
    '{{agency_id}}'::uuid,
    'Daily Briefing Email',
    'Composes a morning HTML briefing dynamically from live data each morning. Pulls comp_recap MTD, tasks, alerts, compliance_calendar, staff, aipp_tracking, and producer_production. Inserts a briefings row (idempotent on agency_id + briefing_date), then sends the rendered HTML via Composio Gmail. Operator starts every day knowing where things stand without asking.',
    'cron',
    '0 12 * * *',
    'GMAIL_SEND_EMAIL',
    'gmail',
    'daily_briefing_composer',
    '{
        "tz": "{{timezone}}",
        "is_html": true,
        "recipient_email": "{{recipient_email}}",
        "required_settings": ["composio_gmail_account_id"],
        "sections": {
            "greeting": true,
            "where_we_are": true,
            "todays_priorities": true,
            "compliance_upcoming": true,
            "what_im_watching": true,
            "what_to_ask_me": true
        }
    }'::jsonb,
    'briefings',
    '{
        "conflict_keys": ["agency_id", "briefing_date"],
        "insert_before_send": true
    }'::jsonb,
    true
);
