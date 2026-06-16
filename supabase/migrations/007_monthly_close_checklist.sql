-- ============================================================
-- 007 — MONTHLY CLOSE CHECKLIST TABLE
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- Tracks the source documents expected each month for monthly close.
-- The Dashboard MonthlyCloseWidget reads this to render a visual,
-- per-month status: closed months show as compact pills, the current
-- month shows item-by-item received vs. outstanding.
--
-- Each row is one expected document for one period.
--   doc_category — bank_statement, credit_statement, payroll,
--                  sf_recap, reconciliation, etc.
--   doc_label    — human-readable label (e.g. "Truist Operating x8842")
--   expected_by  — when the document is expected
--   received_at  — when it actually arrived (NULL = outstanding)
--   status       — expected | received | reconciled | na
--   is_closed    — TRUE once the period is locked
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_close_checklist (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID NOT NULL REFERENCES agency(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL,
  doc_category    TEXT NOT NULL,
  doc_label       TEXT NOT NULL,
  expected_by     DATE,
  received_at     DATE,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'expected',
  is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_close_period
  ON monthly_close_checklist(agency_id, period_year, period_month);

ALTER TABLE monthly_close_checklist ENABLE ROW LEVEL SECURITY;

-- Migration 005 picks this up dynamically since it has agency_id, but be
-- explicit in case 005 hasn't been re-run yet.
DROP POLICY IF EXISTS anon_read_monthly_close_checklist ON monthly_close_checklist;
CREATE POLICY anon_read_monthly_close_checklist
  ON monthly_close_checklist
  FOR SELECT TO anon USING (true);

GRANT SELECT ON monthly_close_checklist TO anon;
