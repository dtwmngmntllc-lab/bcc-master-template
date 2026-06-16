# Document Importer Guide

> **The 12 canonical recipes ARE the document importer.** Do NOT build a parallel importer.
>
> Read by Project Claude during install. This doc resolves a common point of confusion: "the agent has years of comp recaps, payroll PDFs, and bank statements in their Gmail — how do we get all that into the database?"
>
> The answer: the canonical recipes already do this. You don't build a custom one. You seed the recipes, you confirm the runner is firing, and the importer runs every day from then on.

> ## 📘 GLOSSARY — "Groq" in this repo
>
> Throughout this repo you will see the word **"Groq"** in three places:
> 1. **`groq_prompt`** — a column in the `automation_recipes` table holding the LLM system prompt for the recipe.
> 2. **`COMPOSIO_SEARCH_GROQ_CHAT`** — the Composio tool slug for LLM parsing, authenticated by `composio_api_key`.
> 3. **"+ Composio LLM"** in recipe tables — shorthand for the LLM parsing step inside `COMPOSIO_SEARCH_GROQ_CHAT`.
>
> **There is no separate Groq account, no separate Groq key, no separate Groq billing.** Composio provides the LLM free as part of the recipe automation pipeline. Never ask the agent for an LLM API key.

---

## The Core Concept (read this first)

Every State Farm agent receives the same five categories of documents in their Gmail every month:

1. **State Farm daily compensation emails** (one per business day)
2. **State Farm deduction statements** (deductions taken against comp)
3. **Bank statements** (monthly, PDF or CSV attachments)
4. **Credit card statements** (monthly, PDF attachments)
5. **Payroll provider notifications** (Gusto, ADP, Paychex, etc — per pay run)
6. **Producer production reports** (monthly summary per producer per LOB)

Plus everything else that gets archived: customer correspondence, vendor invoices, compliance notices, marketing pieces.

**The recipes are the bridge from Gmail → Supabase.** The agent doesn't manually import anything. Their Project Claude doesn't manually import anything during install. The recipes run on schedule (every 6 hours for most documents, daily for SF Daily Comp, monthly for Producer Production), pull the matching emails out of Gmail via Composio, parse them via Groq into structured records, and write to the right tables.

---

## What the recipes do — by document type

| Document type | Recipe (number from `docs/AUTOMATIONS_INSTALL.md`) | Schedule | Reads | Writes to |
|---|---|---|---|---|
| SF daily comp emails | #1 SF Daily Comp Processor | 10:00 AM CDT daily | Gmail (sender: no-reply@statefarm.com, subject: "daily comp") | `comp_recap` |
| SF deduction statements | #2 Deduction Statement Processor | every 6 hours | Gmail (sender: no-reply@statefarm.com, subject: "deduction statement") | `comp_recap` (negative amounts), `journal_entries` |
| Bank statements | #3 Bank Statement Processor | every 6 hours | Gmail (configurable sender list, attachments) | `journal_entries` |
| Credit card statements | #4 Credit Card Statement Processor | every 6 hours | Gmail (configurable sender list, attachments) | `credit_transactions` |
| Payroll provider emails | #5 Payroll Processor | every 6 hours | Gmail (Gusto/ADP/Paychex sender patterns) | `payroll_runs`, `payroll_detail` |
| Producer production reports | #6 Producer Production Report Processor | monthly (1st @ 4 AM CDT) | Gmail (subject: "producer production", recent attachments) | `producer_production` |
| Everything else (archive) | #7 Email Archiver | 8:00 AM CDT daily | Gmail (older than 30 days, with attachments) | `documents` (metadata) + filed to Drive |

That's the entire document importer. There is nothing else to build.

---

## The pieces required for the importer to work

For the importer to be operational on a fresh install, all of the following must be in place. Project Claude verifies each one during install:

### 1. The 12 recipes are inserted into `automation_recipes`
Source: `docs/AUTOMATIONS_INSTALL.md` Step 4. Insert all 12 with their canonical SQL templates, customized for the agency_id and the agent's personal email (for the Daily Briefing recipient).

### 2. The runner engine is installed
- `supabase/migrations/011_automation_runner.sql` is applied (creates `run_due_automation_recipes()`, `run_automation_recipe()`, the cron parser, and the `get_setting()` helper)
- `supabase/functions/automation-runner/index.ts` is deployed via `supabase functions deploy automation-runner --no-verify-jwt`

### 3. The runner credentials are in `settings`
- `automation_runner_cron_secret`
- `supabase_url`
- `composio_api_key`
- `composio_user_id`
- `composio_gmail_account_id` (THIS IS THE KEY ONE — without it, no email-fed recipe can run)
- `composio_googledrive_account_id` (needed for Email Archiver)
- Other Composio account IDs as needed (calendar, social platforms)

### 4. pg_cron is scheduled
```sql
SELECT cron.schedule('automation-runner-tick', '* * * * *', $$ SELECT public.run_due_automation_recipes(); $$);
```

### 5. Gmail is authorized in Composio
The agent's Gmail must be authorized as a Composio connection. `composio_gmail_account_id` in `settings` must match a real, currently-active connection. If the agent revokes access or the OAuth lapses, every email-fed recipe fails until reauthorized.

### 6. LLM access works
LLM calls go through Composio's hosted Groq endpoint (`COMPOSIO_SEARCH_GROQ_CHAT`) using the existing `composio_api_key`. No separate Groq / OpenAI / Anthropic key is needed. If parsing fails, check `automation_run_log` for `LLM parsing failed` — common causes are Composio rate limiting (429), an invalid `composio_api_key`, or a `groq_prompt` that the LLM can't satisfy.

If any of these six pieces is missing, the document importer doesn't run end-to-end. `automation_run_log` will show why.

---

## What this means in practice for John, Sherry, Marlon, etc.

**During install (~2 hours of Project Claude work):**

1. Apply migrations 001-011 (the schema + the runner)
2. Deploy the Edge Function
3. Insert the 13 settings rows (runner credentials)
4. Insert the 12 recipes
5. Schedule pg_cron
6. Test one recipe end-to-end (the Daily Briefing is the safest because it's read-only — sends an email)

**After install:**
- The agent does nothing. They receive their daily briefing. They watch their dashboard fill up over the next 1-30 days as recipes pull in their emails.
- SF Daily Comp pulls overnight (~10 AM CDT each business day): comp_recap rows appear within 24 hours
- Bank/CC/Payroll: monthly cycles, so first appearance is at the next statement email
- Producer Production: appears the morning after the next monthly report email arrives in their inbox (typically 1st of next month)
- Email Archiver: starts filing attachments to Drive within a day, populating `documents` rows

**Within a week, the database is alive.** Within a month, every module has real numbers. The Performance tab gets its first rich projection once the Producer Production Report has fired even once. The financials look complete by the end of the first full month.

---

## Common confusions (and the right answer)

**"The agent has 18 months of historical comp recaps in Gmail. How do we get those into the database during install?"**

This is the standard Day-One-Complete model: **on the first run during install, you temporarily widen each recipe's `gmail_query` to reach back 12-24 months instead of the steady-state 7 days, fire each recipe manually, and let it sweep up everything in the agent's inbox.** The agent's source documents are already in their Gmail; the recipes pull them out, parse them via Groq, and write them to the right tables. Then you reset the queries to steady-state for ongoing operation.

**Concrete pattern for each email-fed recipe (#1-6) during install:**

```sql
-- 1. Backup the steady-state input_config so you can restore it after the install backfill run
UPDATE automation_recipes
SET input_config = input_config || jsonb_build_object('_steady_state_query', input_config->'gmail_query')
WHERE agency_id = '[AGENCY_ID]' AND composio_action LIKE 'GMAIL_%';

-- 2. Widen the gmail_query for each recipe to look back 18-24 months
-- (adjust the prefix on each recipe to match its specific subject/sender filter)
UPDATE automation_recipes SET input_config = input_config ||
  jsonb_build_object('gmail_query',
    'from:no-reply@statefarm.com subject:"daily comp" newer_than:730d')  -- 24 months
WHERE recipe_name = 'SF Daily Comp Processor' AND agency_id = '[AGENCY_ID]';

-- (repeat for each email-fed recipe with the appropriate subject filter)

-- 3. Fire each recipe manually one at a time (start with SF Daily Comp Processor):
SELECT public.run_automation_recipe(
  (SELECT id FROM automation_recipes WHERE recipe_name = 'SF Daily Comp Processor' AND agency_id = '[AGENCY_ID]'),
  'install_backfill'
);

-- 4. Wait for completion, check automation_run_log, then fire the next recipe.
-- Some Composio plans rate-limit; if a recipe times out, narrow the gmail_query
-- to a smaller window (e.g. newer_than:90d) and run it multiple times.

-- 5. After all backfills complete, fire GL Entry Writer to reconcile comp_recap into journal_lines:
SELECT public.run_automation_recipe(
  (SELECT id FROM automation_recipes WHERE recipe_name = 'GL Entry Writer' AND agency_id = '[AGENCY_ID]'),
  'install_backfill'
);

-- 6. Restore steady-state queries
UPDATE automation_recipes SET input_config = input_config || jsonb_build_object('gmail_query', input_config->'_steady_state_query')
WHERE agency_id = '[AGENCY_ID]' AND input_config ? '_steady_state_query';
```

The recipes deduplicate via their `unique_on` configs, so re-running on the same emails doesn't create duplicates. After this backfill, the database has comp_recap, journal_entries, journal_lines, payroll_runs, payroll_detail, credit_transactions, producer_production all populated from the agent's actual historical emails — and the BCC web app modules render real numbers from Day One.

**For documents predating the agent's Gmail history** (rare; agents typically have 5+ years in Gmail): manual SQL INSERT from CSV export of the agent's prior accounting system. The recipes' `unique_on` configs prevent duplicates if a later email-feed run lands on the same period.

**"Should we build a custom importer for the agent's specific bank format?"**

No. The Bank Statement Processor recipe (#3) uses Groq to parse bank statements regardless of format — it works on PDF attachments from any bank. If the recipe fails on a specific bank's format, update the `groq_prompt` in the recipe row, don't build a parallel importer.

**"The agent uses ADP for payroll. The Payroll Processor recipe is built for Gusto. Do we need a custom one?"**

No. Recipe #5 (Payroll Processor) is parser-agnostic — it uses Groq to extract payroll runs and detail rows from email content. Update the `gmail_query` in `input_config` to match ADP's sender pattern (e.g., `from:noreply@adp.com`) and the `groq_prompt` to describe ADP's email format, and the same recipe handles ADP.

**"What if the agent uses something we don't have a recipe for — like a CRM that emails reports?"**

Then build a 13th recipe — that's the customization Project Claude does post-install. The pattern is identical: Composio tool to fetch the email, Groq to parse, write to the right table. SQL template lives in `docs/AUTOMATIONS_INSTALL.md`. But this is per-agent customization, not a deviation from the canonical install.

**"During install, how does the agent prove their Gmail is connected?"**

Run the smoke test in `docs/AUTOMATIONS_INSTALL.md` Step 6. If it returns 200 from the Edge Function and writes a successful row to `automation_run_log`, Gmail is reachable. If it returns "Composio GMAIL_FETCH_EMAILS failed: Invalid connected_account_id," the Gmail authorization is bad — have the agent reauthorize via Composio's connector page and re-insert the new account_id into `settings`.

---

## What Project Claude should NOT do

- Do NOT ask the agent for "their email format" or "their bank's CSV layout." The recipes are format-agnostic via Groq.
- Do NOT build a manual import script that reads emails and writes rows. The recipes do this.
- Do NOT promise the agent "we'll import your last 5 years of history during install." Steady-state from install date is the default; historical backfill is opt-in and manual.
- Do NOT skip migration 011 or the Edge Function deploy. Without them, the recipes are inert — they sit in the table looking active, but nothing fires.
- Do NOT seed recipes without the runner installed first. Seeding 12 recipes that never fire just buries the runner-broken state.

---

## What "the importer is working" looks like at end-of-install

**Test 1 — Smoke test (the immediate confirmation):**
Per `docs/AUTOMATIONS_INSTALL.md` Step 6: manually fire the Daily Briefing recipe. Within 30 seconds, agent receives the briefing email at their personal address. `automation_run_log` shows `status='success'`. `automation_recipes.last_run_at` is updated.

**Test 2 — Within 24 hours (the first real recipe firing):**
Check `automation_run_log` for SF Daily Comp Processor entries. If today is a business day, you should see at least one row with `status='success'` and `records_processed > 0`. `comp_recap` table has new rows.

**Test 3 — End of first week:**
- `comp_recap` has 5+ daily comp entries
- `documents` has rows from the Email Archiver
- `automation_run_log` shows ~30+ rows across recipes, mostly success
- Dashboard's Revenue YTD card starts to show real numbers (after GL Entry Writer reconciles comp_recap → journal_lines → v_income_statement)

If any of those don't happen, debug via `automation_run_log` — the error_message tells you which recipe is broken and why.

---

## Cross-references

- `docs/AUTOMATIONS_INSTALL.md` — full SQL templates for all 12 recipes + runner setup
- `docs/MODULE_DATA_WIRING.md` — which tables each module reads (so you can verify the importer is filling the right places)
- `supabase/migrations/011_automation_runner.sql` — the runner engine source
- `supabase/functions/automation-runner/index.ts` — the Edge Function source
- `CLAUDE.md` — install bible, hard-learned bugs, schema audit

---

*Last updated: 2026-05-10 — initial doc shipped to close the "Project Claude tries to build a custom importer" gap.*
