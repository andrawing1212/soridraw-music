export type SoridrawCacheEnvironment = 'preview' | 'test' | 'production' | 'local' | string;

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
