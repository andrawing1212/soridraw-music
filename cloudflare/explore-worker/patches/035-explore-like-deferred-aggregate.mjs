import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_DEFERRED_AGGREGATE_035_20260911';
if (source.includes(marker)) {
  console.log('[035] Explore deferred like aggregation already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[035] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[035] function body missing: ${name}`);
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
  throw new Error(`[035] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911',
  'handleLikeBatch034',
  'enforceExploreLikeBatchRateLimit034',
  'syncExploreLikeR2AfterBatch034',
  'clampExploreSocialCount',
  'requireExploreAuth',
  'throwApi',
  'json',
]) {
  if (!source.includes(required)) throw new Error(`[035] required 034/runtime behavior missing: ${required}`);
}

const helpers = `// ${marker}
const EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035 = 50000;
const EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035 = 3;
const EXPLORE_LIKE_PROCESSOR_LEASE_MS_035 = 12 * 60 * 1000;

async function exploreLikeBatchId035(uid, mutations) {
  const canonical = [...mutations]
    .map((row) => ({ trackId: String(row.trackId || ''), liked: Boolean(row.liked) }))
    .sort((a, b) => a.trackId.localeCompare(b.trackId));
  const input = new TextEncoder().encode(String(uid || '') + '\\n' + JSON.stringify(canonical));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const hex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
  return 'l035_' + hex;
}

async function readExploreLikeBatchStates035(env, uid, mutations) {
  const trackIds = mutations.map((row) => String(row.trackId || '')).filter(Boolean);
  if (!trackIds.length) return new Map();
  const values = trackIds.map(() => '(?)').join(',');
  const rows = await env.DB.prepare(\`
    WITH requested(track_id) AS (VALUES \${values})
    SELECT
      r.track_id,
      CASE WHEN t.id IS NOT NULL AND p.uid IS NOT NULL THEN 1 ELSE 0 END AS valid_track,
      COALESCE(s.like_count, 0) AS like_count,
      CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END AS canonical_liked
    FROM requested r
    LEFT JOIN tracks t
      ON t.id = r.track_id AND t.is_public = 1 AND t.status = 'published'
    LEFT JOIN public_profiles p
      ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = r.track_id
    LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ?
  \`).bind(...trackIds, uid).all();
  return new Map((rows?.results || []).map((row) => [String(row.track_id || ''), row]));
}

async function enqueueExploreLikeBatch035(env, uid, mutations, now) {
  const batchId = await exploreLikeBatchId035(uid, mutations);
  const payload = mutations.map((row) => ({ trackId: String(row.trackId || ''), liked: Boolean(row.liked) }));
  const result = await env.DB.prepare(\`
    INSERT OR IGNORE INTO explore_like_batches_035(
      batch_id, user_uid, created_at, mutation_count, mutations_json
    ) VALUES (?, ?, ?, ?, ?)
  \`).bind(batchId, uid, now, payload.length, JSON.stringify(payload)).run();
  return { batchId, inserted: Number(result?.meta?.changes || 0) > 0 };
}

function exploreLikeAggregateCte035() {
  return \`
    WITH ordered AS (
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json,
        SUM(mutation_count) OVER (
          ORDER BY created_at ASC, batch_id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_mutations
      FROM (
        SELECT batch_id, user_uid, created_at, mutation_count, mutations_json
        FROM explore_like_batches_035
        WHERE created_at <= ?
        ORDER BY created_at ASC, batch_id ASC
        LIMIT 50000
      )
    ),
    eligible AS (
      SELECT batch_id, user_uid, created_at, mutation_count, mutations_json
      FROM ordered
      WHERE running_mutations <= ?
    ),
    expanded AS (
      SELECT
        e.batch_id,
        e.user_uid,
        e.created_at,
        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
        CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked
      FROM eligible e, json_each(e.mutations_json) AS j
      WHERE json_type(j.value, '$.trackId') = 'text'
        AND json_type(j.value, '$.liked') IN ('true', 'false')
    ),
    latest AS (
      SELECT user_uid, track_id, desired_liked, created_at, batch_id
      FROM (
        SELECT expanded.*,
          ROW_NUMBER() OVER (
            PARTITION BY user_uid, track_id
            ORDER BY created_at DESC, batch_id DESC
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

async function acquireExploreLikeProcessor035(env, owner, now) {
  const result = await env.DB.prepare(\`
    UPDATE explore_like_processor_035
    SET lease_until = ?, owner = ?
    WHERE id = 1 AND (lease_until <= ? OR owner = ?)
    RETURNING owner
  \`).bind(now + EXPLORE_LIKE_PROCESSOR_LEASE_MS_035, owner, now, owner).all();
  return String(result?.results?.[0]?.owner || '') === owner;
}

async function releaseExploreLikeProcessor035(env, owner) {
  await env.DB.prepare(\`
    UPDATE explore_like_processor_035
    SET lease_until = 0, owner = ''
    WHERE id = 1 AND owner = ?
  \`).bind(owner).run();
}

async function processExploreLikeAggregateWave035(env, cutoff, now) {
  const cte = exploreLikeAggregateCte035();
  const max = EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035;
  const result = await env.DB.batch([
    env.DB.prepare(cte + \`
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    \`).bind(cutoff, max, now),
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
    \`).bind(cutoff, max, now),
    env.DB.prepare(cte + \`
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at
      FROM latest
      WHERE desired_liked = 1
    \`).bind(cutoff, max),
    env.DB.prepare(cte + \`
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid
        FROM latest
        WHERE desired_liked = 0
      )
    \`).bind(cutoff, max),
    env.DB.prepare(cte + \`
      DELETE FROM explore_like_batches_035
      WHERE batch_id IN (SELECT batch_id FROM eligible)
    \`).bind(cutoff, max)
  ]);
  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    processedBatches: Number(result?.[4]?.meta?.changes || 0)
  };
}

async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));
  const owner = 'like035_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease' };
  const totals = { waves: 0, processedBatches: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0 };
  try {
    for (let wave = 0; wave < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035; wave += 1) {
      const current = await processExploreLikeAggregateWave035(env, now, Date.now());
      totals.waves += 1;
      totals.processedBatches += current.processedBatches;
      totals.insertedLikes += current.insertedLikes;
      totals.deletedLikes += current.deletedLikes;
      totals.changedTracks += current.positiveTracks + current.negativeTracks;
      if (!current.processedBatches) break;
    }
    console.log('[SORIDRAW 035] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
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

  const byTrack = new Map();
  for (const row of raw) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId || trackId.length > 512 || typeof row?.liked !== 'boolean') {
      throwApi('INVALID_TRACK_ID', '좋아요 묶음에 올바르지 않은 곡이 있습니다.', 400);
    }
    byTrack.set(trackId, { trackId, liked: row.liked });
  }
  const mutations = [...byTrack.values()];
  await enforceExploreLikeBatchRateLimit034(env, authContext.uid, mutations.length);

  // One key-addressed query validates all public tracks and reads only the counters
  // required to preserve the caller's optimistic UI. No canonical like/stat write occurs here.
  const states = await readExploreLikeBatchStates035(env, authContext.uid, mutations);
  if (states.size !== mutations.length || mutations.some((mutation) => Number(states.get(mutation.trackId)?.valid_track || 0) !== 1)) {
    throwApi('NOT_FOUND', '공개 곡을 찾을 수 없습니다.', 404);
  }

  const results = mutations.map((mutation) => {
    const state = states.get(mutation.trackId) || {};
    const canonicalLiked = Number(state.canonical_liked || 0) === 1;
    const currentCount = clampExploreSocialCount(state.like_count);
    const delta = mutation.liked === canonicalLiked ? 0 : (mutation.liked ? 1 : -1);
    return {
      trackId: mutation.trackId,
      liked: mutation.liked,
      likeCount: clampExploreSocialCount(currentCount + delta)
    };
  });

  const now = Date.now();
  const queued = await enqueueExploreLikeBatch035(env, authContext.uid, mutations, now);

  // User-specific liked state stays cheap and responsive: one R2 read/write for the whole batch.
  // Canonical relation/count + public Feed/Profile projection are delayed to the scheduled aggregate.
  await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);
  return json({ ok: true, data: { results, queued: true, batchId: queued.batchId } }, 200, cors);
}`);

const exportMatches = [...source.matchAll(/export\s+default\s*\{/g)];
if (!exportMatches.length) throw new Error('[035] Worker module default export missing');
const exportMatch = exportMatches.at(-1);
const insertAt = Number(exportMatch.index) + exportMatch[0].length;
source = source.slice(0, insertAt) + `
  async scheduled(controller, env, ctx) {
    await processExploreLikeBatches035(env, Number(controller?.scheduledTime || Date.now()));
  },` + source.slice(insertAt);

const batchBody = functionRange('handleLikeBatch034').text;
if (batchBody.includes('adjustExploreLikeCounterDelta')) throw new Error('[035] batch intake still mutates canonical likes synchronously');
if (!batchBody.includes('enqueueExploreLikeBatch035')) throw new Error('[035] batch intake queue write missing');
if (!batchBody.includes('syncExploreLikeR2AfterBatch034')) throw new Error('[035] batch user R2 sync missing');
if (!source.includes('async scheduled(controller, env, ctx)')) throw new Error('[035] scheduled aggregate handler missing');
if (!source.includes('SUM(delta)') || !source.includes('DELETE FROM explore_like_batches_035')) {
  throw new Error('[035] set-based aggregate contract missing');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[035] Likes now queue one durable user batch, then aggregate canonical relations/counts on schedule.');
