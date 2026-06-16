-- ============================================================
-- BCC SEED: AGENCY RECORD TEMPLATE v1.0
-- Per-Client Setup — Run Once Per New Client
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- This file is the final seed file run at client setup.
-- Unlike 001-003 which are static, this file is customized
-- for each client before running.
--
-- SETUP CHECKLIST — complete before running:
-- ─────────────────────────────────────────────────────────
-- [ ] Replace all AGENCY_ID_PLACEHOLDER with actual UUID
--     (generate with: SELECT uuid_generate_v4())
--
-- [ ] Replace all CLIENT_ prefixed placeholders:
--     CLIENT_AGENCY_NAME        → e.g. Smith Insurance Agency
--     CLIENT_OWNER_NAME         → e.g. Jane Smith
--     CLIENT_ENTITY_TYPE        → LLC, S-Corp, Sole Prop
--     CLIENT_TAX_ID             → EIN (handle securely)
--     CLIENT_SF_AGENT_CODE      → e.g. IL 22-441A
--     CLIENT_LICENSING_STATES   → e.g. {IL,WI,IN}
--     CLIENT_PRIMARY_EMAIL      → personal email, NOT @statefarm
--     CLIENT_PHONE              → agency phone
--     CLIENT_ADDRESS            → agency address
--     CLIENT_GOOGLE_EMAIL       → Google account email
--     CLIENT_COMPOSIO_ID        → from Composio setup step
--     CLIENT_VERCEL_URL         → from Vercel deployment step
--     CLIENT_SETUP_DATE         → today's date
--     CLIENT_AUTH_USER_ID       → from Supabase Auth setup
--     CLIENT_STAFF_*            → from discovery call
--     CLIENT_GOALS_*            → from discovery call
--     CLIENT_MEMORY_*           → from discovery call notes
-- ─────────────────────────────────────────────────────────
-- ============================================================

-- ============================================================
-- STEP 1: CREATE AGENCY RECORD
-- ============================================================

INSERT INTO agency (
  id,
  name,
  owner_name,
  entity_type,
  tax_id,
  state_farm_agent_code,
  licensing_states,
  primary_email,
  phone,
  address,
  google_account_email,
  composio_account_id,
  vercel_url,
  setup_date,
  status
) VALUES (
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'CLIENT_AGENCY_NAME',
  'CLIENT_OWNER_NAME',
  'CLIENT_ENTITY_TYPE',
  'CLIENT_TAX_ID',
  'CLIENT_SF_AGENT_CODE',
  'CLIENT_LICENSING_STATES'::TEXT[],     -- e.g. '{IL,WI,IN}'
  'CLIENT_PRIMARY_EMAIL',
  'CLIENT_PHONE',
  'CLIENT_ADDRESS',
  'CLIENT_GOOGLE_EMAIL',
  'CLIENT_COMPOSIO_ID',
  'CLIENT_VERCEL_URL',
  'CLIENT_SETUP_DATE'::DATE,
  'active'
);

-- ============================================================
-- STEP 2: CREATE OWNER USER RECORD
-- ============================================================

INSERT INTO users (
  id,
  agency_id,
  email,
  full_name,
  role,
  auth_user_id,
  is_active
) VALUES (
  uuid_generate_v4(),
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'CLIENT_PRIMARY_EMAIL',
  'CLIENT_OWNER_NAME',
  'owner',
  'CLIENT_AUTH_USER_ID'::UUID,
  TRUE
);

-- ============================================================
-- STEP 3: SEED PERSISTENT MEMORY
-- Foundation memory entries from discovery call
-- Claude reads these in every conversation
-- ============================================================

INSERT INTO persistent_memory (
  agency_id, category, title, content, added_by, source
) VALUES

-- Agency Profile
(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'agency_profile',
  'Agency Overview',
  'Agency Name: CLIENT_AGENCY_NAME
Owner: CLIENT_OWNER_NAME
Entity Type: CLIENT_ENTITY_TYPE
SF Agent Code: CLIENT_SF_AGENT_CODE
Licensed States: CLIENT_LICENSING_STATES
Primary Email: CLIENT_PRIMARY_EMAIL
Phone: CLIENT_PHONE
Address: CLIENT_ADDRESS
Setup Date: CLIENT_SETUP_DATE
BCC URL: CLIENT_VERCEL_URL',
  'system', 'initial_setup'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'agency_profile',
  'Business Context',
  'CLIENT_MEMORY_BUSINESS_CONTEXT',
  -- Example: "Jane has operated this agency since 2018. 
  -- Prior career in banking gave her strong financial acumen.
  -- Agency focus is personal lines with growing commercial book.
  -- Located in suburban Chicago market, high competition area."
  'system', 'discovery_call'
),

-- Financial Context
(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'financial_context',
  'Accounting Setup',
  'Entity Type: CLIENT_ENTITY_TYPE
Fiscal Year: Calendar Year (Jan-Dec)
Accounting Method: Cash Basis
Payroll Provider: CLIENT_MEMORY_PAYROLL_PROVIDER
CPA / Accountant: CLIENT_MEMORY_CPA_NAME at CLIENT_MEMORY_CPA_FIRM
CPA Email: CLIENT_MEMORY_CPA_EMAIL
S-Corp Election: CLIENT_MEMORY_SCORP_STATUS
Owner W-2 Salary: CLIENT_MEMORY_OWNER_SALARY',
  'system', 'discovery_call'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'financial_context',
  'SF Compensation Structure',
  'AIPP Target (Current Year): CLIENT_MEMORY_AIPP_TARGET
Prior Year AIPP Actual: CLIENT_MEMORY_AIPP_PRIOR
ScoreBoard Participation: CLIENT_MEMORY_SCOREBOARD
Primary Revenue Lines: CLIENT_MEMORY_REVENUE_LINES
Multi-State Comp: CLIENT_MEMORY_MULTISTATE_COMP',
  'system', 'discovery_call'
),

-- Business Rules
(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'business_rules',
  'Accounting Rules Claude Must Follow',
  '1. Cash basis ONLY — revenue counts when money hits the bank. Never count pending or promised payments.
2. PFA is NOT a business asset. Not on balance sheet. SF compliance tracking only. Never use as collateral.
3. Owner draws are equity transactions — never expenses.
4. S-Corp distributions are equity transactions — never income or expense.
5. Always reconcile COMP_RECAP to GL before closing any period.
6. Family employee wages require annual W-2 review with CPA. Flag below-standard-deduction employees.
7. Owner W-2 wages must reflect reasonable S-Corp compensation — flag for CPA review annually.
8. S-Corp Medical premiums for owner tracked in account 6115, added to W-2 Box 1 — coordinate with CPA.
9. Financial health benchmarks: Payroll+Taxes/Gross healthy 40-50% warning >51%; Rent/Gross healthy 5-8% warning >9%; Net Margin healthy 25-35% critical <20%.',
  'system', 'if_standard_rules'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'business_rules',
  'SF Compliance Rules Claude Must Enforce — AA05 Based',
  'These rules are grounded in the AA05 Agent Agreement. Claude enforces them as hard guardrails.

LANGUAGE RULES (non-negotiable):
• Always say "customer" — NEVER "client" (AA05 I.B — Principal-Agent, not fiduciary)
• Never use "expert," "specialist," "advisor," or "consultant" — agent title ONLY (AA05 I.O)
• Never use "solutions" — always "options"
• Never use absolutes (always/never), guarantees (will/promise), superlatives (best/#1) about products
• Never use "transfers welcome" — anti-raiding clause (AA05 I.J)
• Never use "financial freedom" or "wealth accumulation" — prohibited
• Never use "fully licensed" — only "licensed"

ADVERTISING (AA05 I.H):
• ALL advertising referencing SF requires prior approval before use
• Never suggest content that promises specific rates, premiums, or savings
• All original content must be in English — FINRA archiving requirement (AA05 I.D)
• AI-generated visual content requires an AI disclaimer on every platform

SOCIAL MEDIA CONTENT — NEVER GENERATE:
• Investment products, mutual funds, college savings plans
• Specific life or health product names
• Pricing, rates, or premium amounts of any kind
• Internal SF processes, incentive program details (ScoreCard, AIPP, bonuses)
• Customer PII or SPI of any kind
• Scare tactics or fear-based language

FINANCIAL:
• PFA must stay in separate account — never commingled with operating funds
• No rebating — nothing of value tied to policy purchases (quotes OK, sales NO)
• Referral reward programs cannot be advertised on social media
• No sweepstakes, contests, lotteries, or "enter to win" giveaways ever

LICENSING:
• Flag license renewal deadlines 60 days in advance
• Flag E&O insurance renewal 90 days before expiration
• Never permit unlicensed staff to perform licensed activities

WHEN IN DOUBT: Do NOT generate the content. Flag it and explain why.',
  'system', 'if_compliance_rules'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'business_rules',
  'Communication Preferences',
  'CLIENT_MEMORY_COMMUNICATION_PREFS',
  -- Example: "Jane prefers direct, concise communication.
  -- Use bullet points for action items.
  -- Flag financial issues immediately, don't soften bad news.
  -- She reviews her BCC every morning before 9AM."
  'system', 'discovery_call'
),

-- Goals
(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'goals',
  'Current Year Goals',
  'CLIENT_MEMORY_CURRENT_GOALS',
  -- Example: "Primary goals for 2026:
  -- 1. Hit AIPP target of $142,000 (currently at 47.5%)
  -- 2. Grow new business premium by 15% vs prior year
  -- 3. Add one licensed team member by Q3
  -- 4. Achieve ScoreBoard recognition at President level
  -- 5. Reduce operating expense ratio below 45%"
  'system', 'discovery_call'
),

-- Key Relationships
(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'relationships',
  'Key Contacts',
  'CPA: CLIENT_MEMORY_CPA_NAME — CLIENT_MEMORY_CPA_FIRM — CLIENT_MEMORY_CPA_EMAIL
SF Field Leadership: CLIENT_MEMORY_SF_CONTACT
Payroll Provider Contact: CLIENT_MEMORY_PAYROLL_CONTACT
Insurance Agent (E&O): CLIENT_MEMORY_EO_CONTACT
Attorney: CLIENT_MEMORY_ATTORNEY
Landlord: CLIENT_MEMORY_LANDLORD
Key Vendors: CLIENT_MEMORY_KEY_VENDORS',
  'system', 'discovery_call'
);

-- ============================================================
-- STEP 4: SEED STAFF RECORDS
-- Add staff members discovered during setup
-- Duplicate this block for each staff member
-- ============================================================

-- Staff Member 1 (duplicate block for each additional staff)
INSERT INTO staff (
  agency_id, first_name, last_name,
  role, employment_type,
  start_date, is_active,
  email, phone,
  pay_type, pay_rate, notes
) VALUES (
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'CLIENT_STAFF_1_FIRST',
  'CLIENT_STAFF_1_LAST',
  'CLIENT_STAFF_1_ROLE',           -- e.g. Licensed Sales Agent
  'CLIENT_STAFF_1_TYPE',           -- w2, 1099, family
  'CLIENT_STAFF_1_START'::DATE,
  TRUE,
  'CLIENT_STAFF_1_EMAIL',
  'CLIENT_STAFF_1_PHONE',
  'CLIENT_STAFF_1_PAY_TYPE',       -- salary, hourly, commission
  CLIENT_STAFF_1_PAY_RATE,         -- numeric, e.g. 45000.00
  'CLIENT_STAFF_1_NOTES'
);

-- ============================================================
-- STEP 5: SEED CURRENT YEAR GOALS
-- ============================================================

INSERT INTO goals (
  agency_id, title, description,
  category, target_value, current_value,
  unit, target_date, status, created_by
) VALUES

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'AIPP Target — Current Year',
  'Hit annual AIPP target for current program year',
  'aipp',
  CLIENT_GOALS_AIPP_TARGET,        -- numeric, e.g. 142000.00
  CLIENT_GOALS_AIPP_CURRENT,       -- current YTD earned
  'dollars',
  (DATE_TRUNC('year', NOW()) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  'active', 'system'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'New Business Growth Target',
  'Grow new business premium vs prior year',
  'revenue',
  CLIENT_GOALS_NB_TARGET,          -- e.g. 15.00 (percentage)
  0,
  'percentage',
  (DATE_TRUNC('year', NOW()) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  'active', 'system'
),

(
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'Annual Revenue Target',
  'Total agency revenue goal for the year',
  'revenue',
  CLIENT_GOALS_REVENUE_TARGET,     -- e.g. 580000.00
  CLIENT_GOALS_REVENUE_CURRENT,    -- YTD actual
  'dollars',
  (DATE_TRUNC('year', NOW()) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  'active', 'system'
);

-- ============================================================
-- STEP 6: SEED APP SETTINGS
-- ============================================================

INSERT INTO settings (
  agency_id, setting_key, setting_value,
  setting_type, description
) VALUES

-- General
('AGENCY_ID_PLACEHOLDER'::UUID, 'agency_timezone',      'America/Chicago',              'string',  'Agency timezone for scheduling and display'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'fiscal_year_start',    '01-01',                        'string',  'Fiscal year start MM-DD'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'accounting_method',    'cash',                         'string',  'Cash or accrual basis'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'currency',             'USD',                          'string',  'Currency code'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'date_format',          'MM/DD/YYYY',                   'string',  'Display date format'),

-- Daily Briefing
('AGENCY_ID_PLACEHOLDER'::UUID, 'briefing_enabled',     'true',                         'boolean', 'Daily briefing email enabled'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'briefing_time',        '06:00',                        'string',  'Daily briefing send time (24hr, agency timezone)'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'briefing_email',       'CLIENT_PRIMARY_EMAIL',         'string',  'Email address for daily briefing'),

-- Compliance Alerts
('AGENCY_ID_PLACEHOLDER'::UUID, 'compliance_alert_days_critical', '30',               'integer', 'Days before deadline to fire critical compliance alert'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'compliance_alert_days_warning',  '60',               'integer', 'Days before deadline to fire warning compliance alert'),

-- Financial Display
('AGENCY_ID_PLACEHOLDER'::UUID, 'dashboard_revenue_period',  'mtd',                    'string',  'Dashboard revenue display: mtd, qtd, ytd'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'aipp_program_year',         'CLIENT_CURRENT_YEAR',    'integer', 'Current AIPP program year'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'aipp_target',               'CLIENT_GOALS_AIPP_TARGET','integer','Current year AIPP target amount'),

-- Social Media
('AGENCY_ID_PLACEHOLDER'::UUID, 'instagram_manual_reminder', 'true',                   'boolean', 'Fire alert for Instagram manual posts'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'social_post_time_facebook', '09:00',                  'string',  'Default Facebook post time'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'social_post_time_linkedin', '12:00',                  'string',  'Default LinkedIn post time'),

-- HR
('AGENCY_ID_PLACEHOLDER'::UUID, 'resume_scanner_enabled',    'true',                   'boolean', 'Auto-scan Gmail for incoming resumes'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'onboarding_template',       'licensed',               'string',  'Default onboarding template: licensed, unlicensed, family'),

-- BCC Meta
('AGENCY_ID_PLACEHOLDER'::UUID, 'bcc_version',              '1.0',                      'string',  'BCC version installed'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'built_by',                 'Imaginary Farms LLC',      'string',  'BCC builder attribution'),
('AGENCY_ID_PLACEHOLDER'::UUID, 'setup_date',               'CLIENT_SETUP_DATE',        'string',  'Date BCC was set up');

-- ============================================================
-- STEP 7: SEED NOTIFICATION PREFERENCES
-- Default preferences for owner — they can customize later
-- ============================================================

-- Get owner user ID for preference linkage
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID
  AND role = 'owner'
  LIMIT 1;

  INSERT INTO notification_preferences (
    agency_id, user_id, notification_type, channel, is_enabled, frequency
  ) VALUES
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'compliance_critical',     'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'compliance_warning',      'in_app',  TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'automation_failed',       'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'automation_partial',      'in_app',  TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'new_applicant',           'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'document_processed',      'in_app',  TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'document_failed',         'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'daily_briefing',          'email',   TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'task_due_soon',           'in_app',  TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'goal_milestone',          'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'instagram_manual_needed', 'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'monthly_performance',     'in_app',  TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'license_renewal',         'both',    TRUE,  'immediate'),
  ('AGENCY_ID_PLACEHOLDER'::UUID, v_user_id, 'eo_renewal',              'both',    TRUE,  'immediate');
END $$;

-- ============================================================
-- STEP 8: UPDATE AUTOMATION RECIPES WITH AGENCY ID
-- The recipes were seeded in 001 with placeholder —
-- update them to this client's actual agency ID
-- ============================================================

UPDATE automation_recipes
SET agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID
WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID;

-- ============================================================
-- STEP 9: SEED INITIAL WELCOME ALERT
-- First thing agent sees when they open their BCC
-- ============================================================

INSERT INTO alerts (
  agency_id, alert_type, severity,
  title, message,
  module_reference, is_read, is_resolved
) VALUES (
  'AGENCY_ID_PLACEHOLDER'::UUID,
  'system', 'info',
  'Welcome to your Business Command Center',
  'Your BCC is live and loaded with your agency data. Start by reviewing your Dashboard, then explore each module. Your daily briefing will arrive each morning at 6AM. Your document importer is active — send financial documents to your Gmail and they will be processed automatically. Welcome to CLIENT_AGENCY_NAME BCC powered by Imaginary Farms LLC.',
  'dashboard',
  FALSE, FALSE
);

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- Agency record:        Created
-- Owner user:           Created
-- Persistent memory:    9 foundation entries
-- Staff records:        CLIENT-SPECIFIC
-- Goals:                3 current year goals
-- Settings:             21 default settings
-- Notifications:        14 default preferences
-- Welcome alert:        Created
--
-- NEXT STEPS FOR SETUP ASSISTANT:
-- [ ] Run document importer on client financial documents
-- [ ] Verify AIPP target loaded correctly in goals table
-- [ ] Confirm social accounts connected in Composio
-- [ ] Send client their BCC URL and login credentials
-- [ ] Schedule 30-day check-in call
-- [ ] Log setup completion in IF Supabase clients table
-- ============================================================
