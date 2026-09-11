import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_040_20260912';
if (source.includes(marker)) {
  console.log('[040] Explore W1 delayed-count runtime already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[040] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[040] function body missing: ${name}`);
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
  throw new Error(`[040] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_STABLE_DUAL_QUEUE_BOUNDARY_039_20260911',
  'enqueueExploreLikeBatch035',
  'readExploreLikeBatchStates035',
  'selectExploreLikeAggregateBoundary039',
  'exploreLikeAggregateSnapshotCte039',
  'processExploreLikeAggregateWave035',
  'processExploreLikeBatches035',
  'syncExploreLikeR2AfterBatch034',
]) {
  if (!source.includes(required)) throw new Error(`[040] required prior runtime missing: ${required}`);
}

const legacyEnqueue = functionRange('enqueueExploreLikeBatch035').text
  .replace('async function enqueueExploreLikeBatch035(', 'async function enqueueExploreLikeBatchLegacy040(');

const enqueueReplacement040 = `${legacyEnqueue}\n\nasync function enqueueExploreLikeBatch035(env, uid, mutations, now) {
  const next = await exploreLikeW1Batch040(uid, mutations, now);
  try {
    const result = await env.DB.prepare(\`
      INSERT OR IGNORE INTO explore_like_batches_069(
        batch_id, user_uid, created_at, mutation_count, mutations_json
      ) VALUES (?, ?, ?, ?, ?)
    \`).bind(next.batchId, uid, next.batchAt, next.payload.length, JSON.stringify(next.payload)).run();
    return {
      batchId: next.batchId,
      inserted: Number(result?.meta?.changes || 0) > 0,
      queue: '069'
    };
  } catch (error) {
    if (!isMissingExploreLikeQueue069040(error)) throw error;
    return enqueueExploreLikeBatchLegacy040(env, uid, mutations, now);
  }
}`;
replaceFunction('enqueueExploreLikeBatch035', enqueueReplacement040);

const helpers = `// ${marker}
function exploreLikeCutoffKey069040(cutoff) {
  const value = Math.max(0, Math.floor(Number(cutoff || 0)));
  return 'l069_' + String(value).padStart(13, '0') + '_~';
}

function isMissingExploreLikeQueue069040(error) {
  const message = String(error?.message || error || '');
  return /no such table:\\s*explore_like_batches_069/i.test(message);
}

async function exploreLikeW1Batch040(uid, mutations, now) {
  const fallbackAt = Math.max(0, Math.floor(Number(now || Date.now())));
  const canonical = [...mutations]
    .map((row) => ({
      trackId: String(row.trackId || ''),
      liked: Boolean(row.liked),
      mutationAt: Math.max(1, Math.floor(Number(row.mutationAt || fallbackAt)))
    }))
    .sort((a, b) => a.trackId.localeCompare(b.trackId));
  const batchAt = Math.max(fallbackAt, ...canonical.map((row) => row.mutationAt));
  const input = new TextEncoder().encode(String(uid || '') + '\\n' + JSON.stringify(canonical));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const hex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
  return {
    batchAt,
    batchId: 'l069_' + String(batchAt).padStart(13, '0') + '_' + hex,
    payload: canonical.map((row) => ({ trackId: row.trackId, liked: row.liked }))
  };
}



async function hasExploreLikeQueue069040(env) {
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type='table' AND name='explore_like_batches_069' LIMIT 1"
    ).first('name');
    return String(result || '') === 'explore_like_batches_069';
  } catch {
    return false;
  }
}

`;

const helperAt = functionRange('handleLikeBatch034').start;
source = source.slice(0, helperAt) + helpers + source.slice(helperAt);

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
    byTrack.set(trackId, { trackId, liked: row.liked, mutationAt });
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
    return mutation.liked !== canonicalLiked;
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

replaceFunction('exploreLikeQueueSource039', `function exploreLikeQueueSource039(includeQueue066 = false, includeQueue069 = false, cutoff = Date.now()) {
  const parts = [\`
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
    FROM explore_like_batches_035
  \`];
  if (includeQueue066) {
    parts.push(\`
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '066' AS queue_kind
      FROM explore_like_batches_066
    \`);
  }
  if (includeQueue069) {
    const cutoffKey = exploreLikeCutoffKey069040(cutoff);
    parts.push(\`
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '069' AS queue_kind
      FROM explore_like_batches_069
      WHERE batch_id <= '\${cutoffKey}'
    \`);
  }
  return parts.join('\\nUNION ALL\\n');
}`);

replaceFunction('selectExploreLikeAggregateBoundary039', `async function selectExploreLikeAggregateBoundary039(env, cutoff, maxMutations, includeQueue066 = false, includeQueue069 = false) {
  const queueSource = exploreLikeQueueSource039(includeQueue066, includeQueue069, cutoff);
  const row = await env.DB.prepare(\`
    WITH all_batches AS (
      \${queueSource}
    ),
    limited AS (
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind
      FROM all_batches
      WHERE created_at <= ?
      ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
      LIMIT 50000
    ),
    ordered AS (
      SELECT batch_id, created_at, queue_kind,
        SUM(mutation_count) OVER (
          ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_mutations
      FROM limited
    )
    SELECT created_at, batch_id, queue_kind
    FROM ordered
    WHERE running_mutations <= ?
    ORDER BY created_at DESC, batch_id DESC, queue_kind DESC
    LIMIT 1
  \`).bind(cutoff, maxMutations).first();
  if (!row?.batch_id) return null;
  return { createdAt: Number(row.created_at || 0), batchId: String(row.batch_id || ''), queueKind: String(row.queue_kind || '035') };
}`);

replaceFunction('exploreLikeAggregateSnapshotCte039', `function exploreLikeAggregateSnapshotCte039(includeQueue066 = false, includeQueue069 = false, cutoff = Date.now()) {
  const queueSource = exploreLikeQueueSource039(includeQueue066, includeQueue069, cutoff);
  return \`
    WITH boundary(created_at, batch_id, queue_kind) AS (VALUES (?, ?, ?)),
    all_batches AS (
      \${queueSource}
    ),
    eligible AS (
      SELECT a.batch_id, a.user_uid, a.created_at, a.mutation_count, a.mutations_json, a.queue_kind
      FROM all_batches a, boundary b
      WHERE a.created_at <= ?
        AND (
          a.created_at < b.created_at
          OR (a.created_at = b.created_at AND a.batch_id < b.batch_id)
          OR (a.created_at = b.created_at AND a.batch_id = b.batch_id AND a.queue_kind <= b.queue_kind)
        )
    ),
    expanded AS (
      SELECT e.batch_id, e.user_uid, e.created_at, e.queue_kind,
        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
        CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked
      FROM eligible e, json_each(e.mutations_json) AS j
      WHERE json_type(j.value, '$.trackId') = 'text'
        AND json_type(j.value, '$.liked') IN ('true', 'false')
    ),
    latest AS (
      SELECT user_uid, track_id, desired_liked, created_at, batch_id, queue_kind
      FROM (
        SELECT expanded.*,
          ROW_NUMBER() OVER (
            PARTITION BY user_uid, track_id
            ORDER BY created_at DESC, batch_id DESC, queue_kind DESC
          ) AS rn
        FROM expanded
        WHERE track_id <> ''
      )
      WHERE rn = 1
    ),
    deltas AS (
      SELECT latest.*,
        CASE
          WHEN latest.desired_liked = 1 AND existing.user_uid IS NULL THEN 1
          WHEN latest.desired_liked = 0 AND existing.user_uid IS NOT NULL THEN -1
          ELSE 0
        END AS delta
      FROM latest
      LEFT JOIN likes existing
        ON existing.track_id = latest.track_id
       AND existing.user_uid = latest.user_uid
    )
  \`;
}`);

replaceFunction('processExploreLikeAggregateWave035', `async function processExploreLikeAggregateWave035(env, cutoff, now, includeQueue066 = false, includeQueue069 = false) {
  const max = EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035;
  const boundary = await selectExploreLikeAggregateBoundary039(env, cutoff, max, includeQueue066, includeQueue069);
  if (!boundary) return { positiveTracks: 0, negativeTracks: 0, insertedLikes: 0, deletedLikes: 0, processedBatches: 0, oldProcessed: 0, compactProcessed: 0, w1Processed: 0 };

  const cte = exploreLikeAggregateSnapshotCte039(includeQueue066, includeQueue069, cutoff);
  const prefix = [boundary.createdAt, boundary.batchId, boundary.queueKind, cutoff];
  const statements = [
    env.DB.prepare(cte + \`
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ? FROM deltas GROUP BY track_id HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET like_count = track_stats.like_count + excluded.like_count, updated_at = excluded.updated_at
    \`).bind(...prefix, now),
    env.DB.prepare(cte + \`
      UPDATE track_stats
      SET like_count = MAX(0, like_count + COALESCE((SELECT SUM(d.delta) FROM deltas d WHERE d.track_id = track_stats.track_id), 0)), updated_at = ?
      WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0)
    \`).bind(...prefix, now),
    env.DB.prepare(cte + \`
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at FROM latest WHERE desired_liked = 1
    \`).bind(...prefix),
    env.DB.prepare(cte + \`
      DELETE FROM likes WHERE (track_id, user_uid) IN (SELECT track_id, user_uid FROM latest WHERE desired_liked = 0)
    \`).bind(...prefix),
    env.DB.prepare(cte + \`
      DELETE FROM explore_like_batches_035 WHERE batch_id IN (SELECT batch_id FROM eligible WHERE queue_kind = '035')
    \`).bind(...prefix)
  ];
  let compactIndex = -1;
  let w1Index = -1;
  if (includeQueue066) {
    compactIndex = statements.length;
    statements.push(env.DB.prepare(cte + \`
      DELETE FROM explore_like_batches_066 WHERE batch_id IN (SELECT batch_id FROM eligible WHERE queue_kind = '066')
    \`).bind(...prefix));
  }
  if (includeQueue069) {
    w1Index = statements.length;
    statements.push(env.DB.prepare(cte + \`
      DELETE FROM explore_like_batches_069 WHERE batch_id IN (SELECT batch_id FROM eligible WHERE queue_kind = '069')
    \`).bind(...prefix));
  }
  const result = await env.DB.batch(statements);
  const oldProcessed = Number(result?.[4]?.meta?.changes || 0);
  const compactProcessed = compactIndex >= 0 ? Number(result?.[compactIndex]?.meta?.changes || 0) : 0;
  const w1Processed = w1Index >= 0 ? Number(result?.[w1Index]?.meta?.changes || 0) : 0;
  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    processedBatches: oldProcessed + compactProcessed + w1Processed,
    oldProcessed, compactProcessed, w1Processed
  };
}`);

replaceFunction('processExploreLikeBatches035', `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));
  const owner = 'like035_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease' };
  const includeQueue066 = await hasExploreLikeQueue066038(env);
  const includeQueue069 = await hasExploreLikeQueue069040(env);
  const totals = { waves: 0, processedBatches: 0, oldProcessed: 0, compactProcessed: 0, w1Processed: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, compactQueue: includeQueue066, w1Queue: includeQueue069 };
  try {
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
    console.log('[SORIDRAW 040] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
  }
}`);

for (const required of [marker, 'INSERT OR IGNORE INTO explore_like_batches_069', "queue: '069'", 'exploreLikeCutoffKey069040', "queue_kind = '069'", 'hasExploreLikeQueue069040(env)', 'likeCount: clampExploreSocialCount(state.like_count)', 'effectiveMutations']) {
  if (!source.includes(required)) throw new Error(`[040] final runtime missing: ${required}`);
}
const handler = functionRange('handleLikeBatch034').text;
if (handler.includes('currentCount + delta')) throw new Error('[040] intake still manufactures public numeric delta');
writeFileSync(workerPath, source, 'utf8');
console.log('[040] Explore likes use a single-primary-key W1 queue candidate and keep public numeric counts aggregate-authoritative.');
