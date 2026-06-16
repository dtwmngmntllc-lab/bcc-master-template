# Google Drive Folder Setup

**Read this during install when wiring the Email Archiver, Document Processor, or any other recipe that writes files to the owner's Google Drive.**

This doc establishes the **canonical Drive folder structure** every BCC writes into, the owner-side setup the install operator must verify, and the snake_case category vocabulary that every Drive-writing edge function must use.

---

## 1. Canonical Drive Structure

Every BCC writes archived documents into the owner's Google Drive using this hardcoded path pattern:

```
<owner's Drive root>
└── BCC/
    └── Documents/
        └── YYYY-MM/                  ← auto-created per month (e.g. 2026-05)
            └── <category>/           ← auto-created per category
                └── <filename>        ← uploaded file
```

- The owner provides **one** top-level folder: `BCC/`
- The edge functions create `Documents/`, the `YYYY-MM` month folder, and each category folder on demand
- `YYYY-MM` uses UTC year/month from the document or email date, zero-padded
- One file per attachment; original filename preserved when possible

---

## 2. Canonical Category Vocabulary (snake_case)

These are the **only** category names a BCC edge function may write under `Documents/YYYY-MM/`. Any new recipe that routes files to Drive MUST use one of these names. Adding a new category requires an update to this doc *and* the corresponding edge function code paths.

| Category | What goes here |
|---|---|
| `bank_statements` | Monthly bank statements (operating, payroll, savings, etc.) |
| `credit_card_statements` | Credit card statements (Amex, Chase, agency cards) |
| `comp_recap` | State Farm compensation recaps — monthly, daily, 1H, mid-year |
| `deductions` | State Farm deduction statements (PFA, validation, charge-back, etc.) |
| `payroll` | Payroll reports from Gusto, ADP, Paychex, or other payroll provider |
| `commission_reports` | Producer commission detail reports |
| `production_reports` | Producer / team production reports (monthly, scorecard, AIPP) |
| `team_production` | Aggregated team-level production data |
| `receipts` | Vendor invoices, receipts, purchase confirmations |
| `contracts` | Signed agreements, vendor contracts, leases |
| `archive_bundles` | Multi-doc bundles attached to a single email (rare, e.g. quarterly close PDFs) |
| `unsorted` | Documents the classifier could not place — operator should review and refile |
| `general` | Email-archiver fallback bucket for messages with attachments that don't match any rule above |

**Convention rule:** Drive folder names are snake_case (`bank_statements`), matching the BCC database table naming convention. Never kebab-case (`bank-statements`), never CamelCase, never spaces.

---

## 3. Required Owner Setup

The install operator must verify all five of these before activating any recipe that writes to Drive.

### 3.1 Drive root folder

The owner must create a top-level folder named exactly **`BCC`** in the root of the Google Drive they want to archive to (usually their primary business Google Workspace Drive).

- Casing matters: `BCC`, not `bcc` or `Bcc`
- Do NOT create the `Documents` subfolder — the edge function does that
- Do NOT pre-create category folders — the edge function does that

### 3.2 Google Drive Composio connection

The owner must connect their Google Drive to **their** Composio account (NOT IF's, NOT a client Claude's — the owner's own Composio).

- Use the same Google account that owns the `BCC/` folder
- Grant Drive scope including file read, file write, and folder management
- After connecting, copy the **Connected Account ID** from Composio (looks like `googledrive_xxxxxx-xxxxxx`)

### 3.3 Gmail Composio connection

The Email Archiver also needs Gmail access on the same Composio account, on the same Google account whose mail will be archived.

- After connecting, copy the **Connected Account ID** (looks like `gmail_xxxxxx-xxxxxx`)

### 3.4 Populate the `settings` table

The dispatcher functions (`dispatch_email_archiver`, `dispatch_document_processor`, etc.) look up the Composio account IDs at runtime via `public.get_setting()`. The install operator must INSERT these rows for the agency BEFORE any recipe with `composio_action='INTERNAL'` is allowed to run:

```sql
-- Replace {{agency_id}} with the owner's agency UUID from public.clients
-- Replace the placeholder IDs with the values copied from Composio in steps 3.2 and 3.3

INSERT INTO public.settings (agency_id, key, value) VALUES
  ('{{agency_id}}'::uuid, 'composio_googledrive_account_id', 'googledrive_xxxxxx-xxxxxx'),
  ('{{agency_id}}'::uuid, 'composio_gmail_account_id',       'gmail_xxxxxx-xxxxxx')
ON CONFLICT (agency_id, key) DO UPDATE SET value = EXCLUDED.value;
```

If either row is missing, the dispatcher will log a clear error to `automation_run_log` and abort the recipe — no partial writes, no silent failures.

### 3.5 Verify settings are readable

After insertion, the install operator should confirm the rows are visible to the edge function via:

```sql
SELECT key, LEFT(value, 20) || '...' AS value_preview
FROM public.settings
WHERE agency_id = '{{agency_id}}'::uuid
  AND key IN ('composio_googledrive_account_id', 'composio_gmail_account_id');
```

Both rows must return. If `RLS` blocks the read, check that the migration 005 anon read policy includes `settings`.

---

## 4. Install Verification Checklist

Run these in order. Stop at the first failure and fix before continuing.

- [ ] `BCC/` folder exists in the owner's Drive root, casing correct
- [ ] Owner's Google Drive is connected in their Composio dashboard
- [ ] Owner's Gmail is connected in their Composio dashboard
- [ ] Both Connected Account IDs are recorded in the install credentials doc
- [ ] `public.settings` has both `composio_googledrive_account_id` and `composio_gmail_account_id` rows for the agency
- [ ] `automation_recipes` row for `Email Archiver` exists with `is_active = true`, `composio_action = 'INTERNAL'`, `internal_handler = 'dispatch_email_archiver'`
- [ ] Manual trigger test: `SELECT public.run_recipe('{{recipe_id}}'::uuid);` returns a `request_id` and no error
- [ ] Within 2-3 minutes, `automation_run_log` shows a new row with `status = 'success'` and `records_processed > 0` (assuming the owner has eligible emails)
- [ ] Open Drive — verify `BCC/Documents/<current YYYY-MM>/` was auto-created with at least one category subfolder
- [ ] Verify `public.documents` has new rows with `drive_file_id`, `drive_folder_path`, and `groq_classification` populated

---

## 5. Edge Function Implementation Notes

When a client's Project Claude writes new edge functions or extends existing ones to route files to Drive, the implementation **must**:

1. Use the canonical category vocabulary from Section 2 — no new categories without updating this doc first
2. Use the canonical path pattern `BCC/Documents/YYYY-MM/<category>/<filename>` — no parallel root folders, no flatter or deeper structures
3. Load Composio account IDs from `public.settings` via `public.get_setting()`, never hardcode
4. Auto-create missing folders rather than failing on a missing path (use `GOOGLEDRIVE_FIND_FILE` to check, `GOOGLEDRIVE_CREATE_FOLDER` to create)
5. Be idempotent — if the same file is processed twice, the second run should detect the existing file (by `drive_file_id` or `source_message_id` conflict key) and skip

A reference implementation lives in any installed client repo's `supabase/functions/email-archiver/index.ts`. The constant `DRIVE_FOLDER_BASE = "BCC/Documents"` is canonical and should not be changed.

---

## 6. Future Enhancement: explicit `drive_folder_id` in `input_config`

The current pattern relies on a hardcoded path (`BCC/Documents/...`) and the owner having a folder named `BCC` at their Drive root. This is simple to install but inflexible:

- If the owner wants the archive somewhere other than Drive root (e.g. inside a Shared Drive or under an existing folder structure), the current pattern can't accommodate
- A folder-rename by the owner breaks the archiver until the path is recreated

The planned enhancement is to add an optional `drive_folder_id` field to recipe `input_config`:

```json
{
    "preserve_starred": true,
    "archive_older_than_days": 30,
    "route_attachments_to_drive": true,
    "drive_folder_id": "1AbCdEfGhIjKlMnOpQrSt",   // ← new, optional
    "drive_folder_template": "Documents/{{year}}-{{month}}/{{category}}"
}
```

When `drive_folder_id` is present, the edge function uses it as the root and applies the template relative to it. When absent, behavior falls back to the current `BCC/Documents/...` pattern for backward compatibility.

**Status:** Not yet built. Tracked in `system_status` as a future improvement, not a current bug.

---

## 7. Why this doc exists

The `email-archiver` and `document-processor` edge functions in early installs used inconsistent naming conventions for the same logical categories (e.g. `bank_statements` vs `bank-statements`), creating parallel folder hierarchies for the same documents. This doc establishes one canonical vocabulary so all future installs converge.

Existing client installs that predate this doc may carry the inconsistency — that is **pre-existing technical debt**, not a model to copy. New installs follow the canonical structure from day one.
