/*
 * SORIDRAW Backend V2 additive schema contract.
 *
 * Step 2-B is source-only: importing this module must never perform Firebase IO.
 * Unknown legacy song/playlist/settings payload fields are intentionally preserved.
 */

export const V2_SONG_SCHEMA_VERSION = 2 as const;

export const V2_SONG_REQUIRED_METADATA_FIELDS = Object.freeze([
  'schemaVersion',
  'musicNote',
  'recentVisible',
  'v2UpdatedAtMs',
] as const);

export const V2_SONG_MIGRATION_PROVENANCE_FIELDS = Object.freeze([
  'legacyRecentIndex',
  'legacyFavoriteId',
  'legacyFavoriteKey',
] as const);

// Step 2-A4a live fields are additive/optional so the already-verified historical
// V2 backfill remains valid. New live songs may carry the provider-neutral ID and
// deterministic mutation tie-breaker only after a later separately approved runtime step.
export const V2_SONG_LIVE_IDENTITY_FIELDS = Object.freeze([
  'soridrawSongId',
  'v2MutationId',
] as const);

export const V2_PRIVATE_SCHEMA_PATHS = Object.freeze({
  song: 'users/{uid}/songs/{songId}',
  playlist: 'users/{uid}/playlists/{playlistId}',
  playlistItem: 'users/{uid}/playlists/{playlistId}/items/{itemId}',
  sections: 'users/{uid}/settings/sections',
} as const);

export type V2SongMetadata = {
  schemaVersion: typeof V2_SONG_SCHEMA_VERSION;
  musicNote: boolean;
  recentVisible: boolean;
  v2UpdatedAtMs: number;
  // New live objects only. Historical backfill objects are intentionally allowed
  // to omit these fields until a separately approved compatibility/catch-up step.
  soridrawSongId?: string;
  v2MutationId?: string;
  legacyRecentIndex?: number;
  legacyFavoriteId?: string;
  legacyFavoriteKey?: string;
};
