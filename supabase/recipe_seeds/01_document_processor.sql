-- =============================================================================
-- BCC Recipe Seed 01: Document Processor
-- =============================================================================
-- Polls Gmail every 30 minutes for new attachments, classifies by docType,
-- archives to Drive, and routes bank statements through the full parse →
-- balanced JE → suspense pipeline. THE BUSIEST RECIPE. Front door for all
-- document intake.
--
-- PLACEHOLDERS TO REPLACE:
--   {{agency_id}}    The client's agency UUID
--
-- TYPE:        INTERNAL (no Composio call — handler dispatches to edge function)
-- HANDLER:     dispatch_document_processor
-- SCHEDULE:    7,37 * * * *  (twice hourly at :07 and :37, every hour, all day)
-- ACTIVE:      true (this is core — always seed active)
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
    'Document Processor',
    'Polls Gmail for new attachments twice per hour. Classifies each by docType (bank_statement, cc_statement, comp_recap, payroll, deduction_statement, production_report, other). Archives originals to Drive. Routes bank/CC statements through Groq parse, balanced journal entry creation, and suspense fallback for unclassifiable line items. Front door for all document intake.',
    'cron',
    '7,37 * * * *',
    'INTERNAL',
    'dispatch_document_processor',
    '{
        "poll_window_minutes": 30,
        "route_to_drive": true,
        "groq_parse_enabled": true,
        "suspense_on_classify_fail": true
    }'::jsonb,
    'documents',
    '{
        "conflict_keys": ["agency_id", "source_message_id"],
        "log_to_run_log": true
    }'::jsonb,
    true
);
