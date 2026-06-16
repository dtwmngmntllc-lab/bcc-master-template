# BCC Master Template

The **Business Command Center (BCC)** is a dashboard + automation suite for State Farm agents — financials, compliance, social media, HR, document processing, and a Claude-powered daily briefing.

This repository is the **install-agnostic master template** that every new agent install forks from. It bundles:

- a React/Vite dashboard (Supabase auth, no backend you have to host)
- 22 idempotent SQL migrations that stand up the full schema + RLS policies + automation runner
- 14 canonical automation **recipe seeds** (document processor, daily briefing, social media, etc.)
- 4 Supabase **Edge Functions** in TypeScript (`automation-runner`, `document-processor`, `email-archiver`, `social-media-scheduler`)
- Composio integration patterns for Gmail / Drive / GitHub / Supabase / social
- a Vault-aware settings layer (`get_setting()` with fallback) so per-install secrets stay out of the repo

The Godley install (`dtwmngmntllc-lab/GodleyBCCdashboard`) is the reference implementation; this template is the synthesized, install-agnostic baseline distilled from it.

## Quickstart for a new agent install

1. Click **"Use this template"** at the top of the repo on GitHub → create a new repo, e.g. `agentname-bcc-dashboard`.
2. Follow [`INSTALL.md`](./INSTALL.md) end to end. It walks through Supabase project creation, Vercel deploy, Composio OAuth, migration sequencing, and Edge Function deployment.
3. Use [`docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md`](./docs/PROJECT_CLAUDE_SYSTEM_PROMPT_TEMPLATE.md) as the Project system prompt for the install's Claude.

## What you'll need before starting

- A Supabase account (free tier is fine for early installs)
- A Vercel account (free tier is fine)
- A Composio account with Gmail + Google Drive + GitHub + Supabase connections wired to **the agent's** Google/GitHub accounts (not yours)
- A Groq API key (for the daily briefing LLM composer) — stored in Supabase Vault, never the repo
- Roughly 60–90 minutes of attention for the first install; subsequent installs land in ~30 minutes once you've done one

## Repository layout

```
.
├── BCCApp.jsx              # Top-level React app (tabs, routing, layout)
├── index.html              # Vite entrypoint
├── package.json            # Vite + React + Supabase JS + Tailwind
├── vite.config.js
├── .env.example            # Copy to .env, fill in Supabase URL + anon key + agency_id
│
├── src/
│   ├── main.jsx
│   ├── components/         # DemoBanner, EmptyState, ErrorBoundary, LoadingState
│   ├── lib/                # supabase client, hooks, utils
│   └── modules/            # One file per dashboard tab (Dashboard, Financials, etc.)
│
├── supabase/
│   ├── migrations/         # 22 install-agnostic migrations + 1 templated 014
│   ├── recipe_seeds/       # 14 reusable automation recipe seed snippets
│   ├── functions/          # 4 Edge Functions (Deno/TypeScript)
│   └── demo/               # Optional: demo-mode reset function
│
├── docs/                   # AUTOMATIONS_INSTALL, MODULE_DATA_WIRING, SELF_HEAL, etc.
├── tools/                  # Schema audit scripts, recipe validation
├── CLAUDE.md               # Project system prompt — load into Claude for ongoing work
├── HANDOFF_PROMPTS.md      # Session-to-session handoff conventions
└── SCHEMA_NORMALIZATION_RUNBOOK.md
```

## Migration sequencing

The migrations are numbered to run in order. **Template-supplied migrations are install-agnostic** and run unchanged. Migrations marked **`*.template.sql`** must be customized per install before applying:

| # | File | Type |
|---|---|---|
| 001 | `bcc_master_schema.sql` | Install-agnostic |
| 002 | `seed_compliance_rules.sql` | Install-agnostic (60-day SF compliance calendar) |
| 003 | `seed_chart_of_accounts.sql` | Install-agnostic (BCC standard CoA) |
| 004 | `seed_agency_record.sql` | **Template** — fill in placeholders, run once |
| 005 | `anon_read_policies.sql` | Install-agnostic |
| 006 | `derived_financial_views.sql` | Install-agnostic |
| 007 | `monthly_close_checklist.sql` | Install-agnostic |
| 008 | `bridge_generator.sql` | Install-agnostic |
| 010 | `producer_roi_infrastructure.sql` | Install-agnostic |
| 011 | `automation_runner.sql` | Install-agnostic |
| 011a | `get_setting_with_vault_fallback.sql` | Install-agnostic |
| 012 | `internal_recipe_handlers.sql` | Install-agnostic |
| 013 | `system_status.sql` | Install-agnostic |
| 014 | `seed_canonical_recipes.template.sql` | **Template** — fill in placeholders for agent name + briefing recipient |
| 015 | `fix_composio_input_configs.sql` | Install-agnostic (uses `(SELECT id FROM agency LIMIT 1)`) |
| 016–020 | dispatchers + daily-briefing composer | Install-agnostic |
| 021 | `documents_drive_folder_path.sql` | Install-agnostic |
| 022 | `processor_recipes_to_internal.sql` | Install-agnostic |
| 023 | `processor_dispatchers.sql` | Install-agnostic |

The `agency_id`-based UPDATEs in 015–020 use `(SELECT id FROM public.agency LIMIT 1)` — they self-resolve and don't need substitution as long as you have exactly one agency row (the canonical single-agency-per-install pattern).

## Design invariants

These are settled architectural decisions baked into the template. Don't unsettle them without a strong reason:

- **The Daily Briefing is `INTERNAL`-handler fire-and-trust.** No external LLM API keys live in the repo or in Supabase env vars. The composer reads agency + recipe context, calls Groq via Composio, and emails the result via Gmail-Composio. See `016`–`018`.
- **Edge Functions must be siblings, not replacements.** `email-archiver` and `document-processor` operate alongside each other; the `ALLOWED_FIXED_CATEGORIES` allow-list in `document-processor` must stay in lock-step with `classifyAttachment()` in `email-archiver` and §2 of `docs/DRIVE_FOLDER_SETUP.md` (touch all three when adding a category).
- **Processor recipes default `archive_after_processing=true`** to prevent re-processing loops with Email Archiver V2.
- **plpgsql cannot poll `net._http_response` for its own pg_net calls** (MVCC isolation). Async result handling lives in the runner, not the recipe SQL.
- **Install-specific migrations stay out of the install repo.** Don't `git push` the post-substitution version of `004_seed_agency_record.sql` (with the real UUID/EIN/etc.) — apply it via your Supabase MCP or the SQL editor, then commit only the template-form file back to your install repo.

## Reference implementation

For a working, deployed reference install:

- Repo: `dtwmngmntllc-lab/GodleyBCCdashboard`
- Supabase project: `vhcgxwkkgfvxgrksfote`
- Agent: Deatria Godley (State Farm — Imaginary Farms LLC managed install)

## License

This template ships without a license file by default — every install fork should add one before going public. The reference install is unlicensed (all rights reserved).

## Maintainers

Built and maintained by **DTW Management LLC** — "The Claude Whisperer" — managed-service installs for State Farm agents.

---

For the install procedure, see [`INSTALL.md`](./INSTALL.md). For how to work with Claude on an install, see [`CLAUDE.md`](./CLAUDE.md).
