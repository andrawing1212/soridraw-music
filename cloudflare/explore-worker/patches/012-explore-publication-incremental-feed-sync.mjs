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

function sortExploreFeedItems012(items, sort) {
  return [...items].sort((a, b) => {
    if (sort === "popular") {
      const likeDelta = getExploreFeedItemLikeCount012(b) - getExploreFeedItemLikeCount012(a);
      if (likeDelta) return likeDelta;
    }
    const publishedDelta = Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0);
    if (publishedDelta) return publishedDelta;
    return String(b?.id || b?.trackId || "").localeCompare(String(a?.id || a?.trackId || ""));
  });
}

function buildExploreFeedCursor012(sort, items, previousCursor) {
  if (!items.length) return null;
  if (!previousCursor && items.length < EXPLORE_R2_FEED_LIMIT) return null;
  const last = items[items.length - 1];
  const id = String(last?.id || last?.trackId || "");
  const publishedAt = Number(last?.publishedAt || 0);
  if (!id || !Number.isFinite(publishedAt)) return previousCursor || null;
  return encodeCursor(sort === "popular"
    ? { likeCount: getExploreFeedItemLikeCount012(last), publishedAt, id }
    : { publishedAt, id });
}

async function syncExploreFeedR2Publication012(env, incomingItem) {
  const trackId = String(incomingItem?.id || incomingItem?.trackId || "").trim();
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
      const existing = previousItems.find((item) => String(item?.id || item?.trackId || "") === trackId) || null;
      const merged = existing
        ? {
            ...existing,
            ...incomingItem,
            stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}) },
            likeCount: existing?.likeCount ?? incomingItem?.likeCount ?? incomingItem?.stats?.likeCount ?? 0
          }
        : incomingItem;
      const withoutCurrent = previousItems.filter((item) => String(item?.id || item?.trackId || "") !== trackId);
      const items = sortExploreFeedItems012([merged, ...withoutCurrent], sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      const previousCursor = bundle.payload.data.nextCursor ?? null;
      bundle.payload.data.items = items;
      bundle.payload.data.sort = sort;
      bundle.payload.data.nextCursor = buildExploreFeedCursor012(sort, items, previousCursor);
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

replaceOnceInFunction(
  'handlePublicationR2Core',
  '    SELECT is_public, status FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
  '    SELECT is_public, status, published_at, created_at FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1',
  'previous publication timestamp select',
);

replaceOnceInFunction(
  'handlePublicationR2Core',
  '  await upsertPublicProfileFromFirebase(env, authContext, now);',
  '  const publicationOwnerProfile = await upsertPublicProfileFromFirebase(env, authContext, now);',
  'capture publication owner profile',
);

const feedSyncAnchor = `  const wasPublishedForFirstView = Number(previousFirstViewTrack?.is_public || 0) === 1 && String(previousFirstViewTrack?.status || "") === "published";`;
const feedSyncBlock = `  const publicationPublishedAt = Number(previousFirstViewTrack?.published_at || 0) > 0
    ? Number(previousFirstViewTrack.published_at)
    : now;
  const publicationCreatedAt = Number(previousFirstViewTrack?.created_at || 0) > 0
    ? Number(previousFirstViewTrack.created_at)
    : now;
  const publicationFeedItem = mapTrackRow({
    id: source.id,
    owner_uid: authContext.uid,
    owner_nickname: publicationOwnerProfile?.nickname || "",
    owner_avatar_url: publicationOwnerProfile?.avatarUrl || "",
    source_type: source.sourceType,
    source_id: source.sourceId,
    source_parent_id: source.sourceParentId,
    legacy_global_id: source.legacyGlobalId,
    source_subtrack_key: source.sourceSubTrackKey,
    source_subtrack_index: source.sourceSubTrackIndex,
    source_subtrack_id: source.sourceSubTrackId,
    title: source.title,
    description: source.description,
    cover_url: source.coverUrl,
    duration_seconds: source.durationSeconds,
    lyrics: source.lyrics,
    style: source.style,
    suno_url_primary: source.sunoUrlPrimary,
    suno_url_secondary: source.sunoUrlSecondary,
    status: "published",
    published_at: publicationPublishedAt,
    created_at: publicationCreatedAt,
    updated_at: now,
    allow_next_song_apply: Number(storedOptions?.allow_next_song_apply || 0),
    allow_follower_save: Number(storedOptions?.allow_follower_save || 0),
    profile_pinned: Number(storedOptions?.profile_pinned || 0),
    like_count: 0,
    comment_count: 0,
    play_count: 0
  });
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
  // R2 first-page bundles are synchronized inside the mutation core from the
  // just-written publication payload. Do not immediately rescan the feed in D1:
  // that both costs more and can overwrite R2 with a stale post-write snapshot.
  return await handlePublicationR2Core(request, env, cors, ...args);
}`);

if (!source.includes(marker)) throw new Error('[012] marker missing after patch');
if (!source.includes('await syncExploreFeedR2Publication012(env, publicationFeedItem);')) throw new Error('[012] incremental publication sync missing');
const finalWrapper = functionRange('handlePublication').text;
if (finalWrapper.includes('safelyRefreshExploreFeedR2Bundles')) throw new Error('[012] full feed rebuild still attached to publication wrapper');

writeFileSync(workerPath, source, 'utf8');
console.log('[012] Explore publication now syncs R2 first-page feeds incrementally; D1 full-feed rescan removed from normal publish mutation.');
