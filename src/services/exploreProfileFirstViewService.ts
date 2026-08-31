import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  getExplorePublicProfile,
  getExplorePublicProfileTracks,
  type ExplorePublicProfile,
} from './exploreSocialService';

// SORIDRAW_COST_ZERO_STAGE2A_PROFILE_FIRST_VIEW
const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';
const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 1;
const PROFILE_FIRST_VIEW_SOURCE_TYPE = 'explore_profile_first_view';
const PROFILE_FIRST_VIEW_LIMIT = 50;

type ExploreProfileFirstViewData = {
  profile: ExplorePublicProfile;
  tracks: Array<Record<string, unknown>>;
  nextCursor: string | null;
  revision: string | null;
};

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
  return envelope.data;
};

const writeCache = (profileRef: string, data: ExploreProfileFirstViewData) => {
  const refs = new Set<string>([
    normalizeProfileRef(profileRef),
    data.profile.uid,
    data.profile.handle ? `@${data.profile.handle}` : '',
  ].filter(Boolean));
  refs.forEach((ref) => {
    writeSoridrawPersistentCache<ExploreProfileFirstViewData>({
      cacheKey: cacheKeyForRef(ref),
      sourceType: PROFILE_FIRST_VIEW_SOURCE_TYPE,
      schemaVersion: PROFILE_FIRST_VIEW_SCHEMA_VERSION,
      dataVersion: data.revision || 0,
      uid: null,
      syncCursor: data.nextCursor,
      serverRevision: data.revision,
      deletedIds: [],
      expiresAt: null,
      dirty: false,
      pendingMutationId: null,
      data,
    });
  });
};

const requestMaterializedFirstView = async (profileRef: string): Promise<ExploreProfileFirstViewData | null> => {
  const normalizedRef = normalizeProfileRef(profileRef);
  const url = `${EXPLORE_API_BASE}/v1/profiles/${encodeURIComponent(normalizedRef)}/first-view?limit=${PROFILE_FIRST_VIEW_LIMIT}`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  recordCloudflareResponse(response, `/v1/profiles/${normalizedRef}/first-view`);
  if (response.status === 404 || response.status === 409 || response.status === 501 || response.status === 503) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '공개 프로필을 불러오지 못했습니다.').trim();
    throw new Error(message || '공개 프로필을 불러오지 못했습니다.');
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
  if (!profileRow) return null;
  const profile = normalizeProfile(profileRow, normalizedRef);
  if (!profile.uid) return null;
  return {
    profile,
    tracks: items,
    nextCursor: String(row.nextCursor || row.tracks?.nextCursor || row.snapshot?.nextCursor || '').trim() || null,
    revision: String(row.revision ?? row.snapshot?.revision ?? '').trim() || null,
  };
};

export const getExplorePublicProfileFirstView = async (profileRef: string): Promise<ExploreProfileFirstViewData> => {
  const normalizedRef = normalizeProfileRef(profileRef);
  if (!normalizedRef) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');

  const cached = readCache(normalizedRef);
  if (cached) return cached;

  try {
    const materialized = await requestMaterializedFirstView(normalizedRef);
    if (materialized) {
      writeCache(normalizedRef, materialized);
      return materialized;
    }
  } catch (error) {
    console.warn('[Explore profile first-view] materialized snapshot unavailable; compatibility fallback used.', error);
  }

  // Compatibility fallback stays active until the D1 snapshot table is safely
  // migrated/backfilled and the Worker endpoint is deployed. This preserves the
  // current UI while still making the second visit persistent-cache only.
  const [profile, tracks] = await Promise.all([
    getExplorePublicProfile(normalizedRef),
    getExplorePublicProfileTracks(normalizedRef),
  ]);
  const fallback: ExploreProfileFirstViewData = {
    profile,
    tracks: tracks.slice(0, PROFILE_FIRST_VIEW_LIMIT),
    nextCursor: null,
    revision: null,
  };
  writeCache(normalizedRef, fallback);
  return fallback;
};
