import { auth, getFirebaseAppCheckToken } from '../firebase';
import { isMusicNoteItemRemoved } from './musicNoteSavedState';
import { readUserProfileCache } from './userProfileCache';
import {
  clearAdaptiveListIndexDirtyRevision,
  readAdaptiveListIndexDirtyRevision,
} from './firestoreMeasured';
import { markCatalogRuntimeDiagnostic } from './catalogRuntimeDiagnostics';
import { canUseWarmCatalogWithoutRemote, readCatalogProfileRevision } from './catalogWarmCachePolicy';

export const SORIDRAW_USER_DATA_ENGINE_V2_20260906 = true;
export const SORIDRAW_USER_DATA_ENGINE_DELTA_SYNC_1035 = true;
export const SORIDRAW_USER_DATA_ENGINE_SERVER_AUTHORITY_V4_20260906 = true;
export const SORIDRAW_USER_DATA_ENGINE_LOCAL_CACHE_V5_20260906 = true;
export const SORIDRAW_USER_DATA_ENGINE_REMOTE_AUTHORITY_1047 = true;
export const SORIDRAW_CATALOG_BASE_DELTA_JOURNAL_1053 = true;

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
  deletedIds?: string[];
};

type CatalogDelta = {
  schemaVersion: 4;
  kind: SoridrawCatalogKind;
  mutationId: string;
  baseRevision: number;
  baseItemCount: number;
  revision: number;
  nextItemCount: number;
  upserts: any[];
  deletedIds: string[];
};

type CatalogSyncResponse = {
  schemaVersion: 4;
  authority: 'server';
  kind: SoridrawCatalogKind;
  mode: 'delta' | 'unchanged';
  baseRevision: number;
  revision: number;
  itemCount: number;
  deltas: CatalogDelta[];
  generatedAtMs: number;
};

const CATALOG_ENDPOINTS = {
  preview: 'https://soridraw-media-preview.andrawing1212.workers.dev',
  test: 'https://soridraw-media-test.andrawing1212.workers.dev',
  production: 'https://soridraw-media.andrawing1212.workers.dev',
} as const;
const resolveCatalogEndpoint = (): string => {
  if (typeof window === 'undefined') return CATALOG_ENDPOINTS.preview;
  const host = window.location.hostname.toLowerCase();
  if (host === 'test.soridraw.com' || host === 'soridraw-test.web.app' || host === 'soridraw-test.firebaseapp.com') {
    return CATALOG_ENDPOINTS.test;
  }
  if (
    host === 'soridraw.com' || host === 'www.soridraw.com'
    || host === 'soridraw.web.app' || host === 'soridraw.firebaseapp.com'
    || host === 'soridraw-app-866a5.web.app' || host === 'soridraw-app-866a5.firebaseapp.com'
  ) return CATALOG_ENDPOINTS.production;
  return CATALOG_ENDPOINTS.preview;
};
const CATALOG_SCHEMA_VERSION = 4 as const;
const CATALOG_MAX_ITEMS = 100_000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_DELTA_MAX_CHANGES = 5_000;
const CATALOG_LOCAL_CACHE_GENERATION = 5 as const;
const MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 = 6 as const;
const CATALOG_DB_NAME = 'soridraw_user_data_engine_v5';
const LEGACY_CATALOG_DB_NAMES = ['soridraw_user_data_engine_v4', 'soridraw_user_data_engine_v3', 'soridraw_user_data_engine_v2', 'soridraw_user_data_engine_v1'];
const CATALOG_DB_STORE = 'catalogs';
const CATALOG_PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
  'test.soridraw.com',
  'soridraw-test.web.app',
  'soridraw-test.firebaseapp.com',
  'soridraw.com',
  'www.soridraw.com',
  'soridraw.web.app',
  'soridraw.firebaseapp.com',
  'soridraw-app-866a5.web.app',
  'soridraw-app-866a5.firebaseapp.com',
]);

const MUSIC_NOTE_SUMMARY_KEYS = new Set([
  'uid', 'soridrawSongId', 'favoriteKey', 'recentSongSyncKey', 'recentLegacySourceId', 'recentLegacyCreatedAtMs',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'appliedKeywords', 'searchTokens',
  'isLocked', 'liked', 'isLiked', 'personalLiked', 'favoriteLiked', 'isFavorite',
  'isPublic', 'exploreTrackId', 'explorePublicationId',
  'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'deletedAt', 'trashedAt',
  'color', 'favoriteColor', 'noteColor', 'favoriteColorTag', 'colorTag', 'folderId', 'folderIds', 'musicNoteFolderIds',
  'noteFolderId', 'noteFolderTitle', 'noteFolderUpdatedAt', 'myNoteFolderId', 'favoriteFolderId',
  'sharedNoteFolderId', 'sharedNoteFolderTitle', 'sharedNoteFolderUpdatedAt', 'sharedNoteFolder', 'noteSharedFolderId',
  'sharedNoteShareId', 'isSharedMusicNote', 'sharedReadOnly', 'sourceType', 'originalFavoriteId',
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
  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt', 'appliedKeywords',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'audioUrls', 'duration', 'durationSeconds',
  'sunoData', 'isPublic', 'hidden', 'deletedAt', 'trashedAt', 'favoriteColor', 'color',
]);

const catalogMemory = new Map<string, SoridrawCatalogSnapshot>();
const catalogReadInFlight = new Map<string, Promise<SoridrawCatalogSnapshot | null>>();
type CatalogReadSource = 'cache' | 'remote' | 'none';
const catalogLastReadSources = new Map<string, CatalogReadSource>();

export const readLastCatalogReadSource = (
  kind: SoridrawCatalogKind,
  uid: string,
): CatalogReadSource => catalogLastReadSources.get(catalogKey(kind, uid)) || 'none';
// Local IndexedDB is instant paint only until this browser session has actually
// received a server-authoritative Catalog response for the UID/kind.
const catalogRemoteValidatedSessionKeys = new Set<string>();
const catalogPublishTimers = new Map<string, ReturnType<typeof setTimeout>>();
const catalogPublishInFlight521 = new Map<string, Promise<void>>();
const catalogPublishRetryCount521 = new Map<string, number>();
// 30s Studio heart Firestore settlement precedes this; it does not replace it.
const MUSIC_NOTE_CATALOG_AFTER_COMMIT_MS_521 = 1_200;
const MUSIC_NOTE_CATALOG_RETRY_DELAYS_521 = [3_000, 12_000] as const;
type CatalogPendingPublish519 = {
  kind: SoridrawCatalogKind;
  uid: string;
  sourceItems: any[];
  options: CatalogPublishOptions;
  dirtyRevision: number;
  // Only exact single-item calls following a canonical dirty mutation may
  // replay an upsert even when this browser's local cache already matches.
  confirmedChangedIds?: string[];
};
const catalogPendingPublishes = new Map<string, CatalogPendingPublish519>();
// app519: A completed Firestore favorite write must not lose its derived R2
// publish intent when the browser reloads before page-exit delivery.
// Only changed Catalog summaries/tombstones are persisted, never raw songs.
const CATALOG_PENDING_KEY_519 = 'soridraw_catalog_pending_v1:';
const CATALOG_PENDING_MAX_BYTES_519 = 1024 * 1024;
const pendingStorageKey519 = (kind: SoridrawCatalogKind, uid: string) =>
  CATALOG_PENDING_KEY_519 + encodeURIComponent(uid) + ':' + kind;
const persistCatalogPending519 = (pending: CatalogPendingPublish519): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    const payload = JSON.stringify(pending);
    if (utf8Size(payload) > CATALOG_PENDING_MAX_BYTES_519) return false;
    localStorage.setItem(pendingStorageKey519(pending.kind, pending.uid), payload);
    return true;
  } catch { return false; }
};
const restoreCatalogPending519 = (kind: SoridrawCatalogKind, uid: string): CatalogPendingPublish519 | null => {
  const key = catalogKey(kind, uid);
  const existing = catalogPendingPublishes.get(key);
  if (existing) return existing;
  if (typeof localStorage === 'undefined' || !uid || !isPreviewCatalogEnabled()) return null;
  try {
    const raw = localStorage.getItem(pendingStorageKey519(kind, uid));
    if (!raw || utf8Size(raw) > CATALOG_PENDING_MAX_BYTES_519) return null;
    const stored = JSON.parse(raw);
    if (stored?.kind !== kind || stored.uid !== uid
      || !Number.isSafeInteger(stored.dirtyRevision) || stored.dirtyRevision <= 0
      || !Array.isArray(stored.sourceItems) || stored.sourceItems.length > CATALOG_DELTA_MAX_CHANGES
      || !Array.isArray(stored.options?.deletedIds)) return null;
    const sourceItems = normalizeCatalogItems(kind, stored.sourceItems);
    if (sourceItems.length !== stored.sourceItems.length) return null;
    const confirmedChangedIds: unknown[] = Array.isArray(stored.confirmedChangedIds)
      ? stored.confirmedChangedIds : [];
    if (confirmedChangedIds.length > CATALOG_DELTA_MAX_CHANGES
      || confirmedChangedIds.some(id => typeof id !== 'string' || !id || id.length > 240
        || !sourceItems.some(item => String(item.id) === id))) return null;
    const deletedIds = stored.options.deletedIds;
    if (deletedIds.length > CATALOG_DELTA_MAX_CHANGES
      || deletedIds.some((id: unknown) => typeof id !== 'string' || !id || id.length > 240)) return null;
    const pending: CatalogPendingPublish519 = {
      kind, uid, sourceItems,
      options: { deletedIds: [...deletedIds] },
      dirtyRevision: stored.dirtyRevision,
      confirmedChangedIds: confirmedChangedIds as string[],
    };
    catalogPendingPublishes.set(key, pending);
    // A real committed write can outlive a tab close. Restoring its durable
    // outbox must restart bounded delivery; ordinary visits without pending
    // data still schedule nothing and issue zero requests.
    if (kind === 'musicNote') scheduleCommittedMusicNoteCatalogFlush521(key);
    return pending;
  } catch { return null; }
};
const clearCatalogPending519 = (
  key: string, pending: CatalogPendingPublish519, dirtyRevision: number,
): void => {
  // An older HTTP ACK may never erase an updated local mutation OR clear
  // the live Firestore dirty counter for that newer mutation.
  if (catalogPendingPublishes.get(key) !== pending) return;
  clearAdaptiveListIndexDirtyRevision(pending.kind, dirtyRevision);
  catalogPendingPublishes.delete(key);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(pendingStorageKey519(pending.kind, pending.uid)); } catch {}
  }
};
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

const isMusicNoteCatalogItem = (item: any) => (
  !isMusicNoteItemRemoved(item)
  // Live heart overlays are *not* Firestore-confirmed favorites. A different
  // canonical mutation may be dirty while these temporary rows are visible.
  && item?.__studioHeartPendingLocal !== true
  && item?.__studioHeartRemotePreviewLocal !== true
  && item?.__studioHeartRemotePreview !== true
);

export const projectCatalogItemForSync = (kind: SoridrawCatalogKind, sourceItem: any): any | null => {
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

const MUSIC_NOTE_MEDIA_OVERLAY_STORAGE_BASE = 'soridraw_music_note_media_overlay_v1';
const MUSIC_NOTE_MEDIA_OVERLAY_MAX_ITEMS = 256;
const MUSIC_NOTE_MEDIA_OVERLAY_KEYS = [
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex', 'sunoLinkCount',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',
  'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
] as const;

type MusicNoteMediaOverlayRecord = {
  version: number;
  mediaVersion: number;
  patch: Record<string, any>;
};

const getMusicNoteMediaOverlayStorageKey = (uid: string) =>
  `${MUSIC_NOTE_MEDIA_OVERLAY_STORAGE_BASE}_${String(uid || '').trim()}`;

const getMusicNoteMediaVersion = (source: any): number => Math.max(
  Math.max(0, Math.floor(Number(source?.sunoShareUrlUpdatedAt || 0))),
  Math.max(0, Math.floor(Number(source?.sunoCoverFetchedAt || 0))),
);

const projectMusicNoteMediaPatch = (source: any): Record<string, any> => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const patch: Record<string, any> = {};
  for (const key of MUSIC_NOTE_MEDIA_OVERLAY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const cleaned = cleanValue(source[key]);
    if (cleaned !== undefined) patch[key] = cleaned;
  }
  return patch;
};

const readMusicNoteMediaOverlays = (uid: string): Record<string, MusicNoteMediaOverlayRecord> => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getMusicNoteMediaOverlayStorageKey(safeUid));
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, MusicNoteMediaOverlayRecord> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, any>)) {
      const safeId = String(id || '').trim();
      const patch = projectMusicNoteMediaPatch(value?.patch);
      const version = Math.max(0, Math.floor(Number(value?.version || 0)));
      const mediaVersion = Math.max(0, Math.floor(Number(value?.mediaVersion || 0)));
      if (!safeId || !version || Object.keys(patch).length === 0) continue;
      result[safeId] = { version, mediaVersion, patch };
    }
    return result;
  } catch {
    return {};
  }
};

const writeMusicNoteMediaOverlays = (
  uid: string,
  records: Record<string, MusicNoteMediaOverlayRecord>,
): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || typeof localStorage === 'undefined') return;
  try {
    const entries = Object.entries(records)
      .filter(([id, value]) => Boolean(String(id || '').trim()) && Number(value?.version || 0) > 0)
      .sort((left, right) => Number(right[1].version || 0) - Number(left[1].version || 0))
      .slice(0, MUSIC_NOTE_MEDIA_OVERLAY_MAX_ITEMS);
    localStorage.setItem(getMusicNoteMediaOverlayStorageKey(safeUid), JSON.stringify(Object.fromEntries(entries)));
  } catch {}
};

const applyMusicNoteMediaOverlaysToSnapshot = (
  uid: string,
  snapshot: SoridrawCatalogSnapshot,
): SoridrawCatalogSnapshot => {
  if (!uid || snapshot.kind !== 'musicNote' || !Array.isArray(snapshot.items) || snapshot.items.length === 0) return snapshot;
  const records = readMusicNoteMediaOverlays(uid);
  if (Object.keys(records).length === 0) return snapshot;

  let changed = false;
  let recordsChanged = false;
  const items = snapshot.items.map((item) => {
    const id = String(item?.firestoreId || item?.id || '').trim();
    const record = id ? records[id] : null;
    if (!record) return item;

    const currentMediaVersion = getMusicNoteMediaVersion(item);
    if (
      (currentMediaVersion > 0 && record.mediaVersion > 0 && currentMediaVersion > record.mediaVersion)
      || (currentMediaVersion > 0 && record.mediaVersion <= 0)
    ) {
      delete records[id];
      recordsChanged = true;
      return item;
    }

    const covered = Object.entries(record.patch).every(([key, value]) => (
      JSON.stringify(item?.[key] ?? null) === JSON.stringify(value ?? null)
    ));
    if (covered) {
      // app351 — matching the local visible row is not proof that the server
      // Catalog has caught up. Keep the bounded overlay until a strictly newer
      // canonical media version arrives, otherwise the next stale Catalog GET
      // can erase the thumbnail again after a PC reload/restart.
      return item;
    }

    changed = true;
    return { ...item, ...record.patch };
  });

  if (recordsChanged) writeMusicNoteMediaOverlays(uid, records);
  return changed ? { ...snapshot, items } : snapshot;
};

// app350 — RTDB Suno/card media is a durable device-local overlay, not a
// canonical write intent. This lets a receiving PC survive reload/restart even
// when the server Catalog has not incorporated the Detail draft yet.
export const rememberMusicNoteMediaPreview = (
  uid: string,
  sourceItem: unknown,
  signalVersion = Date.now(),
): boolean => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || !sourceItem || typeof sourceItem !== 'object' || Array.isArray(sourceItem)) return false;
  const projected = projectCatalogItemForSync('musicNote', sourceItem);
  const id = String(projected?.firestoreId || projected?.id || '').trim();
  if (!projected || !id) return false;
  const patch = projectMusicNoteMediaPatch(projected);
  if (Object.keys(patch).length === 0) return false;

  const records = readMusicNoteMediaOverlays(safeUid);
  const existing = records[id];
  const mediaVersion = getMusicNoteMediaVersion(patch);
  const version = Math.max(
    1,
    Math.floor(Number(signalVersion || 0)),
    mediaVersion,
  );
  if (existing) {
    if (existing.mediaVersion > 0 && mediaVersion > 0 && existing.mediaVersion > mediaVersion) return false;
    if (existing.mediaVersion > 0 && mediaVersion <= 0) return false;
    if (existing.mediaVersion === mediaVersion && existing.version > version) return false;
  }

  records[id] = { version, mediaVersion, patch };
  writeMusicNoteMediaOverlays(safeUid, records);

  const key = catalogKey('musicNote', safeUid);
  const current = catalogMemory.get(key);
  if (current) catalogMemory.set(key, applyMusicNoteMediaOverlaysToSnapshot(safeUid, current));
  return true;
};

const normalizeCatalogItems = (kind: SoridrawCatalogKind, sourceItems: any[]): any[] => {
  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const sourceItem of Array.isArray(sourceItems) ? sourceItems : []) {
    if (normalized.length >= CATALOG_MAX_ITEMS) break;
    const projected = projectCatalogItemForSync(kind, sourceItem);
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
      // Best-effort cleanup only. Old catalog DBs are never read by the current cache generation.
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
        const record = request.result;
        if (record?.cacheGeneration !== (kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION)) {
          resolve(null);
          return;
        }
        const snapshot = record?.snapshot;
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
  const visibleSnapshot = kind === 'musicNote'
    ? applyMusicNoteMediaOverlaysToSnapshot(uid, snapshot)
    : snapshot;
  catalogMemory.set(key, visibleSnapshot);
  const database = await openCatalogDb();
  if (!database) return false;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(CATALOG_DB_STORE, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(CATALOG_DB_STORE).put({
        key, uid, kind, cacheGeneration: kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION, snapshot: visibleSnapshot,
      });
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
  if (memorySnapshot && isValidSnapshot(kind, memorySnapshot)) {
    const visibleMemory = kind === 'musicNote'
      ? applyMusicNoteMediaOverlaysToSnapshot(uid, memorySnapshot)
      : memorySnapshot;
    if (visibleMemory !== memorySnapshot) catalogMemory.set(key, visibleMemory);
    return visibleMemory;
  }
  const indexedSnapshot = await readCatalogFromIndexedDb(kind, uid);
  if (!indexedSnapshot) return null;
  const visibleIndexed = kind === 'musicNote'
    ? applyMusicNoteMediaOverlaysToSnapshot(uid, indexedSnapshot)
    : indexedSnapshot;
  catalogMemory.set(key, visibleIndexed);
  return visibleIndexed;
};

const readKnownRemoteCatalogRevision = (kind: SoridrawCatalogKind, uid: string): number => (
  readCatalogProfileRevision(kind, readUserProfileCache(uid))
);

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

const makeCatalogMutationId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

const isCatalogSyncResponse = (kind: SoridrawCatalogKind, value: any): value is CatalogSyncResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.schemaVersion !== CATALOG_SCHEMA_VERSION || value.authority !== 'server' || value.kind !== kind) return false;
  if (value.mode !== 'delta' && value.mode !== 'unchanged') return false;
  if (!Number.isInteger(value.baseRevision) || value.baseRevision <= 0) return false;
  if (!Number.isInteger(value.revision) || value.revision < value.baseRevision) return false;
  if (!Number.isInteger(value.itemCount) || value.itemCount < 0) return false;
  if (!Number.isInteger(value.generatedAtMs) || value.generatedAtMs <= 0) return false;
  if (!Array.isArray(value.deltas)) return false;
  if (value.mode === 'unchanged' && value.deltas.length !== 0) return false;
  return value.deltas.every((entry: any) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
    && typeof entry.mutationId === 'string' && entry.mutationId.trim()
    && Number.isInteger(entry.baseRevision) && entry.baseRevision > 0
    && Number.isInteger(entry.revision) && entry.revision > entry.baseRevision
    && Number.isInteger(entry.baseItemCount) && entry.baseItemCount >= 0
    && Number.isInteger(entry.nextItemCount) && entry.nextItemCount >= 0
    && Array.isArray(entry.upserts) && Array.isArray(entry.deletedIds)
  ));
};

const applyCatalogSyncResponse = (
  kind: SoridrawCatalogKind,
  local: SoridrawCatalogSnapshot | null,
  payload: CatalogSyncResponse,
): SoridrawCatalogSnapshot | null => {
  if (!local || !isValidSnapshot(kind, local) || !isCatalogSyncResponse(kind, payload)) return null;
  if (payload.baseRevision !== local.revision) return null;
  if (payload.mode === 'unchanged') {
    return payload.revision === local.revision && payload.itemCount === local.itemCount ? local : null;
  }
  const byId = new Map(local.items.map((item) => [String(item.id), item]));
  let cursorRevision = local.revision;
  let cursorCount = local.itemCount;
  for (const entry of payload.deltas) {
    if (entry.baseRevision !== cursorRevision || entry.baseItemCount !== cursorCount) return null;
    entry.deletedIds.forEach((id) => byId.delete(String(id || '').trim()));
    for (const rawItem of entry.upserts) {
      const id = String(rawItem?.id || rawItem?.firestoreId || '').trim();
      if (!id) return null;
      const projected = projectCatalogItemForSync(kind, rawItem);
      if (!projected) byId.delete(id);
      else byId.set(id, projected);
    }
    if (byId.size !== entry.nextItemCount) return null;
    cursorRevision = entry.revision;
    cursorCount = entry.nextItemCount;
  }
  if (cursorRevision !== payload.revision || cursorCount !== payload.itemCount) return null;
  const items = normalizeCatalogItems(kind, Array.from(byId.values()));
  const next: SoridrawCatalogSnapshot = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    authority: 'server',
    kind,
    revision: payload.revision,
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs: payload.generatedAtMs,
  };
  return isValidSnapshot(kind, next) && next.itemCount === payload.itemCount ? next : null;
};

const readRemoteCatalogSnapshot = async (
  kind: SoridrawCatalogKind,
  uid: string,
  minimumRevision = 0,
  localSnapshot: SoridrawCatalogSnapshot | null = null,
  allowBootstrapRepair = true,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid || !isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    markCatalogRuntimeDiagnostic(kind, { stage: 'ERROR', errorCode: 'AUTH_USER_NOT_READY' });
    return null;
  }

  markCatalogRuntimeDiagnostic(kind, { stage: 'START', attempt: 0, httpStatus: 0, remoteItemCount: 0, revision: 0, errorCode: '' });
  const retryDelays = [0, 350, 1000];
  let lastError: unknown = null;
  let allowDeltaSync = Boolean(localSnapshot && minimumRevision <= 0);
  let sharedBootstrapAttempted = false;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      markCatalogRuntimeDiagnostic(kind, { stage: 'AUTH', attempt: attempt + 1, errorCode: '' });
      // Catalog GET is owner-authorized by Firebase Auth. App Check is attached
      // when available, but a transient attestation failure cannot downgrade PREVIEW
      // into the old partial-list path.
      const headers = await authenticatedHeaders(false);
      if (!headers) throw new Error('CATALOG_AUTH_NOT_READY');
      // The shared Firebase profile revision is an invalidation fence only.
      // Healthy warm cache still returns before this request. When a remote read is
      // genuinely required, pass the fence so the Worker cannot accept an older
      // environment-local legacy Catalog as the new shared authority.
      const hardMinimumRevision = Math.max(0, Math.floor(Number(minimumRevision || 0)));
      if (hardMinimumRevision > 0) headers['X-Soridraw-Require-Revision'] = String(hardMinimumRevision);
      if (allowDeltaSync && localSnapshot) headers['X-Soridraw-Known-Revision'] = String(localSnapshot.revision);
      const requestCatalog = () => fetch(`${resolveCatalogEndpoint()}/v1/catalog/${kind}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      markCatalogRuntimeDiagnostic(kind, { stage: 'REQUEST', attempt: attempt + 1 });
      let response = await requestCatalog();

      // Shared-Catalog cutover repair is explicit and bounded. The Worker returns
      // 409 only when its shared R2 state cannot satisfy the already-known profile
      // revision. Only then may this user/kind perform one authenticated canonical
      // bootstrap. App-version changes and healthy warm entry never reach this path.
      if (response.status === 409 && !sharedBootstrapAttempted) {
        const repair = await response.json().catch(() => ({}));
        if (!allowBootstrapRepair && String(repair?.code || '') === 'CATALOG_REPAIR_REQUIRED') {
          throw new Error('CATALOG_KNOWN_MUTATION_REPAIR_REQUIRED');
        }
        if (String(repair?.code || '') === 'CATALOG_REPAIR_REQUIRED') {
          sharedBootstrapAttempted = true;
          const bootstrapHeaders = await authenticatedHeaders(true);
          if (!bootstrapHeaders) throw new Error('CATALOG_BOOTSTRAP_AUTH_NOT_READY');
          if (hardMinimumRevision > 0) bootstrapHeaders['X-Soridraw-Require-Revision'] = String(hardMinimumRevision);
          const bootstrapResponse = await fetch(`${resolveCatalogEndpoint()}/v1/catalog/${kind}/bootstrap`, {
            method: 'POST',
            headers: bootstrapHeaders,
            body: JSON.stringify({ requiredRevision: hardMinimumRevision }),
            cache: 'no-store',
          });
          if (!bootstrapResponse.ok) {
            let detail = '';
            try { detail = String(await bootstrapResponse.text()).slice(0, 180); } catch {}
            throw new Error(`CATALOG_BOOTSTRAP_${bootstrapResponse.status}${detail ? `:${detail}` : ''}`);
          }
          // Read the server-authored snapshot back through the normal path so the
          // client never treats its own local list as complete server authority.
          response = await requestCatalog();
        } else {
          throw new Error(`CATALOG_READ_409:${String(repair?.code || 'UNKNOWN')}`);
        }
      }

      markCatalogRuntimeDiagnostic(kind, { stage: 'HTTP', attempt: attempt + 1, httpStatus: response.status });
      if (response.status === 404) throw new Error('CATALOG_NOT_MATERIALIZED');
      if (!response.ok) {
        let detail = '';
        try { detail = String(await response.text()).slice(0, 180); } catch {}
        throw new Error(`CATALOG_READ_${response.status}${detail ? `:${detail}` : ''}`);
      }
      const payload = await response.json();
      let resolved: SoridrawCatalogSnapshot | null = null;
      if (isValidSnapshot(kind, payload)) resolved = payload;
      else if (allowDeltaSync && localSnapshot && isCatalogSyncResponse(kind, payload)) {
        resolved = applyCatalogSyncResponse(kind, localSnapshot, payload);
        if (!resolved) {
          allowDeltaSync = false;
          throw new Error('CATALOG_SYNC_INVALID');
        }
      } else {
        throw new Error('CATALOG_PAYLOAD_INVALID');
      }
      markCatalogRuntimeDiagnostic(kind, { stage: 'SNAPSHOT', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(resolved.itemCount || 0), revision: Number(resolved.revision || 0), errorCode: '' });
      // Never replace a newer local catalog with an older R2 base while another device's
      // delta is still converging. Keep the newer local snapshot and retry only on a later
      // invalidation signal.
      if (localSnapshot && resolved.revision < localSnapshot.revision) {
        catalogRemoteValidatedSessionKeys.add(catalogKey(kind, uid));
        markCatalogRuntimeDiagnostic(kind, { stage: 'ACCEPTED', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(localSnapshot.itemCount || 0), revision: Number(localSnapshot.revision || 0), errorCode: 'REMOTE_OLDER_THAN_LOCAL' });
        return localSnapshot;
      }
      const visibleResolved = kind === 'musicNote'
        ? applyMusicNoteMediaOverlaysToSnapshot(uid, resolved)
        : resolved;
      await writeCatalogSnapshotToLocalCache(kind, uid, visibleResolved);
      catalogRemoteValidatedSessionKeys.add(catalogKey(kind, uid));
      markCatalogRuntimeDiagnostic(kind, { stage: 'ACCEPTED', attempt: attempt + 1, httpStatus: response.status, remoteItemCount: Number(visibleResolved.itemCount || 0), revision: Number(visibleResolved.revision || 0), errorCode: '' });
      return visibleResolved;
    } catch (error) {
      lastError = error;
      const errorCode = String((error as any)?.message || error || 'CATALOG_UNKNOWN_ERROR');
      markCatalogRuntimeDiagnostic(kind, { stage: 'ERROR', attempt: attempt + 1, errorCode });
      if (errorCode.includes('CATALOG_NOT_MATERIALIZED')) break;
    }
  }
  console.warn(`[userDataEngine] ${kind} catalog snapshot read unavailable after retry.`, lastError);
  return null;
};

const catalogKnownMutationRefreshInFlight = new Map<string, Promise<SoridrawCatalogSnapshot | null>>();

export const refreshCatalogSnapshotAfterKnownMutation = async (
  kind: SoridrawCatalogKind,
  uid: string,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid || !isPreviewCatalogEnabled()) return null;
  const key = catalogKey(kind, uid);
  const existing = catalogKnownMutationRefreshInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const local = await readCatalogSnapshotFromLocalCache(kind, uid);
    // app426: this path is reached only after a real remote canonical mutation.
    // Bypass the warm-cache short-circuit so a device that missed several retained
    // RTDB item signals can consume the R2 journal delta. Never bootstrap/scan
    // Firestore from this recovery path; a missing shared Catalog is deferred.
    const remote = await readRemoteCatalogSnapshot(kind, uid, 0, local, false);
    if (!remote) return null;
    catalogLastReadSources.set(key, 'remote');
    return remote;
  })().finally(() => catalogKnownMutationRefreshInFlight.delete(key));

  catalogKnownMutationRefreshInFlight.set(key, promise);
  return promise;
};

// app517: Explicit owner-authenticated diagnostic only. This endpoint reads
// exact shared R2 membership without legacy seeding, Firestore traversal,
// IndexedDB writes or Catalog publication. Never invoke during page entry.
export type ExactSharedCatalogMembership517 = {
  materialized: boolean;
  membership: boolean | null;
  revision: number;
  itemCount: number | null;
};
export const inspectExactSharedMusicNoteCatalog517 = async (
  uid: string,
  documentId: string,
): Promise<ExactSharedCatalogMembership517> => {
  const safeUid = String(uid || '').trim();
  const safeId = String(documentId || '').trim();
  if (!safeUid || !safeId || safeId.length > 240 || safeId === '.' || safeId === '..'
    || /[\\/]/.test(safeId) || auth.currentUser?.uid !== safeUid
    || !isPreviewCatalogEnabled()) throw new Error('CATALOG_INSPECT_INVALID_ID_OR_OWNER');
  const headers = await authenticatedHeaders(true);
  if (!headers || auth.currentUser?.uid !== safeUid) throw new Error('CATALOG_INSPECT_AUTH_UNAVAILABLE');
  const response = await fetch(
    `${resolveCatalogEndpoint()}/v1/catalog/musicNote/inspect-exact?documentId=${encodeURIComponent(safeId)}`,
    { method: 'GET', headers, cache: 'no-store' },
  );
  if (!response.ok || auth.currentUser?.uid !== safeUid) throw new Error('CATALOG_INSPECT_FAILED');
  const payload: any = await response.json();
  if (payload?.ok !== true || typeof payload.materialized !== 'boolean') throw new Error('CATALOG_INSPECT_INVALID');
  if (payload.materialized) {
    if (typeof payload.membership !== 'boolean' || !Number.isInteger(payload.revision)
      || payload.revision <= 0 || !Number.isInteger(payload.itemCount) || payload.itemCount < 0) {
      throw new Error('CATALOG_INSPECT_INVALID');
    }
  } else if (payload.membership !== null || payload.revision !== 0 || payload.itemCount !== null) {
    throw new Error('CATALOG_INSPECT_INVALID');
  }
  return {
    materialized: payload.materialized,
    membership: payload.membership,
    revision: payload.revision,
    itemCount: payload.itemCount,
  };
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
    const sessionValidated = catalogRemoteValidatedSessionKeys.has(key);

    // 1054: a V5 Catalog is server-authored and may survive app restarts without
    // a redundant Worker GET when the already-paid users profile invalidation token
    // proves it is current. Unknown profile state remains fail-safe and validates remotely.
    // Music Note's shared R2 revision does not advance atomically with the
    // user-profile hint. Across browser sessions, a locally newer revision
    // cannot prove identical membership (and may omit another device's save).
    // Validate exactly once when Music Note is actually opened in this tab.
    // Subsequent entries in the same validated session are cache-first R0/W0.
    // Library retains its existing warm-cache policy unchanged.
    if (local && (kind !== 'musicNote' || sessionValidated)
      && canUseWarmCatalogWithoutRemote({
        localRevision: local.revision,
        profileRevision: knownRemoteRevision,
        sessionValidated,
      })) {
      catalogLastReadSources.set(key, 'cache');
      return local;
    }

    // The profile revision is only an invalidation hint. A healthy warm Catalog
    // above already returned with zero Worker/Firestore work. A cold/missing/stale
    // device passes this revision fence; only an explicit shared-Catalog 409 may
    // trigger one bounded canonical bootstrap for this user/kind.
    const remote = await readRemoteCatalogSnapshot(kind, uid, knownRemoteRevision, local);
    if (remote) {
      catalogLastReadSources.set(key, 'remote');
      return remote;
    }

    // A server-unvalidated local snapshot must not masquerade as complete Catalog.
    // The caller can keep its legacy localStorage list as provisional paint/error fallback.
    if (!sessionValidated) {
      catalogLastReadSources.set(key, 'none');
      return null;
    }
    if (local && knownRemoteRevision > local.revision) {
      catalogLastReadSources.set(key, 'none');
      return null;
    }
    catalogLastReadSources.set(key, local ? 'cache' : 'none');
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
  explicitDeletedIds: string[] = [],
  confirmedChangedIds: string[] = [],
): { delta: CatalogDelta; nextSnapshot: SoridrawCatalogSnapshot } | null => {
  const projectedItems = normalizeCatalogItems(kind, sourceItems);
  if (projectedItems.length > CATALOG_MAX_ITEMS) return null;
  const confirmed = kind === 'musicNote' ? new Set(confirmedChangedIds) : new Set<string>();
  const previousById = new Map(previous.items.map((item) => [String(item.id), item]));
  const nextById = new Map(previous.items.map((item) => [String(item.id), item]));
  const upserts: any[] = [];

  // A UI/cache list is never deletion authority. It may be partial. Only explicit
  // mutation tombstones may remove rows from the full server-proven catalog.
  for (const item of projectedItems) {
    const id = String(item.id);
    const prior = previousById.get(id);
    // A successful exact-item canonical mutation must not vanish because
    // local IndexedDB already had the same row while shared R2 missed it.
    // Never force an entire UI list or an optimistic Studio-heart overlay.
    if (!prior || stableItemHash(prior) !== stableItemHash(item) || confirmed.has(id)) {
      upserts.push(item);
      nextById.set(id, item);
    }
  }

  const deletedIds = Array.from(new Set(
    (Array.isArray(explicitDeletedIds) ? explicitDeletedIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => id && previousById.has(id))
  ));
  deletedIds.forEach((id) => nextById.delete(id));

  if (upserts.length + deletedIds.length > CATALOG_DELTA_MAX_CHANGES) return null;
  const items = normalizeCatalogItems(kind, Array.from(nextById.values()));
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
      mutationId: makeCatalogMutationId(),
      baseRevision: previous.revision,
      baseItemCount: previous.itemCount,
      revision: nextRevision,
      nextItemCount: nextSnapshot.itemCount,
      upserts,
      deletedIds,
    },
    nextSnapshot,
  };
};

const publishRemoteCatalogDelta = async (
  uid: string,
  delta: CatalogDelta,
): Promise<{ revision: number; itemCount: number; conflict?: boolean } | null> => {
  if (!isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;
  try {
    const headers = await authenticatedHeaders();
    if (!headers) return null;
    const response = await fetch(`${resolveCatalogEndpoint()}/v1/catalog/${delta.kind}/delta`, {
      method: 'POST',
      headers,
      body: JSON.stringify(delta),
      cache: 'no-store',
    });
    if (response.status === 409) {
      const conflictPayload = await response.json().catch(() => ({}));
      return {
        revision: Math.floor(Number(conflictPayload?.revision || 0)),
        itemCount: Math.max(0, Math.floor(Number(conflictPayload?.itemCount || 0))),
        conflict: true,
      };
    }
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

const flushCatalogPendingPublishOnce521 = async (key: string): Promise<void> => {
  const pending = catalogPendingPublishes.get(key);
  if (!pending) return;
  const { kind, uid, sourceItems, options } = pending;
  const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  // In-memory Firestore dirty counters reset on refresh. The exact saved
  // pending intent remains valid even when that counter restarts at zero.
  const pendingRevision = Math.max(currentDirtyRevision, pending.dirtyRevision);

  let previous = await readCatalogSnapshotFromLocalCache(kind, uid);

  // Missing local state is repaired only from the already-materialized R2 Catalog.
  // Never convert a missing/stale local cache into a Firestore collection rebuild.
  if (!previous) {
    const refreshed = await readRemoteCatalogSnapshot(kind, uid, readKnownRemoteCatalogRevision(kind, uid), null);
    if (!refreshed) {
      console.warn(`[userDataEngine] ${kind} catalog publish deferred: server catalog not materialized.`);
      return;
    }
    previous = refreshed;
  }

  const explicitDeletedIds = Array.from(new Set(
    (Array.isArray(options.deletedIds) ? options.deletedIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  ));

  // Partial UI lists are safe delta sources because absence is never interpreted as a
  // deletion. Only explicit tombstones remove items from the canonical Catalog.
  const built = buildCatalogDelta(
    kind,
    previous,
    sourceItems,
    pendingRevision,
    explicitDeletedIds,
    pending.confirmedChangedIds || [],
  );
  if (!built) {
    console.warn(`[userDataEngine] ${kind} catalog delta deferred: change set is not safely representable.`);
    return;
  }

  if (built.delta.upserts.length === 0 && built.delta.deletedIds.length === 0) {
    clearCatalogPending519(key, pending, pending.dirtyRevision);
    return;
  }

  const published = await publishRemoteCatalogDelta(uid, built.delta);
  if (!published) throw new Error(`catalog ${kind} delta publish failed`);
  if (published.conflict) {
    await readRemoteCatalogSnapshot(kind, uid, readKnownRemoteCatalogRevision(kind, uid), previous);
    return;
  }
  if (published.itemCount !== built.nextSnapshot.itemCount) {
    await readRemoteCatalogSnapshot(kind, uid, readKnownRemoteCatalogRevision(kind, uid), previous);
    return;
  }

  const confirmedSnapshot: SoridrawCatalogSnapshot = {
    ...built.nextSnapshot,
    revision: published.revision,
  };
  await writeCatalogSnapshotToLocalCache(kind, uid, confirmedSnapshot);
  clearCatalogPending519(key, pending, pending.dirtyRevision);
};

// app521: one publish per committed changed-item batch. No worker/read on heart
// preview, page visit or refresh, and no full favorites collection scan.
// A failed attempt stays in the existing durable pending queue for startup/manual
// recovery; only two bounded retries are scheduled in the active browser.
const flushCatalogPendingPublish = (key: string): Promise<void> => {
  const active = catalogPublishInFlight521.get(key);
  if (active) return active;
  const job = flushCatalogPendingPublishOnce521(key).finally(() => {
    catalogPublishInFlight521.delete(key);
  });
  catalogPublishInFlight521.set(key, job);
  return job;
};

const scheduleCommittedMusicNoteCatalogFlush521 = (key: string, delayMs = MUSIC_NOTE_CATALOG_AFTER_COMMIT_MS_521): void => {
  const existing = catalogPublishTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    catalogPublishTimers.delete(key);
    const active = catalogPublishInFlight521.get(key);
    if (active) {
      // A newer write arrived during an older ACK. Retry only after the old
      // in-flight request settles; never send competing R2 CAS deltas.
      void active.then(
        () => { if (catalogPendingPublishes.has(key)) scheduleCommittedMusicNoteCatalogFlush521(key); },
        () => { if (catalogPendingPublishes.has(key)) scheduleCommittedMusicNoteCatalogFlush521(key); },
      );
      return;
    }
    if (!catalogPendingPublishes.has(key)) return;
    const before = catalogPendingPublishes.get(key);
    void flushCatalogPendingPublish(key).catch((error) => {
      console.warn('[userDataEngine] committed Music Note Catalog auto publish deferred.', error);
    }).finally(() => {
      const stillPending = catalogPendingPublishes.get(key);
      if (!stillPending) {
        catalogPublishRetryCount521.delete(key);
        return;
      }
      if (stillPending !== before) {
        // A new Firestore mutation was staged while the old delta was in flight.
        catalogPublishRetryCount521.delete(key);
        scheduleCommittedMusicNoteCatalogFlush521(key);
        return;
      }
      const attempt = catalogPublishRetryCount521.get(key) || 0;
      if (attempt < MUSIC_NOTE_CATALOG_RETRY_DELAYS_521.length) {
        catalogPublishRetryCount521.set(key, attempt + 1);
        scheduleCommittedMusicNoteCatalogFlush521(key, MUSIC_NOTE_CATALOG_RETRY_DELAYS_521[attempt]);
      }
    });
  }, delayMs);
  catalogPublishTimers.set(key, timer);
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
  const previous = restoreCatalogPending519(kind, uid);
  const byId = new Map<string, any>(
    (previous?.sourceItems || []).map((item) => [String(item.id), item])
  );
  const deleted = new Set<string>(previous?.options.deletedIds || []);
  const confirmed = new Set<string>(previous?.confirmedChangedIds || []);
  const normalizedIncoming = normalizeCatalogItems(kind, sourceItems);
  // Only the exact one-row call has enough evidence to identify a
  // committed changed document. A full UI list is never an upsert mandate.
  if (kind === 'musicNote' && normalizedIncoming.length === 1
    && !(options.deletedIds || []).length) confirmed.add(String(normalizedIncoming[0].id));
  // Consecutive successful favorite writes may each report only one item.
  // Merge the pending items instead of overwriting song A with song B.
  for (const item of normalizedIncoming) {
    byId.set(String(item.id), item);
    deleted.delete(String(item.id));
  }
  for (const id of options.deletedIds || []) {
    const safeId = String(id || '').trim();
    if (!safeId) continue;
    deleted.add(safeId);
    byId.delete(safeId);
    confirmed.delete(safeId);
  }
  const pending: CatalogPendingPublish519 = {
    kind, uid, sourceItems: Array.from(byId.values()),
    options: { ...options, deletedIds: Array.from(deleted) },
    dirtyRevision: Math.max(dirtyRevision, previous?.dirtyRevision || 0),
    confirmedChangedIds: [...confirmed].filter(id => byId.has(id)),
  };
  catalogPendingPublishes.set(key, pending);
  // No timer, Worker call or Firestore read here. Only real mutations write
  // the local recovery marker; unchanged page visits are R0/W0.
  if (!persistCatalogPending519(pending)) {
    console.warn('[userDataEngine] pending Catalog mutation retained in memory only.');
  }
  // Only Music Note's successful Firestore dirty marker can enter this path.
  // Library's existing batching cadence and page-exit behavior stay untouched.
  if (kind === 'musicNote') {
    catalogPublishRetryCount521.delete(key);
    scheduleCommittedMusicNoteCatalogFlush521(key);
  }
};

export const getPendingCatalogPublishCount = (uid: string): number => {
  if (!uid) return 0;
  restoreCatalogPending519('musicNote', uid);
  restoreCatalogPending519('library', uid);
  return [...catalogPendingPublishes.values()]
    .filter((pending) => pending.uid === uid && pending.dirtyRevision > 0)
    .length;
};

export const flushPendingCatalogPublishes = async (uid: string): Promise<void> => {
  if (!uid) return;
  restoreCatalogPending519('musicNote', uid);
  restoreCatalogPending519('library', uid);
  const keys = [...catalogPendingPublishes.entries()]
    .filter(([, pending]) => pending.uid === uid)
    .map(([key]) => key);
  for (const key of keys) await flushCatalogPendingPublish(key);
};

export const getCatalogRenderBatchSize = (kind: SoridrawCatalogKind): number => (
  SORIDRAW_USER_DATA_STRATEGIES[kind].renderBatchSize
);
