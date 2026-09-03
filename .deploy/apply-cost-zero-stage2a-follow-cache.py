from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'src/services/exploreSocialService.ts'
source = TARGET.read_text(encoding='utf-8')

import_anchor = "import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';\n"
cache_import = "import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';\n"
if cache_import not in source:
    if import_anchor not in source:
        raise SystemExit('follow cache import anchor missing')
    source = source.replace(import_anchor, import_anchor + cache_import, 1)

base_anchor = "const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';\n"
constants = """const EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION = 1;\nconst EXPLORE_FOLLOW_CACHE_KEY = 'explore-follow-state';\nconst EXPLORE_FOLLOW_CACHE_SOURCE_TYPE = 'explore_follow_state';\nconst EXPLORE_FOLLOW_CACHE_TTL_MS = 5 * 60 * 1000; // temporary until shared social revision signal\n"""
if constants not in source:
    if base_anchor not in source:
        raise SystemExit('follow cache base anchor missing')
    source = source.replace(base_anchor, base_anchor + constants, 1)

follow_type_anchor = """export type ExploreFollowState = {\n  isFollowing: boolean;\n  followerCount: number;\n  followingCount: number;\n};\n"""
helpers = r'''
type ExploreFollowCacheData = Record<string, boolean>;

const readExploreFollowCache = (viewerUid: string): ExploreFollowCacheData => {
  const envelope = readSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    uid: viewerUid,
  });
  return envelope?.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
    ? envelope.data
    : {};
};

const writeExploreFollowCache = (viewerUid: string, data: ExploreFollowCacheData) => {
  writeSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: viewerUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: Date.now() + EXPLORE_FOLLOW_CACHE_TTL_MS,
    dirty: false,
    pendingMutationId: null,
    data,
  });
};

const readCachedExploreFollowState = (viewerUid: string, targetUid: string): boolean | null => {
  const data = readExploreFollowCache(viewerUid);
  return Object.prototype.hasOwnProperty.call(data, targetUid) ? Boolean(data[targetUid]) : null;
};

const rememberExploreFollowState = (viewerUid: string, targetUid: string, isFollowing: boolean) => {
  const data = readExploreFollowCache(viewerUid);
  data[targetUid] = Boolean(isFollowing);
  writeExploreFollowCache(viewerUid, data);
};
'''
if helpers.strip() not in source:
    if follow_type_anchor not in source:
        raise SystemExit('follow cache type anchor missing')
    source = source.replace(follow_type_anchor, follow_type_anchor + helpers, 1)

old_get = r'''export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestAuthed(user, `/v1/profiles/${encodeURIComponent(normalizedUid)}/follow-state`);
  const row = payload?.data || {};
  return {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
};'''
new_get = r'''export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const cached = readCachedExploreFollowState(user.uid, normalizedUid);
  if (cached !== null) {
    return { isFollowing: cached, followerCount: 0, followingCount: 0 };
  }
  const payload = await requestAuthed(user, `/v1/profiles/${encodeURIComponent(normalizedUid)}/follow-state`);
  const row = payload?.data || {};
  const result = {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);
  return result;
};'''
if old_get in source:
    source = source.replace(old_get, new_get, 1)
elif new_get not in source:
    raise SystemExit('follow state getter anchor missing')

old_set_tail = r'''  return {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed ?? follow),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
};'''
new_set_tail = r'''  const result = {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed ?? follow),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);
  return result;
};'''
# Only replace the setExploreFollow occurrence after its declaration.
set_index = source.find('export const setExploreFollow = async')
if set_index < 0:
    raise SystemExit('setExploreFollow declaration missing')
prefix, tail = source[:set_index], source[set_index:]
if old_set_tail in tail:
    tail = tail.replace(old_set_tail, new_set_tail, 1)
elif new_set_tail not in tail:
    raise SystemExit('follow setter result anchor missing')
source = prefix + tail

TARGET.write_text(source, encoding='utf-8')
print('COST_ZERO_STAGE2A_FOLLOW_CACHE=APPLIED')
