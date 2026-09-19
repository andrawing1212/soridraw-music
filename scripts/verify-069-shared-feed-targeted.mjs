import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../cloudflare/explore-worker/runtime/shared-feed-targeted-069.js', import.meta.url);
const source = readFileSync(file, 'utf8').replace(/^export\s+/gm, '');
const code = new Function(
  'sortExploreFeedItems012', 'buildExploreFeedCursor012', 'EXPLORE_R2_FEED_LIMIT',
  'exploreSharedFeedR2Key059', 'isExploreR2CatalogEnabled066', 'catalogMetaKey066',
  source + '\nreturn { sharedFeedNext069, syncExploreSharedFeedTargeted069 };'
);

const api = code(
  (items, sort) => [...items].sort((a, b) => sort === 'popular'
    ? Number(b.likeCount || 0) - Number(a.likeCount || 0)
    : Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
  () => 'cursor-test',
  40,
  (sort) => 'shared/' + sort,
  () => true,
  (id) => 'meta/' + id,
);

class FakeR2 {
  constructor() { this.objects = new Map(); this.writes = []; this.failOnce = ''; this.counter = 0; }
  seed(key, payload) { this.objects.set(key, { data: structuredClone(payload), etag: String(++this.counter) }); }
  async get(key) {
    const o = this.objects.get(key);
    if (!o) return null;
    const copy = structuredClone(o.data);
    return { etag: o.etag, customMetadata: {}, text: async () => JSON.stringify(copy) };
  }
  async put(key, body, opts) {
    if (this.failOnce === key) {
      this.failOnce = '';
      const current = this.objects.get(key);
      current.data.payload.data.items.push({ id: 'concurrent', publishedAt: 7 });
      current.etag = String(++this.counter);
      return null;
    }
    const current = this.objects.get(key);
    if (opts?.onlyIf?.etagMatches !== current?.etag) return null;
    const next = JSON.parse(body);
    this.seed(key, next);
    this.writes.push(key);
    return {};
  }
  items(sort) { return this.objects.get('shared/' + sort).data.payload.data.items; }
}

const bucket = new FakeR2();
const target = { id: 'target', title: 'Original', likeCount: 1, publishedAt: 2 };
const other = { id: 'other', title: 'Untouched', likeCount: 3, publishedAt: 4 };
const bundle = (items) => ({ payload: { data: { items: structuredClone(items), nextCursor: null } }, updatedAt: 1 });
bucket.seed('shared/latest', bundle([other, target]));
bucket.seed('shared/popular', bundle([other, target]));
bucket.seed('meta/target', { trackId: 'target', public: false });
const env = { PROFILE_MEDIA: bucket, DB: new Proxy({}, { get: () => { throw Error('D1 access forbidden'); } }) };

let result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'private', trackId: 'target' });
assert.equal(result.ok, true);
assert.equal(bucket.writes.length, 2);
for (const sort of ['latest', 'popular']) {
  assert.deepEqual(bucket.items(sort), [other]);
}
result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'private', trackId: 'target' });
assert.equal(result.ok, true);
assert.equal(bucket.writes.length, 2, 'repeated private must not rewrite a shared snapshot');
console.log('069_PRIVATE_TARGET_ONLY_IDEMPOTENT=PASS');

// Republish after catalog state is public; the same helper must restore both snapshots.
bucket.seed('meta/target', { trackId: 'target', public: true });
result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'publish', trackId: 'target', item: target });
assert.equal(result.ok, true);
for (const sort of ['latest', 'popular']) {
  assert.deepEqual(new Set(bucket.items(sort).map(x => x.id)), new Set(['target', 'other']));
}
console.log('069_REPUBLISH_TARGET_ONLY=PASS');

// An old, delayed private cannot remove a now-public catalog item.
const writesBeforeSkip = bucket.writes.length;
result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'private', trackId: 'target' });
assert.equal(result.ok, true);
assert.equal(result.results.every(x => x.skippedNewerState), true);
assert.equal(bucket.writes.length, writesBeforeSkip);
console.log('069_LATE_PRIVATE_GUARD=PASS');

// Options mutate only an existing track, never introduce a private/absent card.
result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'options', trackId: 'target', patch: { profilePinned: true } });
assert.equal(result.ok, true);
for (const sort of ['latest', 'popular']) {
  assert.equal(bucket.items(sort).find(x => x.id === 'target').profilePinned, true);
  assert.equal(bucket.items(sort).find(x => x.id === 'other').title, 'Untouched');
}
console.log('069_OPTIONS_TARGET_ONLY=PASS');

// An unrelated writer wins a CAS once. Retry must preserve its additional item.
bucket.seed('meta/target', { trackId: 'target', public: false });
bucket.failOnce = 'shared/latest';
result = await api.syncExploreSharedFeedTargeted069(env, { kind: 'private', trackId: 'target' });
assert.equal(result.ok, true);
assert.equal(bucket.items('shared/latest').some(x => x.id === 'concurrent'), true);
assert.equal(bucket.items('shared/latest').some(x => x.id === 'target'), false);
assert.equal(bucket.items('shared/popular').some(x => x.id === 'target'), false);
console.log('069_CAS_CONCURRENT_OTHER_ITEM_PRESERVED=PASS');

const malformed = new FakeR2();
malformed.seed('shared/latest', bundle([target]));
malformed.seed('shared/popular', bundle([target]));
malformed.seed('meta/target', { trackId: 'target' });
result = await api.syncExploreSharedFeedTargeted069({ PROFILE_MEDIA: malformed }, { kind: 'private', trackId: 'target' });
assert.equal(malformed.writes.length, 0);
assert.equal(result.results.every(x => x.skippedNewerState), true);
console.log('069_INVALID_CATALOG_FAIL_CLOSED=PASS');
console.log('069_NO_D1_READ_WRITE_AND_NO_FULL_REBUILD=PASS');
