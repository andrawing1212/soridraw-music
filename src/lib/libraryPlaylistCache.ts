import type { Playlist, PlaylistItem } from '../types';

// Durable, per-user Library playlist cache. Firestore remains authoritative;
// this cache only prevents page entry/app updates from re-reading unchanged data.
const DB_NAME = 'soridraw_library_playlist_cache';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const VERSION_STORAGE_PREFIX = 'soridraw.library.playlistSyncVersion.v1';

export const LIBRARY_PLAYLIST_CACHE_EVENT = 'soridraw:library-playlist-cache-change';

type CacheRecord<T> = {
  key: string;
  uid: string;
  scope: 'lists' | 'items';
  playlistId: string;
  version: number;
  items: T[];
  cachedAtMs: number;
};

export type LibraryPlaylistCacheSnapshot<T> = {
  items: T[];
  version: number;
};

type LibraryPlaylistCacheChange = {
  uid: string;
  scope: 'lists' | 'items';
  playlistId?: string;
};

const memory = new Map<string, CacheRecord<any>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

const normalize = (value: unknown) => String(value || '').trim();
const listKey = (uid: string) => `${normalize(uid)}::lists`;
const itemsKey = (uid: string, playlistId: string) => `${normalize(uid)}::items::${normalize(playlistId)}`;

const requestToPromise = <T,>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const openDb = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return null;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      settled = true;
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      if (!settled) resolve(null);
    };
    request.onblocked = () => {
      if (!settled) resolve(null);
    };
  });

  const database = await dbPromise;
  if (!database) dbPromise = null;
  return database;
};

const readRecord = async <T,>(key: string): Promise<CacheRecord<T> | null> => {
  const cached = memory.get(key);
  if (cached) return cached as CacheRecord<T>;

  const database = await openDb();
  if (!database) return null;
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    const [record] = await Promise.all([
      requestToPromise(request) as Promise<CacheRecord<T> | undefined>,
      transactionDone(transaction),
    ]);
    if (!record || !Array.isArray(record.items)) return null;
    memory.set(key, record);
    return record;
  } catch {
    return null;
  }
};

const writeRecord = async <T,>(record: CacheRecord<T>): Promise<boolean> => {
  memory.set(record.key, record);
  const database = await openDb();
  if (!database) return false;
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
    return true;
  } catch (error) {
    console.warn('[Library playlist cache] write unavailable:', error);
    return false;
  }
};

const deleteRecord = async (key: string): Promise<void> => {
  memory.delete(key);
  const database = await openDb();
  if (!database) return;
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionDone(transaction);
  } catch {}
};

const emit = (detail: LibraryPlaylistCacheChange) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LibraryPlaylistCacheChange>(LIBRARY_PLAYLIST_CACHE_EVENT, { detail }));
};

const safeVersion = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const toDurableValue = (value: any, depth = 0): any => {
  if (value === null || value === undefined) return value === null ? null : undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) {
    return value.map((entry) => toDurableValue(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 14) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const durable = toDurableValue(entry, depth + 1);
    if (durable !== undefined) next[key] = durable;
  });
  return next;
};

export const nextLibraryPlaylistSyncVersion = (uid: string, floor = 0): number => {
  const safeUid = normalize(uid);
  const storageKey = `${VERSION_STORAGE_PREFIX}.${safeUid}`;
  let previous = 0;
  if (safeUid && typeof localStorage !== 'undefined') {
    try { previous = safeVersion(localStorage.getItem(storageKey)); } catch {}
  }
  const next = Math.max(Date.now(), previous + 1, safeVersion(floor) + 1);
  if (safeUid && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(storageKey, String(next)); } catch {}
  }
  return next;
};

export const readLibraryPlaylistListCache = async (uid: string): Promise<LibraryPlaylistCacheSnapshot<Playlist> | null> => {
  const safeUid = normalize(uid);
  if (!safeUid) return null;
  const record = await readRecord<Playlist>(listKey(safeUid));
  return record ? { items: record.items, version: safeVersion(record.version) } : null;
};

export const writeLibraryPlaylistListCache = async (
  uid: string,
  playlists: Playlist[],
  version = 0,
): Promise<void> => {
  const safeUid = normalize(uid);
  if (!safeUid) return;
  await writeRecord<Playlist>({
    key: listKey(safeUid),
    uid: safeUid,
    scope: 'lists',
    playlistId: '',
    version: safeVersion(version),
    items: toDurableValue(Array.isArray(playlists) ? playlists : []),
    cachedAtMs: Date.now(),
  });
  emit({ uid: safeUid, scope: 'lists' });
};

export const readLibraryPlaylistItemsCache = async (
  uid: string,
  playlistId: string,
): Promise<LibraryPlaylistCacheSnapshot<PlaylistItem> | null> => {
  const safeUid = normalize(uid);
  const safePlaylistId = normalize(playlistId);
  if (!safeUid || !safePlaylistId) return null;
  const record = await readRecord<PlaylistItem>(itemsKey(safeUid, safePlaylistId));
  return record ? { items: record.items, version: safeVersion(record.version) } : null;
};

export const writeLibraryPlaylistItemsCache = async (
  uid: string,
  playlistId: string,
  items: PlaylistItem[],
  version = 0,
): Promise<void> => {
  const safeUid = normalize(uid);
  const safePlaylistId = normalize(playlistId);
  if (!safeUid || !safePlaylistId) return;
  await writeRecord<PlaylistItem>({
    key: itemsKey(safeUid, safePlaylistId),
    uid: safeUid,
    scope: 'items',
    playlistId: safePlaylistId,
    version: safeVersion(version),
    items: toDurableValue(Array.isArray(items) ? items : []),
    cachedAtMs: Date.now(),
  });
  emit({ uid: safeUid, scope: 'items', playlistId: safePlaylistId });
};

export const patchLibraryPlaylistListCache = async (
  uid: string,
  updater: (items: Playlist[]) => Playlist[],
  version?: number,
): Promise<Playlist[] | null> => {
  const current = await readLibraryPlaylistListCache(uid);
  if (!current) return null;
  const next = updater(current.items);
  await writeLibraryPlaylistListCache(uid, next, version ?? current.version);
  return next;
};

export const patchLibraryPlaylistItemsCache = async (
  uid: string,
  playlistId: string,
  updater: (items: PlaylistItem[]) => PlaylistItem[],
  version?: number,
): Promise<PlaylistItem[] | null> => {
  const current = await readLibraryPlaylistItemsCache(uid, playlistId);
  if (!current) return null;
  const next = updater(current.items);
  await writeLibraryPlaylistItemsCache(uid, playlistId, next, version ?? current.version);
  return next;
};

export const deleteLibraryPlaylistItemsCache = async (uid: string, playlistId: string): Promise<void> => {
  const safeUid = normalize(uid);
  const safePlaylistId = normalize(playlistId);
  if (!safeUid || !safePlaylistId) return;
  await deleteRecord(itemsKey(safeUid, safePlaylistId));
  emit({ uid: safeUid, scope: 'items', playlistId: safePlaylistId });
};
