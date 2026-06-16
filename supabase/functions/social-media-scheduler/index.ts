// =========================================================================
// social-media-scheduler  (BCC Master Template — multi-platform posting)
// =========================================================================
// PURPOSE: Iterate today's content_calendar rows and post each one to the
//   right platform via Composio. Marks status='posted' on success,
//   status='requires_manual' (+ creates an alert) when the platform isn't
//   wired up yet, and status='failed' (+ creates an alert) on real errors.
//
//   Triggered by public.dispatch_social_media_scheduler via the runner's
//   INTERNAL branch. Recipe schedules to 9am CDT (0 14 * * *).
//
//   Per row:
//     1. Determine platform (lowercased)
//     2. Look up composio_<platform>_account_id in settings
//     3. Special-case instagram → always requires_manual (no public API)
//     4. If no connection → requires_manual + alert (graceful degradation)
//     5. If connection → dispatch to the right Composio tool:
//          facebook + media_url   → FACEBOOK_CREATE_PHOTO_POST
//          facebook + no media    → FACEBOOK_CREATE_POST
//          linkedin + no media    → LINKEDIN_CREATE_LINKED_IN_POST
//          linkedin + media       → V2 (requires multi-step upload); manual
//     6. On success: update content_calendar.status='posted', post_url, posted_at
//     7. On failure: update status='failed', engagement_notes, create alert
//
//   When platforms eventually get connected (operator adds the Composio
//   integration + the relevant settings rows), posts to that platform
//   start succeeding automatically. No code change required.
//
// V1 SCOPE: text + image posts for Facebook; text-only for LinkedIn;
//   Instagram always manual; image posts for LinkedIn are V2.
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
  if (error) throw new Error(`get_setting failed (${key}): ${error.message}`);
  return (data as string | null) ?? null;
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
  const error = ok ? null : (parsed?.error?.message || parsed?.error || text.slice(0, 400));
  return { ok, data, error, httpStatus: res.status };
}

function composeFullText(caption: string | null, hashtags: string[] | null): string {
  const cap = (caption || "").trim();
  const tags = (hashtags || []).filter(t => typeof t === "string" && t.trim()).join(" ");
  return tags ? `${cap}\n\n${tags}` : cap;
}

interface PostResult {
  outcome: "posted" | "requires_manual" | "failed";
  post_url?: string | null;
  error?: string;
}

async function postOne(opts: {
  agencyId: string;
  row: any;
  apiKey: string;
  userId: string;
}): Promise<PostResult> {
  const platform = (opts.row.platform || "").toLowerCase().trim();
  const fullText = composeFullText(opts.row.caption, opts.row.hashtags);
  const mediaUrl: string | null = opts.row.media_url || null;

  // Instagram — no public API for auto-post, always manual
  if (platform === "instagram") {
    return {
      outcome: "requires_manual",
      error: "Instagram has no public API for automated posts; post manually via the app.",
    };
  }

  if (!platform) {
    return { outcome: "failed", error: "content_calendar.platform is null or empty" };
  }

  // Look up the platform connection
  const accountId = await getSetting(opts.agencyId, `composio_${platform}_account_id`);
  if (!accountId) {
    return {
      outcome: "requires_manual",
      error: `No composio_${platform}_account_id in settings. Connect ${platform} in Composio (app.composio.dev) and INSERT the account_id into public.settings to enable auto-posting.`,
    };
  }

  // ----- Facebook -----
  if (platform === "facebook") {
    const pageId = await getSetting(opts.agencyId, "facebook_page_id");
    if (!pageId) {
      return {
        outcome: "requires_manual",
        error: "Facebook connection found but settings.facebook_page_id is missing. Use FACEBOOK_LIST_MANAGED_PAGES to discover the numeric page_id, then INSERT it into public.settings.",
      };
    }

    let toolSlug: string;
    let toolArgs: Record<string, any>;
    if (mediaUrl) {
      toolSlug = "FACEBOOK_CREATE_PHOTO_POST";
      toolArgs = {
        page_id: pageId,
        url: mediaUrl,
        message: fullText,
        published: true,
      };
    } else {
      toolSlug = "FACEBOOK_CREATE_POST";
      toolArgs = {
        page_id: pageId,
        message: fullText,
      };
    }

    const r = await callComposio({
      apiKey: opts.apiKey, userId: opts.userId,
      connectedAccountId: accountId,
      toolSlug, toolArguments: toolArgs,
    });
    if (!r.ok) {
      return { outcome: "failed", error: `${toolSlug} (http=${r.httpStatus}): ${r.error}` };
    }
    // FB returns post_id in form 'pageId_postId'
    const postId: string | null = r.data?.post_id ?? r.data?.id ?? null;
    const postUrl = postId ? `https://www.facebook.com/${postId}` : null;
    return { outcome: "posted", post_url: postUrl };
  }

  // ----- LinkedIn (text-only V1; image posts are V2) -----
  if (platform === "linkedin") {
    if (mediaUrl) {
      return {
        outcome: "requires_manual",
        error: "LinkedIn image posts require a 3-step upload flow (register → initialize → create); planned for V2. Post the image manually for now.",
      };
    }

    const authorUrn = await getSetting(opts.agencyId, "linkedin_author_urn");
    if (!authorUrn) {
      return {
        outcome: "requires_manual",
        error: "LinkedIn connection found but settings.linkedin_author_urn is missing. Use LINKEDIN_GET_MY_INFO (for personal) or LINKEDIN_GET_COMPANY_INFO (for organization) to discover the URN (e.g. 'urn:li:person:XXXX'), then INSERT into public.settings.",
      };
    }

    const r = await callComposio({
      apiKey: opts.apiKey, userId: opts.userId,
      connectedAccountId: accountId,
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
      toolArguments: {
        author: authorUrn,
        commentary: fullText.slice(0, 3000),
        visibility: "PUBLIC",
        lifecycleState: "PUBLISHED",
      },
    });
    if (!r.ok) {
      return { outcome: "failed", error: `LINKEDIN_CREATE_LINKED_IN_POST (http=${r.httpStatus}): ${r.error}` };
    }
    const postUrn: string | null = r.data?.id ?? r.data?.urn ?? null;
    const postUrl = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : null;
    return { outcome: "posted", post_url: postUrl };
  }

  // Any other platform — manual
  return {
    outcome: "requires_manual",
    error: `Platform "${platform}" is not yet supported by the social-media-scheduler. Supported: facebook, linkedin (text-only), instagram (manual). Post manually for now.`,
  };
}

Deno.serve(async (req: Request) => {
  const started = Date.now();

  if (req.method !== "POST") {
    return jsonResponse({ error: "Use POST." }, 405);
  }

  let body: any = {};
  try {
    const t = await req.text();
    body = t ? JSON.parse(t) : {};
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const recipeId: string | undefined = body.recipe_id;
  const sharedSecret: string | undefined = body.shared_secret;
  if (!recipeId) return jsonResponse({ error: "Missing recipe_id" }, 400);
  if (!sharedSecret) return jsonResponse({ error: "Missing shared_secret" }, 401);

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

  let expectedSecret: string | null;
  try {
    expectedSecret = await getSetting(agencyId, "automation_runner_cron_secret");
  } catch (err) {
    return jsonResponse({ error: `Auth lookup failed: ${(err as Error).message}` }, 500);
  }
  if (!expectedSecret || sharedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized: invalid shared_secret" }, 401);
  }

  async function writeOutcome(
    status: "success" | "failed",
    recordsProcessed: number,
    summary: string,
    errorMessage: string | null,
  ) {
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
    const apiKey = await getSetting(agencyId, "composio_api_key");
    if (!apiKey) throw new Error("Missing composio_api_key in Vault/settings");
    const userId = await getSetting(agencyId, "composio_user_id");
    if (!userId) throw new Error("Missing composio_user_id");

    // V1: post all of today's scheduled items, regardless of scheduled_time.
    // (The spec says "pulls today's content_calendar items" at the 9am tick.)
    const today = new Date().toISOString().slice(0, 10);
    const ic = (recipe.input_config || {}) as Record<string, any>;
    const lookbackDays = Math.max(0, Number(ic.lookback_days ?? 0));
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - lookbackDays);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const { data: rows, error: rowErr } = await sb
      .from("content_calendar")
      .select("id, platform, content_type, caption, hashtags, media_url, scheduled_date, scheduled_time, status, post_url, requires_manual")
      .eq("agency_id", agencyId)
      .gte("scheduled_date", sinceStr)
      .lte("scheduled_date", today)
      .in("status", ["scheduled", "approved"])
      .or("requires_manual.is.null,requires_manual.eq.false")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true, nullsFirst: true });

    if (rowErr) throw new Error(`content_calendar query failed: ${rowErr.message}`);

    const candidates = rows || [];
    if (candidates.length === 0) {
      const summary = `0 posts due. Looked at scheduled_date ∈ [${sinceStr}, ${today}] for status in (scheduled, approved) and requires_manual!=true.`;
      await writeOutcome("success", 0, summary, null);
      return jsonResponse({ ok: true, status: "success", records_processed: 0, output_summary: summary });
    }

    let posted = 0, manual = 0, failed = 0;
    const platformBreakdown: Record<string, { posted: number; manual: number; failed: number }> = {};
    const errorMessages: string[] = [];
    const now = new Date().toISOString();

    for (const row of candidates) {
      const p = ((row.platform as string) || "unknown").toLowerCase();
      platformBreakdown[p] = platformBreakdown[p] || { posted: 0, manual: 0, failed: 0 };

      let result: PostResult;
      try {
        result = await postOne({ agencyId, row, apiKey: apiKey!, userId: userId! });
      } catch (err) {
        result = { outcome: "failed", error: `postOne threw: ${(err as Error).message}` };
      }

      if (result.outcome === "posted") {
        posted++; platformBreakdown[p].posted++;
        await sb.from("content_calendar").update({
          status: "posted",
          post_url: result.post_url,
          posted_at: now,
        }).eq("id", row.id);
      } else if (result.outcome === "requires_manual") {
        manual++; platformBreakdown[p].manual++;
        await sb.from("content_calendar").update({
          status: "requires_manual",
          requires_manual: true,
          engagement_notes: result.error,
        }).eq("id", row.id);

        await sb.from("alerts").insert({
          agency_id: agencyId,
          alert_type: "social_media_manual_required",
          severity: "info",
          title: `Post manually to ${row.platform}: ${(row.caption || "").slice(0, 60)}`,
          message: `Scheduled post on ${row.scheduled_date} needs to be posted manually.\n\nReason: ${result.error}\n\nCaption:\n${row.caption || ""}${row.media_url ? "\n\nMedia: " + row.media_url : ""}`,
          module_reference: `social_media_scheduler:${row.id}`,
          is_read: false,
          is_resolved: false,
        });
      } else {
        failed++; platformBreakdown[p].failed++;
        errorMessages.push(`${p} row ${row.id}: ${result.error}`);
        await sb.from("content_calendar").update({
          status: "failed",
          engagement_notes: result.error,
        }).eq("id", row.id);

        await sb.from("alerts").insert({
          agency_id: agencyId,
          alert_type: "social_media_post_failed",
          severity: "warning",
          title: `Auto-post to ${row.platform} FAILED`,
          message: `Scheduled post on ${row.scheduled_date} failed to publish.\n\nError: ${result.error}\n\nCaption:\n${row.caption || ""}`,
          module_reference: `social_media_scheduler:${row.id}`,
          is_read: false,
          is_resolved: false,
        });
      }
    }

    const summaryParts: string[] = [
      `${candidates.length} candidates`,
      `${posted} posted`,
      `${manual} requires_manual`,
      `${failed} failed`,
    ];
    const summary = summaryParts.join(", ") + ". Breakdown: " + JSON.stringify(platformBreakdown);
    const overallStatus = failed === 0 ? "success" : "failed";
    const errMsg = failed === 0 ? null : errorMessages.join(" | ").slice(0, 800);

    await writeOutcome(overallStatus, posted, summary, errMsg);

    return jsonResponse({
      ok: failed === 0,
      status: overallStatus,
      records_processed: posted,
      requires_manual: manual,
      failed,
      platform_breakdown: platformBreakdown,
      output_summary: summary,
    }, failed === 0 ? 200 : 207);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeOutcome("failed", 0, `Failed: ${msg.slice(0, 200)}`, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
