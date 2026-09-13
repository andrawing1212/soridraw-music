import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_SOCIAL_SNAPSHOT_075_20260913
const EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION = 1;
const EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY = 'explore-social-snapshot';
const EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE = 'explore_social_snapshot';
const EXPLORE_SOCIAL_SNAPSHOT_PATH = '/v1/me/social-snapshot';

export type ExploreSocialSnapshot = {
  complete: true;
  likedTrackIds: string[];
  followingUids: string[];
  updatedAt: number;
};

const inflightByUid = new Map<string, Promise<ExploreSocialSnapshot>>();

const normalizeList = (value: unknown) => [...new Set(
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean),
)];

const normalizeSnapshot = (value: unknown): ExploreSocialSnapshot | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.likedTrackIds) || !Array.isArray(row.followingUids)) return null;
  return {
    complete: true,
    likedTrackIds: normalizeList(row.likedTrackIds),
    followingUids: normalizeList(row.followingUids),
    updatedAt: Math.max(0, Number(row.updatedAt || 0)),
  };
};

export const readExploreSocialSnapshotCache = (uid: string): ExploreSocialSnapshot | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const envelope = readSoridrawPersistentCache<ExploreSocialSnapshot>({
    cacheKey: EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    uid: normalizedUid,
  });
  return normalizeSnapshot(envelope?.data);
};

const writeExploreSocialSnapshotCache = (uid: string, value: ExploreSocialSnapshot) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  writeSoridrawPersistentCache<ExploreSocialSnapshot>({
    cacheKey: EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: EXPLORE_SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: EXPLORE_SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    dataVersion: 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: value,
  });
};

export const invalidateExploreSocialSnapshot = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  inflightByUid.delete(normalizedUid);
  removeSoridrawPersistentCache(EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY, normalizedUid);
};

export const rememberExploreSocialLike = (uid: string, trackId: string, liked: boolean) => {
  const current = readExploreSocialSnapshotCache(uid);
  const normalizedTrackId = String(trackId || '').trim();
  if (!current || !normalizedTrackId) return;
  const next = new Set(current.likedTrackIds);
  if (liked) next.add(normalizedTrackId);
  else next.delete(normalizedTrackId);
  writeExploreSocialSnapshotCache(uid, {
    ...current,
    likedTrackIds: [...next],
    updatedAt: Date.now(),
  });
};

export const rememberExploreSocialFollow = (uid: string, targetUid: string, following: boolean) => {
  const current = readExploreSocialSnapshotCache(uid);
  const normalizedTargetUid = String(targetUid || '').trim();
  if (!current || !normalizedTargetUid) return;
  const next = new Set(current.followingUids);
  if (following) next.add(normalizedTargetUid);
  else next.delete(normalizedTargetUid);
  writeExploreSocialSnapshotCache(uid, {
    ...current,
    followingUids: [...next],
    updatedAt: Date.now(),
  });
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) {
    throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

export const getExploreSocialSnapshot = async (user: User): Promise<ExploreSocialSnapshot> => {
  const cached = readExploreSocialSnapshotCache(user.uid);
  if (cached) {
    recordCloudflareLocalCacheHit(EXPLORE_SOCIAL_SNAPSHOT_PATH, 'LOCAL HIT · 개인 소셜 스냅샷');
    return cached;
  }

  const existing = inflightByUid.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    const headers = await buildAuthHeaders(user);
    const response = await fetch(`${EXPLORE_API_BASE}${EXPLORE_SOCIAL_SNAPSHOT_PATH}`, {
      method: 'GET',
      headers: { ...headers, Accept: 'application/json' },
    });
    recordCloudflareResponse(response, EXPLORE_SOCIAL_SNAPSHOT_PATH);
    let payload: any = null;
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      const message = String(payload?.message || payload?.error?.message || payload?.error || '개인 소셜 스냅샷을 불러오지 못했습니다.').trim();
      throw new Error(message || '개인 소셜 스냅샷을 불러오지 못했습니다.');
    }
    const normalized = normalizeSnapshot(payload?.data);
    if (!normalized) throw new Error('개인 소셜 스냅샷 응답을 확인하지 못했습니다.');
    writeExploreSocialSnapshotCache(user.uid, normalized);
    return normalized;
  })().finally(() => {
    if (inflightByUid.get(user.uid) === task) inflightByUid.delete(user.uid);
  });

  inflightByUid.set(user.uid, task);
  return task;
};
