# CLAUDE.md — BCC Master Template
## Read This First. Every Time.

This file is your briefing. Before touching any file in this repo, read this completely.

---

## Companion Docs (read these when relevant during install)

| Doc | When to read |
|---|---|
| `HANDOFF_PROMPTS.md` | Pick the install path (Path A existing-DB or Path B clean) and follow the matching prompt step-by-step. The single source of truth for install order. |
| `docs/DOCUMENT_IMPORTER_GUIDE.md` | **Read FIRST during any install.** Explains why the 12 canonical recipes ARE the document importer — prevents Project Claude from building a parallel one. |
| `docs/DRIVE_FOLDER_SETUP.md` | Canonical Google Drive folder structure for the Email Archiver, Document Processor, and any recipe that writes files to Drive. Snake_case category vocabulary, required owner setup (root `BCC/` folder + Composio connections + `settings` rows), install verification checklist. |
| `docs/AUTOMATIONS_INSTALL.md` | The full SQL templates for all 12 canonical recipes, plus the runner setup (Step 5a-5d) and end-to-end smoke test (Step 6). |
| `docs/MODULE_DATA_WIRING.md` | Per-module: which Supabase tables each web app module reads, what to check when something doesn't render. The cheat sheet for "why is this module empty / wrong." |
| `docs/PRODUCER_ROI_INSTALL.md` | Performance tab onboarding: SMVC/blended/lapse rates on `agency`, producer_production backfill, role-name conventions for `staff`. |
| `docs/SELF_HEAL_GUIDE.md` | The "agent screenshots the error, their Claude fixes it" model. Background reading for the Settings — About tab. |
| `docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md` | The system prompt that gets installed into the agent's Project Claude after the technical install is complete. Project Claude (the install Claude) personalizes this and hands it back to Rebecca. |
| `SCHEMA_NORMALIZATION_RUNBOOK.md` | Path A only. The bridge-view playbook for fitting the web app to an existing client database. |

---

## What This Repo Is

This is the **BCC Web App** — a React/Vite application that gives Imaginary Farms LLC clients 
a visual command center for their State Farm agency. It reads from their existing Supabase 
database and displays real agency data across 10 modules.

**Live at:** Each client gets their own Vercel deployment  
**Master repo:** github.com/cindarellabots-droid/bcc-master-template  
**Owner:** Rebecca Coelho / Imaginary Farms LLC (The Claude Whisperer)

---

## The Full BCC System (5 Layers)

Every client has ALL of these — the web app is Layer 5, added on top:

| Layer | Tool | Purpose |
|---|---|---|
| 1 | Claude.ai Project Claude | Agent intelligence — the brain |
| 2 | Supabase | Database — source of truth for ALL data |
| 3 | Composio | MCP connector — Claude's tools |
| 4 | Composio | Automation recipes — social posting, imports |
| 5 | GitHub + Vercel | **Web app — visual dashboard (this repo)** |

---

## TWO DEPLOYMENT PROCESSES — KNOW THE DIFFERENCE

### PROCESS A — Existing Client
Client already has Supabase + Composio set up.
Adding GitHub + Vercel on top of working system.

**Clients in this category:** Dominique Miles, Sherry Dennard, Alyssa Holloway, 
Kellie Byers, Shantorra, Jasmine, Marlon, Scott Williams, Keith Thompson, Kenney

**Critical:** Their Supabase schema was built BEFORE this web app existed.
Table names WILL differ from what this app expects. 
**Always use bridge views (Option A) — never destroy real data.**

Steps:
1. RLS preflight check in their Supabase
2. Push this repo to their GitHub via Composio
3. Create Vercel account via GitHub login, add env vars
4. Run migration 005 FIRST (anon RLS policies)
5. Run migrations 001-004 (safe, IF NOT EXISTS)
6. Schema gap check — build bridge views for renamed tables
7. System prompt into Claude.ai with 6 placeholders filled
8. Verify all 10 modules, schedule training

### PROCESS B — New Client  
No Supabase yet. Starting completely fresh.

Steps:
1. Create Supabase project
2. Run all 5 migrations in order — clean slate
3. GitHub + Vercel setup
4. Load system prompt
5. EmptyState components will show — that is CORRECT, not broken
6. Client populates data through Claude conversations over time

---

## Required Env Vars (Vercel)

```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_AGENCY_ID=          (optional, from: SELECT id FROM agency LIMIT 1)
VITE_USE_MOCK_DATA=false (production; set to true only for sales demos)
```

---

## 11 Modules — All Wired to Supabase

| Module | Key Tables / Views | Notes |
|---|---|---|
| Dashboard | agency, tasks, alerts, compliance_rules, **v_income_statement**, monthly_close_checklist | 7 widgets; uses derived view; AIPP card uses program_year |
| Financials | **v_income_statement**, comp_recap, **journal_lines + journal_entries + chart_of_accounts**, payroll_detail, bank_accounts, credit_accounts, aipp_tracking, scoreboard_tracking | Most complex; GL is a 3-way join. CompRecap useEffect syncs period state when data loads. Every section uses defensive guards (Array.isArray, optional chaining). |
| ComplianceCenter | compliance_rules, compliance_log | Add Rule button |
| Documents | documents | Wired to live data with mock fallback |
| **HRPeople** | staff, applicants, **producer_production**, payroll_detail, payroll_runs, comp_recap, agency (smvc_rate_pc, blended_rate_other, lapse_rate_annual) | Add Employee writes to staff. **Performance tab includes Producer ROI projection** — see `docs/PRODUCER_ROI_INSTALL.md`. |
| SocialMedia | content_calendar | Approve/Edit/Schedule buttons |
| AlertsNotifications | alerts | Wired to live data with mock fallback |
| Automations | automation_recipes, automation_run_log | **Recipes live in Supabase, scheduled via pg_cron, executed via Composio tools.** See `docs/AUTOMATIONS_INSTALL.md` for the standard 14-recipe install set. |
| TasksGoals | tasks, goals | Both wired with mock fallback. moduleConfig helper guards against unknown module keys. |
| PersistentMemory | persistent_memory | Currently mock-only — wiring queued for sprint |
| **Settings** | agency, **users** | About → Keep It Connected teaches the **self-heal model** — see `docs/SELF_HEAL_GUIDE.md`. |

**Derived views (migration 006):**
- `v_income_statement` — per-(year,month,account) sums for income/expense; replaces non-existent `income_statement_lines`
- `v_balance_sheet` — running balance per asset/liability/equity account

---

## Hard-Learned Rules (from Dominique deployment — 8 hours of pain)

**1. IMPORTS ON LINE 1**  
Vite silently drops entire modules if any comment appears before import statements.
Every .jsx file MUST start with `import`. No exceptions.

**2. SUPABASE IMPORT IN EVERY MODULE**  
Every module needs: `import { supabase, AGENCY_ID } from "../lib/supabase.js";`
Without it, all .from() calls throw undefined reference and the module crashes silently.

**3. PASS DATA AS PROPS**  
Never define a data variable inside a parent component and reference it in child 
components defined OUTSIDE that parent. Always pass as props.

**4. OPTIONAL CHAINING**  
Always: `item.field?.method()` not `item.field.method()`
Real Supabase data may not have every field. Real data crashes where mock data didn't.

**5. NULL ARRAY GUARDS**  
Always: `(data.array || []).map()` never `data.array.map()`
Supabase returns null for empty results, not [].

**6. RLS LOCKDOWN**  
Existing clients likely had a security audit. Their anon key is locked out.
Always run migration 005 before deploying. Check first:
`SELECT COUNT(*) FROM information_schema.role_table_grants WHERE grantee = 'anon';`
If 0 → run 005 immediately.

**7. VERCEL CACHE**  
After fixing code, always "Redeploy without cache" in Vercel dashboard.
Never assume a GitHub push triggered a fresh build.

**8. ONE COMMIT AT A TIME**  
Push one file → confirm Vercel READY → push next file.
Never batch-push multiple files simultaneously.

**9. DO NOT OVERWRITE CLIENT CLAUDE'S WORK**  
If a client's Claude is actively fixing their repo, coordinate.
Their Claude finishes first → then you push master updates.

**10. MOCK DATA IS GATED BY VITE_USE_MOCK_DATA**  
- Production deployments set `VITE_USE_MOCK_DATA=false` in Vercel env vars.
- With the flag false, modules render `<EmptyState module="..." />` when their table is empty — no fake numbers, agents see honest schema state.
- With the flag true (default), empty tables fall back to MOCK arrays — useful for sales demos and brand-new installs before data exists.
- Live data ALWAYS takes precedence over MOCK regardless of flag setting.
- The flag is read once at module render time via `import.meta.env.VITE_USE_MOCK_DATA`.

**11. NEVER BLANKET FIND/REPLACE A VARIABLE NAME**  
The May 2026 Producer ROI session burned hours debugging:
- `incomeRows is not defined` — find/replace `data.pl.income.map` → `incomeRows.map` accidentally hit a reference inside `OverviewSection` where `incomeRows` only existed inside `PLSection`
- `Cannot access 't' before initialization` — `bankAccounts = ... ? bankAccounts : []` self-referenced after a botched edit
- `Maximum call stack` — `moduleConfig = (key) => moduleConfig(key) || ...` — find/replace `MODULES[key]` → `moduleConfig(key)` hit the function's own body
- `Pill is not defined` — pasted JSX using `<Pill>` into a module where Pill wasn't imported

When refactoring a variable name across a file, **always confirm the new name is in scope at every replacement site.** Search for the new name in the diff. If it appears in a function where it isn't declared, that's a bug.

**12. ERROR BOUNDARY IS THE SAFETY NET**  
`src/components/ErrorBoundary.jsx` wraps every module in `BCCApp.jsx`. When ANY child component throws, the boundary catches it, logs the full stack to console, and renders an inline diagnostic card instead of blanking the module. This was added because every prior class of bug (schema drift, undefined fields, null derefs) produced the same symptom: blank module. The boundary turns "blank screen" into "here's exactly what failed."

**Always preserve the ErrorBoundary wrap.** If you ever need to add a new module to the router in BCCApp, wrap it: `<ErrorBoundary name="ModuleName"><Module /></ErrorBoundary>`.

**13. DEFENSIVE GUARDS IN EVERY SECTION**  
Every section that consumes data MUST guard against undefined/null on initial render:
```javascript
const rows = Array.isArray(data?.tableName) ? data.tableName : [];
const value = data?.summary?.field || 0;
const formatted = Number.isFinite(n) ? n.toLocaleString() : "—";
```
The hook may not have returned yet. The field may not exist on the row. The number may be NaN from a bad calc. Code must degrade gracefully through all of these. The ErrorBoundary catches what slips through; the guards prevent most slips.

---

## Shared Library Files (use these, don't reinvent)

```javascript
// Fetch from Supabase with null safety
import { useSupabaseTable } from '../lib/hooks.js'
const { data, loading, error } = useSupabaseTable('tasks', AGENCY_ID)

// Format currency safely
import { fmt, pct, fmtDate, safeArr, safeNum } from '../lib/utils.js'
fmt(1234.5)  // "$1,234.50"
fmt(null)    // "$0.00" — never crashes

// Empty state when table has 0 rows
import EmptyState from '../components/EmptyState.jsx'
<EmptyState module="tasks" awaiting />

// Loading skeleton while data fetches
import LoadingState from '../components/LoadingState.jsx'
if (loading) return <LoadingState />
```

---

## Standard Module Pattern

Every module should follow this pattern:

```javascript
import { useState, useEffect } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";
import { fmt, safeArr } from "../lib/utils.js";
import EmptyState from "../components/EmptyState.jsx";
import LoadingState from "../components/LoadingState.jsx";

// imports MUST be line 1 — no comments before them

export default function ModuleName() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from("table_name")
        .select("*")
        .eq("agency_id", AGENCY_ID);
      setData(rows || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;
  if (!data.length) return <EmptyState module="tasks" awaiting />;
  return <div>{safeArr(data).map(row => ...)}</div>;
}
```

---

---

## Automation Architecture (READ THIS — common misunderstanding)

**Recipes live in Supabase, NOT in the Composio dashboard.** The `automation_recipes` table holds the recipe definitions. `pg_cron` schedules them. Recipes call Composio tools to execute the actual work (Gmail fetch, Drive upload, social post, etc.), but the WHEN and WHAT are owned by the database.

This is the design choice that matters most for installs: **every new client install must seed the standard recipes into THEIR Supabase.** The recipes are not pre-configured anywhere outside the database. Project Claude builds them during onboarding using the templates in `docs/AUTOMATIONS_INSTALL.md`.

**Standard recipe count: 12** (the canonical install set). Sourced from Keith Thompson's working production BCC, plus two new recipes added with the Producer ROI feature in May 2026: **Producer Production Report Processor** (monthly) and **Producer Underperformance Watcher** (daily). Earlier docs that say "10" or "14" are stale — 12 is correct.

### The runner — two pieces, one engine

Recipes don't run themselves. The engine that executes them lives in two pieces, both shipped in this repo:

1. **`supabase/migrations/011_automation_runner.sql`** — plpgsql functions inside Postgres:
   - `run_due_automation_recipes()` — the cron tick. Scheduled by pg_cron every minute. Walks `automation_recipes`, matches each row's `cron_expression` against the current minute, and async-dispatches the due ones.
   - `run_automation_recipe(uuid)` — fires a single recipe by id. Used by the tick and by the Automations module's "Run now" button.
   - `get_setting(agency_id, setting_key)` — typed helper that reads a credential out of the `settings` table.
   - `cron_expression_matches()` / `cron_field_matches()` — pure cron parser (handles `*`, `*/N`, ranges, lists).

2. **`supabase/functions/automation-runner/index.ts`** — Deno Edge Function that does the actual work:
   - Auth: validates the shared_secret against the recipe's agency in `settings`.
   - Resolves Composio credentials from `settings` (agency-scoped — this is the master template's pattern, distinct from the IF ops project's `brand_kit` table).
   - Calls Composio's `/api/v3/tools/execute` with the recipe's `composio_action` and `input_config`.
   - Optionally pipes the result through the Composio-hosted Groq LLM (`COMPOSIO_SEARCH_GROQ_CHAT`) for structured extraction when the recipe has a `groq_prompt`. No separate LLM API key required — uses `composio_api_key`.
   - Writes parsed records to the recipe's `output_table`.
   - Writes a row to `automation_run_log` with status, duration, and any error.
   - Sends a Telegram alert on failure (when telegram credentials are present).

The Postgres side fires-and-forgets via `pg_net.http_post` with a ~4-minute timeout. Run-log writes happen inside the Edge Function, so a slow Composio call never blocks Postgres.

**Credentials are agency-scoped rows in `settings`.** Required keys: `automation_runner_cron_secret`, `supabase_url`, `composio_api_key`, `composio_user_id`, and one `composio_<conn>_account_id` per connection used (e.g. `composio_gmail_account_id`). Optional: `telegram_bot_token` / `telegram_chat_id` for failure alerts. **DO NOT add a `groq_api_key` row** — LLM calls inside the automation runner go through `COMPOSIO_SEARCH_GROQ_CHAT`, which authenticates via the existing `composio_api_key`. No separate LLM key is required, ever.

**Critical install note:** the `pg_net` extension is NOT pre-enabled on a fresh Supabase project. Migration 011 runs `CREATE EXTENSION IF NOT EXISTS pg_net;` at the top, but if RLS or extension policy blocks that, the project owner must enable it manually in Supabase Studio → Database → Extensions before the migration will succeed.

See `docs/AUTOMATIONS_INSTALL.md` for the full inventory, SQL templates, and the install recipe.

---

## Producer ROI Feature (HR & People → Performance tab)

**The differentiated insight a State Farm agent can't get anywhere else.** This tab projects when each producer becomes profitable against their fully-loaded payroll cost over a 24-month forward window.

### What it shows

For each producer (staff with role containing "LSP", "Producer", or "Financial Services"):
- **Current month economics**: P&C premium issued, other lines premium, new-business commission earned (premium × SMVC), fully-loaded payroll cost (gross × 1.15), net to agency
- **24-month trajectory chart**: stacked cohort bars (green new business + blue surviving renewals) with a red dashed cost line and a ⭐ star at projected breakeven month
- **Status pill**: "Profitable now" / "On track" / "Slow ramp" / "Behind pace"
- **Book-level Lapse Rate card** (top of tab): YTD prior-year vs current-year auto+fire renewal commission ratio, used as the persistency assumption in the projection

### The math

```
Future month N total commission to agency =
  new_commission_this_month
  + Σ for each cohort_k written ≥12 months ago:
      cohort_k_commission × persistency^years_since
```

- `new_commission` = `pc_premium × SMVC_rate + other_premium × blended_rate`
- `persistency` = `(1 - lapse_rate / 100)`
- `years_since` = `floor((months_since_issued - 12) / 12) + 1`

Producer is profitable when `total_commission ≥ monthly_loaded_cost`.

### Honest math principles (carved into the implementation)

1. **Premium issued ≠ commission earned.** The agent earns SMVC% of premium. The "New-Biz Commission" tile shows premium × SMVC, not premium itself.
2. **Historical bars in the chart show ONLY actual new-business commission.** No retroactive renewal simulation — that would lie about what the producer actually generated.
3. **Forward bars stack new + projected renewal cohorts.** That's the projection; the visual makes the difference clear with a "now" divider.
4. **Per-producer renewal income is NOT pulled from agency-level comp_recap.** Renewal commission in `comp_recap` isn't tagged to a producer. Attributing the agency's collective renewal income to one person would be misleading.

### Data intake

Three pieces feed this tab:
1. **`agency.smvc_rate_pc`** and **`agency.blended_rate_other`** — agent's A005 SMVC commission rate. Project Claude asks the agent during install (most agents know their P&C rate; blended is typically 8-10%).
2. **`agency.lapse_rate_annual`** — optional override. NULL = compute from `comp_recap` (prior-year vs current-year P&C YTD ratio).
3. **`producer_production`** — monthly issued premium per producer per line of business. Fed by either:
   - Manual entry during onboarding (Project Claude pastes from agent's reports)
   - Email-attachment Composio recipe (when monthly producer reports arrive at the BCC inbox) — separate ship, recipe lives outside this repo

See `docs/PRODUCER_ROI_INSTALL.md` for the install playbook.

---

## Open Issues (GitHub)

| # | Issue | Priority |
|---|---|---|
| #1 | Instagram auto-posting — Business account banner | Medium |
| #2 | Social Media — Schedule New Post full form | High |
| #3 | Dashboard — Emails Needing Attention (Gmail MCP) | High |
| #4 | Dashboard — Calendar Events (Google Calendar MCP) | High |
| #5 | Replace remaining MOCK data with EmptyState | Medium |

---

## Migration Files

Run in this order. Every migration is safe on existing databases — they all use `IF NOT EXISTS` or `CREATE OR REPLACE`.

| File | Purpose | Path A (existing DB) | Path B (clean install) |
|---|---|---|---|
| 001_bcc_master_schema.sql | 37 core tables | Yes — IF NOT EXISTS safe | Yes |
| 002_seed_compliance_rules.sql | 57 SF compliance rules | Check if empty first | Yes |
| 003_seed_chart_of_accounts.sql | Full COA | Check if empty first | Yes |
| 004_seed_agency_record.sql | Agency placeholder | Update with real data after | Yes |
| 005_anon_read_policies.sql | Anon read access | **YES — ALWAYS, run this FIRST** | Yes |
| 006_derived_financial_views.sql | v_income_statement, v_balance_sheet | Yes — required | Yes |
| 007_monthly_close_checklist.sql | Monthly close checklist infra | Yes | Yes |
| 008_bridge_generator.sql | `bcc_generate_bridges()` function | **YES — Path A only** | Skip |
| 010_producer_roi_infrastructure.sql | Producer ROI feature: SMVC/blended/lapse columns on agency, producer_production table | **YES — required for Performance tab** | Yes |
| 011_automation_runner.sql | `run_due_automation_recipes()` and `run_automation_recipe(uuid)` — the engine that drives Layer 4. Pairs with the `automation-runner` Edge Function. Adds `get_setting()` helper. Enables `pg_net` extension. | **YES — required for any automation to run** | Yes |
| 012_internal_recipe_handlers.sql | Three SQL functions that the runner dispatches to when `composio_action='INTERNAL'`: `gl_entry_writer` (turns comp_recap into journal_lines, drives P&L), `monthly_close_monitor`, `producer_underperformance_watcher`. Plus `run_internal_recipe()` dispatcher. Adds `automation_recipes.internal_handler` column and `comp_recap.posted_at` column. | **YES — required, or recipes #8/#11/#12 fail every time** | Yes |

**Note:** There is no `009_*` migration — that number was reserved for a SQL diagnostic query that's now in `tools/schema_audit_query.sql` (it's not DDL, doesn't belong in `migrations/`).

**Diagnostic queries** (not migrations, but useful during install):
- `tools/schema_audit_query.sql` — Path A schema audit. Returns table/view/anon-grant status. Run in Studio, read results, decide what migrations or bridges are needed.
- `tools/schema-audit.js` — Build-time audit that runs on every Vercel deploy. Compares JS Supabase queries against the actual DB schema. Catches column-name drift before it ships.

---


---

## Ambassador vs Channel Partner — KNOW THE DIFFERENCE

| Role | Person | Commission | On What |
|---|---|---|---|
| **Ambassador Partner** | Alyssa Holloway | 20% of ALL IF setup fees | Every client, every payment, regardless of referral source |
| **Channel Partner** | Kellie Byers, Kim Yow | Commission on THEIR referrals only | Only clients they personally referred. Kellie has signed agreement, commissions tracked, money owed. |

**Alyssa's commission is non-negotiable, permanent, and private.**  
It NEVER appears in Channel Partner agreements or client-facing documents.  
Alyssa and Kellie are also IF's founding clients (#1 and #2) and active State Farm agents.

## Client Queue (as of April 29, 2026)

| Client | Status | Notes |
|---|---|---|
| Dominique Miles | App live, training TBD | Her Claude fixing final issues |
| **Alyssa Holloway** | **NEXT — Friday deadline** | Channel Partner, existing setup |
| **Kellie Byers** | **Friday deadline** | Channel Partner, existing setup |
| Sherry Dennard | training_scheduled | Paid $1,995, next after Alyssa/Kellie |
| Scott Williams | queue | After Sherry |
| Keith Thompson | queue | After Scott |

---


---

## Pre-flight Schema Audit (run BEFORE deploying the app)

A client Claude or repo owner should run this single query against the client's Supabase project AFTER migrations 001–006 and BEFORE the first Vercel deploy. It verifies every table and view this app reads from is present.

```sql
-- BCC Pre-flight Schema Audit
-- Run as Supabase project owner; pass agency_id of the active agency.
WITH expected_tables(name) AS (VALUES
  ('agency'),('alerts'),('aipp_tracking'),('applicants'),
  ('automation_recipes'),('automation_run_log'),
  ('bank_accounts'),('chart_of_accounts'),('commission_structures'),
  ('comp_recap'),('compliance_calendar'),('compliance_log'),('compliance_rules'),
  ('content_calendar'),('credit_accounts'),('credit_transactions'),
  ('daily_briefing_log'),('documents'),('goals'),('interviews'),
  ('journal_entries'),('journal_lines'),('notification_preferences'),
  ('offers'),('onboarding_checklists'),('payroll_detail'),('payroll_runs'),
  ('persistent_memory'),('positions'),('scoreboard_tracking'),('settings'),
  ('social_accounts'),('social_analytics'),('staff'),('staff_performance'),
  ('tasks'),('users')
),
expected_views(name) AS (VALUES
  ('v_income_statement'),('v_balance_sheet')
),
expected AS (
  SELECT name, 'table' AS kind FROM expected_tables
  UNION ALL
  SELECT name, 'view' AS kind FROM expected_views
),
found AS (
  SELECT table_name AS name, table_type AS kind
  FROM information_schema.tables
  WHERE table_schema = 'public'
)
SELECT
  e.kind,
  e.name,
  CASE
    WHEN f.name IS NULL THEN '❌ MISSING'
    WHEN e.kind = 'table' AND f.kind != 'BASE TABLE' THEN '⚠ wrong type'
    WHEN e.kind = 'view'  AND f.kind != 'VIEW'       THEN '⚠ wrong type'
    ELSE '✓ ok'
  END AS status
FROM expected e
LEFT JOIN found f ON f.name = e.name
ORDER BY status DESC, e.kind, e.name;
```

If ANY row returns `❌ MISSING` or `⚠ wrong type`, do not deploy. Re-run the missing migration or build a bridge view (Process A pattern) and re-audit.

After tables are verified, also confirm anon read access:

```sql
SELECT COUNT(*) AS anon_grants
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public';
-- If 0: run migration 005 immediately.
```

## Customization Runway vs. Actual Issues

Your system has components that are **intentionally pending the owner's input** rather than broken. Before flagging anything as a problem, check the `system_status` table (migration 013).

### How to read system_status

Every recipe, table, integration, view, edge function, and module in this BCC has a row in `public.system_status` with one of four statuses:

| Status | Meaning | Where it lives |
|---|---|---|
| `operational_green` | Working as designed. Move on. | `system_status` |
| `customization_pending` | **Intentionally waiting on owner input** — OAuth, data, or a decision. Not a bug. | `v_customization_runway` |
| `deferred` | A path **deliberately not built**, with a written reason. Do not propose rebuilding without explicit owner direction. | `system_status` (filter `status = 'deferred'`) |
| `needs_attention` | Genuine issue requiring fix. | `v_system_issues` |

### When you audit the system

Run this query first:

```sql
SELECT
  (SELECT COUNT(*) FROM public.system_status WHERE status = 'operational_green')     AS green,
  (SELECT COUNT(*) FROM public.system_status WHERE status = 'customization_pending') AS pending,
  (SELECT COUNT(*) FROM public.system_status WHERE status = 'deferred')              AS deferred,
  (SELECT COUNT(*) FROM public.system_status WHERE status = 'needs_attention')       AS issues;
```

Then:

- **Present `customization_pending` rows as the runway** — "here's what we still need from you to light up the rest of the system." Each row has an `unlocks_when` field telling you exactly what owner action lifts the pending state.
- **Present `deferred` rows as decided-against** — they exist so you don't propose rebuilding them. The `decided_against_reason` is the why.
- **Present only `needs_attention` rows as problems** — and only those.

### What this prevents

Without this distinction, every fresh client Claude tends to read pending integrations and unseeded tables as "broken modules" and write up alarming audit reports. They are not broken. They are the **runway** the owner walks down as they bring their own data and integrations into the system.

The BCC is intentionally **80% built and 20% blank at install** — the blanks are where the owner and their Claude collaborate to make this *their* business command center, not a generic template. Frame the customization_pending list as the collaboration ahead, not as a gap list.

### Updating system_status as you go

As components are wired up and verified during onboarding, the owner's Project Claude should:

- Flip `customization_pending` → `operational_green` once the relevant integration / data / decision is in place, AND
- Stamp `last_verified_at = now()` so the owner can see how recently each component was confirmed working.

Only escalate a row to `needs_attention` after a real test fails. Don't preemptively mark anything as broken.

---

## Imaginary Farms LLC Context

- Rebecca Coelho is the operator/co-founder
- Matthew Cooper is the owner of record (non-compete + estate planning)
- Primary market: State Farm insurance agents
- Product: BCC (Business Command Center) — setup fee $2,995 + $1,497.50 additional
- Alyssa Holloway is Ambassador Partner — always receives 20% of ALL IF setup fees paid, regardless of referral source. NON-NEGOTIABLE and PRIVATE.
- Commission structure is PRIVATE — never appears in external docs

*Last updated: May 7, 2026 by Main Claude — Producer ROI feature shipped (HR & People → Performance tab) + ErrorBoundary across all modules + self-heal model in Settings → About + AIPP derived from producer_production. Master repo updated with: docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md (the canonical Project Claude system prompt with placeholders), docs/AUTOMATIONS_INSTALL.md (recipes live in Supabase architecture, 14 standard recipes), docs/PRODUCER_ROI_INSTALL.md (Performance tab onboarding), docs/SELF_HEAL_GUIDE.md (Layer 1 vs Layer 2 connector model). Migration numbering cleaned up (no duplicate 008). 3 new hard-learned lessons logged.*


---

## Known Schema Variant — chart_of_accounts (discovered Kellie Byers install, April 29 2026)

Some existing BCC clients have a legacy `chart_of_accounts` table with:
- Integer PK (not UUID)
- Column names: `account_number`, `sub_type`, `normal_balance`
- Missing: `account_code`, `account_subtype`, `agency_id`

**Fix:** Create bridge view in client's migration 006:
```sql
CREATE OR REPLACE VIEW bcc_chart_of_accounts AS
SELECT
    id::text AS id,
    agency_id,
    account_number AS account_code,
    name,
    type,
    sub_type AS account_subtype,
    normal_balance,
    is_active,
    created_at
FROM chart_of_accounts;
```
Add this to the schema gap check in Step 6 of Process A installs.


---

## Known Issue — Vercel Hobby Plan Deploy Blocking (discovered Alyssa Holloway install, April 29 2026)

**Problem:** Vercel Hobby plan blocks deployments from commits authored by collaborators (e.g. cindarellabots-droid). Only the repo OWNER can trigger auto-deploys on Hobby plan.

**Symptom:** Vercel shows "Deployment was blocked because the commit author does not have contributing access to the project."

**Fix — Add to Step 2 of every Process A/B install:**
After Rebecca's Claude pushes the 29 files, instruct the client's Claude or repo owner to make one dummy commit directly in the GitHub web UI:
1. Go to the client's GitHub repo
2. Open any file (e.g. README.md) → click pencil icon
3. Don't change anything → click "Commit changes"
4. Message: `chore: re-trigger deploy as repo owner`
5. Commit directly to main

This creates a commit authored by the repo owner — Vercel accepts it and builds automatically.

**Long-term fix:** Upgrade client Vercel account to Pro ($20/mo) which supports team collaboration. Not required for single-agent installs.

---

## Automation Install — Canonical Reference (May 2026)

**Before doing anything with `automation_recipes` in a client install, read this first:**

`docs/AUTOMATION_RECIPES_BLUEPRINT.md` is the canonical reference for installing the 14-recipe BCC automation suite. It contains the full install flow, explains what each recipe does, which are active vs inactive by default, and the two structural choices a Project Claude must confirm with the operator (payroll variant and social media activation).

**The install is a two-step process:**

1. Run `supabase/migrations/seed_bcc_automations.sql` — one function call (`SELECT seed_bcc_automations(...)`) seeds all 14 recipes for a new client agency with their specific config values (agency_id, recipient_email, timezone, account codes, etc.)

2. 2. After seeding, run `tools/recipe_validation.sql` to confirm the install is correct — it returns a pass/warn/fail report covering recipe count, active/inactive split, GL chain timing, required-settings presence, and the last 24h of run_log.
  
   3. **Do not hand-build recipe rows one at a time.** The seed function exists precisely to prevent that failure mode. The blueprint document explains why.
  
   4. **Key facts:**
   5. - 14 recipes total (supersedes earlier docs that said 10 or 12)
      - - 10 active by default, 4 inactive (Instagram, Facebook, LinkedIn require operator to connect accounts; 05b payroll two-entity is only for intercompany structures)
        - - Recipe files are in `supabase/recipe_seeds/` (01–13, plus 05a/05b variants)
          - - The seed migration is `supabase/migrations/seed_bcc_automations.sql`
            - - The validation tool is `tools/recipe_validation.sql`
