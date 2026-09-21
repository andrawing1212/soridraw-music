-- SORIDRAW 174: SOURCE-ONLY atomic D1 cutover fence candidate.
-- DO NOT APPLY automatically. This is release-controller metadata only.
--
-- Purpose:
--   1. every legacy like write is conditional on phase='open' in the SAME D1
--      transaction as that write;
--   2. phase='draining' rejects new legacy intake while scheduled legacy work
--      may drain;
--   3. phase='frozen' can be entered only when legacy queues are empty and the
--      processor lease is idle;
--   4. the 171 writer is allowed only after phase='frozen'.
--
-- One shared D1 owns the serialization boundary for PREVIEW/TEST/PRODUCTION.
-- No user rows are copied, backfilled, rewritten, or deleted by this migration.

CREATE TABLE IF NOT EXISTS explore_like_cutover_control_174 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL CHECK (phase IN ('open', 'draining', 'frozen')),
  epoch INTEGER NOT NULL CHECK (epoch >= 0),
  approved_worker_sha256 TEXT NOT NULL DEFAULT '' CHECK (
    approved_worker_sha256 = '' OR length(approved_worker_sha256) = 64
  ),
  drain_token_hash TEXT NOT NULL DEFAULT '' CHECK (
    drain_token_hash = '' OR length(drain_token_hash) = 64
  ),
  phase_changed_at INTEGER NOT NULL CHECK (phase_changed_at >= 0),
  frozen_at INTEGER NOT NULL DEFAULT 0 CHECK (frozen_at >= 0)
);

INSERT OR IGNORE INTO explore_like_cutover_control_174(
  id, phase, epoch, approved_worker_sha256, drain_token_hash,
  phase_changed_at, frozen_at
) VALUES (1, 'open', 0, '', '', 0, 0);
