-- ============================================================
-- BCC AUTO-BRIDGE GENERATOR
-- Creates a function that returns CREATE VIEW SQL for every
-- legacy table that needs bridging to a master table name.
-- Run this once, then call it to get the bridge SQL.
-- ============================================================

CREATE OR REPLACE FUNCTION bcc_generate_bridges(
  legacy_to_master jsonb DEFAULT NULL  -- {"employees":"staff","agencies":"agency"}
) RETURNS TABLE(
  master_table text,
  legacy_table text,
  bridge_sql text,
  master_cols_count int,
  legacy_cols_count int,
  matched_cols int,
  unmapped_master_cols text[]
) LANGUAGE plpgsql AS $$
DECLARE
  pair record;
  master_cols text[];
  legacy_cols text[];
  matched text[];
  unmapped text[];
  select_list text;
  col text;
BEGIN
  -- If no mapping passed in, return empty
  IF legacy_to_master IS NULL THEN
    RETURN;
  END IF;

  FOR pair IN
    SELECT key AS legacy, value::text AS master
    FROM jsonb_each_text(legacy_to_master)
  LOOP
    -- Get master table columns
    SELECT array_agg(column_name ORDER BY ordinal_position)
      INTO master_cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name = pair.master;

    -- Get legacy table columns
    SELECT array_agg(column_name ORDER BY ordinal_position)
      INTO legacy_cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name = pair.legacy;

    -- Skip if either doesn't exist
    IF master_cols IS NULL OR legacy_cols IS NULL THEN
      master_table := pair.master;
      legacy_table := pair.legacy;
      bridge_sql := '-- SKIPPED: ' ||
        CASE WHEN master_cols IS NULL THEN 'master table not in 001 migration scope' ELSE 'legacy table not found' END;
      master_cols_count := COALESCE(array_length(master_cols,1),0);
      legacy_cols_count := COALESCE(array_length(legacy_cols,1),0);
      matched_cols := 0;
      unmapped_master_cols := master_cols;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Find matched columns (same name in both)
    SELECT array_agg(c) INTO matched
    FROM unnest(master_cols) c
    WHERE c = ANY(legacy_cols);

    -- Find unmapped master columns (in master but NOT in legacy)
    SELECT array_agg(c) INTO unmapped
    FROM unnest(master_cols) c
    WHERE NOT (c = ANY(legacy_cols));

    -- Build the SELECT list: matched columns by name, unmapped as NULL casts
    select_list := '';
    FOREACH col IN ARRAY master_cols LOOP
      IF select_list <> '' THEN select_list := select_list || ',' || E'\n    '; END IF;
      IF col = ANY(legacy_cols) THEN
        select_list := select_list || quote_ident(col);
      ELSE
        -- Get the master column type for the NULL cast
        select_list := select_list || 'NULL::' || (
          SELECT data_type FROM information_schema.columns
           WHERE table_schema='public' AND table_name=pair.master AND column_name=col
        ) || ' AS ' || quote_ident(col);
      END IF;
    END LOOP;

    master_table := pair.master;
    legacy_table := pair.legacy;
    bridge_sql := format(
      E'-- Bridge: %I -> %I\n-- Matched %s/%s master columns. Unmapped get NULL.\nCREATE OR REPLACE VIEW public.%I AS\nSELECT\n    %s\nFROM public.%I;',
      pair.legacy, pair.master,
      array_length(matched,1), array_length(master_cols,1),
      pair.master, select_list, pair.legacy
    );
    master_cols_count := array_length(master_cols, 1);
    legacy_cols_count := array_length(legacy_cols, 1);
    matched_cols := COALESCE(array_length(matched, 1), 0);
    unmapped_master_cols := unmapped;
    RETURN NEXT;
  END LOOP;
END $$;

-- Example: how to call after the audit identifies legacy names
-- SELECT * FROM bcc_generate_bridges('{"employees":"staff","agencies":"agency"}'::jsonb);
