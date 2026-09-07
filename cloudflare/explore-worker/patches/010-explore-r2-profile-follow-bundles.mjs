import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_R2_PROFILE_FOLLOW_BUNDLES_010_20260904';
if (source.includes(marker)) {
  console.log('[010] Explore R2 profile/follow bundles already applied.');
  process.exit(0);
}
if (!source.includes('readExploreR2Json') || !source.includes('writeExploreR2Json')) {
  throw new Error('010 requires R2 helpers from patch 009');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`010 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`010 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`010 unterminated function: ${name}`);
};

const replaceFunctionWithWrapper = (name, wrapperText, suffix = 'R2Core') => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^(async\\s+)?function\\s+${name}\\(`), (full) => full.replace(`${name}(`, `${coreName}(`));
  if (renamed === range.text) throw new Error(`010 could not rename ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperText(coreName) + source.slice(range.end);
};

const helperAnchor = 'async function handlePublicProfileFirstViewWithEdgeCache(';
if (!source.includes(helperAnchor)) throw new Error('010 first-view edge anchor missing');

const helpers = `// ${marker}
const EXPLORE_R2_PROFILE_SCHEMA_VERSION = 1;
const EXPLORE_R2_FOLLOW_SCHEMA_VERSION = 1;
const EXPLORE_R2_FOLLOW_LIMIT = 5000;
const exploreProfileR2Key = (uid) => \`internal/explore/profile-first-view-v1/\${encodeURIComponent(String(uid || ''))}.json\`;
const exploreFollowingR2Key = (uid) => \`internal/explore/following-v1/\${encodeURIComponent(String(uid || ''))}.json\`;

function parseExploreProfileSnapshotRow(row) {
  if (!row?.uid) return null;
  try {
    const snapshot = JSON.parse(String(row.payload_json || '{}'));
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.profile || !Array.isArray(snapshot.items)) return null;
    return {
      schemaVersion: EXPLORE_R2_PROFILE_SCHEMA_VERSION,
      uid: String(row.uid || ''),
      handle: String(row.handle || ''),
      revision: Number(row.revision || 0),
      updatedAt: Number(row.updated_at || 0),
      body: {
        ok: true,
        data: {
          ...snapshot,
          nextCursor: row.next_cursor || snapshot.nextCursor || null,
          revision: Number(row.revision || 0),
          schemaVersion: Number(row.schema_version || 1),
          updatedAt: Number(row.updated_at || 0)
        }
      }
    };
  } catch {
    return null;
  }
}

async function writeExploreProfileR2FromRow(env, row) {
  const bundle = parseExploreProfileSnapshotRow(row);
  if (!bundle?.uid) return false;
  await writeExploreR2Json(env, exploreProfileR2Key(bundle.uid), bundle);
  return true;
}

async function syncExploreProfileR2FromD1(env, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized) return false;
  const row = await env.DB.prepare(\`
    SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
    FROM public_profile_first_views
    WHERE uid = ?
    LIMIT 1
  \`).bind(normalized).first();
  if (!row) {
    if (env?.PROFILE_MEDIA) await env.PROFILE_MEDIA.delete(exploreProfileR2Key(normalized));
    return false;
  }
  return await writeExploreProfileR2FromRow(env, row);
}

async function readExploreProfileR2Bundle(env, profileRef) {
  const normalized = String(profileRef || '').trim().replace(/^@+/, '');
  if (!normalized) return null;
  const bundle = await readExploreR2Json(env, exploreProfileR2Key(normalized));
  if (!bundle || Number(bundle.schemaVersion) !== EXPLORE_R2_PROFILE_SCHEMA_VERSION) return null;
  if (!bundle.body?.data?.profile || !Array.isArray(bundle.body?.data?.items)) return null;
  return bundle;
}

function withExploreZeroUsageOnEdgeHit(response, status) {
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Profile-Edge-Cache', status);
  if (status === 'HIT') {
    headers.set('X-SORIDRAW-D1-Read', '0');
    headers.set('X-SORIDRAW-D1-Write', '0');
    headers.set('X-SORIDRAW-R2-A', '0');
    headers.set('X-SORIDRAW-R2-B', '0');
  }
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean));
  for (const name of ['X-SORIDRAW-Profile-Edge-Cache', 'X-SORIDRAW-D1-Read', 'X-SORIDRAW-D1-Write', 'X-SORIDRAW-R2-A', 'X-SORIDRAW-R2-B']) expose.add(name);
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function rebuildExploreFollowingR2Bundle(env, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized) return [];
  const result = await env.DB.prepare(\`
    SELECT following_uid
    FROM follows
    WHERE follower_uid = ?
    ORDER BY created_at DESC, following_uid DESC
    LIMIT ?
  \`).bind(normalized, EXPLORE_R2_FOLLOW_LIMIT).all();
  const followingUids = [...new Set((result.results || []).map((row) => String(row.following_uid || '').trim()).filter(Boolean))];
  await writeExploreR2Json(env, exploreFollowingR2Key(normalized), {
    schemaVersion: EXPLORE_R2_FOLLOW_SCHEMA_VERSION,
    uid: normalized,
    updatedAt: Date.now(),
    followingUids
  });
  return followingUids;
}

async function readExploreFollowingR2Bundle(env, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized) return null;
  const bundle = await readExploreR2Json(env, exploreFollowingR2Key(normalized));
  if (!bundle || Number(bundle.schemaVersion) !== EXPLORE_R2_FOLLOW_SCHEMA_VERSION || !Array.isArray(bundle.followingUids)) return null;
  return [...new Set(bundle.followingUids.map((value) => String(value || '').trim()).filter(Boolean))];
}

async function syncExploreFollowingR2AfterMutation(env, uid, targetUid, following) {
  const normalized = String(uid || '').trim();
  const target = String(targetUid || '').trim();
  if (!normalized || !target) return;
  const current = await readExploreFollowingR2Bundle(env, normalized);
  if (!current) {
    await rebuildExploreFollowingR2Bundle(env, normalized);
    return;
  }
  const next = new Set(current);
  if (following) next.add(target); else next.delete(target);
  await writeExploreR2Json(env, exploreFollowingR2Key(normalized), {
    schemaVersion: EXPLORE_R2_FOLLOW_SCHEMA_VERSION,
    uid: normalized,
    updatedAt: Date.now(),
    followingUids: [...next].slice(0, EXPLORE_R2_FOLLOW_LIMIT)
  });
}

async function handleMyFollowingR2Bundle(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  const bundled = await readExploreFollowingR2Bundle(env, authContext.uid);
  if (bundled) return json({ ok: true, data: { followingUids: bundled, source: 'r2' } }, 200, cors);

  // Recovery only. Normal seeded/mutation-maintained path never touches D1.
  const result = await env.DB.prepare(\`
    SELECT following_uid
    FROM follows
    WHERE follower_uid = ?
    ORDER BY created_at DESC, following_uid DESC
    LIMIT ?
  \`).bind(authContext.uid, EXPLORE_R2_FOLLOW_LIMIT).all();
  return json({
    ok: true,
    data: {
      followingUids: [...new Set((result.results || []).map((row) => String(row.following_uid || '').trim()).filter(Boolean))],
      source: 'd1-recovery'
    }
  }, 200, cors);
}

`;
source = source.replace(helperAnchor, helpers + helperAnchor);

replaceFunctionWithWrapper('handlePublicProfileFirstViewWithEdgeCache', (coreName) => `async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
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

  const bundle = await readExploreProfileR2Bundle(env, profileRef);
  if (bundle) {
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
  }

  return await ${coreName}(request, profileRef, env, cors);
}`);

replaceFunctionWithWrapper('writePublicProfileFirstViewSnapshot', (coreName) => `async function writePublicProfileFirstViewSnapshot(env, uid, handle, snapshot, nextCursor, now) {
  const result = await ${coreName}(env, uid, handle, snapshot, nextCursor, now);
  try { await syncExploreProfileR2FromD1(env, uid); }
  catch (error) { console.warn('[SORIDRAW R2 profile] snapshot sync failed:', String(error?.message || error || 'unknown')); }
  return result;
}`);

replaceFunctionWithWrapper('patchExploreFirstViewFollowCounts', (coreName) => `async function patchExploreFirstViewFollowCounts(env, followerUid, followingUid, stats, now) {
  const result = await ${coreName}(env, followerUid, followingUid, stats, now);
  await Promise.all([
    syncExploreProfileR2FromD1(env, followerUid).catch(() => false),
    syncExploreProfileR2FromD1(env, followingUid).catch(() => false)
  ]);
  return result;
}`);

replaceFunctionWithWrapper('patchExploreFirstViewLikeCount', (coreName) => `async function patchExploreFirstViewLikeCount(env, ownerUid, trackId, likeCount, now) {
  const result = await ${coreName}(env, ownerUid, trackId, likeCount, now);
  await syncExploreProfileR2FromD1(env, ownerUid).catch(() => false);
  return result;
}`);

replaceFunctionWithWrapper('handleFollow', (coreName) => `async function handleFollow(request, env, cors, targetUid, shouldFollow) {
  const response = await ${coreName}(request, env, cors, targetUid, shouldFollow);
  if (!response.ok) return response;
  try {
    const authContext = await requireExploreAuth(request);
    await syncExploreFollowingR2AfterMutation(env, authContext.uid, targetUid, shouldFollow);
    await invalidatePublicProfileFirstViewEdgeCache(request, [authContext.uid, targetUid]);
  } catch (error) {
    console.warn('[SORIDRAW R2 follow] mutation sync failed:', String(error?.message || error || 'unknown'));
  }
  return response;
}`);

const followingRouteAnchor = '    if (url.pathname === "/v1/me/following" && request.method === "GET") {';
if (!source.includes(followingRouteAnchor)) throw new Error('010 following route anchor missing');
source = source.replace(
  followingRouteAnchor,
  `    if (url.pathname === "/v1/me/following-bundle" && request.method === "GET") {\n      return await handleMyFollowingR2Bundle(request, env, cors);\n    }\n${followingRouteAnchor}`
);

const seedPath = String(process.env.SORIDRAW_EXPLORE_PROFILE_FOLLOW_SEED_PATH || '').trim();
const seedToken = String(process.env.SORIDRAW_EXPLORE_PROFILE_FOLLOW_SEED_TOKEN || '').trim();
if (seedPath) {
  if (!seedToken) throw new Error('010 seed token required when seed path is enabled.');
  const routeAnchor = '    if (url.pathname === "/v1/publications" && request.method === "POST") {';
  if (!source.includes(routeAnchor)) throw new Error('010 seed route anchor missing');
  const seedRoute = `    if (url.pathname === ${JSON.stringify(seedPath)} && request.method === "POST") {
      if (request.headers.get('X-SORIDRAW-Seed') !== ${JSON.stringify(seedToken)}) return new Response('not found', { status: 404 });
      const profileResult = await env.DB.prepare(\`
        SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
        FROM public_profile_first_views
        ORDER BY uid
        LIMIT 5000
      \`).all();
      let profileBundles = 0;
      const profileRefs = [];
      for (const row of (profileResult.results || [])) {
        if (await writeExploreProfileR2FromRow(env, row)) {
          profileBundles += 1;
          profileRefs.push(String(row.uid || ''));
        }
      }
      const viewerResult = await env.DB.prepare(\`
        SELECT uid AS viewer_uid FROM public_profiles
        UNION
        SELECT follower_uid AS viewer_uid FROM follows
        LIMIT 5000
      \`).all();
      let followBundles = 0;
      for (const row of (viewerResult.results || [])) {
        const uid = String(row.viewer_uid || '').trim();
        if (!uid) continue;
        await rebuildExploreFollowingR2Bundle(env, uid);
        followBundles += 1;
      }
      await invalidatePublicProfileFirstViewEdgeCache(request, profileRefs);
      return json({ ok: true, data: { profileBundles, followBundles } }, 200, cors);
    }
`;
  source = source.replace(routeAnchor, seedRoute + routeAnchor);
}

for (const needle of [
  marker,
  '/v1/me/following-bundle',
  'handleMyFollowingR2Bundle',
  'readExploreProfileR2Bundle',
  'syncExploreFollowingR2AfterMutation',
  'withExploreZeroUsageOnEdgeHit'
]) {
  if (!source.includes(needle)) throw new Error(`010 verification failed: ${needle}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log(`[010] Explore R2 profile/follow bundles applied${seedPath ? ' mode=seed' : ' mode=final'}.`);
