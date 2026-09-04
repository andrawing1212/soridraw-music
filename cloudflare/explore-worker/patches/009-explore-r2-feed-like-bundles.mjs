import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_R2_FEED_LIKE_BUNDLES_009_20260904';
if (source.includes(marker)) {
  console.log('[009] Explore R2 feed/like bundles already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`009 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`009 function body missing: ${name}`);
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
  throw new Error(`009 unterminated function: ${name}`);
};

const replaceFunctionWithWrapper = (name, wrapperText, coreSuffix = 'D1Core') => {
  const range = functionRange(name);
  const coreName = `${name}${coreSuffix}`;
  const renamed = range.text.replace(new RegExp(`^(async\\s+)?function\\s+${name}\\(`), (full) => full.replace(`${name}(`, `${coreName}(`));
  if (renamed === range.text) throw new Error(`009 could not rename ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperText(coreName) + source.slice(range.end);
};

const helperAnchor = 'async function handleFeedWithEdgeCache(';
if (!source.includes(helperAnchor)) throw new Error('009 feed edge-cache anchor missing');

const helpers = `// ${marker}
const EXPLORE_R2_FEED_SCHEMA_VERSION = 1;
const EXPLORE_R2_LIKE_SCHEMA_VERSION = 1;
const EXPLORE_R2_FEED_LIMIT = 40;
const exploreFeedR2Key = (sort) => \`internal/explore/feed-v1/\${sort === "popular" ? "popular" : "latest"}-40.json\`;
const exploreLikeR2Key = (uid) => \`internal/explore/likes-v1/\${encodeURIComponent(String(uid || ""))}.json\`;

async function readExploreR2Json(env, key) {
  if (!env?.PROFILE_MEDIA) return null;
  const object = await env.PROFILE_MEDIA.get(key);
  if (!object) return null;
  try {
    const text = await object.text();
    return JSON.parse(text);
  } catch (error) {
    console.warn('[SORIDRAW R2 bundle] invalid JSON:', key, String(error?.message || error || 'unknown'));
    return null;
  }
}

async function writeExploreR2Json(env, key, payload) {
  if (!env?.PROFILE_MEDIA) throw new Error('PROFILE_MEDIA R2 binding is unavailable.');
  await env.PROFILE_MEDIA.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawBundle: '1', updatedAt: String(Date.now()) }
  });
}

async function deleteExploreFeedR2Bundles(env) {
  if (!env?.PROFILE_MEDIA) return;
  await Promise.all([
    env.PROFILE_MEDIA.delete(exploreFeedR2Key('latest')),
    env.PROFILE_MEDIA.delete(exploreFeedR2Key('popular'))
  ]);
}

async function buildExploreFeedR2Payload(env, sort) {
  const url = new URL(\`https://soridraw-r2.local/v1/feed?sort=\${sort === 'popular' ? 'popular' : 'latest'}&limit=\${EXPLORE_R2_FEED_LIMIT}\`);
  const response = await handleFeed(url, env, {});
  if (!response.ok) throw new Error(\`feed bundle build failed: \${response.status}\`);
  const payload = await response.json();
  if (!payload?.data || !Array.isArray(payload.data.items)) throw new Error('feed bundle payload invalid');
  return {
    schemaVersion: EXPLORE_R2_FEED_SCHEMA_VERSION,
    sort: sort === 'popular' ? 'popular' : 'latest',
    updatedAt: Date.now(),
    payload
  };
}

async function refreshExploreFeedR2Bundles(env) {
  const [latest, popular] = await Promise.all([
    buildExploreFeedR2Payload(env, 'latest'),
    buildExploreFeedR2Payload(env, 'popular')
  ]);
  await Promise.all([
    writeExploreR2Json(env, exploreFeedR2Key('latest'), latest),
    writeExploreR2Json(env, exploreFeedR2Key('popular'), popular)
  ]);
  return { latest: latest.payload?.data?.items?.length || 0, popular: popular.payload?.data?.items?.length || 0 };
}

async function readExploreFeedR2Bundle(env, sort) {
  const bundle = await readExploreR2Json(env, exploreFeedR2Key(sort));
  if (!bundle || Number(bundle.schemaVersion) !== EXPLORE_R2_FEED_SCHEMA_VERSION) return null;
  if (!bundle.payload?.data || !Array.isArray(bundle.payload.data.items)) return null;
  return bundle.payload;
}

async function rebuildExploreLikeR2Bundle(env, uid) {
  const result = await env.DB.prepare(\`
    SELECT l.track_id
    FROM likes l
    JOIN tracks t ON t.id = l.track_id
    WHERE l.user_uid = ?
      AND t.is_public = 1
      AND t.status = 'published'
    ORDER BY l.created_at DESC
    LIMIT 2000
  \`).bind(uid).all();
  const likedTrackIds = (result.results || []).map((row) => String(row.track_id || '')).filter(Boolean);
  await writeExploreR2Json(env, exploreLikeR2Key(uid), {
    schemaVersion: EXPLORE_R2_LIKE_SCHEMA_VERSION,
    uid: String(uid || ''),
    updatedAt: Date.now(),
    likedTrackIds
  });
  return likedTrackIds;
}

async function readExploreLikeR2Bundle(env, uid) {
  const bundle = await readExploreR2Json(env, exploreLikeR2Key(uid));
  if (!bundle || Number(bundle.schemaVersion) !== EXPLORE_R2_LIKE_SCHEMA_VERSION || !Array.isArray(bundle.likedTrackIds)) return null;
  return new Set(bundle.likedTrackIds.map((value) => String(value || '')).filter(Boolean));
}

async function syncExploreLikeR2AfterMutation(env, uid, trackId, liked) {
  let likedIds = await readExploreLikeR2Bundle(env, uid);
  if (!likedIds) {
    await rebuildExploreLikeR2Bundle(env, uid);
    return;
  }
  if (liked) likedIds.add(String(trackId || ''));
  else likedIds.delete(String(trackId || ''));
  await writeExploreR2Json(env, exploreLikeR2Key(uid), {
    schemaVersion: EXPLORE_R2_LIKE_SCHEMA_VERSION,
    uid: String(uid || ''),
    updatedAt: Date.now(),
    likedTrackIds: [...likedIds].filter(Boolean).slice(0, 2000)
  });
}

async function patchExploreFeedR2LikeCount(env, trackId, likeCount) {
  for (const sort of ['latest', 'popular']) {
    const bundle = await readExploreR2Json(env, exploreFeedR2Key(sort));
    if (!bundle?.payload?.data || !Array.isArray(bundle.payload.data.items)) continue;
    let changed = false;
    const items = bundle.payload.data.items.map((item) => {
      const id = String(item?.id || item?.trackId || '');
      if (id !== String(trackId || '')) return item;
      changed = true;
      return { ...item, likeCount: Math.max(0, Number(likeCount || 0)) };
    });
    if (!changed) continue;
    if (sort === 'popular') {
      items.sort((a, b) => {
        const likes = Number(b?.likeCount || 0) - Number(a?.likeCount || 0);
        if (likes) return likes;
        const published = Number(b?.publishedAt || b?.published_at || 0) - Number(a?.publishedAt || a?.published_at || 0);
        if (published) return published;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
      });
    }
    bundle.payload.data.items = items;
    bundle.updatedAt = Date.now();
    await writeExploreR2Json(env, exploreFeedR2Key(sort), bundle);
  }
}

async function safelyRefreshExploreFeedR2Bundles(env, reason) {
  try {
    await refreshExploreFeedR2Bundles(env);
  } catch (error) {
    console.warn('[SORIDRAW R2 feed] refresh failed:', reason, String(error?.message || error || 'unknown'));
    await deleteExploreFeedR2Bundles(env).catch(() => {});
  }
}

`;
source = source.replace(helperAnchor, helpers + helperAnchor);

replaceFunctionWithWrapper('handleFeedWithEdgeCache', (coreName) => `async function handleFeedWithEdgeCache(request, url, env, cors) {
  const cursor = url.searchParams.get('cursor');
  const limit = getPageSize(url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  if (!cursor && limit === EXPLORE_R2_FEED_LIMIT) {
    const cache = caches.default;
    const origin = request.headers.get('Origin') || '';
    const key = getExploreFeedEdgeCacheKey(url, origin);
    const cached = await cache.match(key);
    if (cached) return withExploreEdgeCacheHeader(cached, 'HIT');
    const payload = await readExploreFeedR2Bundle(env, sort);
    if (payload) {
      const bundled = withExploreEdgeCacheHeader(json(payload, 200, cors), 'R2');
      await cache.put(key, bundled.clone());
      return bundled;
    }
  }
  return await ${coreName}(request, url, env, cors);
}`);

replaceFunctionWithWrapper('handleMyLikeStates', (coreName) => `async function handleMyLikeStates(request, url, env, cors) {
  const authContext = await requireExploreAuth(request);
  const raw = safeString(url.searchParams.get('trackIds'));
  const trackIds = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 50);
  if (!trackIds.length) return json({ ok: true, data: { likedTrackIds: [] } }, 200, cors);
  if (trackIds.some((trackId) => trackId.length > 512)) throwApi('INVALID_TRACK_ID', '곡 ID가 올바르지 않습니다.', 400);
  const likedIds = await readExploreLikeR2Bundle(env, authContext.uid);
  if (likedIds) {
    return json({ ok: true, data: { likedTrackIds: trackIds.filter((trackId) => likedIds.has(trackId)) } }, 200, cors);
  }
  return await ${coreName}(request, url, env, cors);
}`);

replaceFunctionWithWrapper('handleLike', (coreName) => `async function handleLike(request, env, cors, trackId, shouldLike) {
  const response = await ${coreName}(request, env, cors, trackId, shouldLike);
  if (!response.ok) return response;
  try {
    const authContext = await requireExploreAuth(request);
    const payload = await response.clone().json();
    const resultTrackId = String(payload?.data?.trackId || trackId || '');
    const liked = Boolean(payload?.data?.liked);
    const likeCount = Number(payload?.data?.likeCount || 0);
    await Promise.all([
      syncExploreLikeR2AfterMutation(env, authContext.uid, resultTrackId, liked),
      patchExploreFeedR2LikeCount(env, resultTrackId, likeCount)
    ]);
  } catch (error) {
    console.warn('[SORIDRAW R2 like] mutation sync failed:', String(error?.message || error || 'unknown'));
  }
  return response;
}`);

for (const name of ['handlePublication', 'handleVisibility', 'handlePublicationOptions']) {
  replaceFunctionWithWrapper(name, (coreName) => `async function ${name}(request, env, cors, ...args) {
    const response = await ${coreName}(request, env, cors, ...args);
    if (response.ok) await safelyRefreshExploreFeedR2Bundles(env, '${name}');
    return response;
  }`, 'R2Core');
}

const seedPath = String(process.env.SORIDRAW_EXPLORE_COST_SEED_PATH || '').trim();
const seedToken = String(process.env.SORIDRAW_EXPLORE_COST_SEED_TOKEN || '').trim();
if (seedPath) {
  if (!seedToken) throw new Error('009 seed token required when seed path is enabled.');
  const routeAnchor = '    if (url.pathname === "/v1/publications" && request.method === "POST") {';
  if (!source.includes(routeAnchor)) throw new Error('009 seed route anchor missing');
  const seedRoute = `    if (url.pathname === ${JSON.stringify(seedPath)} && request.method === "POST") {
      if (request.headers.get('X-SORIDRAW-Seed') !== ${JSON.stringify(seedToken)}) return new Response('not found', { status: 404 });
      const feed = await refreshExploreFeedR2Bundles(env);
      const usersResult = await env.DB.prepare('SELECT DISTINCT user_uid FROM likes WHERE user_uid IS NOT NULL AND user_uid != ? LIMIT 1000').bind('').all();
      let likeBundles = 0;
      for (const row of (usersResult.results || [])) {
        const uid = String(row.user_uid || '').trim();
        if (!uid) continue;
        await rebuildExploreLikeR2Bundle(env, uid);
        likeBundles += 1;
      }
      return json({ ok: true, data: { feed, likeBundles } }, 200, cors);
    }
`;
  source = source.replace(routeAnchor, seedRoute + routeAnchor);
}

writeFileSync(workerPath, source, 'utf8');
console.log(`[009] Explore R2 feed/like bundles applied${seedPath ? ' mode=seed' : ' mode=final'}.`);
