-- ============================================================
-- 005 — ANON READ POLICIES
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- Grants the anon role SELECT permission on every table that has
-- an agency_id column (i.e., every per-agency data table) and on
-- the views that depend on them.
--
-- DESIGN: Discovers tables dynamically rather than hardcoding a
-- list, so this migration stays correct even when new tables are
-- added in future migrations. (The previous version hardcoded a
-- list that drifted out of sync with the schema and silently broke
-- six modules in production.)
--
-- The BCC web app uses the anon JWT key (legacy or publishable)
-- which means every browser query is run as the anon role. Without
-- these policies, every module silently shows empty data.
-- ============================================================

DO $$
DECLARE
    t text;
    policy_name text;
    policy_exists boolean;
BEGIN
    -- Iterate every BASE TABLE in public schema that has an agency_id column.
    -- Views are excluded because they cannot have RLS policies (they inherit
    -- security from their underlying tables).
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables tt
          ON tt.table_schema = c.table_schema
         AND tt.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'agency_id'
          AND tt.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP
        policy_name := 'anon_read_' || t;

        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = t
              AND policyname = policy_name
        ) INTO policy_exists;

        IF NOT policy_exists THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
                policy_name, t
            );
        END IF;
    END LOOP;
END $$;

-- Grant table-level SELECT on every public table (and view) to anon.
-- RLS policies above gate row visibility on tables; views inherit from their
-- underlying tables. The grant below covers both.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Also grant on future tables (so new migrations don't have to remember)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Confirm what was applied
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles::text[])
ORDER BY tablename;
