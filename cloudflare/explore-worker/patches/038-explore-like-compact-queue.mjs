import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_COMPACT_QUEUE_038_20260911';
if (source.includes(marker)) {
  console.log('[038] Explore compact like queue already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[038] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[038] function body missing: ${name}`);
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
  throw new Error(`[038] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_DEFERRED_AGGREGATE_035_20260911',
  'SORIDRAW_EXPLORE_LIKE_DERIVED_INTAKE_036_20260911',
  'exploreLikeBatchId035',
  'enqueueExploreLikeBatch035',
  'exploreLikeAggregateCte035',
  'processExploreLikeAggregateWave035',
  'processExploreLikeBatches035',
  'acquireExploreLikeProcessor035',
  'releaseExploreLikeProcessor035',
]) {
  if (!source.includes(required)) throw new Error(`[038] required 035/036 runtime behavior missing: ${required}`);
}

function isMissingExploreLikeQueue066038(error) {
  const message = String(error?.message || error || '');
  return /no such table:\s*explore_like_batches_066/i.test(message);
}

async function enqueueExploreLikeBatch038(env, uid, mutations, now) {
  const batchId = await exploreLikeBatchId035(uid, mutations);
  const payload = mutations.map((row) => ({ trackId: String(row.trackId || ''), liked: Boolean(row.liked) }));
  try {
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO explore_like_batches_066(
        batch_id, user_uid, created_at, mutation_count, mutations_json
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(batchId, uid, now, payload.length, JSON.stringify(payload)).run();
    return { batchId, inserted: Number(result?.meta?.changes || 0) > 0, queue: '066' };
  } catch (error) {
    // Backward-compatible rollout guard: an older shared schema must keep likes working.
    // Once the additive 066 table exists this branch is never used on the hot path.
    if (!isMissingExploreLikeQueue066038(error)) throw error;
    const fallback = await env.DB.prepare(`
      INSERT OR IGNORE INTO explore_like_batches_035(
        batch_id, user_uid, created_at, mutation_count, mutations_json
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(batchId, uid, now, payload.length, JSON.stringify(payload)).run();
    return { batchId, inserted: Number(fallback?.meta?.changes || 0) > 0, queue: '035' };
  }
}

function exploreLikeAggregateCte038(includeQueue066 = false) {
  const queueSource = includeQueue066 ? `
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
    FROM explore_like_batches_035
    UNION ALL
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '066' AS queue_kind
    FROM explore_like_batches_066
  ` : `
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
    FROM explore_like_batches_035
  `;
  return `
    WITH all_batches AS (
      ${queueSource}
    ),
    ordered AS (
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind,
        SUM(mutation_count) OVER (
          ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_mutations
      FROM (
        SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind
        FROM all_batches
        WHERE created_at <= ?
        ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
        LIMIT 50000
      )
    ),
    eligible AS (
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind
      FROM ordered
      WHERE running_mutations <= ?
    ),
    expanded AS (
      SELECT
        e.batch_id,
        e.user_uid,
        e.created_at,
        e.queue_kind,
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
  `;
}

async function hasExploreLikeQueue066038(env) {
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type='table' AND name='explore_like_batches_066' LIMIT 1"
    ).first('name');
    return String(result || '') === 'explore_like_batches_066';
  } catch {
    return false;
  }
}

async function processExploreLikeAggregateWave038(env, cutoff, now, includeQueue066 = false) {
  const cte = exploreLikeAggregateCte035(includeQueue066);
  const max = EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035;
  const statements = [
    env.DB.prepare(cte + `
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    `).bind(cutoff, max, now),
    env.DB.prepare(cte + `
      UPDATE track_stats
      SET like_count = MAX(0, like_count + COALESCE((
            SELECT SUM(d.delta)
            FROM deltas d
            WHERE d.track_id = track_stats.track_id
          ), 0)),
          updated_at = ?
      WHERE track_id IN (
        SELECT track_id
        FROM deltas
        GROUP BY track_id
        HAVING SUM(delta) < 0
      )
    `).bind(cutoff, max, now),
    env.DB.prepare(cte + `
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at
      FROM latest
      WHERE desired_liked = 1
    `).bind(cutoff, max),
    env.DB.prepare(cte + `
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid
        FROM latest
        WHERE desired_liked = 0
      )
    `).bind(cutoff, max),
    env.DB.prepare(cte + `
      DELETE FROM explore_like_batches_035
      WHERE batch_id IN (
        SELECT batch_id FROM eligible WHERE queue_kind = '035'
      )
    `).bind(cutoff, max),
  ];
  if (includeQueue066) {
    statements.push(
      env.DB.prepare(cte + `
        DELETE FROM explore_like_batches_066
        WHERE batch_id IN (
          SELECT batch_id FROM eligible WHERE queue_kind = '066'
        )
      `).bind(cutoff, max),
    );
  }
  const result = await env.DB.batch(statements);
  const oldProcessed = Number(result?.[4]?.meta?.changes || 0);
  const compactProcessed = includeQueue066 ? Number(result?.[5]?.meta?.changes || 0) : 0;
  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    processedBatches: oldProcessed + compactProcessed,
    oldProcessed,
    compactProcessed,
  };
}

async function processExploreLikeBatches038(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));
  const owner = 'like035_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease' };
  const includeQueue066 = await hasExploreLikeQueue066038(env);
  const totals = {
    waves: 0,
    processedBatches: 0,
    oldProcessed: 0,
    compactProcessed: 0,
    insertedLikes: 0,
    deletedLikes: 0,
    changedTracks: 0,
    compactQueue: includeQueue066,
  };
  try {
    for (let wave = 0; wave < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035; wave += 1) {
      const current = await processExploreLikeAggregateWave035(env, now, Date.now(), includeQueue066);
      totals.waves += 1;
      totals.processedBatches += current.processedBatches;
      totals.oldProcessed += current.oldProcessed;
      totals.compactProcessed += current.compactProcessed;
      totals.insertedLikes += current.insertedLikes;
      totals.deletedLikes += current.deletedLikes;
      totals.changedTracks += current.positiveTracks + current.negativeTracks;
      if (!current.processedBatches) break;
    }
    console.log('[SORIDRAW 038] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
  }
}

const enqueueReplacement = `// ${marker}\n${isMissingExploreLikeQueue066038.toString()}\n\n${enqueueExploreLikeBatch038.toString().replace('enqueueExploreLikeBatch038', 'enqueueExploreLikeBatch035')}`;
replaceFunction('enqueueExploreLikeBatch035', enqueueReplacement);
replaceFunction('exploreLikeAggregateCte035', exploreLikeAggregateCte038.toString().replace('exploreLikeAggregateCte038', 'exploreLikeAggregateCte035'));
replaceFunction('processExploreLikeAggregateWave035', processExploreLikeAggregateWave038.toString().replace('processExploreLikeAggregateWave038', 'processExploreLikeAggregateWave035'));
const batchesReplacement = `${hasExploreLikeQueue066038.toString()}\n\n${processExploreLikeBatches038.toString().replace('processExploreLikeBatches038', 'processExploreLikeBatches035')}`;
replaceFunction('processExploreLikeBatches035', batchesReplacement);

if (!source.includes(marker)) throw new Error('[038] final source marker missing');
const enqueueBody = functionRange('enqueueExploreLikeBatch035').text;
const cteBody = functionRange('exploreLikeAggregateCte035').text;
const waveBody = functionRange('processExploreLikeAggregateWave035').text;
const batchesBody = functionRange('processExploreLikeBatches035').text;
for (const required of [
  'INSERT OR IGNORE INTO explore_like_batches_066',
  'INSERT OR IGNORE INTO explore_like_batches_035',
  "queue: '066'",
  'isMissingExploreLikeQueue066038',
]) {
  if (!enqueueBody.includes(required)) throw new Error(`[038] enqueue compatibility missing: ${required}`);
}
for (const required of [
  'UNION ALL',
  'explore_like_batches_035',
  'explore_like_batches_066',
  'queue_kind',
  'ORDER BY created_at ASC, batch_id ASC, queue_kind ASC',
]) {
  if (!cteBody.includes(required)) throw new Error(`[038] combined queue CTE missing: ${required}`);
}
for (const required of [
  'DELETE FROM explore_like_batches_035',
  'DELETE FROM explore_like_batches_066',
  "queue_kind = '035'",
  "queue_kind = '066'",
]) {
  if (!waveBody.includes(required)) throw new Error(`[038] dual queue drain missing: ${required}`);
}
for (const required of [
  'hasExploreLikeQueue066038(env)',
  'includeQueue066',
  'processExploreLikeAggregateWave035(env, now, Date.now(), includeQueue066)',
]) {
  if (!batchesBody.includes(required)) throw new Error(`[038] processor compatibility missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[038] Explore likes now prefer the compact WITHOUT ROWID queue while one processor drains old + new queues in global chronological order.');
