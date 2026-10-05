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

-- The database itself enforces the transition. The release controller cannot
-- accidentally freeze while a legacy write can still be in flight.
CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_transition_guard
BEFORE UPDATE OF phase ON explore_like_cutover_control_174
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN OLD.phase = 'frozen' AND NEW.phase <> 'frozen'
      THEN RAISE(ABORT, '174 frozen phase is forward-only')
    WHEN NEW.phase <> OLD.phase AND NEW.epoch <> OLD.epoch + 1
      THEN RAISE(ABORT, '174 phase change requires epoch +1')
    WHEN OLD.phase = 'open' AND NEW.phase = 'draining'
      AND (
        length(NEW.approved_worker_sha256) <> 64 OR
        length(NEW.drain_token_hash) <> 64 OR
        NEW.phase_changed_at <= 0
      )
      THEN RAISE(ABORT, '174 draining requires approved source and token hash')
    WHEN OLD.phase = 'draining' AND NEW.phase = 'open'
      AND (
        NEW.approved_worker_sha256 <> '' OR
        NEW.drain_token_hash <> '' OR
        NEW.frozen_at <> 0
      )
      THEN RAISE(ABORT, '174 reopen must clear drain identity')
    WHEN OLD.phase = 'draining' AND NEW.phase = 'frozen'
      AND (
        NEW.approved_worker_sha256 <> OLD.approved_worker_sha256 OR
        NEW.drain_token_hash <> OLD.drain_token_hash OR
        NEW.frozen_at <= 0 OR
        EXISTS (SELECT 1 FROM explore_like_batches_035 LIMIT 1) OR
        EXISTS (SELECT 1 FROM explore_like_batches_066 LIMIT 1) OR
        EXISTS (SELECT 1 FROM explore_like_batches_069 LIMIT 1) OR
        EXISTS (
          SELECT 1
          FROM explore_like_user_queue_075 q
          JOIN explore_like_user_queue_state_075 s ON s.id = 1
          WHERE q.updated_at > s.processed_at
             OR (q.updated_at = s.processed_at AND q.user_uid > s.processed_uid)
          LIMIT 1
        ) OR
        NOT EXISTS (
          SELECT 1 FROM explore_like_processor_035
          WHERE id = 1 AND lease_until = 0 AND owner = ''
        )
      )
      THEN RAISE(ABORT, '174 freeze requires drained queues and idle processor')
    WHEN NEW.phase <> OLD.phase
      AND NOT (
        (OLD.phase = 'open' AND NEW.phase = 'draining') OR
        (OLD.phase = 'draining' AND NEW.phase IN ('open', 'frozen'))
      )
      THEN RAISE(ABORT, '174 invalid phase transition')
  END;
END;

CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_identity_guard
BEFORE UPDATE OF approved_worker_sha256, drain_token_hash
ON explore_like_cutover_control_174
FOR EACH ROW
WHEN NEW.phase = OLD.phase
 AND OLD.phase IN ('draining', 'frozen')
 AND (
   NEW.approved_worker_sha256 <> OLD.approved_worker_sha256 OR
   NEW.drain_token_hash <> OLD.drain_token_hash
 )
BEGIN
  SELECT RAISE(ABORT, '174 drain identity is immutable outside phase transition');
END;

CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_frozen_guard
BEFORE UPDATE ON explore_like_cutover_control_174
FOR EACH ROW
WHEN OLD.phase = 'frozen'
 AND (
   NEW.phase <> OLD.phase OR
   NEW.epoch <> OLD.epoch OR
   NEW.approved_worker_sha256 <> OLD.approved_worker_sha256 OR
   NEW.drain_token_hash <> OLD.drain_token_hash OR
   NEW.phase_changed_at <> OLD.phase_changed_at OR
   NEW.frozen_at <> OLD.frozen_at
 )
BEGIN
  SELECT RAISE(ABORT, '174 frozen control row is immutable');
END;
