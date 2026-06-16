-- =============================================================================
-- BCC Recipe Seed 06: Social Media Scheduler — Instagram
-- =============================================================================
-- Instagram has no public API for auto-posting (Meta blocks it for business
-- pages without elaborate approval). This recipe creates a high-priority
-- morning task reminding the operator to post manually — the caption and
-- hashtags are already prepared in the content_calendar row.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (creates a task, no external post)
-- HANDLER:     instagram_manual_reminder
-- SCHEDULE:    30 13 * * *   (13:30 UTC daily)
-- ACTIVE:      false  ← INACTIVE BY DEFAULT — flip true when operator wants
--                       the daily reminder workflow
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
    'Social Media Scheduler — Instagram',
    'Instagram has no public auto-post API for business pages. This recipe scans content_calendar daily for today''s platform=instagram items and creates a high-priority morning task reminding the operator to post manually. Caption and hashtags are already prepared in the calendar row — operator just copies, opens IG, and posts. Inactive by default; activate when the operator is ready to run the manual reminder workflow.',
    'cron',
    '30 13 * * *',
    'INTERNAL',
    'instagram_manual_reminder',
    '{
        "platform": "instagram",
        "task_priority": "high",
        "task_title_template": "Post to Instagram today: {{post_title}}"
    }'::jsonb,
    'tasks',
    '{
        "marker_field": "awaiting_manual_post",
        "conflict_keys": ["agency_id", "content_calendar_id", "task_date"]
    }'::jsonb,
    false
);
