-- =========================================================================
-- 015_fix_composio_input_configs
-- =========================================================================
-- Session 6 (2026-06-12 evening). Per-agency, not in repo (like 014).
--
-- Rewrites the input_configs (and where needed, composio_action) for the
-- 9 non-INTERNAL recipes seeded in migration 014. The AUTOMATIONS_INSTALL.md
-- templates used field names from older Composio versions that don't match
-- the live v3 schemas. Confirmed against COMPOSIO_GET_TOOL_SCHEMAS this
-- session for GMAIL_FETCH_EMAILS, GMAIL_SEND_EMAIL, GMAIL_BATCH_MODIFY_MESSAGES,
-- FACEBOOK_CREATE_POST.
--
-- After this migration:
--   - 6 GMAIL_FETCH_EMAILS document processors are schema-valid and ready
--     for smoke-testing.
--   - Email Archiver (was GMAIL_MODIFY_LABELS, doesn't exist) renamed to
--     GMAIL_BATCH_MODIFY_MESSAGES with placeholder input_config; remains
--     inactive. Needs INTERNAL composer to populate messageIds at run-time
--     (the v3 modify endpoint takes IDs, not a query).
--   - Social Media Scheduler (was FACEBOOK_POST_TO_PAGE, doesn't exist)
--     renamed to FACEBOOK_CREATE_POST with placeholder; remains inactive.
--     Needs Facebook connection in Composio + composio_facebook_account_id
--     + facebook_page_id settings + INTERNAL composer reading content_calendar.
--   - Daily Briefing untouched (S5 patch uses correct GMAIL_SEND_EMAIL fields).
-- =========================================================================

-- ---- GMAIL_FETCH_EMAILS document processors ----
-- Real schema fields: query, max_results, user_id, verbose, ids_only,
-- label_ids, page_token, include_payload, include_spam_trash.
-- Removed fields (from old templates): gmail_query, attachment_required,
-- expected_format. has:attachment folded into the query string where needed.

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', '(from:notify@bank OR from:alerts@bank OR subject:"bank statement" OR subject:"account statement") newer_than:14d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Bank Statement Processor';

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', '(subject:"credit card statement" OR subject:"your statement is ready" OR from:alerts@chase OR from:noreply@americanexpress) newer_than:14d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Credit Card Statement Processor';

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', 'from:no-reply@statefarm.com subject:"deduction statement" has:attachment newer_than:14d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Deduction Statement Processor';

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', '(from:noreply@gusto OR from:no-reply@adp OR from:quickbooks@intuit OR subject:"payroll has been processed" OR subject:"payroll run") newer_than:14d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Payroll Processor';

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', 'subject:"producer production" has:attachment newer_than:7d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Producer Production Report Processor';

UPDATE public.automation_recipes
SET input_config = jsonb_build_object(
  'query', 'from:no-reply@statefarm.com subject:"daily comp" newer_than:2d',
  'max_results', 25
)
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'SF Daily Comp Processor';

-- ---- Email Archiver: rename action, stub schema-valid input_config ----
-- GMAIL_MODIFY_LABELS does not exist in Composio v3. Closest equivalent is
-- GMAIL_BATCH_MODIFY_MESSAGES, which requires precomputed messageIds. The
-- canonical archive workflow (fetch by query, modify by id) needs a two-step
-- pipeline; runner currently only handles single Composio calls per recipe.
-- Future fix: INTERNAL composer that fetches IDs then writes them into this
-- recipe's input_config.messageIds before firing — OR convert to a fully
-- INTERNAL recipe per the seed_bcc_automations.sql pattern.

UPDATE public.automation_recipes
SET composio_action = 'GMAIL_BATCH_MODIFY_MESSAGES',
    input_config = jsonb_build_object(
      '_TODO', 'Needs INTERNAL composer to populate messageIds from query',
      '_intended_query', '-is:starred -in:archive newer_than:60d older_than:30d',
      '_intended_add_label', 'BCC/Archived (label_id must be resolved via GMAIL_LIST_LABELS)',
      'messageIds', jsonb_build_array(),
      'addLabelIds', jsonb_build_array(),
      'removeLabelIds', jsonb_build_array('INBOX')
    ),
    is_active = false
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Email Archiver';

-- ---- Social Media Scheduler: rename action, stub schema-valid input_config ----
-- FACEBOOK_POST_TO_PAGE does not exist in Composio v3. Replacement is
-- FACEBOOK_CREATE_POST, requiring page_id + message. Activation also requires
-- a Facebook connection in Composio (no composio_facebook_account_id in
-- settings) and a facebook_page_id setting. Multi-step issue: this recipe
-- was meant to read content_calendar for today's scheduled posts; needs an
-- INTERNAL composer.

UPDATE public.automation_recipes
SET composio_action = 'FACEBOOK_CREATE_POST',
    input_config = jsonb_build_object(
      '_TODO', 'Needs (1) facebook connection in Composio + composio_facebook_account_id, (2) facebook_page_id setting, (3) INTERNAL composer reading content_calendar',
      'page_id', '__SET_facebook_page_id__',
      'message', '__placeholder; composer will populate from content_calendar__'
    ),
    is_active = false
WHERE agency_id = (SELECT id FROM public.agency LIMIT 1)
  AND recipe_name = 'Social Media Scheduler';
;
