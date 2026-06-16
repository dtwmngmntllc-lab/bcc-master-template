-- =============================================================================
-- BCC Recipe Seed 09: Social Media Scheduler — LinkedIn
-- =============================================================================
-- Posts approved content_calendar items to LinkedIn on schedule. Same pattern
-- as the Facebook recipe.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        Composio LINKEDIN_CREATE_POST (connection: linkedin)
-- SCHEDULE:    0 14 * * *   (14:00 UTC daily)
-- ACTIVE:      false  ← INACTIVE — activate after LinkedIn is connected
-- REQUIRES:    composio_linkedin_account_id
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
    input_config,
    output_table,
    output_config,
    is_active
) VALUES (
    '{{agency_id}}'::uuid,
    'Social Media Scheduler — LinkedIn',
    'Posts approved content_calendar items to the agency''s LinkedIn account on their scheduled date. Selects rows where platform=linkedin AND status=scheduled AND scheduled_date=CURRENT_DATE. After posting, updates the calendar row with status=posted, posted_at timestamp, and the returned post_url. Inactive by default — activate once LinkedIn is connected via Composio.',
    'cron',
    '0 14 * * *',
    'LINKEDIN_CREATE_POST',
    'linkedin',
    '{
        "platform_filter": "linkedin",
        "status_filter": "scheduled",
        "date_filter": "today",
        "required_settings": ["composio_linkedin_account_id"]
    }'::jsonb,
    'content_calendar',
    '{
        "conflict_keys": ["id"],
        "update_fields": ["status", "posted_at", "post_url"]
    }'::jsonb,
    false
);
