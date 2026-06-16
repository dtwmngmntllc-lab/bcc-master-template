
CREATE OR REPLACE FUNCTION public.demo_reset()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  demo_agency_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  curr_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  curr_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  m INT;
  yr INT;
  mo INT;
  factor NUMERIC;
  new_biz NUMERIC;
  renewal NUMERIC;
  life NUMERIC;
  total_comm NUMERIC;
  aipp NUMERIC;
  sb NUMERIC;
  gross NUMERIC;
  comm_pay NUMERIC;
  total_pay NUMERIC;
  rent NUMERIC;
  util NUMERIC;
  health NUMERIC;
  eo NUMERIC;
  mkt NUMERIC;
  entry_id UUID;
  acct_checking UUID;
  acct_new_biz UUID;
  acct_renewal UUID;
  acct_life UUID;
  acct_aipp UUID;
  acct_sb UUID;
  acct_payroll UUID;
  acct_commissions UUID;
  acct_health UUID;
  acct_rent UUID;
  acct_util UUID;
  acct_mkt UUID;
  acct_eo UUID;
  pay_day INT;
  pay_days INT[] := ARRAY[1, 15];
BEGIN
  -- ============================================================
  -- 1. TRUNCATE volatile tables (preserve schema, static seeds)
  -- ============================================================
  -- Truncate volatile tables only. Do NOT include agency, compliance_rules, or
  -- chart_of_accounts because those are static seeds (populated by migrations 002/003)
  -- and TRUNCATE CASCADE would wipe them via FK to agency.
  TRUNCATE
    monthly_close_checklist,
    journal_lines, journal_entries,
    credit_transactions,
    payroll_detail, payroll_runs,
    comp_recap, aipp_tracking, scoreboard_tracking,
    automation_run_log,
    daily_briefing_log,
    social_analytics, content_calendar, social_accounts,
    tasks, alerts, goals,
    interviews, offers, applicants, onboarding_checklists, staff_performance,
    commission_structures,
    producer_production,
    persistent_memory,
    documents,
    credit_accounts, bank_accounts,
    staff,
    automation_recipes,
    notification_preferences,
    settings,
    users
  RESTART IDENTITY CASCADE;

  -- ============================================================
  -- 2. UPSERT AGENCY + RE-CREATE MEMORY
  -- ============================================================
  INSERT INTO agency (
    id, name, owner_name, entity_type, tax_id, state_farm_agent_code,
    licensing_states, primary_email, phone, address, google_account_email,
    vercel_url, setup_date, status,
    smvc_rate_pc, blended_rate_other, lapse_rate_annual
  ) VALUES (
    demo_agency_id, 'Sunshine State Insurance', 'Sam Jordan', 'S-Corp',
    '12-3456789', 'FL 34-721S', ARRAY['FL','GA','AL'],
    'demo@imaginary-farms.com', '(813) 555-0100', '1234 Bayshore Blvd, Tampa, FL 33606',
    'demo@imaginary-farms.com', 'https://demo.imaginary-farms.com',
    CURRENT_DATE - INTERVAL '700 days', 'active',
    10.00, 9.00, NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    owner_name = EXCLUDED.owner_name,
    status = EXCLUDED.status,
    smvc_rate_pc = EXCLUDED.smvc_rate_pc,
    blended_rate_other = EXCLUDED.blended_rate_other,
    lapse_rate_annual = EXCLUDED.lapse_rate_annual,
    updated_at = NOW();

  INSERT INTO persistent_memory (agency_id, category, title, content, added_by, source) VALUES
  (demo_agency_id, 'agency_profile',    'Business Overview',         'Sunshine State Insurance is a State Farm agency in Tampa FL serving FL/GA/AL. Established 2018. S-Corp with Sam Jordan as owner. Focus on auto, home, and life insurance with growing financial services book. Currently 8 staff members.', 'system', 'demo_seed'),
  (demo_agency_id, 'business_rules',    'Communication Preferences', 'Direct communication style. Email for non-urgent matters, phone for urgent. Loves data-driven insights. Prefers concise summaries with clear action items.', 'system', 'demo_seed'),
  (demo_agency_id, 'goals',             'Annual Goals',              'Hit AIPP target of $85K. Grow team from 8 to 10 staff. Launch financial services cross-sell campaign in Q2. Achieve top-quartile scoreboard ranking.', 'system', 'demo_seed'),
  (demo_agency_id, 'staff',             'Team Structure',            'Sam Jordan (owner/agent), Marcus Chen (office manager), Priya Patel (LSP), Tasha Williams (LSP), David Rodriguez (LSP), Emily Tran (CSR), Brandon Hill (CSR), Olivia Brooks (financial services specialist).', 'system', 'demo_seed'),
  (demo_agency_id, 'compliance_notes',  'Active Compliance Posture', 'Annual licensing renewals on schedule. P&C licenses current in FL/GA/AL. Life license active in FL. Office passed last SF compliance audit with zero findings.', 'system', 'demo_seed'),
  (demo_agency_id, 'financial_context', 'Financial Health Snapshot', 'Strong cash position. Monthly burn averaging $42K. Q1 revenue tracking 12% above prior year baseline. AIPP YTD at 28% achievement.', 'system', 'demo_seed');

  -- ============================================================
  -- 3. STAFF
  -- ============================================================
  INSERT INTO staff (agency_id, first_name, last_name, role, employment_type, start_date, is_active, email, phone, pay_type, pay_rate, notes) VALUES
  (demo_agency_id, 'Sam', 'Jordan', 'Owner / Agent', 'w2', CURRENT_DATE - INTERVAL '7 years', TRUE, 'sam@demo.com', '(813) 555-0100', 'salary', 95000, 'Owner of record. SF Agent code FL 34-721S.'),
  (demo_agency_id, 'Marcus', 'Chen', 'Office Manager', 'w2', CURRENT_DATE - INTERVAL '6 years', TRUE, 'marcus@demo.com', '(813) 555-0101', 'salary', 62000, 'Runs daily ops.'),
  (demo_agency_id, 'Priya', 'Patel', 'Licensed Sales Producer', 'w2', CURRENT_DATE - INTERVAL '5 years', TRUE, 'priya@demo.com', '(813) 555-0102', 'commission', 38000, 'Top producer. P&C licensed FL/GA.'),
  (demo_agency_id, 'Tasha', 'Williams', 'Licensed Sales Producer', 'w2', CURRENT_DATE - INTERVAL '4 years', TRUE, 'tasha@demo.com', '(813) 555-0103', 'commission', 35000, 'P&C + Life licensed FL.'),
  (demo_agency_id, 'David', 'Rodriguez', 'Licensed Sales Producer', 'w2', CURRENT_DATE - INTERVAL '3 years', TRUE, 'david@demo.com', '(813) 555-0104', 'commission', 32000, 'Bilingual EN/ES.'),
  (demo_agency_id, 'Emily', 'Tran', 'Customer Service Rep', 'w2', CURRENT_DATE - INTERVAL '2 years', TRUE, 'emily@demo.com', '(813) 555-0105', 'hourly', 22, 'Service-focused.'),
  (demo_agency_id, 'Brandon', 'Hill', 'Customer Service Rep', 'w2', CURRENT_DATE - INTERVAL '1 year', TRUE, 'brandon@demo.com', '(813) 555-0106', 'hourly', 21, 'Studying for P&C.'),
  (demo_agency_id, 'Olivia', 'Brooks', 'Financial Services Specialist', 'w2', CURRENT_DATE - INTERVAL '2 years', TRUE, 'olivia@demo.com', '(813) 555-0107', 'commission', 45000, 'Series 6/63 + Life.');

  -- ============================================================
  -- 4. BANK + CREDIT + AIPP
  -- ============================================================
  INSERT INTO bank_accounts (agency_id, account_name, institution, account_type, account_number_last4, current_balance, as_of_date, is_primary, is_active) VALUES
  (demo_agency_id, 'Operating Checking', 'Truist Bank', 'checking', '8842', 145320.50, CURRENT_DATE, TRUE, TRUE),
  (demo_agency_id, 'Reserve Savings',    'Truist Bank', 'savings',  '5519', 80125.00,  CURRENT_DATE, FALSE, TRUE),
  (demo_agency_id, 'Payroll Account',    'Truist Bank', 'checking', '3107', 28450.75,  CURRENT_DATE, FALSE, TRUE);

  INSERT INTO credit_accounts (agency_id, account_name, institution, account_type, account_number_last4, credit_limit, current_balance, available_credit, interest_rate, payment_due_day, is_active) VALUES
  (demo_agency_id, 'Business Visa',  'Chase Ink', 'credit_card',    '4421', 25000, 3842.50, 21157.50, 18.99, 15, TRUE),
  (demo_agency_id, 'Equipment Line', 'Truist',    'line_of_credit', '7720', 50000, 12500,   37500,    8.5,   1, TRUE);

  -- AIPP target & earnings derived from producer_production (P&C premium issued × 5%)
  -- Per A005 contract, AIPP is typically 5% of newly issued P&C premium, paid annually
  -- in tiers based on production targets. We compute the agency's actual earnings from
  -- the producer data we just seeded so the numbers match what's shown in HR & People.
  WITH pc_ytd AS (
    SELECT COALESCE(SUM(premium_issued), 0) AS total
    FROM producer_production
    WHERE agency_id = demo_agency_id
      AND line_of_business IN ('auto','fire')
      AND period_year = curr_year
      AND period_month <= curr_month
  )
  INSERT INTO aipp_tracking (agency_id, program_year, target_amount, earned_ytd, projected_full_year, achievement_percentage, notes)
  SELECT
    demo_agency_id,
    curr_year,
    48000,                                                                 -- target ($48K — modest stretch above last year)
    ROUND(pc_ytd.total * 0.05, 0)                            AS earned_ytd,
    ROUND((pc_ytd.total / GREATEST(1, curr_month)) * 12 * 0.05, 0) AS projected_full_year,
    ROUND((pc_ytd.total * 0.05 / 48000) * 100, 1)            AS achievement_percentage,
    'Computed from YTD P&C premium issued × 5% per A005 SMVC AIPP schedule. Target $48K reflects 14% growth over prior year actual.'
  FROM pc_ytd;

  -- ============================================================
  -- 5. JOURNAL ENTRIES — 12 months relative to today, fresh dates
  -- ============================================================
  -- Look up account IDs (chart_of_accounts is preserved)
  SELECT id INTO acct_checking    FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='1010';
  SELECT id INTO acct_new_biz     FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='4010';
  SELECT id INTO acct_renewal     FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='4020';
  SELECT id INTO acct_life        FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='4030';
  SELECT id INTO acct_aipp        FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='4110';
  SELECT id INTO acct_sb          FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='4120';
  SELECT id INTO acct_payroll     FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6000';
  SELECT id INTO acct_commissions FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6040';
  SELECT id INTO acct_health      FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6110';
  SELECT id INTO acct_rent        FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6210';
  SELECT id INTO acct_util        FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6220';
  SELECT id INTO acct_mkt         FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6400';
  SELECT id INTO acct_eo          FROM chart_of_accounts WHERE agency_id=demo_agency_id AND account_code='6610';

  -- Generate 12 months of activity
  FOR m IN 0..11 LOOP
    -- Compute target month (working backwards)
    yr := EXTRACT(YEAR  FROM (CURRENT_DATE - (m * INTERVAL '1 month')))::INT;
    mo := EXTRACT(MONTH FROM (CURRENT_DATE - (m * INTERVAL '1 month')))::INT;
    factor := CASE mo
      WHEN 1 THEN 0.85 WHEN 2 THEN 0.90 WHEN 3 THEN 1.05 WHEN 4 THEN 1.10
      WHEN 5 THEN 1.15 WHEN 6 THEN 1.20 WHEN 7 THEN 1.10 WHEN 8 THEN 1.05
      WHEN 9 THEN 0.95 WHEN 10 THEN 0.90 WHEN 11 THEN 0.85 WHEN 12 THEN 1.00
    END;

    new_biz := ROUND((8500 + random() * 5500)::NUMERIC * factor, 2);
    renewal := ROUND((18000 + random() * 6000)::NUMERIC * factor, 2);
    life    := ROUND((1200 + random() * 2300)::NUMERIC * factor, 2);
    total_comm := new_biz + renewal + life;

    -- Commission deposit
    entry_id := uuid_generate_v4();
    INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
      (entry_id, demo_agency_id, MAKE_DATE(yr, mo, 15), 'standard',
       'SF monthly commission deposit — ' || TO_CHAR(MAKE_DATE(yr, mo, 1), 'Month YYYY'), 'demo_seed');
    INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
      (entry_id, demo_agency_id, acct_checking, total_comm, 0, 'SF commission deposit'),
      (entry_id, demo_agency_id, acct_new_biz,  0, new_biz,  'New business commission'),
      (entry_id, demo_agency_id, acct_renewal,  0, renewal,  'Renewal commission'),
      (entry_id, demo_agency_id, acct_life,     0, life,     'Life insurance commission');

    -- Quarterly AIPP
    IF mo IN (3, 6, 9, 12) THEN
      aipp := ROUND((4500 + random() * 3000)::NUMERIC * factor, 2);
      entry_id := uuid_generate_v4();
      INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
        (entry_id, demo_agency_id, MAKE_DATE(yr, mo, 20), 'standard',
         'AIPP quarterly bonus — Q' || ((mo-1)/3 + 1) || ' ' || yr, 'demo_seed');
      INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
        (entry_id, demo_agency_id, acct_checking, aipp, 0, 'AIPP bonus deposit'),
        (entry_id, demo_agency_id, acct_aipp,     0, aipp, 'AIPP quarterly bonus');
    END IF;

    -- Year-end ScoreBoard
    IF mo = 12 THEN
      sb := ROUND((8000 + random() * 7000)::NUMERIC, 2);
      entry_id := uuid_generate_v4();
      INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
        (entry_id, demo_agency_id, MAKE_DATE(yr, mo, 28), 'standard',
         'ScoreBoard annual bonus — ' || yr, 'demo_seed');
      INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
        (entry_id, demo_agency_id, acct_checking, sb, 0, 'ScoreBoard bonus'),
        (entry_id, demo_agency_id, acct_sb,       0, sb, 'ScoreBoard performance bonus');
    END IF;

    -- Bi-monthly payroll
    FOREACH pay_day IN ARRAY pay_days LOOP
      gross := ROUND((11500 + random() * 2000)::NUMERIC, 2);
      comm_pay := ROUND((3500 + random() * 2000)::NUMERIC, 2);
      total_pay := gross + comm_pay;
      entry_id := uuid_generate_v4();
      INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
        (entry_id, demo_agency_id, MAKE_DATE(yr, mo, LEAST(pay_day, 28)), 'standard',
         'Payroll run — ' || TO_CHAR(MAKE_DATE(yr, mo, 1), 'Mon') || ' ' || pay_day, 'demo_seed');
      INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
        (entry_id, demo_agency_id, acct_payroll,     gross,    0, 'Salaries and wages'),
        (entry_id, demo_agency_id, acct_commissions, comm_pay, 0, 'Producer commissions'),
        (entry_id, demo_agency_id, acct_checking,    0, total_pay, 'Payroll disbursement');
    END LOOP;

    -- Monthly fixed expenses
    rent := 4200;
    util := ROUND((380 + random() * 240)::NUMERIC, 2);
    health := 3850;
    eo := 425;
    entry_id := uuid_generate_v4();
    INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
      (entry_id, demo_agency_id, MAKE_DATE(yr, mo, 1), 'standard',
       'Monthly fixed expenses — ' || TO_CHAR(MAKE_DATE(yr, mo, 1), 'Month YYYY'), 'demo_seed');
    INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
      (entry_id, demo_agency_id, acct_rent,     rent, 0, 'Office rent'),
      (entry_id, demo_agency_id, acct_util,     util, 0, 'Utilities'),
      (entry_id, demo_agency_id, acct_health,   health, 0, 'Health insurance — staff'),
      (entry_id, demo_agency_id, acct_eo,       eo, 0, 'E&O insurance'),
      (entry_id, demo_agency_id, acct_checking, 0, rent + util + health + eo, 'Fixed expense disbursements');

    -- Marketing spend
    mkt := ROUND((800 + random() * 1400)::NUMERIC, 2);
    entry_id := uuid_generate_v4();
    INSERT INTO journal_entries (id, agency_id, entry_date, entry_type, description, source) VALUES
      (entry_id, demo_agency_id, MAKE_DATE(yr, mo, 5 + (random() * 20)::INT), 'standard',
       'Marketing spend — ' || TO_CHAR(MAKE_DATE(yr, mo, 1), 'Mon'), 'demo_seed');
    INSERT INTO journal_lines (journal_entry_id, agency_id, account_id, debit, credit, description) VALUES
      (entry_id, demo_agency_id, acct_mkt,      mkt, 0, 'Marketing & advertising'),
      (entry_id, demo_agency_id, acct_checking, 0, mkt, 'Marketing payment');
  END LOOP;

  -- ============================================================
  -- 6. TASKS
  -- ============================================================
  INSERT INTO tasks (agency_id, title, description, due_date, priority, status, module_reference, created_by) VALUES
  (demo_agency_id, 'Q2 PFA review with Marcus',         'Quarterly PFA pipeline review',         CURRENT_DATE + 3,  'high',     'open',         'compliance',   'Sam Jordan'),
  (demo_agency_id, 'Renew E&O insurance policy',        'Annual E&O renewal',                    CURRENT_DATE + 14, 'critical', 'in_progress',  'compliance',   'Sam Jordan'),
  (demo_agency_id, 'Onboard Brandon for P&C exam',      'Pay exam fee and schedule',             CURRENT_DATE + 21, 'medium',   'in_progress',  'hr',           'Marcus Chen'),
  (demo_agency_id, 'Review last month financials',      'Sit with Claude and review P&L',        CURRENT_DATE + 2,  'high',     'open',         'financials',   'Sam Jordan'),
  (demo_agency_id, 'Schedule team huddle',              'Monthly all-hands',                     CURRENT_DATE + 7,  'medium',   'open',         'team',         'Sam Jordan'),
  (demo_agency_id, 'Update agency Facebook banner',     'Refresh seasonal graphic',              CURRENT_DATE - 2,  'low',      'completed',    'marketing',    'Olivia Brooks'),
  (demo_agency_id, 'Audit unused subscriptions',        'Review SaaS spend',                     CURRENT_DATE + 10, 'low',      'open',         'financials',   'Marcus Chen'),
  (demo_agency_id, 'Call Tampa Chamber re: networking', 'Q2 networking strategy',                CURRENT_DATE - 1,  'medium',   'open',         'business_dev', 'Sam Jordan'),
  (demo_agency_id, 'File state premium tax',            'Quarterly state premium tax filing',    CURRENT_DATE - 5,  'critical', 'completed',    'compliance',   'Marcus Chen'),
  (demo_agency_id, 'Performance review: Priya Patel',   'Annual review',                         CURRENT_DATE + 18, 'medium',   'open',         'hr',           'Sam Jordan'),
  (demo_agency_id, 'Draft May team newsletter',         'Internal newsletter — wins, anniversaries, May goals',  CURRENT_DATE + 8,  'medium',   'in_progress',  'marketing',    'Olivia Brooks'),
  (demo_agency_id, 'Refresh LinkedIn profile',          'Update agency profile photo',           CURRENT_DATE + 15, 'low',      'open',         'marketing',    'Olivia Brooks'),
  (demo_agency_id, 'Reconcile Truist statements',       'Match May bank activity',               CURRENT_DATE + 4,  'high',     'open',         'financials',   'Marcus Chen'),
  (demo_agency_id, 'Schedule Q2 team training',         'SF policies + new products',            CURRENT_DATE + 20, 'medium',   'open',         'team',         'Marcus Chen'),
  (demo_agency_id, 'Test backup of operations data',    'Quarterly DR test — financials, payroll, compliance docs', CURRENT_DATE + 30, 'high',     'open',         'compliance',   'Marcus Chen');

  -- ============================================================
  -- 7. ALERTS
  -- ============================================================
  INSERT INTO alerts (agency_id, alert_type, severity, title, message, module_reference, is_read, is_resolved, due_date) VALUES
  (demo_agency_id, 'compliance', 'critical', 'E&O policy renewal in 14 days',         'Your E&O insurance renewal deadline is approaching.',                              'compliance',  FALSE, FALSE, CURRENT_DATE + 14),
  (demo_agency_id, 'financial',  'warning',  'Q1 marketing spend over budget by 8%',  'Marketing & Advertising is over Q1 budget. Review campaign ROI.',                  'financials',  FALSE, FALSE, NULL),
  (demo_agency_id, 'hr',         'info',     'Brandon Hill ready for P&C exam',       'Brandon has completed pre-licensing and is ready for the FL P&C exam.',           'hr',          TRUE,  FALSE, NULL),
  (demo_agency_id, 'compliance', 'warning',  'PFA review overdue',                    'Q2 PFA pipeline review is now 1 day overdue.',                                     'compliance',  FALSE, FALSE, CURRENT_DATE - 1),
  (demo_agency_id, 'automation', 'info',     'Daily briefing delivered',              'Today''s 6 AM briefing email sent successfully.',                                  'automations', TRUE,  TRUE,  NULL),
  (demo_agency_id, 'financial',  'info',     'AIPP Q1 tracking 28% achievement',      'You''re on pace for 96% of AIPP target.',                                          'financials',  TRUE,  FALSE, NULL),
  (demo_agency_id, 'document',   'info',     '4 operations documents auto-imported',  'Email automation imported 4 new operations documents (bank statements, payroll, license renewal) overnight.', 'documents',   FALSE, FALSE, NULL),
  (demo_agency_id, 'system',     'warning',  'Renewal commission down 4%',            'Renewal commission income is tracking 4% below same month last year.',             'financials',  FALSE, FALSE, NULL);

  -- ============================================================
  -- 8. COMP RECAP — 12 months relative to today
  -- ============================================================
  FOR m IN 0..11 LOOP
    yr := EXTRACT(YEAR  FROM (CURRENT_DATE - (m * INTERVAL '1 month')))::INT;
    mo := EXTRACT(MONTH FROM (CURRENT_DATE - (m * INTERVAL '1 month')))::INT;
    factor := CASE mo
      WHEN 1 THEN 0.85 WHEN 2 THEN 0.90 WHEN 3 THEN 1.05 WHEN 4 THEN 1.10
      WHEN 5 THEN 1.15 WHEN 6 THEN 1.20 WHEN 7 THEN 1.10 WHEN 8 THEN 1.05
      WHEN 9 THEN 0.95 WHEN 10 THEN 0.90 WHEN 11 THEN 0.85 WHEN 12 THEN 1.00
    END;

    INSERT INTO comp_recap (agency_id, period_year, period_month, comp_type, comp_category, description, amount, is_aipp_eligible, is_scoreboard_eligible) VALUES
    (demo_agency_id, yr, mo, 'new_business', 'Auto',     'New Business — Auto',         ROUND((2800 + random() * 1400)::NUMERIC * factor, 2), TRUE,  FALSE),
    (demo_agency_id, yr, mo, 'new_business', 'Home',     'New Business — Home',         ROUND((2400 + random() * 1400)::NUMERIC * factor, 2), TRUE,  FALSE),
    (demo_agency_id, yr, mo, 'new_business', 'Life',     'New Business — Life',         ROUND((800 + random() * 1600)::NUMERIC * factor, 2),  TRUE,  TRUE),
    (demo_agency_id, yr, mo, 'renewal',      'Auto',     'Renewal — Auto',              ROUND((8500 + random() * 3000)::NUMERIC * factor, 2), FALSE, FALSE),
    (demo_agency_id, yr, mo, 'renewal',      'Home',     'Renewal — Home',              ROUND((6500 + random() * 3000)::NUMERIC * factor, 2), FALSE, FALSE),
    (demo_agency_id, yr, mo, 'renewal',      'Umbrella', 'Renewal — Umbrella',          ROUND((450 + random() * 400)::NUMERIC * factor, 2),   FALSE, FALSE);

    IF mo IN (3, 6, 9, 12) THEN
      INSERT INTO comp_recap (agency_id, period_year, period_month, comp_type, comp_category, description, amount, is_aipp_eligible, is_scoreboard_eligible) VALUES
      (demo_agency_id, yr, mo, 'bonus', 'AIPP Accrual', 'Bonus — AIPP Accrual', ROUND((1500 + random() * 1000)::NUMERIC * factor, 2), FALSE, FALSE);
    END IF;
  END LOOP;

  -- ============================================================
  -- 9. SCOREBOARD TRACKING
  -- ============================================================
  INSERT INTO scoreboard_tracking (agency_id, program_year, period, metric_name, target, actual, achievement_percentage, notes) VALUES
  (demo_agency_id, curr_year, 'annual', 'New Business Auto Items',        320, 287,  89.7,  'YTD tracking'),
  (demo_agency_id, curr_year, 'annual', 'New Business Home Items',        180, 198,  110.0, 'YTD tracking'),
  (demo_agency_id, curr_year, 'annual', 'Life Items',                     65,  48,   73.8,  'YTD tracking'),
  (demo_agency_id, curr_year, 'annual', 'Financial Services NB',          95,  102,  107.4, 'YTD tracking'),
  (demo_agency_id, curr_year, 'annual', 'Customer Retention',             92,  94.5, 102.7, 'YTD tracking'),
  (demo_agency_id, curr_year, 'annual', 'Auto Multi-Line Discount Rate',  78,  81.2, 104.1, 'YTD tracking');

  -- ============================================================
  -- 10. SOCIAL ACCOUNTS + CONTENT CALENDAR
  -- ============================================================
  INSERT INTO social_accounts (agency_id, platform, account_handle, is_connected, last_sync) VALUES
  (demo_agency_id, 'facebook',  'sunshinestateinsurance',   TRUE,  NOW() - INTERVAL '2 hours'),
  (demo_agency_id, 'instagram', '@sunshinestate_insurance', TRUE,  NOW() - INTERVAL '3 hours'),
  (demo_agency_id, 'linkedin',  'sunshine-state-insurance', TRUE,  NOW() - INTERVAL '1 day'),
  (demo_agency_id, 'twitter',   '@SunshineStateIns',        FALSE, NULL);

  INSERT INTO content_calendar (agency_id, platform, content_type, caption, hashtags, scheduled_date, status, created_by) VALUES
  (demo_agency_id, 'linkedin',  'article', 'How we built a referral pipeline that brought in 40% of our 2025 new business — without spending a dollar on paid ads.',                              ARRAY['agencyops','agencygrowth','smallbusiness'],     CURRENT_DATE + 2,  'scheduled', 'Sam Jordan'),
  (demo_agency_id, 'instagram', 'post',    'We are hiring! Looking for a licensed P&C producer in Tampa. Bilingual a plus. DM Marcus to apply.',                                                  ARRAY['hiring','tampajobs','insurancecareers'],         CURRENT_DATE + 4,  'draft',     'Olivia Brooks'),
  (demo_agency_id, 'linkedin',  'article', 'Three things every Tampa small business owner should know about workers comp before May 31.',                                                        ARRAY['smallbusiness','tampabusiness','riskmanagement'], CURRENT_DATE + 7,  'draft',     'Sam Jordan'),
  (demo_agency_id, 'linkedin',  'post',    'Proud to support the Tampa Bay Chamber Small Business Awards this year. Looking forward to celebrating the community.',                              ARRAY['communityinvolvement','tampabay'],                CURRENT_DATE - 2,  'posted',    'Olivia Brooks'),
  (demo_agency_id, 'instagram', 'reel',    'Meet our team — 8 strong, 6 years average tenure, three languages spoken in the office.',                                                            ARRAY['teamspotlight','agencyculture'],                  CURRENT_DATE - 5,  'posted',    'Olivia Brooks'),
  (demo_agency_id, 'linkedin',  'post',    'Year 7 of running an agency taught me this: the best operational investment you can make is in your team. Sharing what worked.',                     ARRAY['agencyleadership','smallbusiness'],               CURRENT_DATE + 10, 'draft',     'Sam Jordan');

  -- ============================================================
  -- 11. AUTOMATION RECIPES + RUN LOG
  -- ============================================================
  INSERT INTO automation_recipes (agency_id, recipe_name, recipe_description, trigger_type, cron_expression, composio_action, composio_connection, is_active, last_run_at, last_run_status) VALUES
  -- Daily processors
  (demo_agency_id, 'SF Daily Comp Processor',                'Pulls State Farm daily comp emails, parses individual line items via Groq, writes to comp_recap. Primary daily income feed.',                                                  'cron', '0 15 * * *',  'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '5 hours',   'success'),
  (demo_agency_id, 'Email Archiver',                         'Daily inbox cleanup: archives older email, files attachments to Drive, logs each archived doc to documents table with source links.',                                       'cron', '0 13 * * *',  'GMAIL_MODIFY_LABELS',    'gmail',    TRUE, NOW() - INTERVAL '7 hours',   'success'),
  (demo_agency_id, 'GL Entry Writer',                        'Daily reconciliation: writes GL entries (cash basis) for any comp/bank/payroll/CC events from past 24h that don''t yet have journal entries.',                              'cron', '0 16 * * *',  'INTERNAL',               'system',   TRUE, NOW() - INTERVAL '4 hours',   'success'),
  (demo_agency_id, 'Daily Briefing Email',                   'Composes agent morning briefing via Groq from real data: revenue YTD, AIPP, top tasks, alerts, today''s social posts. Sends to agent personal email.',                       'cron', '0 12 * * *',  'GMAIL_SEND_EMAIL',       'gmail',    TRUE, NOW() - INTERVAL '8 hours',   'success'),
  (demo_agency_id, 'Social Media Scheduler',                 'Pulls today scheduled content_calendar items, posts to FB/LinkedIn, marks status=posted, saves post_url back. Creates alert for IG (no API auto-post).',                    'cron', '0 14 * * *',  'FACEBOOK_POST_TO_PAGE',  'facebook', TRUE, NOW() - INTERVAL '6 hours',   'success'),
  (demo_agency_id, 'Monthly Close Monitor',                  'Daily check of monthly_close_checklist progress. Mid-month flags overdue items. End-of-month creates next month checklist by template.',                                   'cron', '0 14 * * *',  'INTERNAL',               'system',   TRUE, NOW() - INTERVAL '6 hours',   'success'),
  (demo_agency_id, 'Producer Underperformance Watcher',      'Daily check of each producer monthly issued production against their 3-month rolling average. Fires alert + persistent_memory entry when any producer falls below 70% of pace. Drives Performance tab status pills.', 'cron', '0 12 * * *',  'INTERNAL',               'system',   TRUE, NOW() - INTERVAL '2 hours',   'success'),
  -- Every-6-hours document processors
  (demo_agency_id, 'Deduction Statement Processor',          'Watches Gmail for SF deduction statements, parses line items via Groq, writes deductions (negative) to comp_recap and journal_entries.',                                  'cron', '0 */6 * * *', 'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '4 hours',   'success'),
  (demo_agency_id, 'Bank Statement Processor',               'Watches Gmail for bank statement emails, parses transactions via Groq, posts to journal_entries. Avoids duplicates via reference_number.',                                'cron', '0 */6 * * *', 'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '4 hours',   'success'),
  (demo_agency_id, 'Credit Card Statement Processor',        'Watches Gmail for credit card statements, parses transactions via Groq, posts to credit_transactions table. Pairs with Bank Statement Processor for full cash-basis reconciliation.', 'cron', '0 */6 * * *', 'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '4 hours',   'success'),
  (demo_agency_id, 'Payroll Processor',                      'Watches Gmail for payroll provider notifications (Gusto, ADP, etc.), parses run summary via Groq, writes payroll_runs and payroll_detail rows.',                          'cron', '0 */6 * * *', 'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '4 hours',   'success'),
  -- Monthly processor (drives the new Performance tab)
  (demo_agency_id, 'Producer Production Report Processor',   'Monthly: parses each producer monthly production report (forwarded by agent), extracts issued premium per producer per LOB via Groq, writes to producer_production. Feeds the HR & People → Performance tab ROI projection.', 'cron', '0 9 1 * *',   'GMAIL_FETCH_EMAILS',     'gmail',    TRUE, NOW() - INTERVAL '7 days',    'success');

  INSERT INTO automation_run_log (agency_id, recipe_id, run_at, status, records_processed, duration_seconds, output_summary)
  SELECT demo_agency_id, ar.id, NOW() - (n.day || ' days')::INTERVAL,
         CASE WHEN random() < 0.95 THEN 'success' ELSE 'partial' END,
         (random() * 8 + 1)::INT,
         (random() * 30 + 5)::INT,
         'Run completed normally'
  FROM automation_recipes ar
  CROSS JOIN generate_series(0, 6) AS n(day)
  WHERE ar.agency_id = demo_agency_id;

  -- ============================================================
  -- 12. DOCUMENTS (10 realistic auto-intake + manual uploads)
  -- ============================================================
  INSERT INTO documents (agency_id, file_name, file_type, upload_source, drive_url, processing_status, processing_type, groq_classification, tables_updated, records_created, uploaded_by, uploaded_at, processed_at, notes) VALUES
  (demo_agency_id, 'Truist_Operating_Apr2026.pdf',         'pdf',  'email_auto',    'https://drive.google.com/file/d/demo01/view', 'complete', 'database_import', 'bank_statement',          ARRAY['journal_entries','journal_lines','bank_accounts'], 28, 'auto_intake',   NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days',  'April operating account statement'),
  (demo_agency_id, 'SF_CommissionRecap_Apr2026.pdf',       'pdf',  'email_auto',    'https://drive.google.com/file/d/demo02/view', 'complete', 'database_import', 'sf_commission',           ARRAY['comp_recap','journal_entries'],                    7,  'auto_intake',   NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 days',  'SF April commission detail report'),
  (demo_agency_id, 'Gusto_Payroll_2026-04-15.csv',         'csv',  'email_auto',    'https://drive.google.com/file/d/demo03/view', 'complete', 'database_import', 'payroll',                 ARRAY['payroll_runs','payroll_detail','journal_entries'], 8,  'auto_intake',   NOW() - INTERVAL '6 days',  NOW() - INTERVAL '6 days',  'Mid-month payroll run, all 8 employees'),
  (demo_agency_id, 'Resume_KaylaWashington.pdf',            'pdf',  'email_auto',    'https://drive.google.com/file/d/demo04/view', 'complete', 'database_import', 'resume',                  ARRAY['applicants'],                                       1,  'auto_intake',   NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days',  'Resume for LSP position - Groq score 8/10'),
  (demo_agency_id, 'EOpolicyRenewal_Hartford_quote.pdf',    'pdf',  'direct_upload', 'https://drive.google.com/file/d/demo05/view', 'complete', 'archive',         'compliance_document',     ARRAY['compliance_calendar'],                              0,  'Sam Jordan',    NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days', 'EnO renewal quote from Hartford'),
  (demo_agency_id, 'ChaseInk_Apr2026.pdf',                  'pdf',  'email_auto',    'https://drive.google.com/file/d/demo06/view', 'complete', 'database_import', 'credit_statement',        ARRAY['credit_transactions','journal_entries'],            14, 'auto_intake',   NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', 'April business Visa statement'),
  (demo_agency_id, 'Q1_2026_StatePremiumTax_FL.pdf',         'pdf',  'direct_upload', 'https://drive.google.com/file/d/demo07/view', 'complete', 'archive',         'tax_document',            ARRAY['compliance_calendar'],                              0,  'Marcus Chen',   NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 'Q1 FL premium tax filing confirmation'),
  (demo_agency_id, 'AgentLicenseRenewal_Sam_2027.pdf',       'pdf',  'direct_upload', 'https://drive.google.com/file/d/demo08/view', 'complete', 'archive',         'license',                 ARRAY[]::TEXT[],                                            0,  'Sam Jordan',    NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', 'Renewed FL PnC license'),
  (demo_agency_id, 'Q1_2026_TeamPerformanceReview.docx',     'docx', 'direct_upload', 'https://drive.google.com/file/d/demo09/view', 'complete', 'archive',         'team_review',             ARRAY[]::TEXT[],                                            0,  'Sam Jordan',    NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', 'Quarterly team performance review notes — owner reflection on Q1'),
  (demo_agency_id, 'May2026_marketing_calendar.xlsx',       'xlsx', 'direct_upload', 'https://drive.google.com/file/d/demo10/view', 'pending',  'database_import', 'marketing_plan',          ARRAY[]::TEXT[],                                            0,  'Olivia Brooks', NOW() - INTERVAL '1 day',   NULL,                       'Awaiting Groq processing');

  -- ============================================================
  -- 13. GOALS (5 realistic annual goals)
  -- ============================================================
  INSERT INTO goals (agency_id, title, description, category, target_value, current_value, unit, target_date, status, created_by) VALUES
  (demo_agency_id, 'Hit Annual AIPP Target',            'Achieve $85,000 in AIPP earnings for the year',                       'aipp',       85000, 23800, 'dollars',    MAKE_DATE(curr_year, 12, 31), 'active', 'Sam Jordan'),
  (demo_agency_id, 'Grow Team to 10',                   'Hire two additional licensed producers by year end',                  'team',       10,    8,     'count',      MAKE_DATE(curr_year, 12, 31), 'active', 'Sam Jordan'),
  (demo_agency_id, 'Financial Services Cross-Sell',     'Launch FSP cross-sell campaign and add 50 FSP customers',             'revenue',    50,    18,    'count',      MAKE_DATE(curr_year, 9, 30),  'active', 'Sam Jordan'),
  (demo_agency_id, 'Top-Quartile ScoreBoard Ranking',   'Achieve top-quartile placement in regional ScoreBoard rankings',      'revenue',    100,   85,    'percentage', MAKE_DATE(curr_year, 12, 31), 'active', 'Sam Jordan'),
  (demo_agency_id, 'Zero Compliance Findings',          'Maintain zero compliance audit findings through year end',           'compliance', 0,     0,     'count',      MAKE_DATE(curr_year, 12, 31), 'active', 'Sam Jordan');

  -- ============================================================
  -- 14. SETTINGS (key/value app config)
  -- ============================================================
  INSERT INTO settings (agency_id, setting_key, setting_value, setting_type, description, updated_by) VALUES
  (demo_agency_id, 'fiscal_year_start',         '01-01',  'string',  'Fiscal year start (MM-DD)',                              'Sam Jordan'),
  (demo_agency_id, 'default_currency',          'USD',    'string',  'Default currency for all financials',                    'Sam Jordan'),
  (demo_agency_id, 'briefing_send_time',        '06:00',  'string',  'Time daily briefing email is sent (Eastern)',            'Sam Jordan'),
  (demo_agency_id, 'aipp_alert_threshold',      '0.85',   'string',  'Fraction of AIPP target at which to alert',              'Sam Jordan'),
  (demo_agency_id, 'compliance_lookahead_days', '30',     'string',  'How far ahead to surface compliance deadlines',          'Marcus Chen'),
  (demo_agency_id, 'social_auto_post',          'true',   'boolean', 'Auto-publish approved content_calendar items',           'Olivia Brooks'),
  (demo_agency_id, 'low_balance_alert',         '50000',  'string',  'Alert if operating account drops below this',            'Sam Jordan');

  -- ============================================================
  -- 15. USERS (BCC app users with access)
  -- ============================================================
  INSERT INTO users (agency_id, email, full_name, role, is_active, last_login) VALUES
  (demo_agency_id, 'sam@demo.com',     'Sam Jordan',       'owner',      TRUE, NOW() - INTERVAL '2 hours'),
  (demo_agency_id, 'marcus@demo.com',  'Marcus Chen',      'manager',    TRUE, NOW() - INTERVAL '8 hours'),
  (demo_agency_id, 'olivia@demo.com',  'Olivia Brooks',    'staff',      TRUE, NOW() - INTERVAL '1 day'),
  (demo_agency_id, 'priya@demo.com',   'Priya Patel',      'staff',      TRUE, NOW() - INTERVAL '3 days'),
  (demo_agency_id, 'cpa@demo.com',     'Steven Bonventre', 'accountant', TRUE, NOW() - INTERVAL '14 days');

  -- ============================================================
  -- 16. PAYROLL (3 recent runs, all 8 employees)
  -- ============================================================
  INSERT INTO payroll_runs (agency_id, pay_period_start, pay_period_end, pay_date, payroll_provider, gross_payroll, employer_taxes, net_payroll, status) VALUES
  (demo_agency_id, CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day',  CURRENT_DATE - INTERVAL '1 day',  'Gusto', 16850, 1485, 13950, 'paid'),
  (demo_agency_id, CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '15 days','Gusto', 16420, 1448, 13580, 'paid'),
  (demo_agency_id, CURRENT_DATE - INTERVAL '42 days', CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE - INTERVAL '29 days','Gusto', 16720, 1473, 13830, 'paid');

  INSERT INTO payroll_detail (payroll_run_id, agency_id, staff_id, gross_pay, federal_tax, state_tax, social_security, medicare, other_deductions, net_pay, employment_type)
  SELECT
    pr.id,
    pr.agency_id,
    s.id,
    CASE
      WHEN s.role ILIKE '%owner%'              THEN 3650
      WHEN s.role ILIKE '%office manager%'     THEN 2385
      WHEN s.role ILIKE '%licensed sales%'     THEN ROUND((1750 + random() * 800)::NUMERIC, 2)
      WHEN s.role ILIKE '%financial services%' THEN ROUND((1730 + random() * 600)::NUMERIC, 2)
      WHEN s.role ILIKE '%customer service%'   THEN 1640
      ELSE 1500
    END,
    185, 0, 113, 27, 142,
    CASE
      WHEN s.role ILIKE '%owner%'              THEN 3183
      WHEN s.role ILIKE '%office manager%'     THEN 2078
      WHEN s.role ILIKE '%licensed sales%'     THEN 1525
      WHEN s.role ILIKE '%financial services%' THEN 1508
      WHEN s.role ILIKE '%customer service%'   THEN 1429
      ELSE 1306
    END,
    s.employment_type
  FROM payroll_runs pr
  CROSS JOIN staff s
  WHERE pr.agency_id = demo_agency_id
    AND s.agency_id  = demo_agency_id
    AND s.is_active  = TRUE;

  -- ============================================================
  -- 17. MONTHLY CLOSE CHECKLIST
  -- ============================================================
  -- 4 closed prior months + current month with mix of received/outstanding.
  -- All dates relative to NOW() so they stay current after each reset.

  -- Closed months
  INSERT INTO monthly_close_checklist
    (agency_id, period_year, period_month, doc_category, doc_label, expected_by, received_at, status, is_closed)
  SELECT
    demo_agency_id,
    EXTRACT(YEAR  FROM (DATE_TRUNC('month', CURRENT_DATE) - (m.offset_months || ' months')::INTERVAL))::INT,
    EXTRACT(MONTH FROM (DATE_TRUNC('month', CURRENT_DATE) - (m.offset_months || ' months')::INTERVAL))::INT,
    d.cat, d.label,
    (DATE_TRUNC('month', CURRENT_DATE) - ((m.offset_months - 1) || ' months')::INTERVAL)::DATE + (d.expected_offset || ' days')::INTERVAL,
    ((DATE_TRUNC('month', CURRENT_DATE) - ((m.offset_months - 1) || ' months')::INTERVAL)::DATE + (d.expected_offset || ' days')::INTERVAL + ((random()*3)::INT || ' days')::INTERVAL)::DATE,
    'reconciled', TRUE
  FROM (VALUES (1), (2), (3), (4)) AS m(offset_months)
  CROSS JOIN (VALUES
    ('bank_statement',   'Truist Operating Statement (x8842)',  6),
    ('bank_statement',   'Truist Reserve Statement (x5519)',     6),
    ('bank_statement',   'Truist Payroll Statement (x3107)',     6),
    ('credit_statement', 'Chase Ink Visa Statement (x4421)',    10),
    ('sf_recap',         'SF Commission Recap',                   8),
    ('payroll',          'Gusto Payroll Run (mid-month)',        16),
    ('payroll',          'Gusto Payroll Run (month-end)',        31),
    ('reconciliation',   'Marketing Spend Reconciliation',       12)
  ) AS d(cat, label, expected_offset);

  -- Current open month
  INSERT INTO monthly_close_checklist
    (agency_id, period_year, period_month, doc_category, doc_label, expected_by, received_at, status, is_closed, notes)
  SELECT
    demo_agency_id, curr_year, curr_month,
    d.cat, d.label, d.expected_by, d.received_at, d.status, FALSE, d.notes
  FROM (VALUES
    ('bank_statement',   'Truist Operating Statement (x8842)',  CURRENT_DATE - 1,  CURRENT_DATE - 1, 'received', 'Auto-imported via email intake'),
    ('credit_statement', 'Chase Ink Visa Statement (x4421)',    CURRENT_DATE + 4,  CURRENT_DATE - 2, 'received', 'Received early — 14 days ahead of expected'),
    ('sf_recap',         'SF Commission Recap',                  CURRENT_DATE + 2,  CURRENT_DATE - 3, 'received', 'Auto-imported, comp_recap updated with 7 line items'),
    ('payroll',          'Gusto Payroll Run (mid-month)',        CURRENT_DATE - 8,  CURRENT_DATE - 7, 'received', 'CSV imported, 8 employees'),
    ('bank_statement',   'Truist Reserve Statement (x5519)',     CURRENT_DATE + 3,  NULL,             'expected', 'Awaiting auto-import — typically arrives day 5-7'),
    ('bank_statement',   'Truist Payroll Statement (x3107)',     CURRENT_DATE + 3,  NULL,             'expected', 'Awaiting auto-import — typically arrives day 5-7'),
    ('payroll',          'Gusto Payroll Run (month-end)',        CURRENT_DATE + 18, NULL,             'expected', 'Scheduled for last business day of month'),
    ('reconciliation',   'Marketing Spend Reconciliation',       CURRENT_DATE + 7,  NULL,             'expected', 'Olivia to review and submit')
  ) AS d(cat, label, expected_by, received_at, status, notes);


  -- ============================================================
  -- N. SEED producer_production (24 months × 3 producers × 4 LOBs)
  -- ============================================================
  -- This data drives the Producer ROI / Performance tab.
  -- Three producers shown at three maturity stages:
  --   Priya Patel    — mature, 5+ years, $32K/mo P&C avg
  --   Tasha Williams — past breakeven, 4 years, $24K/mo P&C avg
  --   David Rodriguez — approaching breakeven, 3 years, $18K/mo growing
  WITH months AS (
    SELECT
      EXTRACT(YEAR FROM (DATE_TRUNC('month', CURRENT_DATE) - (n || ' months')::INTERVAL))::INT AS y,
      EXTRACT(MONTH FROM (DATE_TRUNC('month', CURRENT_DATE) - (n || ' months')::INTERVAL))::INT AS mo,
      n AS months_back
    FROM generate_series(0, 23) AS n
  ),
  producers AS (
    SELECT
      s.id AS staff_id,
      s.first_name,
      CASE s.first_name
        WHEN 'Priya'  THEN 19000  -- mature LSP — auto base
        WHEN 'Tasha'  THEN 14000
        WHEN 'David'  THEN 10500
      END AS base_auto,
      CASE s.first_name
        WHEN 'Priya'  THEN 13000  -- fire base
        WHEN 'Tasha'  THEN  9500
        WHEN 'David'  THEN  7000
      END AS base_fire,
      CASE s.first_name
        WHEN 'Priya'  THEN 2500   -- life base
        WHEN 'Tasha'  THEN 1800
        WHEN 'David'  THEN 1100
      END AS base_life,
      CASE s.first_name
        WHEN 'Priya'  THEN 1500   -- fs base
        WHEN 'Tasha'  THEN 1200
        WHEN 'David'  THEN  900
      END AS base_fs,
      CASE s.first_name
        WHEN 'Priya'  THEN 0.000   -- flat (mature)
        WHEN 'Tasha'  THEN 0.000   -- flat (past breakeven)
        WHEN 'David'  THEN 0.015   -- still growing 1.5%/mo back in time = lower then
      END AS growth_factor
    FROM staff s
    WHERE s.agency_id = demo_agency_id
      AND s.first_name IN ('Priya','Tasha','David')
  )
  INSERT INTO producer_production (agency_id, staff_id, period_year, period_month, line_of_business, policies_issued, premium_issued)
  SELECT
    demo_agency_id,
    p.staff_id,
    m.y,
    m.mo,
    lob.line,
    GREATEST(1, ROUND(
      (CASE lob.line
         WHEN 'auto' THEN p.base_auto
         WHEN 'fire' THEN p.base_fire
         WHEN 'life' THEN p.base_life
         WHEN 'fs'   THEN p.base_fs
       END
       * (1.0 - p.growth_factor * m.months_back)
       * (0.85 + random() * 0.30)
      ) / lob.avg_premium
    )),
    ROUND(
      (CASE lob.line
         WHEN 'auto' THEN p.base_auto
         WHEN 'fire' THEN p.base_fire
         WHEN 'life' THEN p.base_life
         WHEN 'fs'   THEN p.base_fs
       END
       * (1.0 - p.growth_factor * m.months_back)
       * (0.85 + random() * 0.30)
      )::NUMERIC, 2
    )
  FROM months m
  CROSS JOIN producers p
  CROSS JOIN (VALUES
    ('auto', 1450),
    ('fire', 2100),
    ('life',  650),
    ('fs',   2500)
  ) AS lob(line, avg_premium)
  ON CONFLICT (agency_id, staff_id, period_year, period_month, line_of_business) DO NOTHING;

  RETURN 'Demo reset complete at ' || NOW()::TEXT ||
         ' — agency=Sunshine State Insurance, journal_entries=' ||
         (SELECT COUNT(*) FROM journal_entries WHERE agency_id = demo_agency_id)::TEXT ||
         ', tasks=' || (SELECT COUNT(*) FROM tasks WHERE agency_id = demo_agency_id)::TEXT;
END
$func$;
