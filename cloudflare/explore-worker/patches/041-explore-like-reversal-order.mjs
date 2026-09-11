import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912';
if (source.includes(marker)) {
  console.log('[041] Explore like reversal ordering already applied.');
  process.exit(0);
}

if (!source.includes('SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_040_20260912')) {
  throw new Error('[041] required 040 W1 runtime missing');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[041] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[041] function body missing: ${name}`);
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
  throw new Error(`[041] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

replaceFunction('handleLikeBatch034', `async function handleLikeBatch034(request, env, cors) {
  // ${marker}
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
    // A desired state that equals the still-old canonical state can be the
    // reversal of an already accepted, not-yet-aggregated batch. New clients
    // send baseLiked so that reversal is preserved. Legacy clients do not have
    // that hint, so queue the apparent no-op rather than risk dropping intent.
    if (mutation.baseLiked === null) return true;
    return mutation.baseLiked !== mutation.liked;
  });

  let queued = { batchId: '', inserted: false, queue: 'none' };
  if (effectiveMutations.length) {
    queued = await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt);
  }

  await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);
  return json({
    ok: true,
    data: {
      results,
      queued: Boolean(effectiveMutations.length),
      batchId: queued.batchId || null,
      queue: queued.queue
    }
  }, 200, cors);
}`);

const handler = functionRange('handleLikeBatch034').text;
for (const required of [
  marker,
  "const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null",
  'if (mutation.liked !== canonicalLiked) return true',
  'if (mutation.baseLiked === null) return true',
  'return mutation.baseLiked !== mutation.liked',
]) {
  if (!handler.includes(required)) throw new Error(`[041] reversal contract missing: ${required}`);
}
if (!source.includes('INSERT OR IGNORE INTO explore_like_batches_069')) throw new Error('[041] W1 enqueue missing after correction');

writeFileSync(workerPath, source, 'utf8');
console.log('[041] Explore like/unlike reversals are preserved across the deferred aggregate window without an extra queue read.');
