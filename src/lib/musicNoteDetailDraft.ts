export const SORIDRAW_MUSIC_NOTE_DETAIL_DRAFT_031 = true;

export type MusicNoteDetailPendingDraft = {
  key: string;
  uid: string;
  sourceId: string;
  baseVersion: number;
  updatedAtMs: number;
  updates: Record<string, any>;
};

const DB_NAME = 'soridraw_music_note_detail_draft_v1';
const DB_STORE = 'drafts';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase | null> | null = null;

const keyFor = (uid: string, sourceId: string) => `${String(uid || '').trim()}:${String(sourceId || '').trim()}`;

const clean = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) {
    if (depth > 14) return [];
    return value.map((item) => clean(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value !== 'object' || depth > 14) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([name, item]) => {
    const cleaned = clean(item, depth + 1);
    if (cleaned !== undefined) next[name] = cleaned;
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
    request.onerror = () => { if (!settled) resolve(null); };
    request.onblocked = () => { if (!settled) resolve(null); };
  });
  return dbPromise;
};

export const readMusicNoteDetailDraft = async (uid: string, sourceId: string): Promise<MusicNoteDetailPendingDraft | null> => {
  const key = keyFor(uid, sourceId);
  if (!key || key === ':') return null;
  const database = await openDb();
  if (!database) return null;
  try {
    return await new Promise((resolve) => {
      const tx = database.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const writeMusicNoteDetailDraft = async (
  uid: string,
  sourceId: string,
  baseVersion: number,
  updates: Record<string, any>,
): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeSourceId = String(sourceId || '').trim();
  if (!safeUid || !safeSourceId) return;
  const cleanedUpdates = clean(updates);
  if (!cleanedUpdates || typeof cleanedUpdates !== 'object' || Object.keys(cleanedUpdates).length === 0) return;
  const database = await openDb();
  if (!database) return;
  const record: MusicNoteDetailPendingDraft = {
    key: keyFor(safeUid, safeSourceId),
    uid: safeUid,
    sourceId: safeSourceId,
    baseVersion: Math.max(0, Math.floor(Number(baseVersion || 0))),
    updatedAtMs: Date.now(),
    updates: cleanedUpdates,
  };
  try {
    await new Promise<void>((resolve) => {
      const tx = database.transaction(DB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
      tx.objectStore(DB_STORE).put(record);
    });
  } catch {
    // IndexedDB is a recovery safety net; active session state stays in memory.
  }
};

export const clearMusicNoteDetailDraft = async (uid: string, sourceId: string): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeSourceId = String(sourceId || '').trim();
  if (!safeUid || !safeSourceId) return;
  const database = await openDb();
  if (!database) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = database.transaction(DB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
      tx.objectStore(DB_STORE).delete(keyFor(safeUid, safeSourceId));
    });
  } catch {
    // Best effort only.
  }
};

export const mergeMusicNoteDetailDraft = (base: any, updates: Record<string, any>) => ({
  ...(base || {}),
  ...(updates || {}),
  ...(updates?.lyrics ? { lyrics: { ...(base?.lyrics || {}), ...(updates.lyrics || {}) } } : {}),
  ...(updates?.appliedKeywords ? { appliedKeywords: { ...(base?.appliedKeywords || {}), ...(updates.appliedKeywords || {}) } } : {}),
});
