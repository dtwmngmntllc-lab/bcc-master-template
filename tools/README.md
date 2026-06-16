# BCC Schema Audit

Verifies every `supabase.from(...).select(...).eq(...).order(...)` call in `src/`
references columns that actually exist in the database. Catches the silent
schema-mismatch bug that ships blank tabs to clients.

## Why this exists

In May 2026 we shipped three separate cases of this bug:

  1. Dashboard AIPP card showed `0.0% / $0.00` because the query ordered by
     `year` but the column is `program_year`.
  2. Financials had 5 broken sections because `comp_recap` and `payroll_detail`
     queries selected columns that didn't exist.
  3. Tasks & Goals → Completed crashed because the code read `task.module`
     but the column is `module_reference`.

Each one rendered as a blank tab. Each one looked like a UI bug to the client.
None of them threw a visible error.

This audit catches all of them in 2 seconds before they ship.

## Usage

### Manual audit (strict — exits 1 on issues)

```bash
npm run audit:schema
```

Use this any time you change a query, add a new module, or before pushing to
master. CI can run this to block bad PRs.

### Warn-only mode

```bash
npm run audit:schema:warn
```

Same checks, but exits 0 even if issues are found. Useful when you want to
see issues without failing automation.

### Auto-runs on every build

The `prebuild` script runs the audit in warn-only mode before every
`npm run build`. Vercel deploys see warnings in the build log but do not
fail. To block deploys on schema issues, set `AUDIT_STRICT=1` in Vercel
env vars.

## What it checks

For every `supabase.from("table_name").something()` chain in `src/`:

  - Is `table_name` a real public table or view? (else: TABLE_UNKNOWN)
  - In `.select("a, b, c")` — does every column exist on that table?
  - In `.eq("col", ...)`, `.order("col")`, `.gte/.lte/.gt/.lt/.in/.like/.ilike/.is/.contains("col", ...)` — does every column exist?

It does NOT check:

  - Foreign-key joins (e.g. `journal_entries!inner ( ... )`) — these are
    skipped because the audit can't follow nested PostgREST relations.
  - Aliased columns (e.g. `count:tasks(count)`) — also skipped.
  - SQL string templates — only top-level `from()` calls in JS/JSX.

## Required environment

The audit needs to reach your Supabase project to read the schema:

```bash
VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

These are the same vars Vite uses, so any environment that can build the
app can also run the audit. If they're missing, the audit warns and exits 0.

## How it discovers the schema

Two methods, in order:

  1. **Probe**: For each table referenced in `src/`, do `from(table).select("*").limit(1)`.
     If a row comes back, columns are extracted from the keys.
  2. **OpenAPI fallback**: For empty tables, fetch `/rest/v1/?apikey=...` to
     get PostgREST's auto-generated OpenAPI spec, which lists every column.

This approach works against any Supabase project and doesn't require a
service-role key — anon is enough.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Clean, OR warn-only mode with issues, OR env missing in non-strict mode |
| 1 | Strict mode + issues found |
| 2 | Strict mode + env vars missing |

## Built by

Imaginary Farms LLC · The Claude Whisperer · imaginary-farms.com
