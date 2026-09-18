import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PUBLICATION_INCREMENTAL_FEED_SYNC_012_20260904';
if (source.includes(marker)) {
  console.log('[012] Explore publication incremental feed sync already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[012] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[012] function body missing: ${name}`);
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
  throw new Error(`[012] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[012] ${label} anchor count=${count}`);
  const nextText = range.text.replace(before, after);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const replaceRegexOnceInFunction = (name, pattern, replacement, label) => {
  const range = functionRange(name);
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = range.text.match(new RegExp(pattern.source, flags)) || [];
  if (matches.length !== 1) throw new Error(`[012] ${label} regex count=${matches.length}`);
  const nextText = range.text.replace(pattern, replacement);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'readExploreR2Json',
  'writeExploreR2Json',
  'exploreFeedR2Key',
  'mapTrackRow',
  'safelyRefreshExploreFeedR2Bundles',
  'handlePublicationR2Core',
  'handlePublication',
]) {
  if (!source.includes(required)) throw new Error(`[012] required runtime helper missing: ${required}`);
}

const helperAnchor = 'async function safelyRefreshExploreFeedR2Bundles(env, reason) {';
if (!source.includes(helperAnchor)) throw new Error('[012] safe refresh anchor missing');

const helpers = `// ${marker}
function getExploreFeedItemLikeCount012(item) {
  return Math.max(0, Number(item?.likeCount ?? item?.stats?.likeCount ?? 0) || 0);
}

function getExploreFeedItemId012(item) {
  return String(item?.id || item?.trackId || "").trim();
}

function sortExploreFeedItems012(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === "popular") {
      const likeDelta = getExploreFeedItemLikeCount012(b) - getExploreFeedItemLikeCount012(a);
      if (likeDelta) return likeDelta;
    }
    const publishedDelta = Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0);
    if (publishedDelta) return publishedDelta;
    return getExploreFeedItemId012(b).localeCompare(getExploreFeedItemId012(a));
  });
}

function buildExploreFeedCursor012(sort, items, previousCursor, overflowed) {
  if (!items.length) return null;
  if (!previousCursor && !overflowed) return null;
  const last = items[items.length - 1];
  const id = getExploreFeedItemId012(last);
  const publishedAt = Number(last?.publishedAt || 0);
  if (!id || !Number.isFinite(publishedAt)) return previousCursor || null;
  return encodeCursor(sort === "popular"
    ? { likeCount: getExploreFeedItemLikeCount012(last), publishedAt, id }
    : { publishedAt, id });
}

async function syncExploreFeedR2Publication012(env, incomingItem) {
  const trackId = getExploreFeedItemId012(incomingItem);
  if (!trackId) throw new Error("publication feed item is missing track id");

  try {
    const bundles = await Promise.all([
      readExploreR2Json(env, exploreFeedR2Key("latest")),
      readExploreR2Json(env, exploreFeedR2Key("popular"))
    ]);
    const valid = bundles.every((bundle) => bundle?.payload?.data && Array.isArray(bundle.payload.data.items));
    if (!valid) {
      await safelyRefreshExploreFeedR2Bundles(env, "publication incremental fallback");
      return;
    }

    await Promise.all(["latest", "popular"].map(async (sort, index) => {
      const bundle = bundles[index];
      const previousItems = bundle.payload.data.items;
      const existing = previousItems.find((item) => getExploreFeedItemId012(item) === trackId) || null;
      const merged = existing
        ? {
            ...existing,
            ...incomingItem,
            stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}) },
            likeCount: existing?.likeCount ?? incomingItem?.likeCount ?? incomingItem?.stats?.likeCount ?? 0
          }
        : incomingItem;
      const withoutCurrent = previousItems.filter((item) => getExploreFeedItemId012(item) !== trackId);
      const previousCursor = bundle.payload.data.nextCursor ?? null;
      const overflowed = !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT;
      let items = sortExploreFeedItems012([merged, ...withoutCurrent], sort).slice(0, EXPLORE_R2_FEED_LIMIT);

      if (sort === "popular" && !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT) {
        const included = items.some((item) => getExploreFeedItemId012(item) === trackId);
        if (!included) return;
      }

      bundle.payload.data.items = items;
      bundle.payload.data.sort = sort;
      bundle.payload.data.nextCursor = buildExploreFeedCursor012(sort, items, previousCursor, overflowed);
      bundle.updatedAt = Date.now();
      await writeExploreR2Json(env, exploreFeedR2Key(sort), bundle);
    }));
  } catch (error) {
    console.warn("[SORIDRAW publication feed] incremental R2 sync failed; using bounded recovery:", String(error?.message || error || "unknown"));
    await safelyRefreshExploreFeedR2Bundles(env, "publication incremental error");
  }
}

`;
source = source.replace(helperAnchor, helpers + helperAnchor);

replaceRegexOnceInFunction(
  'handlePublicationR2Core',
  /published_at\s*=\s*CASE\s*\n\s*WHEN tracks\.published_at IS NULL OR tracks\.published_at = 0 THEN excluded\.published_at\s*\n\s*ELSE tracks\.published_at\s*\n\s*END,/,
  `published_at = CASE
        WHEN COALESCE(tracks.is_public, 0) <> 1 OR COALESCE(tracks.status, '') <> 'published' THEN excluded.published_at
        WHEN tracks.published_at IS NULL OR tracks.published_at = 0 THEN excluded.published_at
        ELSE tracks.published_at
      END,`,
  'republish timestamp reset',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  `    SELECT allow_next_song_apply, allow_follower_save, profile_pinned
    FROM tracks
    WHERE id = ? AND owner_uid = ?
    LIMIT 1`,
  `    SELECT
      t.*,
      p.nickname AS owner_nickname,
      p.avatar_url AS owner_avatar_url,
      COALESCE(s.like_count, 0) AS like_count,
      COALESCE(s.comment_count, 0) AS comment_count,
      COALESCE(s.play_count, 0) AS play_count
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.id = ? AND t.owner_uid = ?
    LIMIT 1`,
  'reuse stored publication row for feed delta',
);

const feedSyncAnchor = `  const wasPublishedForFirstView = Number(previousFirstViewTrack?.is_public || 0) === 1 && String(previousFirstViewTrack?.status || "") === "published";`;
const feedSyncBlock = `  if (!storedOptions) throw new Error("published track row missing after mutation");
  const publicationFeedItem = mapTrackRow(storedOptions);
  await syncExploreFeedR2Publication012(env, publicationFeedItem);

${feedSyncAnchor}`;
replaceOnceInFunction(
  'handlePublicationR2Core',
  feedSyncAnchor,
  feedSyncBlock,
  'incremental feed sync insertion',
);

const publicationWrapper = functionRange('handlePublication').text;
if (!publicationWrapper.includes('handlePublicationR2Core')) throw new Error('[012] publication wrapper core call missing');
replaceFunction('handlePublication', `async function handlePublication(request, env, cors, ...args) {
  // The normal publication mutation updates the already-materialized R2 first
  // page directly from the single stored row. A full D1 feed rescan is kept only
  // as bounded recovery when an R2 bundle is missing or invalid.
  return await handlePublicationR2Core(request, env, cors, ...args);
}`);

if (!source.includes(marker)) throw new Error('[012] marker missing after patch');
if (!source.includes('await syncExploreFeedR2Publication012(env, publicationFeedItem);')) throw new Error('[012] incremental publication sync missing');
if (!source.includes("COALESCE(tracks.is_public, 0) <> 1 OR COALESCE(tracks.status, '') <> 'published'")) throw new Error('[012] republish timestamp rule missing');
if (!source.includes('const publicationFeedItem = mapTrackRow(storedOptions);')) throw new Error('[012] stored publication row reuse missing');
const finalWrapper = functionRange('handlePublication').text;
if (finalWrapper.includes('safelyRefreshExploreFeedR2Bundles')) throw new Error('[012] full feed rebuild still attached to publication wrapper');

writeFileSync(workerPath, source, 'utf8');
console.log('[012] Explore publication uses current republish time and incrementally syncs R2 feed bundles without normal-path full D1 feed rescans.');
