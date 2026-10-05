import assert from 'node:assert/strict';

class MemoryR2Object {
  constructor(key, record) {
    this.key = key;
    this.etag = record.etag;
    this.customMetadata = record.customMetadata || {};
    this.httpMetadata = record.httpMetadata || {};
    this._body = record.body;
  }
  async text() { return this._body; }
}

class MemoryR2Bucket {
  constructor() {
    this.records = new Map();
    this.sequence = 0;
  }
  async get(key) {
    const record = this.records.get(String(key));
    return record ? new MemoryR2Object(String(key), record) : null;
  }
  async put(key, body, options = {}) {
    const normalizedKey = String(key);
    const existing = this.records.get(normalizedKey);
    const onlyIf = options.onlyIf || null;
    if (onlyIf?.etagMatches && existing?.etag !== onlyIf.etagMatches) return null;
    if (onlyIf?.etagDoesNotMatch === '*' && existing) return null;
    const text = typeof body === 'string' ? body : String(body);
    const etag = `mem-${++this.sequence}`;
    this.records.set(normalizedKey, {
      body: text,
      etag,
      customMetadata: options.customMetadata || {},
      httpMetadata: options.httpMetadata || {},
    });
    return { etag };
  }
  async delete(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) this.records.delete(String(key));
  }
  async list(options = {}) {
    const prefix = String(options.prefix || '');
    const limit = Math.max(1, Math.min(1000, Number(options.limit || 1000)));
    const all = [...this.records.keys()].filter((key) => key.startsWith(prefix)).sort();
    const offset = options.cursor ? Math.max(0, Number(options.cursor) || 0) : 0;
    const visible = all.slice(offset, offset + limit);
    const next = offset + visible.length;
    return {
      objects: visible.map((key) => ({
        key,
        customMetadata: this.records.get(key)?.customMetadata || {},
      })),
      truncated: next < all.length,
      cursor: next < all.length ? String(next) : undefined,
    };
  }
  keys(prefix = '') {
    return [...this.records.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
}

const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
const decodeCursor = (value) => {
  if (!value) return null;
  try { return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); }
  catch { return null; }
};
const getPageSize = (url) => {
  const raw = Number(url.searchParams.get('limit') || 40);
  return Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.floor(raw))) : 40;
};
const json = (payload, status = 200, cors = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json', ...cors },
});

globalThis.encodeCursor = encodeCursor;
globalThis.decodeCursor = decodeCursor;
globalThis.getPageSize = getPageSize;
globalThis.json = json;
globalThis.validExploreProfileR2Bundle020 = (bundle) => Boolean(
  bundle && typeof bundle === 'object' && bundle.body?.data?.profile && Array.isArray(bundle.body?.data?.items)
);
globalThis.exploreProfileR2Key = (uid) => `mock/local-profile/${uid}.json`;
globalThis.getProfileTrackId019 = (item) => String(item?.id || item?.trackId || '').trim();
globalThis.writeExploreProfileAlias020 = async () => true;
globalThis.readExploreR2Json = async (env, key) => {
  const object = await (env.EXPLORE_CACHE || env.PROFILE_MEDIA).get(key);
  if (!object) return null;
  try { return JSON.parse(await object.text()); } catch { return null; }
};
globalThis.writeExploreR2Json = async (env, key, payload) => {
  await (env.EXPLORE_CACHE || env.PROFILE_MEDIA).put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
  return true;
};
globalThis.readSharedTrackCard062 = async (env, trackId) => env.__cards.get(String(trackId)) || null;
globalThis.readExploreSharedProfile060 = async (env, ref) => {
  const normalized = String(ref || '').replace(/^@+/, '').trim();
  if (env.__profiles.has(normalized)) return env.__profiles.get(normalized);
  const uid = env.__profileAliases.get(normalized.toLowerCase());
  return uid ? env.__profiles.get(uid) || null : null;
};
globalThis.writeExploreSharedProfile060 = async (env, bundle) => {
  const uid = String(bundle?.uid || bundle?.body?.data?.profile?.uid || '').trim();
  if (!uid) return false;
  env.__profiles.set(uid, structuredClone(bundle));
  const handle = String(bundle?.handle || bundle?.body?.data?.profile?.handle || '').replace(/^@+/, '').trim();
  if (handle) env.__profileAliases.set(handle.toLowerCase(), uid);
  return true;
};

const catalog = await import('../cloudflare/explore-worker/runtime/r2-catalog-v1.js');

const {
  EXPLORE_R2_CATALOG_ROOT_066,
  catalogMetaKey066,
  catalogMarkerDiff066,
  catalogMarkerKeys066,
  normalizeCatalogTrack066,
  syncExploreCatalogTrack066,
  removeExploreCatalogTrack066,
  patchExploreCatalogLike066,
  syncExploreCatalogArtist066,
  handleCatalogFeed066,
  rewriteFirstFeedCursor066,
  handleCatalogProfileTracks066,
  handleCatalogGenre066,
  handleCatalogSearch066,
  buildFirstPublisherSharedProfileBundle066,
  ensureFirstPublisherSharedProfile066,
  firstPublisherProfileTrackDelta066,
  finalizeFirstPublisherProfile066,
} = catalog;

const makeEnv = () => ({
  PROFILE_MEDIA: new MemoryR2Bucket(),
  EXPLORE_CACHE: new MemoryR2Bucket(),
  __cards: new Map(),
  __profiles: new Map(),
  __profileAliases: new Map(),
});

const env = makeEnv();
const cors = { 'access-control-allow-origin': '*' };

const profileBundle = (uid, nickname, handle) => ({
  schemaVersion: 1,
  uid,
  handle,
  revision: 1,
  updatedAt: 1,
  body: {
    ok: true,
    data: {
      profile: {
        uid,
        nickname,
        avatarUrl: '',
        bio: '',
        handle,
        followerCount: 0,
        followingCount: 0,
        trackCount: 0,
      },
      items: [],
      nextCursor: null,
      revision: 1,
      schemaVersion: 1,
      updatedAt: 1,
    },
  },
});

const alice = profileBundle('u1', 'Alice Moon', 'alice');
const bob = profileBundle('u2', 'Bob Wave', 'bobwave');
env.__profiles.set('u1', alice);
env.__profiles.set('u2', bob);
env.__profileAliases.set('alice', 'u1');
env.__profileAliases.set('bobwave', 'u2');
await syncExploreCatalogArtist066(env, alice.body.data.profile);
await syncExploreCatalogArtist066(env, bob.body.data.profile);

const tracks = [
  { id: 'track-z', ownerUid: 'u1', title: 'Midnight Night', primaryGenre: 'Indie Pop', publishedAt: 6000, likeCount: 10, profilePinned: false },
  { id: 'track-a', ownerUid: 'u1', title: 'Night Drive', primaryGenre: 'Indie Pop', publishedAt: 6000, likeCount: 10, profilePinned: false },
  { id: 'track-5', ownerUid: 'u1', title: 'City Lights', primaryGenre: 'Indie Pop', publishedAt: 5000, likeCount: 14, profilePinned: true },
  { id: 'track-4', ownerUid: 'u1', title: 'Quiet Avenue', primaryGenre: 'Indie Pop', publishedAt: 4000, likeCount: 8, profilePinned: false },
  { id: 'track-3', ownerUid: 'u2', title: 'Blue Morning', primaryGenre: 'Jazz', publishedAt: 3000, likeCount: 12, profilePinned: false },
  { id: 'track-2', ownerUid: 'u2', title: 'Soft Night', primaryGenre: 'Jazz', publishedAt: 2000, likeCount: 8, profilePinned: false },
  { id: 'track-1', ownerUid: 'u1', title: 'Last Window', primaryGenre: 'Indie Pop', publishedAt: 1000, likeCount: 2, profilePinned: false },
].map((track) => ({
  ...track,
  ownerNickname: track.ownerUid === 'u1' ? 'Alice Moon' : 'Bob Wave',
  ownerAvatarUrl: '',
  sourceType: 'music_note',
  sourceId: `source-${track.id}`,
  sunoUrlPrimary: `https://audio.example/${track.id}`,
  stats: { likeCount: track.likeCount, commentCount: 0, playCount: 0 },
}));

for (const track of tracks) {
  env.__cards.set(track.id, structuredClone(track));
  const result = await syncExploreCatalogTrack066(env, track, { isPublic: true });
  assert.equal(result.ok, true);
}

const latestExpected = [...tracks].sort((a, b) =>
  b.publishedAt - a.publishedAt || b.id.localeCompare(a.id)
).map((track) => track.id);
const popularExpected = [...tracks].sort((a, b) =>
  b.likeCount - a.likeCount || b.publishedAt - a.publishedAt || b.id.localeCompare(a.id)
).map((track) => track.id);

async function parseResponse(response) {
  assert.ok(response instanceof Response, 'expected Response');
  assert.equal(response.ok, true, `HTTP ${response.status}`);
  return response.json();
}

async function collectFeed(sort, expected) {
  const firstItems = expected.slice(0, 2).map((id) => env.__cards.get(id));
  const last = firstItems.at(-1);
  const legacy = encodeCursor(sort === 'popular'
    ? { likeCount: last.likeCount, publishedAt: last.publishedAt, id: last.id }
    : { publishedAt: last.publishedAt, id: last.id });
  const firstUrl = new URL(`https://example.test/v1/feed?sort=${sort}&limit=2`);
  const rewritten = await rewriteFirstFeedCursor066(
    json({ ok: true, data: { items: firstItems, nextCursor: legacy, sort } }, 200, cors),
    firstUrl,
    env,
  );
  const first = await parseResponse(rewritten);
  assert.equal(first.data.items.length, 2);
  assert.ok(first.data.nextCursor, 'catalog first-page cursor missing');

  const ids = first.data.items.map((item) => item.id);
  let cursor = first.data.nextCursor;
  while (cursor) {
    const url = new URL(`https://example.test/v1/feed?sort=${sort}&limit=2&cursor=${encodeURIComponent(cursor)}`);
    const payload = await parseResponse(await handleCatalogFeed066(url, env, cors));
    assert.equal(payload.data.sort, sort);
    assert.ok(Array.isArray(payload.data.items));
    ids.push(...payload.data.items.map((item) => item.id));
    cursor = payload.data.nextCursor;
  }
  assert.deepEqual(ids, expected, `${sort} deep pagination mismatch`);
  assert.equal(new Set(ids).size, ids.length, `${sort} duplicate across pages`);
}

await collectFeed('latest', latestExpected);
await collectFeed('popular', popularExpected);

const u1Tracks = tracks.filter((track) => track.ownerUid === 'u1');
const profileExpected = [...u1Tracks].sort((a, b) =>
  Number(b.profilePinned) - Number(a.profilePinned)
  || b.publishedAt - a.publishedAt
  || b.id.localeCompare(a.id)
).map((track) => track.id);
const profileFirst = profileExpected.slice(0, 2).map((id) => env.__cards.get(id));
const profileLast = profileFirst.at(-1);
let profileCursor = encodeCursor({
  profilePinned: profileLast.profilePinned ? 1 : 0,
  publishedAt: profileLast.publishedAt,
  id: profileLast.id,
});
const profileIds = profileFirst.map((item) => item.id);
while (profileCursor) {
  const url = new URL(`https://example.test/v1/profiles/u1/tracks?limit=2&cursor=${encodeURIComponent(profileCursor)}`);
  const payload = await parseResponse(await handleCatalogProfileTracks066(url, 'u1', env, cors));
  profileIds.push(...payload.data.items.map((item) => item.id));
  profileCursor = payload.data.nextCursor;
}
assert.deepEqual(profileIds, profileExpected, 'profile deep pagination mismatch');
assert.equal(new Set(profileIds).size, profileIds.length, 'profile duplicate across pages');

const genreExpected = latestExpected.filter((id) => env.__cards.get(id).primaryGenre === 'Indie Pop');
let genreCursor = null;
const genreIds = [];
do {
  const suffix = genreCursor ? `&cursor=${encodeURIComponent(genreCursor)}` : '';
  const url = new URL(`https://example.test/v1/genres/Indie%20Pop?limit=2${suffix}`);
  const payload = await parseResponse(await handleCatalogGenre066(url, 'Indie Pop', env, cors));
  assert.ok(Array.isArray(payload.data.items));
  genreIds.push(...payload.data.items.map((item) => item.id));
  genreCursor = payload.data.nextCursor;
} while (genreCursor);
assert.deepEqual(genreIds, genreExpected, 'genre pagination mismatch');

const nightSearch = await parseResponse(await handleCatalogSearch066(
  new URL('https://example.test/v1/search?q=night&limit=20'),
  env,
  cors,
));
assert.ok(nightSearch.data.items.some((item) => item.id === 'track-z'), 'title token search missing track-z');
assert.ok(nightSearch.data.items.some((item) => item.id === 'track-a'), 'title token search missing track-a');
assert.ok(nightSearch.data.items.some((item) => item.id === 'track-2'), 'title token search missing track-2');
assert.deepEqual(Object.keys(nightSearch.data).sort(), ['creators', 'items', 'nextCursor', 'query', 'tracks'].sort(), 'search API shape changed');

const genreSearch = await parseResponse(await handleCatalogSearch066(
  new URL('https://example.test/v1/search?q=indie%20pop&limit=20'),
  env,
  cors,
));
assert.ok(genreSearch.data.items.some((item) => item.id === 'track-5'), 'genre search missing indie track');

const artistSearch = await parseResponse(await handleCatalogSearch066(
  new URL('https://example.test/v1/search?q=alice&limit=20'),
  env,
  cors,
));
assert.ok(artistSearch.data.creators.some((creator) => creator.uid === 'u1'), 'artist nickname/handle search missing creator');
assert.ok(artistSearch.data.items.some((item) => item.ownerUid === 'u1'), 'artist search missing creator tracks');

const target = env.__cards.get('track-4');
const beforeLikeMetaObject = await env.PROFILE_MEDIA.get(catalogMetaKey066(target.id));
const beforeLikeMeta = JSON.parse(await beforeLikeMetaObject.text());
await patchExploreCatalogLike066(env, target.id, 99);
const afterLikeMetaObject = await env.PROFILE_MEDIA.get(catalogMetaKey066(target.id));
const afterLikeMeta = JSON.parse(await afterLikeMetaObject.text());
const likeDiff = catalogMarkerDiff066(beforeLikeMeta.markerKeys, afterLikeMeta.markerKeys);
assert.equal(likeDiff.add.length, 1, 'like must add exactly one marker');
assert.equal(likeDiff.remove.length, 1, 'like must remove exactly one marker');
assert.ok(likeDiff.add[0].includes('/popular/') && likeDiff.remove[0].includes('/popular/'), 'like may only move popular marker');

const beforePinKeys = afterLikeMeta.markerKeys;
await syncExploreCatalogTrack066(env, { ...target, likeCount: 99, profilePinned: true }, { isPublic: true });
const afterPinMetaObject = await env.PROFILE_MEDIA.get(catalogMetaKey066(target.id));
const afterPinMeta = JSON.parse(await afterPinMetaObject.text());
const pinDiff = catalogMarkerDiff066(beforePinKeys, afterPinMeta.markerKeys);
assert.equal(pinDiff.add.length, 1, 'pin must add exactly one marker');
assert.equal(pinDiff.remove.length, 1, 'pin must remove exactly one marker');
assert.ok(pinDiff.add[0].includes('/profile/') && pinDiff.remove[0].includes('/profile/'), 'pin may only move profile marker');

const beforePrivateKeys = [...afterPinMeta.markerKeys];
await removeExploreCatalogTrack066(env, target.id);
const privateMetaObject = await env.PROFILE_MEDIA.get(catalogMetaKey066(target.id));
const privateMeta = JSON.parse(await privateMetaObject.text());
assert.equal(privateMeta.public, false);
assert.deepEqual(privateMeta.markerKeys, []);
for (const key of beforePrivateKeys) assert.equal(await env.PROFILE_MEDIA.get(key), null, `private marker remained: ${key}`);

await syncExploreCatalogTrack066(env, { ...target, likeCount: 99, profilePinned: true }, { isPublic: true });
const republishMetaObject = await env.PROFILE_MEDIA.get(catalogMetaKey066(target.id));
const republishMeta = JSON.parse(await republishMetaObject.text());
assert.equal(republishMeta.public, true);
assert.deepEqual(new Set(republishMeta.markerKeys), new Set(catalogMarkerKeys066(normalizeCatalogTrack066({ ...target, likeCount: 99, profilePinned: true }))), 'republish marker set mismatch');

const firstEnv = makeEnv();
const auth = {
  uid: 'first-user',
  displayName: 'First Artist',
  picture: 'https://example.test/a.webp',
  email: 'first@example.test',
};
const bootstrapShape = buildFirstPublisherSharedProfileBundle066(auth, 100);
assert.equal(bootstrapShape.firstPublisherBootstrap066, true);
const profile = await ensureFirstPublisherSharedProfile066(firstEnv, auth, 100);
assert.equal(profile.r2FirstPublisher066, true);
assert.equal(await firstPublisherProfileTrackDelta066(firstEnv, auth.uid, 'first-track'), 1);

const localKey = globalThis.exploreProfileR2Key(auth.uid);
const localObject = await firstEnv.EXPLORE_CACHE.get(localKey);
const localBundle = JSON.parse(await localObject.text());
localBundle.body.data.items = [{ id: 'first-track', ownerUid: auth.uid, publishedAt: 100 }];
localBundle.body.data.profile.trackCount = 1;
localBundle.body.data.revision += 1;
localBundle.revision += 1;
await globalThis.writeExploreR2Json(firstEnv, localKey, localBundle);
assert.equal(await firstPublisherProfileTrackDelta066(firstEnv, auth.uid, 'first-track'), 0, 'first-publisher retry would double-increment trackCount');
assert.equal(await finalizeFirstPublisherProfile066(firstEnv, auth.uid), true);
const finalized = firstEnv.__profiles.get(auth.uid);
assert.equal(finalized.firstPublisherBootstrap066, undefined, 'bootstrap marker survived finalize');
assert.equal(finalized.body.data.profile.trackCount, 1, 'first-publisher trackCount must finalize at 1');
assert.equal(finalized.body.data.items.length, 1, 'first-publisher first track missing after finalize');
assert.equal(await firstPublisherProfileTrackDelta066(firstEnv, auth.uid, 'first-track'), 0, 'finalized first publisher must remain idempotent');

const catalogKeys = env.PROFILE_MEDIA.keys(`${EXPLORE_R2_CATALOG_ROOT_066}/`);
assert.ok(catalogKeys.length > 0, 'catalog remained empty');
assert.equal(catalogKeys.some((key) => key.includes('track_search_fts') || key.includes('profile_search_fts')), false);

console.log('W2_PHASE_B_R2_INTEGRATION=PASS');
console.log('LATEST_DEEP_PAGING=PASS');
console.log('POPULAR_DEEP_PAGING=PASS');
console.log('PROFILE_DEEP_PAGING=PASS');
console.log('TITLE_SEARCH=PASS');
console.log('GENRE_SEARCH=PASS');
console.log('ARTIST_SEARCH=PASS');
console.log('LIKE_MARKER_DELTA=POPULAR_ONLY');
console.log('PIN_MARKER_DELTA=PROFILE_ONLY');
console.log('PRIVATE_REPUBLISH_MARKERS=PASS');
console.log('FIRST_PUBLISHER_RETRY_IDEMPOTENCY=PASS');
console.log('SHARED_PROFILE_MEDIA_WRITES=MOCK_ONLY');
