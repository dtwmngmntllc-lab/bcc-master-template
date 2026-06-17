// =========================================================================
// email-archiver  (BCC Master Template — multi-step Composio orchestration)
// =========================================================================
// PURPOSE: Archive older Gmail messages and log them to the documents table.
//   This is a multi-step workflow (fetch IDs -> modify labels -> log) that
//   can't be expressed in the generic automation-runner. Triggered by
//   public.dispatch_email_archiver, which is itself called by the
//   automation-runner via run_internal_recipe for the Email Archiver recipe.
//
// =========================================================================
// V1 SCOPE (default, input_config.route_attachments_to_drive = false):
//   1. Validate shared_secret against settings.automation_runner_cron_secret
//   2. Load recipe + input_config
//   3. Build (or accept) the gmail query — default archives mail older
//      than archive_older_than_days, optionally preserving starred mail
//   4. GMAIL_FETCH_EMAILS with ids_only=true to enumerate matches
//   5. GMAIL_BATCH_MODIFY_MESSAGES to remove INBOX label (= Gmail archive)
//      plus any add_archive_label_id specified
//   6. INSERT one row into public.documents per archived message
//   7. INSERT a single automation_run_log row with the real outcome
//   8. UPDATE automation_recipes.last_run_status
//
// =========================================================================
// V2 SCOPE (input_config.route_attachments_to_drive = true):
//   Adds steps between the fetch and the batch-modify:
//     - For each matched message, fetch the full payload to enumerate
//       attachments
//     - Classify each attachment by filename + sender into one of the
//       canonical categories defined in docs/DRIVE_FOLDER_SETUP.md §2
//     - Walk / create the canonical Drive folder hierarchy:
//         BCC/Documents/YYYY-MM/<category>/
//       (BCC must already exist at Drive root; the function creates the rest)
//     - GMAIL_GET_ATTACHMENT to stage the binary in Composio's S3
//     - GOOGLEDRIVE_UPLOAD_FILE to land it in the resolved category folder
//     - Write ONE documents row per attachment with drive_file_id /
//       drive_url / drive_folder_path / groq_classification populated
//     - Messages with no attachments still get one V1-shaped documents row
//   Per-message work is wrapped in try/catch so a single bad message
//   does NOT poison the whole batch. After all per-message work completes,
//   the batch label-modify step runs ONLY for messages that succeeded
//   end-to-end (idempotency: previously-archived messages are skipped
//   on a second run).
//
// =========================================================================
// LIMITS (V2.0):
//   - Single attachments > 5MB are skipped (GOOGLEDRIVE_UPLOAD_FILE cap).
//     V2.1 will switch to GOOGLEDRIVE_RESUMABLE_UPLOAD for large files.
//   - Classification is rule-based on filename + sender. Groq-based
//     classification is V2.2 future work; the column name
//     `groq_classification` is reused for forward compatibility.
//
// AUTH: verify_jwt = false; the function validates shared_secret in body.
// =========================================================================

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3/tools/execute";

// Canonical from docs/DRIVE_FOLDER_SETUP.md §1 and §2.
const DRIVE_ROOT_FOLDER_NAME = "BCC";
const DRIVE_DOCS_FOLDER_NAME = "Documents";
const FALLBACK_CATEGORY = "general"; // email-archiver fallback per §2

// V2.0 simple-upload cap. Attachments larger than this are skipped with a
// logged reason; V2.1 will route them through GOOGLEDRIVE_RESUMABLE_UPLOAD.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// -------------------------------------------------------------------------
// HTTP helpers
// -------------------------------------------------------------------------

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getSetting(agencyId: string, key: string): Promise<string | null> {
  const { data, error } = await sb.rpc("get_setting", {
    p_agency_id: agencyId,
    p_setting_key: key,
  });
  if (error) {
    throw new Error(`get_setting RPC failed for agency ${agencyId} key ${key}: ${error.message}`);
  }
  return (data as string | null) ?? null;
}

async function callComposio(opts: {
  apiKey: string;
  userId: string;
  connectedAccountId: string;
  toolSlug: string;
  toolArguments: Record<string, any>;
}): Promise<{ ok: boolean; data: any; error: string | null; httpStatus: number; raw: string }> {
  const res = await fetch(`${COMPOSIO_BASE}/${opts.toolSlug}`, {
    method: "POST",
    headers: { "x-api-key": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: opts.userId,
      connected_account_id: opts.connectedAccountId,
      arguments: opts.toolArguments,
    }),
  });
  const text = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  const ok = res.ok && !!parsed?.successful;
  const data = parsed?.data?.response_data ?? parsed?.data ?? null;
  const error = ok
    ? null
    : (parsed?.error?.message || parsed?.error || text.slice(0, 400));
  return { ok, data, error, httpStatus: res.status, raw: text.slice(0, 600) };
}

// -------------------------------------------------------------------------
// Query construction
// -------------------------------------------------------------------------

function buildDefaultArchiveQuery(opts: { olderThanDays: number; preserveStarred: boolean }): string {
  const parts: string[] = [
    "in:inbox",
    "-in:trash",
    "-in:spam",
    `older_than:${opts.olderThanDays}d`,
  ];
  if (opts.preserveStarred) parts.push("-is:starred");
  return parts.join(" ");
}

// -------------------------------------------------------------------------
// V2 helpers — classification, folder resolution, payload walking
// -------------------------------------------------------------------------

/**
 * Classify an attachment into one of the canonical categories from
 * docs/DRIVE_FOLDER_SETUP.md §2. Rule-based on filename + sender + subject.
 * Returns the canonical snake_case category name.
 */
function classifyAttachment(opts: {
  filename: string;
  sender: string | null;
  subject: string | null;
}): string {
  const fn = (opts.filename || "").toLowerCase();
  const sender = (opts.sender || "").toLowerCase();
  const subject = (opts.subject || "").toLowerCase();

  // Rule precedence: most specific first.
  // 1) State Farm deduction / charge-back statements
  if (
    /(deduction|chargeback|charge[-_ ]?back|pfa|validation)/i.test(fn) ||
    /(deduction|chargeback|charge[-_ ]?back)/i.test(subject)
  ) {
    return "deductions";
  }

  // 2) State Farm comp recaps
  if (
    /(comp[-_ ]?recap|comp[-_ ]?statement|mid[-_ ]?year|1h[-_ ]?recap)/i.test(fn) ||
    /(comp recap|compensation recap)/i.test(subject)
  ) {
    return "comp_recap";
  }

  // 3) Bank statements
  if (
    /(bank[-_ ]?statement|operating[-_ ]?statement|chase[-_ ]?statement|bofa[-_ ]?statement)/i.test(fn) ||
    /(bank statement|bank stmt)/i.test(subject)
  ) {
    return "bank_statements";
  }

  // 4) Credit card statements
  if (
    /(credit[-_ ]?card|amex[-_ ]?statement|cc[-_ ]?statement|visa[-_ ]?statement)/i.test(fn) ||
    /(credit card statement|amex statement)/i.test(subject)
  ) {
    return "credit_card_statements";
  }

  // 5) Payroll (Gusto, ADP, Paychex)
  if (
    /(payroll|gusto|adp|paychex|wage)/i.test(fn) ||
    /(gusto|adp|paychex)/i.test(sender) ||
    /(payroll report)/i.test(subject)
  ) {
    return "payroll";
  }

  // 6) Commission reports (producer commission detail)
  if (
    /(commission[-_ ]?detail|commission[-_ ]?report)/i.test(fn) ||
    /(commission detail|commission report)/i.test(subject)
  ) {
    return "commission_reports";
  }

  // 7) Production reports (AIPP, scorecard, monthly production)
  if (
    /(aipp|scorecard|production[-_ ]?report|prod[-_ ]?report)/i.test(fn) ||
    /(aipp|production report|scorecard)/i.test(subject)
  ) {
    return "production_reports";
  }

  // 8) Team production rollups
  if (/(team[-_ ]?production)/i.test(fn) || /(team production)/i.test(subject)) {
    return "team_production";
  }

  // 9) Receipts / invoices
  if (
    /(receipt|invoice|inv[-_ ])/i.test(fn) ||
    /(receipt|invoice)/i.test(subject)
  ) {
    return "receipts";
  }

  // 10) Contracts / agreements
  if (
    /(contract|agreement|lease|nda|msa|sow)/i.test(fn) ||
    /(contract|agreement|lease)/i.test(subject)
  ) {
    return "contracts";
  }

  // 11) Catch-all: archive_bundles for big quarterly PDFs, otherwise the
  // canonical email-archiver fallback `general` (NOT `unsorted` — see §2).
  if (/(bundle|quarterly|close[-_ ]?pack)/i.test(fn) || /(quarterly close|close package)/i.test(subject)) {
    return "archive_bundles";
  }
  return FALLBACK_CATEGORY;
}

/** Format a JS Date / epoch-ms into YYYY-MM (UTC). */
function formatYYYYMM(epochMs: number): string {
  const d = new Date(epochMs);
  if (isNaN(d.getTime())) return formatYYYYMM(Date.now());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/** Pull a header value from Gmail full-message payload.headers list. */
function getHeader(message: any, name: string): string | null {
  const headers: any[] = message?.payload?.headers || [];
  const want = name.toLowerCase();
  for (const h of headers) {
    if (h && typeof h?.name === "string" && h.name.toLowerCase() === want) {
      return typeof h?.value === "string" ? h.value : null;
    }
  }
  return null;
}

/**
 * Walk a Gmail message payload (which is a tree of MIME parts) and
 * extract every attachment, returning { filename, attachmentId, mimeType,
 * size }. Inline attachments and parts without an attachmentId are skipped.
 */
function walkAttachments(payload: any): Array<{
  filename: string;
  attachmentId: string;
  mimeType: string | null;
  sizeBytes: number | null;
}> {
  const out: Array<{ filename: string; attachmentId: string; mimeType: string | null; sizeBytes: number | null }> = [];
  const stack: any[] = [];
  if (payload) stack.push(payload);
  while (stack.length > 0) {
    const part = stack.pop();
    if (!part) continue;
    const fn = typeof part.filename === "string" ? part.filename : "";
    const attId = part?.body?.attachmentId;
    if (fn && fn.length > 0 && typeof attId === "string" && attId.length > 0) {
      const sz = typeof part?.body?.size === "number" ? part.body.size : null;
      out.push({
        filename: fn,
        attachmentId: attId,
        mimeType: typeof part.mimeType === "string" ? part.mimeType : null,
        sizeBytes: sz,
      });
    }
    const parts: any[] = Array.isArray(part?.parts) ? part.parts : [];
    for (const p of parts) stack.push(p);
  }
  return out;
}

/**
 * Idempotency probe — return true if the documents table already has a
 * row whose `notes` JSON references this gmail_message_id for this agency.
 * Uses `ilike` on a JSON substring rather than parsing — the V1 documents
 * row stores notes as a stringified JSON blob, so substring matching is
 * sufficient and avoids a schema-aware index requirement.
 */
async function isAlreadyArchived(agencyId: string, gmailMessageId: string): Promise<boolean> {
  const needle = `"gmail_message_id":"${gmailMessageId}"`;
  const { data, error } = await sb
    .from("documents")
    .select("id")
    .eq("agency_id", agencyId)
    .ilike("notes", `%${needle}%`)
    .limit(1);
  if (error) {
    // Don't block the run on a probe failure; just log to the caller.
    console.error(`isAlreadyArchived probe failed for ${gmailMessageId}: ${error.message}`);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Folder resolver with per-run cache. Given a desired absolute path under
 * the Drive root (segments[0] = "BCC", segments[1] = "Documents", ...),
 * returns the Drive folder ID for the deepest segment. Looks up each
 * segment under its resolved parent, creating any segment that doesn't
 * exist EXCEPT the root segment "BCC", which must be created by the owner
 * per docs/DRIVE_FOLDER_SETUP.md §3.1.
 */
async function ensureDriveFolderPath(opts: {
  apiKey: string;
  userId: string;
  connectedAccountId: string;
  segments: string[];
  cache: Map<string, string>;
}): Promise<string> {
  const { segments, cache } = opts;
  if (segments.length === 0) throw new Error("ensureDriveFolderPath: empty segments");

  let parentId: string | null = null; // null = Drive root
  let accumulatedPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segName = segments[i];
    accumulatedPath = i === 0 ? segName : `${accumulatedPath}/${segName}`;

    // Cache hit?
    const cached = cache.get(accumulatedPath);
    if (cached) {
      parentId = cached;
      continue;
    }

    // Look up by exact name under the current parent.
    const findArgs: Record<string, any> = { name_exact: segName };
    if (parentId) findArgs.parent_folder_id = parentId;
    const findRes = await callComposio({
      apiKey: opts.apiKey,
      userId: opts.userId,
      connectedAccountId: opts.connectedAccountId,
      toolSlug: "GOOGLEDRIVE_FIND_FOLDER",
      toolArguments: findArgs,
    });
    if (!findRes.ok) {
      throw new Error(`GOOGLEDRIVE_FIND_FOLDER failed at segment "${segName}" (path=${accumulatedPath}, http=${findRes.httpStatus}): ${findRes.error}`);
    }

    // Response shape: { files: [{ id, name, mimeType, ... }] } possibly
    // nested under data.data per Composio's docs. Normalise.
    let files: any[] = [];
    const d: any = findRes.data;
    if (Array.isArray(d?.files)) files = d.files;
    else if (Array.isArray(d?.data?.files)) files = d.data.files;

    // Filter to non-trashed folder entries that match exactly.
    const matches = files.filter((f: any) =>
      f && f.mimeType === "application/vnd.google-apps.folder" &&
      typeof f.name === "string" && f.name === segName &&
      f.trashed !== true
    );

    let folderId: string | null = matches[0]?.id || null;

    if (!folderId) {
      // Root segment "BCC" must be operator-created — surface a clear error
      // rather than silently creating a stray BCC folder somewhere wrong.
      if (i === 0) {
        throw new Error(
          `Drive root folder "${DRIVE_ROOT_FOLDER_NAME}" not found in the connected Google Drive. ` +
          `Per docs/DRIVE_FOLDER_SETUP.md §3.1 the owner must create this folder before activating ` +
          `attachment-to-Drive routing.`
        );
      }

      // Create the missing intermediate segment.
      // NOTE (V2.1 fix, 2026-06-17): The Composio GOOGLEDRIVE_CREATE_FOLDER
      // runtime requires `folder_name`, not `name`. The published tool schema
      // (via COMPOSIO_GET_TOOL_SCHEMAS) still shows `name` which is stale —
      // verified empirically against connected_account ca_7eYFnY2De5QY.
      const createArgs: Record<string, any> = { folder_name: segName };
      if (parentId) createArgs.parent_id = parentId;
      const createRes = await callComposio({
        apiKey: opts.apiKey,
        userId: opts.userId,
        connectedAccountId: opts.connectedAccountId,
        toolSlug: "GOOGLEDRIVE_CREATE_FOLDER",
        toolArguments: createArgs,
      });
      if (!createRes.ok) {
        throw new Error(`GOOGLEDRIVE_CREATE_FOLDER failed for segment "${segName}" (path=${accumulatedPath}, http=${createRes.httpStatus}): ${createRes.error}`);
      }
      const cd: any = createRes.data;
      folderId = cd?.id || cd?.data?.id || null;
      if (!folderId) {
        throw new Error(`GOOGLEDRIVE_CREATE_FOLDER returned ok but no folder id for "${accumulatedPath}". Raw: ${createRes.raw.slice(0, 200)}`);
      }
    }

    cache.set(accumulatedPath, folderId);
    parentId = folderId;
  }
  // parentId is the deepest folder by construction.
  return parentId as string;
}

// -------------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const started = Date.now();

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  let body: any = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const recipeId: string | undefined = body.recipe_id;
  const sharedSecret: string | undefined = body.shared_secret;

  if (!recipeId) return jsonResponse({ error: "Missing recipe_id" }, 400);
  if (!sharedSecret) return jsonResponse({ error: "Missing shared_secret" }, 401);

  // Load recipe to resolve agency
  const { data: recipe, error: recipeErr } = await sb
    .from("automation_recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeErr || !recipe) {
    return jsonResponse({ error: `Recipe ${recipeId} not found: ${recipeErr?.message || "no row"}` }, 404);
  }
  if (!recipe.agency_id) {
    return jsonResponse({ error: `Recipe ${recipeId} has no agency_id` }, 500);
  }

  const agencyId = recipe.agency_id as string;

  // Auth
  let expectedSecret: string | null;
  try {
    expectedSecret = await getSetting(agencyId, "automation_runner_cron_secret");
  } catch (err) {
    return jsonResponse({ error: `Auth lookup failed: ${(err as Error).message}` }, 500);
  }
  if (!expectedSecret || sharedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized: invalid shared_secret" }, 401);
  }

  // Helper to write the run log + recipe status, always once at the end
  async function writeOutcome(status: "success" | "failed", recordsProcessed: number, summary: string, errorMessage: string | null) {
    const durationSec = Math.round((Date.now() - started) / 1000);
    await sb.from("automation_run_log").insert({
      agency_id: agencyId,
      recipe_id: recipeId,
      status,
      records_processed: recordsProcessed,
      error_message: errorMessage,
      duration_seconds: durationSec,
      output_summary: summary,
    });
    await sb.from("automation_recipes").update({ last_run_status: status }).eq("id", recipeId);
  }

  try {
    // Read input_config defaults
    const ic = (recipe.input_config || {}) as Record<string, any>;
    const olderThanDays = Number(ic.archive_older_than_days ?? 30);
    const preserveStarred = ic.preserve_starred !== false; // default true
    const maxPerRun = Math.min(Math.max(Number(ic.max_per_run ?? 100), 1), 500);
    const archiveQuery: string = typeof ic.archive_query === "string" && ic.archive_query.trim()
      ? ic.archive_query.trim()
      : buildDefaultArchiveQuery({ olderThanDays, preserveStarred });
    const addArchiveLabelId: string | null = typeof ic.add_archive_label_id === "string" && ic.add_archive_label_id.trim()
      ? ic.add_archive_label_id.trim()
      : null;
    const routeAttachmentsToDrive: boolean = ic.route_attachments_to_drive === true;

    // Credentials
    const composioApiKey = await getSetting(agencyId, "composio_api_key");
    if (!composioApiKey) throw new Error(`Missing composio_api_key in Vault/settings for agency ${agencyId}`);
    const composioUserId = await getSetting(agencyId, "composio_user_id");
    if (!composioUserId) throw new Error(`Missing composio_user_id for agency ${agencyId}`);
    const gmailAccountId = await getSetting(agencyId, "composio_gmail_account_id");
    if (!gmailAccountId) throw new Error(`Missing composio_gmail_account_id for agency ${agencyId}`);

    // Drive account is only required in V2 mode.
    let driveAccountId: string | null = null;
    if (routeAttachmentsToDrive) {
      driveAccountId = await getSetting(agencyId, "composio_googledrive_account_id");
      if (!driveAccountId) {
        throw new Error(
          `Missing composio_googledrive_account_id for agency ${agencyId}. ` +
          `Required when input_config.route_attachments_to_drive = true. ` +
          `See docs/DRIVE_FOLDER_SETUP.md §3.4.`
        );
      }
    }

    // --- Step 1: fetch matching message IDs (ids_only=true for speed) ---
    const fetchResult = await callComposio({
      apiKey: composioApiKey,
      userId: composioUserId,
      connectedAccountId: gmailAccountId,
      toolSlug: "GMAIL_FETCH_EMAILS",
      toolArguments: {
        query: archiveQuery,
        max_results: maxPerRun,
        ids_only: true,
        verbose: false,
        include_payload: false,
      },
    });

    if (!fetchResult.ok) {
      throw new Error(`GMAIL_FETCH_EMAILS failed (http=${fetchResult.httpStatus}): ${fetchResult.error}`);
    }

    // Response shape — messages array under data; each item has messageId
    const messages: any[] = Array.isArray(fetchResult.data?.messages) ? fetchResult.data.messages : [];

    if (messages.length === 0) {
      const summary = `0 emails match archive query "${archiveQuery}". Nothing to archive.`;
      await writeOutcome("success", 0, summary, null);
      return jsonResponse({
        ok: true,
        recipe_id: recipeId,
        recipe_name: recipe.recipe_name,
        status: "success",
        records_processed: 0,
        archive_query: archiveQuery,
        mode: routeAttachmentsToDrive ? "v2" : "v1",
        output_summary: summary,
      }, 200);
    }

    const messageIds: string[] = messages
      .map((m: any) => m?.messageId || m?.id)
      .filter((id: any) => typeof id === "string" && id.length > 0);

    if (messageIds.length === 0) {
      throw new Error(`GMAIL_FETCH_EMAILS returned ${messages.length} messages but none had a messageId field. Sample: ${JSON.stringify(messages[0]).slice(0, 200)}`);
    }

    // =====================================================================
    // V1 path — flag off. Original behaviour: batch-modify then log.
    // =====================================================================
    if (!routeAttachmentsToDrive) {
      const addLabels: string[] = addArchiveLabelId ? [addArchiveLabelId] : [];
      const removeLabels: string[] = ["INBOX"];

      const modifyResult = await callComposio({
        apiKey: composioApiKey,
        userId: composioUserId,
        connectedAccountId: gmailAccountId,
        toolSlug: "GMAIL_BATCH_MODIFY_MESSAGES",
        toolArguments: {
          messageIds,
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        },
      });

      if (!modifyResult.ok) {
        throw new Error(`GMAIL_BATCH_MODIFY_MESSAGES failed (http=${modifyResult.httpStatus}): ${modifyResult.error}`);
      }

      const now = new Date().toISOString();
      const docRows = messages.map((m: any) => {
        const msgId = m?.messageId || m?.id || "unknown";
        const subject = (typeof m?.subject === "string" && m.subject.length > 0) ? m.subject : `(no subject) ${msgId}`;
        const notes = JSON.stringify({
          gmail_message_id: msgId,
          gmail_thread_id: m?.threadId || null,
          from: m?.from || m?.sender || null,
          date: m?.date || m?.internalDate || null,
          archive_query: archiveQuery,
          added_labels: addLabels,
          removed_labels: removeLabels,
          mode: "v1",
        });
        return {
          agency_id: agencyId,
          file_name: subject.slice(0, 300),
          file_type: "email",
          upload_source: "email_archiver",
          processing_status: "archived",
          processing_type: "label_modification",
          uploaded_by: "email_archiver_edge_fn",
          uploaded_at: now,
          processed_at: now,
          notes,
        };
      });

      let docsInserted = 0;
      if (docRows.length > 0) {
        const { data: insertedDocs, error: docErr } = await sb
          .from("documents")
          .insert(docRows)
          .select("id");
        if (docErr) {
          const partial = `Archived ${messageIds.length} emails; documents log INSERT failed: ${docErr.message}`;
          await writeOutcome("success", messageIds.length, partial, null);
          return jsonResponse({
            ok: true,
            recipe_id: recipeId,
            recipe_name: recipe.recipe_name,
            status: "success",
            records_processed: messageIds.length,
            documents_inserted: 0,
            documents_insert_error: docErr.message,
            archive_query: archiveQuery,
            mode: "v1",
            output_summary: partial,
          }, 200);
        }
        docsInserted = (insertedDocs?.length ?? 0);
      }

      const summary = `Archived ${messageIds.length} emails matching "${archiveQuery}"; ${docsInserted} rows logged to documents.`;
      await writeOutcome("success", messageIds.length, summary, null);

      return jsonResponse({
        ok: true,
        recipe_id: recipeId,
        recipe_name: recipe.recipe_name,
        status: "success",
        records_processed: messageIds.length,
        documents_inserted: docsInserted,
        archive_query: archiveQuery,
        mode: "v1",
        output_summary: summary,
      }, 200);
    }

    // =====================================================================
    // V2 path — flag on. Process each message individually: fetch payload,
    // extract attachments, classify, upload to Drive, then label-modify.
    // =====================================================================
    const folderCache = new Map<string, string>();
    const nowIso = new Date().toISOString();

    // Per-message accumulators
    const docRowsV2: any[] = [];
    const archivedMessageIds: string[] = [];
    const skippedMessageIds: string[] = []; // already archived (idempotent)
    const perMessageErrors: Array<{ messageId: string; error: string }> = [];
    let totalAttachmentsUploaded = 0;
    let totalAttachmentsSkippedSize = 0;

    for (const msgId of messageIds) {
      try {
        // Idempotency probe
        if (await isAlreadyArchived(agencyId, msgId)) {
          skippedMessageIds.push(msgId);
          continue;
        }

        // Fetch full payload
        const msgRes = await callComposio({
          apiKey: composioApiKey,
          userId: composioUserId,
          connectedAccountId: gmailAccountId,
          toolSlug: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
          toolArguments: { message_id: msgId, format: "full" },
        });
        if (!msgRes.ok) {
          throw new Error(`GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID failed (http=${msgRes.httpStatus}): ${msgRes.error}`);
        }
        const message = msgRes.data || {};
        const internalDateMs = Number(message?.internalDate || Date.now());
        const yyyymm = formatYYYYMM(internalDateMs);

        const subject = getHeader(message, "Subject") || `(no subject) ${msgId}`;
        const fromHeader = getHeader(message, "From");
        const dateHeader = getHeader(message, "Date");
        const threadId = message?.threadId || null;

        // Enumerate attachments
        const attachments = walkAttachments(message?.payload || {});

        if (attachments.length === 0) {
          // Message with no attachments: V1-style label_modification row.
          docRowsV2.push({
            agency_id: agencyId,
            file_name: subject.slice(0, 300),
            file_type: "email",
            upload_source: "email_archiver",
            processing_status: "archived",
            processing_type: "label_modification",
            uploaded_by: "email_archiver_edge_fn",
            uploaded_at: nowIso,
            processed_at: nowIso,
            notes: JSON.stringify({
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              from: fromHeader,
              date: dateHeader,
              archive_query: archiveQuery,
              mode: "v2",
              attachment_count: 0,
            }),
          });
          archivedMessageIds.push(msgId);
          continue;
        }

        // Process each attachment in turn.
        const perAttachmentRows: any[] = [];
        for (const att of attachments) {
          // Size cap
          if (typeof att.sizeBytes === "number" && att.sizeBytes > MAX_ATTACHMENT_BYTES) {
            totalAttachmentsSkippedSize += 1;
            perAttachmentRows.push({
              agency_id: agencyId,
              file_name: att.filename.slice(0, 300),
              file_type: att.mimeType || "application/octet-stream",
              upload_source: "email_archiver",
              processing_status: "skipped_too_large",
              processing_type: "attachment_skipped",
              groq_classification: null,
              drive_file_id: null,
              drive_url: null,
              drive_folder_path: null,
              uploaded_by: "email_archiver_edge_fn",
              uploaded_at: nowIso,
              processed_at: nowIso,
              notes: JSON.stringify({
                gmail_message_id: msgId,
                gmail_thread_id: threadId,
                from: fromHeader,
                date: dateHeader,
                attachment_id: att.attachmentId,
                size_bytes: att.sizeBytes,
                size_limit_bytes: MAX_ATTACHMENT_BYTES,
                mode: "v2",
                skip_reason: "attachment exceeds 5MB simple-upload cap; V2.1 will use resumable upload",
              }),
            });
            continue;
          }

          // Classify
          const category = classifyAttachment({
            filename: att.filename,
            sender: fromHeader,
            subject,
          });

          // Resolve folder
          const folderPath = `${DRIVE_ROOT_FOLDER_NAME}/${DRIVE_DOCS_FOLDER_NAME}/${yyyymm}/${category}`;
          const segments = [DRIVE_ROOT_FOLDER_NAME, DRIVE_DOCS_FOLDER_NAME, yyyymm, category];
          const folderId = await ensureDriveFolderPath({
            apiKey: composioApiKey,
            userId: composioUserId,
            connectedAccountId: driveAccountId as string,
            segments,
            cache: folderCache,
          });

          // Stage the binary in Composio S3
          const dlRes = await callComposio({
            apiKey: composioApiKey,
            userId: composioUserId,
            connectedAccountId: gmailAccountId,
            toolSlug: "GMAIL_GET_ATTACHMENT",
            toolArguments: {
              message_id: msgId,
              attachment_id: att.attachmentId,
              file_name: att.filename,
            },
          });
          if (!dlRes.ok) {
            throw new Error(`GMAIL_GET_ATTACHMENT failed for "${att.filename}" (http=${dlRes.httpStatus}): ${dlRes.error}`);
          }
          const fileObj: any = dlRes.data?.file || dlRes.data || {};
          const mimetypeFromDl: string | undefined = fileObj?.mimetype;
          // NOTE (V2.2 fix, 2026-06-17): The Composio GMAIL_GET_ATTACHMENT
          // runtime now returns `s3url` (a presigned R2 URL) instead of the
          // legacy `s3key`. The downstream GOOGLEDRIVE_UPLOAD_FILE still
          // expects `s3key`, so derive it by stripping the host and query
          // string from the URL. Falls back to legacy `s3key` if present.
          // Verified empirically against ca_p2KPGeQnUiBs on 2026-06-17.
          let s3key: string | undefined = fileObj?.s3key;
          const s3url: string | undefined = fileObj?.s3url;
          if (!s3key && s3url) {
            try {
              s3key = new URL(s3url).pathname.replace(/^\//, "");
            } catch {
              // fall through to the error below
            }
          }
          if (!s3key) {
            throw new Error(`GMAIL_GET_ATTACHMENT returned ok but no s3key or s3url for "${att.filename}". Raw: ${dlRes.raw.slice(0, 200)}`);
          }

          // Upload to Drive
          const uploadMimetype = mimetypeFromDl || att.mimeType || "application/octet-stream";
          const upRes = await callComposio({
            apiKey: composioApiKey,
            userId: composioUserId,
            connectedAccountId: driveAccountId as string,
            toolSlug: "GOOGLEDRIVE_UPLOAD_FILE",
            toolArguments: {
              file_to_upload: {
                name: att.filename,
                mimetype: uploadMimetype,
                s3key,
              },
              folder_to_upload_to: folderId,
            },
          });
          if (!upRes.ok) {
            throw new Error(`GOOGLEDRIVE_UPLOAD_FILE failed for "${att.filename}" -> ${folderPath} (http=${upRes.httpStatus}): ${upRes.error}`);
          }
          const upData: any = upRes.data || {};
          const driveFileId: string | undefined = upData?.id || upData?.data?.id;
          if (!driveFileId) {
            throw new Error(`GOOGLEDRIVE_UPLOAD_FILE returned ok but no file id for "${att.filename}". Raw: ${upRes.raw.slice(0, 200)}`);
          }
          const driveUrl: string =
            upData?.webViewLink ||
            upData?.data?.webViewLink ||
            `https://drive.google.com/file/d/${driveFileId}/view`;

          totalAttachmentsUploaded += 1;
          perAttachmentRows.push({
            agency_id: agencyId,
            file_name: att.filename.slice(0, 300),
            file_type: uploadMimetype,
            upload_source: "email_archiver",
            processing_status: "archived",
            processing_type: "attachment_routed_to_drive",
            groq_classification: category,
            drive_file_id: driveFileId,
            drive_url: driveUrl,
            drive_folder_path: folderPath,
            uploaded_by: "email_archiver_edge_fn",
            uploaded_at: nowIso,
            processed_at: nowIso,
            notes: JSON.stringify({
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              from: fromHeader,
              date: dateHeader,
              subject: subject.slice(0, 300),
              attachment_id: att.attachmentId,
              attachment_mime_type: att.mimeType,
              attachment_size_bytes: att.sizeBytes,
              archive_query: archiveQuery,
              mode: "v2",
              category,
              drive_folder_id: folderId,
            }),
          });
        }

        // All attachments for this message processed successfully → eligible
        // for label-modify. Buffer the rows for batch insert.
        docRowsV2.push(...perAttachmentRows);
        archivedMessageIds.push(msgId);
      } catch (perMsgErr) {
        const em = perMsgErr instanceof Error ? perMsgErr.message : String(perMsgErr);
        perMessageErrors.push({ messageId: msgId, error: em });
        // Do NOT add to archivedMessageIds — message stays in inbox for next run.
      }
    }

    // --- Step N-1: per-message label-modify for each successfully processed message.
    // NOTE (V2.3 fix, 2026-06-17): GMAIL_BATCH_MODIFY_MESSAGES returns HTTP 404
    // "Tool not found" via the v3 execute endpoint, despite being documented as
    // available — the slug appears unrouted in the Composio project this
    // function's API key is scoped to (workbench access works, raw v3 execute
    // does not). Until that's resolved, the per-message GMAIL_ADD_LABEL_TO_EMAIL
    // slug (which is routable) is called in a loop. Per-message errors are
    // aggregated; modifyError is set only if at least one call failed.
    let modifyError: string | null = null;
    const modifyFailures: Array<{ messageId: string; error: string }> = [];
    if (archivedMessageIds.length > 0) {
      const addLabels: string[] = addArchiveLabelId ? [addArchiveLabelId] : [];
      const removeLabels: string[] = ["INBOX"];
      for (const mid of archivedMessageIds) {
        const modRes = await callComposio({
          apiKey: composioApiKey,
          userId: composioUserId,
          connectedAccountId: gmailAccountId,
          toolSlug: "GMAIL_ADD_LABEL_TO_EMAIL",
          toolArguments: {
            message_id: mid,
            add_label_ids: addLabels,
            remove_label_ids: removeLabels,
          },
        });
        if (!modRes.ok) {
          modifyFailures.push({ messageId: mid, error: `http=${modRes.httpStatus}: ${modRes.error}` });
        }
      }
      if (modifyFailures.length > 0) {
        modifyError = `GMAIL_ADD_LABEL_TO_EMAIL failed for ${modifyFailures.length}/${archivedMessageIds.length} messages: ` +
          modifyFailures.slice(0, 3).map((f) => `${f.messageId}=${f.error}`).join("; ");
      }
    }

    // --- Step N: bulk insert documents rows
    let docsInserted = 0;
    let docsInsertError: string | null = null;
    if (docRowsV2.length > 0) {
      const { data: insertedDocs, error: docErr } = await sb
        .from("documents")
        .insert(docRowsV2)
        .select("id");
      if (docErr) {
        docsInsertError = docErr.message;
      } else {
        docsInserted = (insertedDocs?.length ?? 0);
      }
    }

    // --- Final summary
    const summaryParts: string[] = [];
    summaryParts.push(`V2: ${archivedMessageIds.length}/${messageIds.length} messages archived`);
    if (skippedMessageIds.length > 0) summaryParts.push(`${skippedMessageIds.length} already-archived (idempotent skip)`);
    if (perMessageErrors.length > 0) summaryParts.push(`${perMessageErrors.length} per-message errors`);
    summaryParts.push(`${totalAttachmentsUploaded} attachments uploaded to Drive`);
    if (totalAttachmentsSkippedSize > 0) summaryParts.push(`${totalAttachmentsSkippedSize} attachments skipped (>5MB)`);
    summaryParts.push(`${docsInserted} documents rows written`);
    if (modifyError) summaryParts.push(`batch-modify error: ${modifyError}`);
    if (docsInsertError) summaryParts.push(`documents insert error: ${docsInsertError}`);
    const summary = summaryParts.join("; ");

    // Run is "success" if we made any forward progress AND there's no
    // catastrophic batch-level failure. Per-message errors are reported
    // in the summary but don't fail the run; messages stay in inbox.
    const runStatus: "success" | "failed" =
      (modifyError || docsInsertError) ? "failed" : "success";
    await writeOutcome(runStatus, archivedMessageIds.length, summary, modifyError || docsInsertError);

    return jsonResponse({
      ok: runStatus === "success",
      recipe_id: recipeId,
      recipe_name: recipe.recipe_name,
      status: runStatus,
      records_processed: archivedMessageIds.length,
      mode: "v2",
      archive_query: archiveQuery,
      messages_seen: messageIds.length,
      messages_archived: archivedMessageIds.length,
      messages_already_archived: skippedMessageIds.length,
      attachments_uploaded: totalAttachmentsUploaded,
      attachments_skipped_size: totalAttachmentsSkippedSize,
      documents_inserted: docsInserted,
      documents_insert_error: docsInsertError,
      modify_error: modifyError,
      per_message_errors: perMessageErrors,
      output_summary: summary,
    }, runStatus === "success" ? 200 : 500);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeOutcome("failed", 0, `Failed: ${msg.slice(0, 200)}`, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
