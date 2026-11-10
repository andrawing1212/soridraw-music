// APP540: review-only copy of canonical adjustExploreFollowCountersDelta.
// Only the owner profile_stats count write is extended to write an inline
// revision and reset retry metadata in the SAME D1 statement. The edge,
// actor following_count, order, result, no-op and fallback are retained.
// DO NOT import, route, enable, migrate or deploy to shared Workers/D1.
// This file cannot run against the existing non-migrated schema.
export const APP540_INLINE_CANONICAL_COMPILED_OPEN = false;

export async function adjustExploreFollowCountersDelta540(env, followerUid, followingUid, shouldFollow, now) {
  // SORIDRAW_FOLLOW_RETURNING_NO_POSTREAD_246_20260930
  const fallbackRead = async () => {
    const result = await env.DB.prepare(`
      SELECT uid, follower_count, following_count
      FROM profile_stats
      WHERE uid IN (?, ?)
    `).bind(followerUid, followingUid).all();
    const rows = result.results || [];
    const byUid = new Map(rows.map((row) => [String(row.uid || ""), row]));
    return {
      follower: byUid.get(String(followerUid)) || null,
      following: byUid.get(String(followingUid)) || null,
    };
  };

  if (shouldFollow) {
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT OR IGNORE INTO follows (follower_uid, following_uid, created_at)
        VALUES (?, ?, ?)
      `).bind(followerUid, followingUid, now),
      env.DB.prepare(`
        INSERT INTO profile_stats (uid, follower_count, following_count, updated_at)
        SELECT ?, 0, 1, ?
        WHERE EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ? AND created_at = ?
        )
        ON CONFLICT(uid) DO UPDATE SET
          following_count = profile_stats.following_count + 1,
          updated_at = excluded.updated_at
        RETURNING uid, follower_count, following_count
      `).bind(followerUid, now, followerUid, followingUid, now),
      env.DB.prepare(`
        INSERT INTO profile_stats (uid, follower_count, following_count, updated_at,
          owner_follow_revision_530, owner_follow_attempts_530,
          owner_follow_next_at_530, owner_follow_dead_at_530)
        SELECT ?, 1, 0, ?, 1, 0, 0, 0
        WHERE EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ? AND created_at = ?
        )
        ON CONFLICT(uid) DO UPDATE SET
          follower_count = profile_stats.follower_count + 1,
          updated_at = excluded.updated_at,
          owner_follow_revision_530 = profile_stats.owner_follow_revision_530 + 1,
          owner_follow_attempts_530 = 0,
          owner_follow_next_at_530 = 0,
          owner_follow_dead_at_530 = 0
        RETURNING uid, follower_count, following_count
      `).bind(followingUid, now, followerUid, followingUid, now)
    ]);
    const follower = results?.[1]?.results?.[0] || null;
    const following = results?.[2]?.results?.[0] || null;
    if (follower && following) return { follower, following, delta: 1 };
    const fallback = await fallbackRead();
    return { ...fallback, delta: 0 };
  }

  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE profile_stats
      SET following_count = MAX(0, following_count - 1), updated_at = ?
      WHERE uid = ?
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ?
        )
      RETURNING uid, follower_count, following_count
    `).bind(now, followerUid, followerUid, followingUid),
    env.DB.prepare(`
      UPDATE profile_stats
      SET follower_count = MAX(0, follower_count - 1),
          owner_follow_revision_530 = owner_follow_revision_530
            + CASE WHEN follower_count > 0 THEN 1 ELSE 0 END,
          owner_follow_attempts_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_attempts_530 END,
          owner_follow_next_at_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_next_at_530 END,
          owner_follow_dead_at_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_dead_at_530 END,
          updated_at = ?
      WHERE uid = ?
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ?
        )
      RETURNING uid, follower_count, following_count
    `).bind(now, followingUid, followerUid, followingUid),
    env.DB.prepare(`
      DELETE FROM follows WHERE follower_uid = ? AND following_uid = ?
    `).bind(followerUid, followingUid)
  ]);
  const follower = results?.[0]?.results?.[0] || null;
  const following = results?.[1]?.results?.[0] || null;
  if (follower && following) return { follower, following, delta: -1 };
  const fallback = await fallbackRead();
  return { ...fallback, delta: 0 };
}
