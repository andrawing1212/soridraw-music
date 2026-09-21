import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_LIKE_READER_CUTOVER_078_20260921';
const marker161 = 'SORIDRAW_SHARED_LIKE_READER_FIRST_161_20260921';
const marker162 = 'SORIDRAW_SHARED_LIKE_CUTOVER_GATE_162_20260921';
const marker163 = 'SORIDRAW_LEGACY_LIKE_WRITER_FREEZE_GUARD_163_20260921';
const hasReaders = source.includes(marker161) && source.includes(marker162);
if (hasReaders && source.includes(marker163)) {
  console.log('[078/163] shared like reader cutover and legacy-writer freeze already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_SOCIAL_R2_PARITY_061_20260917',
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'readSharedSocialJson061',
  'exploreSharedLikesKey061',
  'readSharedLikes061',
  'readExploreFollowingR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'rebuildExploreFollowingR2Bundle',
  'handleMyLikeStates',
  'handleMySocialSnapshot042',
  'handleMyLikedTracks052',
  'readSharedTrackCard062',
  'readSharedFeedCards062',
  'normalizeSharedTrackCard062',
  'enrichSharedTrackCards062',
  'writeSharedTrackCard062',
  'EXPLORE_SHARED_TRACK_CARD_LIMIT_062',
]) {
  if (!source.includes(required)) throw new Error('[072] required runtime missing: ' + required);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[072] function missing: ' + name);
  const brace = source.indexOf('{', start);
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
    if ('"\'\`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error('[072] unterminated function: ' + name);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

const readerHelpers = `
// ${marker}
// ${marker161}
const EXPLORE_SHARED_LIKE_EXACT_MARKER_161 = 'SORIDRAW_SHARED_LIKE_EXACT_STATE_161_20260921';

function normalizeSharedLikesState161(bundle, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized || !bundle || Number(bundle.schemaVersion) !== 1 ||
      String(bundle.uid || '').trim() !== normalized || !Array.isArray(bundle.likedTrackIds)) return null;
  const values = bundle.likedTrackIds.map((value) => String(value || '').trim()).filter(Boolean);
  const likedIds = new Set(values);
  const exactLikeCount = Number(bundle.exactLikeCount156);
  const canonicalSource = String(bundle.canonicalSource156 || '').trim();
  const exact = bundle.canonicalComplete156 === true &&
    Boolean(canonicalSource) &&
    Number.isSafeInteger(exactLikeCount) && exactLikeCount >= 0 &&
    exactLikeCount === likedIds.size && values.length === likedIds.size;
  return {
    likedIds,
    exact,
    exactLikeCount: exact ? exactLikeCount : null,
    source: exact ? canonicalSource : 'legacy-v114-partial',
  };
}

async function readSharedLikesState161(env, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized) return null;
  const bundle = await readSharedSocialJson061(env, exploreSharedLikesKey061(normalized));
  return normalizeSharedLikesState161(bundle, normalized);
}

async function readBoundedLegacyLikeMemberships161(env, uid, trackIds) {
  const normalized = String(uid || '').trim();
  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 200);
  if (!normalized || !ids.length || !env?.DB) return new Set();
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    'SELECT l.track_id FROM likes l JOIN tracks t ON t.id = l.track_id ' +
    'WHERE l.user_uid = ? AND l.track_id IN (' + placeholders + ') ' +
    "AND t.is_public = 1 AND t.status = 'published'"
  ).bind(normalized, ...ids).all();
  return new Set((result?.results || []).map((row) => String(row?.track_id || '').trim()).filter(Boolean));
}

// ${marker162}
const exploreLikeCutoverKey162 = 'internal/explore/like-cutover-v162/active.json';

async function readLikeCutoverState162(env) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) return { mode: 'legacy', cutoverToken: null };
  const object = await bucket.get(exploreLikeCutoverKey162);
  if (!object) return { mode: 'legacy', cutoverToken: null };
  let value = null;
  try { value = JSON.parse(await object.text()); }
  catch { throw new Error('162 cutover manifest unreadable'); }
  const token = String(value?.cutoverToken || '').trim();
  const armed = Number(value?.schemaVersion) === 1 &&
    value?.relationMode === 'overlay157' &&
    value?.legacyRelationWritersFrozen === true &&
    value?.legacyCountWritersFrozen === true &&
    value?.allEnvironmentReadersReady === true &&
    value?.allEnvironmentWritersReady === true &&
    value?.ownerProtocol === 'uid143-track147-158' &&
    token.length > 0 && token.length <= 128;
  if (!armed) throw new Error('162 cutover manifest present but not fully armed');
  return { mode: 'overlay157', cutoverToken: token };
}

async function readBoundedEffectiveLikeMemberships162(env, uid, trackIds) {
  const normalized = String(uid || '').trim();
  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 200);
  if (!normalized || !ids.length || !env?.DB) {
    return { likedIds: new Set(), mode: 'legacy', cutoverToken: null };
  }
  const cutover = await readLikeCutoverState162(env);
  if (cutover.mode !== 'overlay157') {
    return {
      likedIds: await readBoundedLegacyLikeMemberships161(env, normalized, ids),
      mode: 'legacy',
      cutoverToken: null,
    };
  }
  const values = ids.map(() => '(?)').join(',');
  const result = await env.DB.prepare(
    'WITH requested(track_id) AS (VALUES ' + values + ') ' +
    'SELECT r.track_id FROM requested r ' +
    'JOIN tracks t ON t.id = r.track_id ' +
    'LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ? ' +
    'LEFT JOIN explore_like_overrides_157 o ON o.user_uid = ? AND o.track_id = r.track_id ' +
    "WHERE t.is_public = 1 AND t.status = 'published' " +
    'AND COALESCE(o.liked, CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END) = 1'
  ).bind(...ids, normalized, normalized).all();
  if (!Array.isArray(result?.results)) throw new Error('162 effective membership unavailable');
  const liked = result.results.map((row) => String(row?.track_id || '').trim()).filter(Boolean);
  if (liked.some((id) => !ids.includes(id)) || new Set(liked).size !== liked.length) {
    throw new Error('162 effective membership invalid');
  }
  return { likedIds: new Set(liked), mode: 'overlay157', cutoverToken: cutover.cutoverToken };
}

async function readRequestedLikedTrackCardsD1161(env, trackIds) {
  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))]
    .slice(0, EXPLORE_SHARED_TRACK_CARD_LIMIT_062);
  if (!ids.length || !env?.DB) return [];
  const values = ids.map((_, index) => '(?,' + index + ')').join(',');
  const result = await env.DB.prepare(
    'WITH requested(id, sort_order) AS (VALUES ' + values + ') ' +
    'SELECT t.id,t.owner_uid,p.nickname AS owner_nickname,p.avatar_url AS owner_avatar_url,' +
    't.title,t.cover_url,t.suno_url_primary,t.suno_url_secondary,t.published_at,t.profile_pinned,' +
    'COALESCE(s.like_count,0) AS like_count,r.sort_order FROM requested r ' +
    'JOIN tracks t ON t.id=r.id LEFT JOIN public_profiles p ON p.uid=t.owner_uid ' +
    'LEFT JOIN track_stats s ON s.track_id=t.id ' +
    "WHERE t.is_public=1 AND t.status='published' ORDER BY r.sort_order ASC"
  ).bind(...ids).all();
  return (result?.results || []).map((row) => normalizeSharedTrackCard062({
    id: String(row.id || ''),
    ownerUid: String(row.owner_uid || ''),
    ownerNickname: String(row.owner_nickname || ''),
    ownerAvatarUrl: String(row.owner_avatar_url || ''),
    title: String(row.title || ''),
    coverUrl: String(row.cover_url || ''),
    sunoUrlPrimary: String(row.suno_url_primary || ''),
    openUrl: String(row.suno_url_primary || row.suno_url_secondary || ''),
    likeCount: Math.max(0, Number(row.like_count || 0)),
    publishedAt: Math.max(0, Number(row.published_at || 0)),
    profilePinned: Boolean(row.profile_pinned),
  })).filter(Boolean);
}
`;

if (!hasReaders) {
const insertBefore = functionRange('readSharedLikes061').start;
source = source.slice(0, insertBefore) + readerHelpers + '\n' + source.slice(insertBefore);

replaceFunction('readSharedLikes061', `async function readSharedLikes061(env, uid) {
  const state = await readSharedLikesState161(env, uid);
  return state?.likedIds || null;
}`);

replaceFunction('handleMyLikeStates', `async function handleMyLikeStates(request, url, env, cors) {
  const authContext = await requireExploreAuth(request);
  const raw = safeString(url.searchParams.get("trackIds"));
  const trackIds = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 50);
  if (!trackIds.length) {
    return json({ ok: true, data: {
      likedTrackIds: [], likesComplete: false, exactLikeCount: null,
      likesSnapshotSource: 'empty-targeted-161',
    } }, 200, cors);
  }
  if (trackIds.some((trackId) => trackId.length > 512)) {
    throwApi("INVALID_TRACK_ID", "\\uACE1 ID\\uAC00 \\uC62C\\uBC14\\uB974\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4.", 400);
  }
  const sharedState = await readSharedLikesState161(env, authContext.uid);
  if (sharedState?.exact) {
    return json({ ok: true, data: {
      likedTrackIds: trackIds.filter((trackId) => sharedState.likedIds.has(trackId)),
      likesComplete: true,
      exactLikeCount: sharedState.exactLikeCount,
      likesSnapshotSource: sharedState.source,
    } }, 200, cors);
  }
  const targeted162 = await readBoundedEffectiveLikeMemberships162(env, authContext.uid, trackIds);
  return json({ ok: true, data: {
    likedTrackIds: trackIds.filter((trackId) => targeted162.likedIds.has(trackId)),
    likesComplete: false,
    exactLikeCount: null,
    likesSnapshotSource: targeted162.mode === 'overlay157'
      ? 'overlay157-targeted-162' : 'legacy-targeted-161',
  } }, 200, cors);
}`);

replaceFunction('handleMySocialSnapshot042', `async function handleMySocialSnapshot042(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let [likeState, followingUids] = await Promise.all([
    readSharedLikesState161(env, authContext.uid),
    readExploreFollowingR2Bundle(env, authContext.uid),
  ]);
  if (!likeState || !followingUids) {
    await Promise.all([
      likeState ? Promise.resolve() : rebuildExploreLikeR2Bundle(env, authContext.uid),
      followingUids ? Promise.resolve() : rebuildExploreFollowingR2Bundle(env, authContext.uid),
    ]);
    [likeState, followingUids] = await Promise.all([
      readSharedLikesState161(env, authContext.uid),
      readExploreFollowingR2Bundle(env, authContext.uid),
    ]);
  }
  if (!likeState || !followingUids) {
    return json({ ok: false, error: 'SOCIAL_SNAPSHOT_UNAVAILABLE' }, 503, cors);
  }
  return json({
    ok: true,
    data: {
      schemaVersion: 1,
      likedTrackIds: [...likeState.likedIds],
      likesComplete: likeState.exact,
      exactLikeCount: likeState.exact ? likeState.exactLikeCount : null,
      likesSnapshotSource: likeState.source,
      followingUids: [...followingUids],
      source: 'r2-social-042',
      updatedAt: Date.now(),
    },
  }, 200, cors);
}`);

replaceFunction('handleMyLikedTracks052', `async function handleMyLikedTracks052(request, env, cors) {
  const bodyRequest = request.clone();
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await bodyRequest.json(); } catch { throwApi('INVALID_BODY', '좋아요 곡 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.trackIds) ? body.trackIds : [];
  if (raw.length > EXPLORE_SHARED_TRACK_CARD_LIMIT_062) throwApi('TOO_MANY_TRACKS', '한 번에 확인할 수 있는 좋아요 곡 수를 초과했습니다.', 400);
  const trackIds = [...new Set(raw.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, EXPLORE_SHARED_TRACK_CARD_LIMIT_062);
  if (trackIds.some((trackId) => trackId.length > 512)) throwApi('INVALID_TRACK_ID', '곡 ID가 올바르지 않습니다.', 400);

  const likeState = await readSharedLikesState161(env, authContext.uid);
  const targeted162 = likeState?.exact
    ? { likedIds: likeState.likedIds, mode: 'exact-r2', cutoverToken: null }
    : await readBoundedEffectiveLikeMemberships162(env, authContext.uid, trackIds);
  const likedIds = targeted162.likedIds;
  const likesComplete = Boolean(likeState?.exact);
  const canonicalLikedTrackIds = [...likedIds];

  if (!trackIds.length) {
    return json({ ok: true, data: {
      likedTrackIds: canonicalLikedTrackIds, items: [], unavailableTrackIds: [],
      likesComplete, exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
    } }, 200, cors);
  }

  const requested = trackIds.filter((trackId) => likedIds.has(trackId));
  if (!requested.length) {
    return json({ ok: true, data: {
      likedTrackIds: canonicalLikedTrackIds, items: [], unavailableTrackIds: trackIds,
      likesComplete, exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
    } }, 200, cors);
  }

  const byId = new Map();
  await Promise.all(requested.map(async (trackId) => {
    const card = await readSharedTrackCard062(env, trackId);
    if (card) byId.set(trackId, card);
  }));
  let missing = requested.filter((trackId) => !byId.has(trackId));
  if (missing.length) {
    const feedCards = await readSharedFeedCards062(env, missing);
    for (const [trackId, card] of feedCards) byId.set(trackId, card);
    missing = requested.filter((trackId) => !byId.has(trackId));
  }
  if (missing.length) {
    const recoveredItems = await readRequestedLikedTrackCardsD1161(env, missing);
    for (const item of recoveredItems) {
      const card = normalizeSharedTrackCard062(item);
      if (!card?.id || !missing.includes(card.id)) continue;
      byId.set(card.id, card);
      try { await writeSharedTrackCard062(env, card); } catch {}
    }
  }
  const ordered = requested.map((trackId) => byId.get(trackId)).filter(Boolean);
  const items = await enrichSharedTrackCards062(env, ordered);
  const returned = new Set(items.map((item) => String(item?.id || '').trim()).filter(Boolean));
  const unavailableTrackIds = trackIds.filter((trackId) => !returned.has(trackId));
  return json({ ok: true, data: {
    likedTrackIds: canonicalLikedTrackIds, items, unavailableTrackIds,
    likesComplete, exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
  } }, 200, cors);
}`);

}

// 163: after the shared marker is fully armed, the old likes/track_stats
// writers must be physically blocked. This patch never creates the marker.
if (!source.includes(marker163)) {
  const stateRange = functionRange('readLikeCutoverState162');
  const guard = `

// ${marker163}
async function assertLegacyLikeWriterOpen163(env, writerName) {
  const state = await readLikeCutoverState162(env);
  if (state?.mode === 'overlay157') {
    throw new Error('[SORIDRAW 163] legacy like writer frozen after shared cutover: ' + String(writerName || 'unknown'));
  }
  if (!state || state.mode !== 'legacy') {
    throw new Error('[SORIDRAW 163] shared cutover state unavailable');
  }
  return state;
}
`;
  source = source.slice(0, stateRange.end) + guard + source.slice(stateRange.end);
}

{
  const range = functionRange('handleLikeD1Core');
  if (!range.text.includes('assertLegacyLikeWriterOpen163')) {
    const anchor = '  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);\n';
    if (range.text.split(anchor).length !== 2) throw new Error('[078/163] direct like guard anchor changed');
    replaceFunction('handleLikeD1Core',
      range.text.replace(anchor, anchor + "  await assertLegacyLikeWriterOpen163(env, 'direct-like');\n"));
  }
}

{
  const range = functionRange('processExploreLikeBatches035Core056');
  if (!range.text.includes('assertLegacyLikeWriterOpen163')) {
    const anchor = "  const owner = 'like042_' + now + '_' + crypto.randomUUID();\n";
    if (range.text.split(anchor).length !== 2) throw new Error('[078/163] aggregate guard anchor changed');
    replaceFunction('processExploreLikeBatches035Core056', range.text.replace(
      anchor,
      "  // Guard only after the existing queue preflight proves actual pending work.\n" +
      "  await assertLegacyLikeWriterOpen163(env, 'scheduled-like-aggregate');\n\n" + anchor
    ));
  }
}

{
  const range = functionRange('refreshLikeCount');
  if (!range.text.includes('assertLegacyLikeWriterOpen163')) {
    const anchor = 'async function refreshLikeCount(env, trackId, now) {\n';
    replaceFunction('refreshLikeCount',
      range.text.replace(anchor, anchor + "  await assertLegacyLikeWriterOpen163(env, 'refresh-like-count');\n"));
  }
}

for (const required of [
  marker, marker161, marker162, marker163,
  'normalizeSharedLikesState161',
  'readSharedLikesState161',
  'readBoundedLegacyLikeMemberships161',
  'readLikeCutoverState162',
  'readBoundedEffectiveLikeMemberships162',
  'readRequestedLikedTrackCardsD1161',
  'assertLegacyLikeWriterOpen163',
]) {
  if (!source.includes(required)) throw new Error('[072] final runtime missing: ' + required);
}
writeFileSync(workerPath, source, 'utf8');
console.log('[078/163] Shared like readers are cutover-gated and all legacy relation/count writer entry paths freeze after the shared marker is armed.');
