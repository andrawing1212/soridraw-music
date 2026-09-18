-- SORIDRAW_PUBLICATION_BUNDLE_TRIGGER_CLEANUP_20260905
--
-- Stage 1 of Explore publication data cleanup.
-- These triggers rebuild the full owner's music-note publication bundle on every
-- matching track mutation. That makes mutation cost grow with the owner's data.
--
-- Safety:
-- - Keep the derived table itself for rollback/forensics.
-- - Do not delete canonical tracks.
-- - Apply only after the R2 publication bundle is seeded/verified and the Worker
--   route has been switched to the R2-backed bundle handler.

DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_insert;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_new;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_update_old;
DROP TRIGGER IF EXISTS trg_music_note_publication_bundle_delete;
