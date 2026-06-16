-- ============================================================================
-- Migration: 013_system_status.sql
-- ============================================================================
-- Purpose:
--   Classify every BCC component (recipe, table, integration, view,
--   edge_function, module) as one of:
--     operational_green     — working as designed
--     customization_pending — intentionally waiting on owner input
--                              (OAuth, data, decisions)
--     deferred              — deliberately not built (with reason)
--     needs_attention       — actual issue requiring fix
--
--   Background:
--   In Peter Story's install audit, the client's Project Claude flagged
--   recipes awaiting owner OAuth and tables awaiting owner-supplied data
--   as "broken" because nothing in the schema distinguished
--   "intentionally pending owner input" from "actually broken." This
--   migration adds that distinction at the schema level so every fresh
--   client Claude reads the system correctly from session one.
--
--   Read CLAUDE.md → "Customization Runway vs. Actual Issues" for the
--   client-facing framing rule that accompanies this table.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: system_status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_status (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_type           text NOT NULL
                              CHECK (component_type IN (
                                'recipe', 'table', 'integration',
                                'view', 'edge_function', 'module'
                              )),
  component_name           text NOT NULL,
  status                   text NOT NULL
                              CHECK (status IN (
                                'operational_green',
                                'customization_pending',
                                'deferred',
                                'needs_attention'
                              )),
  description              text,
  unlocks_when             text,           -- for customization_pending: what owner action lifts the pending state
  decided_against_reason   text,           -- for deferred: why this path is intentionally not built
  needs_attention_detail   text,           -- for needs_attention: what's wrong + suggested fix
  last_verified_at         timestamptz,    -- when an operator last confirmed status
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_status_unique UNIQUE (component_type, component_name)
);

CREATE INDEX IF NOT EXISTS idx_system_status_status
  ON public.system_status (status);
CREATE INDEX IF NOT EXISTS idx_system_status_type
  ON public.system_status (component_type);

COMMENT ON TABLE  public.system_status IS
  'Classification of every BCC component as operational / customization_pending / deferred / needs_attention. See CLAUDE.md → Customization Runway vs. Actual Issues.';
COMMENT ON COLUMN public.system_status.status IS
  'operational_green | customization_pending | deferred | needs_attention';
COMMENT ON COLUMN public.system_status.unlocks_when IS
  'For customization_pending only — the specific owner action that lifts the pending state.';
COMMENT ON COLUMN public.system_status.decided_against_reason IS
  'For deferred only — why this path is intentionally not built. Do not rebuild without owner direction.';
COMMENT ON COLUMN public.system_status.needs_attention_detail IS
  'For needs_attention only — what is wrong + suggested fix.';

-- ---------------------------------------------------------------------------
-- TRIGGER: keep updated_at fresh
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.system_status_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_status_updated_at ON public.system_status;
CREATE TRIGGER trg_system_status_updated_at
  BEFORE UPDATE ON public.system_status
  FOR EACH ROW EXECUTE FUNCTION public.system_status_set_updated_at();

-- ---------------------------------------------------------------------------
-- VIEW: v_customization_runway — what's pending the owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customization_runway AS
SELECT
  component_type,
  component_name,
  description,
  unlocks_when,
  last_verified_at
FROM public.system_status
WHERE status = 'customization_pending'
ORDER BY component_type, component_name;

COMMENT ON VIEW public.v_customization_runway IS
  'The runway: components intentionally awaiting the owner''s input. These are NOT bugs.';

-- ---------------------------------------------------------------------------
-- VIEW: v_system_issues — what actually needs fixing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_system_issues AS
SELECT
  component_type,
  component_name,
  description,
  needs_attention_detail,
  last_verified_at
FROM public.system_status
WHERE status = 'needs_attention'
ORDER BY component_type, component_name;

COMMENT ON VIEW public.v_system_issues IS
  'Genuine issues requiring fix. Distinct from customization_pending (owner runway) and deferred (decided-against paths).';

-- ---------------------------------------------------------------------------
-- ANON READ access (matches migration 005 pattern)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.system_status        TO anon, authenticated;
GRANT SELECT ON public.v_customization_runway TO anon, authenticated;
GRANT SELECT ON public.v_system_issues       TO anon, authenticated;

-- ============================================================================
-- SEED DATA — classifies all known master-template components
-- ============================================================================
-- These are the baseline classifications at install time. The owner's
-- Project Claude is expected to update last_verified_at and adjust statuses
-- as components are wired up and verified during onboarding.

-- ---------------------------------------------------------------------------
-- OPERATIONAL GREEN: core schema & code present at install
-- ---------------------------------------------------------------------------
INSERT INTO public.system_status
  (component_type, component_name, status, description)
VALUES
  ('table',  'clients',                 'operational_green', 'Core agency client master table'),
  ('table',  'chart_of_accounts',       'operational_green', 'GL chart of accounts (Club Capital / Xero style)'),
  ('table',  'journal_entries',         'operational_green', 'Cash-basis journal entry ledger'),
  ('table',  'monthly_close_checklist', 'operational_green', 'Per-month close discipline checklist (migration 007)'),
  ('view',   'v_income_statement',      'operational_green', 'Derived P&L view (migration 006)'),
  ('view',   'v_balance_sheet',         'operational_green', 'Derived balance sheet view (migration 006)'),
  ('edge_function', 'automation-runner','operational_green', 'Edge function dispatcher for recipe execution (migration 011)'),
  ('module', 'Dashboard',               'operational_green', 'Module 1 of 11 — overview UI'),
  ('module', 'Financials',              'operational_green', 'Module 2 — P&L / Balance Sheet / journal entry UI'),
  ('module', 'PersistentMemory',        'operational_green', 'Module — agent_memory inspection / editing UI')
ON CONFLICT (component_type, component_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CUSTOMIZATION PENDING: tables awaiting owner-supplied data
-- ---------------------------------------------------------------------------
INSERT INTO public.system_status
  (component_type, component_name, status, description, unlocks_when)
VALUES
  ('table', 'producers', 'customization_pending',
   'Per-producer roster for HR module and Producer ROI calculations',
   'Owner adds producer roster (names, hire dates, comp structures) during onboarding'),

  ('table', 'producer_performance_quarterly', 'customization_pending',
   'Quarterly producer scorecard rows feeding HR → Performance tab',
   'Owner uploads or enters quarterly ScoreCard / blended lapse data; supplies AIPP details'),

  ('table', 'commission_structures', 'customization_pending',
   'Per-producer commission structures for Producer ROI math',
   'Owner supplies each producer''s commission schedule'),

  ('table', 'compliance_rules_overrides', 'customization_pending',
   'Per-agency overrides on the seeded compliance rules library',
   'Owner reviews seeded rules (migration 002) and edits or adds agency-specific ones')
ON CONFLICT (component_type, component_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CUSTOMIZATION PENDING: integrations awaiting owner OAuth
-- ---------------------------------------------------------------------------
INSERT INTO public.system_status
  (component_type, component_name, status, description, unlocks_when)
VALUES
  ('integration', 'business_email (Composio)', 'customization_pending',
   'Owner business email connection; required for Bank Alert and Amazon Order ingestors and Email Archiver',
   'Owner completes Composio OAuth flow for primary business email account'),

  ('integration', 'google_drive (Composio)', 'customization_pending',
   'Owner Google Drive for document archival from Email Archiver',
   'Owner completes Composio OAuth flow for Google Drive'),

  ('integration', 'facebook_graph_api', 'customization_pending',
   'Direct Facebook Page API connection (bypasses Composio due to deprecated-scope bug)',
   'Owner provides Facebook Page ID and completes Graph API token authorization'),

  ('integration', 'linkedin (native edge function)', 'customization_pending',
   'LinkedIn posting via native Edge Function',
   'Owner authorizes LinkedIn connection'),

  ('integration', 'instagram (Composio)', 'customization_pending',
   'Instagram posting via Composio (note: API cannot schedule; daily manual login required)',
   'Owner authorizes Instagram via Composio')
ON CONFLICT (component_type, component_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CUSTOMIZATION PENDING: recipes awaiting upstream integration auth
-- ---------------------------------------------------------------------------
INSERT INTO public.system_status
  (component_type, component_name, status, description, unlocks_when)
VALUES
  ('recipe', 'document_processor', 'customization_pending',
   'Auto-classifies inbound documents and routes to GL writer',
   'Owner connects business_email and google_drive integrations'),

  ('recipe', 'email_archiver', 'customization_pending',
   'Archives client emails to Google Drive and indexes back to webapp',
   'Owner connects business_email and google_drive; owner supplies SF Drive folder ID'),

  ('recipe', 'daily_briefing_email', 'customization_pending',
   'Sends owner a daily briefing summarizing system activity',
   'Owner connects business_email and confirms send-to address'),

  ('recipe', 'producer_underperformance_watcher', 'customization_pending',
   'Watches producer_performance_quarterly for underperformance and alerts owner',
   'Owner populates producer roster and at least one quarter of performance data'),

  ('recipe', 'monthly_close_generator', 'customization_pending',
   'Generates the next month''s monthly_close_checklist rows on the 1st',
   'Initial agency_id and entity records populated (migration 004)'),

  ('recipe', 'monthly_close_monitor', 'customization_pending',
   'Notifies on overdue checklist items',
   'monthly_close_checklist has at least one open row')
ON CONFLICT (component_type, component_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- DEFERRED: paths deliberately not built
-- ---------------------------------------------------------------------------
INSERT INTO public.system_status
  (component_type, component_name, status, description, decided_against_reason)
VALUES
  ('recipe', 'real_time_bank_alert_parser', 'deferred',
   'Real-time parsing of bank email alerts to drive ledger entries',
   'Standing decision: the monthly bank statement is the source of truth. '
   'Real-time alerts add noise without reliable signal and contradict the '
   'cash-basis-at-close discipline. Do not propose rebuilding without '
   'explicit owner direction.')
ON CONFLICT (component_type, component_name) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION 013
-- ============================================================================
