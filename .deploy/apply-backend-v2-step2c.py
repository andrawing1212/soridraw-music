from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CACHE_PATH = ROOT / 'src/data/indexedDbLocalCache.ts'
CONTRACT_PATH = ROOT / 'src/data/indexedDbLocalCache.contract.ts'
REPORT_PATH = ROOT / 'docs/SORIDRAW_BACKEND_V2_STEP2C_INDEXEDDB_LOCAL_FIRST.md'
MASTER_PATH = ROOT / 'docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md'

CACHE_SOURCE = r'''/*
 * SORIDRAW Backend V2 IndexedDB/local-first cache scaffold.
 *
 * STEP 2-C SAFETY CONTRACT
 * - IndexedDB is an expendable local cache, never the cross-device source-of-truth.
 * - This module imports no Firebase SDK and performs no network/server IO.
 * - It is not wired into runtime UI/generation paths in Step 2-C.
 * - V1 Firestore/server bundle reads remain the compatibility fallback.
 * - Song payloads are stored once as canonical local entities; Recent/Music Note are ID views.
 * - Unknown song/playlist/settings payload fields are preserved through structured clone.
 * - No content hash/title/lyrics/prompt dedupe exists here.
 */

export const BACKEND_V2_LOCAL_CACHE_RUNTIME_ENABLED = false as const;
export const BACKEND_V2_LOCAL_CACHE_DB_NAME = 'soridraw_backend_v2_local_cache';
export const BACKEND_V2_LOCAL_CACHE_DB_VERSION = 1;

export const BACKEND_V2_LOCAL_CACHE_STORES = Object.freeze({
  entities: 'entities',
  views: 'views',
  meta: 'meta',
});

export type LocalCacheEntityKind = 'song' | 'playlist' | 'playlistItem' | 'sectionSettings';
export type LocalSongViewKind = 'recentSongs' | 'musicNote';
export type LocalCacheReadStatus = 'fresh' | 'stale' | 'miss' | 'unavailable' | 'incomplete';

export type LocalCachePayload = Record<string, unknown>;

export type LocalCacheEntityInput<T extends LocalCachePayload = LocalCachePayload> = {
  id: string;
  payload: T;
};

export type LocalCacheReadResult<T extends LocalCachePayload = LocalCachePayload> = {
  status: LocalCacheReadStatus;
  entries: Array<LocalCacheEntityInput<T>>;
  cachedVersion: number | null;
  fallbackRequired: boolean;
};

export type LocalSongViewReadResult<T extends LocalCachePayload = LocalCachePayload> = LocalCacheReadResult<T> & {
  orderedSongIds: string[];
  missingSongIds: string[];
};

type StoredEntity = {
  cacheKey: string;
  uid: string;
  kind: LocalCacheEntityKind;
  entityId: string;
  parentId: string;
  payload: LocalCachePayload;
  position: number;
  cachedAtMs: number;
};

type StoredSongView = {
  cacheKey: string;
  uid: string;
  viewKind: LocalSongViewKind;
  orderedSongIds: string[];
  versionToken: number | null;
  cachedAtMs: number;
};

type StoredScopeMeta = {
  cacheKey: string;
  uid: string;
  scopeKey: string;
  versionToken: number | null;
  cachedAtMs: number;
};

type KeyRangeFactory = {
  only(value: IDBValidKey | IDBKeyRange): IDBKeyRange;
};

export type BackendV2IndexedDbCacheOptions = {
  factory?: IDBFactory | null;
  keyRange?: KeyRangeFactory | null;
  dbName?: string;
  now?: () => number;
};

const requireSegment = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`[Backend V2 local cache] missing ${label}`);
  return normalized;
};

const normalizeParentId = (value?: string): string => String(value || '').trim();
const encodeKeyPart = (value: string): string => encodeURIComponent(value);

const makeEntityCacheKey = (
  uid: string,
  kind: LocalCacheEntityKind,
  entityId: string,
  parentId = '',
) => [uid, kind, parentId, entityId].map((part) => encodeKeyPart(part)).join('::');

const makeScopeKey = (kind: LocalCacheEntityKind, parentId = '') => (
  `${kind}:${encodeKeyPart(parentId)}`
);

const makeMetaCacheKey = (uid: string, scopeKey: string) => (
  `${encodeKeyPart(uid)}::${encodeKeyPart(scopeKey)}`
);

const makeViewCacheKey = (uid: string, viewKind: LocalSongViewKind) => (
  `${encodeKeyPart(uid)}::${viewKind}`
);

const normalizeVersionToken = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('[Backend V2 local cache] version token must be a non-negative integer');
  }
  return value;
};

const assertUniqueEntityIds = (entries: Array<LocalCacheEntityInput>) => {
  const seen = new Set<string>();
  entries.forEach((entry) => {
    const id = requireSegment(entry.id, 'entityId');
    if (seen.has(id)) {
      throw new Error(`[Backend V2 local cache] duplicate entity id in one snapshot: ${id}`);
    }
    seen.add(id);
    if (!entry.payload || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) {
      throw new Error(`[Backend V2 local cache] invalid payload for ${id}`);
    }
  });
};

export const evaluateLocalCacheVersion = (
  hasSnapshot: boolean,
  cachedVersion: number | null,
  expectedVersion?: number | null,
): LocalCacheReadStatus => {
  if (!hasSnapshot) return 'miss';
  if (expectedVersion === undefined || expectedVersion === null) return 'stale';
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return 'stale';
  return cachedVersion === expectedVersion ? 'fresh' : 'stale';
};

const requestToPromise = <T,>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

export class BackendV2IndexedDbCache {
  private readonly factory: IDBFactory | null;
  private readonly keyRange: KeyRangeFactory | null;
  private readonly dbName: string;
  private readonly now: () => number;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(options: BackendV2IndexedDbCacheOptions = {}) {
    this.factory = options.factory === undefined
      ? (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis ? globalThis.indexedDB : null)
      : options.factory;
    this.keyRange = options.keyRange === undefined
      ? (typeof globalThis !== 'undefined' && 'IDBKeyRange' in globalThis ? globalThis.IDBKeyRange : null)
      : options.keyRange;
    this.dbName = String(options.dbName || BACKEND_V2_LOCAL_CACHE_DB_NAME);
    this.now = options.now || (() => Date.now());
  }

  isAvailable(): boolean {
    return Boolean(this.factory && this.keyRange);
  }

  private async open(): Promise<IDBDatabase | null> {
    if (!this.factory || !this.keyRange) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let settled = false;
      const request = this.factory!.open(this.dbName, BACKEND_V2_LOCAL_CACHE_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BACKEND_V2_LOCAL_CACHE_STORES.entities)) {
          const store = db.createObjectStore(BACKEND_V2_LOCAL_CACHE_STORES.entities, { keyPath: 'cacheKey' });
          store.createIndex('byUser', 'uid', { unique: false });
          store.createIndex('byUserKindParent', ['uid', 'kind', 'parentId'], { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_V2_LOCAL_CACHE_STORES.views)) {
          const store = db.createObjectStore(BACKEND_V2_LOCAL_CACHE_STORES.views, { keyPath: 'cacheKey' });
          store.createIndex('byUser', 'uid', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_V2_LOCAL_CACHE_STORES.meta)) {
          const store = db.createObjectStore(BACKEND_V2_LOCAL_CACHE_STORES.meta, { keyPath: 'cacheKey' });
          store.createIndex('byUser', 'uid', { unique: false });
        }
      };

      request.onsuccess = () => {
        settled = true;
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        if (!settled) resolve(null);
      };

      request.onblocked = () => {
        if (!settled) resolve(null);
      };
    });

    const db = await this.dbPromise;
    if (!db) this.dbPromise = null;
    return db;
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db?.close();
    this.dbPromise = null;
  }

  async replaceEntityCollection<T extends LocalCachePayload>(
    uidInput: string,
    kind: LocalCacheEntityKind,
    entriesInput: Array<LocalCacheEntityInput<T>>,
    options: { parentId?: string; versionToken?: number | null } = {},
  ): Promise<boolean> {
    const uid = requireSegment(uidInput, 'uid');
    const parentId = normalizeParentId(options.parentId);
    const entries = entriesInput as Array<LocalCacheEntityInput>;
    assertUniqueEntityIds(entries);
    const versionToken = normalizeVersionToken(options.versionToken);
    const db = await this.open();
    if (!db || !this.keyRange) return false;

    try {
      const transaction = db.transaction(
        [BACKEND_V2_LOCAL_CACHE_STORES.entities, BACKEND_V2_LOCAL_CACHE_STORES.meta],
        'readwrite',
      );
      const store = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.entities);
      const metaStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.meta);
      const scopeKey = makeScopeKey(kind, parentId);
      const range = this.keyRange.only([uid, kind, parentId]);
      const index = store.index('byUserKindParent');
      const cursorRequest = index.openKeyCursor(range);
      const cachedAtMs = this.now();

      const queued = new Promise<void>((resolve, reject) => {
        cursorRequest.onerror = () => reject(cursorRequest.error || new Error('IndexedDB cursor failed'));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
            return;
          }

          entries.forEach((entry, position) => {
            const entityId = requireSegment(entry.id, 'entityId');
            const stored: StoredEntity = {
              cacheKey: makeEntityCacheKey(uid, kind, entityId, parentId),
              uid,
              kind,
              entityId,
              parentId,
              payload: entry.payload,
              position,
              cachedAtMs,
            };
            store.put(stored);
          });

          const meta: StoredScopeMeta = {
            cacheKey: makeMetaCacheKey(uid, scopeKey),
            uid,
            scopeKey,
            versionToken,
            cachedAtMs,
          };
          metaStore.put(meta);
          resolve();
        };
      });

      await Promise.all([queued, transactionDone(transaction)]);
      return true;
    } catch {
      return false;
    }
  }

  async readEntityCollection<T extends LocalCachePayload>(
    uidInput: string,
    kind: LocalCacheEntityKind,
    options: { parentId?: string; expectedVersion?: number | null } = {},
  ): Promise<LocalCacheReadResult<T>> {
    const uid = requireSegment(uidInput, 'uid');
    const parentId = normalizeParentId(options.parentId);
    const unavailable: LocalCacheReadResult<T> = {
      status: 'unavailable',
      entries: [],
      cachedVersion: null,
      fallbackRequired: true,
    };
    const db = await this.open();
    if (!db || !this.keyRange) return unavailable;

    try {
      const transaction = db.transaction(
        [BACKEND_V2_LOCAL_CACHE_STORES.entities, BACKEND_V2_LOCAL_CACHE_STORES.meta],
        'readonly',
      );
      const store = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.entities);
      const metaStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.meta);
      const scopeKey = makeScopeKey(kind, parentId);
      const recordRequest = store.index('byUserKindParent').getAll(this.keyRange.only([uid, kind, parentId]));
      const metaRequest = metaStore.get(makeMetaCacheKey(uid, scopeKey));
      const [recordsRaw, metaRaw] = await Promise.all([
        requestToPromise(recordRequest),
        requestToPromise(metaRequest),
      ]);
      await transactionDone(transaction);

      const records = (recordsRaw as StoredEntity[])
        .slice()
        .sort((a, b) => a.position - b.position);
      const meta = metaRaw as StoredScopeMeta | undefined;
      const cachedVersion = meta?.versionToken ?? null;
      const status = evaluateLocalCacheVersion(Boolean(meta), cachedVersion, options.expectedVersion);

      return {
        status,
        entries: records.map((record) => ({ id: record.entityId, payload: record.payload as T })),
        cachedVersion,
        fallbackRequired: status !== 'fresh',
      };
    } catch {
      return unavailable;
    }
  }

  async cacheSongViewSnapshot<T extends LocalCachePayload>(
    uidInput: string,
    viewKind: LocalSongViewKind,
    songsInput: Array<LocalCacheEntityInput<T>>,
    orderedSongIdsInput: string[],
    versionTokenInput?: number | null,
  ): Promise<boolean> {
    const uid = requireSegment(uidInput, 'uid');
    const songs = songsInput as Array<LocalCacheEntityInput>;
    assertUniqueEntityIds(songs);
    const orderedSongIds = orderedSongIdsInput.map((id) => requireSegment(id, 'songId'));
    const versionToken = normalizeVersionToken(versionTokenInput);
    const db = await this.open();
    if (!db) return false;

    try {
      const transaction = db.transaction(
        [BACKEND_V2_LOCAL_CACHE_STORES.entities, BACKEND_V2_LOCAL_CACHE_STORES.views],
        'readwrite',
      );
      const entityStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.entities);
      const viewStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.views);
      const cachedAtMs = this.now();

      songs.forEach((song, position) => {
        const entityId = requireSegment(song.id, 'songId');
        const stored: StoredEntity = {
          cacheKey: makeEntityCacheKey(uid, 'song', entityId),
          uid,
          kind: 'song',
          entityId,
          parentId: '',
          payload: song.payload,
          position,
          cachedAtMs,
        };
        entityStore.put(stored);
      });

      const view: StoredSongView = {
        cacheKey: makeViewCacheKey(uid, viewKind),
        uid,
        viewKind,
        orderedSongIds: [...orderedSongIds],
        versionToken,
        cachedAtMs,
      };
      viewStore.put(view);

      await transactionDone(transaction);
      return true;
    } catch {
      return false;
    }
  }

  async readSongView<T extends LocalCachePayload>(
    uidInput: string,
    viewKind: LocalSongViewKind,
    expectedVersion?: number | null,
  ): Promise<LocalSongViewReadResult<T>> {
    const uid = requireSegment(uidInput, 'uid');
    const unavailable: LocalSongViewReadResult<T> = {
      status: 'unavailable',
      entries: [],
      orderedSongIds: [],
      missingSongIds: [],
      cachedVersion: null,
      fallbackRequired: true,
    };
    const db = await this.open();
    if (!db) return unavailable;

    try {
      const transaction = db.transaction(
        [BACKEND_V2_LOCAL_CACHE_STORES.entities, BACKEND_V2_LOCAL_CACHE_STORES.views],
        'readonly',
      );
      const entityStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.entities);
      const viewStore = transaction.objectStore(BACKEND_V2_LOCAL_CACHE_STORES.views);
      const view = await requestToPromise(viewStore.get(makeViewCacheKey(uid, viewKind))) as StoredSongView | undefined;

      if (!view) {
        await transactionDone(transaction);
        return {
          status: 'miss',
          entries: [],
          orderedSongIds: [],
          missingSongIds: [],
          cachedVersion: null,
          fallbackRequired: true,
        };
      }

      const entityRequests = view.orderedSongIds.map((songId) => (
        requestToPromise(entityStore.get(makeEntityCacheKey(uid, 'song', songId)))
      ));
      const entities = await Promise.all(entityRequests) as Array<StoredEntity | undefined>;
      await transactionDone(transaction);

      const missingSongIds: string[] = [];
      const entries: Array<LocalCacheEntityInput<T>> = [];
      entities.forEach((entity, index) => {
        const songId = view.orderedSongIds[index];
        if (!entity) {
          missingSongIds.push(songId);
          return;
        }
        entries.push({ id: songId, payload: entity.payload as T });
      });

      const baseStatus = evaluateLocalCacheVersion(true, view.versionToken, expectedVersion);
      const status: LocalCacheReadStatus = missingSongIds.length > 0 ? 'incomplete' : baseStatus;
      return {
        status,
        entries,
        orderedSongIds: [...view.orderedSongIds],
        missingSongIds,
        cachedVersion: view.versionToken,
        fallbackRequired: status !== 'fresh',
      };
    } catch {
      return unavailable;
    }
  }

  async clearUserCache(uidInput: string): Promise<boolean> {
    const uid = requireSegment(uidInput, 'uid');
    const db = await this.open();
    if (!db || !this.keyRange) return false;

    const deleteByUser = (
      transaction: IDBTransaction,
      storeName: string,
    ): Promise<void> => new Promise((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.index('byUser').openKeyCursor(this.keyRange!.only(uid));
      request.onerror = () => reject(request.error || new Error('IndexedDB clear cursor failed'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
    });

    try {
      const transaction = db.transaction(
        [
          BACKEND_V2_LOCAL_CACHE_STORES.entities,
          BACKEND_V2_LOCAL_CACHE_STORES.views,
          BACKEND_V2_LOCAL_CACHE_STORES.meta,
        ],
        'readwrite',
      );
      await Promise.all([
        deleteByUser(transaction, BACKEND_V2_LOCAL_CACHE_STORES.entities),
        deleteByUser(transaction, BACKEND_V2_LOCAL_CACHE_STORES.views),
        deleteByUser(transaction, BACKEND_V2_LOCAL_CACHE_STORES.meta),
        transactionDone(transaction),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

// Creating this object is inert. IndexedDB is opened only if a future approved runtime caller invokes it.
export const backendV2IndexedDbCache = new BackendV2IndexedDbCache();
'''

CONTRACT_SOURCE = r'''import assert from 'node:assert/strict';
import { IDBKeyRange as FakeIDBKeyRange, indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import {
  BACKEND_V2_LOCAL_CACHE_RUNTIME_ENABLED,
  BackendV2IndexedDbCache,
  evaluateLocalCacheVersion,
} from './indexedDbLocalCache';

const makeCache = (name: string) => new BackendV2IndexedDbCache({
  factory: fakeIndexedDB as unknown as IDBFactory,
  keyRange: FakeIDBKeyRange as unknown as { only(value: IDBValidKey | IDBKeyRange): IDBKeyRange },
  dbName: name,
  now: () => 123456789,
});

const run = async () => {
  assert.equal(BACKEND_V2_LOCAL_CACHE_RUNTIME_ENABLED, false);
  assert.equal(evaluateLocalCacheVersion(false, null, 1), 'miss');
  assert.equal(evaluateLocalCacheVersion(true, 4, 4), 'fresh');
  assert.equal(evaluateLocalCacheVersion(true, 4, 5), 'stale');
  assert.equal(evaluateLocalCacheVersion(true, 4, undefined), 'stale');

  const cache = makeCache(`soridraw-v2-step2c-${Date.now()}`);
  assert.equal(cache.isAvailable(), true);

  assert.equal(await cache.cacheSongViewSnapshot(
    'user-a',
    'recentSongs',
    [
      { id: 'song-1', payload: { title: 'One', unknownLegacyField: { keep: true } } },
      { id: 'song-2', payload: { title: 'Two', lyrics: 'preserve me' } },
    ],
    ['song-2', 'song-1'],
    11,
  ), true);

  const freshRecent = await cache.readSongView('user-a', 'recentSongs', 11);
  assert.equal(freshRecent.status, 'fresh');
  assert.equal(freshRecent.fallbackRequired, false);
  assert.deepEqual(freshRecent.entries.map((entry) => entry.id), ['song-2', 'song-1']);
  assert.deepEqual(freshRecent.entries[1].payload.unknownLegacyField, { keep: true });

  const staleRecent = await cache.readSongView('user-a', 'recentSongs', 12);
  assert.equal(staleRecent.status, 'stale');
  assert.equal(staleRecent.fallbackRequired, true);

  // Music Note is an ID view over the same canonical local song entity, not a second full song database.
  assert.equal(await cache.cacheSongViewSnapshot('user-a', 'musicNote', [], ['song-1'], 21), true);
  const musicNote = await cache.readSongView('user-a', 'musicNote', 21);
  assert.equal(musicNote.status, 'fresh');
  assert.deepEqual(musicNote.entries.map((entry) => entry.id), ['song-1']);

  // A view that references a missing canonical entity must force V1/server fallback.
  assert.equal(await cache.cacheSongViewSnapshot('user-a', 'musicNote', [], ['song-missing'], 22), true);
  const incomplete = await cache.readSongView('user-a', 'musicNote', 22);
  assert.equal(incomplete.status, 'incomplete');
  assert.deepEqual(incomplete.missingSongIds, ['song-missing']);
  assert.equal(incomplete.fallbackRequired, true);

  // Empty collections can still be a fresh authoritative cache snapshot when a version token matches.
  assert.equal(await cache.replaceEntityCollection('user-a', 'playlist', [], { versionToken: 7 }), true);
  const emptyPlaylists = await cache.readEntityCollection('user-a', 'playlist', { expectedVersion: 7 });
  assert.equal(emptyPlaylists.status, 'fresh');
  assert.deepEqual(emptyPlaylists.entries, []);

  // Without an authority/version token, local data may render optimistically later but must still revalidate via V1.
  assert.equal(await cache.replaceEntityCollection('user-a', 'playlistItem', [
    { id: 'item-1', payload: { order: 3, colorTag: 'amber', customProviderField: 'keep' } },
  ], { parentId: 'playlist-1' }), true);
  const playlistItems = await cache.readEntityCollection('user-a', 'playlistItem', { parentId: 'playlist-1' });
  assert.equal(playlistItems.status, 'stale');
  assert.equal(playlistItems.fallbackRequired, true);
  assert.equal(playlistItems.entries[0].payload.customProviderField, 'keep');

  // Never silently collapse two records in the same snapshot.
  await assert.rejects(
    () => cache.replaceEntityCollection('user-a', 'playlist', [
      { id: 'dup', payload: { title: 'A' } },
      { id: 'dup', payload: { title: 'B' } },
    ]),
    /duplicate entity id/,
  );

  // Per-user cache clearing must not affect another user.
  assert.equal(await cache.replaceEntityCollection('user-b', 'sectionSettings', [
    { id: 'sections', payload: { customSections: ['keep-b'] } },
  ], { versionToken: 9 }), true);
  assert.equal(await cache.clearUserCache('user-a'), true);
  const userAAfterClear = await cache.readSongView('user-a', 'recentSongs', 11);
  assert.equal(userAAfterClear.status, 'miss');
  const userBAfterClear = await cache.readEntityCollection('user-b', 'sectionSettings', { expectedVersion: 9 });
  assert.equal(userBAfterClear.status, 'fresh');
  assert.deepEqual(userBAfterClear.entries[0].payload.customSections, ['keep-b']);

  await cache.close();

  const unavailable = new BackendV2IndexedDbCache({ factory: null, keyRange: null });
  assert.equal(unavailable.isAvailable(), false);
  const unavailableRead = await unavailable.readSongView('user-a', 'recentSongs', 1);
  assert.equal(unavailableRead.status, 'unavailable');
  assert.equal(unavailableRead.fallbackRequired, true);

  console.log('Backend V2 Step 2-C IndexedDB local-first contract PASS');
};

await run();
'''

REPORT_SOURCE = r'''# SORIDRAW Backend V2 · Step 2-C IndexedDB / Local-first Scaffold

Status: COMPLETE IN SOURCE / RUNTIME NOT ACTIVATED
Date: 2026-08-25 KST
Working branch: `preview`

## Scope
Step 2-C adds an explicit IndexedDB cache layer only. It does not change active V1 reads/writes, song generation, Music Note mutations, playlist mutations, Firebase Rules, Functions, or Hosting.

## Local cache model
Database: `soridraw_backend_v2_local_cache`, schema version 1.

Stores:
- `entities`: canonical local entities (`song`, `playlist`, `playlistItem`, `sectionSettings`)
- `views`: ID-only song views (`recentSongs`, `musicNote`)
- `meta`: per-scope local version metadata

The local song payload is stored once. Recent Songs and Music Note keep ordered song IDs instead of duplicating full song payloads.

## Local-first decision rule
- matching known authority/version token -> `fresh`, server fallback not required
- missing version / mismatch -> `stale`, V1/server revalidation required
- missing cache -> `miss`, V1/server fallback required
- IndexedDB unavailable/restricted -> `unavailable`, V1/server fallback required
- view points to a missing canonical local song -> `incomplete`, V1/server fallback required

Step 2-C does not call the fallback itself. It only returns the decision so a later approved repository activation can preserve exact V1 behavior and avoid accidental parallel reads.

## Data safety
- no Firebase imports or network calls
- no automatic runtime import outside `src/data`
- no content-hash/title/lyrics/prompt dedupe
- duplicate entity IDs in one cache snapshot are rejected rather than silently overwritten
- unknown legacy payload fields are stored as opaque structured-clone payloads
- per-user clear deletes only this expendable IndexedDB cache
- no Firestore/Auth/RTDB data is deleted or mutated

## V1 compatibility
- `user_list_caches` server bundles remain untouched and available as compatibility fallback
- existing `syncVersions` fields remain unchanged
- no new `songs` sync-version field is forced in Step 2-C
- playlist cache without an explicit authority/version token remains stale-by-design, so it cannot suppress required V1 validation
- Suno/provider Library content is not made a canonical local dependency in this step

## Validation
The Step 2-C CI gate verifies:
- exact approved file scope
- no Firebase/network/runtime wiring in the new module
- no protected V1/runtime file changes
- pure version-decision contract
- actual IndexedDB CRUD/view behavior through `fake-indexeddb` in CI without adding it to app dependencies
- canonical song + ID-only Music Note/Recent views
- unknown field preservation
- missing-entity fallback
- empty fresh snapshot behavior
- duplicate-ID rejection
- user-isolated cache clearing
- IndexedDB-unavailable fallback
- TypeScript compile
- production Vite build without legacy lifecycle patch scripts

## Firebase / cost result
- Firestore reads: 0
- Firestore writes: 0
- Firestore deletes: 0
- RTDB operations: 0
- Rules/index deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- new routine server reads: 0

## Next gate
Step 2-D may add disabled-by-default shadow-write/validator/dry-run migration scaffolding. No V2 dual-write or historical backfill may be activated without a separate explicit approval.
'''


def write_exact(path: Path, content: str) -> None:
    if path.exists():
        existing = path.read_text(encoding='utf-8')
        if existing == content:
            return
        raise SystemExit(f'refusing to overwrite unexpected existing file: {path.relative_to(ROOT)}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


write_exact(CACHE_PATH, CACHE_SOURCE)
write_exact(CONTRACT_PATH, CONTRACT_SOURCE)
write_exact(REPORT_PATH, REPORT_SOURCE)

master = MASTER_PATH.read_text(encoding='utf-8')
master = master.replace(
    'Status: IMPLEMENTATION / Step 2-B complete in source — awaiting approval for 2-C',
    'Status: IMPLEMENTATION / Step 2-C complete in source — awaiting approval for 2-D',
)

section_marker = '### 2-C complete — IndexedDB/local-first scaffold'
if section_marker not in master:
    insert_before = '\n## 9. Work stages and progress tracker\n'
    section = r'''
### 2-C complete — IndexedDB/local-first scaffold
- Added `src/data/indexedDbLocalCache.ts` with native IndexedDB only; no Firebase/network dependency and no automatic runtime IO.
- Local songs are canonical entities; Recent Songs and Music Note are ordered ID-only views over the same song payload.
- Playlists/items/settings can be cached as opaque payloads while preserving unknown fields and IDs.
- Known matching version token is required for a `fresh` decision. Missing/mismatched authority forces V1/server fallback.
- IndexedDB unavailable, cache miss, or incomplete song view also forces V1/server fallback.
- Existing `user_list_caches` server bundles and current `syncVersions` remain untouched as compatibility/recovery paths.
- No new `songs` sync-version key is forced and Suno/provider Library content is not made a canonical dependency.
- Runtime activation flag remains false and no file outside `src/data` imports the new cache module in Step 2-C.
- CI exercises actual IndexedDB behavior with an ephemeral test-only `fake-indexeddb` install; it is not added to app dependencies.
- No Firestore/RTDB operation, Rules/index deploy, Functions deploy, Firebase Hosting deploy, V1 delete, or main-branch change occurs in Step 2-C.
'''
    if insert_before not in master:
        raise SystemExit('master plan insertion anchor missing')
    master = master.replace(insert_before, '\n' + section + insert_before, 1)

master = master.replace(
    '### Step 2 — V2 code implementation on preview (2-A3 blocker deferred; safe next 2-B) 🔄',
    '### Step 2 — V2 code implementation on preview (2-A3 blocker deferred; 2-C complete, safe next 2-D) 🔄',
)
master = master.replace(
    '- [ ] 2-C IndexedDB/local-first V2 cache scaffolding; V1 server bundle remains fallback.',
    '- [x] 2-C IndexedDB/local-first V2 cache scaffolding complete in source; V1 server bundle remains fallback and runtime activation is still off.',
)

required_markers = [
    'Status: IMPLEMENTATION / Step 2-C complete in source — awaiting approval for 2-D',
    section_marker,
    '- [x] 2-C IndexedDB/local-first V2 cache scaffolding complete in source;',
]
for marker in required_markers:
    if marker not in master:
        raise SystemExit(f'master plan update marker missing: {marker}')

MASTER_PATH.write_text(master, encoding='utf-8')
print('Applied SORIDRAW Backend V2 Step 2-C IndexedDB/local-first scaffold patch.')
