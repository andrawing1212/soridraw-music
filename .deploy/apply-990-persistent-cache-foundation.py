from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


persistent_cache = r'''export type SoridrawCacheEnvironment = 'preview' | 'test' | 'production' | 'local' | string;

export type SoridrawCacheEnvelope<T> = {
  schemaVersion: number | string;
  dataVersion: number | string;
  uid: string | null;
  environment: SoridrawCacheEnvironment;
  cacheKey: string;
  sourceType: string;
  updatedAt: number;
  syncedAt: number;
  syncCursor: string | null;
  serverRevision: string | null;
  deletedIds: string[];
  expiresAt: number | null;
  dirty: boolean;
  pendingMutationId: string | null;
  data: T;
};

type CacheIdentity = {
  cacheKey: string;
  sourceType: string;
  schemaVersion: number | string;
  uid?: string | null;
};

type CacheWriteInput<T> = CacheIdentity & {
  dataVersion: number | string;
  data: T;
  updatedAt?: number;
  syncedAt?: number;
  syncCursor?: string | null;
  serverRevision?: string | null;
  deletedIds?: string[];
  expiresAt?: number | null;
  dirty?: boolean;
  pendingMutationId?: string | null;
};

const CACHE_STORAGE_PREFIX = 'soridraw_cache_envelope_v1';

export const getSoridrawCacheEnvironment = (): SoridrawCacheEnvironment => {
  if (typeof window === 'undefined') return 'local';
  const hostname = String(window.location.hostname || '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  if (
    hostname === 'preview.soridraw.com' ||
    hostname === 'soridraw-preview.web.app' ||
    hostname === 'soridraw-preview.firebaseapp.com'
  ) return 'preview';
  if (hostname === 'test.soridraw.com') return 'test';
  if (
    hostname === 'soridraw.com' ||
    hostname === 'www.soridraw.com' ||
    hostname === 'soridraw.web.app' ||
    hostname === 'soridraw.firebaseapp.com'
  ) return 'production';
  return `host:${hostname}`;
};

const normalizeUid = (uid?: string | null) => {
  const normalized = String(uid || '').trim();
  return normalized || null;
};

const buildStorageKey = (cacheKey: string, uid?: string | null) => {
  const environment = getSoridrawCacheEnvironment();
  const owner = normalizeUid(uid) || 'public';
  return `${CACHE_STORAGE_PREFIX}:${encodeURIComponent(environment)}:${encodeURIComponent(owner)}:${encodeURIComponent(cacheKey)}`;
};

const isEnvelopeCompatible = <T>(
  envelope: SoridrawCacheEnvelope<T>,
  identity: CacheIdentity,
) => {
  const expectedUid = normalizeUid(identity.uid);
  return (
    envelope &&
    typeof envelope === 'object' &&
    String(envelope.schemaVersion) === String(identity.schemaVersion) &&
    envelope.cacheKey === identity.cacheKey &&
    envelope.sourceType === identity.sourceType &&
    envelope.environment === getSoridrawCacheEnvironment() &&
    normalizeUid(envelope.uid) === expectedUid
  );
};

export const readSoridrawPersistentCache = <T>(
  identity: CacheIdentity,
): SoridrawCacheEnvelope<T> | null => {
  if (typeof window === 'undefined') return null;
  const storageKey = buildStorageKey(identity.cacheKey, identity.uid);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as SoridrawCacheEnvelope<T>;
    if (!isEnvelopeCompatible(envelope, identity)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    if (envelope.expiresAt && envelope.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return envelope;
  } catch {
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
    return null;
  }
};

export const writeSoridrawPersistentCache = <T>(input: CacheWriteInput<T>) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const envelope: SoridrawCacheEnvelope<T> = {
    schemaVersion: input.schemaVersion,
    dataVersion: input.dataVersion,
    uid: normalizeUid(input.uid),
    environment: getSoridrawCacheEnvironment(),
    cacheKey: input.cacheKey,
    sourceType: input.sourceType,
    updatedAt: input.updatedAt ?? now,
    syncedAt: input.syncedAt ?? now,
    syncCursor: input.syncCursor ?? null,
    serverRevision: input.serverRevision ?? null,
    deletedIds: Array.isArray(input.deletedIds) ? [...input.deletedIds] : [],
    expiresAt: input.expiresAt ?? null,
    dirty: Boolean(input.dirty),
    pendingMutationId: input.pendingMutationId ?? null,
    data: input.data,
  };
  try {
    window.localStorage.setItem(buildStorageKey(input.cacheKey, input.uid), JSON.stringify(envelope));
  } catch (error) {
    console.warn('[SORIDRAW cache] persistent write skipped:', input.cacheKey, error);
  }
};

export const removeSoridrawPersistentCache = (cacheKey: string, uid?: string | null) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(buildStorageKey(cacheKey, uid)); } catch { /* ignore */ }
};

export const removeSoridrawPersistentCachesBySourceType = (
  sourceType: string,
  uid?: string | null,
) => {
  if (typeof window === 'undefined') return;
  const wantedUid = uid === undefined ? undefined : normalizeUid(uid);
  const environment = getSoridrawCacheEnvironment();
  const keys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${CACHE_STORAGE_PREFIX}:`)) keys.push(key);
    }
    keys.forEach((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const envelope = JSON.parse(raw) as SoridrawCacheEnvelope<unknown>;
        if (envelope.environment !== environment || envelope.sourceType !== sourceType) return;
        if (wantedUid !== undefined && normalizeUid(envelope.uid) !== wantedUid) return;
        window.localStorage.removeItem(key);
      } catch {
        // Leave unrelated or legacy cache entries untouched.
      }
    });
  } catch {
    // Persistent cache is an optimization; app data remains server-backed.
  }
};
'''
(ROOT / 'src/lib/soridrawPersistentCache.ts').write_text(persistent_cache, encoding='utf-8')

explore_session_cache = r'''import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990
const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_FEED_SOURCE_TYPE = 'explore_feed';

type ExploreFeedCacheData = {
  rows: Array<Record<string, unknown>>;
};

type ExploreFeedMemoryEntry = {
  rows: Array<Record<string, unknown>>;
};

const exploreFeedMemoryCache = new Map<string, ExploreFeedMemoryEntry>();

const isFeedRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed';
  } catch {
    return url.includes('/v1/feed?');
  }
};

const getFeedCacheKey = (url: string) => `explore-feed:${url}`;

const cloneRows = (rows: Array<Record<string, unknown>>) => rows.map((row) => ({ ...row }));

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return cloneRows(memory.rows);

  const envelope = readSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    uid: null,
  });
  if (!envelope || !Array.isArray(envelope.data?.rows)) return null;
  const rows = cloneRows(envelope.data.rows);
  exploreFeedMemoryCache.set(url, { rows });
  return cloneRows(rows);
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
  syncCursor: string | null = null,
) => {
  if (!isFeedRequest(url)) return;
  const cloned = cloneRows(rows);
  exploreFeedMemoryCache.set(url, { rows: cloned });
  writeSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: null,
    syncCursor,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: { rows: cloned },
  });
};

export const patchExploreFeedSessionCacheRow = (
  url: string,
  trackId: string,
  patch: Record<string, unknown>,
) => {
  if (!isFeedRequest(url)) return;
  const cached = readExploreFeedSessionCache(url);
  if (!cached) return;
  let changed = false;
  const rows = cached.map((row) => {
    const rowId = String(row.id || row.trackId || '').trim();
    if (!rowId || rowId !== trackId) return row;
    changed = true;
    return { ...row, ...patch };
  });
  if (!changed) return;
  const previous = readSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    uid: null,
  });
  writeExploreFeedSessionCache(url, rows, previous?.syncCursor ?? null);
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedMemoryCache.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_FEED_SOURCE_TYPE);
};
'''
(ROOT / 'src/services/exploreSessionCache.ts').write_text(explore_session_cache, encoding='utf-8')

# Explore like state: sessionStorage -> persistent common envelope; do not invalidate full feed after a like mutation.
replace_once(
    'src/services/exploreLikeService.ts',
    "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\nimport { invalidateExploreFeedSessionCache } from './exploreSessionCache';",
    "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\nimport { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';",
    'like-imports',
)
like_path = ROOT / 'src/services/exploreLikeService.ts'
like_text = like_path.read_text(encoding='utf-8')
start = like_text.find('// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_989')
end = like_text.find('const buildAuthHeaders = async', start)
if start < 0 or end < 0:
    raise SystemExit('like-cache-block: anchors not found')
like_block = r'''// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const likedStateByUid = new Map<string, Map<string, boolean>>();

const readLikedStateStorage = (uid: string): Map<string, boolean> => {
  const values = new Map<string, boolean>();
  const envelope = readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return values;
  Object.entries(envelope.data).forEach(([trackId, liked]) => {
    if (trackId && typeof liked === 'boolean') values.set(trackId, liked);
  });
  return values;
};

const persistLikedStateCache = (uid: string, cache: Map<string, boolean>) => {
  writeSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: Object.fromEntries(cache),
  });
};

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = readLikedStateStorage(normalizedUid);
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};

'''
like_text = like_text[:start] + like_block + like_text[end:]
like_text = like_text.replace('  invalidateExploreFeedSessionCache();\n  return result;', '  return result;', 1)
like_path.write_text(like_text, encoding='utf-8')

# Music Note publication state: sessionStorage -> persistent common envelope.
replace_once(
    'src/services/explorePublicationService.ts',
    "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\nimport { invalidateExploreFeedSessionCache } from './exploreSessionCache';",
    "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\nimport {\n  readSoridrawPersistentCache,\n  removeSoridrawPersistentCache,\n  removeSoridrawPersistentCachesBySourceType,\n  writeSoridrawPersistentCache,\n} from '../lib/soridrawPersistentCache';\nimport { invalidateExploreFeedSessionCache } from './exploreSessionCache';",
    'publication-imports',
)
pub_path = ROOT / 'src/services/explorePublicationService.ts'
pub_text = pub_path.read_text(encoding='utf-8')
start = pub_text.find('// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988')
end = pub_text.find('const readResponsePayload = async', start)
if start < 0 or end < 0:
    raise SystemExit('publication-cache-block: anchors not found')
pub_block = r'''// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
const PUBLICATION_CACHE_SCHEMA_VERSION = 1;
const PUBLICATION_CACHE_KEY = 'explore-publication-states';
const PUBLICATION_CACHE_SOURCE_TYPE = 'explore_publication_states';
const publicationMemoryCache = new Map<string, Record<string, ExploreMusicNotePublicationState>>();
const publicationInflight = new Map<string, Promise<Record<string, ExploreMusicNotePublicationState>>>();

const clonePublicationStates = (
  states: Record<string, ExploreMusicNotePublicationState>,
): Record<string, ExploreMusicNotePublicationState> => Object.fromEntries(
  Object.entries(states).map(([sourceId, state]) => [sourceId, { ...state }]),
);

const readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const memory = publicationMemoryCache.get(normalizedUid);
  if (memory) return clonePublicationStates(memory);

  const envelope = readSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    uid: normalizedUid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return null;

  const normalized: Record<string, ExploreMusicNotePublicationState> = {};
  Object.entries(envelope.data).forEach(([sourceId, value]) => {
    const state = value as Partial<ExploreMusicNotePublicationState> | null;
    const trackId = String(state?.trackId || '').trim();
    if (!sourceId || !trackId) return;
    normalized[sourceId] = {
      status: state?.status === 'public' ? 'public' : 'private',
      trackId,
      allowNextSongApply: Boolean(state?.allowNextSongApply),
      allowFollowerSave: Boolean(state?.allowFollowerSave),
      profilePinned: Boolean(state?.profilePinned),
    };
  });
  publicationMemoryCache.set(normalizedUid, normalized);
  return clonePublicationStates(normalized);
};

const writePublicationStateCache = (
  uid: string,
  states: Record<string, ExploreMusicNotePublicationState>,
) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const cloned = clonePublicationStates(states);
  publicationMemoryCache.set(normalizedUid, cloned);
  writeSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: cloned,
  });
};

const patchPublicationStateBySourceId = (
  uid: string,
  sourceId: string,
  nextState: ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid) || {};
  writePublicationStateCache(uid, { ...existing, [sourceId]: { ...nextState } });
};

const patchPublicationStateByTrackId = (
  uid: string,
  trackId: string,
  patcher: (state: ExploreMusicNotePublicationState) => ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid);
  if (!existing) return;
  let changed = false;
  const next = clonePublicationStates(existing);
  Object.entries(next).forEach(([sourceId, state]) => {
    if (state.trackId !== trackId) return;
    next[sourceId] = patcher(state);
    changed = true;
  });
  if (changed) writePublicationStateCache(uid, next);
};

export const clearExplorePublicationSessionCache = (uid?: string | null) => {
  const normalizedUid = String(uid || '').trim();
  if (normalizedUid) {
    publicationMemoryCache.delete(normalizedUid);
    publicationInflight.delete(normalizedUid);
    removeSoridrawPersistentCache(PUBLICATION_CACHE_KEY, normalizedUid);
    return;
  }
  publicationMemoryCache.clear();
  publicationInflight.clear();
  removeSoridrawPersistentCachesBySourceType(PUBLICATION_CACHE_SOURCE_TYPE);
};

'''
pub_text = pub_text[:start] + pub_block + pub_text[end:]
pub_path.write_text(pub_text, encoding='utf-8')

# Explore page: persist cursor and patch the cached like count instead of forcing a feed refetch.
replace_once(
    'src/pages/ExplorePage.tsx',
    "import { readExploreFeedSessionCache, writeExploreFeedSessionCache } from '../services/exploreSessionCache';",
    "import {\n  patchExploreFeedSessionCacheRow,\n  readExploreFeedSessionCache,\n  writeExploreFeedSessionCache,\n} from '../services/exploreSessionCache';",
    'explore-page-import',
)
replace_once(
    'src/pages/ExplorePage.tsx',
    '        writeExploreFeedSessionCache(requestUrl, rows);',
    '        writeExploreFeedSessionCache(requestUrl, rows, safeText(payload?.data?.nextCursor) || null);',
    'explore-page-write-cache',
)
replace_once(
    'src/pages/ExplorePage.tsx',
    '      updateTrackLikeCount(track.id, result.likeCount);',
    "      updateTrackLikeCount(track.id, result.likeCount);\n      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });",
    'explore-page-like-patch',
)

print('SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990=APPLIED')
