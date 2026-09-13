import type { User } from 'firebase/auth';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_PERSONAL_SOCIAL_SNAPSHOT_075_20260913
const SOCIAL_SNAPSHOT_SCHEMA_VERSION = 1;
const SOCIAL_SNAPSHOT_CACHE_KEY = 'explore-social-snapshot-075';
const SOCIAL_SNAPSHOT_SOURCE_TYPE = 'explore_social_snapshot';
const SOCIAL_SNAPSHOT_PATH = '/v1/me/social-snapshot';

export type ExplorePersonalSocialSnapshot = {
  likedTrackIds: string[];
  followingUids: string[];
  updatedAt: number;
};

const inflightByUid = new Map<string, Promise<ExplorePersonalSocialSnapshot>>();

const normalizeIds = (value: unknown) => [
  ...new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  ),
];

const normalizeSnapshot = (value: unknown): ExplorePersonalSocialSnapshot => {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    likedTrackIds: normalizeIds(row.likedTrackIds),
    followingUids: normalizeIds(row.followingUids),
    updatedAt: Math.max(0, Number(row.updatedAt || 0)),
  };
};

const readSnapshot = (uid: string): ExplorePersonalSocialSnapshot | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const envelope = readSoridrawPersistentCache<ExplorePersonalSocialSnapshot>({
    cacheKey: SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    uid: normalizedUid,
  });
  if (!envelope?.data) return null;
  return normalizeSnapshot(envelope.data);
};

const writeSnapshot = (uid: string, value: ExplorePersonalSocialSnapshot) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const data = normalizeSnapshot(value);
  writeSoridrawPersistentCache<ExplorePersonalSocialSnapshot>({
    cacheKey: SOCIAL_SNAPSHOT_CACHE_KEY,
    sourceType: SOCIAL_SNAPSHOT_SOURCE_TYPE,
    schemaVersion: SOCIAL_SNAPSHOT_SCHEMA_VERSION,
    dataVersion: data.updatedAt || 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data,
  });
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
    Accept: 'application/json',
  };
};

export const getExplorePersonalSocialSnapshot = async (
  user: User,
): Promise<ExplorePersonalSocialSnapshot> => {
  const cached = readSnapshot(user.uid);
  if (cached) {
    recordCloudflareLocalCacheHit(SOCIAL_SNAPSHOT_PATH, 'LOCAL HIT · 개인 Social Snapshot');
    return cached;
  }

  const existing = inflightByUid.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    const headers = await buildAuthHeaders(user);
    const response = await fetch(`${EXPLORE_API_BASE}${SOCIAL_SNAPSHOT_PATH}`, {
      method: 'GET',
      headers,
    });
    recordCloudflareResponse(response, SOCIAL_SNAPSHOT_PATH);
    let payload: any = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const message = String(payload?.message || payload?.error?.message || payload?.error || '개인 Social Snapshot을 불러오지 못했습니다.').trim();
      throw new Error(message || '개인 Social Snapshot을 불러오지 못했습니다.');
    }
    const data = normalizeSnapshot(payload?.data || {});
    writeSnapshot(user.uid, { ...data, updatedAt: data.updatedAt || Date.now() });
    return data;
  })().finally(() => {
    if (inflightByUid.get(user.uid) === task) inflightByUid.delete(user.uid);
  });

  inflightByUid.set(user.uid, task);
  return task;
};

export const patchExplorePersonalSocialLike = (uid: string, trackId: string, liked: boolean) => {
  const normalizedUid = String(uid || '').trim();
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedUid || !normalizedTrackId) return;
  const current = readSnapshot(normalizedUid);
  if (!current) return;
  const next = new Set(current.likedTrackIds);
  if (liked) next.add(normalizedTrackId); else next.delete(normalizedTrackId);
  writeSnapshot(normalizedUid, {
    ...current,
    likedTrackIds: [...next],
    updatedAt: Date.now(),
  });
};

export const patchExplorePersonalSocialFollow = (uid: string, targetUid: string, following: boolean) => {
  const normalizedUid = String(uid || '').trim();
  const normalizedTarget = String(targetUid || '').trim();
  if (!normalizedUid || !normalizedTarget) return;
  const current = readSnapshot(normalizedUid);
  if (!current) return;
  const next = new Set(current.followingUids);
  if (following) next.add(normalizedTarget); else next.delete(normalizedTarget);
  writeSnapshot(normalizedUid, {
    ...current,
    followingUids: [...next],
    updatedAt: Date.now(),
  });
};

export const clearExplorePersonalSocialSnapshot = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  inflightByUid.delete(normalizedUid);
  removeSoridrawPersistentCache(SOCIAL_SNAPSHOT_CACHE_KEY, normalizedUid);
};
