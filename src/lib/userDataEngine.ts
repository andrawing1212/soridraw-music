import { auth, getFirebaseAppCheckToken } from '../firebase';
import { readUserProfileCache } from './userProfileCache';
import {
  clearAdaptiveListIndexDirtyRevision,
  readAdaptiveListIndexDirtyRevision,
} from './firestoreMeasured';

export const SORIDRAW_USER_DATA_ENGINE_V1_20260906 = true;
export const SORIDRAW_USER_DATA_ENGINE_REVISION_PROOF_1034 = true;

export type SoridrawCatalogKind = 'musicNote' | 'library';
export type SoridrawHotSetKind = 'recentSongs';
export type SoridrawUserDataKind = SoridrawCatalogKind | SoridrawHotSetKind;

export const SORIDRAW_USER_DATA_STRATEGIES = {
  musicNote: { mode: 'catalog', renderBatchSize: 20 },
  library: { mode: 'catalog', renderBatchSize: 10 },
  recentSongs: { mode: 'hotSet', renderBatchSize: 0 },
} as const;

export type SoridrawCatalogSnapshot = {
  schemaVersion: 1;
  kind: SoridrawCatalogKind;
  revision: number;
  items: any[];
  itemCount: number;
  complete: true;
  generatedAtMs: number;
};

type CatalogPublishOptions = {
  hasMore?: boolean;
  complete?: boolean;
  expectedItemCount?: number | null;
};

const CATALOG_ENDPOINT = 'https://soridraw-media-preview.andrawing1212.workers.dev';
const CATALOG_SCHEMA_VERSION = 1;
const CATALOG_MAX_ITEMS = 100_000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_DB_NAME = 'soridraw_user_data_engine_v1';
const CATALOG_DB_STORE = 'catalogs';
const CATALOG_PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);

const catalogMemory = new Map<string, SoridrawCatalogSnapshot>();
const catalogReadInFlight = new Map<string, Promise<SoridrawCatalogSnapshot | null>>();
const catalogPublishTimers = new Map<string, ReturnType<typeof setTimeout>>();
const catalogPendingPublishes = new Map<string, {
  kind: SoridrawCatalogKind;
  uid: string;
  sourceItems: any[];
  options: CatalogPublishOptions;
}>();
const catalogLastPublishedHashes = new Map<string, string>();
let catalogDbPromise: Promise<IDBDatabase | null> | null = null;

const isPreviewCatalogEnabled = () => {
  if (typeof window === 'undefined') return false;
  return CATALOG_PREVIEW_HOSTS.has(window.location.hostname.toLowerCase());
};

const catalogKey = (kind: SoridrawCatalogKind, uid: string) => `${uid}:${kind}`;

const toTimestampMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const result = Number(value.toMillis());
    return Number.isFinite(result) ? Math.floor(result) : 0;
  }
  if (typeof value?.seconds === 'number') {
    const result = Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(result) ? Math.floor(result) : 0;
  }
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
};

const itemCreatedAtMs = (item: any): number => (
  Number(item?.createdAtMs || 0)
  || toTimestampMs(item?.createdAt)
  || Number(item?.updatedAtMs || 0)
  || toTimestampMs(item?.updatedAt)
  || 0
);

const OMIT_KEYS = new Set([
  'lyricRevisions', 'lyricsHistory', 'lyricHistory', 'revisionHistory', 'editHistory',
  'apiResponse', 'apiStatusResponse', 'rawApiResponse', 'callbackPayload', 'debugPayload',
  'creditCheckedAfterComplete', 'creditCheckedAt', 'remainingCreditsAfterComplete',
  'reportedAudioUrls', 'audioValidationStatus',
  'googleGeminiApiKey', 'geminiApiKey', 'apiKey', 'accessToken', 'idToken',
  'refreshToken', 'authorization', 'password', 'secret',
]);

const cleanValue = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) {
    return value.map((entry) => cleanValue(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 12) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (OMIT_KEYS.has(key)) return;
    const cleaned = cleanValue(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const isMusicNoteCatalogItem = (item: any) => !(
  item?.favoriteRemoved === true
  || item?.saved === false
  || item?.hidden === true
  || item?.favoriteHidden === true
  || item?.deletedAt
  || item?.trashedAt
);

const normalizeCatalogItems = (kind: SoridrawCatalogKind, sourceItems: any[]): any[] => {
  const seen = new Set<string>();
  const normalized: any[] = [];

  [...(Array.isArray(sourceItems) ? sourceItems : [])]
    .filter(Boolean)
    .filter((item) => kind !== 'musicNote' || isMusicNoteCatalogItem(item))
    .sort((left, right) => {
      const timeDiff = itemCreatedAtMs(right) - itemCreatedAtMs(left);
      if (timeDiff !== 0) return timeDiff;
      return String(left?.id || left?.firestoreId || '').localeCompare(String(right?.id || right?.firestoreId || ''));
    })
    .forEach((sourceItem) => {
      if (normalized.length >= CATALOG_MAX_ITEMS) return;
      const id = String(sourceItem?.id || sourceItem?.firestoreId || '').trim();
      if (!id || seen.has(id)) return;
      const createdAtMs = itemCreatedAtMs(sourceItem);
      if (createdAtMs <= 0) return;
      const cleaned = cleanValue(sourceItem);
      if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) return;
      normalized.push({ ...cleaned, id, createdAtMs });
      seen.add(id);
    });

  return normalized;
};

const utf8Size = (text: string): number => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length * 2;
};

const isValidSnapshot = (kind: SoridrawCatalogKind, value: unknown): value is SoridrawCatalogSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, any>;
  if (data.schemaVersion !== CATALOG_SCHEMA_VERSION || data.kind !== kind || data.complete !== true) return false;
  if (!Number.isInteger(data.revision) || data.revision <= 0) return false;
  if (!Array.isArray(data.items) || data.items.length > CATALOG_MAX_ITEMS) return false;
  if (!Number.isInteger(data.itemCount) || data.itemCount !== data.items.length) return false;
  if (!Number.isInteger(data.generatedAtMs) || data.generatedAtMs <= 0) return false;
  const ids = new Set<string>();
  let previousTime = Number.MAX_SAFE_INTEGER;
  for (const item of data.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = String(item.id || '').trim();
    const createdAtMs = Number(item.createdAtMs || 0);
    if (!id || ids.has(id) || !Number.isInteger(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousTime) return false;
    ids.add(id);
    previousTime = createdAtMs;
  }
  return true;
};

const openCatalogDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (catalogDbPromise) return catalogDbPromise;
  catalogDbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(CATALOG_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CATALOG_DB_STORE)) {
        database.createObjectStore(CATALOG_DB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      settled = true;
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        catalogDbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => { if (!settled) resolve(null); };
    request.onblocked = () => { if (!settled) resolve(null); };
  });
  return catalogDbPromise;
};

const readCatalogFromIndexedDb = async (
  kind: SoridrawCatalogKind,
  uid: string,
): Promise<SoridrawCatalogSnapshot | null> => {
  const database = await openCatalogDb();
  if (!database) return null;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(CATALOG_DB_STORE, 'readonly');
      const request = transaction.objectStore(CATALOG_DB_STORE).get(catalogKey(kind, uid));
      request.onsuccess = () => {
        const snapshot = request.result?.snapshot;
        resolve(isValidSnapshot(kind, snapshot) ? snapshot : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const writeCatalogSnapshotToLocalCache = async (
  kind: SoridrawCatalogKind,
  uid: string,
  snapshot: SoridrawCatalogSnapshot,
): Promise<boolean> => {
  if (!uid || !isValidSnapshot(kind, snapshot)) return false;
  const key = catalogKey(kind, uid);
  catalogMemory.set(key, snapshot);
  const database = await openCatalogDb();
  if (!database) return false;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(CATALOG_DB_STORE, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(CATALOG_DB_STORE).put({ key, uid, kind, snapshot });
    });
  } catch {
    return false;
  }
};

export const readCatalogSnapshotFromLocalCache = async (
  kind: SoridrawCatalogKind,
  uid: string,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid) return null;
  const key = catalogKey(kind, uid);
  const memorySnapshot = catalogMemory.get(key);
  if (memorySnapshot && isValidSnapshot(kind, memorySnapshot)) return memorySnapshot;
  const indexedSnapshot = await readCatalogFromIndexedDb(kind, uid);
  if (indexedSnapshot) catalogMemory.set(key, indexedSnapshot);
  return indexedSnapshot;
};

const readKnownRemoteCatalogRevision = (kind: SoridrawCatalogKind, uid: string): number => {
  const profile = readUserProfileCache(uid) as any;
  if (!profile || typeof profile !== 'object') return 0;
  if (kind === 'library') {
    const libraryVersion = Number(profile?.syncVersions?.library || 0);
    return Number.isFinite(libraryVersion) && libraryVersion > 0 ? Math.floor(libraryVersion) : 0;
  }
  const candidates = [
    Number(profile?.syncVersions?.musicNote || 0),
    Number(profile?.favoriteSyncSignalUpdatedAt || 0),
    Number(profile?.favoriteSyncSignal?.at || 0),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length > 0 ? Math.floor(Math.max(...candidates)) : 0;
};

const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) return null;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

const readRemoteCatalogSnapshot = async (
  kind: SoridrawCatalogKind,
  uid: string,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid || !isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;
  try {
    const headers = await authenticatedHeaders();
    if (!headers) return null;
    const response = await fetch(`${CATALOG_ENDPOINT}/v1/catalog/${kind}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CATALOG_READ_${response.status}`);
    const payload = await response.json();
    if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');
    const knownRemoteRevision = readKnownRemoteCatalogRevision(kind, uid);
    if (knownRemoteRevision > 0 && payload.generatedAtMs < knownRemoteRevision) {
      // Projection is older than a mutation signal already known by the client.
      // Never overwrite a newer local view with a stale R2 object.
      console.warn(`[userDataEngine] ${kind} catalog snapshot is stale versus cached sync revision.`);
      return null;
    }
    await writeCatalogSnapshotToLocalCache(kind, uid, payload);
    return payload;
  } catch (error) {
    console.warn(`[userDataEngine] ${kind} catalog snapshot read unavailable.`, error);
    return null;
  }
};

export const readCatalogSnapshotCacheFirst = async (
  kind: SoridrawCatalogKind,
  uid: string,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid) return null;
  const key = catalogKey(kind, uid);
  const existingRead = catalogReadInFlight.get(key);
  if (existingRead) return existingRead;
  const promise = (async () => {
    const local = await readCatalogSnapshotFromLocalCache(kind, uid);
    const knownRemoteRevision = readKnownRemoteCatalogRevision(kind, uid);
    if (local && (knownRemoteRevision <= 0 || local.generatedAtMs >= knownRemoteRevision)) {
      return local;
    }
    const remote = await readRemoteCatalogSnapshot(kind, uid);
    if (remote) return remote;
    // If the cached users/{uid} signal proves a local projection stale, return
    // null so the existing bounded compatibility path can recover correctness.
    if (local && knownRemoteRevision > local.generatedAtMs) return null;
    return local;
  })().finally(() => catalogReadInFlight.delete(key));
  catalogReadInFlight.set(key, promise);
  return promise;
};

const resolveExpectedMusicNoteCount = (uid: string, explicit?: number | null): number | null => {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  const cachedProfile = readUserProfileCache(uid) as any;
  const favoriteCount = Number(cachedProfile?.favoriteCount);
  return Number.isFinite(favoriteCount) && favoriteCount >= 0 ? Math.floor(favoriteCount) : null;
};

const buildCompleteSnapshot = (
  kind: SoridrawCatalogKind,
  uid: string,
  sourceItems: any[],
  revision: number,
  options: CatalogPublishOptions,
): SoridrawCatalogSnapshot | null => {
  const items = normalizeCatalogItems(kind, sourceItems);
  if (sourceItems.length > 0 && items.length === 0) return null;

  let complete = options.complete === true;
  if (kind === 'musicNote') {
    const expectedCount = resolveExpectedMusicNoteCount(uid, options.expectedItemCount);
    if (expectedCount !== null) complete = complete || items.length >= expectedCount;
    else if (options.hasMore === false) complete = true;
  } else if (!complete) {
    complete = options.hasMore === false;
  }
  if (!complete) return null;

  const snapshot: SoridrawCatalogSnapshot = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    kind,
    revision: Math.max(Date.now(), Math.floor(revision)),
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs: Date.now(),
  };
  const encoded = JSON.stringify(snapshot);
  if (items.length > CATALOG_MAX_ITEMS || utf8Size(encoded) > CATALOG_MAX_BYTES) {
    console.warn(`[userDataEngine] ${kind} catalog snapshot exceeds client safety budget.`);
    return null;
  }
  return snapshot;
};

const publishRemoteCatalogSnapshot = async (
  uid: string,
  snapshot: SoridrawCatalogSnapshot,
): Promise<boolean> => {
  if (!isPreviewCatalogEnabled()) return false;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return false;
  try {
    const headers = await authenticatedHeaders();
    if (!headers) return false;
    const body = JSON.stringify(snapshot);
    const response = await fetch(`${CATALOG_ENDPOINT}/v1/catalog/${snapshot.kind}`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`CATALOG_WRITE_${response.status}`);
    await writeCatalogSnapshotToLocalCache(snapshot.kind, uid, snapshot);
    return true;
  } catch (error) {
    console.warn(`[userDataEngine] ${snapshot.kind} catalog snapshot publish failed.`, error);
    return false;
  }
};

export const scheduleCatalogSnapshotPublishIfDirty = (
  kind: SoridrawCatalogKind,
  uid: string,
  sourceItems: any[],
  options: CatalogPublishOptions = {},
): void => {
  if (!uid || !Array.isArray(sourceItems) || !isPreviewCatalogEnabled()) return;
  const dirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  if (dirtyRevision <= 0) return;

  const key = catalogKey(kind, uid);
  catalogPendingPublishes.set(key, { kind, uid, sourceItems: [...sourceItems], options: { ...options } });
  const existingTimer = catalogPublishTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);

  catalogPublishTimers.set(key, setTimeout(() => {
    catalogPublishTimers.delete(key);
    const pending = catalogPendingPublishes.get(key);
    catalogPendingPublishes.delete(key);
    if (!pending) return;

    void (async () => {
      const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
      if (currentDirtyRevision <= 0) return;

      const previousCompleteSnapshot = await readCatalogSnapshotFromLocalCache(kind, uid);
      const effectiveOptions: CatalogPublishOptions = {
        ...pending.options,
        complete: pending.options.complete === true || Boolean(previousCompleteSnapshot),
      };
      const snapshot = buildCompleteSnapshot(
        kind,
        uid,
        pending.sourceItems,
        currentDirtyRevision,
        effectiveOptions,
      );
      if (!snapshot) return;

      const stableHash = JSON.stringify({ ...snapshot, revision: 0, generatedAtMs: 0 });
      if (catalogLastPublishedHashes.get(key) === stableHash) {
        clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      const published = await publishRemoteCatalogSnapshot(uid, snapshot);
      if (!published) return;
      catalogLastPublishedHashes.set(key, stableHash);
      clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    })();
  }, 1500));
};

export const getCatalogRenderBatchSize = (kind: SoridrawCatalogKind): number => (
  SORIDRAW_USER_DATA_STRATEGIES[kind].renderBatchSize
);
