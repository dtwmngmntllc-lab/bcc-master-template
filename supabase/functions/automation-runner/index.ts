// =========================================================================
// automation-runner  (BCC Master Template)
// =========================================================================
// PURPOSE: Generic executor for any row in the automation_recipes table.
//   Triggered by:
//     (a) pg_cron tick via run_due_automation_recipes() in migration 011, or
//     (b) manual call from the Automations module in the BCC web app via
//         the run_automation_recipe(uuid) RPC.
//
//   For each invocation:
//     1. Load the recipe row by recipe_id (resolves agency_id)
//     2. Auth via shared_secret (matches settings.automation_runner_cron_secret
//        for the recipe's agency)
//     3. Mark the recipe as "running" (sets last_run_at to NOW())
//     4. Resolve Composio credentials from settings (agency-scoped)
//     5. Call the recipe's composio_action with input_config arguments
//     6. If groq_prompt is set AND the Composio response contains data,
//        post the result data through the Composio-hosted LLM
//        (COMPOSIO_SEARCH_GROQ_CHAT) for structured extraction. NO separate
//        Groq API key required — auth is via the existing composio_api_key.
//     7. Write parsed records to the recipe's output_table per output_config
//     8. Write a row to automation_run_log
//     9. Update the recipe's last_run_status
//    10. Telegram alert on failure (if Telegram creds present)
//
// S8/S9 PATCH (v3): the run-log summary for zero-record completions now
//   honestly distinguishes (a) Composio returned 0 items / LLM skipped from
//   (b) LLM ran and returned no parseable records from (c) shape didn't fit.
//   The prior v2 summary text conflated (a) and (b), making it look like LLM
//   calls were being burned when they weren't. No behavior change.
//
// PATTERN: Mirrors the Composio call shape in gmail-inbox-archiver and the
//   auth/log/Telegram structure in linkedin-poster from the Imaginary Farms
//   ops project. Same proven pattern, generalized over the recipe row, and
//   adapted for the master template's settings table (key/value, scoped by
//   agency_id) instead of the ops project's brand_kit table.
//
// CREDENTIALS (resolved via public.get_setting RPC — Vault first, then
// public.settings, scoped by agency_id):
//   automation_runner_cron_secret  - random secret, also referenced by mig 011
//                                    (typically settings)
//   composio_api_key               - Composio API key (typically Vault)
//   composio_user_id               - Composio user ID for this agency
//                                    (typically settings; identifier, not secret)
//   composio_<conn>_account_id     - one per connection used by recipes;
//                                    e.g. composio_gmail_account_id,
//                                    composio_facebook_account_id, etc.
//                                    (typically settings)
//   telegram_bot_token             - OPTIONAL; failure alerts only (typically Vault)
//   telegram_chat_id               - OPTIONAL; failure alerts only (typically settings)
//
// AUTH:
//   verify_jwt = false
//   POST body must contain shared_secret matching the agency's
//   automation_runner_cron_secret in settings. Body must also contain a
//   recipe_id; the function loads that recipe to resolve the agency_id
//   used for the credential lookup.
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
// LLM calls now route through Composio's hosted Groq chat tool.
// Auth uses composio_api_key — NO separate groq_api_key needed.
const COMPOSIO_LLM_TOOL = "COMPOSIO_SEARCH_GROQ_CHAT";
const LLM_MODEL_DEFAULT = "llama-3.3-70b-versatile";

function stripFences(s: string): string {
  return s.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Return true when a Composio tool response has no actionable data, so
 * the LLM-parsing pass can be skipped. Treats common collection-shaped
 * responses (messages/items/results/data arrays) as empty when their
 * array length is zero. Conservative on unknown shapes — returns false
 * so the LLM call still happens for recipes whose response_data doesn't
 * use one of the recognized collection keys.
 */
function isEmptyComposioData(d: any): boolean {
  if (d === null || d === undefined) return true;
  if (Array.isArray(d)) return d.length === 0;
  if (typeof d === "object") {
    for (const key of ["messages", "items", "results", "data"]) {
      if (Array.isArray((d as any)[key])) {
        return (d as any)[key].length === 0;
      }
    }
    return false;
  }
  return false;
}

// --- helpers ------------------------------------------------------------

/**
 * Read a credential, scoped to the given agency, via the Vault-aware
 * public.get_setting RPC (introduced in migration 011a). The RPC resolves
 * Vault first, then falls back to public.settings, so secrets stored in
 * Vault (e.g. composio_api_key) are returned transparently to callers.
 * Returns null if neither Vault nor public.settings has a value.
 */
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

async function telegram(agencyId: string | null, text: string): Promise<void> {
  if (!agencyId) return; // no agency context — can't look up creds
  const botToken = await getSetting(agencyId, "telegram_bot_token");
  const chatId = await getSetting(agencyId, "telegram_chat_id");
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (_e) { /* Telegram failures are non-fatal */ }
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function callComposio(opts: {
  apiKey: string;
  userId: string;
  connectedAccountId: string;
  toolSlug: string;
  toolArguments: Record<string, any>;
}): Promise<{ ok: boolean; data: any; error: string | null; httpStatus: number }> {
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
  return { ok, data, error, httpStatus: res.status };
}

async function callComposioLLM(opts: {
  composioApiKey: string;
  composioUserId: string;
  systemPrompt: string;
  userContent: string;
  model?: string;
  maxTokens?: number;
}): Promise<{ ok: boolean; data: any; error: string | null }> {
  // COMPOSIO_SEARCH_GROQ_CHAT is part of the composio_search toolkit
  // (no separate auth/connection needed beyond composio_api_key).
  // Schema does NOT expose response_format — system prompt MUST demand raw JSON
  // and we MUST strip code fences before JSON.parse.
  const body = {
    user_id: opts.composioUserId,
    arguments: {
      messages: [
        {
          role: "system",
          content: opts.systemPrompt +
            "\n\nReturn ONLY a raw JSON object. No markdown. No code fences. No prose before or after the JSON.",
        },
        { role: "user", content: opts.userContent },
      ],
      model: opts.model ?? LLM_MODEL_DEFAULT,
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 4096,
    },
  };

  // Retry on 429/5xx with exponential backoff, max 3 attempts.
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${COMPOSIO_BASE}/${COMPOSIO_LLM_TOOL}`, {
      method: "POST",
      headers: {
        "x-api-key": opts.composioApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(500 * Math.pow(2, attempt));
      continue;
    }
    const text = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (!res.ok) {
      lastErr = parsed?.error?.message || parsed?.error || text.slice(0, 400);
      return { ok: false, data: null, error: lastErr };
    }
    if (!parsed?.successful) {
      lastErr = parsed?.error || "Composio LLM call unsuccessful";
      return { ok: false, data: null, error: lastErr };
    }
    const choice = parsed?.data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      return { ok: false, data: null, error: "Composio LLM returned empty content" };
    }
    if (choice?.finish_reason === "length") {
      console.warn("[callComposioLLM] finish_reason=length — output may be truncated");
    }
    const cleaned = stripFences(content);
    let extracted: any;
    try { extracted = JSON.parse(cleaned); }
    catch (e) {
      return {
        ok: false,
        data: null,
        error: `LLM response was not valid JSON after fence-stripping: ${(e as Error).message}`,
      };
    }
    return { ok: true, data: extracted, error: null };
  }
  return { ok: false, data: null, error: `LLM call exhausted retries: ${lastErr}` };
}

/**
 * Resolve the Composio connected_account_id for a given connection slug.
 * Recipes specify composio_connection like "gmail" or "facebook"; this maps
 * to the corresponding settings key for the given agency.
 */
async function getComposioAccountId(agencyId: string, connection: string): Promise<string> {
  const key = `composio_${connection.toLowerCase()}_account_id`;
  const v = await getSetting(agencyId, key);
  if (!v) {
    throw new Error(
      `Missing settings credential: ${key} (agency ${agencyId}). The agent's Composio account for "${connection}" must be authorized and its account ID stored. See docs/AUTOMATIONS_INSTALL.md Step 3.`,
    );
  }
  return v;
}

/**
 * Write a parsed record array to the recipe's output_table, honoring
 * output_config.unique_on (column list for ON CONFLICT) and on_conflict
 * (update | ignore).
 */
async function writeOutput(opts: {
  outputTable: string;
  outputConfig: any;
  records: any[];
  agencyId: string | null;
}): Promise<{ inserted: number; updated: number }> {
  if (!Array.isArray(opts.records) || opts.records.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  // Stamp agency_id on every record if the table has the column and the recipe
  // belongs to an agency. We let the actual insert fail if the column doesn't
  // exist; that surfaces in the error_message in the run log.
  const records = opts.agencyId
    ? opts.records.map((r) => ({ agency_id: opts.agencyId, ...r }))
    : opts.records;

  const uniqueOn: string[] | undefined = opts.outputConfig?.unique_on;
  const onConflict: string = opts.outputConfig?.on_conflict || "ignore";

  if (uniqueOn && uniqueOn.length > 0 && onConflict === "update") {
    const { data, error } = await sb
      .from(opts.outputTable)
      .upsert(records, { onConflict: uniqueOn.join(","), ignoreDuplicates: false })
      .select("id");
    if (error) throw new Error(`upsert to ${opts.outputTable} failed: ${error.message}`);
    return { inserted: data?.length ?? 0, updated: 0 }; // Upsert doesn't distinguish
  }

  if (uniqueOn && uniqueOn.length > 0) {
    // ignore-on-conflict
    const { data, error } = await sb
      .from(opts.outputTable)
      .upsert(records, { onConflict: uniqueOn.join(","), ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`insert to ${opts.outputTable} failed: ${error.message}`);
    return { inserted: data?.length ?? 0, updated: 0 };
  }

  // No unique constraint specified — plain insert
  const { data, error } = await sb
    .from(opts.outputTable)
    .insert(records)
    .select("id");
  if (error) throw new Error(`insert to ${opts.outputTable} failed: ${error.message}`);
  return { inserted: data?.length ?? 0, updated: 0 };
}

// --- core executor ------------------------------------------------------

async function executeRecipe(
  recipe: any,
  triggeredBy: string,
): Promise<any> {
  const started = Date.now();
  const recipeId = recipe.id as string;
  const agencyId = recipe.agency_id as string;

  // Optimistic concurrency lock: stamp last_run_at so the next pg_cron tick
  // won't re-fire this recipe in the same minute.
  await sb
    .from("automation_recipes")
    .update({ last_run_at: new Date().toISOString(), last_run_status: "running" })
    .eq("id", recipeId);

  let runStatus = "success";
  let errorMessage: string | null = null;
  let recordsProcessed = 0;
  let outputSummary = "";

  try {
    // --- INTERNAL recipe branch (no Composio call) ---
    // For recipes whose composio_action is the literal string 'INTERNAL', the
    // work happens entirely inside Postgres via the run_internal_recipe()
    // function defined in migration 012. Used by GL Entry Writer, Monthly
    // Close Monitor, Producer Underperformance Watcher, and any agency-
    // specific INTERNAL recipes added later.
    if (recipe.composio_action === "INTERNAL") {
      const { data: internalResult, error: internalErr } = await sb.rpc(
        "run_internal_recipe",
        { p_recipe_id: recipeId },
      );
      if (internalErr) {
        throw new Error(`run_internal_recipe failed: ${internalErr.message}`);
      }
      // run_internal_recipe returns jsonb { records_processed, output_summary }
      recordsProcessed = (internalResult?.records_processed as number) ?? 0;
      outputSummary = (internalResult?.output_summary as string) ??
        `INTERNAL recipe completed (no summary returned)`;

      // Write run log + update recipe status, then return early
      const durationSec = Math.round((Date.now() - started) / 1000);
      await sb.from("automation_run_log").insert({
        agency_id: agencyId,
        recipe_id: recipeId,
        status: "success",
        records_processed: recordsProcessed,
        error_message: null,
        duration_seconds: durationSec,
        output_summary: outputSummary,
      });
      await sb
        .from("automation_recipes")
        .update({ last_run_status: "success" })
        .eq("id", recipeId);

      return {
        recipe_id: recipeId,
        recipe_name: recipe.recipe_name,
        status: "success",
        records_processed: recordsProcessed,
        duration_seconds: durationSec,
        triggered_by: triggeredBy,
        error: null,
      };
    }

    // --- Resolve credentials ---
    const composioApiKey = await getSetting(agencyId, "composio_api_key");
    if (!composioApiKey) {
      throw new Error(`Missing settings credential: composio_api_key (agency ${agencyId})`);
    }
    const composioUserId = await getSetting(agencyId, "composio_user_id");
    if (!composioUserId) {
      throw new Error(`Missing settings credential: composio_user_id (agency ${agencyId})`);
    }

    const connection = recipe.composio_connection;
    if (!connection) {
      throw new Error(`Recipe ${recipe.recipe_name} has no composio_connection set.`);
    }
    const accountId = await getComposioAccountId(agencyId, connection);

    const action = recipe.composio_action;
    if (!action) {
      throw new Error(`Recipe ${recipe.recipe_name} has no composio_action set.`);
    }

    // --- Call Composio ---
    const inputConfig = recipe.input_config || {};
    // input_config can include keys like gmail_query, attachment_required, etc.
    // Recipes are responsible for using keys that map to the Composio tool's
    // expected arguments. The runner passes them through as-is.
    const composioResult = await callComposio({
      apiKey: composioApiKey,
      userId: composioUserId,
      connectedAccountId: accountId,
      toolSlug: action,
      toolArguments: inputConfig,
    });

    if (!composioResult.ok) {
      throw new Error(`Composio ${action} failed: ${composioResult.error}`);
    }

    let parsedRecords: any[] = [];
    // Track which code path produced parsedRecords so the run-log summary can
    // be honest about whether the LLM was actually called. Without this, the
    // summary conflates "helper skipped LLM on empty input" with "LLM ran but
    // returned []" — they look identical in logs but have very different
    // cost and debugging implications.
    let llmSkippedAsEmpty = false;
    let llmWasCalled = false;

    // --- Optional: LLM parsing pass (via Composio-hosted Groq) ---
    if (recipe.groq_prompt && recipe.output_table) {
      // Skip the LLM call when the Composio response has no actionable data.
      // Typical for GMAIL_FETCH_EMAILS recipes when 0 messages match the
      // query — avoids unnecessary LLM calls on empty inputs and surfaces a
      // clean "0 records" success instead of attempting to parse nothing.
      if (isEmptyComposioData(composioResult.data)) {
        parsedRecords = [];
        llmSkippedAsEmpty = true;
      } else {
        // Default expectation: composioResult.data is array-shaped or has a top-level
        // collection (messages, items, results). Recipes that need a different shape
        // can include extraction hints in groq_prompt.
        const inputForLLM = JSON.stringify(composioResult.data).slice(0, 60000);
        llmWasCalled = true;
        const llmResult = await callComposioLLM({
          composioApiKey,
          composioUserId,
          systemPrompt: recipe.groq_prompt +
            '\n\nReturn a JSON object: {"records": [...]} where records is an array of objects ready to insert into the output_table. Return {"records": []} if nothing applicable.',
          userContent: inputForLLM,
        });
        if (!llmResult.ok) {
          throw new Error(`LLM parsing failed: ${llmResult.error}`);
        }
        parsedRecords = Array.isArray(llmResult.data?.records) ? llmResult.data.records : [];
      }
    } else if (recipe.output_table && Array.isArray(composioResult.data)) {
      // No LLM step — write raw composio data if it's already record-shaped
      parsedRecords = composioResult.data;
    }

    // --- Write to output_table ---
    if (recipe.output_table && parsedRecords.length > 0) {
      const writeResult = await writeOutput({
        outputTable: recipe.output_table,
        outputConfig: recipe.output_config || {},
        records: parsedRecords,
        agencyId: agencyId,
      });
      recordsProcessed = writeResult.inserted + writeResult.updated;
      outputSummary = `${recordsProcessed} records written to ${recipe.output_table}`;
    } else if (recipe.output_table) {
      // Honest, case-specific summary. Distinguishes three zero-record paths so
      // downstream observers can tell whether the LLM ran (cost), was skipped
      // (no cost — typical when the Composio call returned 0 items), or the
      // response shape simply didn't fit the recipe's groq/output mapping.
      if (llmSkippedAsEmpty) {
        outputSummary = `0 records — Composio returned 0 items; LLM parsing skipped (no LLM cost)`;
      } else if (llmWasCalled) {
        outputSummary = `0 records — Composio returned non-empty data, but LLM parsing returned no records to write`;
      } else {
        outputSummary = `0 records — Composio response was not record-shaped and no groq_prompt was configured`;
      }
    } else {
      // No output_table: this is an action-only recipe (e.g. send email,
      // post to social, archive). Composio call success is the result.
      outputSummary = `Action ${action} executed successfully (no output_table)`;
      recordsProcessed = 1;
    }
  } catch (err) {
    runStatus = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    outputSummary = `Failed: ${errorMessage.slice(0, 200)}`;
    await telegram(
      agencyId,
      `🛑 <b>Automation FAILED</b>\n\nRecipe: <b>${recipe.recipe_name}</b>\nError: ${errorMessage.slice(0, 400)}`,
    );
  }

  const durationSec = Math.round((Date.now() - started) / 1000);

  // --- Write run log ---
  await sb.from("automation_run_log").insert({
    agency_id: agencyId,
    recipe_id: recipeId,
    status: runStatus,
    records_processed: recordsProcessed,
    error_message: errorMessage,
    duration_seconds: durationSec,
    output_summary: outputSummary,
  });

  // --- Update recipe status ---
  await sb
    .from("automation_recipes")
    .update({ last_run_status: runStatus })
    .eq("id", recipeId);

  return {
    recipe_id: recipeId,
    recipe_name: recipe.recipe_name,
    status: runStatus,
    records_processed: recordsProcessed,
    duration_seconds: durationSec,
    triggered_by: triggeredBy,
    error: errorMessage,
  };
}

// --- HTTP handler -------------------------------------------------------

Deno.serve(async (req: Request) => {
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
  const triggeredBy: string = body.triggered_by || "manual";

  if (!recipeId) {
    return jsonResponse({ error: "Missing recipe_id in body" }, 400);
  }
  if (typeof body.shared_secret !== "string" || body.shared_secret.length === 0) {
    return jsonResponse({ error: "Missing shared_secret in body" }, 401);
  }

  // Load the recipe to resolve agency_id, then auth against that agency's
  // shared secret. Order matters: we cannot look up the secret without an
  // agency_id, and we cannot trust the body's recipe_id without the secret —
  // but the recipe row only contains a UUID + agency_id (no secrets), so
  // reading it before auth leaks nothing.
  const { data: recipe, error: recipeErr } = await sb
    .from("automation_recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeErr || !recipe) {
    return jsonResponse(
      { error: `Recipe ${recipeId} not found: ${recipeErr?.message || "no row"}` },
      404,
    );
  }

  if (!recipe.agency_id) {
    return jsonResponse(
      {
        error:
          `Recipe ${recipeId} has no agency_id set. Every recipe must belong to an agency so its credentials can be resolved from settings.`,
      },
      500,
    );
  }

  // Auth — agency-scoped
  let expectedSecret: string | null;
  try {
    expectedSecret = await getSetting(recipe.agency_id, "automation_runner_cron_secret");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Auth lookup failed: ${msg}` }, 500);
  }
  if (!expectedSecret) {
    return jsonResponse(
      {
        error:
          `Server missing settings.automation_runner_cron_secret for agency ${recipe.agency_id}`,
      },
      500,
    );
  }
  if (body.shared_secret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized: invalid shared_secret" }, 401);
  }

  try {
    const result = await executeRecipe(recipe, triggeredBy);
    const status = result.status === "success" ? 200 : 500;
    return jsonResponse({ ok: result.status === "success", ...result }, status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await telegram(
      recipe.agency_id,
      `🛑 <b>automation-runner CRASHED</b>\n${msg.slice(0, 300)}`,
    );
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
