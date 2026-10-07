-- SORIDRAW follow authority lifecycle 378 control guard.
-- User-approved cutover preparation. System metadata only: no user relation/profile rows.

INSERT INTO explore_follow_cutover_control_348(
  id, phase, schema_version, cutover_token, updated_at
)
VALUES(1, 'legacy', 1, '', 0)
ON CONFLICT(id) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS explore_follow_cutover_control_348_no_downgrade
BEFORE UPDATE OF phase, schema_version, cutover_token
ON explore_follow_cutover_control_348
WHEN OLD.phase IN ('overlay','readonly')
  AND (
    NEW.phase IN ('legacy','armed')
    OR NEW.schema_version <> OLD.schema_version
    OR NEW.cutover_token <> OLD.cutover_token
  )
BEGIN
  SELECT RAISE(ABORT, 'follow authority downgrade blocked');
END;

CREATE TRIGGER IF NOT EXISTS explore_follow_cutover_control_348_no_delete
BEFORE DELETE ON explore_follow_cutover_control_348
WHEN OLD.phase IN ('overlay','readonly')
BEGIN
  SELECT RAISE(ABORT, 'follow authority latch delete blocked');
END;
