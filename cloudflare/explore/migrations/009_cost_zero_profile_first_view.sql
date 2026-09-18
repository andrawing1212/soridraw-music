-- SORIDRAW Cost-Zero Stage 2A: compact public profile first-view read model.
-- SOURCE ONLY. Do not apply until bounded backfill + rollback are separately approved.
CREATE TABLE IF NOT EXISTS public_profile_first_views (
  uid TEXT PRIMARY KEY,
  handle TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  next_cursor TEXT,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_profile_first_views_handle
  ON public_profile_first_views(handle COLLATE NOCASE)
  WHERE handle <> '';

CREATE INDEX IF NOT EXISTS idx_public_profile_first_views_updated
  ON public_profile_first_views(updated_at DESC);
