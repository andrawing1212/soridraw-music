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
  legacyRecentIndex?: number;
  legacyFavoriteId?: string;
  legacyFavoriteKey?: string;
};
