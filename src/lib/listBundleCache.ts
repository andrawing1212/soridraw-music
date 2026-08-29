import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { markCacheDiagnosticWrite } from './cacheDiagnostics';

export type ListBundleKind = 'musicNote' | 'library';

export type ListBundleSnapshot = {
  schemaVersion: number;
  kind: ListBundleKind;
  items: any[];
  itemCount: number;
  cursorCreatedAtMs: number;
  hasMore: boolean;
  deletedIds: string[];
  updatedAtMs: number;
};

type BundleWriteOptions = {
  limit: number;
  hasMore?: boolean;
  deletedIds?: string[];
};

type BundleListenerCallbacks = {
  onData: (bundle: ListBundleSnapshot, meta: { fromCache: boolean }) => void;
  onMissing?: (meta: { fromCache: boolean }) => void;
  onError?: (error: any) => void;
};

const LIST_BUNDLE_COLLECTION = 'user_list_caches';
const LIST_BUNDLE_SCHEMA_VERSION = 1;
const LIST_BUNDLE_MAX_BYTES = 850_000;
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastPayloadHashes = new Map<string, string>();

const getBundleDocId = (kind: ListBundleKind) => (
  kind === 'musicNote' ? 'music_note_latest_20' : 'library_latest_10_sets'
);

const getBundleKey = (kind: ListBundleKind, uid: string) => `${kind}:${uid}`;

const getBundleRef = (kind: ListBundleKind, uid: string) => (
  doc(db, LIST_BUNDLE_COLLECTION, uid, 'bundles', getBundleDocId(kind))
);

const getCreatedAtMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === 'number') {
    const ms = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(ms) ? ms : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemCreatedAtMs = (item: any): number => (
  Number(item?.createdAtMs || 0)
  || getCreatedAtMs(item?.createdAt)
  || Number(item?.updatedAtMs || 0)
  || getCreatedAtMs(item?.updatedAt)
  || 0
);

const getItemId = (item: any): string => String(item?.firestoreId || item?.id || '').trim();

const isLegacyMusicNoteVisible = (item: any): boolean => {
  if (!item) return false;
  if (item?.musicNoteListEligible === true) return true;
  if (item?.musicNoteListEligible === false) return false;

  const removed = Boolean(
    item?.favoriteRemoved === true
    || item?.saved === false
    || item?.favoriteRemovedAt
    || item?.unlikedAt
    || item?.unsavedAt
    || item?.hidden === true
    || item?.favoriteHidden === true
    || item?.deletedAt
    || item?.trashedAt
  );
  const shared = Boolean(
    item?.isSharedMusicNote === true
    || item?.sharedReadOnly === true
    || String(item?.sourceType || '') === 'shared_music_note'
    || item?.sharedNoteShareId
  );
  return !removed && !shared;
};

const HISTORY_KEYS = new Set([
  'lyricRevisions',
  'lyricsHistory',
  'lyricHistory',
  'revisionHistory',
  'editHistory',
]);

const HEAVY_LIBRARY_KEYS = new Set([
  'apiResponse',
  'rawApiResponse',
  'callbackPayload',
  'debugPayload',
]);

const cleanValue = (value: any, kind: ListBundleKind, depth = 0): any => {
  if (value === null || value === undefined) return value === null ? null : undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date || typeof value?.toMillis === 'function') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanValue(entry, kind, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  if (depth > 12) return undefined;

  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (kind === 'musicNote' && HISTORY_KEYS.has(key)) return;
    if (kind === 'library' && HEAVY_LIBRARY_KEYS.has(key)) return;
    const cleaned = cleanValue(entry, kind, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const stringifyForSize = (value: any) => JSON.stringify(value, (_key, entry) => {
  if (entry && typeof entry?.toMillis === 'function') return entry.toMillis();
  return entry;
});

const getByteSize = (value: any): number => {
  try {
    const text = stringifyForSize(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return text.length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const normalizeDeletedIds = (value?: string[]) => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
)).slice(-450);

const prepareItems = (kind: ListBundleKind, sourceItems: any[], limit: number): any[] => {
  const source = [...(Array.isArray(sourceItems) ? sourceItems : [])].filter(Boolean);
  const eligibleSource = kind === 'musicNote'
    ? source.filter(isLegacyMusicNoteVisible)
    : source;
  const sorted = eligibleSource
    .sort((a, b) => {
      const createdDelta = getItemCreatedAtMs(b) - getItemCreatedAtMs(a);
      if (createdDelta !== 0) return createdDelta;
      return getItemId(b).localeCompare(getItemId(a));
    })
    .slice(0, Math.max(1, limit));

  return sorted.map((item) => cleanValue(item, kind)).filter(Boolean);
};

const buildComparablePayload = (
  kind: ListBundleKind,
  items: any[],
  options: BundleWriteOptions,
) => {
  const safeItems = prepareItems(kind, items, options.limit);
  const deletedIds = normalizeDeletedIds(options.deletedIds);
  const cursorCreatedAtMs = safeItems.length > 0
    ? getItemCreatedAtMs(safeItems[safeItems.length - 1])
    : 0;
  const hasMore = typeof options.hasMore === 'boolean'
    ? options.hasMore
    : safeItems.length >= options.limit;

  return {
    schemaVersion: LIST_BUNDLE_SCHEMA_VERSION,
    kind,
    items: safeItems,
    itemCount: safeItems.length,
    cursorCreatedAtMs,
    hasMore,
    deletedIds,
  };
};

const makePayloadHash = (payload: any) => stringifyForSize(payload);

export const rememberListBundleSnapshot = (
  kind: ListBundleKind,
  uid: string,
  bundle: Pick<ListBundleSnapshot, 'items' | 'hasMore' | 'deletedIds'>,
  limit: number,
) => {
  if (!uid) return;
  const comparable = buildComparablePayload(kind, bundle.items, {
    limit,
    hasMore: bundle.hasMore,
    deletedIds: bundle.deletedIds,
  });
  lastPayloadHashes.set(getBundleKey(kind, uid), makePayloadHash(comparable));
};

export const scheduleListBundleWrite = (
  kind: ListBundleKind,
  uid: string,
  items: any[],
  options: BundleWriteOptions,
) => {
  if (!uid || !Array.isArray(items)) return;
  const key = getBundleKey(kind, uid);
  const comparable = buildComparablePayload(kind, items, options);
  const payloadHash = makePayloadHash(comparable);
  if (lastPayloadHashes.get(key) === payloadHash) return;

  const existingTimer = writeTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    writeTimers.delete(key);
    if (lastPayloadHashes.get(key) === payloadHash) return;

    const payload = {
      ...comparable,
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    };

    if (getByteSize(payload) > LIST_BUNDLE_MAX_BYTES) {
      console.warn(`[listBundleCache] ${kind} bundle skipped because it is too large.`);
      return;
    }

    try {
      await setDoc(getBundleRef(kind, uid), payload, { merge: false });
      markCacheDiagnosticWrite(kind === 'musicNote' ? 'musicNote' : 'library', 1);
      lastPayloadHashes.set(key, payloadHash);
    } catch (error: any) {
      // Preview/test can safely fall back to the existing per-item query until the
      // additive Firestore rule for user_list_caches is explicitly deployed.
      console.warn(`[listBundleCache] ${kind} bundle write unavailable:`, error?.code || error);
    }
  }, 1200);

  writeTimers.set(key, timer);
};

export const subscribeListBundle = (
  kind: ListBundleKind,
  uid: string,
  callbacks: BundleListenerCallbacks,
) => {
  if (!uid) return () => {};

  return onSnapshot(
    getBundleRef(kind, uid),
    (snapshot) => {
      const meta = { fromCache: snapshot.metadata.fromCache };
      if (!snapshot.exists()) {
        callbacks.onMissing?.(meta);
        return;
      }

      const data = snapshot.data() || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const bundle: ListBundleSnapshot = {
        schemaVersion: Number(data.schemaVersion || 0),
        kind,
        items,
        itemCount: Number(data.itemCount || items.length || 0),
        cursorCreatedAtMs: Number(data.cursorCreatedAtMs || 0),
        hasMore: data.hasMore === true,
        deletedIds: normalizeDeletedIds(data.deletedIds),
        updatedAtMs: Number(data.updatedAtMs || 0),
      };

      rememberListBundleSnapshot(kind, uid, bundle, kind === 'musicNote' ? 20 : 10);
      callbacks.onData(bundle, meta);
    },
    (error) => callbacks.onError?.(error),
  );
};