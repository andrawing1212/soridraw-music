import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_WRITE_COMPACTION_042_20260913';
if (source.includes(marker)) {
  console.log('[042] Social snapshot/write compaction already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912')) {
  throw new Error('[042] required 041 reversal runtime missing');
}
for (const required of [
  'handleLikeBatch034',
  'processExploreLikeBatches035',
  'selectExploreLikeAggregateBoundary039',
  'processExploreLikeAggregateWave035',
  'hasExploreLikeQueue066038',
  'hasExploreLikeQueue069040',
  'syncExploreLikeR2AfterBatch034',
  'handleMyFollowingR2Bundle',
  'readExploreLikeR2Bundle',
  'readExploreFollowingR2Bundle',
  'handleMusicNotePublicationSingleWrite016',
]) {
  if (!source.includes(required)) throw new Error(`[042] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[042] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[042] function body missing: ${name}`);
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
  throw new Error(`[042] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const runtimePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'runtime', 'social-snapshot-042.js');
const runtimeSource = readFileSync(runtimePath, 'utf8');
if (!runtimeSource.includes('SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_USER_QUEUE_042_20260913')) {
  throw new Error('[042] social snapshot runtime marker missing');
}
const helperAt = functionRange('handleLikeBatch034').start;
source = source.slice(0, helperAt) + `// ${marker}\n` + runtimeSource + '\n\n' + source.slice(helperAt);

const legacyHandler = functionRange('handleLikeBatch034').text;
replaceFunction('handleLikeBatch034', `async function handleLikeBatch034(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '좋아요 묶음 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.mutations) ? body.mutations : [];
  if (!raw.length) return json({ ok: true, data: { results: [], queued: false } }, 200, cors);
  if (raw.length > EXPLORE_LIKE_BATCH_MAX_034) throwApi('TOO_MANY_LIKES', '한 번에 처리할 수 있는 좋아요 수를 초과했습니다.', 400);

  const receivedAt = Date.now();
  const byTrack = new Map();
  for (const row of raw) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId || trackId.length > 512 || typeof row?.liked !== 'boolean') {
      throwApi('INVALID_TRACK_ID', '좋아요 묶음에 올바르지 않은 곡이 있습니다.', 400);
    }
    const rawMutationAt = Math.floor(Number(row?.mutationAt || 0));
    const mutationAt = Number.isFinite(rawMutationAt) && rawMutationAt > 0 && rawMutationAt <= receivedAt + 5 * 60 * 1000
      ? rawMutationAt
      : receivedAt;
    const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null;
    byTrack.set(trackId, { trackId, liked: row.liked, baseLiked, mutationAt });
  }
  const mutations = [...byTrack.values()];
  await enforceExploreLikeBatchRateLimit034(env, authContext.uid, mutations.length);

  const states = await readExploreLikeBatchStates035(env, authContext.uid, mutations);
  if (states.size !== mutations.length || mutations.some((mutation) => Number(states.get(mutation.trackId)?.valid_track || 0) !== 1)) {
    throwApi('NOT_FOUND', '공개 곡을 찾을 수 없습니다.', 404);
  }

  const results = mutations.map((mutation) => {
    const state = states.get(mutation.trackId) || {};
    return {
      trackId: mutation.trackId,
      liked: mutation.liked,
      likeCount: clampExploreSocialCount(state.like_count)
    };
  });

  const effectiveMutations = mutations.filter((mutation) => {
    const state = states.get(mutation.trackId) || {};
    const canonicalLiked = Number(state.canonical_liked || 0) === 1;
    if (mutation.liked !== canonicalLiked) return true;
    if (mutation.baseLiked === null) return true;
    return mutation.baseLiked !== mutation.liked;
  });

  let queued = { batchId: '', inserted: false, queue: 'none' };
  if (effectiveMutations.length) {
    try {
      queued = await enqueueExploreLikeUserQueue075(env, authContext.uid, effectiveMutations, receivedAt);
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!/no such table:\\s*explore_like_user_queue_075/i.test(message)) throw error;
      queued = await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt);
    }
  }

  await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);
  return json({
    ok: true,
    data: {
      results,
      queued: Boolean(effectiveMutations.length),
      batchId: queued.batchId || null,
      queue: queued.queue || '075'
    }
  }, 200, cors);
}`);

replaceFunction('processExploreLikeBatches035', `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));
  const includeQueue066 = await hasExploreLikeQueue066038(env);
  const includeQueue069 = await hasExploreLikeQueue069040(env);
  const legacyBoundary = await selectExploreLikeAggregateBoundary039(
    env,
    now,
    EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035,
    includeQueue066,
    includeQueue069
  );
  let userQueuePending = false;
  try {
    userQueuePending = await hasExploreLikeUserQueuePending075(env, now);
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!/no such table:\\s*explore_like_user_queue_075/i.test(message)) throw error;
  }

  // Important cost boundary: an empty 10-minute cron performs no D1 write.
  // The lease is acquired only after read-only preflight proves there is work.
  if (!legacyBoundary && !userQueuePending) {
    const idle = { skipped: true, reason: 'idle', idleWriteZero: true, waves: 0, processedBatches: 0, processedUserWaves: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0 };
    console.log('[SORIDRAW 042] like aggregate idle', JSON.stringify(idle));
    return idle;
  }

  const owner = 'like042_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease' };
  const totals = {
    waves: 0,
    processedBatches: 0,
    processedUserWaves: 0,
    oldProcessed: 0,
    compactProcessed: 0,
    w1Processed: 0,
    insertedLikes: 0,
    deletedLikes: 0,
    changedTracks: 0,
    compactQueue: includeQueue066,
    w1Queue: includeQueue069,
    userQueue: userQueuePending
  };
  try {
    if (legacyBoundary) {
      for (let wave = 0; wave < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035; wave += 1) {
        const current = await processExploreLikeAggregateWave035(env, now, Date.now(), includeQueue066, includeQueue069);
        totals.waves += 1;
        totals.processedBatches += current.processedBatches;
        totals.oldProcessed += current.oldProcessed;
        totals.compactProcessed += current.compactProcessed;
        totals.w1Processed += current.w1Processed;
        totals.insertedLikes += current.insertedLikes;
        totals.deletedLikes += current.deletedLikes;
        totals.changedTracks += current.positiveTracks + current.negativeTracks;
        if (!current.processedBatches) break;
      }
    }

    if (userQueuePending) {
      for (let wave = 0; wave < EXPLORE_LIKE_USER_QUEUE_MAX_WAVES_075; wave += 1) {
        const current = await processExploreLikeUserQueueWave075(env, now, Date.now());
        totals.waves += 1;
        if (!current.advanced) break;
        totals.processedUserWaves += 1;
        totals.insertedLikes += current.insertedLikes;
        totals.deletedLikes += current.deletedLikes;
        totals.changedTracks += current.positiveTracks + current.negativeTracks;
      }
    }
    console.log('[SORIDRAW 042] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
  }
}`);

const socialRouteAnchor = '    if (url.pathname === "/v1/me/following-bundle" && request.method === "GET") {';
if (!source.includes(socialRouteAnchor)) throw new Error('[042] following bundle route anchor missing');
source = source.replace(
  socialRouteAnchor,
  `    if (url.pathname === "/v1/me/social-snapshot" && request.method === "GET") {\n      return await handleMySocialSnapshot042(request, env, cors);\n    }\n${socialRouteAnchor}`
);

const publicationRange = functionRange('handleMusicNotePublicationSingleWrite016');
const publicationNeedle = '      profilePinned: resolvedOptions.profilePinned === 1,\n      mutation:';
if (!publicationRange.text.includes(publicationNeedle)) {
  throw new Error('[042] publication snapshot response anchor missing');
}
const publicationNext = publicationRange.text.replace(
  publicationNeedle,
  '      profilePinned: resolvedOptions.profilePinned === 1,\n      snapshotItem: feedItem,\n      mutation:'
);
source = source.slice(0, publicationRange.start) + publicationNext + source.slice(publicationRange.end);

const handler = functionRange('handleLikeBatch034').text;
const aggregate = functionRange('processExploreLikeBatches035').text;
const publication = functionRange('handleMusicNotePublicationSingleWrite016').text;
for (const required of [
  'enqueueExploreLikeUserQueue075',
  'baseLiked',
  'mutationAt',
  "queue: queued.queue || '075'",
]) {
  if (!handler.includes(required)) throw new Error(`[042] intake contract missing: ${required}`);
}
for (const required of [
  "reason: 'idle'",
  'idleWriteZero: true',
  'hasExploreLikeUserQueuePending075',
  'processExploreLikeUserQueueWave075',
]) {
  if (!aggregate.includes(required)) throw new Error(`[042] aggregate contract missing: ${required}`);
}
if (!publication.includes('snapshotItem: feedItem')) throw new Error('[042] publication snapshot item missing');
if (!source.includes('/v1/me/social-snapshot')) throw new Error('[042] social snapshot route missing');
if (!source.includes('SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_USER_QUEUE_042_20260913')) throw new Error('[042] runtime injection missing');
if (!legacyHandler.includes('SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912')) throw new Error('[042] 041 handler was not the replacement base');

writeFileSync(workerPath, source, 'utf8');
console.log('[042] Per-user like queue, idle W0 aggregate, combined social read snapshot, and publication snapshot response are wired.');
