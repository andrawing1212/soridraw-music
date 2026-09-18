import { auth } from '../firebase';
import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_LIKE_ACCOUNT_OVERLAY_068_20260912
// Re-apply the same-account like/count truth after a Feed payload replaces rows.
// The remote device already persists this shape in exploreLikeService; 068 also
// remembers the origin browser's sync event so its own later Feed revalidation
// cannot overwrite the optimistic count before the public aggregate settles.
const ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches';
const ACCOUNT_PATCH_SOURCE_TYPE = 'explore_like_account_patches';
const ACCOUNT_PATCH_SCHEMA_VERSION = 1;
const ACCOUNT_PATCH_TTL_MS = 20 * 60_000;

type AccountPatch = {
  trackId?: string;
  ownerUid?: string;
  liked?: boolean;
  likeCount?: number;
  updatedAt?: number;
  expiresAt?: number;
};

type AccountPatchCache = Record<string, AccountPatch>;

type LikeSyncDetail = {
  trackId?: string;
  ownerUid?: string;
  liked?: boolean;
  likeCount?: number;
};

const finiteCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const readActivePatchesForUid = (uid: string) => {
  if (!uid) return { patches: {} as AccountPatchCache, latestUpdatedAt: 0 };
  const envelope = readSoridrawPersistentCache<AccountPatchCache>({
    cacheKey: ACCOUNT_PATCH_CACHE_KEY,
    sourceType: ACCOUNT_PATCH_SOURCE_TYPE,
    schemaVersion: ACCOUNT_PATCH_SCHEMA_VERSION,
    uid,
  });
  const source = envelope?.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
    ? envelope.data
    : {};
  const now = Date.now();
  const patches: AccountPatchCache = {};
  let latestUpdatedAt = 0;
  for (const [trackId, patch] of Object.entries(source)) {
    if (!trackId || !patch || typeof patch !== 'object') continue;
    const expiresAt = Number(patch.expiresAt || 0);
    if (!expiresAt || expiresAt <= now || typeof patch.liked !== 'boolean') continue;
    const updatedAt = Math.max(0, Number(patch.updatedAt || 0));
    patches[trackId] = patch;
    latestUpdatedAt = Math.max(latestUpdatedAt, updatedAt);
  }
  return { patches, latestUpdatedAt };
};

const currentUid = () => String(auth.currentUser?.uid || '').trim();

export const rememberExploreAccountLikeOverlay = (detail: LikeSyncDetail) => {
  const uid = currentUid();
  const trackId = String(detail?.trackId || '').trim();
  if (!uid || !trackId || typeof detail?.liked !== 'boolean') return;
  const { patches } = readActivePatchesForUid(uid);
  const now = Date.now();
  patches[trackId] = {
    trackId,
    ownerUid: String(detail?.ownerUid || '').trim(),
    liked: detail.liked,
    likeCount: finiteCount(detail.likeCount),
    updatedAt: now,
    expiresAt: now + ACCOUNT_PATCH_TTL_MS,
  };
  writeSoridrawPersistentCache<AccountPatchCache>({
    cacheKey: ACCOUNT_PATCH_CACHE_KEY,
    sourceType: ACCOUNT_PATCH_SOURCE_TYPE,
    schemaVersion: ACCOUNT_PATCH_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: patches,
  });
};

export const hasRecentExploreAccountLikePatch = (maxAgeMs: number) => {
  const uid = currentUid();
  const { latestUpdatedAt } = readActivePatchesForUid(uid);
  return latestUpdatedAt > 0 && Date.now() - latestUpdatedAt <= Math.max(0, maxAgeMs);
};

export const overlayExploreAccountLikeCounts = (rows: Array<Record<string, unknown>>) => {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const uid = currentUid();
  const { patches } = readActivePatchesForUid(uid);
  if (!Object.keys(patches).length) return rows;
  return rows.map((row) => {
    const id = String(row?.id || '').trim();
    const patch = id ? patches[id] : null;
    if (!patch) return row;
    const likeCount = finiteCount(patch.likeCount);
    const stats = row.stats && typeof row.stats === 'object' && !Array.isArray(row.stats)
      ? { ...(row.stats as Record<string, unknown>), likeCount }
      : { likeCount };
    return { ...row, likeCount, stats };
  });
};
