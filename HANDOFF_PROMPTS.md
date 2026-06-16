# BCC Project Claude Handoff Prompts
## Canonical templates for client install handoffs

There are exactly two install paths. Pick the one that matches the client's Supabase state.

---

| Path | When to use | Time estimate |
|---|---|---|
| **Option A — Existing Database** | Client already has a Supabase built out and populated (built before the BCC web app schema existed) | 1-3 hours with the toolkit |
| **Option B — Clean Install** | Client's Supabase is brand new and empty, no legacy data | 1-2 hours |

**Decision rule:** If the client has ANY tables in their Supabase beyond the Supabase defaults, use Option A. Otherwise Option B.

---

# OPTION B — CLEAN INSTALL HANDOFF PROMPT
## For Project Claudes whose client has a brand new, empty Supabase

> **Copy this prompt. Replace the four placeholders. Paste into the client's Project Claude.**

**Placeholders to fill in:**
- `[CLIENT-FIRST-NAME]` — e.g., Quentin, Nathaniel
- `[GITHUB-OWNER]` — e.g., qfagencybusinessclaude-a11y
- `[GITHUB-REPO]` — e.g., qfranklinbccwebapp
- `[COMMIT-SHA]` — first 7 chars of the initial commit, e.g., 83d8c7c

---

### PROMPT BEGINS

Your BCC web app starter repo has just been pushed to your GitHub.

**Repo:** `[GITHUB-OWNER]/[GITHUB-REPO]` (branch: `main`)
**Initial commit:** `[COMMIT-SHA]`
**Source:** Imaginary Farms BCC master template

**This is a CLEAN INSTALL.** [CLIENT-FIRST-NAME]'s Supabase is brand new and empty. There's no legacy schema. There's no audit. There's no bridging. You install the schema first, then we add data after. **Do NOT use `SCHEMA_NORMALIZATION_RUNBOOK.md` — that's for existing-database installs only. Ignore it.**

#### Step-by-step

**1. Read `CLAUDE.md`** at the repo root. This is your install bible — env vars, smoke test, the 10 hard-learned bugs from prior installs.

**2. Apply migrations to [CLIENT-FIRST-NAME]'s empty Supabase, in order, in Supabase Studio SQL Editor:**
- `supabase/migrations/001_bcc_master_schema.sql` — creates 37 master tables
- `supabase/migrations/002_seed_compliance_rules.sql` — State Farm compliance calendar baseline
- `supabase/migrations/003_seed_chart_of_accounts.sql` — standard COA for State Farm agencies
- `supabase/migrations/004_seed_agency_record.sql` — base agency + settings record (Rebecca will personalize after deploy)
- `supabase/migrations/005_anon_read_policies.sql` — anon role grants for the web app
- `supabase/migrations/006_derived_financial_views.sql` — `v_income_statement` and `v_balance_sheet`
- `supabase/migrations/007_monthly_close_checklist.sql` — monthly close infrastructure
- `supabase/migrations/010_producer_roi_infrastructure.sql` — Producer ROI feature: SMVC/blended/lapse columns on agency, producer_production table
- `supabase/migrations/011_automation_runner.sql` — **REQUIRED** — installs the engine that fires recipes (`run_due_automation_recipes`, `run_automation_recipe`, `get_setting`, cron parser). Enables `pg_net` extension. Without this migration, the 12 canonical recipes you seed in step 5.5 will sit inert and Layer 4 (Automations) does nothing
- `supabase/migrations/012_internal_recipe_handlers.sql` — **REQUIRED** — ships the SQL handlers for the 3 INTERNAL recipes (#8 GL Entry Writer, #11 Monthly Close Monitor, #12 Producer Underperformance Watcher) plus the `run_internal_recipe()` dispatcher. Without this migration, those 3 recipes fail every time they fire (the runner has no path to dispatch INTERNAL actions). End-user impact: P&L stays at $0 even when comp data is flowing in

Each migration is `IF NOT EXISTS` safe. Run them top-to-bottom. **Skip migration 008** (`bridge_generator.sql`) — that's for existing-database installs only.

**There is no migration 009.** The number was reserved for a SQL diagnostic query that lives in `tools/schema_audit_query.sql` (not a DDL migration).

**3. Verify the schema landed cleanly.** In Studio:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' ORDER BY table_name;
```
You should see 38 tables (37 core + `producer_production`) and 2 views (`v_income_statement`, `v_balance_sheet`). If anything is missing, re-run that specific migration.

Confirm the agency table got the new ROI columns:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='agency'
  AND column_name IN ('smvc_rate_pc','blended_rate_other','lapse_rate_annual');
```
You should see all three. If not, re-run migration 010.

**3.5. Ask [CLIENT-FIRST-NAME] for their A005 SMVC commission rate** (most agents know this — it's their P&C commission per the State Farm A005 agreement). Also confirm their blended commission rate for non-P&C lines (Life/Health/FS — typically 8-10%). Update the agency record:
```sql
UPDATE agency
SET smvc_rate_pc       = 10.00,   -- replace with their actual rate
    blended_rate_other =  9.00,   -- replace with their actual blended rate
    lapse_rate_annual  = NULL     -- NULL = compute from comp_recap; override only if they want a fixed rate
WHERE id = (SELECT id FROM agency LIMIT 1);
```
**This is required for the Performance tab in HR & People to compute Producer ROI projections correctly.** If you skip this step, the tab will use defaults (10% SMVC, 9% blended) which may not match the agent's reality. See `docs/PRODUCER_ROI_INSTALL.md` for full Performance tab onboarding details.

**4. Vercel setup:**
- Sign in to Vercel with **GitHub** (not Google)
- Import `[GITHUB-OWNER]/[GITHUB-REPO]`
- Framework preset: **Vite**
- Set env vars (Production + Preview + Development):
  - `VITE_SUPABASE_URL` = [CLIENT-FIRST-NAME]'s Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` = anon public key from Supabase → Settings → API
  - `VITE_AGENCY_ID` = result of `SELECT id FROM agency LIMIT 1;` (will exist after migration 004)
  - `VITE_USE_MOCK_DATA` = `false` ← **must be false. Mock data is a lie.**
- Deploy

**5. Browser smoke test (in this order):**
- (a) Dashboard loads, agency name renders in header (will show seed value from migration 004 until Rebecca personalizes it)
- (b) Financials → General Ledger loads — will show empty state with "No journal entries yet" (correct, no data has been added)
- (c) HR & People → Performance tab loads — will show "No producers found" until staff are added (correct)
- (d) HR → Add Employee form has separate `first_name` and `last_name` fields
- (e) Settings → About → Keep It Connected loads with the green self-heal hero card. The connector status indicators below the hero card render (don't worry about their state — just confirm they render)
- (e2) Automations module loads, shows all 12 canonical recipes you seeded, with status pills. After the smoke test in Step 5.5, the Daily Briefing recipe should show last_run_status='success' here
- (f) All other modules load without crashing — they should all show empty states (the ErrorBoundary will surface any errors with full diagnostics, not blank tabs)

**5.5. Install the document importer (= seed recipes + deploy the runner engine).** This is the single most important install step. **The 12 canonical recipes ARE the document importer** — they read [CLIENT-FIRST-NAME]'s Gmail every day, parse comp recaps, deduction statements, payroll notifications, bank/CC statements, and producer production reports via Composio's LLM, and write structured rows into the right tables. Read `docs/DOCUMENT_IMPORTER_GUIDE.md` first — it explains why you should NOT build a parallel importer.

Then walk through `docs/AUTOMATIONS_INSTALL.md` end-to-end. Specifically:

  - **Step 4 of that doc** — insert all 12 recipes using the SQL templates (replace `[AGENCY_ID]`, `[AGENT_NAME]`, `[AGENT_PERSONAL_EMAIL]`)
  - **Step 5a-5d of that doc** — apply migration 011 (already covered in step 2 above), deploy the `automation-runner` Edge Function via `supabase functions deploy automation-runner --no-verify-jwt`, INSERT the required settings credential rows for the runner (composio_api_key, composio_user_id, composio_<conn>_account_id rows, automation_runner_cron_secret, supabase_url — NO groq_api_key, LLM calls route through Composio), schedule pg_cron with `SELECT cron.schedule('automation-runner-tick', '* * * * *', $$ SELECT public.run_due_automation_recipes(); $$);`
  - **Step 6 of that doc** — fire the Daily Briefing recipe manually as a smoke test. Confirm 200 from the Edge Function, success row in `automation_run_log`, and the agent receives the briefing email.

Without all four sub-steps complete, the recipes sit inert and the document importer doesn't run. The Daily Briefing smoke test is the only way to know the entire pipeline works end-to-end.

**5.6. Build the personalized Project Claude system prompt.** Open `docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md`. Fill in every `[BRACKETED]` placeholder using [CLIENT-FIRST-NAME]'s actual data — pull values from their `agency` table, GitHub repo URL, Vercel deployment URL, Supabase project ID. **Do NOT install this into [CLIENT-FIRST-NAME]'s Project Claude yourself** — output the personalized version as a complete markdown block and hand it to Rebecca. She will copy/paste it into Claude.ai → Project Settings → Custom Instructions.

**6. Report back to Rebecca with:**
- Confirmation all 8 migrations ran clean (001-007 + 010)
- Vercel production URL
- Smoke-test result per check
- Recipe seed status — how many of the 12 standard recipes are inserted
- The personalized Project Claude system prompt (ready for her to paste)
- Screenshot of the empty dashboard so she can verify it's ready for data

#### What happens after Phase 5 (Rebecca handles, you support)

Once the web app is live and showing empty states, Rebecca will progressively load real data — agency record updates, chart of accounts customizations, employees, journal entries, compliance items, etc. As each piece goes in, it surfaces in the web app in real time. **The schema is the contract; data flows in to fill it.**

#### Hard rules

- **Never edit the React modules** to match anything. There's nothing to match — the database already matches.
- **Imports must be line 1** of every `.jsx` module (Vite drops imports if a comment precedes them).
- **After any Vercel fix, "Redeploy without cache."**
- **Empty modules show `EmptyState` components, not crashes.** That's correct behavior pre-data.

### PROMPT ENDS


---

# OPTION A — EXISTING DATABASE HANDOFF PROMPT
## For Project Claudes whose client already has a populated Supabase

> **Copy this prompt. Replace the four placeholders. Paste into the client's Project Claude.**

**Placeholders to fill in:**
- `[CLIENT-FIRST-NAME]` — e.g., Sherry, Dominique
- `[GITHUB-OWNER]` — e.g., sddpersonalassist-png
- `[GITHUB-REPO]` — e.g., dennardbccwebapp
- `[COMMIT-SHA]` — first 7 chars of the initial commit, e.g., 49ae8b1

---

### PROMPT BEGINS

Your BCC web app starter repo has just been pushed to your GitHub.

**Repo:** `[GITHUB-OWNER]/[GITHUB-REPO]` (branch: `main`)
**Initial commit:** `[COMMIT-SHA]`
**Source:** Imaginary Farms BCC master template (with schema normalization toolkit)

**This is an EXISTING-DATABASE INSTALL.** [CLIENT-FIRST-NAME]'s Supabase is already built out and populated. The web app expects 37 specific tables with specific columns; [CLIENT-FIRST-NAME]'s database has those concepts under different names. **Do NOT edit the React modules to match the legacy schema.** Instead, the database conforms to the web app via VIEWS. Real tables and data stay untouched.

#### Step-by-step

**1. Read both docs at the repo root, in this order:**
- `SCHEMA_NORMALIZATION_RUNBOOK.md` — the playbook for fitting the web app to an existing database (most important file for this install)
- `CLAUDE.md` — the install bible (env vars, smoke test, hard-learned bugs)

**2. Run the schema audit.** Open Supabase Studio for [CLIENT-FIRST-NAME]'s project. Paste and run the contents of `tools/schema_audit_query.sql` (the file in this repo, not a migration — there is no migration 007 schema audit; that number belongs to `007_monthly_close_checklist.sql`). You'll get back ~40 rows in three sections (TABLE AUDIT, VIEW AUDIT, ANON ACCESS).

**3. Categorize results:**
- `ok` rows → nothing to do
- `bridge_needed` rows → note the `legacy_name`, you'll bridge in step 5
- `missing` rows with no legacy_name → run the matching CREATE TABLE blocks from `001_bcc_master_schema.sql` (`IF NOT EXISTS` safe)
- `v_income_statement` / `v_balance_sheet` missing → run `006_derived_financial_views.sql`
- `monthly_close_checklist` missing → run `007_monthly_close_checklist.sql`
- `producer_production` missing OR `agency.smvc_rate_pc` column missing → run `010_producer_roi_infrastructure.sql`
- `automation_runner` Edge Function missing OR `run_due_automation_recipes` function missing → run `011_automation_runner.sql` then deploy the Edge Function (Step 9.5 covers this end-to-end). **REQUIRED** — without this, the recipes you seed in 9.5 will sit inert
- `internal_handler` column missing on `automation_recipes` OR `gl_entry_writer` function missing → run `012_internal_recipe_handlers.sql`. **REQUIRED** — without this, the 3 INTERNAL recipes fail every fire and Financials → P&L stays at $0
- `anon_grants = 0` → run `005_anon_read_policies.sql`

**4. Install the bridge generator.** Run `supabase/migrations/008_bridge_generator.sql` in Studio. This installs the `bcc_generate_bridges()` function — it doesn't create any views yet.

**Also confirm migration 010 ran** (Producer ROI infrastructure). If not in step 3, run it now:
```
supabase/migrations/010_producer_roi_infrastructure.sql
```
Then ask [CLIENT-FIRST-NAME] for their A005 SMVC commission rate and blended rate for non-P&C lines, and update the agency record:
```sql
UPDATE agency
SET smvc_rate_pc       = 10.00,   -- their actual rate
    blended_rate_other =  9.00,   -- their actual blended rate
    lapse_rate_annual  = NULL     -- NULL = compute from comp_recap
WHERE id = (SELECT id FROM agency LIMIT 1);
```
See `docs/PRODUCER_ROI_INSTALL.md` for full Performance tab onboarding details (initial producer_production backfill, commission_structures setup, etc.).

**5. Build the legacy → master JSON map** from the `bridge_needed` rows. Example:
```json
{"employees":"staff", "agencies":"agency", "recipes":"automation_recipes"}
```
Then call:
```sql
SELECT * FROM bcc_generate_bridges('<your-json-here>'::jsonb);
```
Each row returns ready-to-run `CREATE OR REPLACE VIEW` SQL with column-level matching.

**6. Review and apply each bridge.** Read each `bridge_sql` before executing. Unmapped master columns become `NULL` casts of the right type — that's correct. If a bridge has too few matched columns to be useful (e.g., 3 of 18), flag it for Rebecca instead of building a useless view.

**7. Re-run the audit.** Section 1 should now be all `ok`. If anything is still `bridge_needed`, you missed it.

**8. Vercel setup:**
- Sign in with GitHub (not Google)
- Import `[GITHUB-OWNER]/[GITHUB-REPO]`
- Framework preset: **Vite**
- Env vars (Production + Preview + Development):
  - `VITE_SUPABASE_URL` = [CLIENT-FIRST-NAME]'s Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` = anon public key from Supabase → Settings → API
  - `VITE_AGENCY_ID` = `SELECT id FROM agency LIMIT 1;`
  - `VITE_USE_MOCK_DATA` = `false` ← **must be false. Mock data is a lie.**
- Deploy

**9. Browser smoke test (in this order):**
- (a) Dashboard loads, agency name renders correctly in header
- (b) Financials → General Ledger shows real journal entries (highest-risk runtime check — tests PostgREST `!inner` syntax against [CLIENT-FIRST-NAME]'s data)
- (c) HR & People → Performance tab loads. If [CLIENT-FIRST-NAME] has staff with role containing "LSP", "Producer", or "Financial Services", you'll see producer cards. If `producer_production` is empty for those staff, the cards will show $0 issued and "Behind pace" status — that's expected until production data is loaded.
- (d) HR → Add Employee form has separate `first_name` and `last_name` fields
- (e) Settings → About → Keep It Connected shows the green self-heal hero card. The connector status indicators below the hero card render (don't worry about their state — just confirm they render)
- (e2) Automations module loads, shows all 12 canonical recipes (yours plus any pre-existing). After the smoke test in Step 9.5, the Daily Briefing recipe should show last_run_status='success' here

**9.5. Install the document importer (= seed recipes + deploy the runner engine).** This is the single most important install step. **The 12 canonical recipes ARE the document importer** — they read [CLIENT-FIRST-NAME]'s Gmail every day, parse comp recaps, deduction statements, payroll notifications, bank/CC statements, and producer production reports via Composio's LLM, and write structured rows into the right tables. Read `docs/DOCUMENT_IMPORTER_GUIDE.md` first — it explains why you should NOT build a parallel importer.

Then walk through `docs/AUTOMATIONS_INSTALL.md` end-to-end. Specifically:

  - **Step 4 of that doc** — insert all 12 recipes using the SQL templates (replace `[AGENCY_ID]`, `[AGENT_NAME]`, `[AGENT_PERSONAL_EMAIL]`). For Path A clients, `automation_recipes` may already have a few rows from prior tooling — query the table first and only insert what's missing.
  - **Step 5a-5d of that doc** — apply migration 011 (already covered in step 3 above), deploy the `automation-runner` Edge Function via `supabase functions deploy automation-runner --no-verify-jwt`, INSERT the required settings credential rows for the runner (composio_api_key, composio_user_id, composio_<conn>_account_id rows, automation_runner_cron_secret, supabase_url — NO groq_api_key, LLM calls route through Composio), schedule pg_cron with `SELECT cron.schedule('automation-runner-tick', '* * * * *', $$ SELECT public.run_due_automation_recipes(); $$);`
  - **Step 6 of that doc** — fire the Daily Briefing recipe manually as a smoke test. Confirm 200 from the Edge Function, success row in `automation_run_log`, and the agent receives the briefing email.

Without all four sub-steps complete, the recipes sit inert and the document importer doesn't run. The Daily Briefing smoke test is the only way to know the entire pipeline works end-to-end.

**9.6. Build the personalized Project Claude system prompt.** Open `docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md`. Fill in every `[BRACKETED]` placeholder using [CLIENT-FIRST-NAME]'s actual data — pull from their `agency` table, GitHub repo URL, Vercel deployment URL, Supabase project ID. **Do NOT install this into [CLIENT-FIRST-NAME]'s Project Claude yourself** — output the personalized version as a complete markdown block and hand it to Rebecca. She will copy/paste it into Claude.ai → Project Settings → Custom Instructions after she's reviewed the existing client data and added a few months of comp_recap and financial entries so context is rich.

**10. Report back to Rebecca with:**
- Audit output (all 40 rows, before and after bridges)
- The legacy → master JSON map you built
- Which migrations you ran (if any)
- Vercel production URL
- Smoke-test result per check
- Recipe inventory — what already existed in `automation_recipes`, what you added
- The personalized Project Claude system prompt (ready for her to paste)

#### Hard rules

- **Views only.** Never `DROP`, `ALTER`, `RENAME`, or `DELETE` any of [CLIENT-FIRST-NAME]'s existing tables or data.
- **The React code is the contract.** The database conforms via views. Do NOT edit JSX modules to match the legacy schema.
- **Imports must be line 1** of every `.jsx` module (Vite drops imports if a comment precedes them).
- **After any Vercel fix, "Redeploy without cache."**
- **One bridge view per master table.** Build a manual UNION view if a master concept is split across two legacy tables.

### PROMPT ENDS


---

## Master prompt for Rebecca's session opener

Whenever Rebecca starts a new install with Main Claude, she can say:

> "I'm starting [CLIENT-NAME]. Their GitHub is [URL]. They [have / do not have] an existing Supabase with data."

Main Claude responds with: (a) repo push to client GitHub, (b) the matching prompt below filled in, (c) Supabase session_log entry. No back-and-forth needed.
