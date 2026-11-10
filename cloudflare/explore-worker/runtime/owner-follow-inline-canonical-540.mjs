// APP540: review-only copy of canonical adjustExploreFollowCountersDelta.
// Only the owner profile_stats count write is extended to write an inline
// revision and reset retry metadata in the SAME D1 statement. The edge,
// actor following_count, order, result, no-op and fallback are retained.
// DO NOT import, route, enable, migrate or deploy to shared Workers/D1.
// This file cannot run against the existing non-migrated schema.
// APP541: expected epoch must come from a verified server-side target Auth claim;
// the browser MUST NOT provide this authority. Missing target enrollment HOLD.
export const APP540_INLINE_CANONICAL_COMPILED_OPEN = false;

export async function adjustExploreFollowCountersDelta540(env, followerUid, followingUid, shouldFollow, now, expectedOwnerEpoch) {
  if (typeof expectedOwnerEpoch !== 'string' || !/^[0-9a-f]{32}$/.test(expectedOwnerEpoch))
    throw Error('APP540_TRUSTED_OWNER_EPOCH_REQUIRED');
  // SORIDRAW_FOLLOW_RETURNING_NO_POSTREAD_246_20260930
  const fallbackRead = async () => {
    const result = await env.DB.prepare(`
      SELECT uid, follower_count, following_count, owner_follow_auth_epoch_532
      FROM profile_stats
      WHERE uid IN (?, ?)
    `).bind(followerUid, followingUid).all();
    const rows = result.results || [];
    const byUid = new Map(rows.map((row) => [String(row.uid || ""), row]));
    if (byUid.get(String(followingUid))?.owner_follow_auth_epoch_532 !== expectedOwnerEpoch)
      throw Error('APP540_OWNER_EPOCH_MISMATCH');
    return {
      follower: byUid.get(String(followerUid)) || null,
      following: byUid.get(String(followingUid)) || null,
    };
  };

  if (shouldFollow) {
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT OR IGNORE INTO follows (follower_uid, following_uid, created_at)
        SELECT ?, ?, ? WHERE EXISTS (
          SELECT 1 FROM profile_stats
          WHERE uid = ? AND owner_follow_auth_epoch_532 = ?
        )
      `).bind(followerUid, followingUid, now, followingUid, expectedOwnerEpoch),
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
        UPDATE profile_stats SET
          follower_count = follower_count + 1,
          updated_at = ?,
          owner_follow_revision_530 = owner_follow_revision_530 + 1,
          owner_follow_attempts_530 = 0,
          owner_follow_next_at_530 = 0,
          owner_follow_dead_at_530 = 0
        WHERE uid = ? AND owner_follow_auth_epoch_532 = ?
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_uid = ? AND following_uid = ? AND created_at = ?
          )
        RETURNING uid, follower_count, following_count
      `).bind(now, followingUid, expectedOwnerEpoch,
        followerUid, followingUid, now)
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
          SELECT 1 FROM profile_stats
          WHERE uid = ? AND owner_follow_auth_epoch_532 = ?
        )
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ?
        )
      RETURNING uid, follower_count, following_count
    `).bind(now, followerUid, followingUid, expectedOwnerEpoch,
      followerUid, followingUid),
    env.DB.prepare(`
      UPDATE profile_stats
      SET follower_count = MAX(0, follower_count - 1),
          owner_follow_revision_530 = owner_follow_revision_530
            + CASE WHEN follower_count > 0 THEN 1 ELSE 0 END,
          owner_follow_attempts_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_attempts_530 END,
          owner_follow_next_at_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_next_at_530 END,
          owner_follow_dead_at_530 = CASE WHEN follower_count > 0 THEN 0 ELSE owner_follow_dead_at_530 END,
          updated_at = ?
      WHERE uid = ? AND owner_follow_auth_epoch_532 = ?
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follower_uid = ? AND following_uid = ?
        )
      RETURNING uid, follower_count, following_count
    `).bind(now, followingUid, expectedOwnerEpoch, followerUid, followingUid),
    env.DB.prepare(`
      DELETE FROM follows WHERE follower_uid = ? AND following_uid = ?
        AND EXISTS (
          SELECT 1 FROM profile_stats
          WHERE uid = ? AND owner_follow_auth_epoch_532 = ?
        )
    `).bind(followerUid, followingUid, followingUid, expectedOwnerEpoch)
  ]);
  const follower = results?.[0]?.results?.[0] || null;
  const following = results?.[1]?.results?.[0] || null;
  if (follower && following) return { follower, following, delta: -1 };
  const fallback = await fallbackRead();
  return { ...fallback, delta: 0 };
}
