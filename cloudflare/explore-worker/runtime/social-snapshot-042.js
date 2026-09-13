// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_USER_QUEUE_042_20260913
const EXPLORE_LIKE_USER_QUEUE_MAX_MUTATIONS_075 = 50000;
const EXPLORE_LIKE_USER_QUEUE_MAX_WAVES_075 = 3;

function buildExploreLikeUserPatch075(mutations) {
  const patch = {};
  for (const row of mutations || []) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId) continue;
    patch[trackId] = {
      liked: row?.liked ? 1 : 0,
      mutationAt: Math.max(0, Math.floor(Number(row?.mutationAt || 0))),
    };
  }
  return patch;
}

async function enqueueExploreLikeUserQueue075(env, uid, mutations, now) {
  const patch = buildExploreLikeUserPatch075(mutations);
  const pendingCount = Object.keys(patch).length;
  if (!pendingCount) return { batchId: '', inserted: false, queue: 'user-075' };

  const processedCondition = `(
    explore_like_user_queue_075.updated_at < (
      SELECT processed_at FROM explore_like_user_queue_state_075 WHERE id = 1
    )
    OR (
      explore_like_user_queue_075.updated_at = (
        SELECT processed_at FROM explore_like_user_queue_state_075 WHERE id = 1
      )
      AND explore_like_user_queue_075.user_uid <= (
        SELECT processed_uid FROM explore_like_user_queue_state_075 WHERE id = 1
      )
    )
  )`;

  const payload = JSON.stringify(patch);
  const result = await env.DB.prepare(`
    INSERT INTO explore_like_user_queue_075(
      user_uid, updated_at, pending_count, mutations_json
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_uid) DO UPDATE SET
      mutations_json = CASE
        WHEN ${processedCondition} THEN excluded.mutations_json
        ELSE json_patch(explore_like_user_queue_075.mutations_json, excluded.mutations_json)
      END,
      pending_count = CASE
        WHEN ${processedCondition} THEN excluded.pending_count
        ELSE (
          SELECT COUNT(*)
          FROM json_each(json_patch(explore_like_user_queue_075.mutations_json, excluded.mutations_json))
        )
      END,
      updated_at = CASE
        WHEN excluded.updated_at > explore_like_user_queue_075.updated_at THEN excluded.updated_at
        ELSE explore_like_user_queue_075.updated_at + 1
      END
    RETURNING updated_at, pending_count
  `).bind(String(uid || ''), now, pendingCount, payload).first();

  const acceptedAt = Math.max(now, Number(result?.updated_at || now));
  return {
    batchId: `u075_${String(uid || '')}_${acceptedAt}`,
    inserted: true,
    queue: 'user-075',
    pendingCount: Number(result?.pending_count || pendingCount),
  };
}

function exploreLikeUserAggregateCte075() {
  return `
    WITH cursor AS (
      SELECT processed_at, processed_uid
      FROM explore_like_user_queue_state_075
      WHERE id = 1
    ),
    ordered AS (
      SELECT q.user_uid, q.updated_at, q.pending_count, q.mutations_json,
        SUM(q.pending_count) OVER (
          ORDER BY q.updated_at ASC, q.user_uid ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_mutations,
        ROW_NUMBER() OVER (
          ORDER BY q.updated_at ASC, q.user_uid ASC
        ) AS queue_row
      FROM (
        SELECT q.user_uid, q.updated_at, q.pending_count, q.mutations_json
        FROM explore_like_user_queue_075 q, cursor c
        WHERE (
          q.updated_at > c.processed_at
          OR (q.updated_at = c.processed_at AND q.user_uid > c.processed_uid)
        )
          AND q.updated_at <= ?
        ORDER BY q.updated_at ASC, q.user_uid ASC
        LIMIT 50000
      ) q
    ),
    eligible AS (
      SELECT user_uid, updated_at, pending_count, mutations_json
      FROM ordered
      WHERE running_mutations <= ? OR queue_row = 1
    ),
    expanded AS (
      SELECT
        e.user_uid,
        e.updated_at,
        TRIM(CAST(j.key AS TEXT)) AS track_id,
        CASE WHEN CAST(json_extract(j.value, '$.liked') AS INTEGER) <> 0 THEN 1 ELSE 0 END AS desired_liked,
        COALESCE(
          CAST(json_extract(j.value, '$.mutationAt') AS INTEGER),
          e.updated_at
        ) AS mutation_at
      FROM eligible e, json_each(e.mutations_json) AS j
      WHERE TRIM(CAST(j.key AS TEXT)) <> ''
    ),
    deltas AS (
      SELECT expanded.*,
        CASE
          WHEN expanded.desired_liked = 1 AND existing.user_uid IS NULL THEN 1
          WHEN expanded.desired_liked = 0 AND existing.user_uid IS NOT NULL THEN -1
          ELSE 0
        END AS delta
      FROM expanded
      LEFT JOIN likes existing
        ON existing.track_id = expanded.track_id
       AND existing.user_uid = expanded.user_uid
    )
  `;
}

async function hasExploreLikeUserQueuePending075(env, cutoff) {
  const row = await env.DB.prepare(`
    SELECT 1 AS pending
    FROM explore_like_user_queue_075 q
    JOIN explore_like_user_queue_state_075 s ON s.id = 1
    WHERE (
      q.updated_at > s.processed_at
      OR (q.updated_at = s.processed_at AND q.user_uid > s.processed_uid)
    )
      AND q.updated_at <= ?
    ORDER BY q.updated_at ASC, q.user_uid ASC
    LIMIT 1
  `).bind(cutoff).first();
  return Number(row?.pending || 0) === 1;
}

async function processExploreLikeUserQueueWave075(env, cutoff, now) {
  const cte = exploreLikeUserAggregateCte075();
  const max = EXPLORE_LIKE_USER_QUEUE_MAX_MUTATIONS_075;
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
      SELECT track_id, user_uid, mutation_at
      FROM expanded
      WHERE desired_liked = 1
    `).bind(cutoff, max),
    env.DB.prepare(cte + `
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid
        FROM expanded
        WHERE desired_liked = 0
      )
    `).bind(cutoff, max),
    env.DB.prepare(cte + `
      UPDATE explore_like_user_queue_state_075
      SET processed_at = COALESCE((
            SELECT updated_at FROM eligible
            ORDER BY updated_at DESC, user_uid DESC LIMIT 1
          ), processed_at),
          processed_uid = COALESCE((
            SELECT user_uid FROM eligible
            ORDER BY updated_at DESC, user_uid DESC LIMIT 1
          ), processed_uid)
      WHERE id = 1
        AND EXISTS (SELECT 1 FROM eligible)
    `).bind(cutoff, max),
  ]);

  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    advanced: Number(result?.[4]?.meta?.changes || 0) > 0,
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
