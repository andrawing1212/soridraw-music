from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SERVICE = ROOT / 'src/services/exploreProfileFirstViewService.ts'
EXPLORE = ROOT / 'src/pages/ExplorePage.tsx'
MIGRATION = ROOT / 'cloudflare/explore/migrations/009_cost_zero_profile_first_view.sql'
PATCH = ROOT / 'cloudflare/explore-worker/patches/003-cost-zero-profile-first-view.mjs'

service_source = r'''import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';
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
'''

migration_source = r'''-- SORIDRAW Cost-Zero Stage 2A: compact public profile first-view read model.
-- SOURCE ONLY. Do not apply until bounded backfill + rollback are separately approved.
CREATE TABLE IF NOT EXISTS public_profile_first_views (
  uid TEXT PRIMARY KEY,
  handle TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  next_cursor TEXT,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_profile_first_views_handle
  ON public_profile_first_views(handle COLLATE NOCASE)
  WHERE handle <> '';

CREATE INDEX IF NOT EXISTS idx_public_profile_first_views_updated
  ON public_profile_first_views(updated_at DESC);
'''

patch_source = r'''import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_003';
if (source.includes(marker) || source.includes('handlePublicProfileFirstViewSnapshot')) {
  console.log('[SORIDRAW Worker] Cost-Zero profile first-view endpoint already present.');
  process.exit(0);
}

const handlerAnchor = 'async function handlePublicProfile(profileRef, env, cors) {';
if (!source.includes(handlerAnchor)) throw new Error('003 public profile handler anchor missing');

const helpers = `// SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_003
async function handlePublicProfileFirstViewSnapshot(profileRef, env, cors) {
  const ref = String(profileRef || "").trim().replace(/^@+/, "");
  if (!ref) return apiError("NOT_FOUND", "공개 프로필을 찾을 수 없습니다.", 404, cors);
  let row = null;
  try {
    row = await env.DB.prepare(\`
      SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
      FROM public_profile_first_views
      WHERE uid = ? OR handle = ? COLLATE NOCASE
      ORDER BY CASE WHEN uid = ? THEN 0 ELSE 1 END
      LIMIT 1
    \`).bind(ref, ref, ref).first();
  } catch (error) {
    const message = String(error?.message || error || "");
    if (message.includes("no such table") || message.includes("public_profile_first_views")) {
      return apiError("FIRST_VIEW_SNAPSHOT_UNAVAILABLE", "공개 프로필 스냅샷을 준비 중입니다.", 404, cors);
    }
    throw error;
  }
  if (!row) return apiError("FIRST_VIEW_SNAPSHOT_MISS", "공개 프로필 스냅샷을 준비 중입니다.", 404, cors);
  let snapshot = null;
  try {
    snapshot = JSON.parse(String(row.payload_json || "{}"));
  } catch {
    return apiError("FIRST_VIEW_SNAPSHOT_INVALID", "공개 프로필 스냅샷을 다시 준비해야 합니다.", 409, cors);
  }
  if (!snapshot || typeof snapshot !== "object" || !snapshot.profile) {
    return apiError("FIRST_VIEW_SNAPSHOT_INVALID", "공개 프로필 스냅샷을 다시 준비해야 합니다.", 409, cors);
  }
  return json({
    ok: true,
    data: {
      ...snapshot,
      nextCursor: row.next_cursor || snapshot.nextCursor || null,
      revision: Number(row.revision || 0),
      schemaVersion: Number(row.schema_version || 1),
      updatedAt: Number(row.updated_at || 0)
    }
  }, 200, cors);
}

`;
source = source.replace(handlerAnchor, helpers + handlerAnchor);

const routeAnchor = 'if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "tracks") {';
if (!source.includes(routeAnchor)) throw new Error('003 profile tracks route anchor missing');
const firstViewRoute = `if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "first-view") {
      return await handlePublicProfileFirstViewSnapshot(decodeURIComponent(segments[2]), env, cors);
    }
    `;
source = source.replace(routeAnchor, firstViewRoute + routeAnchor);

if (!source.includes('handlePublicProfileFirstViewSnapshot(decodeURIComponent(segments[2]), env, cors)')) {
  throw new Error('003 route verification failed');
}
writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero profile first-view snapshot endpoint prepared (no D1 migration/backfill performed).');
'''

SERVICE.write_text(service_source, encoding='utf-8')
MIGRATION.write_text(migration_source, encoding='utf-8')
PATCH.write_text(patch_source, encoding='utf-8')

source = EXPLORE.read_text(encoding='utf-8')
import_anchor = "import { getExploreLikedTrackIds, setExploreTrackLike } from '../services/exploreLikeService';\n"
import_line = "import { getExplorePublicProfileFirstView } from '../services/exploreProfileFirstViewService';\n"
if import_line not in source:
    if import_anchor not in source:
        raise SystemExit('Explore first-view import anchor missing')
    source = source.replace(import_anchor, import_anchor + import_line, 1)

old_block = '''    Promise.all([\n      getExplorePublicProfile(profileUid),\n      getExplorePublicProfileTracks(profileUid),\n    ])\n      .then(async ([nextProfile, rows]) => {'''
new_block = '''    getExplorePublicProfileFirstView(profileUid)\n      .then(async ({ profile: nextProfile, tracks: rows }) => {'''
if old_block in source:
    source = source.replace(old_block, new_block, 1)
elif new_block not in source:
    raise SystemExit('Explore profile load block anchor missing')

old_open = "setSearchParams({ profile: track.ownerHandle ? `@${track.ownerHandle}` : track.ownerUid });"
new_open = "setSearchParams({ profile: track.ownerUid });"
if old_open in source:
    source = source.replace(old_open, new_open, 1)
elif new_open not in source:
    raise SystemExit('Explore open profile anchor missing')

EXPLORE.write_text(source, encoding='utf-8')
print('COST_ZERO_STAGE2A_PROFILE_FIRST_VIEW_PATCH=APPLIED')
