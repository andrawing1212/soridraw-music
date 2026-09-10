import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911';
if (source.includes(marker)) {
  console.log('[034] Explore user-level like batch already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[034] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[034] function body missing: ${name}`);
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
  throw new Error(`[034] unterminated function: ${name}`);
};

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_DEFERRED_DERIVED_SYNC_033_20260910',
  'requireExploreAuth',
  'getPublicTrackForWrite',
  'adjustExploreLikeCounterDelta',
  'exploreRateDb031',
  'readExploreLikeR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'writeExploreR2Json',
  'exploreLikeR2Key',
]) {
  if (!source.includes(required)) throw new Error(`[034] required runtime behavior missing: ${required}`);
}

const helpers = `// ${marker}
const EXPLORE_LIKE_BATCH_MAX_034 = 50;

async function enforceExploreLikeBatchRateLimit034(env, uid, weight) {
  const db = exploreRateDb031(env);
  const limit = Number(RATE_LIMITS?.like || 0);
  const countWeight = Math.max(1, Math.min(EXPLORE_LIKE_BATCH_MAX_034, Math.floor(Number(weight || 1))));
  if (!db || !uid || !Number.isFinite(limit) || limit <= 0) return;
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const result = await db.prepare(\`
    INSERT INTO api_rate_limits (scope, subject, action, window_start, count, updated_at)
    VALUES ('user', ?, 'like', ?, ?, ?)
    ON CONFLICT(scope, subject, action, window_start) DO UPDATE SET
      count = api_rate_limits.count + excluded.count,
      updated_at = excluded.updated_at
    RETURNING count
  \`).bind(uid, windowStart, countWeight, now).all();
  const count = Number(result?.results?.[0]?.count || 0);
  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1e3));
    throwApi('RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': String(retryAfter) });
  }
  if (count === countWeight && Math.floor(windowStart / RATE_LIMIT_WINDOW_MS) % 6 === 0) {
    await db.prepare(\`
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
}

async function syncExploreLikeR2AfterBatch034(env, uid, results) {
  let likedIds = await readExploreLikeR2Bundle(env, uid);
  if (!likedIds) {
    await rebuildExploreLikeR2Bundle(env, uid);
    return;
  }
  for (const result of results) {
    const trackId = String(result?.trackId || '');
    if (!trackId) continue;
    if (result?.liked) likedIds.add(trackId);
    else likedIds.delete(trackId);
  }
  await writeExploreR2Json(env, exploreLikeR2Key(uid), {
    schemaVersion: EXPLORE_R2_LIKE_SCHEMA_VERSION,
    uid: String(uid || ''),
    updatedAt: Date.now(),
    likedTrackIds: [...likedIds].filter(Boolean).slice(0, 2000)
  });
}

async function handleLikeBatch034(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '좋아요 묶음 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.mutations) ? body.mutations : [];
  if (!raw.length) return json({ ok: true, data: { results: [] } }, 200, cors);
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

  // Validate every target before the first mutation so a bad track cannot create a partial batch.
  for (const mutation of mutations) await getPublicTrackForWrite(env, mutation.trackId);

  const now = Date.now();
  const results = [];
  for (const mutation of mutations) {
    const likeCount = await adjustExploreLikeCounterDelta(env, mutation.trackId, authContext.uid, mutation.liked, now);
    results.push({ trackId: mutation.trackId, liked: mutation.liked, likeCount });
  }

  // One user-level R2 read/write per batch instead of one R2 PUT for every track.
  await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);
  return json({ ok: true, data: { results } }, 200, cors);
}

`;
const helperAnchor = functionRange('handleLike').start;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

const routeAnchor = '    if (url.pathname === "/v1/publications" && request.method === "POST") {';
if (!source.includes(routeAnchor)) throw new Error('[034] route anchor missing');
const route = `    if (url.pathname === "/v1/me/likes/batch" && request.method === "POST") {
      return await handleLikeBatch034(request, env, cors);
    }
`;
source = source.replace(routeAnchor, route + routeAnchor);

for (const required of [
  marker,
  'EXPLORE_LIKE_BATCH_MAX_034 = 50',
  'handleLikeBatch034(request, env, cors)',
  'enforceExploreLikeBatchRateLimit034',
  'syncExploreLikeR2AfterBatch034',
  'url.pathname === "/v1/me/likes/batch"',
]) {
  if (!source.includes(required)) throw new Error(`[034] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[034] Explore likes now accept one authenticated multi-track batch with one user R2 sync.');
