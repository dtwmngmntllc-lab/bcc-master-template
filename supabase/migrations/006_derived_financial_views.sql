-- ============================================================
-- 006_derived_financial_views.sql
-- ============================================================
-- Creates v_income_statement and v_balance_sheet views consumed
-- by Dashboard.jsx and Financials.jsx. Replaces references to
-- non-existent tables income_statement_lines and gl_entries.
--
-- Run order: after migrations 001-005.
-- Re-runnable: uses CREATE OR REPLACE VIEW.
-- ============================================================

-- ── v_income_statement ───────────────────────────────────────
-- One row per (agency, period, account). Income/expense only.
-- Period derived from journal_entries.entry_date.
-- period_date = first day of the month (real DATE for sorting).
-- month/year are aliases of period_month/period_year for
-- consumer convenience (Dashboard.jsx and Financials.jsx read
-- r.month and r.year directly).
CREATE OR REPLACE VIEW v_income_statement AS
SELECT
  je.agency_id,
  EXTRACT(YEAR  FROM je.entry_date)::INT  AS period_year,
  EXTRACT(MONTH FROM je.entry_date)::INT  AS period_month,
  EXTRACT(YEAR  FROM je.entry_date)::INT  AS year,
  EXTRACT(MONTH FROM je.entry_date)::INT  AS month,
  TO_CHAR(je.entry_date, 'YYYY-MM')        AS period,
  DATE_TRUNC('month', je.entry_date)::DATE AS period_date,
  coa.id            AS account_id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  coa.account_subtype,
  SUM(jl.debit)     AS total_debit,
  SUM(jl.credit)    AS total_credit,
  CASE
    WHEN coa.account_type = 'income'  THEN SUM(jl.credit) - SUM(jl.debit)
    WHEN coa.account_type = 'expense' THEN SUM(jl.debit)  - SUM(jl.credit)
    ELSE 0
  END AS amount
FROM journal_lines jl
JOIN journal_entries  je  ON je.id  = jl.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jl.account_id
WHERE coa.account_type IN ('income', 'expense')
GROUP BY
  je.agency_id, je.entry_date, coa.id,
  coa.account_code, coa.account_name, coa.account_type, coa.account_subtype;

COMMENT ON VIEW v_income_statement IS
'Per-period (year-month) income and expense totals by account.
Replaces the non-existent income_statement_lines table.
Consumers: Dashboard.jsx, Financials.jsx.';

GRANT SELECT ON v_income_statement TO anon, authenticated;

-- ── v_balance_sheet ──────────────────────────────────────────
-- Running balance through today. Asset/liability/equity only.
-- balance is the natural-side total (debit-natural for assets,
-- credit-natural for liabilities and equity).
CREATE OR REPLACE VIEW v_balance_sheet AS
SELECT
  jl.agency_id,
  coa.id            AS account_id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  coa.account_subtype,
  SUM(jl.debit)     AS total_debit,
  SUM(jl.credit)    AS total_credit,
  CASE
    WHEN coa.account_type = 'asset'                 THEN SUM(jl.debit)  - SUM(jl.credit)
    WHEN coa.account_type IN ('liability','equity') THEN SUM(jl.credit) - SUM(jl.debit)
    ELSE 0
  END AS balance,
  MAX(je.entry_date) AS last_activity_date
FROM journal_lines jl
JOIN journal_entries  je  ON je.id  = jl.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jl.account_id
WHERE coa.account_type IN ('asset', 'liability', 'equity')
GROUP BY
  jl.agency_id, coa.id,
  coa.account_code, coa.account_name, coa.account_type, coa.account_subtype;

COMMENT ON VIEW v_balance_sheet IS
'Current running balance per account for asset, liability, and equity types.
Sums all journal_lines through today. Used by Financials.jsx balance sheet view.';

GRANT SELECT ON v_balance_sheet TO anon, authenticated;
