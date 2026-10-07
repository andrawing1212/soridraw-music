-- CANDIDATE ONLY. Never apply to the shared database in this task.
-- One UID B-tree entry, no indexes. This proves intake, never membership/count.
CREATE TABLE IF NOT EXISTS explore_like_intake_receipts_390 (
  user_uid TEXT PRIMARY KEY,
  generation INTEGER NOT NULL CHECK(generation > 0),
  receipts_json TEXT NOT NULL CHECK(json_valid(receipts_json) AND
    json_type(receipts_json) = 'array' AND json_array_length(receipts_json) <= 1200 AND
    length(receipts_json) <= 600000),
  queue_id TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  mutation_count INTEGER NOT NULL CHECK(mutation_count BETWEEN 1 AND 50),
  mutations_json TEXT NOT NULL CHECK(json_valid(mutations_json) AND length(mutations_json) <= 24000)
) WITHOUT ROWID;

-- A single statement + trigger is atomic in D1; no reliance on changes() across
-- D1 batch statements. A failed fence/queue insert rolls back the receipt too.
CREATE TRIGGER IF NOT EXISTS explore_like_receipt_insert_390
AFTER INSERT ON explore_like_intake_receipts_390
BEGIN
  SELECT RAISE(ABORT, 'LIKE_RECEIPT_FENCE_CLOSED') WHERE NOT EXISTS(
    SELECT 1 FROM explore_like_cutover_control_174 WHERE id = 1 AND phase = 'open');
  INSERT INTO explore_like_batches_069(batch_id,user_uid,created_at,mutation_count,mutations_json)
    VALUES(NEW.queue_id,NEW.user_uid,NEW.accepted_at,NEW.mutation_count,NEW.mutations_json);
END;

CREATE TRIGGER IF NOT EXISTS explore_like_receipt_update_390
AFTER UPDATE ON explore_like_intake_receipts_390
BEGIN
  SELECT RAISE(ABORT, 'LIKE_RECEIPT_FENCE_CLOSED') WHERE NOT EXISTS(
    SELECT 1 FROM explore_like_cutover_control_174 WHERE id = 1 AND phase = 'open');
  INSERT INTO explore_like_batches_069(batch_id,user_uid,created_at,mutation_count,mutations_json)
    VALUES(NEW.queue_id,NEW.user_uid,NEW.accepted_at,NEW.mutation_count,NEW.mutations_json);
END;
