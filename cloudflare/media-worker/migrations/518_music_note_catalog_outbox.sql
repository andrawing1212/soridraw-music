-- app518 candidate ONLY. Never auto-applied by existing deploy workflows.
-- No full-song payload or personal details are stored; source truth is Firestore.
-- Explicit director approval + independent audit required before D1 creation.
CREATE TABLE IF NOT EXISTS music_note_catalog_outbox_518 (
  owner_uid TEXT NOT NULL CHECK(length(owner_uid) BETWEEN 1 AND 128),
  favorite_id TEXT NOT NULL CHECK(length(favorite_id) BETWEEN 1 AND 240),
  source_version_ns TEXT NOT NULL CHECK(length(source_version_ns) = 21),
  desired_state TEXT NOT NULL CHECK(desired_state IN ('saved','removed')),
  ack_version_ns TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  next_attempt_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  acked_at_ms INTEGER,
  PRIMARY KEY(owner_uid, favorite_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_music_note_catalog_outbox_518_due
 ON music_note_catalog_outbox_518(next_attempt_ms, owner_uid, favorite_id)
 WHERE ack_version_ns IS NULL OR ack_version_ns != source_version_ns;
