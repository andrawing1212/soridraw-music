import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_R2_QUEUE_042_20260913';
if (source.includes(marker)) {
  console.log('[042] Explore social snapshot / R2 like queue already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912',
  'exploreLikeW1Batch040',
  'exploreCacheBucket031',
  'readExploreLikeR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'readExploreFollowingR2Bundle',
  'rebuildExploreFollowingR2Bundle',
  'acquireExploreLikeProcessor035',
  'releaseExploreLikeProcessor035',
]) {
  if (!source.includes(required)) throw new Error(`[042] required runtime missing: ${required}`);
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

const helpers = `// ${marker}\nconst EXPLORE_LIKE_R2_QUEUE_PREFIX_042 = 'internal/explore/like-queue-v2/';\nconst EXPLORE_LIKE_R2_QUEUE_LIST_LIMIT_042 = 500;\nconst EXPLORE_LIKE_R2_QUEUE_MAX_MUTATIONS_042 = 3000;\n\nfunction exploreLikeR2QueueKey042(batchId) {\n  return EXPLORE_LIKE_R2_QUEUE_PREFIX_042 + encodeURIComponent(String(batchId || '')) + '.json';\n}\n\nasync function readExploreLikeR2QueueWave042(env, cutoff) {\n  const bucket = exploreCacheBucket031(env);\n  if (!bucket) return [];\n  const listed = await bucket.list({ prefix: EXPLORE_LIKE_R2_QUEUE_PREFIX_042, limit: EXPLORE_LIKE_R2_QUEUE_LIST_LIMIT_042 });\n  const objects = Array.isArray(listed?.objects) ? listed.objects : [];\n  if (!objects.length) return [];\n\n  const loaded = [];\n  for (let offset = 0; offset < objects.length; offset += 20) {\n    const chunk = objects.slice(offset, offset + 20);\n    const rows = await Promise.all(chunk.map(async (entry) => {\n      try {\n        const object = await bucket.get(entry.key);\n        if (!object) return null;\n        const row = JSON.parse(await object.text());\n        const batchId = String(row?.batchId || '').trim();\n        const userUid = String(row?.userUid || '').trim();\n        const createdAt = Math.max(0, Math.floor(Number(row?.createdAt || 0)));\n        const mutations = Array.isArray(row?.mutations) ? row.mutations : [];\n        if (Number(row?.schemaVersion) !== 1 || !batchId || !userUid || !createdAt || createdAt > cutoff || !mutations.length) return null;\n        const normalized = mutations.map((item) => ({\n          trackId: String(item?.trackId || '').trim(),\n          liked: Boolean(item?.liked),\n        })).filter((item) => item.trackId);\n        if (!normalized.length) return null;\n        return { key: entry.key, batchId, userUid, createdAt, mutations: normalized };\n      } catch (error) {\n        console.warn('[SORIDRAW 042] invalid R2 like queue object', entry.key, String(error?.message || error || 'unknown'));\n        return null;\n      }\n    }));\n    loaded.push(...rows.filter(Boolean));\n  }\n\n  loaded.sort((a, b) => a.createdAt - b.createdAt || a.batchId.localeCompare(b.batchId));\n  const selected = [];\n  let mutationCount = 0;\n  for (const row of loaded) {\n    if (mutationCount + row.mutations.length > EXPLORE_LIKE_R2_QUEUE_MAX_MUTATIONS_042) break;\n    selected.push(row);\n    mutationCount += row.mutations.length;\n  }\n  return selected;\n}\n\nfunction exploreLikeR2InputCte042() {\n  return \\`\n    WITH expanded AS (\n      SELECT\n        TRIM(CAST(json_extract(j.value, '$.batchId') AS TEXT)) AS batch_id,\n        TRIM(CAST(json_extract(j.value, '$.userUid') AS TEXT)) AS user_uid,\n        CAST(json_extract(j.value, '$.createdAt') AS INTEGER) AS created_at,\n        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,\n        CASE WHEN CAST(json_extract(j.value, '$.desiredLiked') AS INTEGER) <> 0 THEN 1 ELSE 0 END AS desired_liked\n      FROM json_each(?) AS j\n    ),\n    latest AS (\n      SELECT user_uid, track_id, desired_liked, created_at, batch_id\n      FROM (\n        SELECT expanded.*,\n          ROW_NUMBER() OVER (\n            PARTITION BY user_uid, track_id\n            ORDER BY created_at DESC, batch_id DESC\n          ) AS rn\n        FROM expanded\n        WHERE user_uid <> '' AND track_id <> ''\n      )\n      WHERE rn = 1\n    ),\n    deltas AS (\n      SELECT latest.*,\n        CASE\n          WHEN latest.desired_liked = 1 AND existing.user_uid IS NULL THEN 1\n          WHEN latest.desired_liked = 0 AND existing.user_uid IS NOT NULL THEN -1\n          ELSE 0\n        END AS delta\n      FROM latest\n      LEFT JOIN likes existing\n        ON existing.track_id = latest.track_id\n       AND existing.user_uid = latest.user_uid\n    )\n  \\`;\n}\n\nasync function processExploreLikeR2QueueWave042(env, rows, now) {\n  if (!rows.length) return { positiveTracks: 0, negativeTracks: 0, insertedLikes: 0, deletedLikes: 0, processedBatches: 0 };\n  const flattened = [];\n  for (const row of rows) {\n    for (const mutation of row.mutations) {\n      flattened.push({\n        batchId: row.batchId,\n        userUid: row.userUid,\n        createdAt: row.createdAt,\n        trackId: mutation.trackId,\n        desiredLiked: mutation.liked ? 1 : 0,\n      });\n    }\n  }\n  const payload = JSON.stringify(flattened);\n  const cte = exploreLikeR2InputCte042();\n  const result = await env.DB.batch([\n    env.DB.prepare(cte + \\`\n      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)\n      SELECT track_id, SUM(delta), 0, 0, ?\n      FROM deltas\n      GROUP BY track_id\n      HAVING SUM(delta) > 0\n      ON CONFLICT(track_id) DO UPDATE SET\n        like_count = track_stats.like_count + excluded.like_count,\n        updated_at = excluded.updated_at\n    \\`).bind(payload, now),\n    env.DB.prepare(cte + \\`\n      UPDATE track_stats\n      SET like_count = MAX(0, like_count + COALESCE((\n            SELECT SUM(d.delta) FROM deltas d WHERE d.track_id = track_stats.track_id\n          ), 0)),\n          updated_at = ?\n      WHERE track_id IN (\n        SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0\n      )\n    \\`).bind(payload, now),\n    env.DB.prepare(cte + \\`\n      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)\n      SELECT track_id, user_uid, created_at FROM latest WHERE desired_liked = 1\n    \\`).bind(payload),\n    env.DB.prepare(cte + \\`\n      DELETE FROM likes\n      WHERE (track_id, user_uid) IN (\n        SELECT track_id, user_uid FROM latest WHERE desired_liked = 0\n      )\n    \\`).bind(payload),\n  ]);\n\n  const bucket = exploreCacheBucket031(env);\n  for (let offset = 0; offset < rows.length; offset += 20) {\n    const chunk = rows.slice(offset, offset + 20);\n    await Promise.all(chunk.map((row) => bucket.delete(row.key)));\n  }\n\n  return {\n    positiveTracks: Number(result?.[0]?.meta?.changes || 0),\n    negativeTracks: Number(result?.[1]?.meta?.changes || 0),\n    insertedLikes: Number(result?.[2]?.meta?.changes || 0),\n    deletedLikes: Number(result?.[3]?.meta?.changes || 0),\n    processedBatches: rows.length,\n  };\n}\n\nasync function handleMySocialSnapshot042(request, env, cors) {\n  const authContext = await requireExploreAuth(request);\n  let [likedIds, followingUids] = await Promise.all([\n    readExploreLikeR2Bundle(env, authContext.uid),\n    readExploreFollowingR2Bundle(env, authContext.uid),\n  ]);\n  if (!likedIds || !followingUids) {\n    await Promise.all([\n      likedIds ? Promise.resolve() : rebuildExploreLikeR2Bundle(env, authContext.uid),\n      followingUids ? Promise.resolve() : rebuildExploreFollowingR2Bundle(env, authContext.uid),\n    ]);\n    [likedIds, followingUids] = await Promise.all([\n      readExploreLikeR2Bundle(env, authContext.uid),\n      readExploreFollowingR2Bundle(env, authContext.uid),\n    ]);\n  }\n  if (!likedIds || !followingUids) {\n    return json({ ok: false, error: 'SOCIAL_SNAPSHOT_UNAVAILABLE' }, 503, cors);\n  }\n  return json({\n    ok: true,\n    data: {\n      schemaVersion: 1,\n      likedTrackIds: [...likedIds],\n      followingUids: [...followingUids],\n      source: 'r2-social-042',\n      updatedAt: Date.now(),\n    }\n  }, 200, cors);\n}\n\n`;

const helperAt = functionRange('handleLikeBatch034').start;
source = source.slice(0, helperAt) + helpers + source.slice(helperAt);

replaceFunction('enqueueExploreLikeBatch035', `async function enqueueExploreLikeBatch035(env, uid, mutations, now) {
  const next = await exploreLikeW1Batch040(uid, mutations, now);
  const bucket = exploreCacheBucket031(env);
  if (!bucket) throw new Error('Explore R2 queue binding is unavailable');
  const row = {
    schemaVersion: 1,
    batchId: next.batchId,
    userUid: String(uid || ''),
    createdAt: next.batchAt,
    mutationCount: next.payload.length,
    mutations: next.payload,
  };
  await bucket.put(exploreLikeR2QueueKey042(next.batchId), JSON.stringify(row), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { createdAt: String(next.batchAt), mutationCount: String(next.payload.length) },
  });
  return { batchId: next.batchId, inserted: true, queue: 'r2-042' };
}`);

replaceFunction('processExploreLikeBatches035', `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));

  // R2 is checked before touching D1. With no actual likes pending, the 10-minute
  // scheduler performs zero D1 reads and zero D1 writes.
  let pending = await readExploreLikeR2QueueWave042(env, now);
  if (!pending.length) {
    const idle = { waves: 0, processedBatches: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, queue: 'r2-042', d1Idle: true };
    console.log('[SORIDRAW 042] like aggregate idle', JSON.stringify(idle));
    return idle;
  }

  const owner = 'like042_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease', queue: 'r2-042' };
  const totals = { waves: 0, processedBatches: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, queue: 'r2-042', d1Idle: false };
  try {
    for (let wave = 0; wave < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035; wave += 1) {
      if (!pending.length) break;
      const current = await processExploreLikeR2QueueWave042(env, pending, Date.now());
      totals.waves += 1;
      totals.processedBatches += current.processedBatches;
      totals.insertedLikes += current.insertedLikes;
      totals.deletedLikes += current.deletedLikes;
      totals.changedTracks += current.positiveTracks + current.negativeTracks;
      if (wave + 1 < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035) {
        pending = await readExploreLikeR2QueueWave042(env, now);
      }
    }
    console.log('[SORIDRAW 042] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
  }
}`);

const routeAnchor = `    if (url.pathname === "/v1/me/following-bundle" && request.method === "GET") {\n      return await handleMyFollowingR2Bundle(request, env, cors);\n    }`;
if (!source.includes(routeAnchor)) throw new Error('[042] following-bundle route anchor missing');
source = source.replace(routeAnchor, `    if (url.pathname === "/v1/me/social-snapshot" && request.method === "GET") {\n      return await handleMySocialSnapshot042(request, env, cors);\n    }\n${routeAnchor}`, 1);

for (const required of [
  marker,
  "EXPLORE_LIKE_R2_QUEUE_PREFIX_042 = 'internal/explore/like-queue-v2/'",
  "queue: 'r2-042'",
  'readExploreLikeR2QueueWave042',
  'processExploreLikeR2QueueWave042',
  'handleMySocialSnapshot042',
  'url.pathname === "/v1/me/social-snapshot"',
  "source: 'r2-social-042'",
  'd1Idle: true',
]) {
  if (!source.includes(required)) throw new Error(`[042] verification missing: ${required}`);
}
if (functionRange('enqueueExploreLikeBatch035').text.includes('INSERT OR IGNORE INTO explore_like_batches_069')) {
  throw new Error('[042] D1 like intake queue write still active');
}
if (functionRange('processExploreLikeBatches035').text.includes('hasExploreLikeQueue069040')) {
  throw new Error('[042] scheduled aggregate still probes D1 queue on idle path');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[042] R2 transient like queue + unified personal social snapshot prepared.');
