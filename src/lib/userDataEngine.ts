import { auth, getFirebaseAppCheckToken } from '../firebase';
import { readUserProfileCache } from './userProfileCache';
import {
  clearAdaptiveListIndexDirtyRevision,
  readAdaptiveListIndexDirtyRevision,
} from './firestoreMeasured';

export const SORIDRAW_USER_DATA_ENGINE_V2_20260906 = true;
export const SORIDRAW_USER_DATA_ENGINE_DELTA_SYNC_1035 = true;
export const SORIDRAW_USER_DATA_ENGINE_SERVER_AUTHORITY_V4_20260906 = true;

export type SoridrawCatalogKind = 'musicNote' | 'library';
export type SoridrawHotSetKind = 'recentSongs';
export type SoridrawUserDataKind = SoridrawCatalogKind | SoridrawHotSetKind;

export const SORIDRAW_USER_DATA_STRATEGIES = {
  musicNote: { mode: 'catalog', renderBatchSize: 20 },
  library: { mode: 'catalog', renderBatchSize: 10 },
  recentSongs: { mode: 'hotSet', renderBatchSize: 0 },
} as const;

export type SoridrawCatalogSnapshot = {
  schemaVersion: 4;
  authority: 'server';
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

type CatalogDelta = {
  schemaVersion: 4;
  kind: SoridrawCatalogKind;
  baseRevision: number;
  revision: number;
  upserts: any[];
  deletedIds: string[];
};

const CATALOG_ENDPOINT = 'https://soridraw-media-preview.andrawing1212.workers.dev';
const CATALOG_SCHEMA_VERSION = 4 as const;
const CATALOG_MAX_ITEMS = 100_000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_DELTA_MAX_CHANGES = 5_000;
const CATALOG_DB_NAME = 'soridraw_user_data_engine_v4';
const LEGACY_CATALOG_DB_NAMES = ['soridraw_user_data_engine_v3', 'soridraw_user_data_engine_v2', 'soridraw_user_data_engine_v1'];
const CATALOG_DB_STORE = 'catalogs';
const CATALOG_PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);

const MUSIC_NOTE_SUMMARY_KEYS = new Set([
  'uid', 'soridrawSongId', 'favoriteKey',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'appliedKeywords', 'searchTokens',
  'isLocked', 'liked', 'isLiked', 'personalLiked', 'favoriteLiked', 'isFavorite',
  'isPublic', 'exploreTrackId', 'explorePublicationId',
  'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'deletedAt', 'trashedAt',
  'color', 'favoriteColor', 'noteColor', 'folderId', 'folderIds', 'musicNoteFolderIds',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',
  'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'sunoAudioUrl',
  'creatorNickname', 'ownerNickname', 'ownerUid', 'nickname',
]);

const LIBRARY_SUMMARY_KEYS = new Set([
  'uid', 'taskId', 'sourceTrackId', 'sourceTaskId', 'status', 'model', 'modelVersion',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'audioUrls', 'duration', 'durationSeconds',
  'sunoData', 'isPublic', 'hidden', 'deletedAt', 'trashedAt', 'favoriteColor', 'color',
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
let catalogDbPromise: Promise<IDBDatabase | null> | null = null;
let legacyDbCleanupRequested = false;

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
  || 1
);

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
  if (typeof value !== 'object' || depth > 10) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
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

const projectCatalogItem = (kind: SoridrawCatalogKind, sourceItem: any): any | null => {
  if (!sourceItem || typeof sourceItem !== 'object' || Array.isArray(sourceItem)) return null;
  if (kind === 'musicNote' && !isMusicNoteCatalogItem(sourceItem)) return null;
  const id = String(sourceItem?.id || sourceItem?.firestoreId || '').trim();
  if (!id) return null;
  const allowed = kind === 'musicNote' ? MUSIC_NOTE_SUMMARY_KEYS : LIBRARY_SUMMARY_KEYS;
  const projected: Record<string, any> = {
    id,
    firestoreId: String(sourceItem?.firestoreId || id),
    createdAtMs: itemCreatedAtMs(sourceItem),
    __catalogSummary: true,
  };
  for (const key of allowed) {
    if (!(key in sourceItem)) continue;
    const cleaned = cleanValue(sourceItem[key]);
    if (cleaned !== undefined) projected[key] = cleaned;
  }
  projected.createdAtMs = itemCreatedAtMs(projected);
  return projected;
};

const normalizeCatalogItems = (kind: SoridrawCatalogKind, sourceItems: any[]): any[] => {
  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const sourceItem of Array.isArray(sourceItems) ? sourceItems : []) {
    if (normalized.length >= CATALOG_MAX_ITEMS) break;
    const projected = projectCatalogItem(kind, sourceItem);
    if (!projected || seen.has(projected.id)) continue;
    seen.add(projected.id);
    normalized.push(projected);
  }
  normalized.sort((left, right) => {
    const timeDiff = Number(right.createdAtMs || 1) - Number(left.createdAtMs || 1);
    if (timeDiff !== 0) return timeDiff;
    return String(left.id).localeCompare(String(right.id));
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
  if (data.schemaVersion !== CATALOG_SCHEMA_VERSION || data.authority !== 'server' || data.kind !== kind || data.complete !== true) return false;
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
    if (!id || ids.has(id) || !Number.isFinite(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousTime) return false;
    ids.add(id);
    previousTime = createdAtMs;
  }
  return utf8Size(JSON.stringify(data)) <= CATALOG_MAX_BYTES;
};

const requestLegacyDbCleanup = () => {
  if (legacyDbCleanupRequested || typeof indexedDB === 'undefined') return;
  legacyDbCleanupRequested = true;
  for (const databaseName of LEGACY_CATALOG_DB_NAMES) {
    try {
      indexedDB.deleteDatabase(databaseName);
    } catch {
      // Best-effort cleanup only. Old catalog DBs are never read by V3.
    }
  }
};

const openCatalogDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  requestLegacyDbCleanup();
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

const catalogWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const authenticatedHeaders = async (
  requireAppCheck = true,
): Promise<Record<string, string> | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const retryDelays = requireAppCheck ? [0, 250, 800, 1600] : [0, 250, 800];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      const idToken = await user.getIdToken(attempt >= 2);
      if (!idToken) throw new Error('CATALOG_ID_TOKEN_MISSING');
      const appCheckToken = await getFirebaseAppCheckToken();
      if (requireAppCheck && !appCheckToken) throw new Error('CATALOG_APP_CHECK_NOT_READY');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      };
      if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
      return headers;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn('[userDataEngine] catalog auth headers unavailable after retry.', lastError);
  return null;
};

const readRemoteCatalogSnapshot = async (
  kind: SoridrawCatalogKind,
  uid: string,
  minimumRevision = 0,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid || !isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  const retryDelays = [0, 350, 1000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      // Catalog GET is owner-authorized by Firebase Auth. App Check is attached
      // when available, but a transient attestation failure cannot downgrade PREVIEW
      // into the old partial-list path.
      const headers = await authenticatedHeaders(false);
      if (!headers) throw new Error('CATALOG_AUTH_NOT_READY');
      const knownRemoteRevision = Math.max(readKnownRemoteCatalogRevision(kind, uid), Math.floor(minimumRevision || 0));
      if (knownRemoteRevision > 0) headers['X-Soridraw-Known-Revision'] = String(knownRemoteRevision);
      const response = await fetch(`${CATALOG_ENDPOINT}/v1/catalog/${kind}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (response.status === 404) throw new Error('CATALOG_NOT_MATERIALIZED');
      if (!response.ok) throw new Error(`CATALOG_READ_${response.status}`);
      const payload = await response.json();
      if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');
      if (knownRemoteRevision > 0 && payload.revision < knownRemoteRevision) {
        throw new Error('CATALOG_REVISION_STALE');
      }
      await writeCatalogSnapshotToLocalCache(kind, uid, payload);
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn(`[userDataEngine] ${kind} catalog snapshot read unavailable after retry.`, lastError);
  return null;
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
    if (local && (knownRemoteRevision <= 0 || local.revision >= knownRemoteRevision)) return local;
    const remote = await readRemoteCatalogSnapshot(kind, uid, knownRemoteRevision);
    if (remote) return remote;
    if (local && knownRemoteRevision > local.revision) return null;
    return local;
  })().finally(() => catalogReadInFlight.delete(key));
  catalogReadInFlight.set(key, promise);
  return promise;
};

const stableItemHash = (item: any): string => JSON.stringify(item);

const buildCatalogDelta = (
  kind: SoridrawCatalogKind,
  previous: SoridrawCatalogSnapshot,
  sourceItems: any[],
  revision: number,
): { delta: CatalogDelta; nextSnapshot: SoridrawCatalogSnapshot } | null => {
  const items = normalizeCatalogItems(kind, sourceItems);
  if (items.length > CATALOG_MAX_ITEMS) return null;
  const nextById = new Map(items.map((item) => [String(item.id), item]));
  const previousById = new Map(previous.items.map((item) => [String(item.id), item]));
  const upserts: any[] = [];
  const deletedIds: string[] = [];

  nextById.forEach((item, id) => {
    const prior = previousById.get(id);
    if (!prior || stableItemHash(prior) !== stableItemHash(item)) upserts.push(item);
  });
  previousById.forEach((_item, id) => {
    if (!nextById.has(id)) deletedIds.push(id);
  });

  if (upserts.length + deletedIds.length > CATALOG_DELTA_MAX_CHANGES) return null;
  const nextRevision = Math.max(Date.now(), Math.floor(revision || 0), previous.revision + 1);
  const nextSnapshot: SoridrawCatalogSnapshot = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    authority: 'server',
    kind,
    revision: nextRevision,
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs: Date.now(),
  };
  if (!isValidSnapshot(kind, nextSnapshot)) return null;
  return {
    delta: {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      kind,
      baseRevision: previous.revision,
      revision: nextRevision,
      upserts,
      deletedIds,
    },
    nextSnapshot,
  };
};

const publishRemoteCatalogDelta = async (
  uid: string,
  delta: CatalogDelta,
): Promise<{ revision: number; itemCount: number } | null> => {
  if (!isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;
  try {
    const headers = await authenticatedHeaders();
    if (!headers) return null;
    const response = await fetch(`${CATALOG_ENDPOINT}/v1/catalog/${delta.kind}/delta`, {
      method: 'POST',
      headers,
      body: JSON.stringify(delta),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`CATALOG_DELTA_${response.status}`);
    const payload = await response.json();
    const revision = Math.floor(Number(payload?.revision || 0));
    const itemCount = Math.floor(Number(payload?.itemCount));
    if (!Number.isFinite(revision) || revision <= 0 || !Number.isFinite(itemCount) || itemCount < 0) {
      throw new Error('CATALOG_DELTA_ACK_INVALID');
    }
    return { revision, itemCount };
  } catch (error) {
    console.warn(`[userDataEngine] ${delta.kind} catalog delta publish failed.`, error);
    return null;
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
      const previous = await readCatalogSnapshotFromLocalCache(kind, uid);

      // No proven full local catalog means this device must never manufacture a
      // "complete" object from a 10/20-row compatibility page. Force the Worker
      // to materialize the canonical catalog server-side once instead.
      if (!previous) {
        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, currentDirtyRevision);
        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      const projectedCount = normalizeCatalogItems(kind, pending.sourceItems).length;
      const explicitComplete = pending.options.complete === true;
      const looksCompleteAgainstPrevious = projectedCount >= Math.max(0, previous.itemCount - 2);
      if (!explicitComplete && !looksCompleteAgainstPrevious) {
        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, currentDirtyRevision);
        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      const built = buildCatalogDelta(kind, previous, pending.sourceItems, currentDirtyRevision);
      if (!built) {
        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, currentDirtyRevision);
        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      if (built.delta.upserts.length === 0 && built.delta.deletedIds.length === 0) {
        clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }

      const published = await publishRemoteCatalogDelta(uid, built.delta);
      if (!published) return;
      if (published.itemCount !== built.nextSnapshot.itemCount) {
        const rebuilt = await readRemoteCatalogSnapshot(kind, uid, published.revision);
        if (rebuilt) clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
        return;
      }
      const confirmedSnapshot: SoridrawCatalogSnapshot = {
        ...built.nextSnapshot,
        revision: published.revision,
      };
      await writeCatalogSnapshotToLocalCache(kind, uid, confirmedSnapshot);
      clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
    })();
  }, 1200));
};

export const getCatalogRenderBatchSize = (kind: SoridrawCatalogKind): number => (
  SORIDRAW_USER_DATA_STRATEGIES[kind].renderBatchSize
);
