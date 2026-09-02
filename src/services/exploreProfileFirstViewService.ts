import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  getExplorePublicProfile,
  getExplorePublicProfileTracks,
  type ExplorePublicProfile,
} from './exploreSocialService';

// SORIDRAW_COST_ZERO_STAGE2A_PROFILE_FIRST_VIEW
// SORIDRAW_PROFILE_REVISION_SWR_1000
// SORIDRAW_PROFILE_REVISION_PREVIEW_DEPLOY_1001
const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';
const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 1;
const PROFILE_FIRST_VIEW_SOURCE_TYPE = 'explore_profile_first_view';
const PROFILE_FIRST_VIEW_LIMIT = 50;
const PROFILE_FIRST_VIEW_VALIDATION_TTL_MS = 10 * 60 * 1000;
const PROFILE_FIRST_VIEW_STORAGE_TTL_MS = 60 * 60 * 1000;
const PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH = '/v1/profiles/:id/first-view';

type ExploreProfileFirstViewData = {
  profile: ExplorePublicProfile;
  tracks: Array<Record<string, unknown>>;
  nextCursor: string | null;
  revision: string | null;
  etag: string | null;
  validatedAt: number;
};

export type ExploreProfileFirstViewOptions = {
  onRevalidated?: (data: ExploreProfileFirstViewData) => void;
  onInvalidated?: (message: string) => void;
};

type MaterializedRequestResult =
  | { kind: 'updated'; data: ExploreProfileFirstViewData }
  | { kind: 'not-modified'; revision: string | null; etag: string | null }
  | { kind: 'not-found'; message: string }
  | { kind: 'unavailable' };

const revalidationInflight = new Map<string, Promise<MaterializedRequestResult>>();

const normalizeProfileRef = (value: string) => String(value || '').trim();
const cacheKeyForRef = (profileRef: string) => `explore-profile-first-view:${normalizeProfileRef(profileRef).toLowerCase()}`;

const normalizeCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeProfile = (row: any, fallbackRef = ''): ExplorePublicProfile => ({
  uid: String(row?.uid || fallbackRef).trim(),
  nickname: String(row?.nickname || row?.displayName || 'SORiDRAW').trim() || 'SORiDRAW',
  avatarUrl: String(row?.avatarUrl || row?.avatar_url || '').trim(),
  backgroundUrl: String(row?.backgroundUrl || row?.background_url || '').trim(),
  bio: String(row?.bio || '').trim(),
  handle: String(row?.handle || '').trim().replace(/^@+/, ''),
  genres: Array.isArray(row?.genres) ? row.genres.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 5) : [],
  socialLinks: {
    spotify: String(row?.socialLinks?.spotify || row?.spotifyUrl || row?.spotify_url || '').trim(),
    instagram: String(row?.socialLinks?.instagram || row?.instagramUrl || row?.instagram_url || '').trim(),
    tiktok: String(row?.socialLinks?.tiktok || row?.tiktokUrl || row?.tiktok_url || '').trim(),
  },
  followerCount: normalizeCount(row?.followerCount ?? row?.follower_count),
  followingCount: normalizeCount(row?.followingCount ?? row?.following_count),
  trackCount: normalizeCount(row?.trackCount ?? row?.track_count),
});

const normalizeCachedData = (value: ExploreProfileFirstViewData): ExploreProfileFirstViewData => ({
  ...value,
  revision: String(value?.revision || '').trim() || null,
  etag: String(value?.etag || '').trim() || null,
  validatedAt: Number.isFinite(Number(value?.validatedAt)) ? Math.max(0, Number(value.validatedAt)) : 0,
});

const readCache = (profileRef: string): ExploreProfileFirstViewData | null => {
  const normalizedRef = normalizeProfileRef(profileRef);
  if (!normalizedRef) return null;
  const envelope = readSoridrawPersistentCache<ExploreProfileFirstViewData>({
    cacheKey: cacheKeyForRef(normalizedRef),
    sourceType: PROFILE_FIRST_VIEW_SOURCE_TYPE,
    schemaVersion: PROFILE_FIRST_VIEW_SCHEMA_VERSION,
    uid: null,
  });
  if (!envelope?.data?.profile?.uid || !Array.isArray(envelope.data.tracks)) return null;
  return normalizeCachedData(envelope.data);
};

const writeCache = (profileRef: string, data: ExploreProfileFirstViewData) => {
  const normalizedData = normalizeCachedData(data);
  const refs = new Set<string>([
    normalizeProfileRef(profileRef),
    normalizedData.profile.uid,
    normalizedData.profile.handle ? `@${normalizedData.profile.handle}` : '',
  ].filter(Boolean));
  refs.forEach((ref) => {
    writeSoridrawPersistentCache<ExploreProfileFirstViewData>({
      cacheKey: cacheKeyForRef(ref),
      sourceType: PROFILE_FIRST_VIEW_SOURCE_TYPE,
      schemaVersion: PROFILE_FIRST_VIEW_SCHEMA_VERSION,
      dataVersion: normalizedData.revision || 0,
      uid: null,
      syncCursor: normalizedData.nextCursor,
      serverRevision: normalizedData.revision,
      deletedIds: [],
      // Storage lifetime and freshness are deliberately separate. The cached profile
      // may stay available for instant rendering for one hour, while revision
      // validation happens at most every ten minutes when the user revisits it.
      expiresAt: Date.now() + PROFILE_FIRST_VIEW_STORAGE_TTL_MS,
      dirty: false,
      pendingMutationId: null,
      data: normalizedData,
    });
  });
};

const clearCache = (profileRef: string, cached?: ExploreProfileFirstViewData | null) => {
  const refs = new Set<string>([
    normalizeProfileRef(profileRef),
    cached?.profile?.uid || '',
    cached?.profile?.handle ? `@${cached.profile.handle}` : '',
  ].filter(Boolean));
  refs.forEach((ref) => removeSoridrawPersistentCache(cacheKeyForRef(ref), null));
};

const elapsedMs = (startedAt: number) => {
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  return Math.max(0, Math.round(now - startedAt));
};

const byteLength = (value: string) => {
  try { return new TextEncoder().encode(value).byteLength; } catch { return value.length; }
};

const parseJsonText = (value: string) => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};

const requestMaterializedFirstView = async (
  profileRef: string,
  knownRevision: string | null = null,
): Promise<MaterializedRequestResult> => {
  const normalizedRef = normalizeProfileRef(profileRef);
  const url = new URL(`${EXPLORE_API_BASE}/v1/profiles/${encodeURIComponent(normalizedRef)}/first-view`);
  url.searchParams.set('limit', String(PROFILE_FIRST_VIEW_LIMIT));
  const revision = String(knownRevision || '').trim();
  if (revision) url.searchParams.set('knownRevision', revision);

  const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  const responseRevision = String(response.headers.get('X-SORIDRAW-Profile-Revision') || '').trim() || null;
  const responseEtag = String(response.headers.get('ETag') || '').trim() || null;

  if (response.status === 304) {
    recordCloudflareResponse(response, PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH, {
      conditional: Boolean(revision),
      responseBytes: 0,
      durationMs: elapsedMs(startedAt),
      outcome: 'REV 304 · 변경 없음',
    });
    return { kind: 'not-modified', revision: responseRevision || revision || null, etag: responseEtag };
  }

  const raw = await response.text().catch(() => '');
  const payload = parseJsonText(raw);
  const bytes = byteLength(raw);
  const errorCode = String(payload?.error?.code || payload?.code || '').trim();
  const errorMessage = String(payload?.message || payload?.error?.message || payload?.error || '').trim();

  recordCloudflareResponse(response, PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH, {
    conditional: Boolean(revision),
    responseBytes: bytes,
    durationMs: elapsedMs(startedAt),
    outcome: response.ok
      ? revision ? 'UPDATED 200 · 변경 감지' : 'FIRST 200 · 전체 수신'
      : `HTTP ${response.status}${errorCode ? ` · ${errorCode}` : ''}`,
  });

  if (response.status === 404 && errorCode === 'NOT_FOUND') {
    return { kind: 'not-found', message: errorMessage || '공개 프로필을 찾을 수 없습니다.' };
  }
  if (response.status === 404 || response.status === 409 || response.status === 501 || response.status === 503) {
    return { kind: 'unavailable' };
  }
  if (!response.ok) {
    throw new Error(errorMessage || '공개 프로필을 불러오지 못했습니다.');
  }

  const row = payload?.data || {};
  const profileRow = row.profile || row.snapshot?.profile;
  const items = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.tracks?.items)
      ? row.tracks.items
      : Array.isArray(row.snapshot?.items)
        ? row.snapshot.items
        : [];
  if (!profileRow) return { kind: 'unavailable' };
  const profile = normalizeProfile(profileRow, normalizedRef);
  if (!profile.uid) return { kind: 'unavailable' };
  return {
    kind: 'updated',
    data: {
      profile,
      tracks: items,
      nextCursor: String(row.nextCursor || row.tracks?.nextCursor || row.snapshot?.nextCursor || '').trim() || null,
      revision: responseRevision || String(row.revision ?? row.snapshot?.revision ?? '').trim() || null,
      etag: responseEtag,
      validatedAt: Date.now(),
    },
  };
};

const revalidateCachedFirstView = (
  profileRef: string,
  cached: ExploreProfileFirstViewData,
): Promise<MaterializedRequestResult> => {
  const key = `${normalizeProfileRef(profileRef).toLowerCase()}:${cached.revision || 'none'}`;
  const existing = revalidationInflight.get(key);
  if (existing) return existing;
  const promise = requestMaterializedFirstView(profileRef, cached.revision)
    .finally(() => {
      if (revalidationInflight.get(key) === promise) revalidationInflight.delete(key);
    });
  revalidationInflight.set(key, promise);
  return promise;
};

export const rememberExplorePublicProfileFirstViewProfile = (profile: ExplorePublicProfile) => {
  const normalizedUid = normalizeProfileRef(profile.uid);
  if (!normalizedUid) return;
  const cached = readCache(normalizedUid)
    || (profile.handle ? readCache(`@${profile.handle}`) : null);
  if (!cached) return;
  writeCache(normalizedUid, { ...cached, profile });
};

export const patchExplorePublicProfileFirstViewProfile = (
  profileRef: string,
  patch: Partial<ExplorePublicProfile>,
) => {
  const cached = readCache(profileRef);
  if (!cached) return;
  writeCache(cached.profile.uid || profileRef, {
    ...cached,
    profile: { ...cached.profile, ...patch },
  });
};

export const patchExplorePublicProfileFirstViewTrack = (
  profileRef: string,
  trackId: string,
  patch: Record<string, unknown>,
) => {
  const cached = readCache(profileRef);
  if (!cached || !trackId) return;
  let changed = false;
  const tracks = cached.tracks.map((track) => {
    const id = String(track?.id || track?.trackId || '').trim();
    if (id !== trackId) return track;
    changed = true;
    return { ...track, ...patch };
  });
  if (!changed) return;
  writeCache(cached.profile.uid || profileRef, { ...cached, tracks });
};

export const getExplorePublicProfileFirstView = async (
  profileRef: string,
  options: ExploreProfileFirstViewOptions = {},
): Promise<ExploreProfileFirstViewData> => {
  const normalizedRef = normalizeProfileRef(profileRef);
  if (!normalizedRef) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');

  const cached = readCache(normalizedRef);
  if (cached) {
    const isFresh = cached.validatedAt > 0 && Date.now() - cached.validatedAt < PROFILE_FIRST_VIEW_VALIDATION_TTL_MS;
    recordCloudflareLocalCacheHit(
      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,
      isFresh ? 'LOCAL HIT · 10분 검증 생략' : 'LOCAL STALE · 즉시 표시 후 revision 검증',
    );

    if (!isFresh) {
      void revalidateCachedFirstView(normalizedRef, cached)
        .then((result) => {
          if (result.kind === 'not-modified') {
            writeCache(normalizedRef, {
              ...cached,
              revision: result.revision || cached.revision,
              etag: result.etag || cached.etag,
              validatedAt: Date.now(),
            });
            return;
          }
          if (result.kind === 'updated') {
            writeCache(normalizedRef, result.data);
            options.onRevalidated?.(result.data);
            return;
          }
          if (result.kind === 'not-found') {
            clearCache(normalizedRef, cached);
            options.onInvalidated?.(result.message);
          }
        })
        .catch((error) => {
          console.warn('[Explore profile first-view] background revision validation failed; stale cache kept.', error);
        });
    }
    return cached;
  }

  try {
    const materialized = await requestMaterializedFirstView(normalizedRef);
    if (materialized.kind === 'updated') {
      writeCache(normalizedRef, materialized.data);
      return materialized.data;
    }
    if (materialized.kind === 'not-found') throw new Error(materialized.message);
  } catch (error) {
    if (error instanceof Error && /찾을 수 없습니다/.test(error.message)) throw error;
    console.warn('[Explore profile first-view] materialized snapshot unavailable; compatibility fallback used.', error);
  }

  // Compatibility fallback remains only for a true cold load when the materialized
  // endpoint is unavailable. Cached profiles never fan out into two legacy reads.
  const [profile, tracks] = await Promise.all([
    getExplorePublicProfile(normalizedRef),
    getExplorePublicProfileTracks(normalizedRef),
  ]);
  const fallback: ExploreProfileFirstViewData = {
    profile,
    tracks: tracks.slice(0, PROFILE_FIRST_VIEW_LIMIT),
    nextCursor: null,
    revision: null,
    etag: null,
    validatedAt: Date.now(),
  };
  writeCache(normalizedRef, fallback);
  return fallback;
};
