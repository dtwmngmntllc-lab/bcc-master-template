# Module Data Wiring Guide

> Per-module reference: which Supabase tables each BCC web app module reads, in what order, what columns, and how to debug when something doesn't render.
>
> **Read this before debugging any module.** If a module shows blank, wrong numbers, or "EmptyState awaiting data," this doc tells you exactly which table to check first.
>
> Read by Project Claude during install (Path A and Path B both) and any time a module isn't rendering correctly.

---

## How to use this doc

The BCC web app has 11 modules. Each one reads from specific tables in the client's Supabase. When the agent says "the dashboard is showing zero" or "my financials look wrong," the answer is always: **check the table this module reads from, in this order.**

The pattern is consistent:
1. Module loads, queries Supabase via `useSupabaseTable` hook or direct `supabase.from()` calls
2. If the table has rows for the agency_id, data renders
3. If the table is empty, `EmptyState awaiting` component shows ("No data yet — your Claude will populate this as comp/payroll/etc flow in")
4. If the query fails (RLS, missing column, missing table), `ErrorBoundary` catches it and shows the diagnostic card

**Never edit the React module code to "fix" a wiring issue.** The web app is the contract. The database conforms via real data, migrations, or bridge views. If the module expects a column the database doesn't have, fix the database.

---

## Quick reference: every module → its primary tables

| Module | Primary tables | Secondary tables / views |
|---|---|---|
| Dashboard | `agency`, `tasks`, `alerts`, `compliance_rules`, `compliance_log`, `monthly_close_checklist`, `aipp_tracking` | `v_income_statement` (derived view) |
| Financials | `comp_recap`, `journal_entries`, `journal_lines`, `chart_of_accounts`, `payroll_runs`, `payroll_detail`, `bank_accounts`, `credit_accounts`, `credit_transactions`, `aipp_tracking`, `scoreboard_tracking` | `v_income_statement`, `v_balance_sheet` |
| ComplianceCenter | `compliance_rules`, `compliance_log`, `compliance_calendar` | — |
| Documents | `documents` | (mock fallback if empty) |
| HRPeople | `staff`, `applicants`, `producer_production`, `payroll_detail`, `payroll_runs`, `comp_recap`, `commission_structures`, `staff_performance` | `agency.smvc_rate_pc`, `agency.blended_rate_other`, `agency.lapse_rate_annual` |
| SocialMedia | `content_calendar`, `social_accounts`, `social_analytics` | — |
| AlertsNotifications | `alerts`, `notification_preferences` | (mock fallback if empty) |
| Automations | `automation_recipes`, `automation_run_log` | — |
| TasksGoals | `tasks`, `goals` | — |
| PersistentMemory | `persistent_memory` | (currently mock-only — full wiring queued) |
| Settings | `agency`, `users`, `settings` | — |

If any of these primary tables are missing entirely from the client's Supabase, the corresponding module will throw — `ErrorBoundary` will catch it and show a diagnostic, but the module won't render. Run the schema audit (`tools/schema_audit_query.sql`) to detect missing tables.

---

## Module-by-module deep dive

Each section below answers four questions Project Claude needs during debugging:
1. **What does this module read?**
2. **What does the agent see if the table is empty?**
3. **What does the agent see if the data is wrong?**
4. **How do I populate it correctly?**

---

### Dashboard

**Reads:**
- `agency` — for header agency name, logo URL, contact info
- `tasks` (where `agency_id = AGENCY_ID AND status = 'open'` order by due_date) — Open Tasks widget
- `alerts` (where `agency_id = AGENCY_ID AND resolved = false`) — Active Alerts widget
- `compliance_log` (last 30 days) — Compliance Activity widget
- `monthly_close_checklist` (current month) — Monthly Close widget
- `aipp_tracking` (current program year) — AIPP Progress card
- `v_income_statement` (derived view) — Revenue YTD card
- `compliance_rules` (next 30 days deadlines) — Upcoming Compliance widget

**If everything is empty:** Dashboard shows the agency header (from `agency` row) with all 7 widgets in their EmptyState. The header tells you `agency` is wired correctly. The widgets tell you the operational tables haven't been populated yet — that's normal pre-data state.

**If something's wrong:**
- Header shows "Untitled Agency" → `agency` table is empty or `agency_name` is NULL. Re-run migration 004 with the client's real data, or `UPDATE agency SET agency_name = '...'`.
- Revenue YTD shows $0 even after comp_recap has rows → `v_income_statement` view is missing or wrong. Re-run migration 006.
- AIPP card shows nothing → `aipp_tracking` row missing for current program year. INSERT one manually with their target.
- Open Tasks shows 0 but agent says they have tasks → check `tasks.status` values. The dashboard expects `'open'`. If the client's data uses `'pending'` or `'todo'`, either UPDATE the values or build a bridge view.

**To populate from scratch:**
1. `agency` row gets created in migration 004; UPDATE with real values
2. `aipp_tracking` row needs manual INSERT for the current program year
3. The other widgets fill in as comp_recap, payroll, etc. start arriving via the document importer recipes

---

### Financials

**Reads (in this order during render):**
- `agency` — for header
- `v_income_statement` (derived view from migration 006) — P&L tab
- `v_balance_sheet` (derived view from migration 006) — Balance Sheet tab
- `comp_recap` — SF Compensation tab (the most important table for this module)
- `journal_entries` + `journal_lines` (joined via `entry_id`) — General Ledger tab
- `chart_of_accounts` — needed by GL for account names
- `payroll_runs` + `payroll_detail` — Payroll tab
- `bank_accounts` + (computed monthly totals from `journal_entries`) — Bank tab
- `credit_accounts` + `credit_transactions` — Credit tab
- `aipp_tracking` — AIPP / ScoreBoard tab
- `scoreboard_tracking` — ScoreBoard sub-section

**If everything is empty:** Financials renders all tabs with EmptyState. Agent sees "$0 revenue, $0 expenses, no journal entries yet." Correct pre-data state.

**If something's wrong:**
- P&L numbers don't match Comp Recap totals → GL Entry Writer recipe (#8) hasn't run, or comp_recap rows haven't been turned into journal_entries yet. Check `automation_run_log` for GL Entry Writer status.
- Comp Recap tab shows entries but P&L is still $0 → `v_income_statement` view depends on `journal_lines`, not `comp_recap` directly. The GL Entry Writer recipe is the bridge. If recipes aren't running (Layer 4 not set up), Comp Recap will populate via the SF Daily Comp Processor but P&L will stay empty until GL Entry Writer fires.
- General Ledger renders but with wrong account names → `chart_of_accounts` missing rows or has different `account_code` values than `journal_lines.account_code` references. Run migration 003 if missing.
- Payroll tab shows no employees → `payroll_runs` empty (Payroll Processor recipe hasn't fired) OR `payroll_detail` missing the join key.
- Bank tab shows accounts but $0 balances → balances are computed from `journal_entries` joined to `bank_accounts`; if no journal entries exist for the bank account, balance shows $0.

**To populate from scratch:**
The document importer (12 canonical recipes) is what populates these tables. See `docs/DOCUMENT_IMPORTER_GUIDE.md`.
1. Recipes 1-2 (SF Daily Comp Processor, Deduction Statement Processor) populate `comp_recap`
2. Recipe 3 (Bank Statement Processor) populates `journal_entries`
3. Recipe 4 (Credit Card Statement Processor) populates `credit_transactions`
4. Recipe 5 (Payroll Processor) populates `payroll_runs` + `payroll_detail`
5. Recipe 8 (GL Entry Writer) reconciles all of the above into `journal_lines`, which feeds `v_income_statement` and `v_balance_sheet`

If the agent has historical data they want loaded before the recipes start running, manual SQL INSERT is fine — recipes will deduplicate via their `unique_on` configs.

---

### ComplianceCenter

**Reads:**
- `compliance_rules` (all rules, filtered by category) — Rules tab
- `compliance_log` (joined to `compliance_rules` for context) — History tab
- `compliance_calendar` (filtered by month) — Calendar tab

**If everything is empty:** Should never happen — migration 002 seeds 57 rules into `compliance_rules`. If this module is empty, migration 002 didn't run. Re-run it.

**If something's wrong:**
- Rules tab shows duplicates → migration 002 was run twice without conflict handling. DELETE duplicates by `(rule_code, agency_id)` keeping one of each.
- History tab is empty but agent has been doing reviews → `compliance_log` writes happen via the Project Claude's compliance check workflow. If agent has been doing them outside the system, those don't show up. Going forward, the agent's Claude inserts to `compliance_log` after each rule check.

**To populate from scratch:**
- `compliance_rules`: migration 002 (run once, has 57 SF rules baseline)
- `compliance_log`: written by the agent's Claude during compliance check conversations
- `compliance_calendar`: should be seeded with annual deadlines per migration 002 OR manually populated with state-specific dates

---

### Documents

**Reads:**
- `documents` (filtered by `agency_id`, ordered by `created_at` DESC)

**If empty:** Module renders with mock fallback (a few example document rows) IF `VITE_USE_MOCK_DATA=true`. In production with `VITE_USE_MOCK_DATA=false`, shows EmptyState.

**If something's wrong:**
- Documents show but no link works → `documents.drive_url` is NULL. Email Archiver recipe (#7) writes the Drive URL when it files attachments. If recipe hasn't run or hasn't filed anything, link will be NULL.
- Document type column is wrong → `documents.document_type` is set by the recipe based on subject/sender heuristics. If the agent's emails don't match the expected patterns, the type will be 'other' or NULL. Update the Email Archiver recipe's classification logic in its `groq_prompt`.

**To populate from scratch:**
The Email Archiver recipe (#7) is what writes to `documents`. It runs daily at 8 AM CDT, reads Gmail, files attachments to Drive, and logs each filing as a `documents` row. After ~2 days of the recipe running, the table starts to populate.

For installations where the agent wants their historical archives indexed, manual INSERT is fine — `documents` is just a metadata table, the actual files live in their Drive.

---

### HRPeople

**Reads (across multiple tabs):**
- **Roster tab:** `staff` (filtered by agency_id, where `is_active != false`)
- **Applicants tab:** `applicants` (with Groq scores from the Resume Auto-Import recipe)
- **Performance tab:** `staff` (producers only — `role` ILIKE '%LSP%' OR '%Producer%' OR '%Financial Services%') joined to `producer_production`, `payroll_detail`, `payroll_runs`, `comp_recap`, plus reads `agency.smvc_rate_pc`, `agency.blended_rate_other`, `agency.lapse_rate_annual`
- **Onboarding tab:** `onboarding_checklists`
- **Reviews tab:** `staff_performance`
- **Commissions tab:** `commission_structures`

**If everything is empty:** Roster shows empty state. Performance tab shows "No producers found." Agent adds employees via the Add Employee form, which writes to `staff`.

**If Performance tab is wrong** (most common HRPeople issue):
- "No producers found" → No staff have a role matching the producer regex. Check `SELECT first_name, last_name, role FROM staff;` and either UPDATE roles or rename the role values.
- Producer cards show but $0 issued premium → `producer_production` is empty. See Producer ROI Install (`docs/PRODUCER_ROI_INSTALL.md`) Step 4. EITHER backfill manually OR wait for the Producer Production Report Processor recipe (#6) to fire on the 1st of next month.
- Producer cards show issued premium but breakeven projection is way off → `agency.smvc_rate_pc` or `agency.blended_rate_other` is wrong. UPDATE them with the agent's actual A005 rates.
- Lapse Rate card shows "—" → `comp_recap` doesn't have prior-year and current-year auto+fire renewal commission rows yet. Backfill comp_recap with at least 12 months of history OR set `agency.lapse_rate_annual` to a manual override (e.g. 8.0 for 8% annual lapse).

**To populate from scratch:**
1. Run migration 010 → adds `producer_production` table and three `agency` columns
2. UPDATE `agency` with real rates (see `docs/PRODUCER_ROI_INSTALL.md` Step 2)
3. INSERT producer rows into `staff` (or use the Add Employee UI)
4. Backfill `producer_production` with at least 3 months of history (`docs/PRODUCER_ROI_INSTALL.md` Step 4)
5. Configure Producer Production Report Processor recipe #6 to keep it current

---

### SocialMedia

**Reads:**
- `content_calendar` (filtered by `agency_id`, scheduled date in current week ± 30 days) — Calendar tab
- `social_accounts` — Connected Accounts tab (which platforms are linked)
- `social_analytics` (last 30 days) — Engagement tab

**If empty:** Calendar shows EmptyState. Connected Accounts shows zero platforms. Agent's Claude populates `content_calendar` as it drafts posts, and `social_accounts` rows are inserted manually during install per platform connected.

**If something's wrong:**
- Posts show but never go live → Social Media Scheduler recipe (#10) hasn't fired or Composio integration is unauthorized. Check `automation_run_log` for the recipe.
- Engagement metrics empty → `social_analytics` populated by a separate recipe (not in canonical 12; per-client opt-in).

**To populate:**
- `social_accounts`: INSERT one row per connected platform during install
- `content_calendar`: agent's Claude inserts as it drafts posts; Social Media Scheduler recipe pulls from this and posts to FB/LI

---

### AlertsNotifications

**Reads:**
- `alerts` (filtered by `agency_id`, ordered by `severity` DESC, `created_at` DESC)
- `notification_preferences` (single row per agency)

**If empty:** Module shows "No active alerts" — that's correct. Alerts get created by recipes (Producer Underperformance Watcher #12, Monthly Close Monitor #11, others) and by Project Claude when something breaks.

**If something's wrong:**
- Alerts show but agent says they've resolved them → toggling the resolved state writes back to `alerts.resolved`. Confirm RLS allows UPDATE (migration 005).

---

### Automations

**Reads:**
- `automation_recipes` (all rows for `agency_id`, ordered by recipe_name) — Recipes tab
- `automation_run_log` (last 30 days, ordered by run_at DESC) — Run Log tab

**If empty:** Module shows "No recipes configured yet." This means the canonical 12 recipes weren't seeded during install. Refer to `docs/AUTOMATIONS_INSTALL.md`.

**If something's wrong:**
- Recipes show but `last_run_status` is always NULL → migration 011 not applied OR Edge Function not deployed OR pg_cron not scheduled. Walk the runner setup steps in `docs/AUTOMATIONS_INSTALL.md` Step 5a-5d.
- Recipes show with `last_run_status = 'failed'` → check `automation_run_log` for the error message. Use the troubleshooting table in `docs/AUTOMATIONS_INSTALL.md` Step 6.
- Run Log empty even though recipes claim to be running → recipes are firing but `automation_run_log` writes are failing. Check RLS policies on the run log table.

**To populate from scratch:**
This is the install flow described in `docs/AUTOMATIONS_INSTALL.md`. Summary:
1. Apply migration 011 (runner SQL functions, pg_net extension)
2. Deploy `automation-runner` Edge Function
3. Insert credentials into `settings`
4. Insert the 12 canonical recipes into `automation_recipes`
5. Schedule pg_cron tick

---

### TasksGoals

**Reads:**
- `tasks` (filtered by `agency_id`, all statuses) — Tasks tab
- `goals` (filtered by `agency_id`, current year) — Goals tab

**If empty:** Module shows EmptyState. Agent's Claude populates tasks as they come up in conversation; goals are set during quarterly planning.

**If something's wrong:**
- Tasks show but linked module doesn't open → `tasks.module_link` value isn't matching one of the known module keys. The `moduleConfig` helper in TasksGoals.jsx guards against this gracefully, but the link won't be clickable.

---

### PersistentMemory

**Reads:**
- `persistent_memory` (filtered by `agency_id`)

**Currently uses mock-only data** — full wiring queued for sprint. If the agent's Claude is writing to `persistent_memory` from conversations, the rows are there in Supabase but won't render in the module yet. The agent's Claude reading from the table works regardless.

**To populate (for the agent's Claude, not the module):**
The agent's Claude should INSERT to `persistent_memory` whenever it learns something durable. See the system prompt section "YOUR STARTUP PROTOCOL."

---

### Settings

**Reads:**
- **Profile tab:** `agency`
- **Team tab:** `users` (separate from `staff` — these are people who log into the BCC)
- **About tab:** Static — the self-heal "Keep It Connected" guide is rendered from the JSX, not from data
- **Connectors tab:** `settings` table for credential row presence (does NOT show secret values, only confirms they exist)

**If empty:** Profile shows whatever is in the `agency` row. Team shows "No users yet" if `users` table is empty (which is fine for single-agent installs). About tab always renders the self-heal hero card.

**If something's wrong:**
- About tab → Keep It Connected hero card not rendering green → JSX issue, not data. ErrorBoundary should catch and show diagnostic.
- Connectors tab shows "Composio not configured" but it is → check that `settings` rows exist for the runner credentials (`composio_api_key`, `composio_user_id`, etc.). The Connectors tab reads `settings` to confirm presence.

**To populate from scratch:**
- `agency`: migration 004 + UPDATE with real values
- `users`: insert at install time per actual person who will log in
- `settings`: populated during runner install (see `docs/AUTOMATIONS_INSTALL.md` Step 5c)

---

## Cross-cutting wiring rules

These apply to every module:

1. **Every module filters by `agency_id`.** If a module shows "No data" but rows exist in Supabase, check whether those rows have the correct `agency_id`. The `VITE_AGENCY_ID` env var in Vercel must match `SELECT id FROM agency LIMIT 1;`.

2. **The anon role must have SELECT on every table the web app reads.** Migration 005 grants this. If a module shows blank with no error, run:
   ```sql
   SELECT COUNT(*) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public';
   ```
   If 0, run migration 005.

3. **The web app uses optional chaining everywhere.** A missing column on a row will not crash — it will render as "—" or 0. If the agent sees "—" where they expect a value, the column is NULL or missing.

4. **The ErrorBoundary catches what guards miss.** If a module renders a yellow diagnostic card with a stack trace, the error message tells you the failing line. Most often it's a column name mismatch (the module expects `comp_recap.period_year` and the legacy table has `comp_year`) — fix with a bridge view, not by editing the module.

5. **Mock data is gated by `VITE_USE_MOCK_DATA`.** Production must have `false`. If the agent sees seed/sample data they don't recognize, check that env var.

---

## When in doubt: the schema audit

`tools/schema_audit_query.sql` returns a row per expected table with status `ok` / `bridge_needed` / `missing`. Run it at any point to verify the database matches what the modules expect.

Path A installs run this in Step 2 of the handoff prompt. Path B installs should run it after migrations 001-011 to confirm everything's there.

---

*Last updated: 2026-05-10 — initial doc shipped to close the "Project Claude doesn't know which table feeds which module" gap.*
