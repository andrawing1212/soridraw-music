import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SORIDRAW_TARGETED_PERSONAL_LIKE_SETTLEMENT_190_20260926
// Preserve app189's fail-closed queue/ETag proof, but when app184 supplies the
// historical unresolved track IDs, compare only those memberships against
// canonical D1 instead of scanning the user's whole liked catalog.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[090/190] SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_TARGETED_PERSONAL_LIKE_SETTLEMENT_190_20260926';
if (source.includes(marker)) {
  console.log('[090/190] targeted personal-like settlement already applied');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_PERSONAL_LIKE_FRESH_SETTLEMENT_189_20260924',
  'async function verifyFreshPersonalLikeSettlement189(env, uid) {',
  'async function readBoundedEffectiveLikeMemberships162(env, uid, trackIds) {',
  "new URL(request.url).searchParams.get('__soridraw_personal_settlement') === '189'",
]) {
  if (!source.includes(required)) throw new Error('[090/190] prerequisite missing: ' + required);
}

function functionRange(name) {
  const start = source.indexOf('async function ' + name + '(');
  if (start < 0) throw new Error('[090/190] function missing: ' + name);
  let depth = 0;
  let opened = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') { depth += 1; opened = true; }
    else if (ch === '}') {
      depth -= 1;
      if (opened && depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
    }
  }
  throw new Error('[090/190] unterminated function: ' + name);
}

const oldSettlement = functionRange('verifyFreshPersonalLikeSettlement189');
const targetedSettlement = `async function verifyFreshPersonalLikeSettlement189(env, uid, targetedTrackIds190 = []) {
  const bucket = env?.PROFILE_MEDIA;
  if (!bucket || !env?.DB || !uid) return null;
  const key = exploreSharedLikesKey061(uid);
  const object = await bucket.get(key);
  if (!object?.etag) return null;
  let raw = null;
  try { raw = JSON.parse(await object.text()); } catch { return null; }
  const state = normalizeSharedLikesState161(raw, uid);
  if (!state?.exact || state.likedIds.size > 2000) return null;

  const requested190 = [...new Set(
    (Array.isArray(targetedTrackIds190) ? targetedTrackIds190 : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )].slice(0, 200);
  if (requested190.some(id => id.length > 512)) return null;

  const readPending = async () => env.DB.prepare(
    'SELECT ' +
    '(SELECT COUNT(*) FROM explore_like_batches_069 WHERE user_uid=?) AS q069, ' +
    '(SELECT COUNT(*) FROM explore_like_user_queue_075 q ' +
      'CROSS JOIN explore_like_user_queue_state_075 s ' +
      'WHERE q.user_uid=? AND (q.updated_at>s.processed_at OR ' +
      '(q.updated_at=s.processed_at AND q.user_uid>s.processed_uid))) AS q075'
  ).bind(uid, uid).first();
  const queueEmpty = row => Boolean(row) && Number(row.q069 || 0) === 0 && Number(row.q075 || 0) === 0;
  if (!queueEmpty(await readPending())) return null;

  if (requested190.length) {
    // App184/190: D1 work is proportional only to historical unresolved guards.
    // readBoundedEffectiveLikeMemberships162 also respects the currently armed
    // relation mode (legacy / overlay157 / d1only171), so this stays compatible
    // with the frozen like writer architecture.
    const canonical190 = await readBoundedEffectiveLikeMemberships162(env, uid, requested190);
    if (!canonical190?.likedIds || requested190.some(
      id => canonical190.likedIds.has(id) !== state.likedIds.has(id)
    )) return null;
  } else {
    // Backward compatibility for already-deployed clients that do not send a
    // targeted set. Keep the old one-shot full proof unchanged.
    const canonical = await env.DB.prepare(
      'SELECT l.track_id FROM likes l JOIN tracks t ON t.id=l.track_id ' +
      "WHERE l.user_uid=? AND t.is_public=1 AND t.status='published' " +
      'ORDER BY l.created_at DESC LIMIT 2001'
    ).bind(uid).all();
    if (!Array.isArray(canonical?.results) || canonical.results.length > 2000) return null;
    const ids = canonical.results.map(row => String(row?.track_id || '').trim());
    if (ids.some(id => !id) || new Set(ids).size !== ids.length || ids.length !== state.likedIds.size ||
        ids.some(id => !state.likedIds.has(id))) return null;
  }

  if (!queueEmpty(await readPending())) return null;
  const current = await bucket.head(key);
  return Boolean(current?.etag) && current.etag === object.etag ? state : null;
}`;
source = source.slice(0, oldSettlement.start) + targetedSettlement + source.slice(oldSettlement.end);

const handler = functionRange('handleMySocialSnapshot042');
const oldCall = `  let freshCanonicalSettlement = false;
  if (new URL(request.url).searchParams.get('__soridraw_personal_settlement') === '189') {
    const settledLikeState189 = await verifyFreshPersonalLikeSettlement189(env, authContext.uid);
    freshCanonicalSettlement = Boolean(settledLikeState189);
    // Return the exact object whose ETag participated in the proof.
    if (settledLikeState189) likeState = settledLikeState189;
  }`;
const newCall = `  let freshCanonicalSettlement = false;
  if (new URL(request.url).searchParams.get('__soridraw_personal_settlement') === '189') {
    const settlementUrl190 = new URL(request.url);
    const rawTrackIds190 = settlementUrl190.searchParams.get('trackIds');
    const rawParts190 = rawTrackIds190 === null
      ? []
      : rawTrackIds190.split(',').map(value => value.trim()).filter(Boolean);
    if (rawTrackIds190 !== null && (
      rawParts190.length === 0 ||
      rawParts190.length > 200 ||
      rawParts190.some(id => id.length > 512)
    )) {
      throwApi('INVALID_SETTLEMENT_SCOPE', '좋아요 확인 범위가 올바르지 않습니다.', 400);
    }
    const targetedTrackIds190 = [...new Set(rawParts190)];
    const settledLikeState189 = await verifyFreshPersonalLikeSettlement189(
      env,
      authContext.uid,
      targetedTrackIds190,
    );
    freshCanonicalSettlement = Boolean(settledLikeState189);
    // Return the exact object whose ETag participated in the proof.
    if (settledLikeState189) likeState = settledLikeState189;
  }`;
if (!handler.text.includes(oldCall)) throw new Error('[090/190] social snapshot settlement call changed');
const nextHandler = handler.text.replace(oldCall, newCall);
source = source.slice(0, handler.start) + nextHandler + source.slice(handler.end);

source = source.replace(
  '// SORIDRAW_PERSONAL_LIKE_FRESH_SETTLEMENT_189_20260924',
  '// SORIDRAW_PERSONAL_LIKE_FRESH_SETTLEMENT_189_20260924\n// ' + marker,
);

if (!source.includes(marker) ||
    !source.includes('targetedTrackIds190') ||
    !source.includes('readBoundedEffectiveLikeMemberships162(env, uid, requested190)')) {
  throw new Error('[090/190] targeted settlement insertion failed');
}

writeFileSync(path, source, 'utf8');
console.log('[090/190] personal settlement uses bounded unresolved-track D1 proof when trackIds are supplied.');
