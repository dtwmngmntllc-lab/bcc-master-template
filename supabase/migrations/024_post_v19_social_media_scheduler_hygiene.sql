-- =============================================================================
-- Migration: 024_post_v19_social_media_scheduler_hygiene
-- =============================================================================
-- Encodes two direct-UPDATE drifts from S10 and S20 into a versioned migration
-- so fresh installs reach the same end-state automatically:
--
--   1. S10 — Social Media Scheduler activated (seeded as is_active=false in 014)
--   2. S20 — input_config metadata rewritten to reflect V2 LinkedIn image posts
--            (V2 Edge Function deployed in S19; repo commits landed in S20)
--
-- Also updates recipe_description so the recipe self-documents its V2 surface,
-- replacing the V1 Facebook-only description in 014.
--
-- TEMPLATE-SAFE: filters by recipe_name only, no hardcoded agency UUIDs.
-- IDEMPOTENT: WHERE clauses make a re-run a no-op.
-- MULTI-TENANT-SAFE: applies to every install's Social Media Scheduler row.
-- =============================================================================

-- Step 1: Activate Social Media Scheduler.
-- V2 handles all platforms gracefully (instagram always manual; others fall to
-- requires_manual + alert when their connection is missing). So an active
-- recipe with no platform connections is harmless — daily 9am tick just logs
-- "0 posts due" until content_calendar is seeded AND a platform is connected.
UPDATE public.automation_recipes
SET
    is_active  = true,
    updated_at = now()
WHERE recipe_name = 'Social Media Scheduler'
  AND is_active = false;

-- Step 2: Refresh recipe_description to reflect V2 (Facebook + LinkedIn,
-- including LinkedIn native image upload).
UPDATE public.automation_recipes
SET
    recipe_description =
        'Pulls today''s content_calendar items and posts each to its platform '
        'via Composio. V2 supports: Facebook text + photo, LinkedIn text + '
        'single image (native LINKEDIN_INITIALIZE_IMAGE_UPLOAD -> PUT bytes -> '
        'CREATE_LINKED_IN_POST with images[].s3key=URN). Instagram is always '
        'requires_manual (no public API). When a platform''s '
        'composio_<platform>_account_id is missing in settings, the row is '
        'marked requires_manual with a diagnostic alert — no failure, no code '
        'change needed to enable a platform later.',
    updated_at = now()
WHERE recipe_name = 'Social Media Scheduler'
  AND recipe_description NOT LIKE '%V2 supports%';

-- Step 3: Replace input_config._v1_capabilities with _v2_capabilities + notes.
-- The runner doesn't read these keys — they're operator-facing metadata for
-- when the recipe is inspected via SQL or admin tooling.
UPDATE public.automation_recipes
SET
    input_config =
        (input_config - '_v1_capabilities')
        || jsonb_build_object(
            '_v2_capabilities', jsonb_build_object(
                'facebook',  'text + photo (requires composio_facebook_account_id + facebook_page_id)',
                'linkedin',  'text + single image (requires composio_linkedin_account_id + linkedin_author_urn); native upload via INITIALIZE_IMAGE_UPLOAD',
                'instagram', 'always manual (no public API)',
                'other',     'always manual'
            ),
            '_v2_notes',
                'V2 LinkedIn image upload: INITIALIZE_IMAGE_UPLOAD -> PUT '
                'bytes to presigned URL -> CREATE_LINKED_IN_POST with '
                'images[].s3key=<URN>. Max 5 MB per LinkedIn feed-share. '
                'Failures degrade to status=failed + diagnostic alert.'
          ),
    updated_at = now()
WHERE recipe_name = 'Social Media Scheduler'
  AND (input_config ? '_v1_capabilities'
       OR NOT (input_config ? '_v2_capabilities'));

-- Sanity check: confirm post-state matches expectation on every affected row.
DO $$
DECLARE
    v_total          INTEGER;
    v_in_post_state  INTEGER;
BEGIN
    SELECT count(*) INTO v_total
    FROM public.automation_recipes
    WHERE recipe_name = 'Social Media Scheduler';

    SELECT count(*) INTO v_in_post_state
    FROM public.automation_recipes
    WHERE recipe_name = 'Social Media Scheduler'
      AND is_active = true
      AND input_config ? '_v2_capabilities'
      AND NOT (input_config ? '_v1_capabilities')
      AND recipe_description LIKE '%V2 supports%';

    IF v_total <> v_in_post_state THEN
        RAISE WARNING
          'Migration 024: only %/% Social Media Scheduler rows reached the expected V2 state.',
          v_in_post_state, v_total;
    ELSE
        RAISE NOTICE
          'Migration 024: %/% Social Media Scheduler row(s) in expected V2 state.',
          v_in_post_state, v_total;
    END IF;
END $$;
