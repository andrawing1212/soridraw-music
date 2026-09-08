import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_FEED_INTEGRITY_SELF_HEAL_030_20260909';
if (source.includes(marker)) {
  console.log('[030] Explore feed integrity self-heal already applied.');
  process.exit(0);
}

for (const required of [
  'handleExploreFeedRevision019',
  'buildExploreFeedR2Payload',
  'readExploreR2Json',
  'writeExploreR2Json',
  'exploreFeedR2Key',
  'invalidateExploreFeedEdgeCache',
  'getExploreFeedEdgeCacheKey',
]) {
  if (!source.includes(required)) throw new Error(`[030] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[030] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
    else if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[030] unterminated function: ${name}`);
};

const renameFunction = (name, suffix) => {
  const range = functionRange(name);
  const nextName = `${name}${suffix}`;
  const renamed = range.text.replace(
    new RegExp(`^(async\\s+)?function\\s+${name}\\(`),
    (full) => full.replace(`${name}(`, `${nextName}(`),
  );
  if (renamed === range.text) throw new Error(`[030] could not rename ${name}`);
  source = source.slice(0, range.start) + renamed + source.slice(range.end);
  return nextName;
};

const helperAnchor = functionRange('handleExploreFeedRevision019').start;
const helpers = `// ${marker}\nconst EXPLORE_FEED_INTEGRITY_SCHEMA_VERSION_030 = 1;\nconst EXPLORE_FEED_INTEGRITY_CHECK_INTERVAL_MS_030 = 5 * 60 * 1000;\nconst EXPLORE_FEED_INTEGRITY_EDGE_TTL_SECONDS_030 = 30;\nconst EXPLORE_FEED_INTEGRITY_R2_KEY_030 = "internal/explore/feed-integrity-v1/state.json";\n\nfunction exploreFeedIntegrityItemId030(item) {\n  return String(item?.id || item?.trackId || "").trim();\n}\n\nfunction exploreFeedIntegrityLikeCount030(item) {\n  return Math.max(0, Number(item?.likeCount ?? item?.stats?.likeCount ?? 0) || 0);\n}\n\nfunction exploreFeedIntegrityPublishedAt030(item) {\n  return Math.max(0, Number(item?.publishedAt ?? item?.published_at ?? 0) || 0);\n}\n\nfunction exploreFeedIntegritySignature030(bundle, sort) {\n  const items = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : [];\n  return JSON.stringify(items.map((item) => sort === "popular"\n    ? [exploreFeedIntegrityItemId030(item), exploreFeedIntegrityLikeCount030(item), exploreFeedIntegrityPublishedAt030(item)]\n    : [exploreFeedIntegrityItemId030(item), exploreFeedIntegrityPublishedAt030(item)]));\n}\n\nfunction exploreFeedIntegrityEdgeKey030(request) {\n  const base = new URL(request.url);\n  const url = new URL("/__soridraw_feed_integrity_030", base.origin);\n  const origin = request.headers.get("Origin") || "";\n  return getExploreFeedEdgeCacheKey(url, origin);\n}\n\nasync function writeExploreFeedIntegrityState030(env, payload) {\n  await writeExploreR2Json(env, EXPLORE_FEED_INTEGRITY_R2_KEY_030, {\n    schemaVersion: EXPLORE_FEED_INTEGRITY_SCHEMA_VERSION_030,\n    ...payload\n  });\n}\n\nasync function cacheExploreFeedIntegrityEdge030(request) {\n  try {\n    const headers = new Headers({\n      "Cache-Control": \`public, max-age=0, s-maxage=\${EXPLORE_FEED_INTEGRITY_EDGE_TTL_SECONDS_030}\`\n    });\n    await caches.default.put(\n      exploreFeedIntegrityEdgeKey030(request),\n      new Response("ok", { status: 200, headers }),\n    );\n  } catch {}\n}\n\nasync function ensureExploreFeedIntegrity030(request, env) {\n  try {\n    const edgeKey = exploreFeedIntegrityEdgeKey030(request);\n    const edgeHit = await caches.default.match(edgeKey);\n    if (edgeHit) return { checked: false, source: "edge" };\n\n    const now = Date.now();\n    const state = await readExploreR2Json(env, EXPLORE_FEED_INTEGRITY_R2_KEY_030).catch(() => null);\n    const verifiedAt = Number(state?.verifiedAt || 0);\n    if (Number(state?.schemaVersion || 0) === EXPLORE_FEED_INTEGRITY_SCHEMA_VERSION_030\n      && verifiedAt > 0\n      && now - verifiedAt < EXPLORE_FEED_INTEGRITY_CHECK_INTERVAL_MS_030) {\n      await cacheExploreFeedIntegrityEdge030(request);\n      return { checked: false, source: "r2-state" };\n    }\n\n    const [currentLatest, currentPopular, canonicalLatest, canonicalPopular] = await Promise.all([\n      readExploreR2Json(env, exploreFeedR2Key("latest")).catch(() => null),\n      readExploreR2Json(env, exploreFeedR2Key("popular")).catch(() => null),\n      buildExploreFeedR2Payload(env, "latest"),\n      buildExploreFeedR2Payload(env, "popular"),\n    ]);\n\n    const currentLatestSignature = exploreFeedIntegritySignature030(currentLatest, "latest");\n    const currentPopularSignature = exploreFeedIntegritySignature030(currentPopular, "popular");\n    const canonicalLatestSignature = exploreFeedIntegritySignature030(canonicalLatest, "latest");\n    const canonicalPopularSignature = exploreFeedIntegritySignature030(canonicalPopular, "popular");\n    const latestMismatch = currentLatestSignature !== canonicalLatestSignature;\n    const popularMismatch = currentPopularSignature !== canonicalPopularSignature;\n    const repaired = latestMismatch || popularMismatch;\n\n    if (repaired) {\n      await Promise.all([\n        writeExploreR2Json(env, exploreFeedR2Key("latest"), canonicalLatest),\n        writeExploreR2Json(env, exploreFeedR2Key("popular"), canonicalPopular),\n      ]);\n      await invalidateExploreFeedEdgeCache(request);\n    }\n\n    await writeExploreFeedIntegrityState030(env, {\n      verifiedAt: now,\n      repairedAt: repaired ? now : Number(state?.repairedAt || 0),\n      repaired,\n      latestSignature: canonicalLatestSignature,\n      popularSignature: canonicalPopularSignature,\n    });\n    await cacheExploreFeedIntegrityEdge030(request);\n    return { checked: true, repaired, latestMismatch, popularMismatch };\n  } catch (error) {\n    console.warn('[SORIDRAW 030] feed integrity check skipped:', String(error?.message || error || 'unknown'));\n    await cacheExploreFeedIntegrityEdge030(request);\n    return { checked: false, error: true };\n  }\n}\n\n`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

const revisionCore = renameFunction('handleExploreFeedRevision019', 'Core030');
const revisionCoreRange = functionRange(revisionCore);
const revisionWrapper = `\n\nasync function handleExploreFeedRevision019(request, url, env, cors) {\n  await ensureExploreFeedIntegrity030(request, env);\n  return await ${revisionCore}(request, url, env, cors);\n}`;
source = source.slice(0, revisionCoreRange.end) + revisionWrapper + source.slice(revisionCoreRange.end);

for (const required of [
  marker,
  'EXPLORE_FEED_INTEGRITY_CHECK_INTERVAL_MS_030 = 5 * 60 * 1000',
  'buildExploreFeedR2Payload(env, "latest")',
  'buildExploreFeedR2Payload(env, "popular")',
  'writeExploreR2Json(env, exploreFeedR2Key("latest"), canonicalLatest)',
  'writeExploreR2Json(env, exploreFeedR2Key("popular"), canonicalPopular)',
  'await ensureExploreFeedIntegrity030(request, env)',
]) {
  if (!source.includes(required)) throw new Error(`[030] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[030] Explore feed verifies canonical top-40 latest/popular at most once per 5 minutes globally via R2 state, repairing only on mismatch; ordinary revision checks stay edge/R2-only.');
