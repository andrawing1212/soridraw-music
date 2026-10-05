-- SORIDRAW app334 publication write-fanout compaction.
-- User-approved shared D1 schema optimization.
-- No user row is deleted, rewritten, backfilled, or copied.
--
-- Proven by read-only preflight 37141297366:
-- - public-profile fallback can use idx_tracks_owner_latest; max tracks/owner=42, avg=22.
-- - owner+source_type queries already use idx_tracks_owner_source.
-- - title fallback search scans idx_tracks_latest_order, not idx_tracks_title.
-- - all 66 music_note rows have empty/null legacy_global_id.
--
-- Goals:
-- - source media swap: remove the unused owner+suno secondary-index write.
-- - profile pin: remove the profile_pinned secondary-index write.
-- - first publication: remove redundant index fanout while preserving search/feed/profile correctness.
-- - keep legacy_global_id uniqueness only where a legacy id actually exists.
-- - keep a missing-derived-profile repair on Music Note insert, but retire obsolete track_count writes
--   because PREVIEW/TEST/PRODUCTION derivedProfile032 reads canonical COUNT(*) from tracks.

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_legacy_global_nonempty
ON tracks (legacy_global_id)
WHERE legacy_global_id IS NOT NULL AND TRIM(legacy_global_id) <> '';

DROP INDEX IF EXISTS idx_tracks_legacy_global;
DROP INDEX IF EXISTS idx_tracks_owner_suno_url;
DROP INDEX IF EXISTS idx_tracks_source_type_latest;
DROP INDEX IF EXISTS idx_tracks_owner_profile_order;
DROP INDEX IF EXISTS idx_tracks_title;

DROP TRIGGER IF EXISTS explore079_music_note_derived_track_insert;
CREATE TRIGGER explore079_music_note_derived_track_insert
AFTER INSERT ON explore_derived_tracks
WHEN COALESCE(json_extract(NEW.row_json, '$.source_type'), '') = 'music_note'
BEGIN
  INSERT INTO explore_derived_profiles(uid)
  SELECT NEW.owner_uid
  WHERE NOT EXISTS (
    SELECT 1 FROM explore_derived_profiles WHERE uid = NEW.owner_uid
  );
END;
