-- =========================================================================
-- Migration 025: add metadata jsonb column to automation_run_log
-- =========================================================================
-- V2.4 observability: Edge Functions populate this with per-message errors,
-- version markers, stage counts, and other structured detail that doesn't
-- fit in output_summary (free-text) or error_message (free-text). Queryable
-- via JSONB operators (e.g. metadata->'per_message_errors').
-- =========================================================================

ALTER TABLE public.automation_run_log
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.automation_run_log.metadata IS
'Structured per-run detail. Edge Functions populate this with per-message errors, version markers, stage counts, and other context. Queryable via JSONB operators. Defaults to empty object for backward compatibility.';

-- A GIN index would be useful once query patterns emerge (e.g. filtering
-- on metadata->>'version' or jsonb_array_length(metadata->'per_message_errors')).
-- Held off for now to avoid premature optimization; revisit when monitoring
-- queries demand it.
