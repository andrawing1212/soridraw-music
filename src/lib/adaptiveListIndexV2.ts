import { doc, getDocFromServer, readAdaptiveListIndexDirtyRevision, clearAdaptiveListIndexDirtyRevision } from './firestoreMeasured';
import { db, functions, httpsCallable } from '../firebase';

export type AdaptiveListIndexKind = 'musicNote' | 'library';

export type AdaptiveListIndexSnapshot = {
  schemaVersion: number;
  kind: AdaptiveListIndexKind;
  items: any[];
  itemCount: number;
  cursorCreatedAtMs: number;
  hasMore: boolean;
  deletedIds: string[];
  updatedAtMs: number;
};

type AdaptivePublishOptions = {
  hasMore?: boolean;
  deletedIds?: string[];
};

const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
const ADAPTIVE_LIST_INDEX_SCHEMA_VERSION = 2;
const ADAPTIVE_LIST_INDEX_TARGET_BYTES = 700_000;
const ADAPTIVE_LIST_INDEX_MAX_ITEMS = 400;
const ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS = 450;
const ADAPTIVE_LIST_INDEX_PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);
const publishTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastPublishedHashes = new Map<string, string>();

const docIdForKind = (kind: AdaptiveListIndexKind) => (
  kind === 'musicNote' ? 'music_note_adaptive_v2' : 'library_adaptive_v2'
);

export const isPreviewAdaptiveListIndexEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return ADAPTIVE_LIST_INDEX_PREVIEW_HOSTS.has(window.location.hostname.toLowerCase());
};

const getCreatedAtMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? Math.floor(ms) : 0;
  }
  if (typeof value?.seconds === 'number') {
    const ms = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(ms) ? Math.floor(ms) : 0;
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
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
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

const isMusicNoteActive = (item: any): boolean => !(
  item?.favoriteRemoved === true
  || item?.saved === false
  || item?.hidden === true
  || item?.favoriteHidden === true
  || item?.deletedAt
  || item?.trashedAt
);

const normalizeDeletedIds = (value?: string[]): string[] => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean),
)).slice(-ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS);

const byteSize = (value: unknown): number => {
  try {
    const text = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return text.length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const buildAdaptivePayload = (
  kind: AdaptiveListIndexKind,
  sourceItems: any[],
  options: AdaptivePublishOptions,
) => {
  const candidates = [...(Array.isArray(sourceItems) ? sourceItems : [])]
    .filter(Boolean)
    .filter((item) => kind !== 'musicNote' || isMusicNoteActive(item))
    .sort((left, right) => {
      const timeDiff = getItemCreatedAtMs(right) - getItemCreatedAtMs(left);
      if (timeDiff !== 0) return timeDiff;
      return String(left?.id || '').localeCompare(String(right?.id || ''));
    });

  const items: any[] = [];
  const seenIds = new Set<string>();
  for (const sourceItem of candidates) {
    if (items.length >= ADAPTIVE_LIST_INDEX_MAX_ITEMS) break;
    const id = String(sourceItem?.id || '').trim();
    const createdAtMs = getItemCreatedAtMs(sourceItem);
    if (!id || seenIds.has(id) || createdAtMs <= 0) continue;
    const cleaned = cleanValue(sourceItem);
    if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) continue;
    const candidate = { ...cleaned, id, createdAtMs };
    const nextItems = [...items, candidate];
    const probe = {
      schemaVersion: ADAPTIVE_LIST_INDEX_SCHEMA_VERSION,
      kind,
      items: nextItems,
      itemCount: nextItems.length,
      cursorCreatedAtMs: createdAtMs,
      hasMore: true,
      deletedIds: normalizeDeletedIds(options.deletedIds),
    };
    if (byteSize(probe) > ADAPTIVE_LIST_INDEX_TARGET_BYTES) break;
    items.push(candidate);
    seenIds.add(id);
  }

  const cursorCreatedAtMs = items.length > 0 ? getItemCreatedAtMs(items[items.length - 1]) : 0;
  const hasMore = Boolean(options.hasMore || candidates.length > items.length);
  return {
    schemaVersion: ADAPTIVE_LIST_INDEX_SCHEMA_VERSION,
    kind,
    items,
    itemCount: items.length,
    cursorCreatedAtMs,
    hasMore,
    deletedIds: normalizeDeletedIds(options.deletedIds),
  };
};

const isCompatibleAdaptiveBundle = (kind: AdaptiveListIndexKind, value: unknown): value is AdaptiveListIndexSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, any>;
  if (data.schemaVersion !== ADAPTIVE_LIST_INDEX_SCHEMA_VERSION || data.kind !== kind) return false;
  if (!Array.isArray(data.items) || data.items.length > ADAPTIVE_LIST_INDEX_MAX_ITEMS) return false;
  if (!Number.isInteger(data.itemCount) || data.itemCount !== data.items.length) return false;
  if (!Number.isInteger(data.cursorCreatedAtMs) || data.cursorCreatedAtMs < 0) return false;
  if (typeof data.hasMore !== 'boolean') return false;
  if (!Array.isArray(data.deletedIds) || data.deletedIds.length > ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS) return false;
  if (!Number.isInteger(data.updatedAtMs) || data.updatedAtMs <= 0) return false;
  const ids = new Set<string>();
  let previousTime = Number.MAX_SAFE_INTEGER;
  for (const item of data.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = String(item.id || '').trim();
    const time = getItemCreatedAtMs(item);
    if (!id || ids.has(id) || time <= 0 || time > previousTime) return false;
    ids.add(id);
    previousTime = time;
  }
  if (data.items.length === 0) return data.cursorCreatedAtMs === 0;
  return data.cursorCreatedAtMs === getItemCreatedAtMs(data.items[data.items.length - 1]);
};

export const readPreviewAdaptiveListIndexV2 = async (
  kind: AdaptiveListIndexKind,
  uid: string,
): Promise<AdaptiveListIndexSnapshot | null> => {
  if (!uid || !isPreviewAdaptiveListIndexEnabled()) return null;
  try {
    const snapshot = await getDocFromServer(
      doc(db, 'user_list_caches', uid, 'bundles', docIdForKind(kind)),
    );
    if (!snapshot.exists()) return null;
    const data = snapshot.data() || {};
    if (!isCompatibleAdaptiveBundle(kind, data)) return null;
    return {
      schemaVersion: Number(data.schemaVersion),
      kind,
      items: data.items,
      itemCount: Number(data.itemCount),
      cursorCreatedAtMs: Number(data.cursorCreatedAtMs),
      hasMore: data.hasMore === true,
      deletedIds: normalizeDeletedIds(data.deletedIds),
      updatedAtMs: Number(data.updatedAtMs),
    };
  } catch (error) {
    console.warn('[adaptiveListIndexV2] preview index unavailable; using legacy bounded path.', error);
    return null;
  }
};

export const schedulePreviewAdaptiveListIndexPublishIfDirty = (
  kind: AdaptiveListIndexKind,
  uid: string,
  sourceItems: any[],
  options: AdaptivePublishOptions = {},
): void => {
  if (!uid || !Array.isArray(sourceItems) || !isPreviewAdaptiveListIndexEnabled()) return;
  const dirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  if (dirtyRevision <= 0) return;

  const payload = buildAdaptivePayload(kind, sourceItems, options);
  if (payload.items.length === 0 && sourceItems.length > 0) return;
  const payloadHash = JSON.stringify(payload);
  const key = `${kind}:${uid}`;
  if (lastPublishedHashes.get(key) === payloadHash) {
    clearAdaptiveListIndexDirtyRevision(kind, dirtyRevision);
    return;
  }

  const existing = publishTimers.get(key);
  if (existing) clearTimeout(existing);
  publishTimers.set(key, setTimeout(() => {
    publishTimers.delete(key);
    const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
    if (currentDirtyRevision <= 0) return;
    const callable = httpsCallable(functions, 'publishPreviewAdaptiveListIndexV2');
    void callable({ ...payload, dirtyRevision: currentDirtyRevision })
      .then(() => {
        lastPublishedHashes.set(key, payloadHash);
        clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
      })
      .catch((error) => {
        console.warn('[adaptiveListIndexV2] preview index publish failed; canonical data remains authoritative.', error);
      });
  }, 1800));
};
