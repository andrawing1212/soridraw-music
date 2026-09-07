-- SORIDRAW_PUBLICATION_HOTPATH_PRIMARY_GENRE_016_20260905
-- Stage 3: keep the primary browse genre on the canonical track row so Music Note
-- publication does not need track_tags writes just to appear in genre browsing.
-- Existing rows remain compatible; legacy rows continue to use track_tags fallback.
-- Apply only after PREVIEW D1 schema inspection is authorized and completed.

ALTER TABLE tracks ADD COLUMN primary_genre TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_public_primary_genre
ON tracks(is_public, status, primary_genre, published_at DESC, id DESC);
