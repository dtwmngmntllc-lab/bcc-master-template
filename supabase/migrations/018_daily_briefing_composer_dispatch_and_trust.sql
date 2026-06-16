-- =========================================================================
-- MIGRATION 018 — Daily Briefing Composer: dispatch-and-trust
-- =========================================================================
-- 017 tried to poll net._http_response inside the composer. That can never
-- work: plpgsql functions hold a snapshot taken at function start, and
-- pg_net's background worker inserts response rows in separate
-- transactions, so the function can't see them no matter how long it
-- polls. This is an MVCC property, not a pg_net bug.
--
-- This patch removes the polling. The composer now:
--   1. Composes the body
--   2. Fires net.http_post (synchronous queueing, async dispatch)
--   3. Logs a daily_briefing_log row with delivered=true the moment the
--      request_id is returned (meaning: successfully dispatched to pg_net's
--      worker queue, which is the strongest delivery signal we can get
--      from inside a single transaction).
--   4. Records the pg_net request_id in content_snapshot so post-hoc
--      reconciliation against net._http_response is always possible.
--
-- This matches the fire-and-trust pattern already used by
-- run_due_automation_recipes() in migration 011.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.daily_briefing_composer(
  p_agency_id UUID,
  p_recipe_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_input_config  JSONB;
  v_recipient     TEXT;
  v_subject       TEXT;
  v_agency_name   TEXT;
  v_owner_name    TEXT;
  v_first_name    TEXT;
  v_api_key       TEXT;
  v_user_id       TEXT;
  v_account_id    TEXT;
  v_today         DATE := CURRENT_DATE;
  v_curr_year     INT  := EXTRACT(YEAR FROM v_today)::INT;
  v_curr_month    INT  := EXTRACT(MONTH FROM v_today)::INT;
  v_revenue_ytd   NUMERIC;
  v_revenue_mtd   NUMERIC;
  v_aipp_earned   NUMERIC;
  v_aipp_target   NUMERIC;
  v_aipp_pct      NUMERIC;
  v_aipp_html     TEXT;
  v_tasks_html    TEXT;
  v_alerts_html   TEXT;
  v_posts_html    TEXT;
  v_body          TEXT;
  v_body_with_id  TEXT;
  v_request_id    BIGINT;
BEGIN
  -- 1. Idempotency
  IF EXISTS (
    SELECT 1 FROM public.daily_briefing_log
    WHERE agency_id = p_agency_id
      AND briefing_date = v_today
      AND delivered = true
  ) THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary', 'Skipped: briefing already dispatched for ' || v_today::text
    );
  END IF;

  -- 2. Recipe input_config
  SELECT input_config INTO v_input_config
  FROM public.automation_recipes WHERE id = p_recipe_id;

  v_recipient := COALESCE(
    v_input_config->>'recipient_email',
    v_input_config->>'recipient',
    ''
  );
  IF v_recipient = '' OR v_recipient ILIKE '%@placeholder.invalid' THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary', 'Skipped: no valid recipient_email in input_config (got "' || v_recipient || '")'
    );
  END IF;

  -- 3. Agency context
  SELECT name, owner_name
  INTO v_agency_name, v_owner_name
  FROM public.agency WHERE id = p_agency_id;

  v_first_name := COALESCE(NULLIF(split_part(COALESCE(v_owner_name,''), ' ', 1), ''), 'there');

  -- 4. Composio credentials
  v_api_key    := public.get_setting(p_agency_id, 'composio_api_key');
  v_user_id    := public.get_setting(p_agency_id, 'composio_user_id');
  v_account_id := public.get_setting(p_agency_id, 'composio_gmail_account_id');

  IF v_api_key IS NULL OR v_user_id IS NULL OR v_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'records_processed', 0,
      'output_summary', 'Skipped: missing one of composio_api_key, composio_user_id, composio_gmail_account_id'
    );
  END IF;

  -- 5. Financial aggregates
  SELECT COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0),
         COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND period_month = v_curr_month), 0)
  INTO v_revenue_ytd, v_revenue_mtd
  FROM public.comp_recap
  WHERE agency_id = p_agency_id AND period_year = v_curr_year;

  SELECT earned_ytd, target_amount, achievement_percentage
  INTO v_aipp_earned, v_aipp_target, v_aipp_pct
  FROM public.aipp_tracking
  WHERE agency_id = p_agency_id AND program_year = v_curr_year
  ORDER BY last_updated DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  v_aipp_html := CASE
    WHEN v_aipp_pct IS NOT NULL OR v_aipp_earned IS NOT NULL THEN
      '<li>AIPP: <b>$' || COALESCE(to_char(v_aipp_earned, 'FM999G999G990D00'), '0.00') ||
      '</b> of $' || COALESCE(to_char(v_aipp_target, 'FM999G999G990D00'), '—') ||
      ' (' || COALESCE(to_char(v_aipp_pct, 'FM990D0'), '0') || '%%)</li>'
    ELSE
      '<li>AIPP: <i>no tracking row yet for ' || v_curr_year || '</i></li>'
  END;

  WITH top_tasks AS (
    SELECT title, COALESCE(priority, 'normal') AS priority, due_date
    FROM public.tasks
    WHERE agency_id = p_agency_id
      AND COALESCE(status, 'open') NOT IN ('completed','closed','done','cancelled')
      AND completed_at IS NULL
    ORDER BY
      CASE LOWER(COALESCE(priority, ''))
        WHEN 'critical' THEN 0 WHEN 'high' THEN 1
        WHEN 'medium' THEN 2 WHEN 'normal' THEN 3
        WHEN 'low' THEN 4 ELSE 5
      END,
      due_date ASC NULLS LAST, created_at DESC
    LIMIT 5
  )
  SELECT COALESCE(
    string_agg(
      '<li><b>' || title || '</b>' ||
      CASE WHEN due_date IS NOT NULL THEN ' &mdash; due ' || to_char(due_date, 'Mon DD') ELSE '' END ||
      ' <span style="color:#888">(' || priority || ')</span></li>',
      E'\n'
    ),
    '<li><i>No open tasks. Quiet day ahead.</i></li>'
  )
  INTO v_tasks_html FROM top_tasks;

  WITH top_alerts AS (
    SELECT title, COALESCE(severity, 'info') AS severity
    FROM public.alerts
    WHERE agency_id = p_agency_id
      AND COALESCE(is_resolved, false) = false
    ORDER BY
      CASE LOWER(COALESCE(severity, ''))
        WHEN 'critical' THEN 0 WHEN 'error' THEN 1
        WHEN 'warning' THEN 2 ELSE 3
      END,
      created_at DESC
    LIMIT 5
  )
  SELECT COALESCE(
    string_agg(
      '<li><b>[' || upper(severity) || ']</b> ' || title || '</li>',
      E'\n'
    ),
    '<li><i>No open alerts.</i></li>'
  )
  INTO v_alerts_html FROM top_alerts;

  WITH today_posts AS (
    SELECT platform, content_type, caption, scheduled_time
    FROM public.content_calendar
    WHERE agency_id = p_agency_id
      AND scheduled_date = v_today
      AND COALESCE(status, 'scheduled') NOT IN ('posted','cancelled','failed')
    ORDER BY scheduled_time NULLS LAST
  )
  SELECT COALESCE(
    string_agg(
      '<li>' ||
      CASE WHEN scheduled_time IS NOT NULL THEN to_char(scheduled_time, 'HH12:MIam') || ' &mdash; ' ELSE '' END ||
      COALESCE(platform, '?') || ' (' || COALESCE(content_type, 'post') || '): ' ||
      LEFT(COALESCE(caption, '<i>no caption</i>'), 80) || '</li>',
      E'\n'
    ),
    '<li><i>No posts scheduled for today.</i></li>'
  )
  INTO v_posts_html FROM today_posts;

  v_subject := 'Morning briefing — ' || to_char(v_today, 'Mon DD, YYYY');

  v_body := format(
$html$<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#222;max-width:640px;line-height:1.5">
  <p>Good morning, %s.</p>
  <p>Here's the briefing for <b>%s</b> on %s.</p>

  <h3 style="margin-top:24px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px">Where we are</h3>
  <ul style="padding-left:20px">
    <li>Revenue YTD: <b>$%s</b></li>
    <li>Revenue this month: <b>$%s</b></li>
    %s
  </ul>

  <h3 style="margin-top:24px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px">Today's priorities</h3>
  <ul style="padding-left:20px">%s</ul>

  <h3 style="margin-top:24px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px">What I'm watching</h3>
  <ul style="padding-left:20px">%s</ul>

  <h3 style="margin-top:24px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px">Today's content calendar</h3>
  <ul style="padding-left:20px">%s</ul>

  <hr style="margin-top:32px;border:none;border-top:1px solid #ddd"/>
  <p style="color:#888;font-size:12px;margin-top:16px">
    Automated by your BCC. Open the dashboard at
    <a href="https://your-dashboard.vercel.app" style="color:#555">your-dashboard.vercel.app</a>.
    To change what's in this briefing, edit the <code>Daily Briefing Email</code> recipe in Automations.
  </p>
</div>$html$,
    v_first_name,
    v_agency_name,
    to_char(v_today, 'FMDay, FMMonth FMDD'),
    to_char(v_revenue_ytd, 'FM999G999G990D00'),
    to_char(v_revenue_mtd, 'FM999G999G990D00'),
    v_aipp_html,
    v_tasks_html,
    v_alerts_html,
    v_posts_html
  );

  -- Dispatch via Composio
  SELECT net.http_post(
    url     := 'https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL',
    headers := jsonb_build_object(
                 'x-api-key',    v_api_key,
                 'Content-Type', 'application/json'
               ),
    body    := jsonb_build_object(
                 'user_id',              v_user_id,
                 'connected_account_id', v_account_id,
                 'arguments', jsonb_build_object(
                   'recipient_email', v_recipient,
                   'subject',         v_subject,
                   'body',            v_body,
                   'is_html',         true
                 )
               )
  ) INTO v_request_id;

  -- Prepend a tiny audit header to content_snapshot so future
  -- reconciliation queries can join back to net._http_response by request_id.
  v_body_with_id :=
    '<!-- pg_net_request_id=' || v_request_id ||
    ' recipient=' || v_recipient ||
    ' dispatched_at=' || NOW()::text || ' -->' || E'\n' || v_body;

  -- Log as delivered=true (semantically: "successfully dispatched to pg_net").
  -- If Composio later returns non-2xx, that shows up in net._http_response
  -- and can be reconciled by a sweep job — out of scope for the composer.
  INSERT INTO public.daily_briefing_log (
    agency_id, briefing_date, sent_at, delivered, opened, content_snapshot
  ) VALUES (
    p_agency_id, v_today, NOW(), true, false, v_body_with_id
  );

  RETURN jsonb_build_object(
    'records_processed', 1,
    'output_summary', 'Briefing dispatched to ' || v_recipient || ' (pg_net request_id=' || v_request_id || '). Verify delivery in net._http_response or in the recipient inbox.'
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.daily_briefing_composer(UUID, UUID) TO postgres, service_role;


-- =========================================================================
-- Audit correction: the migration-016 smoke test DID actually send the
-- briefing (Gmail message id 19ebe15e2f26b9c0 in net._http_response id=30,
-- status_code=200). The composer wrongly logged delivered=false due to the
-- MVCC bug this migration fixes. Update the historical row so the audit
-- log reflects reality.
-- =========================================================================
UPDATE public.daily_briefing_log
SET delivered = true,
    content_snapshot = '<!-- audit_correction=migration_018 net_http_response_id=30 gmail_message_id=19ebe15e2f26b9c0 status_code=200 -->' || E'\n' || COALESCE(content_snapshot, '')
WHERE id = 'e0336fe8-6e90-4334-be9a-f9b111e6f19c'::uuid;;