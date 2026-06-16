-- =============================================================================
-- BCC Recipe Seed 04: Email Archiver
-- =============================================================================
-- Archives older email and files attachments to Drive by subject/sender rules,
-- logging each archived doc with a source link. Keeps Gmail manageable while
-- preserving everything in Drive.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (handler dispatches to email-archiver edge function)
-- HANDLER:     dispatch_email_archiver
-- SCHEDULE:    0 13 * * *   (13:00 UTC daily, after Document Processor settles)
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
    'Email Archiver',
    'Archives older email and files attachments to Google Drive by subject/sender rules. Preserves starred emails. Logs each archived document in the documents table with a source link back to Drive. Runs after the Document Processor has had time to pull anything financial-related, so this is purely the cleanup pass.',
    'cron',
    '0 13 * * *',
    'INTERNAL',
    'dispatch_email_archiver',
    '{
        "preserve_starred": true,
        "archive_older_than_days": 30,
        "route_attachments_to_drive": true,
        "drive_folder_template": "BCC/{{year}}/{{month}}/{{category}}"
    }'::jsonb,
    'documents',
    '{
        "conflict_keys": ["agency_id", "source_message_id"],
        "log_to_run_log": true
    }'::jsonb,
    true
);
