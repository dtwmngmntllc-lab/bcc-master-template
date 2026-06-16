-- =============================================================================
-- BCC Recipe Seed 08: Social Media Scheduler — Facebook
-- =============================================================================
-- Posts approved content_calendar items to the agency's FB Page on schedule.
-- Writes the post_url back to the calendar row.
--
-- ⚠️ NOTE ON FACEBOOK INTEGRATION:
-- IF has historically used the direct Facebook Graph API for posting because
-- Composio's FB OAuth has been unreliable. The recipe is seeded with the
-- Composio action for consistency, but the edge function implementation may
-- route to direct Graph API. Check current edge function handler for which
-- path is active. Either way, the recipe row itself is the same.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        Composio FACEBOOK_POST_TO_PAGE (connection: facebook)
-- SCHEDULE:    0 14 * * *   (14:00 UTC daily)
-- ACTIVE:      false  ← INACTIVE — activate after FB page is connected AND
--                                  required settings exist
-- REQUIRES:    composio_facebook_account_id, facebook_page_id
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
    'Social Media Scheduler — Facebook',
    'Posts approved content_calendar items to the agency''s Facebook Page on their scheduled date. Selects rows where platform=facebook AND status=scheduled AND scheduled_date=CURRENT_DATE. After posting, updates the calendar row with status=posted, posted_at timestamp, and the returned post_url. Inactive by default — activate once Facebook is connected via Composio and the required settings exist. (Edge function may route through direct Facebook Graph API depending on Composio reliability; recipe row is unchanged either way.)',
    'cron',
    '0 14 * * *',
    'FACEBOOK_POST_TO_PAGE',
    'facebook',
    '{
        "platform_filter": "facebook",
        "status_filter": "scheduled",
        "date_filter": "today",
        "required_settings": ["composio_facebook_account_id", "facebook_page_id"]
    }'::jsonb,
    'content_calendar',
    '{
        "conflict_keys": ["id"],
        "update_fields": ["status", "posted_at", "post_url"]
    }'::jsonb,
    false
);
