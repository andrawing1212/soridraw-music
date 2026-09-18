import { auth } from '../firebase';

// SORIDRAW_EXPLORE_LIKE_ACCOUNT_OVERLAY_068_20260912
// SORIDRAW_EXPLORE_PUBLIC_COUNT_PERSONAL_CACHE_SEPARATION_117_20260918
//
// Public likeCount must never come from an account-scoped cache.
// The old 068 implementation persisted likeCount in the same cache namespace that
// exploreLikeService later owns with schema 2. Besides schema collisions, that let a
// stale per-account count overwrite a newer shared Feed/Profile count.
//
// Keep only a tiny per-tab timestamp used to avoid an unnecessary Feed revision request
// immediately after this browser has just emitted a confirmed like-sync event.
// Personal heart membership remains owned by exploreLikeService; public count remains
// owned exclusively by shared Feed/Profile payloads.

const LIKE_REVISION_GRACE_STORAGE_PREFIX = 'soridraw.explore.like-revision-grace.v1:';

type LikeSyncDetail = {
  trackId?: string;
  liked?: boolean;
};

const currentUid = () => String(auth.currentUser?.uid || '').trim();

const revisionGraceStorageKey = (uid: string) => `${LIKE_REVISION_GRACE_STORAGE_PREFIX}${uid}`;

const readRevisionGraceAt = (uid: string) => {
  if (!uid || typeof window === 'undefined') return 0;
  try {
    const value = Number(window.sessionStorage.getItem(revisionGraceStorageKey(uid)) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
};

const writeRevisionGraceAt = (uid: string, value: number) => {
  if (!uid || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(revisionGraceStorageKey(uid), String(Math.max(0, Math.floor(value))));
  } catch {
    // Session cache is only an optimization. Network revalidation remains available.
  }
};

export const rememberExploreAccountLikeOverlay = (detail: LikeSyncDetail) => {
  const uid = currentUid();
  const trackId = String(detail?.trackId || '').trim();
  if (!uid || !trackId || typeof detail?.liked !== 'boolean') return;
  writeRevisionGraceAt(uid, Date.now());
};

export const hasRecentExploreAccountLikePatch = (maxAgeMs: number) => {
  const uid = currentUid();
  const latestUpdatedAt = readRevisionGraceAt(uid);
  return latestUpdatedAt > 0 && Date.now() - latestUpdatedAt <= Math.max(0, maxAgeMs);
};
