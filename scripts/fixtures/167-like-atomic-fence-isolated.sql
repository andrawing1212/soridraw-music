-- SORIDRAW 167 ISOLATED TEST FIXTURE ONLY, NOT A DEPLOYABLE MIGRATION.
-- Simulates the SHARED D1 atomic boundary. Do not apply to user DB.
-- All legacy intake paths must be fenced by the database, including old
-- deployed Workers that do not read the new R2 drain marker.
CREATE TABLE like_cutover_control_167 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL CHECK (phase IN ('open','draining','frozen'))
);
INSERT INTO like_cutover_control_167 (id,phase) VALUES (1,'open');

CREATE TABLE explore_like_batches_035 (batch_id TEXT PRIMARY KEY);
CREATE TABLE explore_like_batches_066 (batch_id TEXT PRIMARY KEY);
CREATE TABLE explore_like_batches_069 (batch_id TEXT PRIMARY KEY);
CREATE TABLE explore_like_user_queue_075 (user_uid TEXT PRIMARY KEY, updated_at INTEGER NOT NULL);

CREATE TABLE likes (track_id TEXT NOT NULL,user_uid TEXT NOT NULL,
 PRIMARY KEY(track_id,user_uid));
CREATE TABLE track_stats (track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);

-- Unlike a SELECT then INSERT in separate Worker calls, BEFORE triggers and
-- control UPDATE are SQLite writes serialized on the same database.
CREATE TRIGGER like_intake_035_fence_167 BEFORE INSERT ON explore_like_batches_035
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) <> 'open'
BEGIN SELECT RAISE(ABORT,'LIKE_CUTOVER_DRAINING_167'); END;
CREATE TRIGGER like_intake_066_fence_167 BEFORE INSERT ON explore_like_batches_066
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) <> 'open'
BEGIN SELECT RAISE(ABORT,'LIKE_CUTOVER_DRAINING_167'); END;
CREATE TRIGGER like_intake_069_fence_167 BEFORE INSERT ON explore_like_batches_069
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) <> 'open'
BEGIN SELECT RAISE(ABORT,'LIKE_CUTOVER_DRAINING_167'); END;
CREATE TRIGGER like_intake_075_insert_fence_167 BEFORE INSERT ON explore_like_user_queue_075
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) <> 'open'
BEGIN SELECT RAISE(ABORT,'LIKE_CUTOVER_DRAINING_167'); END;
CREATE TRIGGER like_intake_075_update_fence_167 BEFORE UPDATE ON explore_like_user_queue_075
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) <> 'open'
BEGIN SELECT RAISE(ABORT,'LIKE_CUTOVER_DRAINING_167'); END;

-- This only blocks post-freeze relation modifications; it CANNOT safely
-- distinguish in-flight direct writes from scheduled queue draining in the
-- intermediate phase. The test explicitly exposes that outstanding gap.
CREATE TRIGGER like_baseline_insert_fence_167 BEFORE INSERT ON likes
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) = 'frozen'
BEGIN SELECT RAISE(ABORT,'LIKE_LEGACY_FROZEN_167'); END;
CREATE TRIGGER like_baseline_delete_fence_167 BEFORE DELETE ON likes
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) = 'frozen'
BEGIN SELECT RAISE(ABORT,'LIKE_LEGACY_FROZEN_167'); END;
CREATE TRIGGER like_baseline_update_fence_167 BEFORE UPDATE ON likes
WHEN (SELECT phase FROM like_cutover_control_167 WHERE id=1) = 'frozen'
BEGIN SELECT RAISE(ABORT,'LIKE_LEGACY_FROZEN_167'); END;
