import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_O1_028_20260908';
if (source.includes(marker)) {
  console.log('[028] Explore like O(1) cost patch already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[028] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[028] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[028] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'handleLikeD1Core',
  'adjustExploreLikeCounterDelta',
  'patchExploreFirstViewLikeCount',
  'patchExploreProfileR2Like020',
  'syncExploreLikeR2AfterMutation',
  'patchExploreFeedR2LikeCount',
  'X-SORIDRAW-D1-Read-Queries',
  'X-SORIDRAW-D1-Write-Queries',
]) {
  if (!source.includes(required)) throw new Error(`[028] required runtime behavior missing: ${required}`);
}

// One D1 write query now performs the rate-limit increment and returns the count.
// The previous implementation performed a write followed by a separate SELECT on
// every social mutation. Cleanup remains bounded and rare.
replaceFunction('enforceUserRateLimit', `async function enforceUserRateLimit(env, uid, action, limit, windowMs = RATE_LIMIT_WINDOW_MS) {
  if (!env?.DB || !uid || !action || !Number.isFinite(limit) || limit <= 0) return;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await env.DB.prepare(\`
    INSERT INTO api_rate_limits (scope, subject, action, window_start, count, updated_at)
    VALUES ('user', ?, ?, ?, 1, ?)
    ON CONFLICT(scope, subject, action, window_start) DO UPDATE SET
      count = api_rate_limits.count + 1,
      updated_at = excluded.updated_at
    RETURNING count
  \`).bind(uid, action, windowStart, now).all();
  const count = Number(result?.results?.[0]?.count || 0);
  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1e3));
    throwApi(
      "RATE_LIMITED",
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      429,
      { "Retry-After": String(retryAfter) }
    );
  }
  if (count === 1 && Math.floor(windowStart / windowMs) % 6 === 0) {
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
  }
}`);

// Normal like/unlike now uses exactly two D1 mutation statements after validation:
// 1) the relation row, 2) the aggregate counter. The aggregate statement returns
// the resulting count, eliminating the old SELECT. Duplicate/idempotent requests
// use one bounded fallback read and never adjust the counter twice.
replaceFunction('adjustExploreLikeCounterDelta', `async function adjustExploreLikeCounterDelta(env, trackId, userUid, shouldLike, now) {
  const mutation = shouldLike
    ? await env.DB.prepare(\`
        INSERT OR IGNORE INTO likes (track_id, user_uid, created_at)
        VALUES (?, ?, ?)
      \`).bind(trackId, userUid, now).run()
    : await env.DB.prepare(\`
        DELETE FROM likes WHERE track_id = ? AND user_uid = ?
      \`).bind(trackId, userUid).run();

  const changed = Number(mutation?.meta?.changes || 0) > 0;
  if (!changed) {
    const stat = await env.DB.prepare(\`
      SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1
    \`).bind(trackId).first();
    return clampExploreSocialCount(stat?.like_count);
  }

  const delta = shouldLike ? 1 : -1;
  const initial = shouldLike ? 1 : 0;
  const result = await env.DB.prepare(\`
    INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)
    VALUES (?, ?, 0, 0, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      like_count = MAX(0, track_stats.like_count + ?),
      updated_at = excluded.updated_at
    RETURNING like_count
  \`).bind(trackId, initial, now, delta).all();
  return clampExploreSocialCount(result?.results?.[0]?.like_count);
}`);

const handle = functionRange('handleLikeD1Core').text;
if (!handle.includes('getPublicTrackForWrite')) throw new Error('[028] public-track validation guard unexpectedly missing');
if (!handle.includes('adjustExploreLikeCounterDelta')) throw new Error('[028] like-counter call missing');

const rate = functionRange('enforceUserRateLimit').text;
if (!rate.includes('RETURNING count')) throw new Error('[028] rate-limit RETURNING count missing');
if (/SELECT\s+count\s+FROM\s+api_rate_limits/i.test(rate)) throw new Error('[028] separate rate-limit SELECT still present');
const like = functionRange('adjustExploreLikeCounterDelta').text;
if (!like.includes('RETURNING like_count')) throw new Error('[028] like counter RETURNING missing');
if (like.includes('env.DB.batch')) throw new Error('[028] old multi-statement like batch still present');
if ((like.match(/SELECT like_count FROM track_stats/g) || []).length !== 1) throw new Error('[028] only idempotent fallback may read track_stats');

source = source.slice(0, functionRange('handleLikeD1Core').start) + `// ${marker}\n` + source.slice(functionRange('handleLikeD1Core').start);
writeFileSync(workerPath, source, 'utf8');
console.log('[028] Explore like normal path reduced from D1 read 3/write 4 to target read 1/write 3; duplicate requests use one bounded fallback read.');
