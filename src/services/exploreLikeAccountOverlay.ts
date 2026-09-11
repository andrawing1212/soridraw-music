import { auth } from '../firebase';
import { readSoridrawPersistentCache } from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_LIKE_ACCOUNT_OVERLAY_068_20260912
// The same-account sync signal is already persisted by exploreLikeService.
// This helper only re-applies that local truth after a Feed payload replaces rows.
const ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches';
const ACCOUNT_PATCH_SOURCE_TYPE = 'explore_like_account_patches';
const ACCOUNT_PATCH_SCHEMA_VERSION = 1;

type AccountPatch = {
  trackId?: string;
  liked?: boolean;
  likeCount?: number;
  updatedAt?: number;
  expiresAt?: number;
};

type AccountPatchCache = Record<string, AccountPatch>;

const finiteCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const readActivePatches = () => {
  const uid = String(auth.currentUser?.uid || '').trim();
  if (!uid) return { uid: '', patches: {} as AccountPatchCache, latestUpdatedAt: 0 };
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
  return { uid, patches, latestUpdatedAt };
};

export const hasRecentExploreAccountLikePatch = (maxAgeMs: number) => {
  const { latestUpdatedAt } = readActivePatches();
  return latestUpdatedAt > 0 && Date.now() - latestUpdatedAt <= Math.max(0, maxAgeMs);
};

export const overlayExploreAccountLikeCounts = (rows: Array<Record<string, unknown>>) => {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const { patches } = readActivePatches();
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
