// =========================================================================
// document-processor  (BCC Master Template — multi-step Composio orchestration)
// =========================================================================
// PURPOSE: Process incoming statement-style emails for a fixed document
//   category (bank statements, credit card statements, payroll, etc.) —
//   extract attachments, route them to BCC/Documents/YYYY-MM/<fixed_category>/
//   in Google Drive, log one documents row per attachment, then archive the
//   source email (label_modify remove INBOX) so it doesn't get re-processed.
//
//   This is a *sibling* to email-archiver, not a successor. email-archiver
//   classifies attachments by rule (filename/sender/subject); this function
//   uses the recipe's input_config.fixed_category and skips classification.
//   It's invoked by per-recipe plpgsql dispatchers
//   (dispatch_bank_statement_processor, etc.) — one dispatcher per recipe.
//
// =========================================================================
// SHARED CONCERNS WITH email-archiver  (keep these in sync across both files)
//   - Auth: shared_secret in body, validated against
//     settings.automation_runner_cron_secret
//   - Drive folder convention: BCC/Documents/YYYY-MM/<category>/ where
//     YYYY-MM comes from the Gmail message.internalDate (UTC).
//     Root folder "BCC" must be operator-created; intermediates auto-create.
//     See docs/DRIVE_FOLDER_SETUP.md §1–§3.
//   - documents row shape: same columns, same notes-as-stringified-JSON
//     convention, gmail_message_id embedded in notes for the idempotency
//     probe to find on a second run.
//   - Idempotency probe: ILIKE substring match on documents.notes for
//     "gmail_message_id":"<id>" — if already archived for this agency,
//     skip without re-processing or re-labeling.
//   - Per-message try/catch: a single bad message MUST NOT poison the
//     whole batch. Failed messages stay in inbox; only successful
//     messages get batched into the final label-modify call.
//   - Drive size cap: 5MB simple-upload limit for V2.0; over-cap
//     attachments produce a `processing_status='skipped_too_large'`
//     documents row with size + reason in notes.
//   - upload_source field distinguishes the two: "email_archiver" vs
//     "document_processor". Useful for dashboards filtering by source.
//
// =========================================================================
// SCOPE (this function, V1.0):
//   1. Validate shared_secret against settings.automation_runner_cron_secret
//   2. Load recipe + input_config (query, max_results, fixed_category)
//   3. GMAIL_FETCH_EMAILS with ids_only=true using input_config.query verbatim
//   4. For each matched message:
//      - Idempotency probe; skip if already in documents
//      - GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID full payload
//      - Walk attachments; for each:
//        - Skip if > 5MB (logged as `skipped_too_large` documents row)
//        - Resolve folder BCC/Documents/<YYYY-MM>/<fixed_category>/
//        - GMAIL_GET_ATTACHMENT → s3key in Composio staging
//        - GOOGLEDRIVE_UPLOAD_FILE → final Drive file
//        - Stage a documents row (processing_type='attachment_routed_to_drive')
//      - Messages with no attachments still get one row
//        (processing_type='label_modification')
//   5. GMAIL_BATCH_MODIFY_MESSAGES (remove INBOX) for messages where every
//      attachment processed end-to-end successfully.
//   6. Bulk insert documents rows.
//   7. Write one automation_run_log row + update recipes.last_run_status.
//
// =========================================================================
// FUTURE WORK (intentional V1.0 limits):
//   - V1.1: switch >5MB attachments to GOOGLEDRIVE_RESUMABLE_UPLOAD.
//   - V1.2: optionally parse attachments into recipe-specific
//     output_table (journal_entries, payroll_runs, etc.) via Groq. Today
//     the documents row is the terminal artifact; downstream parsing is
//     a separate recipe.
//   - V1.3: per-recipe priority field to resolve multi-Processor query
//     overlap. For V1.0 we accept first-Processor-wins (S14 design note).
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

// Canonical from docs/DRIVE_FOLDER_SETUP.md §1.
const DRIVE_ROOT_FOLDER_NAME = "BCC";
const DRIVE_DOCS_FOLDER_NAME = "Documents";

// V1.0 simple-upload cap. Attachments larger than this are skipped with a
// logged reason; V1.1 will route them through GOOGLEDRIVE_RESUMABLE_UPLOAD.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Allow-list for fixed_category. Keep in lock-step with the rule-based
// categories returned by email-archiver's classifyAttachment(). New
// categories require a docs/DRIVE_FOLDER_SETUP.md §2 update.
const ALLOWED_FIXED_CATEGORIES = new Set<string>([
  "bank_statements",
  "credit_card_statements",
  "deductions",
  "comp_recap",
  "payroll",
  "production_reports",
  "team_production",
  "commission_reports",
  "receipts",
  "contracts",
  "archive_bundles",
  "general",
]);

// -------------------------------------------------------------------------
// HTTP helpers — IDENTICAL to email-archiver. If you change the shape here,
// change it there too. See header §"SHARED CONCERNS".
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
// Helpers — IDENTICAL to email-archiver. See header §"SHARED CONCERNS".
// -------------------------------------------------------------------------

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
 * Walk a Gmail message payload (tree of MIME parts) and extract every
 * attachment. Inline attachments and parts without an attachmentId are skipped.
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
 * row whose `notes` references this gmail_message_id for this agency.
 * Substring match keeps it index-free; documents.notes is stringified JSON.
 */
async function isAlreadyProcessed(agencyId: string, gmailMessageId: string): Promise<boolean> {
  const needle = `"gmail_message_id":"${gmailMessageId}"`;
  const { data, error } = await sb
    .from("documents")
    .select("id")
    .eq("agency_id", agencyId)
    .ilike("notes", `%${needle}%`)
    .limit(1);
  if (error) {
    console.error(`isAlreadyProcessed probe failed for ${gmailMessageId}: ${error.message}`);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Folder resolver with per-run cache. Given a desired absolute path under
 * the Drive root, returns the Drive folder ID for the deepest segment.
 * Creates intermediate segments on demand EXCEPT the root segment "BCC",
 * which must be operator-created per docs/DRIVE_FOLDER_SETUP.md §3.1.
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

  let parentId: string | null = null;
  let accumulatedPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segName = segments[i];
    accumulatedPath = i === 0 ? segName : `${accumulatedPath}/${segName}`;

    const cached = cache.get(accumulatedPath);
    if (cached) {
      parentId = cached;
      continue;
    }

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

    let files: any[] = [];
    const d: any = findRes.data;
    if (Array.isArray(d?.files)) files = d.files;
    else if (Array.isArray(d?.data?.files)) files = d.data.files;

    const matches = files.filter((f: any) =>
      f && f.mimeType === "application/vnd.google-apps.folder" &&
      typeof f.name === "string" && f.name === segName &&
      f.trashed !== true
    );

    let folderId: string | null = matches[0]?.id || null;

    if (!folderId) {
      if (i === 0) {
        throw new Error(
          `Drive root folder "${DRIVE_ROOT_FOLDER_NAME}" not found in the connected Google Drive. ` +
          `Per docs/DRIVE_FOLDER_SETUP.md §3.1 the owner must create this folder before activating ` +
          `attachment-to-Drive routing.`
        );
      }

      const createArgs: Record<string, any> = { name: segName };
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

  // Helper to write the run log + recipe status, always once at the end.
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
    // ---------------------------------------------------------------------
    // Read & validate input_config
    // ---------------------------------------------------------------------
    const ic = (recipe.input_config || {}) as Record<string, any>;

    const query: string = typeof ic.query === "string" && ic.query.trim()
      ? ic.query.trim()
      : "";
    if (!query) {
      throw new Error(`Recipe ${recipeId} (${recipe.recipe_name}) has no input_config.query. document-processor recipes require a Gmail query string.`);
    }

    const maxPerRun = Math.min(Math.max(Number(ic.max_results ?? ic.max_per_run ?? 25), 1), 500);

    const fixedCategory: string = typeof ic.fixed_category === "string"
      ? ic.fixed_category.trim()
      : "";
    if (!fixedCategory) {
      throw new Error(`Recipe ${recipeId} (${recipe.recipe_name}) has no input_config.fixed_category. document-processor recipes require a category from docs/DRIVE_FOLDER_SETUP.md §2.`);
    }
    if (!ALLOWED_FIXED_CATEGORIES.has(fixedCategory)) {
      throw new Error(
        `Recipe ${recipeId} (${recipe.recipe_name}) uses fixed_category="${fixedCategory}", which is not in the canonical category set. ` +
        `Allowed: ${Array.from(ALLOWED_FIXED_CATEGORIES).sort().join(", ")}. ` +
        `To add a category, update docs/DRIVE_FOLDER_SETUP.md §2 and ALLOWED_FIXED_CATEGORIES in document-processor/index.ts AND email-archiver/index.ts (classifyAttachment).`
      );
    }

    // Whether to archive source emails after successful processing.
    // Defaults to true (operator decision recorded in S14 handoff).
    const archiveAfterProcessing: boolean = ic.archive_after_processing !== false;

    const addArchiveLabelId: string | null = typeof ic.add_archive_label_id === "string" && ic.add_archive_label_id.trim()
      ? ic.add_archive_label_id.trim()
      : null;

    // ---------------------------------------------------------------------
    // Credentials
    // ---------------------------------------------------------------------
    const composioApiKey = await getSetting(agencyId, "composio_api_key");
    if (!composioApiKey) throw new Error(`Missing composio_api_key in Vault/settings for agency ${agencyId}`);
    const composioUserId = await getSetting(agencyId, "composio_user_id");
    if (!composioUserId) throw new Error(`Missing composio_user_id for agency ${agencyId}`);
    const gmailAccountId = await getSetting(agencyId, "composio_gmail_account_id");
    if (!gmailAccountId) throw new Error(`Missing composio_gmail_account_id for agency ${agencyId}`);
    const driveAccountId = await getSetting(agencyId, "composio_googledrive_account_id");
    if (!driveAccountId) {
      throw new Error(
        `Missing composio_googledrive_account_id for agency ${agencyId}. ` +
        `document-processor always routes attachments to Drive. ` +
        `See docs/DRIVE_FOLDER_SETUP.md §3.4.`
      );
    }

    // ---------------------------------------------------------------------
    // Step 1: fetch matching message IDs
    // ---------------------------------------------------------------------
    const fetchResult = await callComposio({
      apiKey: composioApiKey,
      userId: composioUserId,
      connectedAccountId: gmailAccountId,
      toolSlug: "GMAIL_FETCH_EMAILS",
      toolArguments: {
        query,
        max_results: maxPerRun,
        ids_only: true,
        verbose: false,
        include_payload: false,
      },
    });

    if (!fetchResult.ok) {
      throw new Error(`GMAIL_FETCH_EMAILS failed (http=${fetchResult.httpStatus}): ${fetchResult.error}`);
    }

    const messages: any[] = Array.isArray(fetchResult.data?.messages) ? fetchResult.data.messages : [];

    if (messages.length === 0) {
      const summary = `0 emails match query "${query}". Nothing to process. (fixed_category=${fixedCategory})`;
      await writeOutcome("success", 0, summary, null);
      return jsonResponse({
        ok: true,
        recipe_id: recipeId,
        recipe_name: recipe.recipe_name,
        status: "success",
        records_processed: 0,
        query,
        fixed_category: fixedCategory,
        output_summary: summary,
      }, 200);
    }

    const messageIds: string[] = messages
      .map((m: any) => m?.messageId || m?.id)
      .filter((id: any) => typeof id === "string" && id.length > 0);

    if (messageIds.length === 0) {
      throw new Error(`GMAIL_FETCH_EMAILS returned ${messages.length} messages but none had a messageId field. Sample: ${JSON.stringify(messages[0]).slice(0, 200)}`);
    }

    // ---------------------------------------------------------------------
    // Step 2: per-message processing — fetch payload, route attachments
    // ---------------------------------------------------------------------
    const folderCache = new Map<string, string>();
    const nowIso = new Date().toISOString();

    const docRows: any[] = [];
    const processedMessageIds: string[] = [];
    const skippedMessageIds: string[] = []; // already processed (idempotent)
    const perMessageErrors: Array<{ messageId: string; error: string }> = [];
    let totalAttachmentsUploaded = 0;
    let totalAttachmentsSkippedSize = 0;

    for (const msgId of messageIds) {
      try {
        if (await isAlreadyProcessed(agencyId, msgId)) {
          skippedMessageIds.push(msgId);
          continue;
        }

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

        const attachments = walkAttachments(message?.payload || {});

        if (attachments.length === 0) {
          // No attachments: log a label_modification row so the idempotency
          // probe will skip the message on the next run. This matches the
          // shape email-archiver writes for zero-attachment messages.
          docRows.push({
            agency_id: agencyId,
            file_name: subject.slice(0, 300),
            file_type: "email",
            upload_source: "document_processor",
            processing_status: "archived",
            processing_type: "label_modification",
            uploaded_by: "document_processor_edge_fn",
            uploaded_at: nowIso,
            processed_at: nowIso,
            notes: JSON.stringify({
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              from: fromHeader,
              date: dateHeader,
              query,
              fixed_category: fixedCategory,
              attachment_count: 0,
              recipe_name: recipe.recipe_name,
            }),
          });
          processedMessageIds.push(msgId);
          continue;
        }

        // Process each attachment.
        const perAttachmentRows: any[] = [];
        for (const att of attachments) {
          if (typeof att.sizeBytes === "number" && att.sizeBytes > MAX_ATTACHMENT_BYTES) {
            totalAttachmentsSkippedSize += 1;
            perAttachmentRows.push({
              agency_id: agencyId,
              file_name: att.filename.slice(0, 300),
              file_type: att.mimeType || "application/octet-stream",
              upload_source: "document_processor",
              processing_status: "skipped_too_large",
              processing_type: "attachment_skipped",
              groq_classification: fixedCategory,
              drive_file_id: null,
              drive_url: null,
              drive_folder_path: null,
              uploaded_by: "document_processor_edge_fn",
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
                fixed_category: fixedCategory,
                recipe_name: recipe.recipe_name,
                skip_reason: "attachment exceeds 5MB simple-upload cap; V1.1 will use resumable upload",
              }),
            });
            continue;
          }

          // Resolve folder for fixed_category.
          const folderPath = `${DRIVE_ROOT_FOLDER_NAME}/${DRIVE_DOCS_FOLDER_NAME}/${yyyymm}/${fixedCategory}`;
          const segments = [DRIVE_ROOT_FOLDER_NAME, DRIVE_DOCS_FOLDER_NAME, yyyymm, fixedCategory];
          const folderId = await ensureDriveFolderPath({
            apiKey: composioApiKey,
            userId: composioUserId,
            connectedAccountId: driveAccountId as string,
            segments,
            cache: folderCache,
          });

          // Stage in Composio S3.
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
          const s3key: string | undefined = fileObj?.s3key;
          const mimetypeFromDl: string | undefined = fileObj?.mimetype;
          if (!s3key) {
            throw new Error(`GMAIL_GET_ATTACHMENT returned ok but no s3key for "${att.filename}". Raw: ${dlRes.raw.slice(0, 200)}`);
          }

          // Upload to Drive.
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
            upload_source: "document_processor",
            processing_status: "archived",
            processing_type: "attachment_routed_to_drive",
            groq_classification: fixedCategory,
            drive_file_id: driveFileId,
            drive_url: driveUrl,
            drive_folder_path: folderPath,
            uploaded_by: "document_processor_edge_fn",
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
              query,
              fixed_category: fixedCategory,
              drive_folder_id: folderId,
              recipe_name: recipe.recipe_name,
            }),
          });
        }

        // All attachments for this message processed → eligible for archive.
        docRows.push(...perAttachmentRows);
        processedMessageIds.push(msgId);
      } catch (perMsgErr) {
        const em = perMsgErr instanceof Error ? perMsgErr.message : String(perMsgErr);
        perMessageErrors.push({ messageId: msgId, error: em });
      }
    }

    // ---------------------------------------------------------------------
    // Step 3: batch label-modify only successful messages (if enabled)
    // ---------------------------------------------------------------------
    let modifyError: string | null = null;
    if (archiveAfterProcessing && processedMessageIds.length > 0) {
      const addLabels: string[] = addArchiveLabelId ? [addArchiveLabelId] : [];
      const removeLabels: string[] = ["INBOX"];
      const modifyResult = await callComposio({
        apiKey: composioApiKey,
        userId: composioUserId,
        connectedAccountId: gmailAccountId,
        toolSlug: "GMAIL_BATCH_MODIFY_MESSAGES",
        toolArguments: {
          messageIds: processedMessageIds,
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        },
      });
      if (!modifyResult.ok) {
        modifyError = `GMAIL_BATCH_MODIFY_MESSAGES failed (http=${modifyResult.httpStatus}): ${modifyResult.error}`;
      }
    }

    // ---------------------------------------------------------------------
    // Step 4: bulk insert documents rows
    // ---------------------------------------------------------------------
    let docsInserted = 0;
    let docsInsertError: string | null = null;
    if (docRows.length > 0) {
      const { data: insertedDocs, error: docErr } = await sb
        .from("documents")
        .insert(docRows)
        .select("id");
      if (docErr) {
        docsInsertError = docErr.message;
      } else {
        docsInserted = (insertedDocs?.length ?? 0);
      }
    }

    // ---------------------------------------------------------------------
    // Step 5: summary + outcome
    // ---------------------------------------------------------------------
    const summaryParts: string[] = [];
    summaryParts.push(`${processedMessageIds.length}/${messageIds.length} messages processed (fixed_category=${fixedCategory})`);
    if (skippedMessageIds.length > 0) summaryParts.push(`${skippedMessageIds.length} already-processed (idempotent skip)`);
    if (perMessageErrors.length > 0) summaryParts.push(`${perMessageErrors.length} per-message errors`);
    summaryParts.push(`${totalAttachmentsUploaded} attachments uploaded to Drive`);
    if (totalAttachmentsSkippedSize > 0) summaryParts.push(`${totalAttachmentsSkippedSize} attachments skipped (>5MB)`);
    summaryParts.push(`${docsInserted} documents rows written`);
    if (!archiveAfterProcessing) summaryParts.push(`archive_after_processing=false (source emails left in inbox)`);
    if (modifyError) summaryParts.push(`batch-modify error: ${modifyError}`);
    if (docsInsertError) summaryParts.push(`documents insert error: ${docsInsertError}`);
    const summary = summaryParts.join("; ");

    const runStatus: "success" | "failed" =
      (modifyError || docsInsertError) ? "failed" : "success";
    await writeOutcome(runStatus, processedMessageIds.length, summary, modifyError || docsInsertError);

    return jsonResponse({
      ok: runStatus === "success",
      recipe_id: recipeId,
      recipe_name: recipe.recipe_name,
      status: runStatus,
      records_processed: processedMessageIds.length,
      query,
      fixed_category: fixedCategory,
      archive_after_processing: archiveAfterProcessing,
      messages_seen: messageIds.length,
      messages_processed: processedMessageIds.length,
      messages_already_processed: skippedMessageIds.length,
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
