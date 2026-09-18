// SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919
// Shared R2 derived catalog. This file intentionally contains no D1 access.
// It is imported by the Phase A verifier and injected into the Worker by patch 066.

export const EXPLORE_R2_CATALOG_SCHEMA_066 = 1;
export const EXPLORE_R2_CATALOG_ROOT_066 = 'internal/explore/catalog-v1';
export const EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066 = 8;
export const EXPLORE_R2_CATALOG_SCAN_LIMIT_066 = 1000;

export function isExploreR2CatalogEnabled066(env) {
  return String(env?.SORIDRAW_R2_CATALOG_V1 || '').trim() === '1';
}

export function normalizeCatalogText066(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCatalogToken066(value) {
  return normalizeCatalogText066(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function catalogSegment066(value) {
  return encodeURIComponent(String(value ?? '').trim());
}

export function catalogInverseNumber066(value) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric)))
    : 0;
  return String(Number.MAX_SAFE_INTEGER - safe).padStart(16, '0');
}

export function catalogTitleTokens066(title) {
  const full = normalizeCatalogText066(title).slice(0, 160);
  const tokenText = normalizeCatalogToken066(title);
  const parts = tokenText ? tokenText.split(' ').filter(Boolean) : [];
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const normalized = String(value || '').trim().slice(0, 80);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };
  push(full);
  for (const part of parts) {
    push(part);
    if (out.length >= EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066) break;
  }
  return out.slice(0, EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066);
}

export function catalogGenreFromCard066(item) {
  const direct = String(item?.primaryGenre ?? item?.primary_genre ?? '').trim();
  if (direct) return normalizeCatalogText066(direct).slice(0, 160);
  const selected = item?.shareBundle?.selectedKeywords;
  const genres = Array.isArray(selected?.genres) ? selected.genres : [];
  const first = genres.find((value) => String(value || '').trim());
  return first ? normalizeCatalogText066(first).slice(0, 160) : '';
}

export function normalizeCatalogTrack066(item, overrides = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const id = String(item.id || item.trackId || '').trim();
  if (!id) return null;
  const ownerUid = String(item.ownerUid || item.owner_uid || overrides.ownerUid || '').trim();
  const title = String(item.title || '').trim();
  const publishedAt = Math.max(0, Number(item.publishedAt ?? item.published_at ?? overrides.publishedAt ?? 0) || 0);
  const likeCount = Math.max(0, Number(item.likeCount ?? item.like_count ?? item.stats?.likeCount ?? overrides.likeCount ?? 0) || 0);
  const profilePinned = Boolean(item.profilePinned ?? item.profile_pinned ?? overrides.profilePinned);
  const primaryGenre = normalizeCatalogText066(
    overrides.primaryGenre ?? catalogGenreFromCard066(item)
  ).slice(0, 160);
  return {
    id,
    ownerUid,
    title,
    publishedAt,
    likeCount,
    profilePinned,
    primaryGenre,
  };
}

export function catalogMetaKey066(trackId) {
  return `${EXPLORE_R2_CATALOG_ROOT_066}/meta/${catalogSegment066(trackId)}.json`;
}

export function catalogLatestKey066(track) {
  return `${EXPLORE_R2_CATALOG_ROOT_066}/latest/${catalogInverseNumber066(track.publishedAt)}/${catalogSegment066(track.id)}.json`;
}

export function catalogPopularKey066(track) {
  return `${EXPLORE_R2_CATALOG_ROOT_066}/popular/${catalogInverseNumber066(track.likeCount)}/${catalogInverseNumber066(track.publishedAt)}/${catalogSegment066(track.id)}.json`;
}

export function catalogProfileKey066(track) {
  const pinOrder = track.profilePinned ? '0' : '1';
  return `${EXPLORE_R2_CATALOG_ROOT_066}/profile/${catalogSegment066(track.ownerUid)}/${pinOrder}/${catalogInverseNumber066(track.publishedAt)}/${catalogSegment066(track.id)}.json`;
}

export function catalogGenreKey066(track) {
  if (!track.primaryGenre) return '';
  return `${EXPLORE_R2_CATALOG_ROOT_066}/genre/${catalogSegment066(track.primaryGenre)}/${catalogInverseNumber066(track.publishedAt)}/${catalogSegment066(track.id)}.json`;
}

export function catalogTitleKeys066(track) {
  return catalogTitleTokens066(track.title).map((token) =>
    `${EXPLORE_R2_CATALOG_ROOT_066}/title/${catalogSegment066(token)}/${catalogInverseNumber066(track.publishedAt)}/${catalogSegment066(track.id)}.json`
  );
}

export function catalogMarkerKeys066(item, overrides = {}) {
  const track = normalizeCatalogTrack066(item, overrides);
  if (!track) return [];
  const keys = [
    catalogLatestKey066(track),
    catalogPopularKey066(track),
    track.ownerUid ? catalogProfileKey066(track) : '',
    catalogGenreKey066(track),
    ...catalogTitleKeys066(track),
  ].filter(Boolean);
  return [...new Set(keys)].sort();
}

export function catalogMarkerDiff066(previousKeys, nextKeys) {
  const before = new Set(Array.isArray(previousKeys) ? previousKeys : []);
  const after = new Set(Array.isArray(nextKeys) ? nextKeys : []);
  return {
    remove: [...before].filter((key) => !after.has(key)).sort(),
    add: [...after].filter((key) => !before.has(key)).sort(),
  };
}

export function catalogArtistMetaKey066(uid) {
  return `${EXPLORE_R2_CATALOG_ROOT_066}/artist-meta/${catalogSegment066(uid)}.json`;
}

export function catalogArtistMarkerKeys066(profile) {
  const uid = String(profile?.uid || '').trim();
  if (!uid) return [];
  const nickname = normalizeCatalogText066(profile?.nickname || profile?.displayName || '').slice(0, 120);
  const handle = normalizeCatalogText066(profile?.handle || '').replace(/^@+/, '').slice(0, 120);
  const keys = [];
  if (nickname) keys.push(`${EXPLORE_R2_CATALOG_ROOT_066}/artist/name/${catalogSegment066(nickname)}/${catalogSegment066(uid)}.json`);
  if (handle) keys.push(`${EXPLORE_R2_CATALOG_ROOT_066}/artist/handle/${catalogSegment066(handle)}/${catalogSegment066(uid)}.json`);
  return [...new Set(keys)].sort();
}

export function catalogTrackIdFromKey066(key) {
  const raw = String(key || '').split('/').pop() || '';
  const encoded = raw.endsWith('.json') ? raw.slice(0, -5) : raw;
  try { return decodeURIComponent(encoded); } catch { return encoded; }
}

export function catalogArtistUidFromKey066(key) {
  return catalogTrackIdFromKey066(key);
}

function catalogBucket066(env) {
  return env?.PROFILE_MEDIA || null;
}

async function readCatalogJson066(env, key) {
  const bucket = catalogBucket066(env);
  if (!bucket || !key) return null;
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

async function writeCatalogJson066(env, key, payload, metadata = {}) {
  const bucket = catalogBucket066(env);
  if (!bucket || !key) return false;
  await bucket.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: {
      soridrawCatalog: '066',
      updatedAt: String(Date.now()),
      ...metadata,
    },
  });
  return true;
}

async function deleteCatalogKeys066(env, keys) {
  const bucket = catalogBucket066(env);
  const unique = [...new Set((keys || []).filter(Boolean))];
  if (!bucket || !unique.length) return 0;
  await bucket.delete(unique);
  return unique.length;
}

function catalogTrackSignature066(track, isPublic, markerKeys) {
  return JSON.stringify({
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    public: Boolean(isPublic),
    id: track?.id || '',
    ownerUid: track?.ownerUid || '',
    title: track?.title || '',
    publishedAt: Number(track?.publishedAt || 0),
    likeCount: Number(track?.likeCount || 0),
    profilePinned: Boolean(track?.profilePinned),
    primaryGenre: track?.primaryGenre || '',
    markerKeys: markerKeys || [],
  });
}

export async function syncExploreCatalogTrack066(env, item, options = {}) {
  const track = normalizeCatalogTrack066(item, options);
  if (!track) return { ok: false, reason: 'track' };
  const metaKey = catalogMetaKey066(track.id);
  const previous = await readCatalogJson066(env, metaKey);
  const isPublic = options.isPublic !== false;
  const nextKeys = isPublic ? catalogMarkerKeys066(track) : [];
  const signature = catalogTrackSignature066(track, isPublic, nextKeys);
  if (previous?.signature === signature) {
    return { ok: true, changed: false, added: 0, removed: 0, markerKeys: nextKeys };
  }
  const diff = catalogMarkerDiff066(previous?.markerKeys, nextKeys);
  await deleteCatalogKeys066(env, diff.remove);
  const markerPayload = {
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    trackId: track.id,
    ownerUid: track.ownerUid,
    publishedAt: track.publishedAt,
    likeCount: track.likeCount,
  };
  await Promise.all(diff.add.map((key) => writeCatalogJson066(env, key, markerPayload, {
    trackId: track.id,
    ownerUid: track.ownerUid,
  })));
  await writeCatalogJson066(env, metaKey, {
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    trackId: track.id,
    public: isPublic,
    track,
    markerKeys: nextKeys,
    signature,
    updatedAt: Date.now(),
  }, { trackId: track.id, kind: 'meta' });
  return {
    ok: true,
    changed: true,
    added: diff.add.length,
    removed: diff.remove.length,
    markerKeys: nextKeys,
  };
}

export async function removeExploreCatalogTrack066(env, trackId) {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return { ok: false, reason: 'trackId' };
  const metaKey = catalogMetaKey066(normalizedId);
  const previous = await readCatalogJson066(env, metaKey);
  const removed = await deleteCatalogKeys066(env, previous?.markerKeys || []);
  await writeCatalogJson066(env, metaKey, {
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    trackId: normalizedId,
    public: false,
    track: previous?.track || { id: normalizedId },
    markerKeys: [],
    signature: 'private',
    updatedAt: Date.now(),
  }, { trackId: normalizedId, kind: 'meta' });
  return { ok: true, changed: removed > 0, removed };
}

export async function patchExploreCatalogLike066(env, trackId, likeCount) {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return { ok: false, reason: 'trackId' };
  const previous = await readCatalogJson066(env, catalogMetaKey066(normalizedId));
  if (!previous?.public || !previous?.track) return { ok: false, reason: 'meta' };
  return syncExploreCatalogTrack066(env, {
    ...previous.track,
    likeCount: Math.max(0, Number(likeCount || 0)),
  }, { isPublic: true });
}

export async function syncExploreCatalogArtist066(env, profile) {
  const uid = String(profile?.uid || '').trim();
  if (!uid) return { ok: false, reason: 'uid' };
  const metaKey = catalogArtistMetaKey066(uid);
  const previous = await readCatalogJson066(env, metaKey);
  const nextKeys = catalogArtistMarkerKeys066(profile);
  const signature = JSON.stringify({ uid, nickname: normalizeCatalogText066(profile?.nickname || ''), handle: normalizeCatalogText066(profile?.handle || '').replace(/^@+/, ''), nextKeys });
  if (previous?.signature === signature) return { ok: true, changed: false, added: 0, removed: 0 };
  const diff = catalogMarkerDiff066(previous?.markerKeys, nextKeys);
  await deleteCatalogKeys066(env, diff.remove);
  await Promise.all(diff.add.map((key) => writeCatalogJson066(env, key, {
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    uid,
  }, { uid, kind: 'artist' })));
  await writeCatalogJson066(env, metaKey, {
    schemaVersion: EXPLORE_R2_CATALOG_SCHEMA_066,
    uid,
    markerKeys: nextKeys,
    signature,
    updatedAt: Date.now(),
  }, { uid, kind: 'artist-meta' });
  return { ok: true, changed: true, added: diff.add.length, removed: diff.remove.length };
}

export function buildFirstPublisherSharedProfileBundle066(authContext, now = Date.now()) {
  const uid = String(authContext?.uid || '').trim();
  if (!uid) return null;
  const emailPrefix = String(authContext?.email || '').split('@')[0].trim();
  const nickname = String(authContext?.displayName || emailPrefix || 'SORIDRAW 사용자').trim().slice(0, 80);
  const avatarUrl = String(authContext?.picture || '').trim().slice(0, 4000);
  const profile = {
    uid,
    nickname,
    avatarUrl,
    backgroundUrl: '',
    bio: '',
    handle: '',
    genres: [],
    socialLinks: { spotify: '', instagram: '', tiktok: '' },
    followerCount: 0,
    followingCount: 0,
    trackCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  return {
    schemaVersion: 1,
    uid,
    handle: '',
    revision: 1,
    updatedAt: now,
    body: {
      ok: true,
      data: {
        profile,
        items: [],
        nextCursor: null,
        revision: 1,
        schemaVersion: 1,
        updatedAt: now,
      },
    },
  };
}

export async function ensureFirstPublisherSharedProfile066(env, authContext, now = Date.now()) {
  const uid = String(authContext?.uid || '').trim();
  if (!uid) return null;
  let existing = null;
  try { existing = await readExploreSharedProfile060(env, uid); } catch {}
  if (validExploreProfileR2Bundle020(existing)) {
    const profile = existing.body.data.profile || {};
    return {
      nickname: String(profile.nickname || profile.displayName || authContext?.displayName || ''),
      avatarUrl: String(profile.avatarUrl || profile.avatar_url || authContext?.picture || ''),
      handle: String(profile.handle || existing.handle || '').trim().replace(/^@+/, ''),
    };
  }
  const bundle = buildFirstPublisherSharedProfileBundle066(authContext, now);
  if (!bundle) return null;
  await writeExploreSharedProfile060(env, bundle);
  return {
    nickname: bundle.body.data.profile.nickname,
    avatarUrl: bundle.body.data.profile.avatarUrl,
    handle: '',
  };
}

function catalogListPrefix066(kind, value = '') {
  const base = `${EXPLORE_R2_CATALOG_ROOT_066}/${kind}/`;
  return value ? `${base}${catalogSegment066(value)}/` : base;
}

function catalogCursorPayload066(kind, prefix, state = {}) {
  return encodeCursor({
    catalogV1: EXPLORE_R2_CATALOG_SCHEMA_066,
    kind,
    prefix,
    ...state,
  });
}

function readCatalogCursor066(value, kind, prefix) {
  const decoded = decodeCursor(value);
  if (!decoded || Number(decoded.catalogV1 || 0) !== EXPLORE_R2_CATALOG_SCHEMA_066) return null;
  if (String(decoded.kind || '') !== String(kind || '')) return null;
  if (String(decoded.prefix || '') !== String(prefix || '')) return null;
  return decoded;
}

async function listCatalogObjects066(env, prefix, limit, cursorState = null) {
  const bucket = catalogBucket066(env);
  if (!bucket) return null;
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 40)));
  if (cursorState?.r2Cursor) {
    const result = await bucket.list({
      prefix,
      cursor: String(cursorState.r2Cursor),
      limit: safeLimit,
      include: ['customMetadata'],
    });
    return {
      objects: result.objects || [],
      nextState: result.truncated && result.cursor ? { r2Cursor: result.cursor } : null,
    };
  }

  if (cursorState?.afterKey) {
    const offsetHint = Math.min(100, Math.max(1, Number(cursorState.offsetHint || safeLimit)));
    const scanLimit = Math.min(EXPLORE_R2_CATALOG_SCAN_LIMIT_066, offsetHint + safeLimit);
    const result = await bucket.list({
      prefix,
      limit: scanLimit,
      include: ['customMetadata'],
    });
    const objects = result.objects || [];
    const index = objects.findIndex((object) => object.key === String(cursorState.afterKey));
    if (index < 0) return null;
    const visible = objects.slice(index + 1, index + 1 + safeLimit);
    let nextState = null;
    if (visible.length) {
      const consumedToEnd = index + 1 + visible.length >= objects.length;
      if (consumedToEnd && result.truncated && result.cursor) nextState = { r2Cursor: result.cursor };
      else if (index + 1 + visible.length < objects.length || result.truncated) {
        nextState = { afterKey: visible.at(-1).key, offsetHint: offsetHint + visible.length };
      }
    }
    return { objects: visible, nextState };
  }

  const result = await bucket.list({
    prefix,
    limit: safeLimit,
    include: ['customMetadata'],
  });
  return {
    objects: result.objects || [],
    nextState: result.truncated && result.cursor ? { r2Cursor: result.cursor } : null,
  };
}

async function hydrateCatalogObjects066(env, objects) {
  const ids = [...new Set((objects || []).map((object) => catalogTrackIdFromKey066(object.key)).filter(Boolean))];
  const rows = await Promise.all(ids.map(async (trackId) => {
    try { return await readSharedTrackCard062(env, trackId); } catch { return null; }
  }));
  return rows.filter(Boolean);
}

function withCatalogDiagnostics066(response, source) {
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Catalog', source);
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleCatalogFeed066(url, env, cors) {
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const limit = getPageSize(url);
  const prefix = catalogListPrefix066(sort);
  const cursorValue = url.searchParams.get('cursor');
  const cursor = readCatalogCursor066(cursorValue, `feed:${sort}`, prefix);
  if (!cursor) return null;
  const page = await listCatalogObjects066(env, prefix, limit, cursor);
  if (!page) return null;
  const items = await hydrateCatalogObjects066(env, page.objects);
  const nextCursor = page.nextState ? catalogCursorPayload066(`feed:${sort}`, prefix, {
    ...page.nextState,
    legacy: cursor.legacy || null,
  }) : null;
  return withCatalogDiagnostics066(json({ ok: true, data: { items, nextCursor, sort } }, 200, cors), 'R2-CATALOG-FEED-066');
}

export async function rewriteFirstFeedCursor066(response, url, env) {
  if (!(response instanceof Response) || !response.ok) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const data = payload?.data;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length || !data?.nextCursor) return response;
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const last = normalizeCatalogTrack066(items.at(-1));
  if (!last) return response;
  const afterKey = sort === 'popular' ? catalogPopularKey066(last) : catalogLatestKey066(last);
  const prefix = catalogListPrefix066(sort);
  const nextCursor = catalogCursorPayload066(`feed:${sort}`, prefix, {
    afterKey,
    offsetHint: items.length,
    legacy: data.nextCursor,
  });
  payload.data.nextCursor = nextCursor;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Catalog-Cursor', 'R2-V1-066');
  return new Response(JSON.stringify(payload), { status: response.status, headers });
}

export async function handleCatalogProfileTracks066(url, profileRef, env, cors) {
  let bundle = null;
  try { bundle = await readExploreSharedProfile060(env, profileRef); } catch {}
  const uid = String(bundle?.uid || bundle?.body?.data?.profile?.uid || '').trim();
  if (!uid) return null;
  const limit = getPageSize(url);
  const prefix = catalogListPrefix066('profile', uid);
  const cursorValue = url.searchParams.get('cursor');
  const cursor = readCatalogCursor066(cursorValue, 'profile', prefix);
  if (!cursor) return null;
  const page = await listCatalogObjects066(env, prefix, limit, cursor);
  if (!page) return null;
  const items = await hydrateCatalogObjects066(env, page.objects);
  const nextCursor = page.nextState ? catalogCursorPayload066('profile', prefix, {
    ...page.nextState,
    legacy: cursor.legacy || null,
  }) : null;
  return withCatalogDiagnostics066(json({ ok: true, data: { items, nextCursor } }, 200, cors), 'R2-CATALOG-PROFILE-066');
}

export async function rewriteFirstProfileCursor066(response, profileRef, env) {
  if (!(response instanceof Response) || !response.ok) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const data = payload?.data;
  const items = Array.isArray(data?.items) ? data.items : [];
  const uid = String(data?.profile?.uid || '').trim();
  if (!uid || !items.length || !data?.nextCursor) return response;
  const last = normalizeCatalogTrack066(items.at(-1), { ownerUid: uid });
  if (!last) return response;
  const prefix = catalogListPrefix066('profile', uid);
  const nextCursor = catalogCursorPayload066('profile', prefix, {
    afterKey: catalogProfileKey066(last),
    offsetHint: items.length,
    legacy: data.nextCursor,
  });
  payload.data.nextCursor = nextCursor;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Catalog-Cursor', 'R2-V1-066');
  return new Response(JSON.stringify(payload), { status: response.status, headers });
}

export async function handleCatalogGenre066(url, genreValue, env, cors) {
  const genre = normalizeCatalogText066(genreValue).slice(0, 160);
  if (!genre) return null;
  const limit = getPageSize(url);
  const prefix = catalogListPrefix066('genre', genre);
  const rawCursor = url.searchParams.get('cursor');
  const cursor = rawCursor ? readCatalogCursor066(rawCursor, 'genre', prefix) : {};
  if (rawCursor && !cursor) return null;
  const page = await listCatalogObjects066(env, prefix, limit, cursor);
  if (!page) return null;
  const items = await hydrateCatalogObjects066(env, page.objects);
  const nextCursor = page.nextState ? catalogCursorPayload066('genre', prefix, page.nextState) : null;
  return withCatalogDiagnostics066(json({ ok: true, data: { genre: genreValue, items, nextCursor } }, 200, cors), 'R2-CATALOG-GENRE-066');
}

async function listCatalogPrefixIds066(env, prefix, limit) {
  const page = await listCatalogObjects066(env, prefix, limit, null);
  if (!page) return [];
  return page.objects.map((object) => catalogTrackIdFromKey066(object.key)).filter(Boolean);
}

async function listCatalogArtistUids066(env, kind, query, limit) {
  const bucket = catalogBucket066(env);
  if (!bucket) return [];
  const prefix = `${EXPLORE_R2_CATALOG_ROOT_066}/artist/${kind}/${catalogSegment066(query)}`;
  const result = await bucket.list({ prefix, limit: Math.min(20, Math.max(1, limit)), include: ['customMetadata'] });
  return [...new Set((result.objects || []).map((object) => catalogArtistUidFromKey066(object.key)).filter(Boolean))];
}

export async function handleCatalogSearch066(url, env, cors) {
  const q = String(url.searchParams.get('q') || '').trim();
  if (!q || q.length > 120) return null;
  const normalized = normalizeCatalogText066(q);
  if (!normalized) return null;
  const limit = getPageSize(url);
  const creatorLimitRaw = Number(url.searchParams.get('creatorLimit') || 10);
  const creatorLimit = Number.isFinite(creatorLimitRaw) ? Math.min(20, Math.max(5, Math.floor(creatorLimitRaw))) : 10;

  const [titleIds, genreIds, nameUids, handleUids] = await Promise.all([
    listCatalogPrefixIds066(env, `${EXPLORE_R2_CATALOG_ROOT_066}/title/${catalogSegment066(normalized)}`, Math.min(100, limit * 2)),
    listCatalogPrefixIds066(env, catalogListPrefix066('genre', normalized), Math.min(100, limit * 2)),
    listCatalogArtistUids066(env, 'name', normalized, creatorLimit),
    listCatalogArtistUids066(env, 'handle', normalized.replace(/^@+/, ''), creatorLimit),
  ]);

  const creatorUids = [...new Set([...nameUids, ...handleUids])].slice(0, creatorLimit);
  const artistTrackLists = await Promise.all(creatorUids.map((uid) =>
    listCatalogPrefixIds066(env, catalogListPrefix066('profile', uid), Math.min(20, limit))
  ));
  const ids = [...new Set([...titleIds, ...genreIds, ...artistTrackLists.flat()])].slice(0, Math.max(limit * 3, limit));
  const cards = (await Promise.all(ids.map(async (trackId) => {
    try { return await readSharedTrackCard062(env, trackId); } catch { return null; }
  }))).filter(Boolean);

  const priority = (card) => {
    const title = normalizeCatalogText066(card?.title || '');
    if (title === normalized) return 0;
    if (title.startsWith(normalized)) return 1;
    return 2;
  };
  cards.sort((a, b) => priority(a) - priority(b)
    || Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0)
    || String(b?.id || '').localeCompare(String(a?.id || '')));
  const items = cards.slice(0, limit);

  const creators = [];
  for (const uid of creatorUids) {
    let bundle = null;
    try { bundle = await readExploreSharedProfile060(env, uid); } catch {}
    const profile = bundle?.body?.data?.profile;
    if (!profile) continue;
    creators.push({
      uid,
      nickname: String(profile.nickname || profile.displayName || ''),
      avatarUrl: String(profile.avatarUrl || profile.avatar_url || ''),
      bio: String(profile.bio || ''),
      followerCount: Math.max(0, Number(profile.followerCount || 0)),
      followingCount: Math.max(0, Number(profile.followingCount || 0)),
      trackCount: Math.max(0, Number(profile.trackCount || 0)),
      handle: String(profile.handle || bundle.handle || '').replace(/^@+/, ''),
    });
  }

  return withCatalogDiagnostics066(json({
    ok: true,
    data: {
      query: q,
      items,
      tracks: { items, nextCursor: null },
      creators,
      nextCursor: null,
    },
  }, 200, cors), 'R2-CATALOG-SEARCH-066');
}
