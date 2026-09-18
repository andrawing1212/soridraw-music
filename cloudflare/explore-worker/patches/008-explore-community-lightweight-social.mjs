import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_COMMUNITY_LIGHTWEIGHT_SOCIAL_008';
const alreadyApplied = source.includes(marker) || (
  source.includes('adjustExploreFollowCountersDelta') &&
  source.includes('adjustExploreLikeCounterDelta') &&
  source.includes('handleMyFollowStates') &&
  source.includes('handleProfileConnections')
);
if (alreadyApplied) {
  console.log('[SORIDRAW Worker] Explore lightweight social backend already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`008 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`008 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`008 unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const helperAnchor = 'async function handleFollowState(request, env, cors, targetUid) {';
if (!source.includes(helperAnchor)) throw new Error('008 follow-state anchor missing');

const helpers = `// ${marker}
function clampExploreSocialCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function adjustExploreFollowCountersDelta(env, followerUid, followingUid, shouldFollow, now) {
  const delta = shouldFollow ? 1 : -1;
  if (shouldFollow) {
    await env.DB.batch([
      env.DB.prepare(\`
        INSERT INTO profile_stats (uid, follower_count, following_count, updated_at)
        VALUES (?, 0, 0, ?)
        ON CONFLICT(uid) DO NOTHING
      \`).bind(followerUid, now),
      env.DB.prepare(\`
        INSERT INTO profile_stats (uid, follower_count, following_count, updated_at)
        VALUES (?, 0, 0, ?)
        ON CONFLICT(uid) DO NOTHING
      \`).bind(followingUid, now),
      env.DB.prepare(\`
        INSERT OR IGNORE INTO follows (follower_uid, following_uid, created_at)
        VALUES (?, ?, ?)
      \`).bind(followerUid, followingUid, now),
      env.DB.prepare(\`
        UPDATE profile_stats
        SET following_count = following_count + 1, updated_at = ?
        WHERE uid = ?
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_uid = ? AND following_uid = ? AND created_at = ?
          )
      \`).bind(now, followerUid, followerUid, followingUid, now),
      env.DB.prepare(\`
        UPDATE profile_stats
        SET follower_count = follower_count + 1, updated_at = ?
        WHERE uid = ?
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_uid = ? AND following_uid = ? AND created_at = ?
          )
      \`).bind(now, followingUid, followerUid, followingUid, now)
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(\`
        UPDATE profile_stats
        SET following_count = MAX(0, following_count - 1), updated_at = ?
        WHERE uid = ?
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_uid = ? AND following_uid = ?
          )
      \`).bind(now, followerUid, followerUid, followingUid),
      env.DB.prepare(\`
        UPDATE profile_stats
        SET follower_count = MAX(0, follower_count - 1), updated_at = ?
        WHERE uid = ?
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_uid = ? AND following_uid = ?
          )
      \`).bind(now, followingUid, followerUid, followingUid),
      env.DB.prepare(\`
        DELETE FROM follows WHERE follower_uid = ? AND following_uid = ?
      \`).bind(followerUid, followingUid)
    ]);
  }

  const result = await env.DB.prepare(\`
    SELECT uid, follower_count, following_count
    FROM profile_stats
    WHERE uid IN (?, ?)
  \`).bind(followerUid, followingUid).all();
  const rows = result.results || [];
  const byUid = new Map(rows.map((row) => [String(row.uid || ''), row]));
  return {
    follower: byUid.get(String(followerUid)) || null,
    following: byUid.get(String(followingUid)) || null,
    delta
  };
}

async function patchExploreFirstViewFollowCounts(env, followerUid, followingUid, stats, now) {
  try {
    const statements = [];
    if (stats?.follower) {
      statements.push(env.DB.prepare(\`
        UPDATE public_profile_first_views
        SET payload_json = json_set(
              payload_json,
              '$.profile.followingCount',
              ?
            ),
            revision = revision + 1,
            updated_at = ?
        WHERE uid = ?
      \`).bind(clampExploreSocialCount(stats.follower.following_count), now, followerUid));
    }
    if (stats?.following) {
      statements.push(env.DB.prepare(\`
        UPDATE public_profile_first_views
        SET payload_json = json_set(
              payload_json,
              '$.profile.followerCount',
              ?
            ),
            revision = revision + 1,
            updated_at = ?
        WHERE uid = ?
      \`).bind(clampExploreSocialCount(stats.following.follower_count), now, followingUid));
    }
    if (statements.length) await env.DB.batch(statements);
  } catch (error) {
    console.warn('[SORIDRAW social] first-view follow counter patch skipped:', String(error?.message || error || 'unknown'));
  }
}

async function adjustExploreLikeCounterDelta(env, trackId, userUid, shouldLike, now) {
  if (shouldLike) {
    await env.DB.batch([
      env.DB.prepare(\`
        INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)
        VALUES (?, 0, 0, 0, ?)
        ON CONFLICT(track_id) DO NOTHING
      \`).bind(trackId, now),
      env.DB.prepare(\`
        INSERT OR IGNORE INTO likes (track_id, user_uid, created_at)
        VALUES (?, ?, ?)
      \`).bind(trackId, userUid, now),
      env.DB.prepare(\`
        UPDATE track_stats
        SET like_count = like_count + 1, updated_at = ?
        WHERE track_id = ?
          AND EXISTS (
            SELECT 1 FROM likes
            WHERE track_id = ? AND user_uid = ? AND created_at = ?
          )
      \`).bind(now, trackId, trackId, userUid, now)
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(\`
        UPDATE track_stats
        SET like_count = MAX(0, like_count - 1), updated_at = ?
        WHERE track_id = ?
          AND EXISTS (
            SELECT 1 FROM likes
            WHERE track_id = ? AND user_uid = ?
          )
      \`).bind(now, trackId, trackId, userUid),
      env.DB.prepare(\`
        DELETE FROM likes WHERE track_id = ? AND user_uid = ?
      \`).bind(trackId, userUid)
    ]);
  }

  const stat = await env.DB.prepare(\`
    SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1
  \`).bind(trackId).first();
  return clampExploreSocialCount(stat?.like_count);
}

async function patchExploreFirstViewLikeCount(env, ownerUid, trackId, likeCount, now) {
  try {
    await env.DB.prepare(\`
      UPDATE public_profile_first_views
      SET payload_json = (
            SELECT json_set(
              public_profile_first_views.payload_json,
              '$.items[' || item.key || '].likeCount',
              ?
            )
            FROM json_each(public_profile_first_views.payload_json, '$.items') AS item
            WHERE json_extract(item.value, '$.id') = ?
            LIMIT 1
          ),
          revision = revision + 1,
          updated_at = ?
      WHERE uid = ?
        AND EXISTS (
          SELECT 1
          FROM json_each(public_profile_first_views.payload_json, '$.items') AS item
          WHERE json_extract(item.value, '$.id') = ?
        )
    \`).bind(likeCount, trackId, now, ownerUid, trackId).run();
  } catch (error) {
    console.warn('[SORIDRAW social] first-view like counter patch skipped:', String(error?.message || error || 'unknown'));
  }
}

async function handleMyFollowStates(request, url, env, cors) {
  const authContext = await requireExploreAuth(request);
  const raw = String(url.searchParams.get('uids') || '');
  const uids = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 50);
  if (!uids.length) return json({ ok: true, data: { followingUids: [] } }, 200, cors);
  const placeholders = uids.map(() => '?').join(',');
  const result = await env.DB.prepare(\`
    SELECT following_uid
    FROM follows
    WHERE follower_uid = ? AND following_uid IN (\${placeholders})
  \`).bind(authContext.uid, ...uids).all();
  return json({
    ok: true,
    data: {
      followingUids: (result.results || []).map((row) => String(row.following_uid || '')).filter(Boolean)
    }
  }, 200, cors);
}

async function handleProfileConnections(request, url, env, cors, profileRef, direction) {
  const resolved = await resolvePublicProfileRef(env, profileRef);
  if (!resolved?.uid) return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);
  const limit = Math.min(30, getPageSize(url));
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  const bindings = [resolved.uid];
  let cursorSql = '';
  if (cursor) {
    const followedAt = Number(cursor.followedAt);
    const uid = safeString(cursor.uid);
    if (Number.isFinite(followedAt) && uid) {
      const personColumn = direction === 'followers' ? 'f.follower_uid' : 'f.following_uid';
      cursorSql = \`AND (f.created_at < ? OR (f.created_at = ? AND \${personColumn} < ?))\`;
      bindings.push(followedAt, followedAt, uid);
    }
  }

  const personColumn = direction === 'followers' ? 'f.follower_uid' : 'f.following_uid';
  const ownerColumn = direction === 'followers' ? 'f.following_uid' : 'f.follower_uid';
  const result = await env.DB.prepare(\`
    SELECT p.uid, p.nickname, p.handle, p.avatar_url, p.bio,
      f.created_at AS followed_at,
      COALESCE(ps.follower_count, 0) AS follower_count,
      COALESCE(ps.following_count, 0) AS following_count
    FROM follows f
    JOIN public_profiles p ON p.uid = \${personColumn} AND p.is_public = 1
    LEFT JOIN profile_stats ps ON ps.uid = p.uid
    WHERE \${ownerColumn} = ? \${cursorSql}
    ORDER BY f.created_at DESC, \${personColumn} DESC
    LIMIT ?
  \`).bind(...bindings, limit + 1).all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const items = visible.map((row) => ({
    uid: String(row.uid || ''),
    nickname: String(row.nickname || ''),
    handle: String(row.handle || ''),
    avatarUrl: String(row.avatar_url || ''),
    bio: String(row.bio || ''),
    followerCount: clampExploreSocialCount(row.follower_count),
    followingCount: clampExploreSocialCount(row.following_count),
    followedAt: Number(row.followed_at || 0)
  }));
  const last = visible[visible.length - 1];
  return json({
    ok: true,
    data: {
      items,
      nextCursor: hasMore && last
        ? encodeCursor({ followedAt: Number(last.followed_at || 0), uid: String(last.uid || '') })
        : null
    }
  }, 200, cors);
}

`;
source = source.replace(helperAnchor, helpers + helperAnchor);

replaceFunction('handleFollow', `async function handleFollow(request, env, cors, targetUid, shouldFollow) {
  const authContext = await requireExploreAuth(request);
  await enforceUserRateLimit(env, authContext.uid, "follow", RATE_LIMITS.follow);
  if (!targetUid || targetUid === authContext.uid) throwApi("SELF_FOLLOW_NOT_ALLOWED", "자기 자신은 팔로우할 수 없습니다.", 400);

  if (shouldFollow) {
    const target = await env.DB.prepare(\`
      SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1
    \`).bind(targetUid).first();
    if (!target) throwApi("NOT_FOUND", "공개 크리에이터를 찾을 수 없습니다.", 404);
  }

  const now = Date.now();
  const stats = await adjustExploreFollowCountersDelta(env, authContext.uid, targetUid, shouldFollow, now);
  await patchExploreFirstViewFollowCounts(env, authContext.uid, targetUid, stats, now);

  return json({ ok: true, data: {
    uid: targetUid,
    following: shouldFollow,
    followerCount: clampExploreSocialCount(stats?.following?.follower_count),
    followingCount: clampExploreSocialCount(stats?.following?.following_count)
  } }, 200, cors);
}`);

replaceFunction('handleLike', `async function handleLike(request, env, cors, trackId, shouldLike) {
  const authContext = await requireExploreAuth(request);
  await enforceUserRateLimit(env, authContext.uid, "like", RATE_LIMITS.like);
  const track = await getPublicTrackForWrite(env, trackId);
  const now = Date.now();
  const likeCount = await adjustExploreLikeCounterDelta(env, trackId, authContext.uid, shouldLike, now);
  if (track?.owner_uid) {
    await patchExploreFirstViewLikeCount(env, track.owner_uid, trackId, likeCount, now);
  }
  return json({
    ok: true,
    data: { trackId, liked: shouldLike, likeCount }
  }, 200, cors);
}`);

// Keep rate-limit retention bounded without occasionally deleting an unbounded
// number of D1 rows from a single social click.
const rateRange = functionRange('enforceUserRateLimit');
const oldCleanup = `  if (count === 1 && Math.floor(windowStart / windowMs) % 6 === 0) {
    await env.DB.prepare(
      "DELETE FROM api_rate_limits WHERE updated_at < ?"
    ).bind(now - 48 * 60 * 60 * 1e3).run();
  }`;
const newCleanup = `  if (count === 1 && Math.floor(windowStart / windowMs) % 6 === 0) {
    await env.DB.prepare(\`
      DELETE FROM api_rate_limits
      WHERE (scope, subject, action, window_start) IN (
        SELECT scope, subject, action, window_start
        FROM api_rate_limits
        WHERE updated_at < ?
        ORDER BY updated_at ASC
        LIMIT 8
      )
    \`).bind(now - 48 * 60 * 60 * 1e3).run();
  }`;
if (!rateRange.text.includes(oldCleanup)) throw new Error('008 rate-limit cleanup anchor missing');
source = source.slice(0, rateRange.start) + rateRange.text.replace(oldCleanup, newCleanup) + source.slice(rateRange.end);

const myLikesRoute = `    if (url.pathname === "/v1/me/likes" && request.method === "GET") {
      return await handleMyLikeStates(request, url, env, cors);
    }`;
if (!source.includes(myLikesRoute)) throw new Error('008 /v1/me/likes route anchor missing');
source = source.replace(myLikesRoute, `${myLikesRoute}
    if (url.pathname === "/v1/me/follows" && request.method === "GET") {
      return await handleMyFollowStates(request, url, env, cors);
    }`);

const followStateRoute = `    if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "follow-state") {
      return await handleFollowState(request, env, cors, decodeURIComponent(segments[2]));
    }`;
if (!source.includes(followStateRoute)) throw new Error('008 follow-state route anchor missing');
source = source.replace(followStateRoute, `    if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "followers") {
      return await handleProfileConnections(request, url, env, cors, decodeURIComponent(segments[2]), "followers");
    }
    if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "following") {
      return await handleProfileConnections(request, url, env, cors, decodeURIComponent(segments[2]), "following");
    }
${followStateRoute}`);

const required = [
  marker,
  'adjustExploreFollowCountersDelta',
  'adjustExploreLikeCounterDelta',
  'patchExploreFirstViewFollowCounts',
  'patchExploreFirstViewLikeCount',
  'handleMyFollowStates',
  'handleProfileConnections',
  '/v1/me/follows',
  'segments[3] === "followers"',
  'segments[3] === "following"',
  'LIMIT 8',
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`008 verification failed: ${needle}`);
}

const followBody = functionRange('handleFollow').text;
if (followBody.includes('refreshFollowStats') || followBody.includes('refreshPublicProfileFirstViewProfile')) {
  throw new Error('008 heavy follow refresh path still present');
}
const likeBody = functionRange('handleLike').text;
if (likeBody.includes('refreshLikeCount') || likeBody.includes('patchPublicProfileFirstViewLikeCount(')) {
  throw new Error('008 heavy like refresh path still present');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Explore community lightweight social backend prepared.');
