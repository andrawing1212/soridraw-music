export const SORIDRAW_MUSIC_NOTE_DETAIL_CACHE_029 = true;

type MusicNoteDetailCacheRecord = {
  key: string;
  uid: string;
  sourceId: string;
  sourceVersion: number;
  savedAtMs: number;
  data: any;
};

type MusicNoteDetailLoadArgs = {
  uid: string;
  sourceId: string;
  sourceVersion: number;
  loader: () => Promise<any | null>;
};

const DB_NAME = 'soridraw_music_note_detail_cache_v1';
const DB_STORE = 'details';
const DB_VERSION = 1;
const UNKNOWN_VERSION_TTL_MS = 10 * 60 * 1000;
const MEMORY_MAX = 80;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryCache = new Map<string, MusicNoteDetailCacheRecord>();
const inFlightLoads = new Map<string, Promise<any | null>>();

const cacheKey = (uid: string, sourceId: string) => `${uid}:${sourceId}`;

const toTimestampMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (value instanceof Date) return Math.max(0, value.getTime());
  if (typeof value?.toMillis === 'function') {
    const next = Number(value.toMillis());
    return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  }
  if (typeof value?.seconds === 'number') {
    const next = Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export const getMusicNoteDetailSourceVersion = (source: any): number => {
  const candidates = [
    source?.updatedAtMs,
    source?.updatedAt,
    source?.modifiedAtMs,
    source?.modifiedAt,
    source?.createdAtMs,
    source?.createdAt,
  ];
  for (const candidate of candidates) {
    const value = toTimestampMs(candidate);
    if (value > 0) return value;
  }
  return 0;
};

const cacheRecordIsFresh = (record: MusicNoteDetailCacheRecord, sourceVersion: number): boolean => {
  if (sourceVersion > 0) return Number(record.sourceVersion || 0) === sourceVersion;
  return Date.now() - Number(record.savedAtMs || 0) <= UNKNOWN_VERSION_TTL_MS;
};

const remember = (record: MusicNoteDetailCacheRecord) => {
  if (memoryCache.has(record.key)) memoryCache.delete(record.key);
  memoryCache.set(record.key, record);
  while (memoryCache.size > MEMORY_MAX) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
};

const cleanForPersistence = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return toTimestampMs(value);
  if (Array.isArray(value)) {
    if (depth > 14) return [];
    return value.map((entry) => cleanForPersistence(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 14) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const cleaned = cleanForPersistence(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE, { keyPath: 'key' });
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
  return dbPromise;
};

const readPersistent = async (key: string): Promise<MusicNoteDetailCacheRecord | null> => {
  const database = await openDb();
  if (!database) return null;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const writePersistent = async (record: MusicNoteDetailCacheRecord): Promise<void> => {
  const database = await openDb();
  if (!database) return;
  const data = cleanForPersistence(record.data);
  if (!data || typeof data !== 'object') return;
  try {
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
      transaction.objectStore(DB_STORE).put({ ...record, data });
    });
  } catch {
    // IndexedDB is optional. Memory cache still prevents repeated reads in this session.
  }
};

export const getOrLoadMusicNoteDetail = async ({
  uid,
  sourceId,
  sourceVersion,
  loader,
}: MusicNoteDetailLoadArgs): Promise<any | null> => {
  const safeUid = String(uid || '').trim();
  const safeSourceId = String(sourceId || '').trim();
  if (!safeUid || !safeSourceId) return null;

  const version = Math.max(0, Math.floor(Number(sourceVersion || 0)));
  const key = cacheKey(safeUid, safeSourceId);
  const memory = memoryCache.get(key);
  if (memory && cacheRecordIsFresh(memory, version)) {
    remember(memory);
    return memory.data;
  }

  const persistent = await readPersistent(key);
  if (persistent && cacheRecordIsFresh(persistent, version)) {
    remember(persistent);
    return persistent.data;
  }

  const flightKey = `${key}:${version}`;
  const existing = inFlightLoads.get(flightKey);
  if (existing) return existing;

  const task = (async () => {
    const loaded = await loader();
    if (!loaded || typeof loaded !== 'object') return null;
    const record: MusicNoteDetailCacheRecord = {
      key,
      uid: safeUid,
      sourceId: safeSourceId,
      sourceVersion: version,
      savedAtMs: Date.now(),
      data: loaded,
    };
    remember(record);
    void writePersistent(record);
    return loaded;
  })().finally(() => {
    inFlightLoads.delete(flightKey);
  });

  inFlightLoads.set(flightKey, task);
  return task;
};


export const patchMusicNoteDetailCache = async ({
  uid,
  sourceId,
  sourceVersion,
  updates,
}: {
  uid: string;
  sourceId: string;
  sourceVersion: number;
  updates: Record<string, any>;
}): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeSourceId = String(sourceId || '').trim();
  if (!safeUid || !safeSourceId || !updates || typeof updates !== 'object') return;
  const key = cacheKey(safeUid, safeSourceId);
  const memory = memoryCache.get(key);
  const persistent = memory || await readPersistent(key);
  if (!persistent?.data || typeof persistent.data !== 'object') return;
  const merged = {
    ...persistent.data,
    ...updates,
    ...(updates.lyrics ? { lyrics: { ...(persistent.data.lyrics || {}), ...(updates.lyrics || {}) } } : {}),
    ...(updates.appliedKeywords ? { appliedKeywords: { ...(persistent.data.appliedKeywords || {}), ...(updates.appliedKeywords || {}) } } : {}),
  };
  const record: MusicNoteDetailCacheRecord = {
    key,
    uid: safeUid,
    sourceId: safeSourceId,
    sourceVersion: Math.max(0, Math.floor(Number(sourceVersion || persistent.sourceVersion || 0))),
    savedAtMs: Date.now(),
    data: merged,
  };
  remember(record);
  await writePersistent(record);
};
