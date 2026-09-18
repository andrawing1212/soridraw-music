/*
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
