/*
 * SORIDRAW Backend V2 Step 2-A2 — V1 compatibility adapter.
 *
 * SAFETY CONTRACT
 * - Pure dependency-injected read adapter: no Firebase SDK/runtime imports.
 * - Not wired into App.tsx, generation, Music Note mutations, playlists, or player.
 * - Performs no writes/deletes and exposes no write/delete port.
 * - Uses V1 paths only. V2 paths are intentionally unavailable here.
 * - Returns legacy payloads without schema conversion so unknown V1 fields survive.
 *
 * This module exists to prove current V1 path/read semantics behind one boundary
 * before any live call-site is switched. Mutation activation is a later explicit gate.
 */

import {
  BACKEND_V2_RUNTIME_MODE,
  BACKEND_V2_SAFETY_GATES,
  v1UserDataPaths,
  type FirestorePathSegments,
} from './userDataRepository';

export type V1WhereFilter = Readonly<{
  field: string;
  op: '==';
  value: unknown;
}>;

export type V1DocumentSnapshot<Payload extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  id: string;
  exists: boolean;
  data: Payload | null;
}>;

export type V1CollectionDocument<Payload extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  id: string;
  data: Payload;
}>;

/**
 * The only capabilities Step 2-A2 may receive.
 * There is intentionally no set/update/delete/batch/transaction function here.
 */
export interface V1ReadPort {
  getDocument<Payload extends Record<string, unknown> = Record<string, unknown>>(
    path: FirestorePathSegments,
  ): Promise<V1DocumentSnapshot<Payload>>;

  listCollection<Payload extends Record<string, unknown> = Record<string, unknown>>(
    path: FirestorePathSegments,
  ): Promise<readonly V1CollectionDocument<Payload>[]>;

  queryCollection<Payload extends Record<string, unknown> = Record<string, unknown>>(
    path: FirestorePathSegments,
    filters: readonly V1WhereFilter[],
  ): Promise<readonly V1CollectionDocument<Payload>[]>;
}

export type LegacyRecentSongsDocument<SongPayload extends Record<string, unknown> = Record<string, unknown>> =
  Record<string, unknown> & {
    songs?: SongPayload[];
  };

export type V1FavoriteDocument<Payload extends Record<string, unknown> = Record<string, unknown>> =
  V1CollectionDocument<Payload>;

export type V1PlaylistDocument<Payload extends Record<string, unknown> = Record<string, unknown>> =
  V1CollectionDocument<Payload>;

/** Match the existing `a.order - b.order` behavior, including NaN/stable-sort cases. */
const compareLegacyOrder = (a: unknown, b: unknown): number => Number(a) - Number(b);

const assertV1Only = (): void => {
  if (BACKEND_V2_RUNTIME_MODE !== 'v1-only') {
    throw new Error('[Backend V2 Step 2-A2] V1 adapter requires v1-only runtime mode');
  }
  if (
    BACKEND_V2_SAFETY_GATES.readFromV2
    || BACKEND_V2_SAFETY_GATES.writeToV2
    || BACKEND_V2_SAFETY_GATES.shadowWriteToV2
    || BACKEND_V2_SAFETY_GATES.migrateOnRead
    || BACKEND_V2_SAFETY_GATES.deleteV1
  ) {
    throw new Error('[Backend V2 Step 2-A2] V2 gate changed while V1 compatibility adapter is active');
  }
};

export const createV1UserDataAdapter = (port: V1ReadPort) => {
  if (!port || typeof port.getDocument !== 'function' || typeof port.listCollection !== 'function' || typeof port.queryCollection !== 'function') {
    throw new Error('[Backend V2 Step 2-A2] complete read-only V1 port is required');
  }

  assertV1Only();

  return Object.freeze({
    /** Preserves the current user root authority/sync-version document as an opaque payload. */
    async loadUserDocument<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
    ): Promise<V1DocumentSnapshot<Payload>> {
      assertV1Only();
      return port.getDocument<Payload>(v1UserDataPaths.user(uid));
    },

    /** Preserves the current whole-document `songs[]` source shape. */
    async loadRecentSongs<SongPayload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
    ): Promise<SongPayload[]> {
      assertV1Only();
      const snapshot = await port.getDocument<LegacyRecentSongsDocument<SongPayload>>(
        v1UserDataPaths.recentSongs(uid),
      );
      if (!snapshot.exists || !snapshot.data || !Array.isArray(snapshot.data.songs)) return [];
      return snapshot.data.songs;
    },

    /**
     * Compatibility/recovery query for raw favorite documents by uid.
     * Do not wire this unbounded method into routine startup; existing bounded/paginated
     * Music Note reads remain authoritative until a separately reviewed activation step.
     * No content-hash identity, hidden-state interpretation, dedupe, or schema rewrite is done here.
     */
    async loadFavoriteDocuments<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
    ): Promise<readonly V1FavoriteDocument<Payload>[]> {
      assertV1Only();
      return port.queryCollection<Payload>(
        v1UserDataPaths.favoritesCollection(),
        [{ field: 'uid', op: '==', value: uid }],
      );
    },

    /** Preserves the current section-custom document as an opaque legacy payload. */
    async loadSectionsDocument<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
    ): Promise<V1DocumentSnapshot<Payload>> {
      assertV1Only();
      return port.getDocument<Payload>(v1UserDataPaths.structures(uid));
    },

    /** Mirrors playlist type query + current `a.order - b.order` presentation semantics. */
    async loadPlaylistsByType<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
      type: 'normal' | 'shared',
    ): Promise<V1PlaylistDocument<Payload>[]> {
      assertV1Only();
      const docs = await port.queryCollection<Payload>(
        v1UserDataPaths.playlistsCollection(uid),
        [{ field: 'type', op: '==', value: type }],
      );
      return [...docs].sort((a, b) => compareLegacyOrder(a.data.order, b.data.order));
    },

    /** Reads playlist items without changing IDs/source/order/color payload fields. */
    async loadPlaylistItems<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
      playlistId: string,
    ): Promise<readonly V1CollectionDocument<Payload>[]> {
      assertV1Only();
      return port.listCollection<Payload>(v1UserDataPaths.playlistItemsCollection(uid, playlistId));
    },

    /** Exposes the exact V1 bundle document path for compatibility inspection only. */
    async loadListBundle<Payload extends Record<string, unknown> = Record<string, unknown>>(
      uid: string,
      bundleId: 'music_note_latest_20' | 'library_latest_10_sets',
    ): Promise<V1DocumentSnapshot<Payload>> {
      assertV1Only();
      return port.getDocument<Payload>(v1UserDataPaths.listBundle(uid, bundleId));
    },
  });
};
