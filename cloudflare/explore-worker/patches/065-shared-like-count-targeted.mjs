import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_LIKE_COUNT_TARGETED_065_20260918';
if (source.includes(marker)) {
  console.log('[065] targeted shared like-count patch already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916',
  'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917',
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'SORIDRAW_SHARED_FEED_CATCHUP_CONVERGENCE_064_20260917',
  'processExploreLikeBatches035',
  'exploreSharedFeedR2Key059',
  'patchSharedTrackCard062',
]) {
  if (!source.includes(required)) throw new Error(`[065] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[065] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[065] function body missing: ${name}`);
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
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[065] unterminated function: ${name}`);
};

const projectionRange = functionRange('reconcileExplorePublicLikes056');
if (!projectionRange.text.includes('changedItems: [...changedByTrack.values()]')) {
  const oldProjectionReturn = `    visibleChangedTracks: changedByTrack.size,
    updatedProfiles,`;
  const nextProjectionReturn = `    visibleChangedTracks: changedByTrack.size,
    changedItems: [...changedByTrack.values()],
    updatedProfiles,`;
  if (!projectionRange.text.includes(oldProjectionReturn)) {
    throw new Error('[065] 056 public projection return shape missing');
  }
  const patchedProjection = projectionRange.text.replace(oldProjectionReturn, nextProjectionReturn);
  source = source.slice(0, projectionRange.start) + patchedProjection + source.slice(projectionRange.end);
}

const aggregateRange = functionRange('processExploreLikeBatches035');
const coreName = 'processExploreLikeBatches035Core065';
const renamedAggregate = aggregateRange.text.replace(
  /^async\s+function\s+processExploreLikeBatches035\(/,
  `async function ${coreName}(`,
);
if (renamedAggregate === aggregateRange.text) throw new Error('[065] could not wrap aggregate processor');

const helpers = `// ${marker}
function normalizeSharedLikeRows065(changedItems) {
  const byTrack = new Map();
  for (const row of changedItems || []) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId) continue;
    const likeCount = Math.max(0, Number(row?.likeCount || 0));
    byTrack.set(trackId, {
      trackId,
      ownerUid: String(row?.ownerUid || '').trim(),
      likeCount,
    });
  }
  return [...byTrack.values()];
}

function patchSharedFeedItemLike065(item, likeCount) {
  const current = Math.max(0, Number(item?.likeCount ?? item?.like_count ?? item?.stats?.likeCount ?? item?.stats?.like_count ?? 0));
  if (current === likeCount) return { item, changed: false };
  return {
    changed: true,
    item: {
      ...item,
      likeCount,
      ...(item?.stats && typeof item.stats === 'object'
        ? { stats: { ...item.stats, likeCount } }
        : {}),
    },
  };
}

async function patchSharedFeedLikeCounts065(env, changedItems) {
  const rows = normalizeSharedLikeRows065(changedItems);
  const shared = env?.PROFILE_MEDIA || null;
  if (!rows.length || !shared) return { rows: rows.length, changedFeeds: 0, changedCards: 0, skipped: !shared };
  const wanted = new Map(rows.map((row) => [row.trackId, row.likeCount]));
  let changedFeeds = 0;

  for (const sort of ['latest', 'popular']) {
    const key = exploreSharedFeedR2Key059(sort);
    let object = null;
    try { object = await shared.get(key); } catch {}
    if (!object) continue;

    let bundle = null;
    try { bundle = JSON.parse(await object.text()); } catch { bundle = null; }
    const items = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : null;
    if (!items) continue;

    let changed = false;
    const nextItems = items.map((item) => {
      const trackId = String(item?.id || item?.trackId || '').trim();
      if (!wanted.has(trackId)) return item;
      const patched = patchSharedFeedItemLike065(item, wanted.get(trackId));
      if (patched.changed) changed = true;
      return patched.item;
    });
    if (!changed) continue;

    const now = Date.now();
    const nextBundle = {
      ...bundle,
      updatedAt: now,
      payload: {
        ...bundle.payload,
        data: {
          ...bundle.payload.data,
          items: nextItems,
        },
      },
    };
    await shared.put(key, JSON.stringify(nextBundle), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: {
        ...(object.customMetadata || {}),
        soridrawSharedFeed: '123',
        targetedLikePatch: '065',
        mirroredAt: String(now),
      },
    });
    changedFeeds += 1;
  }

  let changedCards = 0;
  for (const row of rows) {
    try {
      if (await patchSharedTrackCard062(env, row.trackId, { likeCount: row.likeCount })) changedCards += 1;
    } catch (error) {
      console.warn('[SORIDRAW 065] shared track card like patch deferred:', row.trackId, String(error?.message || error || 'unknown'));
    }
  }

  return { rows: rows.length, changedFeeds, changedCards, skipped: false };
}
`;

const wrapper = `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  const totals = await ${coreName}(env, scheduledTime);
  const changedItems = Array.isArray(totals?.publicProjectionDetail?.changedItems)
    ? totals.publicProjectionDetail.changedItems
    : [];
  if (!changedItems.length) return totals;
  try {
    totals.sharedLikePatch065 = await patchSharedFeedLikeCounts065(env, changedItems);
  } catch (error) {
    console.warn('[SORIDRAW 065] targeted shared like-count patch deferred:', String(error?.message || error || 'unknown'));
    totals.sharedLikePatch065 = { rows: changedItems.length, deferred: true };
  }
  return totals;
}`;

source = source.slice(0, aggregateRange.start)
  + helpers + '\n\n'
  + renamedAggregate + '\n\n'
  + wrapper
  + source.slice(aggregateRange.end);

const finalAggregate = functionRange('processExploreLikeBatches035').text;
for (const required of [
  marker,
  coreName,
  'publicProjectionDetail?.changedItems',
  'patchSharedFeedLikeCounts065',
  'sharedLikePatch065',
]) {
  if (!source.includes(required)) throw new Error(`[065] final runtime missing: ${required}`);
}
if (!finalAggregate.includes(coreName) || !finalAggregate.includes('patchSharedFeedLikeCounts065')) {
  throw new Error('[065] aggregate targeted patch boundary missing');
}
if (helpers.includes('env.DB.') || helpers.includes('.prepare(')) {
  throw new Error('[065] targeted shared like patch must not read D1');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[065] Like aggregate now patches only changed track counts into shared Feed/card R2; no Feed D1 rebuild.');
