-- =========================================================================
-- 021_documents_drive_folder_path.sql
-- =========================================================================
-- PURPOSE: Add `drive_folder_path` column to `public.documents` so attachments
--   archived to Drive can record the canonical folder path they landed in
--   (e.g. 'BCC/Documents/2026-06/bank_statements').
--
-- WHY: docs/DRIVE_FOLDER_SETUP.md section 4 specifies that documents rows
--   created by recipes that write to Drive must populate `drive_file_id`,
--   `drive_folder_path`, and `groq_classification`. The first and third
--   columns already exist; this migration adds the second.
--
-- USED BY (S12+):
--   - email-archiver V2 (when input_config.route_attachments_to_drive = true)
--   - document-processor (future)
--
-- BACK-COMPATIBLE: column is NULLable; V1 email-archiver rows leave it NULL.
-- =========================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS drive_folder_path TEXT;

COMMENT ON COLUMN public.documents.drive_folder_path IS
  'Canonical Drive folder path for the archived file, e.g. ''BCC/Documents/2026-06/bank_statements''. Populated by recipes that route attachments to Google Drive. NULL for legacy / V1 email-archiver rows (label-modify only). See docs/DRIVE_FOLDER_SETUP.md.';
