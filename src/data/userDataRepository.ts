/*
 * SORIDRAW Backend V2 data-access contract.
 *
 * STEP 2-A SAFETY CONTRACT
 * - This module is intentionally side-effect free.
 * - It imports no Firebase SDK and performs no reads/writes/deletes.
 * - It is not wired into App.tsx or the generation pipeline yet.
 * - V1 remains the only active runtime storage path until a later approved step.
 * - V2 read/write/shadow-write/migrate-on-read/delete gates are all disabled.
 * - The dedicated Step 2-A CI gate verifies this contract, type-checks, and builds.
 *
 * This file centralizes path ownership and the future repository contract so later
 * migration work can be introduced behind explicit gates instead of scattering new
 * Firestore paths through UI/generation code.
 */

export type FirestorePathSegments = readonly [string, ...string[]];

const requireSegment = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.includes('/')) {
    throw new Error(`[Backend V2 path] invalid ${label}`);
  }
  return normalized;
};

export const BACKEND_V2_RUNTIME_MODE = 'v1-only' as const;

export const BACKEND_V2_SAFETY_GATES = Object.freeze({
  readFromV2: false,
  writeToV2: false,
  shadowWriteToV2: false,
  migrateOnRead: false,
  deleteV1: false,
});

/** Current production-compatible V1 paths. Do not rename during compatibility work. */
export const v1UserDataPaths = {
  user(uid: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid')];
  },
  recentSongs(uid: string): FirestorePathSegments {
    return ['user_recent_songs', requireSegment(uid, 'uid')];
  },
  favoritesCollection(): FirestorePathSegments {
    return ['favorites'];
  },
  favorite(favoriteId: string): FirestorePathSegments {
    return ['favorites', requireSegment(favoriteId, 'favoriteId')];
  },
  structures(uid: string): FirestorePathSegments {
    return ['user_structures', requireSegment(uid, 'uid')];
  },
  listBundle(uid: string, bundleId: string): FirestorePathSegments {
    return [
      'user_list_caches',
      requireSegment(uid, 'uid'),
      'bundles',
      requireSegment(bundleId, 'bundleId'),
    ];
  },
  playlistsCollection(uid: string): FirestorePathSegments {
    return ['user_playlists', requireSegment(uid, 'uid'), 'lists'];
  },
  playlist(uid: string, playlistId: string): FirestorePathSegments {
    return [
      'user_playlists',
      requireSegment(uid, 'uid'),
      'lists',
      requireSegment(playlistId, 'playlistId'),
    ];
  },
  playlistItemsCollection(uid: string, playlistId: string): FirestorePathSegments {
    return [
      'user_playlists',
      requireSegment(uid, 'uid'),
      'lists',
      requireSegment(playlistId, 'playlistId'),
      'items',
    ];
  },
  playlistItem(uid: string, playlistId: string, itemId: string): FirestorePathSegments {
    return [
      'user_playlists',
      requireSegment(uid, 'uid'),
      'lists',
      requireSegment(playlistId, 'playlistId'),
      'items',
      requireSegment(itemId, 'itemId'),
    ];
  },
} as const;

/**
 * Approved V2 destination paths from Step 1-D.
 * Defining a path here does NOT activate reads/writes to it.
 */
export const v2UserDataPaths = {
  user(uid: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid')];
  },
  songsCollection(uid: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid'), 'songs'];
  },
  song(uid: string, songId: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid'), 'songs', requireSegment(songId, 'songId')];
  },
  playlistsCollection(uid: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid'), 'playlists'];
  },
  playlist(uid: string, playlistId: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid'), 'playlists', requireSegment(playlistId, 'playlistId')];
  },
  playlistItemsCollection(uid: string, playlistId: string): FirestorePathSegments {
    return [
      'users',
      requireSegment(uid, 'uid'),
      'playlists',
      requireSegment(playlistId, 'playlistId'),
      'items',
    ];
  },
  playlistItem(uid: string, playlistId: string, itemId: string): FirestorePathSegments {
    return [
      'users',
      requireSegment(uid, 'uid'),
      'playlists',
      requireSegment(playlistId, 'playlistId'),
      'items',
      requireSegment(itemId, 'itemId'),
    ];
  },
  sectionsSettings(uid: string): FirestorePathSegments {
    return ['users', requireSegment(uid, 'uid'), 'settings', 'sections'];
  },
} as const;

/**
 * Future UI-facing repository boundary. Step 2-A only freezes the contract;
 * no implementation is connected to the running app yet.
 *
 * Payloads are generic on purpose: the first migration must preserve unknown legacy
 * song/playlist/settings fields rather than narrowing them to a new schema too early.
 */
export interface UserDataRepository<
  SongPayload extends Record<string, unknown> = Record<string, unknown>,
  PlaylistPayload extends Record<string, unknown> = Record<string, unknown>,
  PlaylistItemPayload extends Record<string, unknown> = Record<string, unknown>,
  SectionsPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  loadRecentSongs(uid: string): Promise<SongPayload[]>;
  loadMusicNotes(uid: string): Promise<SongPayload[]>;
  saveSong(uid: string, song: SongPayload): Promise<void>;
  setMusicNote(uid: string, songId: string, enabled: boolean): Promise<void>;
  loadPlaylists(uid: string): Promise<PlaylistPayload[]>;
  loadPlaylistItems(uid: string, playlistId: string): Promise<PlaylistItemPayload[]>;
  loadSections(uid: string): Promise<SectionsPayload | null>;
  saveSections(uid: string, payload: SectionsPayload): Promise<void>;
  syncUserData(uid: string): Promise<void>;
}

export const assertBackendV2MutationDisabled = (): void => {
  if (
    BACKEND_V2_SAFETY_GATES.writeToV2
    || BACKEND_V2_SAFETY_GATES.shadowWriteToV2
    || BACKEND_V2_SAFETY_GATES.migrateOnRead
    || BACKEND_V2_SAFETY_GATES.deleteV1
  ) {
    throw new Error('[Backend V2] mutation gate changed without an approved migration step');
  }
};
