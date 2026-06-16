-- =============================================================================
-- BCC Recipe Validation
-- =============================================================================
-- Run this AFTER seeding a client's automation_recipes to confirm everything
-- is in the right state. Returns a single readable report. No data is changed.
--
-- USAGE:
--   Set the agency_id at the top, then run the whole script.
--
-- WHAT IT CHECKS:
--   1. Recipe count (should be 13: 12 standard + 1 payroll variant)
--   2. Active vs inactive split (expected: 10 active, 3 inactive)
--   3. The daily GL chain timing (must be 16:00 -> 16:15 -> 16:30 -> 16:45)
--   4. Recipes marked active but missing required settings (= will fail)
--   5. Active recipes with required settings present (passing check)
--   6. Last 24h of automation_run_log (any failures?)
--   7. Final inventory list
--
-- INTERPRETATION:
--   pass   = no action needed
--   warn   = review before declaring install complete
--   fail   = must fix
--
-- SCHEMA NOTES:
--   - automation_recipes does NOT have a requires_setting_keys column.
--     Required settings are declared in input_config.required_settings (jsonb array).
--   - settings table column is setting_key (not key).
-- =============================================================================

\set agency_id '\'PUT-CLIENT-AGENCY-UUID-HERE\''

-- 1. Recipe count check ------------------------------------------------------
SELECT
    'recipe_count'                                              AS check_name,
    COUNT(*)                                                    AS actual,
    13                                                          AS expected,
    CASE
        WHEN COUNT(*) = 13 THEN 'pass'
        WHEN COUNT(*) <  13 THEN 'FAIL: missing ' || (13 - COUNT(*))::text || ' recipes - investigate'
        WHEN COUNT(*) >  13 THEN 'warn: extra recipes present (' || (COUNT(*) - 13)::text || ') - confirm intentional'
    END                                                         AS verdict
FROM automation_recipes
WHERE agency_id = :agency_id::uuid;

-- 2. Active / inactive split -------------------------------------------------
SELECT
    'active_inactive_split'                                                AS check_name,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END)                             AS active,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)                         AS inactive,
    '10 active / 3 inactive'                                               AS expected,
    CASE
        WHEN SUM(CASE WHEN is_active THEN 1 ELSE 0 END) = 10
         AND SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) = 3
        THEN 'pass'
        ELSE 'warn: split differs from default - check intentional activation/deactivation'
    END                                                                    AS verdict
FROM automation_recipes
WHERE agency_id = :agency_id::uuid;

-- 3. Daily GL chain timing check ---------------------------------------------
SELECT
    'gl_chain_timing'                                           AS check_name,
    recipe_name,
    cron_expression,
    CASE recipe_name
        WHEN 'GL Entry Writer'        THEN CASE WHEN cron_expression = '0 16 * * *'  THEN 'pass' ELSE 'FAIL: should be 0 16 * * * (16:00 UTC)' END
        WHEN 'Payroll GL Writer'      THEN CASE WHEN cron_expression = '15 16 * * *' THEN 'pass' ELSE 'FAIL: should be 15 16 * * * (16:15 UTC)' END
        WHEN 'Bank GL Writer'         THEN CASE WHEN cron_expression = '30 16 * * *' THEN 'pass' ELSE 'FAIL: should be 30 16 * * * (16:30 UTC)' END
        WHEN 'Credit Card GL Writer'  THEN CASE WHEN cron_expression = '45 16 * * *' THEN 'pass' ELSE 'FAIL: should be 45 16 * * * (16:45 UTC)' END
    END                                                         AS verdict
FROM automation_recipes
WHERE agency_id = :agency_id::uuid
  AND recipe_name IN (
      'GL Entry Writer',
      'Payroll GL Writer',
      'Bank GL Writer',
      'Credit Card GL Writer'
  )
ORDER BY cron_expression;

-- 4. Active recipes missing required settings (THESE WILL FAIL ON FIRST RUN) -
-- Required settings live in input_config.required_settings (jsonb array of strings).
WITH recipe_required_settings AS (
    SELECT
        r.recipe_name,
        r.agency_id,
        jsonb_array_elements_text(r.input_config->'required_settings') AS required_key
    FROM automation_recipes r
    WHERE r.agency_id = :agency_id::uuid
      AND r.is_active = true
      AND r.input_config ? 'required_settings'
)
SELECT
    'active_missing_settings'                                   AS check_name,
    rs.recipe_name,
    array_agg(rs.required_key)                                  AS missing,
    'FAIL: active recipe is missing required settings - recipe WILL FAIL until settings added or recipe deactivated' AS verdict
FROM recipe_required_settings rs
WHERE NOT EXISTS (
    SELECT 1 FROM settings s
    WHERE s.setting_key = rs.required_key
      AND s.agency_id = rs.agency_id
)
GROUP BY rs.recipe_name;
-- If this returns zero rows, all active recipes have their settings.

-- 5. Active recipes whose required settings ARE present ----------------------
WITH recipe_required_settings AS (
    SELECT
        r.recipe_name,
        r.agency_id,
        jsonb_array_elements_text(r.input_config->'required_settings') AS required_key
    FROM automation_recipes r
    WHERE r.agency_id = :agency_id::uuid
      AND r.is_active = true
      AND r.input_config ? 'required_settings'
)
SELECT
    'active_with_settings_ok'                AS check_name,
    rs.recipe_name,
    array_agg(rs.required_key)               AS required_settings,
    'pass: all required settings present'    AS verdict
FROM recipe_required_settings rs
WHERE EXISTS (
    SELECT 1 FROM settings s
    WHERE s.setting_key = rs.required_key
      AND s.agency_id = rs.agency_id
)
GROUP BY rs.recipe_name
HAVING COUNT(*) = (
    SELECT COUNT(*) FROM recipe_required_settings rs2
    WHERE rs2.recipe_name = rs.recipe_name
);

-- 6. Last 24h run log summary ------------------------------------------------
SELECT
    'recent_run_log'                                            AS check_name,
    status,
    COUNT(*)                                                    AS count,
    MAX(run_at)                                                 AS most_recent,
    CASE
        WHEN status = 'failed' AND COUNT(*) > 0 THEN 'warn: failures present - drill into automation_run_log to investigate'
        WHEN status = 'success' THEN 'pass: runs succeeding'
        ELSE 'info'
    END                                                         AS verdict
FROM automation_run_log
WHERE agency_id = :agency_id::uuid
  AND run_at > now() - interval '24 hours'
GROUP BY status
ORDER BY status;

-- 7. Final inventory list -----------------------------------------------------
SELECT
    'final_inventory'                                            AS check_name,
    recipe_name,
    cron_expression,
    CASE WHEN composio_action = 'INTERNAL' THEN 'INTERNAL' ELSE composio_action END AS action,
    is_active,
    last_run_at,
    last_run_status
FROM automation_recipes
WHERE agency_id = :agency_id::uuid
ORDER BY cron_expression, recipe_name;
