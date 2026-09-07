-- SORIDRAW_PUBLIC_SHARE_BUNDLE_V1_20260905
-- Stage 2: keep one compact share/apply payload on the canonical tracks row.
-- Existing song/publication rows remain valid because the new columns are nullable/defaulted.
-- Do not apply this migration until the PREVIEW D1 schema is re-checked with authorized D1 access.

ALTER TABLE tracks ADD COLUMN share_schema_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN share_payload_json TEXT;
