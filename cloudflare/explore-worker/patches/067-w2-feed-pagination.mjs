import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_W2_FEED_PAGINATION_067_20260919';
if (source.includes(marker)) {
  console.log('[067] W2 hybrid Feed pagination already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_PUBLICATION_W2_SHARED_R2_AUTHORITY_066_20260919',
  'handleFeedWithEdgeCache',
  'exploreW2FeedIndexPrefix066',
  'w2FeedRankKey066',
  'readSharedTrackCard062',
  'sortExploreFeedItems012',
  'getExploreFeedItemLikeCount012',
  'getExploreFeedItemId012',
  'decodeCursor',
  'encodeCursor',
  'getPageSize',
  'mapTrackRow',
]) {
  if (!source.includes(required)) throw new Error('[067] required runtime missing: ' + required);
}

const functionRange = (name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[067] function missing: ' + name);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('[067] function body missing: ' + name);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'\`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error('[067] unterminated function: ' + name);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = name + suffix;
  const renamed = range.text.replace(
    new RegExp('^async\\s+function\\s+' + name + '\\('),
    'async function ' + coreName + '(',
  );
  if (renamed === range.text) throw new Error('[067] could not wrap ' + name);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const helperAnchor = functionRange('handleFeedWithEdgeCache').start;
const helpers = `// SORIDRAW_W2_FEED_PAGINATION_067_20260919
const EXPLORE_W2_FEED_LIST_PAGE_067 = 100;
const EXPLORE_W2_FEED_SCAN_PAGES_067 = 4;

function feedRankCursor067(sort, item, w2State067 = null) {
  const id = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Number(item?.publishedAt ?? item?.published_at ?? 0));
  if (!id || !Number.isFinite(publishedAt)) return null;
  return sort === 'popular'
    ? { likeCount: getExploreFeedItemLikeCount012(item), publishedAt, id, ...(w2State067 ? { w2State067 } : {}) }
    : { publishedAt, id, ...(w2State067 ? { w2State067 } : {}) };
}

function feedMeta067(object) {
  const meta = object?.customMetadata || {};
  const trackId = String(meta.trackId || '').trim();
  const publishedAt = Number(meta.publishedAt || 0);
  const likeCount = Math.max(0, Number(meta.likeCount || 0));
  return trackId && Number.isFinite(publishedAt) && publishedAt > 0
    ? { trackId, publishedAt, likeCount }
    : null;
}

function feedMetaAfterBoundary067(sort, meta, boundary) {
  if (!meta) return false;
  if (!boundary || !String(boundary.id || '').trim()) return true;
  const id = String(boundary.id || '').trim();
  const publishedAt = Number(boundary.publishedAt || 0);
  if (sort === 'popular') {
    const likeCount = Number(boundary.likeCount || 0);
    if (meta.likeCount !== likeCount) return meta.likeCount < likeCount;
  }
  if (meta.publishedAt !== publishedAt) return meta.publishedAt < publishedAt;
  return meta.trackId < id;
}

function normalizeW2State067(value, sort) {
  const raw = value && typeof value === 'object' ? value : null;
  if (!raw || raw.sort !== sort) return null;
  if (raw.end === true) return { sort, cursor: null, offset: 0, end: true };
  return {
    sort,
    cursor: typeof raw.cursor === 'string' && raw.cursor ? raw.cursor : null,
    offset: Math.max(0, Math.floor(Number(raw.offset || 0))),
    end: false,
  };
}

async function listW2FeedPage067(env, sort, state) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || state?.end) return { objects: [], truncated: false, cursor: null };
  const options = {
    prefix: exploreW2FeedIndexPrefix066(sort),
    limit: EXPLORE_W2_FEED_LIST_PAGE_067,
    include: ['customMetadata'],
  };
  if (state?.cursor) options.cursor = state.cursor;
  return await bucket.list(options);
}

function stateAfterW2Object067(sort, pageState, page, index) {
  const nextIndex = index + 1;
  const objects = page?.objects || [];
  if (nextIndex < objects.length) {
    return { sort, cursor: pageState?.cursor || null, offset: nextIndex, end: false };
  }
  if (page?.truncated && page?.cursor) {
    return { sort, cursor: String(page.cursor), offset: 0, end: false };
  }
  return { sort, cursor: null, offset: 0, end: true };
}

async function initializeW2State067(env, sort, boundary) {
  let state = { sort, cursor: null, offset: 0, end: false };
  for (let pageIndex = 0; pageIndex < EXPLORE_W2_FEED_SCAN_PAGES_067 && !state.end; pageIndex += 1) {
    const pageState = { ...state };
    const page = await listW2FeedPage067(env, sort, pageState);
    const objects = page?.objects || [];
    for (let index = Math.min(pageState.offset, objects.length); index < objects.length; index += 1) {
      const object = objects[index];
      const meta = feedMeta067(object);
      if (!feedMetaAfterBoundary067(sort, meta, boundary)) continue;
      try {
        const card = meta?.trackId ? await readSharedTrackCard062(env, meta.trackId) : null;
        if (card && w2FeedRankKey066(sort, card) === String(object?.key || '')) {
          return { sort, cursor: pageState.cursor || null, offset: index, end: false };
        }
      } catch {}
    }
    state = page?.truncated && page?.cursor
      ? { sort, cursor: String(page.cursor), offset: 0, end: false }
      : { sort, cursor: null, offset: 0, end: true };
  }
  return state;
}

async function readW2FeedCandidates067(env, sort, initialState, wanted) {
  let state = initialState || { sort, cursor: null, offset: 0, end: false };
  const entries = [];
  const positions = [];
  let scannedPages = 0;
  while (!state.end && entries.length < wanted && scannedPages < EXPLORE_W2_FEED_SCAN_PAGES_067) {
    const pageState = { ...state };
    const page = await listW2FeedPage067(env, sort, pageState);
    scannedPages += 1;
    const objects = page?.objects || [];
    let index = Math.min(pageState.offset, objects.length);
    if (!objects.length) {
      state = page?.truncated && page?.cursor
        ? { sort, cursor: String(page.cursor), offset: 0, end: false }
        : { sort, cursor: null, offset: 0, end: true };
      continue;
    }
    for (; index < objects.length && entries.length < wanted; index += 1) {
      const object = objects[index];
      const meta = feedMeta067(object);
      const stateBefore = { sort, cursor: pageState.cursor || null, offset: index, end: false };
      const stateAfter = stateAfterW2Object067(sort, pageState, page, index);
      positions.push({ meta, stateBefore, stateAfter });
      if (meta?.trackId) {
        try {
          const item = await readSharedTrackCard062(env, meta.trackId);
          if (item && w2FeedRankKey066(sort, item) === String(object?.key || '')) {
            entries.push({ item, meta, stateBefore, stateAfter });
          }
        } catch {}
      }
      state = stateAfter;
    }
    if (index >= objects.length && !state.end && state.cursor === pageState.cursor) {
      state = page?.truncated && page?.cursor
        ? { sort, cursor: String(page.cursor), offset: 0, end: false }
        : { sort, cursor: null, offset: 0, end: true };
    }
  }
  return {
    entries,
    positions,
    stateAfterScan: state,
    hasMore: !state.end || entries.length >= wanted,
  };
}

function nextW2StateForBoundary067(sort, startState, positions, stateAfterScan, lastItem) {
  if (!lastItem) return startState;
  const boundary = feedRankCursor067(sort, lastItem);
  let nextState = startState;
  for (const position of positions) {
    if (feedMetaAfterBoundary067(sort, position.meta, boundary)) return position.stateBefore;
    nextState = position.stateAfter;
  }
  return positions.length ? nextState : stateAfterScan;
}

async function readLegacyFeedCandidates067(env, sort, boundary, wanted) {
  const index = sort === 'popular' ? 'idx_explore_rank_popular' : 'idx_explore_rank_latest';
  const order = sort === 'popular'
    ? 'd.likes DESC,d.published_at DESC,d.id DESC'
    : 'd.published_at DESC,d.id DESC';
  const bindings = [];
  let cursorSql = '';
  if (boundary && String(boundary.id || '').trim()) {
    const id = String(boundary.id || '').trim();
    const publishedAt = Number(boundary.publishedAt || 0);
    if (sort === 'popular') {
      const likeCount = Number(boundary.likeCount || 0);
      if (Number.isFinite(likeCount) && Number.isFinite(publishedAt) && id) {
        cursorSql = 'AND (d.likes < ? OR (d.likes = ? AND d.published_at < ?) OR (d.likes = ? AND d.published_at = ? AND d.id < ?))';
        bindings.push(likeCount, likeCount, publishedAt, likeCount, publishedAt, id);
      }
    } else if (Number.isFinite(publishedAt) && id) {
      cursorSql = 'AND (d.published_at < ? OR (d.published_at = ? AND d.id < ?))';
      bindings.push(publishedAt, publishedAt, id);
    }
  }
  const sql = 'SELECT d.row_json,p.row_json AS profile_json,p.active AS profile_active ' +
    'FROM explore_derived_tracks AS d INDEXED BY ' + index + ' ' +
    'JOIN tracks AS c ON c.id=d.id ' +
    'LEFT JOIN explore_derived_profiles AS p ON p.uid=d.owner_uid ' +
    "WHERE d.active=1 AND c.is_public=1 AND c.status='published' " +
    "AND (c.source_type <> 'music_note' OR c.publication_storage_version <> 1) " +
    cursorSql + ' ORDER BY ' + order + ' LIMIT ?';
  const result = await env.DB.prepare(sql).bind(...bindings, wanted).all();
  const items = [];
  for (const row of result.results || []) {
    try {
      const track = JSON.parse(String(row.row_json || '{}'));
      const profile = Number(row.profile_active || 0) === 1
        ? JSON.parse(String(row.profile_json || '{}'))
        : {};
      items.push(mapTrackRow({
        ...track,
        owner_nickname: profile.nickname || '',
        owner_avatar_url: profile.avatar_url || '',
      }));
    } catch {}
  }
  return { items, hasMore: items.length >= wanted };
}

async function handleW2FeedCursor067(request, url, env, cors) {
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const limit = getPageSize(url);
  const boundary = decodeCursor(url.searchParams.get('cursor'));
  if (!boundary || limit !== 40) return null;

  const persistedState = normalizeW2State067(boundary.w2State067, sort);
  const startState = persistedState || await initializeW2State067(env, sort, boundary);
  const wanted = limit + 1;
  const [legacy, w2] = await Promise.all([
    readLegacyFeedCandidates067(env, sort, boundary, wanted),
    readW2FeedCandidates067(env, sort, startState, wanted),
  ]);

  const byId = new Map();
  for (const item of legacy.items) {
    const id = getExploreFeedItemId012(item);
    if (id) byId.set(id, item);
  }
  for (const entry of w2.entries) {
    const id = getExploreFeedItemId012(entry.item);
    if (id) byId.set(id, entry.item);
  }
  const merged = sortExploreFeedItems012([...byId.values()], sort);
  const visible = merged.slice(0, limit);
  const last = visible.at(-1) || null;
  const hasMore = merged.length > limit || legacy.hasMore || w2.hasMore;
  const nextState = nextW2StateForBoundary067(sort, startState, w2.positions, w2.stateAfterScan, last);
  const nextCursor = hasMore && last ? encodeCursor(feedRankCursor067(sort, last, nextState)) : null;
  const response = json({ ok: true, data: { items: visible, nextCursor, sort } }, 200, cors);
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Feed-Path', 'HYBRID-W2-R2-D1-067');
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((value) => value.trim()).filter(Boolean));
  expose.add('X-SORIDRAW-Feed-Path');
  headers.set('Access-Control-Expose-Headers', [...expose].join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('handleFeedWithEdgeCache', 'Core067', (coreName) =>
  'async function handleFeedWithEdgeCache(request, url, env, cors) {\n' +
  "  const cursor = String(url.searchParams.get('cursor') || '').trim();\n" +
  '  const limit = getPageSize(url);\n' +
  '  if (!cursor || limit !== 40) return await ' + coreName + '(request, url, env, cors);\n' +
  '  try {\n' +
  '    const hybrid = await handleW2FeedCursor067(request, url, env, cors);\n' +
  '    if (hybrid) return hybrid;\n' +
  '  } catch (error) {\n' +
  "    console.warn('[SORIDRAW 067] hybrid Feed cursor fallback:', String(error?.message || error || 'unknown'));\n" +
  '  }\n' +
  '  return await ' + coreName + '(request, url, env, cors);\n' +
  '}'
);

const legacy = functionRange('readLegacyFeedCandidates067').text;
for (const required of [
  'explore_derived_tracks AS d INDEXED BY',
  'JOIN tracks AS c ON c.id=d.id',
  "c.publication_storage_version <> 1",
]) {
  if (!legacy.includes(required)) throw new Error('[067] legacy bounded cursor contract missing: ' + required);
}
if (/FROM\s+tracks\s+(?:AS\s+)?t\b/i.test(legacy)) throw new Error('[067] legacy cursor may not full-scan canonical tracks');
const w2Reader = functionRange('readW2FeedCandidates067').text;
if (/env\.DB|\.prepare\(/.test(w2Reader)) throw new Error('[067] W2 cursor reader must remain R2-only');
for (const required of [
  marker,
  'handleFeedWithEdgeCacheCore067',
  'handleW2FeedCursor067',
  'w2State067',
  'HYBRID-W2-R2-D1-067',
]) {
  if (!source.includes(required)) throw new Error('[067] final runtime missing: ' + required);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[067] Feed cursor pages merge indexed legacy D1 rows with version-1 Music Note shared-R2 rank objects; no full tracks scan is used on the hybrid path.');
