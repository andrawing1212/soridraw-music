import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_W2_PROFILE_PAGINATION_069_20260919';
if (source.includes(marker)) {
  console.log('[069] W2 profile pagination already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_W2_PROFILE_SEARCH_PROJECTION_068_20260919',
  'handleProfileTracks', 'readExploreSharedProfile060', 'validExploreProfileR2Bundle020',
  'readSharedTrackCard062', 'w2ProfileRankKey068', 'EXPLORE_W2_PROFILE_INDEX_PREFIX_068',
  'getPageSize', 'decodeCursor', 'encodeCursor', 'mapTrackRow', 'getExploreFeedItemId012',
]) if (!source.includes(required)) throw new Error('[069] required runtime missing: ' + required);

const functionRange = (name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) { start = source.indexOf(needle); if (start >= 0) break; }
  if (start < 0) throw new Error('[069] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[069] unterminated function: ' + name);
};
const wrapAsyncFunction = (name, suffix, builder) => {
  const range = functionRange(name);
  const coreName = name + suffix;
  const renamed = range.text.replace(new RegExp('^async\\s+function\\s+' + name + '\\('), 'async function ' + coreName + '(');
  if (renamed === range.text) throw new Error('[069] could not wrap ' + name);
  source = source.slice(0, range.start) + renamed + '\n\n' + builder(coreName) + source.slice(range.end);
};

const anchor = functionRange('handleProfileTracks').start;
const helpers = `// ${marker}
const EXPLORE_W2_PROFILE_LIST_PAGE_069 = 100;
const EXPLORE_W2_PROFILE_SCAN_PAGES_069 = 4;

function profileRankCursor069(item, w2ProfileState069 = null) {
  const id = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Number(item?.publishedAt ?? item?.published_at ?? 0));
  const profilePinned = item?.profilePinned === true || Number(item?.profile_pinned || 0) === 1 ? 1 : 0;
  if (!id || !Number.isFinite(publishedAt)) return null;
  return { profilePinned, publishedAt, id, ...(w2ProfileState069 ? { w2ProfileState069 } : {}) };
}
function profileMeta069(object) {
  const m = object?.customMetadata || {};
  const trackId = String(m.trackId || '').trim();
  const publishedAt = Number(m.publishedAt || 0);
  const profilePinned = String(object?.key || '').includes('/0/') ? 1 : 0;
  return trackId && publishedAt > 0 ? { trackId, publishedAt, profilePinned } : null;
}
function profileMetaAfter069(meta, boundary) {
  if (!meta) return false;
  if (!boundary || !String(boundary.id || '').trim()) return true;
  const pinned = Number(boundary.profilePinned || 0);
  const publishedAt = Number(boundary.publishedAt || 0);
  const id = String(boundary.id || '').trim();
  if (meta.profilePinned !== pinned) return meta.profilePinned < pinned;
  if (meta.publishedAt !== publishedAt) return meta.publishedAt < publishedAt;
  return meta.trackId < id;
}
function normalizeW2ProfileState069(value, uid) {
  const raw = value && typeof value === 'object' ? value : null;
  if (!raw || raw.uid !== uid) return null;
  if (raw.end === true) return { uid, cursor: null, offset: 0, end: true };
  return { uid, cursor: typeof raw.cursor === 'string' && raw.cursor ? raw.cursor : null, offset: Math.max(0, Math.floor(Number(raw.offset || 0))), end: false };
}
async function listW2ProfilePage069(env, uid, state) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || state?.end) return { objects: [], truncated: false, cursor: null };
  const options = { prefix: EXPLORE_W2_PROFILE_INDEX_PREFIX_068 + encodeURIComponent(uid) + '/', limit: EXPLORE_W2_PROFILE_LIST_PAGE_069, include: ['customMetadata'] };
  if (state?.cursor) options.cursor = state.cursor;
  return await bucket.list(options);
}
function profileStateAfterObject069(uid, pageState, page, index) {
  const next = index + 1;
  const objects = page?.objects || [];
  if (next < objects.length) return { uid, cursor: pageState?.cursor || null, offset: next, end: false };
  if (page?.truncated && page?.cursor) return { uid, cursor: String(page.cursor), offset: 0, end: false };
  return { uid, cursor: null, offset: 0, end: true };
}
async function initializeW2ProfileState069(env, uid, boundary) {
  let state = { uid, cursor: null, offset: 0, end: false };
  for (let pageIndex = 0; pageIndex < EXPLORE_W2_PROFILE_SCAN_PAGES_069 && !state.end; pageIndex += 1) {
    const pageState = { ...state };
    const page = await listW2ProfilePage069(env, uid, pageState);
    const objects = page?.objects || [];
    for (let i = Math.min(pageState.offset, objects.length); i < objects.length; i += 1) {
      const object = objects[i], meta = profileMeta069(object);
      if (!profileMetaAfter069(meta, boundary)) continue;
      try {
        const card = meta?.trackId ? await readSharedTrackCard062(env, meta.trackId) : null;
        if (card && w2ProfileRankKey068(card) === String(object?.key || '')) return { uid, cursor: pageState.cursor || null, offset: i, end: false };
      } catch {}
    }
    state = page?.truncated && page?.cursor ? { uid, cursor: String(page.cursor), offset: 0, end: false } : { uid, cursor: null, offset: 0, end: true };
  }
  return state;
}
async function readW2ProfileCandidates069(env, uid, initialState, wanted) {
  let state = initialState || { uid, cursor: null, offset: 0, end: false };
  const entries = [], positions = [];
  let scannedPages = 0;
  while (!state.end && entries.length < wanted && scannedPages < EXPLORE_W2_PROFILE_SCAN_PAGES_069) {
    const pageState = { ...state };
    const page = await listW2ProfilePage069(env, uid, pageState);
    scannedPages += 1;
    const objects = page?.objects || [];
    let i = Math.min(pageState.offset, objects.length);
    for (; i < objects.length && entries.length < wanted; i += 1) {
      const object = objects[i], meta = profileMeta069(object);
      const stateBefore = { uid, cursor: pageState.cursor || null, offset: i, end: false };
      const stateAfter = profileStateAfterObject069(uid, pageState, page, i);
      positions.push({ meta, stateBefore, stateAfter });
      if (meta?.trackId) {
        try {
          const item = await readSharedTrackCard062(env, meta.trackId);
          if (item && w2ProfileRankKey068(item) === String(object?.key || '')) entries.push({ item, stateBefore, stateAfter, meta });
        } catch {}
      }
      state = stateAfter;
    }
    if (!objects.length || (i >= objects.length && !state.end && state.cursor === pageState.cursor)) {
      state = page?.truncated && page?.cursor ? { uid, cursor: String(page.cursor), offset: 0, end: false } : { uid, cursor: null, offset: 0, end: true };
    }
  }
  return { entries, positions, stateAfterScan: state, hasMore: !state.end || entries.length >= wanted };
}
function nextW2ProfileState069(uid, startState, positions, stateAfterScan, last) {
  if (!last) return startState;
  const boundary = profileRankCursor069(last);
  let nextState = startState;
  for (const position of positions) {
    if (profileMetaAfter069(position.meta, boundary)) return position.stateBefore;
    nextState = position.stateAfter;
  }
  return positions.length ? nextState : stateAfterScan;
}
async function resolveProfileUid069(env, profileRef) {
  try {
    const shared = await readExploreSharedProfile060(env, profileRef);
    const uid = String(shared?.uid || shared?.body?.data?.profile?.uid || '').trim();
    if (validExploreProfileR2Bundle020(shared) && uid) return { uid, shared };
  } catch {}
  const row = await resolvePublicProfileRef(env, profileRef);
  return row?.uid ? { uid: String(row.uid), shared: null } : null;
}
async function readLegacyProfileCandidates069(env, uid, profile, boundary, wanted) {
  const bindings = [uid];
  let cursorSql = '';
  if (boundary && String(boundary.id || '').trim()) {
    const pinned = Number(boundary.profilePinned || 0), publishedAt = Number(boundary.publishedAt || 0), id = String(boundary.id || '').trim();
    if (Number.isFinite(pinned) && Number.isFinite(publishedAt)) {
      cursorSql = 'AND (t.profile_pinned < ? OR (t.profile_pinned = ? AND t.published_at < ?) OR (t.profile_pinned = ? AND t.published_at = ? AND t.id < ?))';
      bindings.push(pinned, pinned, publishedAt, pinned, publishedAt, id);
    }
  }
  const sql = 'SELECT t.*,COALESCE(s.like_count,0) AS like_count,COALESCE(s.comment_count,0) AS comment_count,COALESCE(s.play_count,0) AS play_count FROM tracks t INDEXED BY idx_tracks_owner_profile_order LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.owner_uid=? AND t.is_public=1 AND t.status=\'published\' AND (t.source_type <> \'music_note\' OR t.publication_storage_version <> 1) ' + cursorSql + ' ORDER BY t.profile_pinned DESC,t.published_at DESC,t.id DESC LIMIT ?';
  const result = await env.DB.prepare(sql).bind(...bindings, wanted).all();
  const ownerNickname = String(profile?.nickname || profile?.displayName || '');
  const ownerAvatar = String(profile?.avatarUrl || profile?.avatar_url || '');
  return { items: (result.results || []).map((row) => mapTrackRow({ ...row, owner_nickname: ownerNickname, owner_avatar_url: ownerAvatar })), hasMore: (result.results || []).length >= wanted };
}
function sortProfileItems069(items) {
  return [...items].sort((a, b) => {
    const pin = Number(b?.profilePinned === true) - Number(a?.profilePinned === true);
    if (pin) return pin;
    const published = Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0);
    if (published) return published;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}
`;
source = source.slice(0, anchor) + helpers + '\n' + source.slice(anchor);

wrapAsyncFunction('handleProfileTracks', 'Core069', (coreName) => `async function handleProfileTracks(url, profileRef, env, cors) {
  const limit = getPageSize(url);
  if (limit !== 50) return await ${coreName}(url, profileRef, env, cors);
  const resolved = await resolveProfileUid069(env, profileRef);
  if (!resolved) return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);
  const uid = resolved.uid;
  const shared = resolved.shared || await readExploreSharedProfile060(env, uid).catch(() => null);
  const profile = shared?.body?.data?.profile || {};
  const cursorText = String(url.searchParams.get('cursor') || '').trim();
  if (!cursorText && validExploreProfileR2Bundle020(shared)) {
    const items = Array.isArray(shared.body.data.items) ? shared.body.data.items.slice(0, limit) : [];
    const last = items.at(-1) || null;
    const storedNext = shared.body.data.nextCursor || null;
    const nextCursor = storedNext || (items.length >= limit && last ? encodeCursor(profileRankCursor069(last)) : null);
    return json({ ok: true, data: { items, nextCursor } }, 200, cors);
  }
  const boundary = decodeCursor(cursorText);
  if (!boundary) return await ${coreName}(url, profileRef, env, cors);
  const persisted = normalizeW2ProfileState069(boundary.w2ProfileState069, uid);
  const startState = persisted || await initializeW2ProfileState069(env, uid, boundary);
  const wanted = limit + 1;
  const [legacy, w2] = await Promise.all([
    readLegacyProfileCandidates069(env, uid, profile, boundary, wanted),
    readW2ProfileCandidates069(env, uid, startState, wanted),
  ]);
  const byId = new Map();
  for (const item of legacy.items) { const id = getExploreFeedItemId012(item); if (id) byId.set(id, item); }
  for (const entry of w2.entries) { const id = getExploreFeedItemId012(entry.item); if (id) byId.set(id, entry.item); }
  const merged = sortProfileItems069([...byId.values()]);
  const visible = merged.slice(0, limit), last = visible.at(-1) || null;
  const hasMore = merged.length > limit || legacy.hasMore || w2.hasMore;
  const nextState = nextW2ProfileState069(uid, startState, w2.positions, w2.stateAfterScan, last);
  const nextCursor = hasMore && last ? encodeCursor(profileRankCursor069(last, nextState)) : null;
  return json({ ok: true, data: { items: visible, nextCursor } }, 200, cors);
}`);

const legacy = functionRange('readLegacyProfileCandidates069').text;
if (!legacy.includes('INDEXED BY idx_tracks_owner_profile_order')) throw new Error('[069] legacy profile query must stay indexed');
if (!legacy.includes('publication_storage_version <> 1')) throw new Error('[069] legacy profile query must exclude W2 rows');
const w2 = functionRange('readW2ProfileCandidates069').text;
if (/env\.DB|\.prepare\(/.test(w2)) throw new Error('[069] W2 profile reader must remain R2-only');
for (const required of [marker, 'handleProfileTracksCore069', 'w2ProfileState069']) if (!source.includes(required)) throw new Error('[069] final runtime missing: ' + required);

writeFileSync(workerPath, source, 'utf8');
console.log('[069] Public-profile first page is shared-R2 first; later pages merge indexed legacy D1 with W2 R2 owner rank without full owner scans.');
