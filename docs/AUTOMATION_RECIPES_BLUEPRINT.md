# BCC Automation Recipes — Master Blueprint

The canonical recipe set every BCC install starts from. This document tells the Project Claude *what* to build; the SQL files in `supabase/recipe_seeds/` tell it *how*. Together they replace the "figure out the automations by reading old conversations" pattern that has been the longest part of every install.

---

## 0. Read This Before You Build

**Every BCC install gets the same 14 recipes. The recipe *set* is standard. The *values* inside each recipe are per-client.** Your job during install is not to design the automation suite — it has already been designed. Your job is to seed it with the client's specific values, activate what's connected, and verify the run log.

### Three things that are universal across every install

1. **The recipe set itself.** 14 recipes. Same names. Same schedules. Same handlers. Same INTERNAL vs Composio split. Do not invent new ones or omit existing ones without an explicit reason and a note in `agent_memory`.
2. **The architecture.** One pg_cron heartbeat → `run_due_automation_recipes()` → `run_automation_recipe()` → pg_net POST → edge function → optional Composio call → write to Supabase → log to `automation_run_log`. Do not redesign this.
3. **The execution order on the daily GL chain.** Base GL writer (16:00) → Payroll (16:15) → Bank (16:30) → Credit Card (16:45). Stagger preserved because dependencies settle between writers.

### Values that MUST be re-derived per client (never reuse another client's)

| Placeholder | What it is | Where to source it |
|---|---|---|
| `{{agency_id}}` | Tenant UUID | The client's row in the agencies table |
| `{{recipient_email}}` | Daily briefing recipient & ops inbox | Personal email — never `@statefarm.com` |
| `{{gl_chart_namespace}}` | Chart of accounts namespace (e.g. `qbo`, `xero`) | Client's `settings.gl_chart_namespace` |
| `{{cutover_date}}` | Boundary between historical import & live entries | Set per client based on when import ends |
| `{{default_cash_account_name}}` | Operating cash account label | Client's chart of accounts |
| `{{default_sf_revenue_account_name}}` | SF revenue account label | Client's chart of accounts |
| `{{timezone}}` | Operator timezone | Client's location (e.g. `America/New_York`, `America/Chicago`) |
| Bank/card account codes in close template | Specific QBO/Xero codes | Client's chart of accounts |
| Balance-review account codes | Accounts the CPA hasn't formally adjusted yet | Client's CPA conversation + bank statements |
| `composio_*_account_id`, `facebook_page_id`, etc. | Connection credentials | Client's Composio connections — only after they exist |

### Two structural choices to make per client at install time

**Choice 1 — Payroll posting convention.** Almost every agency is single-entity: the agency pays its own payroll out of its own operating account. A small number of agencies (Peter Story State Farm is the example) run payroll through a parent S-Corp and use an intercompany convention. Two seed files are provided. **Default is single-entity. Use the two-entity variant only if you have confirmed the client has a separate parent entity actually paying the payroll.**

- `recipe_seeds/05a_payroll_gl_writer_single_entity.sql` ← use this 90% of the time
- `recipe_seeds/05b_payroll_gl_writer_two_entity.sql` ← only when entity structure requires it

**Choice 2 — Which social platforms get seeded inactive.** All three social recipes (Facebook, LinkedIn, Instagram) are always seeded, always start `is_active = false`, and unlock when the platform connection exists. Do not skip seeding them; the recipe-as-data pattern means a seeded-but-inactive recipe is the right state for "platform not connected yet."

---

## 1. The Architecture These Recipes Assume

A recipe row will not do anything unless the surrounding machinery exists. Verify all of this is in place before running seeds.

**Recipes are data, not code.** Each recipe is one row in `automation_recipes`. The row declares *what* should happen and *when*; it contains no executable logic itself.

**One heartbeat fires everything.** A single `pg_cron` job runs every minute and calls `public.run_due_automation_recipes()`. That function loops active cron recipes, matches each `cron_expression` against the current minute via `public.cron_expression_matches()`, and for each due recipe calls `public.run_automation_recipe(recipe_id, 'pg_cron')`. **Do not create one pg_cron entry per recipe** — the schedule lives in the recipe data.

**The dispatcher bridges DB → outside world.** `run_automation_recipe()` reads two settings (`supabase_url`, `automation_runner_cron_secret`), then makes an HTTP POST via `pg_net` to the `automation-runner` edge function with the recipe ID and shared secret. Postgres cannot call external APIs directly; the edge function is the hands.

**Edge functions do the real work.** The four canonical functions:

- `automation-runner` — general dispatcher most recipes route through
- `document-processor` — Gmail intake → Groq parse → `documents` + `journal_entries`
- `email-archiver` — files attachments to Drive, logs `documents` rows
- `qbo-stage-load` — historical QBO import helper (only used during initial backfill)

**Two recipe execution styles:**

- `composio_action = 'INTERNAL'` → pure database-to-database logic. No Composio call. Work done by a Postgres function named in `internal_handler`.
- `composio_action = '<TOOL_NAME>'` (e.g. `GMAIL_SEND_EMAIL`, `FACEBOOK_POST_TO_PAGE`) → the edge function invokes that Composio tool, authenticating with the stored `composio_api_key`.

**Every run is logged.** Results land in `automation_run_log` (status, error_message, output_summary, run_at). `last_run_at` / `last_run_status` on the recipe row reflect the most recent fire.

**Failure isolation.** If a recipe throws during dispatch, the loop catches it, writes a `failed` row to `automation_run_log`, and continues to the next recipe — one broken recipe never blocks the rest.

---

## 2. The `automation_recipes` Table Schema

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | PK |
| `agency_id` | uuid | tenant scope — required or dispatch raises |
| `recipe_name` | text | human label |
| `recipe_description` | text | what it does (keep this rich; it's the operator's memory) |
| `trigger_type` | text | `cron` for all scheduled recipes |
| `cron_expression` | text | standard 5-field cron, evaluated per-minute |
| `trigger_event` | text | for event-driven triggers (unused in canonical set) |
| `composio_action` | text | Composio tool name, or `INTERNAL` |
| `composio_connection` | text | connection slug (`gmail`, `facebook`, `linkedin`) or null |
| `groq_prompt` | text | LLM parse prompt when the recipe parses documents |
| `input_config` | jsonb | recipe-specific inputs (including `required_settings` array if applicable) |
| `output_table` | text | primary table written |
| `output_config` | jsonb | write behavior (conflict keys, columns, namespace) |
| `internal_handler` | text | Postgres function name for INTERNAL recipes |
| `is_active` | boolean | gate — false recipes never fire |
| `last_run_at` | timestamptz | most recent fire |
| `last_run_status` | text | status from most recent fire |

**Note on required settings:** Some recipes (e.g. Daily Briefing, Facebook poster) depend on specific keys existing in the `settings` table before they can run successfully. These are declared inside `input_config` as a `required_settings` array (e.g. `"required_settings": ["composio_gmail_account_id"]`). The validation script reads this array to determine whether an active recipe has its prerequisites satisfied. The `settings` table column is `setting_key` (not `key`).

---

## 3. The Canonical Recipe Set (14 recipes)

Ordered by daily fire time. **All cron times below are UTC.** Adjust if your client is in a different timezone — the seed files use a placeholder so the install task can derive the right UTC times for the client's local schedule.

| # | Recipe | Schedule (UTC) | Type | Active by default? |
|---|---|---|---|---|
| 01 | Document Processor | `7,37 * * * *` | INTERNAL | ✅ Yes |
| 02 | Daily Briefing Email | `0 12 * * *` | Composio `GMAIL_SEND_EMAIL` | ✅ Yes (requires Gmail connected) |
| 03 | Producer Underperformance Watcher | `0 12 * * *` | INTERNAL | ✅ Yes |
| 04 | Email Archiver | `0 13 * * *` | INTERNAL | ✅ Yes |
| 05a | Payroll GL Writer (single-entity) | `15 16 * * *` | INTERNAL | ✅ Yes — **most agencies** |
| 05b | Payroll GL Writer (two-entity) | `15 16 * * *` | INTERNAL | ✅ Yes — **only if parent entity pays payroll** |
| 06 | Social Media Scheduler — Instagram | `30 13 * * *` | INTERNAL | ❌ Seed inactive |
| 07 | Monthly Close Monitor | `0 14 * * *` | INTERNAL | ✅ Yes |
| 08 | Social Media Scheduler — Facebook | `0 14 * * *` | Composio `FACEBOOK_POST_TO_PAGE` | ❌ Seed inactive |
| 09 | Social Media Scheduler — LinkedIn | `0 14 * * *` | Composio `LINKEDIN_CREATE_POST` | ❌ Seed inactive |
| 10 | Monthly Close Checklist Generator | `0 14 1 * *` | INTERNAL | ✅ Yes |
| 11 | GL Entry Writer | `0 16 * * *` | INTERNAL | ✅ Yes |
| 12 | Bank GL Writer | `30 16 * * *` | INTERNAL | ✅ Yes |
| 13 | Credit Card GL Writer | `45 16 * * *` | INTERNAL | ✅ Yes |

The full recipe descriptions are in each seed file's header comment. Read the seed file before running it.

---

## 4. Patterns Worth Reusing (the "why" behind the set)

Future modifications should respect these patterns. Breaking any of them on purpose is fine; breaking them by accident causes hard-to-debug failures.

**Stagger the GL writers.** Note the daily chain at 16:00 / 16:15 / 16:30 / 16:45. The base GL Entry Writer runs first, then payroll, bank, and credit card writers follow at 15-minute intervals so dependencies settle before each downstream writer reads. Maintain this ordering.

**Idempotency everywhere.** Every GL writer is explicitly idempotent (re-running posts nothing already posted). This is what makes manual backfill safe — you can fire a recipe repeatedly without double-booking the ledger.

**Cutover date discipline.** A single `cutover_date` separates the verbatim historical import (QBO/Xero) from live recipe-generated entries. Pre-cutover source rows are marked posted-without-JE so they don't double up against imported history. Every agency doing a historical import needs the same boundary.

**Suspense as the safety net.** Bank and CC writers never fail to post — anything they can't classify lands in a suspense account for human review rather than blocking the close.

**Inactive-but-seeded.** Social recipes are seeded with full config and gated `is_active=false` until the platform connection exists, with `input_config.required_settings` naming exactly which settings unlock them. This documents the activation path inside the recipe itself.

**Config carries judgment, not just parameters.** The Monthly Close Checklist Generator embeds accounting policy ("carry these accounts until the CPA adjusts them; do NOT reclassify autonomously") directly in `input_config`. Recipes are a good home for standing operational rules.

---

## 5. The Install Checklist (the actual flow)

This is the only place install steps are listed. Future install tasks reference this section directly.

1. **Verify prerequisites.** The client's Supabase project has:
   - `pg_cron` and `pg_net` extensions enabled
   - The four helper functions deployed: `run_due_automation_recipes`, `run_automation_recipe`, `cron_expression_matches`, `dispatch_*` handlers
   - The four edge functions deployed: `automation-runner`, `document-processor`, `email-archiver`, `qbo-stage-load`
   - The single `* * * * *` pg_cron job calling `run_due_automation_recipes()`
   - The `agency` table (singular) exists with the operator's row already inserted (so the FK from `automation_recipes.agency_id` resolves)

2. **Confirm the agency row exists and capture its UUID.** The seeder requires a valid FK to `agency.id`. If the install hasn't already inserted the operator's `agency` row, do it now before calling the seeder. The minimum required columns are `id`, `name`, `owner_name`, `primary_email`.

3. **Seed `settings`.** Required keys before any recipe runs:
   - `supabase_url`
   - `automation_runner_cron_secret`
   - `composio_api_key`
   - `gl_chart_namespace`
   - `gl_cutover_date`
   - `gl_default_cash_account_name`
   - `gl_default_sf_revenue_account_name`
   - Connection account IDs (added as connections come online — the `settings.setting_key` column holds the key name; the column is `setting_key`, not `key`)

4. **Choose payroll variant.** Confirm with operator: is payroll paid by this entity, or by a parent entity? Use `single_entity` (the default, ~90% of agencies) or `two_entity` (only when a parent entity actually pays the payroll).

5. **Run the seeder.** Call `seed_bcc_automations(agency_id, config_jsonb, payroll_variant)`. This inserts all 13 recipes (12 standard + the chosen payroll variant) correctly. See `supabase/migrations/seed_bcc_automations.sql`.

6. **Verify with the validation script.** Run `tools/recipe_validation.sql` with the agency UUID set at the top. Report any recipes that are active-but-missing-required-settings, or any settings that are present but ungated. Fix before declaring install complete.

7. **Watch `automation_run_log` for the first 24h.** Confirm `success` rows appear on schedule. Triage any `failed` rows.

---

## 6. When to Deviate (and How)

You will eventually hit a client whose needs don't match the canonical 14. When that happens:

- **If the deviation is client-specific** (e.g. they want a custom alert on a specific event): add a 15th recipe row in their Supabase only. Do not change the master.
- **If the deviation is generalizable** (e.g. you discover a recipe every agency should have): bring it back to the master repo. Add a new seed file. Update this blueprint's Section 3 table. Update `seed_bcc_automations()`. Update `agent_memory` with the rationale.
- **If you find a bug in an existing canonical recipe** (e.g. the Composio field-name gotcha): fix it in the seed file, update the recipe in every active client's Supabase via a migration, and log the fix in `agent_memory` as an `operational_rule`.

The master repo is the single source of truth. Every client install begins from it. Every improvement returns to it.

---

*Master blueprint maintained by Imaginary Farms LLC. Last revised in conjunction with the Composio outage of May 2026, when the recipe-as-data architecture proved that vendor independence is a property of design, not of vendor choice.*
