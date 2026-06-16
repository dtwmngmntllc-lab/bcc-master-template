-- ============================================================
-- BCC MASTER SCHEMA MIGRATION v1.0
-- Business Command Center — State Farm Agent Edition
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- Run this against a fresh Supabase project to initialize
-- a new client BCC. All tables use Row Level Security (RLS).
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- GROUP 1: FOUNDATION TABLES
-- ============================================================

-- Agency — one row per client installation
CREATE TABLE IF NOT EXISTS agency (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  owner_name            TEXT NOT NULL,
  entity_type           TEXT,                          -- LLC, S-Corp, Sole Prop
  tax_id                TEXT,                          -- EIN (encrypted at rest)
  state_farm_agent_code TEXT,                          -- e.g. IL 22-441A
  licensing_states      TEXT[],                        -- array of state codes
  primary_email         TEXT NOT NULL,                 -- personal, not @statefarm.com
  phone                 TEXT,
  address               TEXT,
  google_account_email  TEXT,                          -- ties Vercel/Supabase/Composio
  supabase_project_id   TEXT,                          -- self-reference for automation
  composio_account_id   TEXT,                          -- Composio connection reference
  vercel_url            TEXT,                          -- their BCC URL
  setup_date            DATE,
  status                TEXT DEFAULT 'active',         -- active, paused, inactive
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Users — everyone with BCC app access
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID REFERENCES agency(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'readonly',    -- owner, manager, staff, readonly, accountant
  auth_user_id    UUID,                                -- Supabase Auth reference
  invited_by      UUID REFERENCES users(id),
  invited_at      TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Persistent Memory — the agency brain
CREATE TABLE IF NOT EXISTS persistent_memory (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   UUID REFERENCES agency(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,                           -- agency_profile, staff, business_rules,
                                                       -- goals, relationships, compliance_notes,
                                                       -- financial_context
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  added_by    TEXT DEFAULT 'system',                   -- system, claude, owner
  source      TEXT,                                    -- where this memory came from
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Staff — agency team members (separate from app users)
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID REFERENCES agency(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  role            TEXT,                                -- Licensed Agent, Office Manager, etc.
  employment_type TEXT,                                -- w2, 1099, family
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  email           TEXT,
  phone           TEXT,
  pay_type        TEXT,                                -- salary, hourly, commission
  pay_rate        NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts — central alert system
CREATE TABLE IF NOT EXISTS alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  alert_type        TEXT NOT NULL,                     -- compliance, automation, financial,
                                                       -- hr, document, system
  severity          TEXT NOT NULL DEFAULT 'info',      -- info, warning, critical
  title             TEXT NOT NULL,
  message           TEXT,
  module_reference  TEXT,                              -- which module this alert belongs to
  related_id        UUID,                              -- optional reference to related record
  is_read           BOOLEAN DEFAULT FALSE,
  is_resolved       BOOLEAN DEFAULT FALSE,
  due_date          DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

-- ============================================================
-- GROUP 2: FINANCIALS
-- ============================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  account_code     TEXT NOT NULL,
  account_name     TEXT NOT NULL,
  account_type     TEXT NOT NULL,                      -- asset, liability, equity, income, expense
  account_subtype  TEXT,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  is_active        BOOLEAN DEFAULT TRUE,
  is_system        BOOLEAN DEFAULT FALSE,              -- system accounts cannot be deleted
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, account_code)
);

-- Journal Entries — header record
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  entry_date       DATE NOT NULL,
  entry_type       TEXT,                               -- standard, adjusting, closing, reversing
  reference_number TEXT,
  description      TEXT NOT NULL,
  memo             TEXT,
  source           TEXT DEFAULT 'manual',              -- manual, importer, automation, system
  document_id      UUID,                               -- references documents table
  created_by       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Lines — every debit and credit
CREATE TABLE IF NOT EXISTS journal_lines (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES chart_of_accounts(id),
  debit            NUMERIC(12,2) DEFAULT 0,
  credit           NUMERIC(12,2) DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT debit_credit_check CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             UUID REFERENCES agency(id) ON DELETE CASCADE,
  account_name          TEXT NOT NULL,
  institution           TEXT NOT NULL,
  account_type          TEXT,                          -- checking, savings, money_market
  account_number_last4  TEXT,
  routing_number_last4  TEXT,
  current_balance       NUMERIC(12,2),
  as_of_date            DATE,
  is_primary            BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Accounts — cards, loans, lines of credit
CREATE TABLE IF NOT EXISTS credit_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             UUID REFERENCES agency(id) ON DELETE CASCADE,
  account_name          TEXT NOT NULL,
  institution           TEXT NOT NULL,
  account_type          TEXT NOT NULL,                 -- credit_card, loan, line_of_credit
  account_number_last4  TEXT,
  credit_limit          NUMERIC(12,2),
  current_balance       NUMERIC(12,2) DEFAULT 0,
  available_credit      NUMERIC(12,2),
  interest_rate         NUMERIC(5,2),
  minimum_payment       NUMERIC(10,2),
  payment_due_day       INTEGER,                       -- day of month payment is due
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  credit_account_id UUID REFERENCES credit_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description      TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  transaction_type TEXT,                               -- charge, payment, fee, interest
  journal_entry_id UUID REFERENCES journal_entries(id),
  category         TEXT,
  receipt_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll Runs — one per pay period
CREATE TABLE IF NOT EXISTS payroll_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  pay_period_start  DATE NOT NULL,
  pay_period_end    DATE NOT NULL,
  pay_date          DATE NOT NULL,
  payroll_provider  TEXT,                              -- Gusto, ADP, Paychex, manual
  gross_payroll     NUMERIC(12,2),
  employer_taxes    NUMERIC(12,2),
  net_payroll       NUMERIC(12,2),
  status            TEXT DEFAULT 'draft',              -- draft, processed, paid
  source_document_id UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll Detail — per employee per run
CREATE TABLE IF NOT EXISTS payroll_detail (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id    UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  staff_id          UUID REFERENCES staff(id),
  gross_pay         NUMERIC(10,2),
  federal_tax       NUMERIC(10,2) DEFAULT 0,
  state_tax         NUMERIC(10,2) DEFAULT 0,
  social_security   NUMERIC(10,2) DEFAULT 0,
  medicare          NUMERIC(10,2) DEFAULT 0,
  other_deductions  NUMERIC(10,2) DEFAULT 0,
  net_pay           NUMERIC(10,2),
  employment_type   TEXT,                              -- w2, 1099, family
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 3: STATE FARM COMPENSATION
-- ============================================================

-- COMP_RECAP — monthly SF compensation detail
CREATE TABLE IF NOT EXISTS comp_recap (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID REFERENCES agency(id) ON DELETE CASCADE,
  period_year          INTEGER NOT NULL,
  period_month         INTEGER NOT NULL,               -- 1-12
  comp_type            TEXT,                           -- new_business, renewal, bonus, other
  comp_category        TEXT,                           -- detailed SF category
  description          TEXT,
  amount               NUMERIC(12,2) NOT NULL,
  is_aipp_eligible     BOOLEAN DEFAULT FALSE,
  is_scoreboard_eligible BOOLEAN DEFAULT FALSE,
  source_document_id   UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, period_year, period_month, comp_category, description)
);

-- AIPP Tracking — annual incentive program
CREATE TABLE IF NOT EXISTS aipp_tracking (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             UUID REFERENCES agency(id) ON DELETE CASCADE,
  program_year          INTEGER NOT NULL,
  target_amount         NUMERIC(12,2),
  earned_ytd            NUMERIC(12,2) DEFAULT 0,
  projected_full_year   NUMERIC(12,2),
  achievement_percentage NUMERIC(5,2),
  last_updated          TIMESTAMPTZ DEFAULT NOW(),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, program_year)
);

-- ScoreBoard Tracking — SF performance metrics
CREATE TABLE IF NOT EXISTS scoreboard_tracking (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id             UUID REFERENCES agency(id) ON DELETE CASCADE,
  program_year          INTEGER NOT NULL,
  period                TEXT,                          -- monthly, quarterly, annual
  metric_name           TEXT NOT NULL,
  target                NUMERIC(12,2),
  actual                NUMERIC(12,2),
  achievement_percentage NUMERIC(5,2),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 4: COMPLIANCE
-- ============================================================

-- Compliance Rules — SF rules library
CREATE TABLE IF NOT EXISTS compliance_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID REFERENCES agency(id) ON DELETE CASCADE,
  rule_code       TEXT,
  category        TEXT NOT NULL,                       -- social_media, advertising, licensing,
                                                       -- financial, data_privacy, conduct
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  requirement     TEXT,                                -- what exactly is required
  source          TEXT,                                -- SF compliance manual reference
  effective_date  DATE,
  expiration_date DATE,
  severity        TEXT DEFAULT 'info',                 -- info, warning, critical
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Calendar — deadlines and recurring requirements
CREATE TABLE IF NOT EXISTS compliance_calendar (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id          UUID REFERENCES agency(id) ON DELETE CASCADE,
  compliance_rule_id UUID REFERENCES compliance_rules(id),
  title              TEXT NOT NULL,
  description        TEXT,
  due_date           DATE NOT NULL,
  recurrence         TEXT DEFAULT 'none',              -- none, monthly, quarterly, annual
  status             TEXT DEFAULT 'upcoming',          -- upcoming, due, overdue, completed
  completed_at       TIMESTAMPTZ,
  completed_by       TEXT,
  alert_days_before  INTEGER DEFAULT 14,               -- fire alert this many days before due
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Log — audit trail for Claude guardrails
CREATE TABLE IF NOT EXISTS compliance_log (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id          UUID REFERENCES agency(id) ON DELETE CASCADE,
  compliance_rule_id UUID REFERENCES compliance_rules(id),
  event_type         TEXT,                             -- review, violation_flagged, completed,
                                                       -- claude_pushback, acknowledged
  description        TEXT NOT NULL,
  conversation_reference TEXT,                         -- Claude conversation context
  created_by         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 5: AUTOMATIONS & DOCUMENTS
-- ============================================================

-- Automation Recipes — stored in Supabase, executed via Composio
-- Cron triggers fire from Supabase, Composio handles execution,
-- Groq (free LLM) handles document processing — no API key needed
CREATE TABLE IF NOT EXISTS automation_recipes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id           UUID REFERENCES agency(id) ON DELETE CASCADE,
  recipe_name         TEXT NOT NULL,
  recipe_description  TEXT,
  trigger_type        TEXT NOT NULL,                   -- cron, webhook, manual, event
  cron_expression     TEXT,                            -- e.g. "0 6 * * *" = 6AM daily
  trigger_event       TEXT,                            -- e.g. "new_email_received"
  composio_action     TEXT,                            -- which Composio tool executes
  composio_connection TEXT,                            -- gmail, gdrive, gcalendar, facebook,
                                                       -- linkedin, instagram
  groq_prompt         TEXT,                            -- prompt for Groq document processing
  input_config        JSONB,                           -- what to watch/read (JSON config)
  output_table        TEXT,                            -- Supabase table to write results to
  output_config       JSONB,                           -- how to write results (JSON config)
  is_active           BOOLEAN DEFAULT TRUE,
  last_run_at         TIMESTAMPTZ,
  last_run_status     TEXT,                            -- success, failed, partial
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Run Log — every execution recorded
CREATE TABLE IF NOT EXISTS automation_run_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  recipe_id         UUID REFERENCES automation_recipes(id),
  run_at            TIMESTAMPTZ DEFAULT NOW(),
  status            TEXT NOT NULL,                     -- success, failed, partial
  records_processed INTEGER DEFAULT 0,
  error_message     TEXT,
  duration_seconds  INTEGER,
  output_summary    TEXT,                              -- human-readable summary of what ran
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Documents — all files received or uploaded
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_type         TEXT,                              -- pdf, csv, xlsx, docx, jpg
  upload_source     TEXT,                              -- email_auto, direct_upload, drive
  drive_file_id     TEXT,                              -- Google Drive file ID
  drive_url         TEXT,
  processing_status TEXT DEFAULT 'pending',            -- pending, processing, complete, failed
  processing_type   TEXT,                              -- database_import, chat_context, archive
  groq_classification TEXT,                            -- how Groq classified this document
  tables_updated    TEXT[],                            -- which Supabase tables received data
  records_created   INTEGER DEFAULT 0,
  uploaded_by       TEXT,
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Briefing Log
CREATE TABLE IF NOT EXISTS daily_briefing_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  briefing_date    DATE NOT NULL,
  sent_at          TIMESTAMPTZ,
  delivered        BOOLEAN DEFAULT FALSE,
  opened           BOOLEAN DEFAULT FALSE,
  content_snapshot TEXT,                               -- full briefing text for reference
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 6: SOCIAL MEDIA
-- ============================================================

-- Social Accounts — connected platforms
CREATE TABLE IF NOT EXISTS social_accounts (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id              UUID REFERENCES agency(id) ON DELETE CASCADE,
  platform               TEXT NOT NULL,                -- facebook, instagram, linkedin, twitter
  account_handle         TEXT,
  account_id             TEXT,
  is_connected           BOOLEAN DEFAULT FALSE,
  last_sync              TIMESTAMPTZ,
  composio_connection_id TEXT,                         -- reference to Composio connection
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Content Calendar
CREATE TABLE IF NOT EXISTS content_calendar (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  content_type     TEXT,                               -- post, story, reel, article
  caption          TEXT,
  hashtags         TEXT[],
  media_url        TEXT,
  scheduled_date   DATE,
  scheduled_time   TIME,
  status           TEXT DEFAULT 'draft',               -- draft, scheduled, posted, failed
  post_url         TEXT,                               -- URL of live post after posting
  engagement_notes TEXT,
  requires_manual  BOOLEAN DEFAULT FALSE,              -- Instagram requires manual post
  created_by       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  posted_at        TIMESTAMPTZ
);

-- Social Analytics
CREATE TABLE IF NOT EXISTS social_analytics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id           UUID REFERENCES agency(id) ON DELETE CASCADE,
  social_account_id   UUID REFERENCES social_accounts(id),
  content_calendar_id UUID REFERENCES content_calendar(id),
  platform            TEXT NOT NULL,
  post_date           DATE,
  impressions         INTEGER DEFAULT 0,
  reach               INTEGER DEFAULT 0,
  likes               INTEGER DEFAULT 0,
  comments            INTEGER DEFAULT 0,
  shares              INTEGER DEFAULT 0,
  clicks              INTEGER DEFAULT 0,
  recorded_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 7: TASKS & GOALS
-- ============================================================

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  assigned_to       UUID REFERENCES users(id),
  created_by        TEXT,
  due_date          DATE,
  priority          TEXT DEFAULT 'medium',             -- low, medium, high, critical
  status            TEXT DEFAULT 'open',               -- open, in_progress, completed, cancelled
  module_reference  TEXT,                              -- which module this task relates to
  related_id        UUID,                              -- optional reference to related record
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID REFERENCES agency(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT,                                  -- revenue, aipp, team, compliance, personal
  target_value  NUMERIC(12,2),
  current_value NUMERIC(12,2) DEFAULT 0,
  unit          TEXT,                                  -- dollars, percentage, count
  target_date   DATE,
  status        TEXT DEFAULT 'active',                 -- active, achieved, paused, cancelled
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Settings — key/value store for app configuration
CREATE TABLE IF NOT EXISTS settings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID REFERENCES agency(id) ON DELETE CASCADE,
  setting_key  TEXT NOT NULL,
  setting_value TEXT,
  setting_type TEXT,                                   -- string, boolean, integer, json
  description  TEXT,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, setting_key)
);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID REFERENCES agency(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel           TEXT DEFAULT 'both',               -- email, in_app, both
  is_enabled        BOOLEAN DEFAULT TRUE,
  frequency         TEXT DEFAULT 'immediate',          -- immediate, daily_digest, weekly
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP 8: HR — RECRUITING, ONBOARDING & PERFORMANCE
-- ============================================================

-- Positions — open roles at the agency
CREATE TABLE IF NOT EXISTS positions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID REFERENCES agency(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  department       TEXT,
  employment_type  TEXT,                               -- full_time, part_time, contract
  license_required BOOLEAN DEFAULT FALSE,
  license_type     TEXT,                               -- P&C, Life, Health
  description      TEXT,
  requirements     TEXT,
  status           TEXT DEFAULT 'open',                -- open, filled, closed, paused
  opened_date      DATE,
  filled_date      DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Applicants — recruiting pipeline
-- Resumes auto-ingested from Gmail via Composio + Groq scoring
CREATE TABLE IF NOT EXISTS applicants (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID REFERENCES agency(id) ON DELETE CASCADE,
  position_id          UUID REFERENCES positions(id),
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  resume_document_id   UUID REFERENCES documents(id),
  resume_url           TEXT,
  claude_score         INTEGER,                        -- 1-10 score from Groq
  claude_summary       TEXT,                           -- Groq analysis summary
  interview_focus_doc  TEXT,                           -- One Page Interview Focus text
  source               TEXT DEFAULT 'email_auto',      -- email_auto, manual_upload, referral
  intake_email_id      TEXT,                           -- Gmail message ID for reference
  intake_received_at   TIMESTAMPTZ,                    -- when email hit inbox
  status               TEXT DEFAULT 'new',             -- new, screening, interview,
                                                       -- offer, hired, rejected
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID REFERENCES agency(id) ON DELETE CASCADE,
  applicant_id    UUID REFERENCES applicants(id) ON DELETE CASCADE,
  interview_date  TIMESTAMPTZ,
  interviewer     TEXT,
  format          TEXT,                                -- phone, video, in_person
  notes           TEXT,
  rating          INTEGER,                             -- 1-5
  recommendation  TEXT,                                -- advance, reject, hold
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID REFERENCES agency(id) ON DELETE CASCADE,
  applicant_id         UUID REFERENCES applicants(id) ON DELETE CASCADE,
  offer_date           DATE,
  position             TEXT,
  start_date           DATE,
  base_pay             NUMERIC(10,2),
  commission_structure TEXT,
  benefits_summary     TEXT,
  offer_letter_doc_id  UUID REFERENCES documents(id),
  status               TEXT DEFAULT 'pending',         -- pending, accepted, declined, rescinded
  response_date        DATE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Checklists — auto-created when applicant marked hired
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID REFERENCES agency(id) ON DELETE CASCADE,
  staff_id      UUID REFERENCES staff(id) ON DELETE CASCADE,
  template_type TEXT,                                  -- licensed, unlicensed, family
  item_name     TEXT NOT NULL,
  category      TEXT,                                  -- licensing, documents, systems,
                                                       -- training, compliance
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  completed_by  TEXT,
  is_required   BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Commission Structures — per employee
CREATE TABLE IF NOT EXISTS commission_structures (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID REFERENCES agency(id) ON DELETE CASCADE,
  staff_id             UUID REFERENCES staff(id) ON DELETE CASCADE,
  structure_name       TEXT NOT NULL,
  effective_date       DATE NOT NULL,
  commission_type      TEXT,                           -- flat_rate, tiered, product_based
  rate                 NUMERIC(5,2),                   -- percentage
  cap                  NUMERIC(10,2),                  -- maximum commission cap if any
  qualifying_products  TEXT[],                         -- which products qualify
  notes                TEXT,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Performance — monthly KPIs
CREATE TABLE IF NOT EXISTS staff_performance (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id          UUID REFERENCES agency(id) ON DELETE CASCADE,
  staff_id           UUID REFERENCES staff(id) ON DELETE CASCADE,
  period_year        INTEGER NOT NULL,
  period_month       INTEGER NOT NULL,                 -- 1-12
  metric_name        TEXT NOT NULL,
  target             NUMERIC(12,2),
  actual             NUMERIC(12,2),
  achievement_pct    NUMERIC(5,2),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, staff_id, period_year, period_month, metric_name)
);

-- ============================================================
-- INDEXES — for query performance
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'agency_id') THEN
    CREATE INDEX IF NOT EXISTS idx_alerts_agency_unresolved ON alerts(agency_id, is_resolved);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_journal_entries_date        ON journal_entries(agency_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account       ON journal_lines(account_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comp_recap' AND column_name = 'agency_id') THEN
    CREATE INDEX IF NOT EXISTS idx_comp_recap_period ON comp_recap(agency_id, period_year, period_month);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled  ON content_calendar(agency_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_automation_run_log_recipe   ON automation_run_log(recipe_id, run_at);
CREATE INDEX IF NOT EXISTS idx_applicants_status           ON applicants(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_performance_period    ON staff_performance(agency_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_persistent_memory_category ON persistent_memory(agency_id, category);
CREATE INDEX IF NOT EXISTS idx_documents_status           ON documents(agency_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_tasks_status               ON tasks(agency_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_calendar_due    ON compliance_calendar(agency_id, due_date, status);

-- ============================================================
-- ROW LEVEL SECURITY — every table locked to agency_id
-- ============================================================

ALTER TABLE agency                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE persistent_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                   ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  -- Guard: only enable RLS if this table was created by this migration (has agency_id column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'agency_id') THEN
    ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
DO $$ BEGIN
  -- Guard: only enable RLS if this table was created by this migration (has agency_id column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chart_of_accounts' AND column_name = 'agency_id') THEN
    ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE journal_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs            ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  -- Guard: only enable RLS if this table was created by this migration (has agency_id column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_detail' AND column_name = 'agency_id') THEN
    ALTER TABLE payroll_detail ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
DO $$ BEGIN
  -- Guard: only enable RLS if this table was created by this migration (has agency_id column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comp_recap' AND column_name = 'agency_id') THEN
    ALTER TABLE comp_recap ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
DO $$ BEGIN
  -- Guard: only enable RLS if this table was created by this migration (has agency_id column)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aipp_tracking' AND column_name = 'agency_id') THEN
    ALTER TABLE aipp_tracking ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE scoreboard_tracking     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_calendar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_recipes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_run_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefing_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_analytics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_structures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- UPDATED_AT TRIGGER — auto-updates timestamp on any row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agency_updated              BEFORE UPDATE ON agency                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated               BEFORE UPDATE ON users                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_persistent_memory_updated   BEFORE UPDATE ON persistent_memory       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated               BEFORE UPDATE ON staff                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bank_accounts_updated       BEFORE UPDATE ON bank_accounts           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_credit_accounts_updated     BEFORE UPDATE ON credit_accounts         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_automation_recipes_updated  BEFORE UPDATE ON automation_recipes      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_social_accounts_updated     BEFORE UPDATE ON social_accounts         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated               BEFORE UPDATE ON tasks                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_goals_updated               BEFORE UPDATE ON goals                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_settings_updated            BEFORE UPDATE ON settings                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notification_prefs_updated  BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_applicants_updated          BEFORE UPDATE ON applicants              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_commission_updated          BEFORE UPDATE ON commission_structures   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: DEFAULT AUTOMATION RECIPES (skipped — applied in 004 after agency exists)
-- ============================================================
-- The original seed block is moved to 004 because it needs a real agency_id.
-- Schema migration 001 is now schema-only.
