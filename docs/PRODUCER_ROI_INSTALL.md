# Producer ROI Install Playbook

> Specific install steps for the **HR & People → Performance tab** Producer ROI feature.
> Apply during both Path A (existing DB) and Path B (clean install).

This document is referenced by `HANDOFF_PROMPTS.md` for both install paths. Project Claude reads this when setting up the Performance tab so the agent's first interaction with the feature is grounded in their real numbers.

---

## What the Performance tab does

For each producer (any staff member with role containing "LSP", "Producer", or "Financial Services Specialist"), the Performance tab shows:

1. **Current month economics** — premium issued by line, new-business commission earned (premium × SMVC), fully-loaded payroll cost (gross × 1.15), net to agency
2. **24-month commission trajectory chart** — historical bars (actual new-business commission earned per month) plus 24 forward months of projected new + cohort renewal income, with a red dashed cost line and a ⭐ star at projected breakeven month
3. **Status pill** — `Profitable now` / `On track` / `Slow ramp` / `Behind pace` based on whether breakeven hits within the 12-18 month target window
4. **Book-level Lapse Rate card** at the top — computed from `comp_recap` (prior-year vs current-year auto+fire YTD renewal commission)
5. **Ask Claude buttons** on every card with full context for the agent to discuss with their Project Claude

---

## Required schema (migration 010)

`010_producer_roi_infrastructure.sql` adds:

**Three columns on `agency`:**
- `smvc_rate_pc NUMERIC(5,2)` — agent's P&C SMVC rate per A005 (e.g. `10.00` = 10%)
- `blended_rate_other NUMERIC(5,2)` — blended rate for non-P&C lines (typically 8-10%)
- `lapse_rate_annual NUMERIC(5,2)` — manual override; NULL means "compute from comp_recap"

**One new table: `producer_production`:**
- Monthly issued premium per producer per line of business (`auto`, `fire`, `life`, `health`, `fs`)
- UNIQUE on `(agency_id, staff_id, period_year, period_month, line_of_business)`
- RLS-enabled with anon read policy

Run migration 010 in the client's Supabase Studio. It's `IF NOT EXISTS` safe.

---

## Step-by-step install

### 1. Apply migration 010

```sql
-- Open the client's Supabase Studio → SQL Editor
-- Paste and run: supabase/migrations/010_producer_roi_infrastructure.sql
```

Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='agency'
  AND column_name IN ('smvc_rate_pc','blended_rate_other','lapse_rate_annual');
-- Expect 3 rows

SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name='producer_production';
-- Expect 1
```

### 2. Ask the agent for their commission rates

Most agents know their A005 SMVC rate. If not, the rate appears on every monthly comp recap from State Farm. Typical values:

- **SMVC rate (P&C):** Usually around 10%, ranges 8-12%
- **Blended rate (other lines):** Typically 8-10%

Update the agency record:

```sql
UPDATE agency
SET smvc_rate_pc       = 10.00,   -- replace with their actual P&C rate
    blended_rate_other =  9.00,   -- replace with their actual blended rate
    lapse_rate_annual  = NULL     -- NULL = compute from comp_recap, or set explicit % to override
WHERE id = (SELECT id FROM agency LIMIT 1);
```

### 3. Identify producers in the staff table

The Performance tab filters staff to those whose `role` contains "LSP", "Producer", or "Financial Services". Confirm the existing staff records use one of those role names:

```sql
SELECT id, first_name, last_name, role, start_date, pay_rate, employment_type
FROM staff
WHERE agency_id = (SELECT id FROM agency LIMIT 1)
  AND is_active != false
ORDER BY start_date;
```

If a producer's role is something different (e.g., "Sales Rep" or "Account Manager"), update it:

```sql
UPDATE staff SET role = 'Licensed Sales Producer' WHERE id = '<staff-uuid>';
```

### 4. Initial producer_production backfill (REQUIRED for Day-One-Complete installs)

Without `producer_production` data, the Performance tab is operational but empty: zeros for every historical bar, flat zero projection line, every producer status reads "Behind pace." That's correct behavior pre-data, but for a Day-One-Complete install (where the agent should see real ROI projections on first login), at least 3 months of history MUST be backfilled before handoff.

**Decision tree:**
- **The agent is providing producer reports for the prior 3-12 months during install** — backfill via Option (a) below. This is the default path for Day-One-Complete installs.
- **The agent doesn't have those reports handy or won't be live until the next monthly cycle** — skip backfill, log the gap to `persistent_memory` (Option (c) below), and the Performance tab populates after Recipe #6 (Producer Production Report Processor) fires on the 1st of next month.

**Two ways to populate it:**

**Option (a) — Manual backfill from agent's monthly reports.** Ask the agent to share their last 6-12 months of producer production reports (they get these from State Farm or pull them from ECRM). For each producer, for each month, record issued premium by line of business:

```sql
INSERT INTO producer_production
  (agency_id, staff_id, period_year, period_month, line_of_business, policies_issued, premium_issued)
VALUES
  ('<agency-uuid>', '<priya-uuid>', 2026, 4, 'auto', 12, 17500.00),
  ('<agency-uuid>', '<priya-uuid>', 2026, 4, 'fire',  6, 12800.00),
  ('<agency-uuid>', '<priya-uuid>', 2026, 4, 'life',  3,  1900.00),
  ('<agency-uuid>', '<priya-uuid>', 2026, 4, 'fs',    1,  2500.00),
  -- ... repeat for each producer × each month × each line of business
ON CONFLICT (agency_id, staff_id, period_year, period_month, line_of_business) DO UPDATE
  SET policies_issued = EXCLUDED.policies_issued,
      premium_issued  = EXCLUDED.premium_issued;
```

**Option (b) — Email-fed going forward (this is Recipe #6 in the canonical 12).** Producer Production Report Processor (recipe #6) runs on the 1st of each month, reads the agent's Gmail for the current month's producer report, parses it via Groq, and writes to `producer_production` automatically. This recipe is part of every install (see `docs/AUTOMATIONS_INSTALL.md`). It keeps the table current going forward, but it does NOT backfill history — only the most recent month per run. For history, use Option (a).

**Option (c) — Defer to first recipe run (last resort).** If neither manual backfill nor immediate email feed is possible at install time, log the gap to `persistent_memory` so the agent's Claude knows to remind them, then wait for Recipe #6 to fire on the 1st of next month:

```sql
INSERT INTO persistent_memory (agency_id, category, title, content, added_by, source)
VALUES (
  (SELECT id FROM agency LIMIT 1),
  'install_followup',
  'Producer ROI feature awaiting production data',
  'The HR & People → Performance tab is wired and the schema is ready. We need to backfill producer_production with the last 6-12 months of issued premium per producer per line of business. Ask the agent for their producer reports.',
  'install',
  'install_handoff'
);
```

### 5. Commission structures (optional but recommended)

Each producer should have a row in `commission_structures` describing what the agent pays them. The Commissions tab (separate from Performance) reads this. Not required for the Performance tab to function, but the tabs work together when both are populated.

```sql
INSERT INTO commission_structures
  (agency_id, staff_id, structure_type, base_rate, tier_thresholds, notes)
VALUES (
  (SELECT id FROM agency LIMIT 1),
  '<staff-uuid>',
  'flat_pct_of_premium',
  3.00,  -- producer earns 3% of issued premium
  NULL,
  'Flat 3% on all issued premium per producer agreement signed 2026-01-15'
);
```

### 6. Verify in browser

Once the schema, agency rates, and at least one row of producer_production are in place:

1. Open the deployed BCC app
2. Navigate to **HR & People → Performance**
3. You should see:
   - Book Lapse Rate card at top with computed lapse rate
   - One ROICard per producer with their economics + 24-month chart
   - Assumptions card at bottom listing SMVC, blended, lapse, fully-loaded multiplier
4. Click an "Ask Claude" button to confirm the producer context flows correctly to Claude.ai

### 7. Walkthrough with the agent

Show the agent:
- The Lapse Rate card and what it's computing from
- One producer's card and explain: "Premium issued × SMVC = new-business commission, then we project the renewal tail forward"
- The breakeven star ⭐ and what month it's projecting
- The "Ask Claude" button — encourage them to use it for any producer decision

---

## Honest math — what the tab does and does NOT do

**Does:**
- Calculate new-business commission to agency from real producer premium issued × agency SMVC/blended rate
- Project forward using cohort survival math (each month's new business renews 12 months later, then loses lapse_rate% per year compounding)
- Show breakeven against fully-loaded payroll cost (gross × 1.15)

**Does not:**
- Attribute agency-level renewal commission from `comp_recap` to individual producers (that data isn't tagged to a producer; attributing it would be misleading)
- Account for producer commission pay-out in the "net to agency" calculation. The fully-loaded cost is gross × 1.15 (FICA/FUTA/SUTA/WC). If the agent also pays the producer a percentage of issued premium as commission, that's a separate line item — track it via `commission_structures` and discuss with the agent's Claude during planning sessions.

If the agent asks for either of those, the right answer is: "Your Claude can model that for you specifically — paste your producer agreement and let's work through it."

---

## Files this feature touches

- `supabase/migrations/010_producer_roi_infrastructure.sql` — schema
- `src/modules/HRPeople.jsx` — `useProducerROI()` hook + `PerformanceSection` + `ProducerROICard`
- `supabase/demo/demo_reset_function.sql` — seeds 24 months of demo data for 3 producers (Sunshine State only)

---

*Last updated: May 7, 2026 — initial Performance tab feature shipped.*
