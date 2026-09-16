import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_STABLE_DUAL_QUEUE_BOUNDARY_039_20260911';
if (source.includes(marker)) {
  console.log('[039] Explore stable dual-queue boundary already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[039] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[039] function body missing: ${name}`);
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
  throw new Error(`[039] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_COMPACT_QUEUE_038_20260911',
  'explore_like_batches_035',
  'explore_like_batches_066',
  'processExploreLikeAggregateWave035',
  'EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035',
]) {
  if (!source.includes(required)) throw new Error(`[039] required 038 runtime behavior missing: ${required}`);
}

const helpers = `// ${marker}
function exploreLikeQueueSource039(includeQueue066 = false) {
  return includeQueue066 ? \`
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
    FROM explore_like_batches_035
    UNION ALL
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '066' AS queue_kind
    FROM explore_like_batches_066
  \` : \`
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
    FROM explore_like_batches_035
  \`;
}

async function selectExploreLikeAggregateBoundary039(env, cutoff, maxMutations, includeQueue066 = false) {
  const queueSource = exploreLikeQueueSource039(includeQueue066);
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
  return {
    createdAt: Number(row.created_at || 0),
    batchId: String(row.batch_id || ''),
    queueKind: String(row.queue_kind || '035')
  };
}

function exploreLikeAggregateSnapshotCte039(includeQueue066 = false) {
  const queueSource = exploreLikeQueueSource039(includeQueue066);
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
  \`;
}

`;

const waveRange = functionRange('processExploreLikeAggregateWave035');
source = source.slice(0, waveRange.start) + helpers + source.slice(waveRange.start);

replaceFunction('processExploreLikeAggregateWave035', `async function processExploreLikeAggregateWave035(env, cutoff, now, includeQueue066 = false) {
  const max = EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035;
  const boundary = await selectExploreLikeAggregateBoundary039(env, cutoff, max, includeQueue066);
  if (!boundary) {
    return {
      positiveTracks: 0,
      negativeTracks: 0,
      insertedLikes: 0,
      deletedLikes: 0,
      processedBatches: 0,
      oldProcessed: 0,
      compactProcessed: 0
    };
  }

  const cte = exploreLikeAggregateSnapshotCte039(includeQueue066);
  const prefix = [boundary.createdAt, boundary.batchId, boundary.queueKind, cutoff];
  const statements = [
    env.DB.prepare(cte + \`
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    \`).bind(...prefix, now),
    env.DB.prepare(cte + \`
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
    \`).bind(...prefix, now),
    env.DB.prepare(cte + \`
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at
      FROM latest
      WHERE desired_liked = 1
    \`).bind(...prefix),
    env.DB.prepare(cte + \`
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid
        FROM latest
        WHERE desired_liked = 0
      )
    \`).bind(...prefix),
    env.DB.prepare(cte + \`
      DELETE FROM explore_like_batches_035
      WHERE batch_id IN (
        SELECT batch_id FROM eligible WHERE queue_kind = '035'
      )
    \`).bind(...prefix)
  ];
  if (includeQueue066) {
    statements.push(
      env.DB.prepare(cte + \`
        DELETE FROM explore_like_batches_066
        WHERE batch_id IN (
          SELECT batch_id FROM eligible WHERE queue_kind = '066'
        )
      \`).bind(...prefix)
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
    compactProcessed
  };
}`);

if (!source.includes(marker)) throw new Error('[039] final source marker missing');
const wave = functionRange('processExploreLikeAggregateWave035').text;
for (const required of [
  'selectExploreLikeAggregateBoundary039',
  'exploreLikeAggregateSnapshotCte039',
  'boundary.createdAt',
  'boundary.batchId',
  'boundary.queueKind',
  'DELETE FROM explore_like_batches_035',
  'DELETE FROM explore_like_batches_066'
]) {
  if (!wave.includes(required)) throw new Error(`[039] stable-boundary wave missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[039] Explore dual-queue aggregate now freezes one chronological boundary before any queue delete, preventing cross-queue over-drain at the mutation cap.');
