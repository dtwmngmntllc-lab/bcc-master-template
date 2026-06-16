# BCC Install Procedure

End-to-end installation for a new State Farm agent BCC. Roughly 60–90 minutes for your first run; ~30 minutes once you've done one.

> **Audience:** the managed-service installer (you, or another Claude session running this template). The agent themselves does NOT touch any of this — they only see the deployed dashboard and the daily briefing emails.

## 0. Prerequisites

Before clicking "Use this template":

- [ ] **Discovery call complete** — you have the agent's: legal name, agency LLC/entity name + EIN, SF agent code, licensing states, primary email (NOT `@statefarm.com`), phone, address
- [ ] **Google account** for the agency, with Gmail + Drive + (eventually) Photos enabled — this is what Composio will OAuth into
- [ ] **Composio account** with at least: Gmail, Google Drive, GitHub, Supabase connectors available
- [ ] **Supabase organization** for the install (or use the installer's)
- [ ] **Vercel team** for the install
- [ ] **Groq API key** for the daily briefing composer (optional but recommended — falls back to a static template if missing)

## 1. Fork from template

1. Click **"Use this template"** at the top of `dtwmngmntllc-lab/bcc-master-template`.
2. Name the new repo `<agent-last-name>BCCdashboard` (lowercase, no spaces) — e.g. `smithBCCdashboard`.
3. Clone it locally:
   ```sh
   git clone git@github.com:<your-org>/<agent-last-name>BCCdashboard.git
   cd <agent-last-name>BCCdashboard
   ```

## 2. Stand up Supabase

1. Create a new Supabase project (region close to the agent; free tier is fine).
2. Save the **project ref** (the slug like `vhcgxwkkgfvxgrksfote`) — you'll need it everywhere.
3. From **Settings → API**, save the **Project URL** and the **anon public key**.
4. From **Settings → Vault**, add these secrets:
   - `groq_api_key` — your Groq key
   - (Add any other LLM provider keys here, never in `.env`)
5. Optional but recommended: enable **point-in-time recovery** if you're on a paid plan.

## 3. Run migrations

Run them in order. Easiest path is the Supabase **SQL Editor**; for repeatable installs use `supabase db push` against a linked project.

```
001 → 002 → 003 → [edit 004] → 004 → 005 → 006 → 007 → 008 → 010 → 011 → 011a → 012 → 013 → [edit 014] → 014 → 015 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → 023
```

### 3a. Customize migration 004

`supabase/migrations/004_seed_agency_record.sql` ships as a template with `AGENCY_ID_PLACEHOLDER` and `CLIENT_*` markers. **Before applying it:**

```sh
# Generate the agency UUID (use the value from running this in the SQL editor)
#   SELECT gen_random_uuid();
# Then substitute it everywhere in 004:
AGENCY_UUID="<paste-here>"
sed -i.bak \
  -e "s/AGENCY_ID_PLACEHOLDER/${AGENCY_UUID}/g" \
  -e "s/CLIENT_AGENCY_NAME/Smith Insurance Agency/g" \
  -e "s/CLIENT_OWNER_NAME/Jane Smith/g" \
  -e "s/CLIENT_ENTITY_TYPE/LLC/g" \
  ... \
  supabase/migrations/004_seed_agency_record.sql
```

A complete `CLIENT_*` placeholder list is at the top of the file. **Don't commit the substituted version back to your install repo if it contains the EIN or other sensitive data** — keep the placeholder version in git, apply the substituted version directly via the SQL editor.

### 3b. Customize migration 014

`014_seed_canonical_recipes.template.sql` has 2 placeholders:

- `AGENT_FULL_NAME` — e.g. `Jane Smith`
- `BRIEFING_RECIPIENT_EMAIL` — e.g. `jane@smithagency.com`

```sh
sed -i.bak \
  -e "s/AGENT_FULL_NAME/Jane Smith/g" \
  -e "s/BRIEFING_RECIPIENT_EMAIL/jane@smithagency.com/g" \
  supabase/migrations/014_seed_canonical_recipes.template.sql
mv supabase/migrations/014_seed_canonical_recipes.template.sql supabase/migrations/014_seed_canonical_recipes.sql
```

The agency UUID inside 014 is read from the `agency` table at runtime (`SELECT id FROM agency LIMIT 1`), so no UUID substitution is needed.

## 4. Wire Composio

1. In Composio, create a new project (or reuse your managed-service workspace).
2. Connect these accounts **on behalf of the agent's Google/GitHub accounts** (not yours):
   - Gmail
   - Google Drive
   - GitHub (the install's repo owner)
   - Supabase (the install's project)
3. Save the `ca_*` connection IDs — you'll paste them into `agency.composio_account_id` (already done if you filled `CLIENT_COMPOSIO_ID` in migration 004).
4. If the install will use social media automation, also connect: Facebook (Pages), Instagram (Business), LinkedIn.

## 5. Deploy Edge Functions

```sh
# Authenticate the Supabase CLI to your project
supabase link --project-ref <your-project-ref>

# Deploy each function. verify_jwt should be false for document-processor;
# true (default) for the others.
supabase functions deploy automation-runner
supabase functions deploy email-archiver
supabase functions deploy social-media-scheduler
supabase functions deploy document-processor --no-verify-jwt
```

Then schedule `automation-runner` to tick every 5 minutes via pg_cron. The migration `011_automation_runner.sql` installs the schedule definition; verify it ran:

```sql
SELECT * FROM cron.job WHERE jobname LIKE '%automation%';
```

## 6. Deploy to Vercel

1. `vercel link` from the repo root, point at your Vercel team.
2. Add environment variables in Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_AGENCY_ID` — the UUID you generated in step 3a
   - `VITE_USE_MOCK_DATA=false` (production) or `true` (demo)
   - `VITE_DEMO_MODE=false`
3. `vercel deploy --prod`.
4. **Update the Vercel URL in 3 migrations.** The template ships with `your-dashboard.vercel.app` as a placeholder inside the Daily Briefing HTML email. After you have your production domain:
   ```sh
   sed -i.bak "s|your-dashboard.vercel.app|<your-vercel-domain>|g" \
     supabase/migrations/016_daily_briefing_composer.sql \
     supabase/migrations/017_daily_briefing_composer_poll_fix.sql \
     supabase/migrations/018_daily_briefing_composer_dispatch_and_trust.sql
   ```
   Re-run the latest one (018 supersedes 016+017) in the SQL editor to update the function body.

## 7. Smoke tests

Run each in the SQL editor:

```sql
-- Did 12 recipes seed?
SELECT recipe_name, is_active, composio_action, internal_handler
FROM automation_recipes
ORDER BY recipe_name;

-- Force one tick of the runner
SELECT public.automation_recipe_runner();

-- Watch the last 20 log rows
SELECT id, recipe_name, status, summary, created_at
FROM automation_recipe_logs
ORDER BY created_at DESC
LIMIT 20;
```

Visit the deployed Vercel URL — you should land on the Dashboard tab with empty modules (since you haven't ingested data yet) or with mock data if `VITE_USE_MOCK_DATA=true`.

## 8. Hand off to the agent

The agent only needs:
- The Vercel URL
- The expectation that they'll receive a daily briefing email
- A short Loom or in-person walkthrough of the dashboard tabs

Everything technical you maintain via this repo + Supabase + Composio.

---

## Common gotchas

- **GitHub MCP returns 403 on writes.** All GitHub writes from a managed-service Claude session must go through Composio's `GITHUB_COMMIT_MULTIPLE_FILES` (atomic via Git Data API) or `GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS` (single file with explicit SHA). The built-in `Github:*` MCP tools are read-only at the time of writing.
- **`COMPOSIO_SEARCH_GROQ_CHAT` 404 in some Composio projects.** The `dtwmngmntllc_workspace` install had this — ref Composio support ticket. Only re-engage if you see a 404 in a real recipe run.
- **`net._http_response` polling from plpgsql.** MVCC isolation means a plpgsql function cannot see its own pg_net response rows. Build async result handling into the runner, not into recipe SQL.
- **Don't push the substituted 004.** The version in your install repo should keep the `AGENCY_ID_PLACEHOLDER` and `CLIENT_*` tokens. The substituted version exists only in your Supabase project history.

## Where to look when something breaks

- `docs/SELF_HEAL_GUIDE.md` — the agent-runner's automatic recovery patterns
- `docs/AUTOMATIONS_INSTALL.md` — recipe-by-recipe install + verification
- `docs/MODULE_DATA_WIRING.md` — which dashboard tab reads which table
- `tools/recipe_validation.sql` — schema check queries to run after migration 023
- `tools/schema_audit_query.sql` — generates a full schema dump in case of drift

If you need a Claude session to drive the install: load `CLAUDE.md` and `docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md` into the Project system prompt.
