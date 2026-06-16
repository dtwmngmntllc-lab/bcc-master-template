# Automations Install Playbook

> How to wire up the canonical automation recipes for a new client BCC.
> Read by Project Claude during install (Path A and Path B both).

---


> ## ⛔ STOP — READ THIS BEFORE TOUCHING CREDENTIALS
>
> **You do NOT need a Groq API key.** You do NOT need any external LLM API key.
> The automation runner calls Groq via the Composio-hosted tool
> `COMPOSIO_SEARCH_GROQ_CHAT`, which authenticates with the existing
> `composio_api_key`. If you find yourself about to ask the agent for a Groq /
> OpenAI / Anthropic / Gemini key — **stop**. The credentials list below is
> complete as written. Adding a `groq_api_key` row is harmless but unused.

> ## 📘 GLOSSARY — Read this before scanning the recipe table below
>
> Throughout this repo you will see the word **"Groq"** in three places:
> 1. **`groq_prompt`** — a column in the `automation_recipes` table. It holds the LLM system prompt for that recipe. The column name is historical; the prompt is sent to whatever LLM Composio's hosted chat tool routes to.
> 2. **`COMPOSIO_SEARCH_GROQ_CHAT`** — the Composio tool slug we call for LLM parsing. Authenticates with the existing `composio_api_key`. No separate auth.
> 3. **"+ Composio LLM" in recipe tables** — shorthand meaning "this recipe pipes its Composio output through the Composio-hosted LLM tool for structured extraction."
>
> **There is no separate Groq account. No separate Groq key. No separate Groq billing.** Composio provides the LLM free as part of the recipe automation pipeline. If your Project Claude finds itself asking the agent for an LLM API key of any kind — stop and re-read this block.




## **THE RECIPES ARE THE DOCUMENT IMPORTER (read this BEFORE anything else)**

The 12 canonical recipes you seed in this doc ARE the document importer for the BCC. Together they read the agent's Gmail every day, parse comp recaps, deduction statements, payroll notifications, bank statements, credit card statements, and producer production reports via Groq, and write structured rows into the right Supabase tables — which then render in every BCC web app module.

**Do NOT build a parallel importer.** Do not write a custom script to read the agent's Gmail and write to their database. The recipes do that.

**Do NOT skip the runner setup (Step 5).** Without migration 011 + the Edge Function + the settings credential rows + the pg_cron schedule, the recipes you seed in Step 4 sit inert. They look configured. Nothing fires. The agent's database stays empty.

**Do NOT consider the install complete until the Step 6 smoke test passes.** Until you fire one recipe end-to-end and see `automation_run_log.status = 'success'`, the document importer is unproven.

For the full architectural framing, read `docs/DOCUMENT_IMPORTER_GUIDE.md`.

---

## The architecture (read this first)

**Recipes live in Supabase, not in the Composio dashboard.** The `automation_recipes` table holds recipe definitions: name, description, cron schedule, what Composio tool to call, what config to pass, what table to write results to. `pg_cron` schedules them. Recipes call Composio tools to do the actual work (Gmail fetch, Drive upload, Facebook post, etc.), but the WHEN and the WHAT are owned by Supabase.

**Why this architecture:**
- Single source of truth — recipe code lives next to the schema it operates on
- Schedulable via standard cron — no third-party orchestrator
- Observable — every run logged to `automation_run_log`, queryable from any module
- Version-controlled — recipes evolve via SQL migrations alongside the database
- Resilient — if Composio dashboard config drifts, the recipe still has the canonical definition in Supabase
- Self-healing — Project Claude can read the recipe, identify the broken piece, and fix it directly

Composio is the **execution layer**, not the storage layer.

---

## The canonical 12 recipes — every BCC install starts with these

These are the real, working recipes from Keith Thompson's production BCC, adopted as the canonical install set. The Performance tab feature added two new recipes (Producer Underperformance Watcher and Producer Production Report Processor); the rest match what's running in live client systems today.

| # | Recipe | Schedule | Composio Action | Category | Purpose |
|---|---|---|---|---|---|
| 1 | **SF Daily Comp Processor** | 10:00 AM CDT daily | GMAIL_FETCH_EMAILS + Composio LLM | income | Pulls SF daily comp emails, parses line items via Groq, writes to `comp_recap`. Primary daily income feed. |
| 2 | **Deduction Statement Processor** | every 6 hours | GMAIL_FETCH_EMAILS + Composio LLM | Documents | Parses SF deduction statements, writes deductions (negative amounts) to `comp_recap` and `journal_entries`. |
| 3 | **Bank Statement Processor** | every 6 hours | GMAIL_FETCH_EMAILS + Composio LLM | Documents | Parses bank statement emails, posts to `journal_entries`. Dedups via reference_number. |
| 4 | **Credit Card Statement Processor** | every 6 hours | GMAIL_FETCH_EMAILS + Composio LLM | Documents | Parses credit card statements, writes to `credit_transactions`. Pairs with Bank Statement Processor for full cash-basis reconciliation. |
| 5 | **Payroll Processor** | every 6 hours | GMAIL_FETCH_EMAILS + Composio LLM | Documents | Parses payroll provider notifications (Gusto, ADP), writes `payroll_runs` + `payroll_detail`. |
| 6 | **Producer Production Report Processor** | Monthly (1st @ 4 AM CDT / 9 UTC) | GMAIL_FETCH_EMAILS + Composio LLM | hr_people | **Parses agent's monthly producer reports → writes to `producer_production`. THIS feeds the HR & People → Performance tab ROI projection.** |
| 7 | **Email Archiver** | 8:00 AM CDT daily | GMAIL_MODIFY_LABELS | Documents | Archives older email, files attachments to Drive based on subject/sender rules, logs each archived doc to `documents` with source links. Primary inbox-maintenance recipe. |
| 8 | **GL Entry Writer** | 11:00 AM CDT daily | INTERNAL | financial | Daily reconciliation: takes processed comp_recap rows + bank/payroll/CC events from past 24h that don't yet have journal entries, writes the matching GL entries (cash basis), proper account splits per chart_of_accounts. |
| 9 | **Daily Briefing Email** | 7:00 AM CDT daily | GMAIL_SEND_EMAIL + Composio LLM | Communication | Composes morning briefing via Groq from real data — revenue YTD, AIPP, top tasks, alerts, today's posts. Sends to agent's PERSONAL email (never @statefarm.com). |
| 10 | **Social Media Scheduler** | 9:00 AM CDT daily | FACEBOOK_POST_TO_PAGE + LINKEDIN_CREATE_POST | Social Media | Pulls today's content_calendar items, posts to FB/LinkedIn, marks status=posted, saves post_url back. Creates alert for Instagram (no API auto-post). |
| 11 | **Monthly Close Monitor** | 9:00 AM CDT daily | INTERNAL | financial | Daily check of `monthly_close_checklist` progress. Mid-month flags overdue items. End-of-month creates next month's checklist by template. |
| 12 | **Producer Underperformance Watcher** | 12:00 UTC daily | INTERNAL | hr_people | Daily check of each producer's monthly issued production against their 3-month rolling average. Fires alert + persistent_memory entry when any producer falls below 70% of pace. Drives Performance tab status pills. |

**The 3 INTERNAL recipes (#8 GL Entry Writer, #11 Monthly Close Monitor, #12 Producer Underperformance Watcher) do not call Composio.** They use `composio_action = 'INTERNAL'` and require a corresponding `internal_handler` column value pointing to a SQL function in the public schema. Migration 012 ships the three handler functions (`gl_entry_writer`, `monthly_close_monitor`, `producer_underperformance_watcher`) plus the dispatcher (`run_internal_recipe`). **Without migration 012 applied, INTERNAL recipes fail every time they fire** — the runner can't find a handler. This is the chain that makes the Financials — P&L tab populate (GL Entry Writer is what turns comp_recap rows into journal_lines, which feeds v_income_statement). If P&L is empty after comp data is flowing in, check this first.

**Cron schedule conventions used in the templates below assume the client's Postgres timezone is UTC.** CDT is UTC−5. So "7:00 AM CDT" = `0 12 * * *`, "8:00 AM CDT" = `0 13 * * *`, "9:00 AM CDT" = `0 14 * * *`, "10:00 AM CDT" = `0 15 * * *`, "11:00 AM CDT" = `0 16 * * *`. "Every 6 hours" = `0 */6 * * *`.

---

## How to seed recipes for a new install

For each recipe, INSERT a row into `automation_recipes`. Below are the SQL templates for the most important ones — adapt the pattern for the rest.

### Recipe — Daily Briefing Email

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, composio_connection,
  groq_prompt, input_config, output_table, output_config,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'Daily Briefing Email',
  'Composes morning briefing via Groq from real data — revenue YTD, AIPP, top tasks, alerts, today social posts. Sends via Gmail.',
  'cron', '0 12 * * *',
  'GMAIL_SEND_EMAIL', 'gmail',
  'You are writing the morning briefing for [AGENT_NAME]. Tone: warm, direct, partner-not-assistant. Open with one sentence on what matters most today, then the standard sections.',
  jsonb_build_object(
    'recipient', '[AGENT_PERSONAL_EMAIL]',
    'subject_template', 'Morning briefing — {{date}}'
  ),
  NULL,
  jsonb_build_object('log_to', 'daily_briefing_log'),
  true
);
```

### Recipe — Producer Production Report Processor (drives the new Performance tab)

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, composio_connection,
  groq_prompt, input_config, output_table, output_config,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'Producer Production Report Processor',
  'Monthly: parses each producer monthly production report (forwarded by the agent), extracts issued premium per producer per line of business via Groq, writes to producer_production.',
  'cron', '0 9 1 * *',
  'GMAIL_FETCH_EMAILS', 'gmail',
  'You are parsing a State Farm producer production report. The report lists each producer (LSP) by name with policies issued and premium issued in the prior month, broken out by line of business (auto, fire/home, life, health, financial services). Extract one row per producer per LOB. Match producer names to the staff table by first_name+last_name (case-insensitive).',
  jsonb_build_object(
    'gmail_query', 'subject:"producer production" newer_than:7d',
    'attachment_required', true,
    'expected_format', 'pdf or xlsx'
  ),
  'producer_production',
  jsonb_build_object(
    'unique_on', ARRAY['agency_id','staff_id','period_year','period_month','line_of_business'],
    'on_conflict', 'update'
  ),
  true
);
```

### Recipe — SF Daily Comp Processor

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, composio_connection,
  groq_prompt, input_config, output_table, output_config,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'SF Daily Comp Processor',
  'Pulls State Farm daily comp emails, parses individual line items via Groq, writes to comp_recap.',
  'cron', '0 15 * * *',
  'GMAIL_FETCH_EMAILS', 'gmail',
  'You are parsing a State Farm daily compensation notice. Extract every line item with: period_year, period_month, comp_type (new_business, renewal, scoreboard, aipp, other), comp_category (auto, home, life, health, fs, umbrella), amount, is_aipp_eligible, is_scoreboard_eligible, description.',
  jsonb_build_object(
    'gmail_query', 'from:no-reply@statefarm.com subject:"daily comp" newer_than:2d',
    'attachment_required', false
  ),
  'comp_recap',
  jsonb_build_object(
    'unique_on', ARRAY['agency_id','period_year','period_month','comp_type','comp_category','description'],
    'on_conflict', 'update'
  ),
  true
);
```

### Recipe — GL Entry Writer (INTERNAL #8 — critical for Financials P&L)

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, internal_handler,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'GL Entry Writer',
  'Daily cash-basis reconciliation: walks unposted comp_recap rows and writes journal_entries + journal_lines per chart_of_accounts splits. Without this recipe firing, P&L stays at $0 even when comp_recap has data.',
  'cron', '0 16 * * *',  -- 11:00 AM CDT
  'INTERNAL', 'gl_entry_writer',
  true
);
```

### Recipe — Monthly Close Monitor (INTERNAL #11)

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, internal_handler,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'Monthly Close Monitor',
  'Daily check of monthly_close_checklist. Mid-month flags overdue items via alerts. End-of-month creates next month''s checklist by template.',
  'cron', '0 14 * * *',  -- 9:00 AM CDT
  'INTERNAL', 'monthly_close_monitor',
  true
);
```

### Recipe — Producer Underperformance Watcher (INTERNAL #12)

```sql
INSERT INTO automation_recipes (
  agency_id, recipe_name, recipe_description,
  trigger_type, cron_expression,
  composio_action, internal_handler,
  is_active
) VALUES (
  '[AGENCY_ID]'::uuid,
  'Producer Underperformance Watcher',
  'Daily check of each producer''s MTD pace vs 3-month rolling average. Fires alert when a producer is below 70% of their pace through the current point in the month.',
  'cron', '0 12 * * *',  -- 12:00 UTC = 7:00 AM CDT
  'INTERNAL', 'producer_underperformance_watcher',
  true
);
```

### Recipes 4-12

Follow the same pattern. Adjust `recipe_name`, `recipe_description`, `cron_expression`, `composio_action`, `groq_prompt`, `input_config`, and `output_table` per the table at the top.

---

## Project Claude's install steps for automations

After migrations are applied and Vercel is deployed:

### Step 1 — Confirm the table exists
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name='automation_recipes';
-- Expect 1
```

### Step 2 — Confirm Composio is connected in Claude.ai
The agent must have the Composio connector enabled in **Claude.ai → Settings → Connectors**. If not, walk them through it before proceeding. (See `docs/SELF_HEAL_GUIDE.md` for the two-tier connector model.)

### Step 3 — Confirm the apps the recipes need are authorized in Composio

| Recipe needs | Composio app |
|---|---|
| SF Daily Comp, Deduction Statement, Bank, Credit Card, Payroll, Producer Production, Daily Briefing | Gmail |
| Email Archiver | Gmail (read + modify labels) |
| Email Archiver, doc filing | Google Drive |
| Social Media Scheduler | Facebook Pages + LinkedIn |

If any are missing, generate the Composio reauthorization link and give it to the agent.

### Step 4 — Insert the canonical 12 recipes
Use the SQL templates above. For each recipe, customize `[AGENCY_ID]` (from agency table), `[AGENT_NAME]` (first name), and `[AGENT_PERSONAL_EMAIL]` (for Daily Briefing — never @statefarm.com).

### Step 5 — Apply migration 011 and deploy the automation-runner Edge Function

The recipes table in Supabase is just a data store. The thing that actually executes recipes lives in two pieces shipped in this repo:

- `supabase/migrations/011_automation_runner.sql` — plpgsql tick functions (`run_due_automation_recipes`, `run_automation_recipe`, `get_setting`, cron parser)
- `supabase/functions/automation-runner/index.ts` — generic Deno Edge Function that calls Composio for any recipe

**5a. Verify required extensions, then apply migrations 011 AND 012.**

```sql
-- pg_cron is enabled by Supabase Studio → Database → Extensions (one-click).
-- pg_net is NOT pre-enabled on every project. Migration 011 enables it for you,
-- but if your project owner has restricted CREATE EXTENSION, run this first:
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron','pg_net');

-- Apply BOTH migrations 011 and 012 (each is idempotent, safe to re-run):
--   011: runner SQL functions + Edge Function dispatcher
--   012: INTERNAL recipe handlers (gl_entry_writer, monthly_close_monitor,
--        producer_underperformance_watcher) + dispatcher run_internal_recipe()
--        + adds internal_handler column to automation_recipes
--        + adds posted_at column to comp_recap
-- BOTH ARE REQUIRED. Without 012, the 3 INTERNAL recipes (#8, #11, #12)
-- fail every run and Financials → P&L tab stays at $0.
-- Run from Supabase Studio SQL editor or via your migration tool.
```

**5b. Deploy the Edge Function.**

```bash
supabase functions deploy automation-runner --project-ref <client-project-ref> --no-verify-jwt
```

The `--no-verify-jwt` flag is correct — the function does its own auth via a `shared_secret` field in the request body, validated against `settings.automation_runner_cron_secret` (agency-scoped). Postgres can post to the function without a JWT because pg_net runs internally.

**5c. Insert the runner credentials into `settings` for the client's agency.**

Required rows (replace `AGENCY_UUID` and the fake values):

```sql
DO $$
DECLARE
  v_agency UUID := 'AGENCY_UUID';  -- the agency.id of the client
BEGIN
  INSERT INTO public.settings (agency_id, setting_key, setting_value, setting_type, description, updated_by)
  VALUES
    -- Required for the runner itself
    (v_agency, 'supabase_url',                     'https://YOUR-PROJECT-REF.supabase.co', 'string', 'BCC Supabase URL', 'install'),
    (v_agency, 'automation_runner_cron_secret',    encode(gen_random_bytes(32), 'hex'),   'string', 'shared secret: Postgres -> Edge Function', 'install'),
    -- Required for any recipe to call Composio
    (v_agency, 'composio_api_key',                 'ak_xxxxxxxxxxxxx',                    'string', 'Composio API key', 'install'),
    (v_agency, 'composio_user_id',                 'pg-xxxxxxxxxxxx',                     'string', 'Composio user_id for this agent', 'install'),
    -- One row per Composio connection used by the canonical recipes:
    (v_agency, 'composio_gmail_account_id',        'ca_xxxxxxxxxxxxx',                    'string', 'Composio Gmail connected_account_id', 'install'),
    (v_agency, 'composio_googledrive_account_id',  'ca_xxxxxxxxxxxxx',                    'string', 'Composio Google Drive connected_account_id', 'install'),
    (v_agency, 'composio_googlecalendar_account_id','ca_xxxxxxxxxxxxx',                   'string', 'Composio Google Calendar connected_account_id', 'install'),
    (v_agency, 'composio_facebook_account_id',     'ca_xxxxxxxxxxxxx',                    'string', 'Composio Facebook connected_account_id', 'install'),
    (v_agency, 'composio_linkedin_account_id',     'ca_xxxxxxxxxxxxx',                    'string', 'Composio LinkedIn connected_account_id', 'install'),
    (v_agency, 'composio_instagram_account_id',    'ca_xxxxxxxxxxxxx',                    'string', 'Composio Instagram connected_account_id', 'install'),
    -- NOTE: No groq_api_key needed. LLM calls route through COMPOSIO_SEARCH_GROQ_CHAT using composio_api_key.
    -- Optional — failure alerts:
    (v_agency, 'telegram_bot_token',               '',                                    'string', 'Telegram bot token (optional)', 'install'),
    (v_agency, 'telegram_chat_id',                 '',                                    'string', 'Telegram chat id (optional)', 'install')
  ON CONFLICT (agency_id, setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
END $$;
```

Only insert the connection rows for connections this agent actually uses. Empty strings for optional rows mean the runner skips those features (e.g. no Telegram token = no Telegram alerts, the runner just continues).

**5d. Schedule pg_cron to call the tick function every minute.**

```sql
SELECT cron.schedule(
  'automation-runner-tick',
  '* * * * *',
  $$ SELECT public.run_due_automation_recipes(); $$
);

-- Verify the schedule is active
SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'automation-runner-tick';
```

### Step 6 — Test one recipe end-to-end

Pick a recipe with low blast radius (Daily Briefing Email is ideal — it sends to the agent's inbox; or pick one whose output table is non-destructive). Then fire it manually and inspect every layer:

```sql
-- 1. Find the recipe
SELECT id, recipe_name FROM public.automation_recipes 
WHERE recipe_name ILIKE '%daily briefing%' AND agency_id = 'AGENCY_UUID';

-- 2. Fire it
SELECT public.run_automation_recipe('RECIPE_UUID'::uuid, 'install_smoke_test') AS request_id;

-- 3. Wait 5–10 seconds, then check the HTTP-level response
SELECT id, status_code, substring(content from 1 for 400) AS preview, error_msg
FROM net._http_response 
ORDER BY id DESC LIMIT 3;
-- Expect status_code = 200 (success) or 500 (recipe ran but Composio failed).
-- 401/404 means an auth/wiring problem — see troubleshooting below.

-- 4. Check the run log (the source of truth for what happened)
SELECT status, records_processed, error_message, output_summary, duration_seconds, run_at
FROM public.automation_run_log
WHERE recipe_id = 'RECIPE_UUID'
ORDER BY run_at DESC LIMIT 5;

-- 5. Check the recipe row was updated
SELECT recipe_name, last_run_at, last_run_status
FROM public.automation_recipes WHERE id = 'RECIPE_UUID';
```

**What success looks like:** `automation_run_log.status = 'success'`, `last_run_status = 'success'`, the agent receives the briefing email (or the recipe's output table has new rows), and `net._http_response.status_code = 200`.

**Common Step 6 failures (and what they mean):**

| Symptom | Diagnosis | Fix |
|---|---|---|
| `net.http_post` returns immediately but no row in `automation_run_log` after 30s | Edge Function never reached or crashed before logging | Check Supabase function logs for `automation-runner`; usually a missing env var (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| HTTP 401 `Unauthorized: invalid shared_secret` | The `automation_runner_cron_secret` in `settings` doesn't match what Postgres sent | Re-check Step 5c — the secret must be present and unchanged |
| HTTP 500 `settings.supabase_url is missing for agency …` | Step 5c was skipped or used the wrong agency_id | Re-run the INSERT with the correct `agency_id` |
| HTTP 500 `Missing settings credential: composio_<x>_account_id` | The recipe's `composio_connection` doesn't have a matching credential row | Insert that row in `settings`, or change the recipe to use a connection you do have |
| HTTP 500 `Composio … failed: Invalid API key` | `composio_api_key` is wrong or missing | Re-check Step 5c |
| HTTP 500 `Composio … failed: Invalid connected_account_id` | The Composio account is not authorized for the action being called | Have the agent reauthorize that Composio integration; copy the new `connected_account_id` into `settings` |
| HTTP 500 `run_internal_recipe failed` OR run_log error "function ... does not exist" | Migration 012 not applied | Apply `supabase/migrations/012_internal_recipe_handlers.sql` |
| HTTP 500 `Recipe X has composio_action=INTERNAL but no internal_handler set` | Recipe row missing the `internal_handler` value | `UPDATE automation_recipes SET internal_handler = 'gl_entry_writer' WHERE recipe_name = 'GL Entry Writer';` (or whichever handler matches) |
| Financials → P&L tab still shows $0 even though comp_recap has rows | GL Entry Writer recipe never fired or is failing | Check automation_run_log for `recipe_name='GL Entry Writer'`. If never run: confirm it's active and pg_cron tick is scheduled. If failing: read error_message in the run log |

### Step 7 — Walk the agent through the Automations module
In the BCC web app, open **Automations**. The agent should see all 12 recipes with status, schedule, last run. The Run Log tab surfaces every execution. They can enable/disable, edit schedule, or trigger manually.

When something breaks: agent screenshots the error, pastes to their Claude, gets fixed.

---

## When a recipe breaks

| Error | Cause | Fix |
|---|---|---|
| `OAuth token expired` | Composio integration auth lapsed | Generate Composio reauthorization link, give to agent |
| `No matching emails found` | Subject filter too narrow OR sender format changed | Update `gmail_query` in recipe's `input_config` |
| `LLM parsing failed` | Document format changed; LLM couldn't parse | Update `groq_prompt` with examples of new format |
| `LLM response was not valid JSON after fence-stripping` | LLM wrapped output in prose or markdown | Tighten `groq_prompt` to demand raw JSON only; reduce input size if near token limit |
| `Permission denied for table X` | Anon RLS policy missing on output table | Re-check migration 005 |
| `Schedule did not fire` | pg_cron not enabled or cron expression invalid | Verify pg_cron extension; test cron expression |

---

## Why this is in the master template

Earlier notes implied recipes are configured "per-client during onboarding in the Composio dashboard." That's wrong. Recipes live in Supabase. They ARE part of the install. Every Project Claude needs to know:

1. The 12 canonical recipes are the standard install — not optional, not "set up later"
2. Recipes are seeded into the client's Supabase, not configured in Composio
3. Composio is the execution layer, not the storage layer
4. Project Claude builds the recipes during install, alongside migrations and Vercel deploy

This doc closes that gap. Future installs (John Edgar, Sherry, Marlon, Kenney) get all 12 recipes wired during their initial install.

---

*Last updated: May 8, 2026 — canonical 12-recipe set sourced from Keith Thompson's working install + 2 new processors for the Producer ROI feature.*
