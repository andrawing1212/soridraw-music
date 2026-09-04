import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PROFILE_R2_ALIAS_BOUNDED_REPAIR_020_20260905';
if (source.includes(marker) || source.includes('rebuildExploreProfileR2Bounded020')) {
  console.log('[020] bounded profile R2 parity repair already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[020] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[020] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[020] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'patchExploreProfileR2Mutation019',
  'readExploreProfileR2Bundle',
  'writeExploreR2Json',
  'readExploreR2Json',
  'exploreProfileR2Key',
  'resolvePublicProfileRef',
  'readPublicProfileFirstViewBaseProfile',
  'readPublicProfileFirstViewTrackWindow',
  'withPublicProfileRevisionHeaders',
  'makePublicProfileFirstViewNotModified',
  'handlePublicProfileFirstViewWithEdgeCache',
]) {
  if (!source.includes(required)) throw new Error(`[020] required runtime behavior missing: ${required}`);
}

const helperAnchor = functionRange('handlePublicProfileFirstViewWithEdgeCache').start;
const helpers = `// ${marker}
const PROFILE_R2_REPAIR_VERSION_020 = 2;
const PROFILE_R2_EDGE_SCHEMA_020 = 2;
const exploreProfileHandleAliasR2Key020 = (handle) => \`internal/explore/profile-handle-alias-v1/\${encodeURIComponent(String(handle || '').trim().replace(/^@+/, '').toLowerCase())}.json\`;

function validExploreProfileR2Bundle020(bundle) {
  return Boolean(bundle && Number(bundle.schemaVersion) === EXPLORE_R2_PROFILE_SCHEMA_VERSION && bundle.body?.data?.profile && Array.isArray(bundle.body?.data?.items));
}

async function writeExploreProfileAlias020(env, handle, uid) {
  const normalizedHandle = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  const normalizedUid = String(uid || '').trim();
  if (!normalizedHandle || !normalizedUid) return false;
  await writeExploreR2Json(env, exploreProfileHandleAliasR2Key020(normalizedHandle), {
    schemaVersion: 1,
    uid: normalizedUid,
    handle: normalizedHandle,
    updatedAt: Date.now()
  });
  return true;
}

async function readExploreProfileCanonicalR2Bundle020(env, profileRef) {
  const normalized = String(profileRef || '').trim().replace(/^@+/, '');
  if (!normalized) return null;

  // Handle aliases always win. This prevents an old handle-key bundle from becoming
  // a second source of truth beside the canonical UID bundle.
  const alias = await readExploreR2Json(env, exploreProfileHandleAliasR2Key020(normalized));
  if (alias?.uid) {
    const canonical = await readExploreR2Json(env, exploreProfileR2Key(String(alias.uid || '').trim()));
    if (validExploreProfileR2Bundle020(canonical)) return canonical;
  }

  const direct = await readExploreR2Json(env, exploreProfileR2Key(normalized));
  if (validExploreProfileR2Bundle020(direct)) return direct;
  return null;
}

function profileR2NeedsRepair020(bundle) {
  return !validExploreProfileR2Bundle020(bundle)
    || Number(bundle?.repairVersion || bundle?.body?.data?.repairVersion || 0) < PROFILE_R2_REPAIR_VERSION_020;
}

async function rebuildExploreProfileR2Bounded020(env, profileRef, knownBundle = null) {
  const ref = String(profileRef || '').trim().replace(/^@+/, '');
  if (!ref) return null;

  let uid = String(knownBundle?.uid || knownBundle?.body?.data?.profile?.uid || '').trim();
  if (!uid) {
    const resolved = await resolvePublicProfileRef(env, ref);
    uid = String(resolved?.uid || '').trim();
  }
  if (!uid) return null;

  // HARD COST RULE: this repair reads one profile row and at most the first 51
  // public tracks. It never COUNT(*)s an owner's tracks and never scans a user's
  // private Music Note / Library collection, regardless of total song count.
  const [profile, window] = await Promise.all([
    readPublicProfileFirstViewBaseProfile(env, uid),
    readPublicProfileFirstViewTrackWindow(env, uid)
  ]);
  if (!profile) return null;

  const items = Array.isArray(window?.items) ? window.items.slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT) : [];
  const nextCursor = window?.nextCursor || null;
  const oldCount = Math.max(0, Number(knownBundle?.body?.data?.profile?.trackCount ?? knownBundle?.body?.data?.profile?.track_count ?? 0));
  // Exact when the bounded window is complete. For accounts with >50 public tracks,
  // preserve the maintained delta count rather than issuing an unbounded COUNT scan.
  const trackCount = nextCursor ? Math.max(oldCount, items.length + 1) : items.length;
  const revision = Math.max(1, Number(knownBundle?.revision || knownBundle?.body?.data?.revision || 0) + 1);
  const data = {
    profile: { ...profile, trackCount },
    items,
    nextCursor,
    revision,
    schemaVersion: Number(knownBundle?.body?.data?.schemaVersion || 1),
    repairVersion: PROFILE_R2_REPAIR_VERSION_020,
    updatedAt: Date.now()
  };
  const bundle = {
    schemaVersion: EXPLORE_R2_PROFILE_SCHEMA_VERSION,
    uid,
    handle: String(profile.handle || '').trim().replace(/^@+/, ''),
    revision,
    repairVersion: PROFILE_R2_REPAIR_VERSION_020,
    updatedAt: Date.now(),
    body: { ok: true, data }
  };
  await writeExploreR2Json(env, exploreProfileR2Key(uid), bundle);
  await writeExploreProfileAlias020(env, profile.handle, uid);
  return bundle;
}

async function patchExploreProfileR2Counters020(env, uid, patch) {
  try {
    const bundle = await readExploreProfileCanonicalR2Bundle020(env, uid);
    if (!validExploreProfileR2Bundle020(bundle)) return false;
    const revision = Math.max(1, Number(bundle.revision || bundle.body.data.revision || 0) + 1);
    const data = {
      ...bundle.body.data,
      profile: { ...bundle.body.data.profile, ...patch },
      revision,
      updatedAt: Date.now()
    };
    const next = { ...bundle, revision, updatedAt: Date.now(), body: { ...bundle.body, data } };
    await writeExploreR2Json(env, exploreProfileR2Key(String(uid || '').trim()), next);
    await writeExploreProfileAlias020(env, data.profile?.handle, uid);
    return true;
  } catch (error) {
    console.warn('[SORIDRAW 020] profile counter R2 patch skipped:', String(error?.message || error || 'unknown'));
    return false;
  }
}

async function patchExploreProfileR2Like020(env, ownerUid, trackId, likeCount) {
  try {
    const bundle = await readExploreProfileCanonicalR2Bundle020(env, ownerUid);
    if (!validExploreProfileR2Bundle020(bundle)) return false;
    let changed = false;
    const items = bundle.body.data.items.map((item) => {
      if (String(item?.id || item?.trackId || '') !== String(trackId || '')) return item;
      changed = true;
      return { ...item, likeCount: Number(likeCount || 0) };
    });
    if (!changed) return true;
    const revision = Math.max(1, Number(bundle.revision || bundle.body.data.revision || 0) + 1);
    const data = { ...bundle.body.data, items, revision, updatedAt: Date.now() };
    const next = { ...bundle, revision, updatedAt: Date.now(), body: { ...bundle.body, data } };
    await writeExploreR2Json(env, exploreProfileR2Key(String(ownerUid || '').trim()), next);
    await writeExploreProfileAlias020(env, data.profile?.handle, ownerUid);
    return true;
  } catch (error) {
    console.warn('[SORIDRAW 020] profile like R2 patch skipped:', String(error?.message || error || 'unknown'));
    return false;
  }
}
`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

replaceFunction('getPublicProfileFirstViewEdgeCacheKey', `function getPublicProfileFirstViewEdgeCacheKey(requestUrl, profileRef, requestOrigin) {
  const base = new URL(requestUrl).origin;
  const normalized = String(profileRef || '').trim();
  const url = new URL(\`/v1/profiles/\${encodeURIComponent(normalized)}/first-view\`, base);
  url.searchParams.set('limit', String(PUBLIC_PROFILE_FIRST_VIEW_LIMIT));
  url.searchParams.set('__soridraw_profile_schema', String(PROFILE_R2_EDGE_SCHEMA_020));
  url.searchParams.set('__soridraw_edge_origin', requestOrigin || 'none');
  return new Request(url.toString(), { method: 'GET' });
}`);

replaceFunction('syncExploreProfileR2FromD1', `async function syncExploreProfileR2FromD1(env, uid) {
  // D1 first-view snapshots are legacy derived data and may lag canonical tracks.
  // Never copy them back into R2. Rebuild only the bounded first page instead.
  const normalized = String(uid || '').trim();
  if (!normalized) return false;
  const current = await readExploreProfileCanonicalR2Bundle020(env, normalized);
  return Boolean(await rebuildExploreProfileR2Bounded020(env, normalized, current));
}`);

replaceFunction('patchExploreProfileR2Mutation019', `async function patchExploreProfileR2Mutation019(env, uid, change) {
  try {
    const normalizedUid = String(uid || '').trim();
    const trackId = String(change?.trackId || '').trim();
    if (!normalizedUid || !trackId) return { ok: false, skipped: true };
    const bundle = await readExploreProfileCanonicalR2Bundle020(env, normalizedUid);
    if (!validExploreProfileR2Bundle020(bundle)) {
      console.warn('[SORIDRAW 020] profile R2 bundle missing; publication does not scan owner tracks.');
      return { ok: false, repairNeeded: true };
    }

    const previousData = bundle.body.data;
    let items = previousData.items.filter((item) => getProfileTrackId019(item) !== trackId);
    if (!change?.remove) {
      const previous = previousData.items.find((item) => getProfileTrackId019(item) === trackId) || {};
      const nextItem = change?.item
        ? { ...previous, ...change.item }
        : { ...previous, ...(change?.patch || {}) };
      items.push(nextItem);
    }
    items = sortProfileTracks019(items).slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);

    const previousCount = Number(previousData.profile?.trackCount ?? previousData.profile?.track_count ?? 0);
    const nextCount = Math.max(0, previousCount + Number(change?.trackCountDelta || 0));
    const nextRevision = Math.max(1, Number(bundle.revision || previousData.revision || 0) + 1);
    const nextData = {
      ...previousData,
      profile: { ...previousData.profile, trackCount: nextCount },
      items,
      revision: nextRevision,
      updatedAt: Date.now()
    };
    const nextBundle = {
      ...bundle,
      revision: nextRevision,
      updatedAt: Date.now(),
      body: { ...bundle.body, data: nextData }
    };
    await writeExploreR2Json(env, exploreProfileR2Key(normalizedUid), nextBundle);
    await writeExploreProfileAlias020(env, nextData.profile?.handle, normalizedUid);
    return { ok: true, repairNeeded: false, revision: nextRevision };
  } catch (error) {
    console.warn('[SORIDRAW 020] profile R2 delta skipped:', String(error?.message || error || 'unknown'));
    return { ok: false, repairNeeded: true };
  }
}`);

replaceFunction('patchExploreFirstViewFollowCounts', `async function patchExploreFirstViewFollowCounts(env, followerUid, followingUid, stats, now) {
  // R2 is the profile first-view cache of record. Do not mutate/re-copy the stale
  // D1 snapshot on social actions.
  await Promise.all([
    stats?.follower ? patchExploreProfileR2Counters020(env, followerUid, {
      followingCount: clampExploreSocialCount(stats.follower.following_count)
    }) : Promise.resolve(false),
    stats?.following ? patchExploreProfileR2Counters020(env, followingUid, {
      followerCount: clampExploreSocialCount(stats.following.follower_count)
    }) : Promise.resolve(false)
  ]);
}`);

replaceFunction('patchExploreFirstViewLikeCount', `async function patchExploreFirstViewLikeCount(env, ownerUid, trackId, likeCount, now) {
  await patchExploreProfileR2Like020(env, ownerUid, trackId, likeCount);
}`);

replaceFunction('handlePublicProfileFirstViewWithEdgeCache', `async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
  const requestUrl = new URL(request.url);
  const knownRevision = String(requestUrl.searchParams.get('knownRevision') || '').trim();
  const cache = caches.default;
  const requestOrigin = request.headers.get('Origin') || '';
  const key = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, requestOrigin);
  const cached = await cache.match(key);
  if (cached) {
    const cachedRevision = await readPublicProfileFirstViewRevisionFromResponse(cached);
    if (knownRevision && cachedRevision && knownRevision === cachedRevision) {
      return withExploreZeroUsageOnEdgeHit(
        makePublicProfileFirstViewNotModified(cached, cachedRevision, 'HIT', 'NOT_MODIFIED_EDGE', cors),
        'HIT'
      );
    }
    return withExploreZeroUsageOnEdgeHit(
      withPublicProfileRevisionHeaders(withPublicProfileFirstViewEdgeHeader(cached, 'HIT'), cachedRevision, knownRevision ? 'UPDATED_EDGE' : 'FULL_EDGE'),
      'HIT'
    );
  }

  let bundle = await readExploreProfileCanonicalR2Bundle020(env, profileRef);
  if (profileR2NeedsRepair020(bundle)) {
    bundle = await rebuildExploreProfileR2Bounded020(env, profileRef, bundle);
  }
  if (!validExploreProfileR2Bundle020(bundle)) {
    return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);
  }

  const revision = String(bundle.revision || '').trim();
  if (knownRevision && revision && knownRevision === revision) {
    return makePublicProfileFirstViewNotModified(null, revision, 'R2', 'NOT_MODIFIED_R2', cors);
  }
  const response = withPublicProfileRevisionHeaders(
    withPublicProfileFirstViewEdgeHeader(json(bundle.body, 200, cors), 'R2'),
    revision,
    knownRevision ? 'UPDATED_R2' : 'FULL_R2'
  );
  await cache.put(key, response.clone());
  return response;
}`);

const handler = functionRange('handlePublicProfileFirstViewWithEdgeCache').text;
if (handler.includes('handlePublicProfileFirstViewWithEdgeCacheR2Core') || handler.includes('handlePublicProfileFirstViewSnapshot') || handler.includes('materializePublicProfileFirstView')) {
  throw new Error('[020] first-view handler still reaches legacy snapshot/materializer fallback');
}
const sync = functionRange('syncExploreProfileR2FromD1').text;
if (sync.includes('public_profile_first_views') || sync.includes('materializePublicProfileFirstView')) throw new Error('[020] R2 sync still copies legacy D1 snapshot');
const repair = functionRange('rebuildExploreProfileR2Bounded020').text;
if (repair.includes('COUNT(') || repair.includes('collection(db') || repair.includes('favorites')) throw new Error('[020] bounded repair contains forbidden scan');

writeFileSync(workerPath, source, 'utf8');
console.log('[020] Public profile first-view now uses UID-canonical R2 + handle alias; stale/missing bundles repair from a bounded first page only.');
