import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917';
if (source.includes(marker)) {
  console.log('[062] shared public track-card R2 already applied.');
  process.exit(0);
}

for (const required of [
  'handleMyLikedTracks052',
  'readExploreLikeR2Bundle',
  'readSharedLikesState161',
  'readBoundedLegacyLikeMemberships161',
  'exploreSharedFeedR2Key059',
  'readExploreSharedProfile060',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreVisibleProfiles056',
  'requireExploreAuth',
  'throwApi',
  'json',
]) {
  if (!source.includes(required)) throw new Error(`[062] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[062] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[062] function body missing: ${name}`);
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
  throw new Error(`[062] unterminated function: ${name}`);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^async\\s+function\\s+${name}\\(`), `async function ${coreName}(`);
  if (renamed === range.text) throw new Error(`[062] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const helpers = `// ${marker}
const EXPLORE_SHARED_TRACK_CARD_SCHEMA_062 = 1;
const EXPLORE_SHARED_TRACK_CARD_LIMIT_062 = 200;
const exploreSharedTrackCardKey062 = (trackId) => \`internal/explore/shared-track-card-v115/\${encodeURIComponent(String(trackId || '').trim())}.json\`;

function normalizeSharedTrackCard062(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const id = String(item.id || item.trackId || '').trim();
  if (!id) return null;
  const likeCount = Math.max(0, Number(item.likeCount ?? item.like_count ?? item.stats?.likeCount ?? 0));
  const publishedAt = Math.max(0, Number(item.publishedAt ?? item.published_at ?? 0));
  return {
    ...item,
    id,
    ownerUid: String(item.ownerUid || item.owner_uid || '').trim(),
    ownerNickname: String(item.ownerNickname || item.owner_nickname || '').trim(),
    ownerAvatarUrl: String(item.ownerAvatarUrl || item.owner_avatar_url || '').trim(),
    title: String(item.title || '').trim(),
    coverUrl: String(item.coverUrl || item.cover_url || '').trim(),
    sunoUrlPrimary: String(item.sunoUrlPrimary || item.suno_url_primary || '').trim(),
    openUrl: String(item.openUrl || item.sunoUrlPrimary || item.suno_url_primary || item.suno_url_secondary || '').trim(),
    likeCount,
    publishedAt,
    profilePinned: Boolean(item.profilePinned ?? item.profile_pinned),
    ...(item.stats && typeof item.stats === 'object' ? { stats: { ...item.stats, likeCount } } : {}),
  };
}

async function readSharedTrackCard062(env, trackId) {
  const normalizedId = String(trackId || '').trim();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!normalizedId || !bucket) return null;
  try {
    const object = await bucket.get(exploreSharedTrackCardKey062(normalizedId));
    if (!object) return null;
    const bundle = JSON.parse(await object.text());
    if (Number(bundle?.schemaVersion || 0) !== EXPLORE_SHARED_TRACK_CARD_SCHEMA_062) return null;
    const card = normalizeSharedTrackCard062(bundle?.card);
    return card?.id === normalizedId ? card : null;
  } catch {
    return null;
  }
}

async function writeSharedTrackCard062(env, item) {
  const card = normalizeSharedTrackCard062(item);
  const bucket = env?.PROFILE_MEDIA || null;
  if (!card?.id || !bucket) return false;
  const now = Date.now();
  await bucket.put(exploreSharedTrackCardKey062(card.id), JSON.stringify({
    schemaVersion: EXPLORE_SHARED_TRACK_CARD_SCHEMA_062,
    trackId: card.id,
    updatedAt: now,
    card,
  }), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawSharedTrackCard: '115', updatedAt: String(now) },
  });
  return true;
}

async function deleteSharedTrackCard062(env, trackId) {
  const normalizedId = String(trackId || '').trim();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!normalizedId || !bucket) return false;
  await bucket.delete(exploreSharedTrackCardKey062(normalizedId));
  return true;
}

async function patchSharedTrackCard062(env, trackId, patch) {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return false;
  const current = await readSharedTrackCard062(env, normalizedId);
  if (!current) return false;
  const nextPatch = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const next = { ...current, ...nextPatch, id: normalizedId };
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'likeCount')) {
    const likeCount = Math.max(0, Number(nextPatch.likeCount || 0));
    next.likeCount = likeCount;
    if (next.stats && typeof next.stats === 'object') next.stats = { ...next.stats, likeCount };
  }
  return await writeSharedTrackCard062(env, next);
}

async function readSharedFeedCards062(env, trackIds) {
  const wanted = new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean));
  const found = new Map();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!wanted.size || !bucket) return found;
  for (const sort of ['latest', 'popular']) {
    let object = null;
    try { object = await bucket.get(exploreSharedFeedR2Key059(sort)); } catch {}
    if (!object) continue;
    let bundle = null;
    try { bundle = JSON.parse(await object.text()); } catch { bundle = null; }
    const items = Array.isArray(bundle?.payload?.data?.items) ? bundle.payload.data.items : [];
    for (const item of items) {
      const card = normalizeSharedTrackCard062(item);
      if (!card?.id || !wanted.has(card.id) || found.has(card.id)) continue;
      found.set(card.id, card);
    }
    if (found.size >= wanted.size) break;
  }
  for (const card of found.values()) {
    try { await writeSharedTrackCard062(env, card); } catch {}
  }
  return found;
}

async function enrichSharedTrackCards062(env, cards) {
  const rows = Array.isArray(cards) ? cards : [];
  const profileByUid = new Map();
  for (const card of rows) {
    const uid = String(card?.ownerUid || '').trim();
    if (!uid || profileByUid.has(uid)) continue;
    let profile = null;
    try {
      const bundle = await readExploreSharedProfile060(env, uid);
      profile = bundle?.body?.data?.profile || null;
    } catch {}
    profileByUid.set(uid, profile);
  }
  return rows.map((card) => {
    const uid = String(card?.ownerUid || '').trim();
    const profile = profileByUid.get(uid);
    if (!profile) return card;
    return {
      ...card,
      ownerNickname: String(profile.nickname || profile.displayName || card.ownerNickname || '').trim(),
      ownerAvatarUrl: String(profile.avatarUrl || profile.avatar_url || card.ownerAvatarUrl || '').trim(),
    };
  });
}

async function readRequestedLikedTrackCardsD1161(env, trackIds) {
  const ids = [...new Set((trackIds || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, EXPLORE_SHARED_TRACK_CARD_LIMIT_062);
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

async function promoteLikedTrackResponse062(env, response) {
  if (!(response instanceof Response) || !response.ok) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  for (const item of items) {
    try { await writeSharedTrackCard062(env, item); } catch {}
  }
  return response;
}
`;

const helperAnchor = functionRange('handleMyLikedTracks052').start;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('handleMyLikedTracks052', 'Core062', (coreName) => `async function handleMyLikedTracks052(request, env, cors) {
  const bodyRequest = request.clone();
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await bodyRequest.json(); } catch { throwApi('INVALID_BODY', '좋아요 곡 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.trackIds) ? body.trackIds : [];
  if (raw.length > EXPLORE_SHARED_TRACK_CARD_LIMIT_062) throwApi('TOO_MANY_TRACKS', '한 번에 확인할 수 있는 좋아요 곡 수를 초과했습니다.', 400);
  const trackIds = [...new Set(raw.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, EXPLORE_SHARED_TRACK_CARD_LIMIT_062);
  if (trackIds.some((trackId) => trackId.length > 512)) throwApi('INVALID_TRACK_ID', '곡 ID가 올바르지 않습니다.', 400);

  const likeState = await readSharedLikesState161(env, authContext.uid);
  const likedIds = likeState?.exact
    ? likeState.likedIds
    : await readBoundedLegacyLikeMemberships161(env, authContext.uid, trackIds);
  const likesComplete = Boolean(likeState?.exact);
  const canonicalLikedTrackIds = [...likedIds];

  if (!trackIds.length) {
    return json({ ok: true, data: {
      likedTrackIds: canonicalLikedTrackIds,
      items: [],
      unavailableTrackIds: [],
      likesComplete,
      exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
    } }, 200, cors);
  }

  const requested = trackIds.filter((trackId) => likedIds.has(trackId));
  if (!requested.length) {
    return json({ ok: true, data: {
      likedTrackIds: canonicalLikedTrackIds,
      items: [],
      unavailableTrackIds: trackIds,
      likesComplete,
      exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
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
    likedTrackIds: canonicalLikedTrackIds,
    items,
    unavailableTrackIds,
    likesComplete,
    exactLikeCount: likesComplete ? likeState.exactLikeCount : null,
  } }, 200, cors);
}`)

wrapAsyncFunction('syncExploreFeedR2Publication043', 'Core062', (coreName) => `async function syncExploreFeedR2Publication043(env, incomingItem) {
  const result = await ${coreName}(env, incomingItem);
  try { await writeSharedTrackCard062(env, incomingItem); }
  catch (error) { console.warn('[SORIDRAW 062] shared track-card publish deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2Private043', 'Core062', (coreName) => `async function syncExploreFeedR2Private043(env, trackId) {
  const result = await ${coreName}(env, trackId);
  try { await deleteSharedTrackCard062(env, trackId); }
  catch (error) { console.warn('[SORIDRAW 062] shared track-card private delete deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2OptionPatch043', 'Core062', (coreName) => `async function syncExploreFeedR2OptionPatch043(env, trackId, patch) {
  const result = await ${coreName}(env, trackId, patch);
  try { await patchSharedTrackCard062(env, trackId, patch); }
  catch (error) { console.warn('[SORIDRAW 062] shared track-card option patch deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);

wrapAsyncFunction('patchExploreVisibleProfiles056', 'Core062', (coreName) => `async function patchExploreVisibleProfiles056(env, changedItems) {
  const result = await ${coreName}(env, changedItems);
  for (const row of changedItems || []) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId) continue;
    try { await patchSharedTrackCard062(env, trackId, { likeCount: Math.max(0, Number(row?.likeCount || 0)) }); }
    catch (error) { console.warn('[SORIDRAW 062] shared track-card like patch deferred:', trackId, String(error?.message || error || 'unknown')); }
  }
  return result;
}`);

for (const required of [
  marker,
  'exploreSharedTrackCardKey062',
  'readSharedTrackCard062',
  'writeSharedTrackCard062',
  'deleteSharedTrackCard062',
  'patchSharedTrackCard062',
  'readSharedFeedCards062',
  'enrichSharedTrackCards062',
  'promoteLikedTrackResponse062',
  'readRequestedLikedTrackCardsD1161',
  'handleMyLikedTracks052Core062',
  'syncExploreFeedR2Publication043Core062',
  'syncExploreFeedR2Private043Core062',
  'syncExploreFeedR2OptionPatch043Core062',
  'patchExploreVisibleProfiles056Core062',
]) {
  if (!source.includes(required)) throw new Error(`[062] final runtime missing: ${required}`);
}

for (const name of [
  'readSharedTrackCard062',
  'writeSharedTrackCard062',
  'deleteSharedTrackCard062',
  'patchSharedTrackCard062',
  'readSharedFeedCards062',
  'enrichSharedTrackCards062',
]) {
  const text = functionRange(name).text;
  if (/env\.DB|\.prepare\(/.test(text)) throw new Error(`[062] shared track-card helper must remain D1-free: ${name}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[062] Liked-track card details now reuse one shared public-track R2 card per song, seed from shared Feed first, and use bounded D1 detail recovery only for true global cold misses.');
