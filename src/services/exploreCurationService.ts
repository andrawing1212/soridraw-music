import type { User } from 'firebase/auth';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

const SORIDRAW_CURATED_COLLECTION_307 = 'soridraw';
const SORIDRAW_CURATED_CACHE_KEY_307 = 'soridraw_explore_curated_soridraw_v307';
const SORIDRAW_CURATED_RECHECK_MS_307 = 60_000;
const SORIDRAW_MANAGED_CURATED_CACHE_PREFIX_309 = 'soridraw_explore_managed_curated_soridraw_v309';
const SORIDRAW_MANAGED_CURATED_RECHECK_MS_309 = 60_000;

export type ExploreCurationAccess307 = {
  canCurate: boolean;
  curatorRole: 'master' | 'admin' | null;
};
export type ExploreCuratorPermissionMap307 = Record<string, boolean>;

type CuratedCache307 = {
  schemaVersion: 1;
  revision: string;
  checkedAt: number;
  items: Array<Record<string, unknown>>;
};

type ManagedCuratedCache309 = {
  schemaVersion: 1;
  revision: string;
  checkedAt: number;
  items: Array<Record<string, unknown>>;
};

let memoryCache307: CuratedCache307 | null = null;
const managedMemoryCache309 = new Map<string, ManagedCuratedCache309>();

const readJson = async (response: Response) => {
  try { return await response.json(); } catch { return null; }
};

const errorMessage = (payload: any, fallback: string) =>
  String(payload?.error?.message || payload?.message || payload?.error || fallback).trim() || fallback;

const buildAuthHeaders307 = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

const requestAuthed307 = async (user: User, path: string, init: RequestInit = {}) => {
  const authHeaders = await buildAuthHeaders307(user);
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      Accept: 'application/json',
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  recordCloudflareResponse(response, path);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, 'Explore 관리 요청을 처리하지 못했습니다.'));
  return payload;
};

const readCuratedCache307 = (): CuratedCache307 | null => {
  if (memoryCache307) return memoryCache307;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SORIDRAW_CURATED_CACHE_KEY_307);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CuratedCache307>;
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.items)) return null;
    memoryCache307 = {
      schemaVersion: 1,
      revision: String(parsed.revision || ''),
      checkedAt: Math.max(0, Number(parsed.checkedAt || 0)),
      items: parsed.items as Array<Record<string, unknown>>,
    };
    return memoryCache307;
  } catch {
    return null;
  }
};

const writeCuratedCache307 = (
  items: Array<Record<string, unknown>>,
  revision: string,
  checkedAt = Date.now(),
) => {
  const next: CuratedCache307 = { schemaVersion: 1, revision: String(revision || ''), checkedAt, items };
  memoryCache307 = next;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(SORIDRAW_CURATED_CACHE_KEY_307, JSON.stringify(next)); } catch {}
  }
  return next;
};

export const invalidateSoridrawCuratedCache307 = () => {
  memoryCache307 = null;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(SORIDRAW_CURATED_CACHE_KEY_307); } catch {}
  }
};

const managedCacheKey309 = (uid: string) =>
  `${SORIDRAW_MANAGED_CURATED_CACHE_PREFIX_309}:${String(uid || '').trim()}`;

const readManagedCuratedCache309 = (uid: string): ManagedCuratedCache309 | null => {
  const key = managedCacheKey309(uid);
  const memory = managedMemoryCache309.get(key);
  if (memory) return memory;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ManagedCuratedCache309>;
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.items)) return null;
    const next: ManagedCuratedCache309 = {
      schemaVersion: 1,
      revision: String(parsed.revision || ''),
      checkedAt: Math.max(0, Number(parsed.checkedAt || 0)),
      items: parsed.items as Array<Record<string, unknown>>,
    };
    managedMemoryCache309.set(key, next);
    return next;
  } catch {
    return null;
  }
};

const writeManagedCuratedCache309 = (
  uid: string,
  items: Array<Record<string, unknown>>,
  revision: string,
  checkedAt = Date.now(),
) => {
  const key = managedCacheKey309(uid);
  const next: ManagedCuratedCache309 = {
    schemaVersion: 1,
    revision: String(revision || ''),
    checkedAt,
    items,
  };
  managedMemoryCache309.set(key, next);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  return next;
};

const invalidateManagedCuratedCache309 = (uid: string) => {
  const key = managedCacheKey309(uid);
  managedMemoryCache309.delete(key);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(key); } catch {}
  }
};

// SORIDRAW_CURATED_MANAGER_PUBLIC_CACHE_PARITY_311_20261003
// Manager and public SORIDRAW recommendation views are two views of the same
// curated R2 snapshot. Whenever the manager has a newer snapshot, seed the
// public cache too so closing the manager can never reveal an older feed.
const syncPublicCuratedCacheFromManaged311 = (
  items: Array<Record<string, unknown>>,
  revision: string,
  checkedAt = Date.now(),
) => {
  writeCuratedCache307(items.slice(0, 20), revision, checkedAt);
};

const fetchCuratedRevision309 = async () => {
  const revisionPath = `/v1/curated-revision?collection=${SORIDRAW_CURATED_COLLECTION_307}`;
  const response = await fetch(`${EXPLORE_API_BASE}${revisionPath}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  recordCloudflareResponse(response, revisionPath);
  const payload = await readJson(response);
  if (!response.ok || payload?.ok !== true) return '';
  return String(payload?.data?.revision || '').trim();
};

const fetchCuratedBody307 = async () => {
  const path = `/v1/curated?collection=${SORIDRAW_CURATED_COLLECTION_307}&limit=20`;
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  recordCloudflareResponse(response, path);
  const payload = await readJson(response);
  if (!response.ok || payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
    throw new Error(errorMessage(payload, 'SORIDRAW 추천곡을 불러오지 못했습니다.'));
  }
  const items = payload.data.items
    .map((item: any) => item?.track)
    .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  const revision = String(response.headers.get('X-SORIDRAW-Curated-Revision') || payload?.data?.revision || '').trim();
  writeCuratedCache307(items, revision);
  return items;
};

export const getSoridrawCuratedTracks307 = async (force = false): Promise<Array<Record<string, unknown>>> => {
  const cached = readCuratedCache307();
  if (!force && cached && Date.now() - cached.checkedAt < SORIDRAW_CURATED_RECHECK_MS_307) {
    recordCloudflareLocalCacheHit('/v1/curated?soridraw=1', 'soridraw-curated-memory-307');
    return cached.items;
  }
  if (!force && cached) {
    const revisionPath = `/v1/curated-revision?collection=${SORIDRAW_CURATED_COLLECTION_307}`;
    try {
      const response = await fetch(`${EXPLORE_API_BASE}${revisionPath}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      recordCloudflareResponse(response, revisionPath);
      const payload = await readJson(response);
      const revision = String(payload?.data?.revision || '').trim();
      if (response.ok && payload?.ok === true && revision && revision === cached.revision) {
        writeCuratedCache307(cached.items, cached.revision, Date.now());
        return cached.items;
      }
    } catch (error) {
      console.warn('[app307] SORIDRAW curated revision unavailable; keeping local cache.', error);
      return cached.items;
    }
  }
  return fetchCuratedBody307();
};

export const getExploreCurationAccess307 = async (user: User): Promise<ExploreCurationAccess307> => {
  const payload = await requestAuthed307(user, '/v1/me/explore-management-access');
  const role = String(payload?.data?.curatorRole || '').trim();
  return {
    canCurate: payload?.data?.canCurate === true,
    curatorRole: role === 'master' ? 'master' : role === 'admin' ? 'admin' : null,
  };
};

export const setSoridrawCuratedTrack307 = async (user: User, trackId: string, promoted: boolean) => {
  const id = encodeURIComponent(String(trackId || '').trim());
  if (!id) throw new Error('추천곡 대상이 없습니다.');
  const payload = await requestAuthed307(
    user,
    `/v1/curation/${SORIDRAW_CURATED_COLLECTION_307}/${id}`,
    promoted ? { method: 'PUT', body: JSON.stringify({ sortOrder: 0 }) } : { method: 'DELETE' },
  );
  invalidateSoridrawCuratedCache307();
  invalidateManagedCuratedCache309(String(user?.uid || '').trim());
  return payload?.data || null;
};

export const getManagedSoridrawCuratedTracks307 = async (
  user: User,
  force = false,
): Promise<Array<Record<string, unknown>>> => {
  const uid = String(user?.uid || '').trim();
  const cached = uid ? readManagedCuratedCache309(uid) : null;
  if (!force && cached && Date.now() - cached.checkedAt < SORIDRAW_MANAGED_CURATED_RECHECK_MS_309) {
    syncPublicCuratedCacheFromManaged311(cached.items, cached.revision, cached.checkedAt);
    recordCloudflareLocalCacheHit('/v1/manage/curated?soridraw=1', 'soridraw-managed-curated-local-309');
    return cached.items;
  }

  let currentRevision = '';
  if (!force && cached?.revision) {
    try {
      currentRevision = await fetchCuratedRevision309();
      if (currentRevision && currentRevision === cached.revision) {
        const checkedAt = Date.now();
        writeManagedCuratedCache309(uid, cached.items, cached.revision, checkedAt);
        syncPublicCuratedCacheFromManaged311(cached.items, cached.revision, checkedAt);
        recordCloudflareLocalCacheHit('/v1/manage/curated?soridraw=1', 'soridraw-managed-curated-revision-309');
        return cached.items;
      }
    } catch (error) {
      console.warn('[app309] managed curation revision unavailable; keeping local cache.', error);
      return cached.items;
    }
  }

  const payload = await requestAuthed307(
    user,
    `/v1/manage/curated?collection=${SORIDRAW_CURATED_COLLECTION_307}&limit=50`,
  );
  const items = Array.isArray(payload?.data?.items)
    ? payload.data.items
      .map((item: any) => item?.track)
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];

  if (uid) {
    if (!currentRevision) {
      currentRevision = readCuratedCache307()?.revision || '';
      if (!currentRevision) {
        try { currentRevision = await fetchCuratedRevision309(); } catch {}
      }
    }
    const checkedAt = Date.now();
    writeManagedCuratedCache309(uid, items, currentRevision, checkedAt);
    syncPublicCuratedCacheFromManaged311(items, currentRevision, checkedAt);
  }
  return items;
};

export const getExploreManagerPermissions307 = async (
  user: User,
  uids: string[],
): Promise<ExploreCuratorPermissionMap307> => {
  const unique = [...new Set(uids.map((uid) => String(uid || '').trim()).filter(Boolean))].slice(0, 100);
  if (!unique.length) return {};
  const params = new URLSearchParams({ uids: unique.join(',') });
  const payload = await requestAuthed307(user, `/v1/explore-managers?${params.toString()}`);
  const raw = payload?.data?.permissions;
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(unique.map((uid) => [uid, raw[uid] === true]));
};

export const setExploreManagerPermission307 = async (
  user: User,
  targetUid: string,
  enabled: boolean,
) => {
  const uid = encodeURIComponent(String(targetUid || '').trim());
  if (!uid) throw new Error('관리자 UID가 없습니다.');
  await requestAuthed307(
    user,
    `/v1/explore-managers/${uid}`,
    enabled ? { method: 'PUT', body: JSON.stringify({ enabled: true }) } : { method: 'DELETE' },
  );
};
