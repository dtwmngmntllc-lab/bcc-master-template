-- ============================================================
-- BCC Schema Audit Query (diagnostic, NOT a DDL migration)
-- ============================================================
-- (Moved from supabase/migrations/007_schema_audit.sql in May 2026
--  to clarify that this is a diagnostic SELECT query, not a DDL
--  migration. Migrations are numbered 001-010; this query lives
--  in tools/ alongside the build-time schema-audit.js.)
--
-- Run this in the client's Supabase Studio SQL Editor during a
-- Path A (existing-database) install. It returns ~40 rows in three
-- sections:
--   1. TABLE AUDIT  — one per master table, status = ok / bridge_needed / missing
--   2. VIEW AUDIT   — v_income_statement and v_balance_sheet status
--   3. ANON ACCESS  — does the anon role have read grants
--
-- Read the result like this:
--   ok           → nothing to do
--   bridge_needed → legacy table exists; the legacy_name column tells
--                   you what to alias when calling bcc_generate_bridges()
--   missing       → run the matching migration or build a bridge
--
-- After running, see SCHEMA_NORMALIZATION_RUNBOOK.md for what to do
-- with each row.
-- ============================================================

-- ============================================================
-- BCC SCHEMA NORMALIZATION AUDIT
-- Run this ONCE in client Supabase Studio.
-- Returns 37 rows, one per master table, telling you exactly
-- what to do for each: nothing (ok), bridge a legacy name,
-- or apply a migration to create from scratch.
-- ============================================================

WITH audit AS (
  SELECT
    'agency' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agency') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['agencies','agency_record','company'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['agencies','agency_record','company']) LIMIT 1) AS legacy_name,
    ARRAY['agencies','agency_record','company']::text AS aliases_checked

UNION ALL
  SELECT
    'aipp_tracking' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='aipp_tracking') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['aipp','aipp_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['aipp','aipp_log']) LIMIT 1) AS legacy_name,
    ARRAY['aipp','aipp_log']::text AS aliases_checked

UNION ALL
  SELECT
    'alerts' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alerts') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['alert_log','notifications_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['alert_log','notifications_log']) LIMIT 1) AS legacy_name,
    ARRAY['alert_log','notifications_log']::text AS aliases_checked

UNION ALL
  SELECT
    'applicants' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='applicants') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['candidates','applicant_pool'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['candidates','applicant_pool']) LIMIT 1) AS legacy_name,
    ARRAY['candidates','applicant_pool']::text AS aliases_checked

UNION ALL
  SELECT
    'automation_recipes' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_recipes') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['recipes'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['recipes']) LIMIT 1) AS legacy_name,
    ARRAY['recipes']::text AS aliases_checked

UNION ALL
  SELECT
    'automation_run_log' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_run_log') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['recipe_runs','automation_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['recipe_runs','automation_log']) LIMIT 1) AS legacy_name,
    ARRAY['recipe_runs','automation_log']::text AS aliases_checked

UNION ALL
  SELECT
    'bank_accounts' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bank_accounts') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['bank_account_list'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['bank_account_list']) LIMIT 1) AS legacy_name,
    ARRAY['bank_account_list']::text AS aliases_checked

UNION ALL
  SELECT
    'chart_of_accounts' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chart_of_accounts') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['coa','accounts'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['coa','accounts']) LIMIT 1) AS legacy_name,
    ARRAY['coa','accounts']::text AS aliases_checked

UNION ALL
  SELECT
    'commission_structures' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='commission_structures') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['commissions','commission_rates'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['commissions','commission_rates']) LIMIT 1) AS legacy_name,
    ARRAY['commissions','commission_rates']::text AS aliases_checked

UNION ALL
  SELECT
    'comp_recap' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='comp_recap') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['compensation_recap','comp_recaps'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['compensation_recap','comp_recaps']) LIMIT 1) AS legacy_name,
    ARRAY['compensation_recap','comp_recaps']::text AS aliases_checked

UNION ALL
  SELECT
    'compliance_calendar' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='compliance_calendar') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['compliance_dates','compliance_schedule'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['compliance_dates','compliance_schedule']) LIMIT 1) AS legacy_name,
    ARRAY['compliance_dates','compliance_schedule']::text AS aliases_checked

UNION ALL
  SELECT
    'compliance_log' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='compliance_log') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['compliance_history','compliance_audit'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['compliance_history','compliance_audit']) LIMIT 1) AS legacy_name,
    ARRAY['compliance_history','compliance_audit']::text AS aliases_checked

UNION ALL
  SELECT
    'compliance_rules' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='compliance_rules') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['sf_compliance_rules','rules'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['sf_compliance_rules','rules']) LIMIT 1) AS legacy_name,
    ARRAY['sf_compliance_rules','rules']::text AS aliases_checked

UNION ALL
  SELECT
    'content_calendar' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='content_calendar') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['social_calendar','content_schedule'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['social_calendar','content_schedule']) LIMIT 1) AS legacy_name,
    ARRAY['social_calendar','content_schedule']::text AS aliases_checked

UNION ALL
  SELECT
    'credit_accounts' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_accounts') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['credit_card_accounts'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['credit_card_accounts']) LIMIT 1) AS legacy_name,
    ARRAY['credit_card_accounts']::text AS aliases_checked

UNION ALL
  SELECT
    'credit_transactions' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_transactions') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['credit_card_transactions'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['credit_card_transactions']) LIMIT 1) AS legacy_name,
    ARRAY['credit_card_transactions']::text AS aliases_checked

UNION ALL
  SELECT
    'daily_briefing_log' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_briefing_log') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['briefings','daily_briefings'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['briefings','daily_briefings']) LIMIT 1) AS legacy_name,
    ARRAY['briefings','daily_briefings']::text AS aliases_checked

UNION ALL
  SELECT
    'documents' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='documents') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['document_log','files'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['document_log','files']) LIMIT 1) AS legacy_name,
    ARRAY['document_log','files']::text AS aliases_checked

UNION ALL
  SELECT
    'goals' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goals') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['goal_list','objectives'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['goal_list','objectives']) LIMIT 1) AS legacy_name,
    ARRAY['goal_list','objectives']::text AS aliases_checked

UNION ALL
  SELECT
    'interviews' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interviews') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['interview_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['interview_log']) LIMIT 1) AS legacy_name,
    ARRAY['interview_log']::text AS aliases_checked

UNION ALL
  SELECT
    'journal_entries' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_entries') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['journal','ledger_entries','gl_entries'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['journal','ledger_entries','gl_entries']) LIMIT 1) AS legacy_name,
    ARRAY['journal','ledger_entries','gl_entries']::text AS aliases_checked

UNION ALL
  SELECT
    'journal_lines' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_lines') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['journal_line_items','ledger_lines','gl_lines'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['journal_line_items','ledger_lines','gl_lines']) LIMIT 1) AS legacy_name,
    ARRAY['journal_line_items','ledger_lines','gl_lines']::text AS aliases_checked

UNION ALL
  SELECT
    'notification_preferences' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_preferences') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['notification_prefs'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['notification_prefs']) LIMIT 1) AS legacy_name,
    ARRAY['notification_prefs']::text AS aliases_checked

UNION ALL
  SELECT
    'offers' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='offers') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['job_offers'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['job_offers']) LIMIT 1) AS legacy_name,
    ARRAY['job_offers']::text AS aliases_checked

UNION ALL
  SELECT
    'onboarding_checklists' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='onboarding_checklists') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['onboarding','onboarding_steps'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['onboarding','onboarding_steps']) LIMIT 1) AS legacy_name,
    ARRAY['onboarding','onboarding_steps']::text AS aliases_checked

UNION ALL
  SELECT
    'payroll_detail' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_detail') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['payroll_details','payroll_line_items'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['payroll_details','payroll_line_items']) LIMIT 1) AS legacy_name,
    ARRAY['payroll_details','payroll_line_items']::text AS aliases_checked

UNION ALL
  SELECT
    'payroll_runs' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_runs') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['payroll_history','payrolls'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['payroll_history','payrolls']) LIMIT 1) AS legacy_name,
    ARRAY['payroll_history','payrolls']::text AS aliases_checked

UNION ALL
  SELECT
    'persistent_memory' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='persistent_memory') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['memory','agent_memory_persistent'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['memory','agent_memory_persistent']) LIMIT 1) AS legacy_name,
    ARRAY['memory','agent_memory_persistent']::text AS aliases_checked

UNION ALL
  SELECT
    'positions' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='positions') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['job_positions','roles'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['job_positions','roles']) LIMIT 1) AS legacy_name,
    ARRAY['job_positions','roles']::text AS aliases_checked

UNION ALL
  SELECT
    'scoreboard_tracking' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scoreboard_tracking') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['scoreboard','scoreboard_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['scoreboard','scoreboard_log']) LIMIT 1) AS legacy_name,
    ARRAY['scoreboard','scoreboard_log']::text AS aliases_checked

UNION ALL
  SELECT
    'settings' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settings') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['app_settings','agency_settings'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['app_settings','agency_settings']) LIMIT 1) AS legacy_name,
    ARRAY['app_settings','agency_settings']::text AS aliases_checked

UNION ALL
  SELECT
    'social_accounts' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='social_accounts') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['social_media_accounts'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['social_media_accounts']) LIMIT 1) AS legacy_name,
    ARRAY['social_media_accounts']::text AS aliases_checked

UNION ALL
  SELECT
    'social_analytics' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='social_analytics') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['social_metrics','social_stats'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['social_metrics','social_stats']) LIMIT 1) AS legacy_name,
    ARRAY['social_metrics','social_stats']::text AS aliases_checked

UNION ALL
  SELECT
    'staff' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['employees','team_members','staff_members'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['employees','team_members','staff_members']) LIMIT 1) AS legacy_name,
    ARRAY['employees','team_members','staff_members']::text AS aliases_checked

UNION ALL
  SELECT
    'staff_performance' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_performance') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['performance_reviews','performance_log'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['performance_reviews','performance_log']) LIMIT 1) AS legacy_name,
    ARRAY['performance_reviews','performance_log']::text AS aliases_checked

UNION ALL
  SELECT
    'tasks' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['task_list','todos'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['task_list','todos']) LIMIT 1) AS legacy_name,
    ARRAY['task_list','todos']::text AS aliases_checked

UNION ALL
  SELECT
    'users' AS master_table,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['app_users'])) THEN 'bridge_needed'
      ELSE 'missing'
    END AS status,
    (SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY(ARRAY['app_users']) LIMIT 1) AS legacy_name,
    ARRAY['app_users']::text AS aliases_checked
),

view_check AS (
  SELECT
    'v_income_statement' AS view_name,
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_income_statement') AS exists
  UNION ALL
  SELECT
    'v_balance_sheet',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_balance_sheet')
),

anon_check AS (
  SELECT COUNT(*) AS anon_grant_count
  FROM information_schema.role_table_grants
  WHERE grantee = 'anon' AND table_schema = 'public'
)

-- Final report: 3 sections
SELECT '1. TABLE AUDIT' AS section, master_table AS item, status, legacy_name AS detail, aliases_checked AS note
FROM audit
UNION ALL
SELECT '2. VIEW AUDIT', view_name,
       CASE WHEN exists THEN 'ok' ELSE 'missing — apply migration 006' END,
       NULL, NULL
FROM view_check
UNION ALL
SELECT '3. ANON ACCESS', 'anon_grants',
       CASE WHEN anon_grant_count > 0 THEN 'ok' ELSE 'missing — apply migration 005' END,
       anon_grant_count::text, NULL
FROM anon_check
ORDER BY section, item;


-- ============================================================================
-- SECTION 4 — SYSTEM STATUS (added by migration 013)
-- ============================================================================
-- Runs independently of the 3-section audit above. Safe to run before
-- migration 013 has been applied: the existence check returns a single
-- diagnostic row and the second query is skipped.
--
-- Run this AFTER the 3-section audit, as a separate statement.
-- ----------------------------------------------------------------------------

-- 4a. Does system_status exist?
SELECT
  '4. SYSTEM STATUS' AS section,
  'system_status_table' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'system_status'
  ) THEN 'ok' ELSE 'missing — apply migration 013' END AS status,
  NULL::text AS detail,
  NULL::text AS note;

-- 4b. If present, summarize counts by status.
-- Returns no rows if the table is missing (the subquery WHERE-guards it).
SELECT
  '4. SYSTEM STATUS'              AS section,
  s.status                        AS item,
  COUNT(*)::text                  AS status_count,
  STRING_AGG(s.component_name, ', ' ORDER BY s.component_name) AS detail,
  NULL::text                      AS note
FROM public.system_status s
WHERE EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'system_status'
)
GROUP BY s.status
ORDER BY
  CASE s.status
    WHEN 'needs_attention'       THEN 1
    WHEN 'customization_pending' THEN 2
    WHEN 'deferred'              THEN 3
    WHEN 'operational_green'     THEN 4
  END;

-- ============================================================================
-- INTERPRETATION GUIDE (read with CLAUDE.md → Customization Runway vs. Actual Issues)
-- ============================================================================
-- needs_attention       → real issues. Address these.
-- customization_pending → owner runway. NOT bugs. Use v_customization_runway
--                         to see what owner action unlocks each one.
-- deferred              → intentionally not built. Has a written reason in
--                         decided_against_reason. Do not propose rebuilding
--                         without explicit owner direction.
-- operational_green     → working as designed.
-- ============================================================================
