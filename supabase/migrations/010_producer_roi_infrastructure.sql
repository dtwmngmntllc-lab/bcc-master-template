-- ============================================================
-- MIGRATION 010 — Producer ROI Infrastructure
-- ============================================================
-- (Renamed from 008 in May 2026 to resolve numbering collision
--  with 008_bridge_generator.sql. Run order: 010 runs last,
--  after all schema/seed/policy/view migrations.)
--
-- Adds agency-level commission rates (SMVC, blended, lapse) and a
-- producer_production table to drive the Performance tab's ROI
-- projection feature in the HR & People module.
--
-- Why this matters:
-- The Performance tab projects when each producer becomes profitable
-- against fully-loaded payroll cost. That requires knowing:
--   - The agent's commission rate (per A005 SMVC agreement)
--   - Each producer's monthly issued premium by line of business
--   - The agency's book lapse rate (auto+fire YTD prior vs current)
--
-- Required for:
-- - Path A (existing DB): apply during install if agency.smvc_rate_pc
--   is missing from the schema audit
-- - Path B (clean install): always apply, runs after migrations 001-007
--
-- Author: Imaginary Farms LLC
-- ============================================================

-- 1. Agency-level State Farm commission rates
ALTER TABLE agency
  ADD COLUMN IF NOT EXISTS smvc_rate_pc       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS blended_rate_other NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS lapse_rate_annual  NUMERIC(5,2);

COMMENT ON COLUMN agency.smvc_rate_pc       IS 'State Farm A005 SMVC commission rate for P&C (auto + fire). Percent, e.g. 10.00 means 10%.';
COMMENT ON COLUMN agency.blended_rate_other IS 'Blended commission rate for non-P&C lines (Life/Health/FS). Percent.';
COMMENT ON COLUMN agency.lapse_rate_annual  IS 'Manual override for annual book lapse rate. Percent. Null = compute from comp_recap.';

-- 2. Producer production — monthly issued premium per producer per LOB
-- Fed by Composio email-attachment recipe (when monthly producer reports
-- arrive) or manually entered during onboarding.
CREATE TABLE IF NOT EXISTS producer_production (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID NOT NULL REFERENCES agency(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL,
  line_of_business TEXT NOT NULL,
  policies_issued INTEGER NOT NULL DEFAULT 0,
  premium_issued  NUMERIC(12,2) NOT NULL DEFAULT 0,
  source_document_id UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, staff_id, period_year, period_month, line_of_business)
);

COMMENT ON TABLE producer_production IS 'Monthly issued premium per producer per line of business. Drives Performance tab ROI projection in HR & People module.';

CREATE INDEX IF NOT EXISTS idx_producer_production_period
  ON producer_production(agency_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_producer_production_staff
  ON producer_production(staff_id, period_year, period_month);

-- 3. RLS — anon read for the web app to display the data
ALTER TABLE producer_production ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_producer_production ON producer_production;
CREATE POLICY anon_read_producer_production ON producer_production
  FOR SELECT TO anon USING (true);

GRANT SELECT ON producer_production TO anon;
