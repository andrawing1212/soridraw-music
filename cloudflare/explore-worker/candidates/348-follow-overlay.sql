-- SORIDRAW follow sparse overlay 348 — CANDIDATE ONLY.
-- DO NOT apply to shared D1 until PREVIEW/TEST/PRODUCTION readers + writers
-- all understand the overlay contract and the user approves the coordinated cutover.
--
-- Existing follows remains an immutable baseline after cutover.
-- No backfill/rewrite/delete of legacy user rows is required.

CREATE TABLE IF NOT EXISTS explore_follow_overrides_348 (
  follower_uid TEXT NOT NULL,
  following_uid TEXT NOT NULL,
  following INTEGER NOT NULL CHECK (following IN (0,1)),
  baseline_following INTEGER NOT NULL CHECK (baseline_following IN (0,1)),
  updated_at INTEGER NOT NULL,
  mutation_id TEXT NOT NULL,
  PRIMARY KEY (follower_uid, following_uid),
  CHECK (follower_uid <> following_uid)
) WITHOUT ROWID;

-- Forward list uses the WITHOUT ROWID PK prefix (follower_uid,...).
-- This single partial index is only for post-cutover active reverse discovery.
-- State=0 rows deliberately do not consume the reverse index.
CREATE INDEX IF NOT EXISTS idx_explore_follow_overrides_348_active_reverse
  ON explore_follow_overrides_348 (following_uid, follower_uid)
  WHERE following = 1;

CREATE TABLE IF NOT EXISTS explore_follow_cutover_control_348 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL DEFAULT 'legacy'
    CHECK (phase IN ('legacy','armed','overlay')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  cutover_token TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);

INSERT INTO explore_follow_cutover_control_348(
  id, phase, schema_version, cutover_token, updated_at
)
VALUES(1, 'legacy', 1, '', 0)
ON CONFLICT(id) DO NOTHING;
