import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916';
if (source.includes(marker)) {
  console.log('[056] Explore public like parity already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_INTAKE_W1_HOTPATH_055_20260915',
  'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_WRITE_COMPACTION_042_20260913',
  'processExploreLikeBatches035',
  'derivedHead032',
  'derivedRank032',
  'derivedItems032',
  'derivedCursor032',
  'mutateExploreR2Cache052',
  'exploreFeedR2Key',
  'exploreProfileR2Key',
  'validExploreProfileR2Bundle020',
  'getExploreFeedItemId012',
  'getExploreFeedItemLikeCount012',
  'getProfileTrackId019',
]) {
  if (!source.includes(required)) throw new Error(`[056] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[056] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[056] function body missing: ${name}`);
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
  throw new Error(`[056] unterminated function: ${name}`);
};

const aggregateRange = functionRange('processExploreLikeBatches035');
const coreName = 'processExploreLikeBatches035Core056';
const renamedAggregate = aggregateRange.text.replace(
  /^async\s+function\s+processExploreLikeBatches035\(/,
  `async function ${coreName}(`,
);
if (renamedAggregate === aggregateRange.text) {
  throw new Error('[056] could not wrap aggregate processor');
}

const helpers = `// ${marker}
const EXPLORE_PUBLIC_FEED_LIMIT_056 = 40;

function publicLikeCount056(item) {
  return Math.max(0, Number(getExploreFeedItemLikeCount012(item) || 0));
}

async function reconcileExploreSharedFeed056(env, sort) {
  const normalizedSort = sort === 'popular' ? 'popular' : 'latest';
  const head = await derivedHead032(env, 'feed');
  const rankedIds = await derivedRank032(env, normalizedSort, null);
  const overflow = rankedIds.length > EXPLORE_PUBLIC_FEED_LIMIT_056;
  const visibleIds = rankedIds.slice(0, EXPLORE_PUBLIC_FEED_LIMIT_056);
  const rows = await derivedItems032(env, visibleIds);
  const byId = new Map(rows.map((item) => [getExploreFeedItemId012(item), item]));
  const items = visibleIds.map((id) => byId.get(id)).filter(Boolean);

  // A concurrent publication/private transition may race the two bounded reads.
  // Leave the cursor untouched in that case; the ordinary derived path repairs it
  // on the next request instead of claiming a snapshot we did not fully observe.
  if (items.length !== visibleIds.length) {
    return { sort: normalizedSort, changed: false, changedItems: [], deferred: true };
  }

  const changedItems = [];
  const key = exploreFeedR2Key(normalizedSort);
  const result = await mutateExploreR2Cache052(env, key, (bundle) => {
    const previousItems = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : [];
    const previousById = new Map(previousItems.map((item) => [getExploreFeedItemId012(item), item]));
    changedItems.length = 0;
    for (const item of items) {
      const trackId = getExploreFeedItemId012(item);
      const previous = previousById.get(trackId);
      if (!previous || publicLikeCount056(previous) !== publicLikeCount056(item)) {
        changedItems.push({
          trackId,
          ownerUid: String(item?.ownerUid || item?.owner_uid || '').trim(),
          likeCount: publicLikeCount056(item),
        });
      }
    }

    const now = Date.now();
    const previousPayload = bundle?.payload && typeof bundle.payload === 'object' ? bundle.payload : { ok: true };
    const previousData = previousPayload?.data && typeof previousPayload.data === 'object' ? previousPayload.data : {};
    return {
      ...(bundle || {}),
      schemaVersion: EXPLORE_R2_FEED_SCHEMA_VERSION,
      sort: normalizedSort,
      limit: EXPLORE_PUBLIC_FEED_LIMIT_056,
      updatedAt: now,
      derived032: { contract: EXPLORE_DERIVED_CONTRACT_032, cursor: head },
      payload: {
        ...previousPayload,
        ok: true,
        data: {
          ...previousData,
          items,
          sort: normalizedSort,
          nextCursor: derivedCursor032(items, normalizedSort, null, overflow),
        },
      },
    };
  });

  if (!result?.ok) {
    // Missing/corrupt R2 is a cold-path repair. It must not roll back canonical D1.
    await syncDerivedCache032(env, normalizedSort, null, null);
    return { sort: normalizedSort, changed: true, changedItems: [], repaired: true };
  }
  return { sort: normalizedSort, changed: Boolean(result.changed), changedItems };
}

async function patchExploreVisibleProfiles056(env, changedItems) {
  const grouped = new Map();
  for (const row of changedItems || []) {
    const ownerUid = String(row?.ownerUid || '').trim();
    const trackId = String(row?.trackId || '').trim();
    if (!ownerUid || !trackId) continue;
    if (!grouped.has(ownerUid)) grouped.set(ownerUid, new Map());
    grouped.get(ownerUid).set(trackId, Math.max(0, Number(row?.likeCount || 0)));
  }

  let updatedProfiles = 0;
  for (const [ownerUid, counts] of grouped) {
    try {
      const result = await mutateExploreR2Cache052(env, exploreProfileR2Key(ownerUid), (bundle) => {
        if (!validExploreProfileR2Bundle020(bundle)) return null;
        const data = bundle.body.data;
        let changed = false;
        const items = data.items.map((item) => {
          const trackId = getProfileTrackId019(item);
          if (!counts.has(trackId)) return item;
          const likeCount = counts.get(trackId);
          const current = Math.max(0, Number(item?.likeCount ?? item?.stats?.likeCount ?? 0));
          if (current === likeCount) return item;
          changed = true;
          return {
            ...item,
            likeCount,
            ...(item?.stats ? { stats: { ...item.stats, likeCount } } : {}),
          };
        });
        if (!changed) return null;
        const revision = Math.max(Number(bundle.revision || 0), Number(data.revision || 0)) + 1;
        const now = Date.now();
        return {
          ...bundle,
          revision,
          updatedAt: now,
          body: { ...bundle.body, data: { ...data, items, revision, updatedAt: now } },
        };
      });
      if (result?.changed) updatedProfiles += 1;
    } catch (error) {
      // Profile first-view already has its own derived repair path. One missing
      // profile cache must not block the shared Feed or canonical aggregate.
      console.warn('[SORIDRAW 056] visible profile like patch deferred:', ownerUid, String(error?.message || error || 'unknown'));
    }
  }
  return updatedProfiles;
}

async function reconcileExplorePublicLikes056(env) {
  const feedResults = [];
  for (const sort of ['latest', 'popular']) {
    feedResults.push(await reconcileExploreSharedFeed056(env, sort));
  }
  const changedByTrack = new Map();
  for (const result of feedResults) {
    for (const row of result.changedItems || []) changedByTrack.set(row.trackId, row);
  }
  const updatedProfiles = await patchExploreVisibleProfiles056(env, [...changedByTrack.values()]);
  return {
    feeds: feedResults.map((result) => ({ sort: result.sort, changed: Boolean(result.changed), deferred: Boolean(result.deferred) })),
    visibleChangedTracks: changedByTrack.size,
    changedItems: [...changedByTrack.values()],
    updatedProfiles,
  };
}
`;

const wrapper = `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  const totals = await ${coreName}(env, scheduledTime);
  if (!totals || Number(totals.changedTracks || 0) <= 0) return totals;
  try {
    const publicProjection = await reconcileExplorePublicLikes056(env);
    console.log('[SORIDRAW 056] public like projection reconciled', JSON.stringify(publicProjection));
    return { ...totals, publicProjection: 'reconciled', publicProjectionDetail: publicProjection };
  } catch (error) {
    // Canonical D1 likes/counts already succeeded. Never convert that success into
    // a failed cron because a derived R2 write had a transient problem.
    console.warn('[SORIDRAW 056] public like projection deferred:', String(error?.message || error || 'unknown'));
    return { ...totals, publicProjection: 'deferred' };
  }
}`;

source = source.slice(0, aggregateRange.start)
  + helpers + '\n\n'
  + renamedAggregate + '\n\n'
  + wrapper
  + source.slice(aggregateRange.end);

const finalWrapper = functionRange('processExploreLikeBatches035').text;
for (const required of [
  marker,
  'reconcileExplorePublicLikes056',
  "publicProjection: 'reconciled'",
  "publicProjection: 'deferred'",
]) {
  if (!source.includes(required)) throw new Error(`[056] final runtime missing: ${required}`);
}
if (!finalWrapper.includes(coreName)) throw new Error('[056] aggregate wrapper is not wired');
for (const forbidden of [
  'SELECT * FROM tracks',
  'SELECT * FROM likes',
  'SELECT * FROM track_stats',
]) {
  if (helpers.includes(forbidden)) throw new Error(`[056] forbidden full scan pattern: ${forbidden}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[056] Canonical W1 likes now reconcile shared Feed/Profile R2 after actual aggregate changes only.');
