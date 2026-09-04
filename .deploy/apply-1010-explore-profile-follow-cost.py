from pathlib import Path

MARKER = 'SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904'

service_path = Path('src/services/exploreSocialService.ts')
service = service_path.read_text(encoding='utf-8')

if MARKER not in service:
    service = service.replace(
        "const EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION = 1;",
        "const EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION = 2;\nconst EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH = '/v1/me/following-bundle';\n// " + MARKER,
        1,
    )

    start = service.find('type ExploreFollowCacheData = Record<string, boolean>;')
    end = service.find('const toCount = (value: unknown) => {', start)
    if start < 0 or end < 0:
        raise SystemExit('follow cache helper block not found')

    helpers = r'''type ExploreFollowCacheData = {
  complete: boolean;
  states: Record<string, boolean>;
};

const exploreFollowBundleInflight = new Map<string, Promise<ExploreFollowCacheData>>();

const normalizeExploreFollowCache = (value: unknown): ExploreFollowCacheData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { complete: false, states: {} };
  const row = value as any;
  const rawStates = row?.states && typeof row.states === 'object' && !Array.isArray(row.states) ? row.states : {};
  const states = Object.entries(rawStates as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [uid, state]) => {
    const normalizedUid = String(uid || '').trim();
    if (normalizedUid) acc[normalizedUid] = Boolean(state);
    return acc;
  }, {});
  return { complete: Boolean(row?.complete), states };
};

const readExploreFollowCache = (viewerUid: string): ExploreFollowCacheData => {
  const envelope = readSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    uid: viewerUid,
  });
  return normalizeExploreFollowCache(envelope?.data);
};

const writeExploreFollowCache = (viewerUid: string, data: ExploreFollowCacheData) => {
  const normalized = normalizeExploreFollowCache(data);
  writeSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: viewerUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: normalized,
  });
};

const readCachedExploreFollowState = (viewerUid: string, targetUid: string): boolean | null => {
  const data = readExploreFollowCache(viewerUid);
  if (Object.prototype.hasOwnProperty.call(data.states, targetUid)) return Boolean(data.states[targetUid]);
  return data.complete ? false : null;
};

const rememberExploreFollowState = (viewerUid: string, targetUid: string, isFollowing: boolean) => {
  const data = readExploreFollowCache(viewerUid);
  data.states[targetUid] = Boolean(isFollowing);
  writeExploreFollowCache(viewerUid, data);
};

const loadExploreFollowingBundle = async (user: User): Promise<ExploreFollowCacheData> => {
  const cached = readExploreFollowCache(user.uid);
  if (cached.complete) return cached;

  const existing = exploreFollowBundleInflight.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    const payload = await requestAuthed(user, EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH);
    const rawUids = Array.isArray(payload?.data?.followingUids) ? payload.data.followingUids : [];
    const states = rawUids.reduce<Record<string, boolean>>((acc: Record<string, boolean>, value: unknown) => {
      const uid = String(value || '').trim();
      if (uid) acc[uid] = true;
      return acc;
    }, {});
    const next: ExploreFollowCacheData = { complete: true, states };
    writeExploreFollowCache(user.uid, next);
    return next;
  })().finally(() => {
    if (exploreFollowBundleInflight.get(user.uid) === task) exploreFollowBundleInflight.delete(user.uid);
  });

  exploreFollowBundleInflight.set(user.uid, task);
  return task;
};

'''
    service = service[:start] + helpers + service[end:]

    fn_start = service.find('export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {')
    fn_end = service.find('\nexport const setExploreFollow = async', fn_start)
    if fn_start < 0 or fn_end < 0:
        raise SystemExit('getExploreFollowState function block not found')

    replacement = r'''export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');

  const cached = readCachedExploreFollowState(user.uid, normalizedUid);
  if (cached !== null) {
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL HIT · 전체 팔로우 묶음');
    return { isFollowing: cached, followerCount: 0, followingCount: 0 };
  }

  try {
    const bundle = await loadExploreFollowingBundle(user);
    const isFollowing = Boolean(bundle.states[normalizedUid]);
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL RESOLVE · 팔로우 묶음 1회 로드');
    return { isFollowing, followerCount: 0, followingCount: 0 };
  } catch (bundleError) {
    console.warn('[Explore follow] following bundle unavailable; using per-target recovery.', bundleError);
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
};
'''
    service = service[:fn_start] + replacement + service[fn_end:]
    service_path.write_text(service, encoding='utf-8')
    print('patched exploreSocialService.ts')
else:
    print('explore social cost patch already applied')

overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
label_anchor = "  if (path === '/v1/me/likes') return '좋아요 상태';"
label_line = "  if (path === '/v1/me/following-bundle') return '팔로우 상태 묶음';"
if label_line not in overlay:
    if overlay.count(label_anchor) != 1:
        raise SystemExit(f'CACHE LIVE label anchor count mismatch: {overlay.count(label_anchor)}')
    overlay = overlay.replace(label_anchor, label_anchor + '\n' + label_line, 1)
    overlay_path.write_text(overlay, encoding='utf-8')
    print('patched CacheDiagnosticsOverlay.tsx')
else:
    print('CACHE LIVE following bundle label already applied')
