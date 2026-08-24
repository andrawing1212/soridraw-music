import type { AppUserInfo } from '../types';

export const USER_PROFILE_CACHE_EVENT = 'soridraw:user-profile-cache';
const USER_PROFILE_CACHE_STORAGE_BASE = 'soridraw_user_profile_cache_v1';
const memoryCache = new Map<string, AppUserInfo>();

const storageKey = (uid: string) => `${USER_PROFILE_CACHE_STORAGE_BASE}_${uid}`;

export const readUserProfileCache = (uid?: string | null): AppUserInfo | null => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return null;

  const memory = memoryCache.get(safeUid);
  if (memory) return memory;

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(safeUid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const profile = parsed?.profile && typeof parsed.profile === 'object'
      ? ({ uid: safeUid, ...parsed.profile } as AppUserInfo)
      : null;
    if (!profile) return null;
    memoryCache.set(safeUid, profile);
    return profile;
  } catch {
    return null;
  }
};

export const writeUserProfileCache = (uid: string, value: Record<string, unknown>): AppUserInfo => {
  const safeUid = String(uid || '').trim();
  const profile = { uid: safeUid, ...(value || {}) } as AppUserInfo;
  if (!safeUid) return profile;

  memoryCache.set(safeUid, profile);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey(safeUid), JSON.stringify({ profile, cachedAt: Date.now() }));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_PROFILE_CACHE_EVENT, {
      detail: { uid: safeUid, profile },
    }));
  }
  return profile;
};

export const clearUserProfileCache = (uid?: string | null): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  memoryCache.delete(safeUid);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(storageKey(safeUid)); } catch {}
  }
};

export const isUserProfileCacheStorageKey = (key: string | null, uid: string): boolean =>
  Boolean(key && uid && key === storageKey(uid));
