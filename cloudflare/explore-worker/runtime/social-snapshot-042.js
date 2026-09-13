// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_R2_QUEUE_042_20260913
const EXPLORE_LIKE_R2_QUEUE_PREFIX_042 = 'internal/explore/like-queue-v2/';
const EXPLORE_LIKE_R2_QUEUE_LIST_LIMIT_042 = 500;
const EXPLORE_LIKE_R2_QUEUE_MAX_MUTATIONS_042 = 3000;

function exploreLikeR2QueueKey042(batchId) {
  return EXPLORE_LIKE_R2_QUEUE_PREFIX_042 + encodeURIComponent(String(batchId || '')) + '.json';
}

async function readExploreLikeR2QueueWave042(env, cutoff) {
  const bucket = exploreCacheBucket031(env);
  if (!bucket) return [];
  const listed = await bucket.list({
    prefix: EXPLORE_LIKE_R2_QUEUE_PREFIX_042,
    limit: EXPLORE_LIKE_R2_QUEUE_LIST_LIMIT_042,
  });
  const objects = Array.isArray(listed?.objects) ? listed.objects : [];
  if (!objects.length) return [];

  const loaded = [];
  for (let offset = 0; offset < objects.length; offset += 20) {
    const chunk = objects.slice(offset, offset + 20);
    const rows = await Promise.all(chunk.map(async (entry) => {
      try {
        const object = await bucket.get(entry.key);
        if (!object) return null;
        const row = JSON.parse(await object.text());
        const batchId = String(row?.batchId || '').trim();
        const userUid = String(row?.userUid || '').trim();
        const createdAt = Math.max(0, Math.floor(Number(row?.createdAt || 0)));
        const mutations = Array.isArray(row?.mutations) ? row.mutations : [];
        if (
          Number(row?.schemaVersion) !== 1
          || !batchId
          || !userUid
          || !createdAt
          || createdAt > cutoff
          || !mutations.length
        ) return null;
        const normalized = mutations
          .map((item) => ({
            trackId: String(item?.trackId || '').trim(),
            liked: Boolean(item?.liked),
          }))
          .filter((item) => item.trackId);
        if (!normalized.length) return null;
        return { key: entry.key, batchId, userUid, createdAt, mutations: normalized };
      } catch (error) {
        console.warn(
          '[SORIDRAW 042] invalid R2 like queue object',
          entry.key,
          String(error?.message || error || 'unknown'),
        );
        return null;
      }
    }));
    loaded.push(...rows.filter(Boolean));
  }

  loaded.sort((a, b) => a.createdAt - b.createdAt || a.batchId.localeCompare(b.batchId));
  const selected = [];
  let mutationCount = 0;
  for (const row of loaded) {
    if (mutationCount + row.mutations.length > EXPLORE_LIKE_R2_QUEUE_MAX_MUTATIONS_042) break;
    selected.push(row);
    mutationCount += row.mutations.length;
  }
  return selected;
}

function exploreLikeR2InputCte042() {
  return `
    WITH expanded AS (
      SELECT
        TRIM(CAST(json_extract(j.value, '$.batchId') AS TEXT)) AS batch_id,
        TRIM(CAST(json_extract(j.value, '$.userUid') AS TEXT)) AS user_uid,
        CAST(json_extract(j.value, '$.createdAt') AS INTEGER) AS created_at,
        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
        CASE WHEN CAST(json_extract(j.value, '$.desiredLiked') AS INTEGER) <> 0 THEN 1 ELSE 0 END AS desired_liked
      FROM json_each(?) AS j
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
        WHERE user_uid <> '' AND track_id <> ''
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

async function processExploreLikeR2QueueWave042(env, rows, now) {
  if (!rows.length) {
    return {
      positiveTracks: 0,
      negativeTracks: 0,
      insertedLikes: 0,
      deletedLikes: 0,
      processedBatches: 0,
    };
  }

  const flattened = [];
  for (const row of rows) {
    for (const mutation of row.mutations) {
      flattened.push({
        batchId: row.batchId,
        userUid: row.userUid,
        createdAt: row.createdAt,
        trackId: mutation.trackId,
        desiredLiked: mutation.liked ? 1 : 0,
      });
    }
  }

  const payload = JSON.stringify(flattened);
  const cte = exploreLikeR2InputCte042();
  const result = await env.DB.batch([
    env.DB.prepare(cte + `
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    `).bind(payload, now),
    env.DB.prepare(cte + `
      UPDATE track_stats
      SET like_count = MAX(0, like_count + COALESCE((
            SELECT SUM(d.delta) FROM deltas d WHERE d.track_id = track_stats.track_id
          ), 0)),
          updated_at = ?
      WHERE track_id IN (
        SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0
      )
    `).bind(payload, now),
    env.DB.prepare(cte + `
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at FROM latest WHERE desired_liked = 1
    `).bind(payload),
    env.DB.prepare(cte + `
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid FROM latest WHERE desired_liked = 0
      )
    `).bind(payload),
  ]);

  const bucket = exploreCacheBucket031(env);
  for (let offset = 0; offset < rows.length; offset += 20) {
    const chunk = rows.slice(offset, offset + 20);
    await Promise.all(chunk.map((row) => bucket.delete(row.key)));
  }

  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    processedBatches: rows.length,
  };
}

async function handleMySocialSnapshot042(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let [likedIds, followingUids] = await Promise.all([
    readExploreLikeR2Bundle(env, authContext.uid),
    readExploreFollowingR2Bundle(env, authContext.uid),
  ]);

  if (!likedIds || !followingUids) {
    await Promise.all([
      likedIds ? Promise.resolve() : rebuildExploreLikeR2Bundle(env, authContext.uid),
      followingUids ? Promise.resolve() : rebuildExploreFollowingR2Bundle(env, authContext.uid),
    ]);
    [likedIds, followingUids] = await Promise.all([
      readExploreLikeR2Bundle(env, authContext.uid),
      readExploreFollowingR2Bundle(env, authContext.uid),
    ]);
  }

  if (!likedIds || !followingUids) {
    return json({ ok: false, error: 'SOCIAL_SNAPSHOT_UNAVAILABLE' }, 503, cors);
  }

  return json({
    ok: true,
    data: {
      schemaVersion: 1,
      likedTrackIds: [...likedIds],
      followingUids: [...followingUids],
      source: 'r2-social-042',
      updatedAt: Date.now(),
    },
  }, 200, cors);
}
