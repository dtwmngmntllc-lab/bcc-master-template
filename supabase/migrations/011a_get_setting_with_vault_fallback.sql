-- Extends get_setting() to check Supabase Vault first, then fall back to public.settings.
-- Vault names are matched against UPPER(p_setting_key), so calls like
--   get_setting(agency_id, 'composio_api_key')
-- will match a Vault secret named 'COMPOSIO_API_KEY'.
--
-- Callers without Vault SELECT privilege silently fall through to public.settings;
-- they do not error out. This preserves the current SECURITY INVOKER semantics.

CREATE OR REPLACE FUNCTION public.get_setting(p_agency_id UUID, p_setting_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, vault, pg_temp
AS $function$
DECLARE
  v_value TEXT;
BEGIN
  -- 1. Try Vault first
  BEGIN
    SELECT decrypted_secret INTO v_value
    FROM vault.decrypted_secrets
    WHERE name = UPPER(p_setting_key)
    LIMIT 1;
  EXCEPTION
    WHEN insufficient_privilege THEN v_value := NULL;
    WHEN undefined_table       THEN v_value := NULL;
    WHEN undefined_function    THEN v_value := NULL;
  END;

  IF v_value IS NOT NULL THEN
    RETURN v_value;
  END IF;

  -- 2. Fall back to public.settings, agency-scoped
  SELECT setting_value INTO v_value
  FROM public.settings
  WHERE setting_key = p_setting_key
    AND (agency_id = p_agency_id OR agency_id IS NULL)
  ORDER BY agency_id NULLS LAST
  LIMIT 1;

  RETURN v_value;
END;
$function$;

COMMENT ON FUNCTION public.get_setting(UUID, TEXT) IS
'Returns a credential/setting value. Reads vault.decrypted_secrets first (matched against UPPER(setting_key)), then public.settings as fallback. Used by the automation-runner Edge Function via service_role JWT.';;
