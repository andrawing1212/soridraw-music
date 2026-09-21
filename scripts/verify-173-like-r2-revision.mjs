import assert from 'node:assert/strict';
import {
  applyGenerationGuard173,
  applyPersonalLikeRevision173,
  createLikeR2RevisionPublisher173,
} from '../cloudflare/explore-worker/runtime/like-r2-revision-173.mjs';

class FakeBucket {
  constructor(entries = {}) {
    this.map = new Map();
    this.seq = 0;
    this.failPuts = new Map();
    for (const [key, value] of Object.entries(entries)) this.seed(key, value);
  }
  seed(key, value) {
    this.map.set(key, { body: JSON.stringify(value), etag: String(++this.seq), customMetadata: {} });
  }
  async get(key) {
    const row = this.map.get(key);
    if (!row) return null;
    return {
      etag: row.etag,
      customMetadata: { ...row.customMetadata },
      text: async () => row.body,
    };
  }
  failNextPuts(key, count) {
    this.failPuts.set(key, Math.max(0, Number(count) || 0));
  }
  async put(key, body, options = {}) {
    const remaining = this.failPuts.get(key) || 0;
    if (remaining > 0) {
      this.failPuts.set(key, remaining - 1);
      return null;
    }
    const row = this.map.get(key);
    const onlyIf = options.onlyIf || {};
    if (onlyIf.etagMatches && row?.etag !== onlyIf.etagMatches) return null;
    if (onlyIf.etagDoesNotMatch === '*' && row) return null;
    const saved = { body: String(body), etag: String(++this.seq), customMetadata: { ...(options.customMetadata || {}) } };
    this.map.set(key, saved);
    return { etag: saved.etag };
  }
  json(key) {
    const row = this.map.get(key);
    return row ? JSON.parse(row.body) : null;
  }
}

const legacy = { id: 't', likeCount: 4, stats: { likeCount: 4 } };
let guarded = applyGenerationGuard173(legacy, 5, 0);
assert.equal(guarded.ok, true);
assert.equal(guarded.item.likeCount, 5);
assert.equal(guarded.item.likeGeneration171, 0);
guarded = applyGenerationGuard173(guarded.item, 6, 1);
assert.equal(guarded.ok, true);
assert.equal(guarded.item.likeCount, 6);
const newer = guarded.item;
assert.equal(applyGenerationGuard173(newer, 5, 0).skippedOlder, true);
assert.equal(applyGenerationGuard173(newer, 6, 1).duplicate, true);
assert.equal(applyGenerationGuard173(newer, 7, 1).conflict, true);

const longIds = Array.from({ length: 2001 }, (_, i) => 'legacy-' + i);
const personal = applyPersonalLikeRevision173({
  schemaVersion: 1,
  uid: 'u',
  likedTrackIds: longIds,
}, { uid: 'u', trackId: 'new-track', liked: true, revision: 1, operationId: 'op-1' });
assert.equal(personal.ok, true);
assert.equal(personal.bundle.likedTrackIds.length, 2002, '173 must not reintroduce 2,000 truncation');
assert.equal(personal.bundle.revisionProtocol173, 'd1only171');
assert.equal(applyPersonalLikeRevision173(personal.bundle, {
  uid: 'u', trackId: 'new-track', liked: true, revision: 1, operationId: 'op-1',
}).duplicate, true);
assert.equal(applyPersonalLikeRevision173(personal.bundle, {
  uid: 'u', trackId: 'new-track', liked: false, revision: 1, operationId: 'op-conflict',
}).conflict, true);

const trackKey = (id) => `card/${id}`;
const feedKey = (sort) => `feed/${sort}`;
const profileKey = (uid) => `profile/${uid}`;
const personalKey = (uid) => `internal/explore/shared-social-v114/likes/${uid}.json`;
const card = (id, owner, count) => ({ schemaVersion: 1, trackId: id, card: { id, ownerUid: owner, likeCount: count, stats: { likeCount: count } } });
const feedBundle = (items) => ({ payload: { data: { items, sort: 'x' } } });
const profileBundle = (uid, items) => ({ uid, body: { data: { profile: { uid }, items } } });
const item = (id, owner, count, publishedAt = 1) => ({ id, ownerUid: owner, likeCount: count, stats: { likeCount: count }, publishedAt });

const bucket = new FakeBucket({
  [trackKey('t1')]: card('t1', 'owner', 4),
  [trackKey('t2')]: card('t2', 'owner', 3),
  [feedKey('latest')]: feedBundle([item('t1', 'owner', 4, 10), item('t2', 'owner', 3, 9)]),
  [feedKey('popular')]: feedBundle([item('t1', 'owner', 4, 10), item('t2', 'owner', 3, 9)]),
  [profileKey('owner')]: profileBundle('owner', [item('t1', 'owner', 4), item('t2', 'owner', 3)]),
  [personalKey('u')]: { schemaVersion: 1, uid: 'u', likedTrackIds: [] },
});
const publisher = createLikeR2RevisionPublisher173({ PROFILE_MEDIA: bucket }, {
  trackCardKey: trackKey,
  feedKey,
  profileKey,
  sortItems: (items, sort) => sort === 'popular'
    ? [...items].sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0))
    : [...items].sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
  feedLimit: 40,
});

let published = await publisher.publish({
  uid: 'u', trackId: 't1', liked: true, likeCount: 5,
  revision: 1, generation: 1, operationId: 'u:t1:1', status: 'applied',
});
assert.equal(published.ok, true);
assert.equal(bucket.json(trackKey('t1')).card.likeCount, 5);
assert.equal(bucket.json(feedKey('latest')).payload.data.items[0].likeCount, 5);
assert.equal(bucket.json(profileKey('owner')).body.data.items[0].likeCount, 5);
assert.deepEqual(bucket.json(personalKey('u')).likedTrackIds, ['t1']);

published = await publisher.publish({
  uid: 'u', trackId: 't1', liked: false, likeCount: 4,
  revision: 2, generation: 2, operationId: 'u:t1:2', status: 'applied',
});
assert.equal(published.ok, true);
assert.equal(bucket.json(trackKey('t1')).card.likeCount, 4);
assert.deepEqual(bucket.json(personalKey('u')).likedTrackIds, []);

published = await publisher.publish({
  uid: 'u', trackId: 't1', liked: true, likeCount: 5,
  revision: 1, generation: 1, operationId: 'u:t1:1', status: 'duplicate',
});
assert.equal(published.ok, true);
assert.equal(bucket.json(trackKey('t1')).card.likeCount, 4);
assert.deepEqual(bucket.json(personalKey('u')).likedTrackIds, []);
assert.equal(bucket.json(personalKey('u')).likeRevisionByTrack171.t1.revision, 2);

const p1 = publisher.publish({
  uid: 'u', trackId: 't1', liked: true, likeCount: 5,
  revision: 3, generation: 3, operationId: 'pc-t1-3', status: 'applied',
});
const p2 = publisher.publish({
  uid: 'u', trackId: 't2', liked: true, likeCount: 4,
  revision: 1, generation: 1, operationId: 'mobile-t2-1', status: 'applied',
});
const both = await Promise.all([p1, p2]);
assert.equal(both.every((x) => x.ok), true);
const merged = bucket.json(personalKey('u'));
assert.equal(new Set(merged.likedTrackIds).has('t1'), true);
assert.equal(new Set(merged.likedTrackIds).has('t2'), true);
assert.equal(merged.likeRevisionByTrack171.t1.revision, 3);
assert.equal(merged.likeRevisionByTrack171.t2.revision, 1);

const popularIds = bucket.json(feedKey('popular')).payload.data.items.map((x) => x.id);
assert.deepEqual(new Set(popularIds), new Set(['t1', 't2']));

// Cross-store atomicity is impossible, so 173 deliberately uses an idempotent
// retry protocol: D1 settles once, any partial R2 projection may fail, and the
// exact same canonical revision/generation can be replayed until every surface
// converges. The failed attempt must not make a later retry conflict with itself.
const retryBucket = new FakeBucket({
  [trackKey('retry')]: card('retry', 'owner', 0),
  [feedKey('latest')]: feedBundle([item('retry', 'owner', 0, 11)]),
  [feedKey('popular')]: feedBundle([item('retry', 'owner', 0, 11)]),
  [profileKey('owner')]: profileBundle('owner', [item('retry', 'owner', 0)]),
  [personalKey('u')]: { schemaVersion: 1, uid: 'u', likedTrackIds: [] },
});
const retryPublisher = createLikeR2RevisionPublisher173({ PROFILE_MEDIA: retryBucket }, {
  trackCardKey: trackKey,
  feedKey,
  profileKey,
  sortItems: (items, sort) => sort === 'popular'
    ? [...items].sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0))
    : [...items].sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
  feedLimit: 40,
});
retryBucket.failNextPuts(feedKey('latest'), 8);
const retryUpdate = {
  uid: 'u', trackId: 'retry', liked: true, likeCount: 1,
  revision: 1, generation: 1, operationId: 'retry-op-1', status: 'applied',
};
const firstRetry = await retryPublisher.publish(retryUpdate);
assert.equal(firstRetry.ok, false);
assert.equal(firstRetry.stage, 'feeds');
assert.deepEqual(retryBucket.json(personalKey('u')).likedTrackIds, ['retry']);
assert.equal(retryBucket.json(trackKey('retry')).card.likeCount, 1);
assert.equal(retryBucket.json(feedKey('latest')).payload.data.items[0].likeCount, 0);
assert.equal(retryBucket.json(feedKey('popular')).payload.data.items[0].likeCount, 1);
assert.equal(retryBucket.json(profileKey('owner')).body.data.items[0].likeCount, 0);

const secondRetry = await retryPublisher.publish(retryUpdate);
assert.equal(secondRetry.ok, true);
assert.deepEqual(retryBucket.json(personalKey('u')).likedTrackIds, ['retry']);
assert.equal(retryBucket.json(trackKey('retry')).card.likeCount, 1);
assert.equal(retryBucket.json(feedKey('latest')).payload.data.items[0].likeCount, 1);
assert.equal(retryBucket.json(feedKey('popular')).payload.data.items[0].likeCount, 1);
assert.equal(retryBucket.json(profileKey('owner')).body.data.items[0].likeCount, 1);
assert.equal(retryBucket.json(personalKey('u')).likeRevisionByTrack171.retry.revision, 1);
assert.equal(retryBucket.json(trackKey('retry')).card.likeGeneration171, 1);

console.log('173_GENERATION_STALE_PUBLICATION_BLOCKED=PASS');
console.log('173_PARTIAL_R2_FAILURE_SAME_CANONICAL_RETRY_CONVERGES=PASS');
console.log('173_PERSONAL_REVISION_STALE_OVERWRITE_BLOCKED=PASS');
console.log('173_PERSONAL_PC_MOBILE_DIFFERENT_TRACK_CAS_MERGE=PASS');
console.log('173_LEGACY_2000_TRUNCATION_NOT_REINTRODUCED=PASS');
console.log('173_POPULAR_POLICY_BOUNDED_CURRENT_WINDOW_REORDER_ONLY=PASS');
