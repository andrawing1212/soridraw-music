import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import vm from 'node:vm';

const source = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const extract = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `production source range missing: ${start}`);
  return source.slice(from, to);
};

// Compile and execute the production request + ensure implementations rather
// than copying their reconciliation algorithm into this verifier.
const production = [
  extract('const requestPersonalLikeBaseline127 =', '// One-time per user migration'),
  extract('const ensurePersonalLikeBaseline127 =', 'export const invalidateExplorePersonalLikeBaseline127'),
].join('\n');
const compiled = (await transform(production, { loader: 'ts', format: 'cjs', target: 'es2022' })).code;

const createHarness = ({ markers = {}, unresolved = {}, outbox = {}, responses = [], onFetch }) => {
  const storage = new Map(Object.entries(markers));
  const cache = new Map();
  const baselineCompleted127 = new Set();
  const baselineInFlight127 = new Map();
  let signal = 0;
  let fetches = 0;
  const writes = [];
  const responseQueue = [...responses];
  const context = {
    EXPLORE_API_BASE: 'https://preview.invalid',
    URLSearchParams,
    buildAuthHeaders: async () => ({}),
    recordCloudflareResponse: () => {},
    fetch: async (url) => {
      fetches += 1;
      onFetch?.({ fetches, setSignal: value => { signal = value; } });
      const data = responseQueue.shift();
      assert.ok(data, 'unexpected production fetch');
      return { ok: true, status: 200, json: async () => ({ ok: true, data }) };
    },
    EXPLORE_LIKE_PARTIAL_BASELINE_161: 'partial',
    EXPLORE_LIKE_REPAIR_ATTEMPTED_182: 'repair182',
    EXPLORE_LIKE_BASELINE_127: 'baseline127',
    EXPLORE_LIKE_SETTLEMENT_ATTEMPTED_189: 'settlement189',
    EXPLORE_LIKE_REPAIR_TARGET_127: 'repairTarget',
    scopedLikeKey127: (prefix, uid) => `${prefix}:${uid}`,
    readLikeLocal127: key => storage.get(key) || '',
    writeLikeLocal127: (key, value) => { storage.set(key, value); writes.push([key, value]); },
    readSnapshotPending127: () => ({ ...unresolved }),
    writeSnapshotPending127: (_uid, value) => {
      Object.keys(unresolved).forEach(key => delete unresolved[key]);
      Object.assign(unresolved, value);
    },
    readLikeOutbox: () => outbox,
    readCurrentPersonalLikeRevision130: uid => storage.get('revision:' + uid) || '',
    readSeenLikeSignal127: () => signal,
    readRepairTarget127: () => 0,
    getLikedStateCache: () => cache,
    persistLikedStateCache: () => {},
    reconcileExploreLikedTrackCollectionSnapshot127: () => {},
    markLocalLikeCatalogReady135: () => {},
    markSeenLikeSignal127: () => {},
    hasLocalLikeCatalog135: () => true,
    seedExploreLikedTrackCandidates129: () => {},
    persistLikedStateCache127: () => {},
    console,
  };
  const names = Object.keys(context);
  const factory = new Function(...names, 'baselineCompleted127', 'baselineInFlight127',
    `${compiled}; return ensurePersonalLikeBaseline127;`);
  const ensure = factory(...Object.values(context), baselineCompleted127, baselineInFlight127);
  return { ensure, cache, storage, unresolved, writes, fetchCount: () => fetches };
};

const uid = 'test-uid';
const key = name => `${name}:${uid}`;
const ids = Array.from({ length: 10 }, (_, index) => `track-${index + 1}`);
const stale = () => Object.fromEntries(ids.slice(5).map(id => [id, false]));
const snapshot = (freshCanonicalSettlement, sourceName = 'accepted-pre-aggregate-r2') => ({
  likedTrackIds: ids,
  likesComplete: true,
  exactLikeCount: ids.length,
  likesSnapshotSource: sourceName,
  freshCanonicalSettlement,
});

const repaired = createHarness({
  markers: { [key('baseline127')]: '1' }, unresolved: stale(), responses: [snapshot(true)],
});
await repaired.ensure({ uid });
assert.equal(repaired.fetchCount(), 1, 'app156 BASELINE=1 unresolved state enters once');
assert.deepEqual(repaired.unresolved, {}, 'fresh proof releases historical guards');
assert.equal([...repaired.cache.values()].filter(Boolean).length, 10, 'production cache path converges 5 to 10');
await repaired.ensure({ uid });
assert.equal(repaired.fetchCount(), 1, 'UID-scoped marker/in-memory completion prevents repeat read');

// A previous one-time failed attempt must not permanently trap an old false
// guard after the private R2 revision advances. Never reread the same revision.
const changedRevision = createHarness({
  markers: { [key('baseline127')]: '1', [key('settlement189')]: '1', ['revision:' + uid]: 'r2-after-queue' },
  unresolved: stale(), responses: [snapshot(true)],
});
await changedRevision.ensure({ uid }, 'r2-after-queue');
assert.equal(changedRevision.fetchCount(), 1, 'new private revision admits one fresh canonical proof');
assert.deepEqual(changedRevision.unresolved, {}, 'settled next revision clears the previous false guards');
await changedRevision.ensure({ uid }, 'r2-after-queue');
assert.equal(changedRevision.fetchCount(), 1, 'same private revision cannot repeat canonical read');
// Regression: revision check invalidates BASELINE=1 BEFORE calling ensure.
// App158 passed the revision but still required the now-cleared baseline marker,
// so it silently accepted the stale false guards without requesting proof.
const invalidatedBaseline = createHarness({
  markers: { [key('settlement189')]: '1', ['revision:' + uid]: 'r2-after-queue' },
  unresolved: stale(), responses: [snapshot(true)],
});
await invalidatedBaseline.ensure({ uid }, 'r2-after-queue');
assert.equal(invalidatedBaseline.fetchCount(), 1,
  'revision-invalidated baseline must still request the bounded canonical proof');
assert.deepEqual(invalidatedBaseline.unresolved, {},
  'revision-invalidated complete canonical proof removes stale false guards');
assert.equal([...invalidatedBaseline.cache.values()].filter(Boolean).length, 10);
await invalidatedBaseline.ensure({ uid }, 'r2-after-queue');
assert.equal(invalidatedBaseline.fetchCount(), 1, 'unchanged private revision cannot recheck D1');

const alreadyCheckedRevision = createHarness({
  markers: { [key('baseline127')]: '1', [key('settlement189')]: 'revision:r2-after-queue', ['revision:' + uid]: 'r2-after-queue' },
  unresolved: stale(),
});
await alreadyCheckedRevision.ensure({ uid }, 'r2-after-queue');
assert.equal(alreadyCheckedRevision.fetchCount(), 0, 'already failed same revision stays bounded');

const partial = createHarness({
  markers: { [key('partial')]: '1', [key('repair182')]: '1' },
  unresolved: stale(), responses: [snapshot(true)],
});
await partial.ensure({ uid });
assert.equal(partial.fetchCount(), 1, 'app156 PARTIAL+REPAIR_ATTEMPTED unresolved state enters once');

const provenanceOnly = createHarness({
  markers: { [key('baseline127')]: '1' }, unresolved: stale(),
  responses: [snapshot(false, 'verified-single-user-d1-182')],
});
await provenanceOnly.ensure({ uid });
assert.equal(Object.keys(provenanceOnly.unresolved).length, 5,
  'persistent provenance and accepted pre-aggregate response cannot release guards');

const liveOutbox = { 'track-10': { desiredLiked: false } };
const protectedClick = createHarness({
  markers: { [key('baseline127')]: '1' }, unresolved: stale(), outbox: liveOutbox,
  responses: [snapshot(true)],
});
await protectedClick.ensure({ uid });
assert.equal(protectedClick.unresolved['track-10'], false, 'live outbox guard remains protected');
assert.equal(protectedClick.cache.get('track-10'), false, 'unsent local intention wins over settlement');

const raced = createHarness({
  markers: { [key('baseline127')]: '1' }, unresolved: stale(),
  responses: [snapshot(true)],
  onFetch: ({ fetches, setSignal }) => setSignal(fetches),
});
await assert.rejects(raced.ensure({ uid }), /signal advanced during settlement check/);
assert.equal(raced.fetchCount(), 1, 'settlement race does not repeat the authenticated check');
assert.equal(Object.keys(raced.unresolved).length, 5, 'signal race fails closed before guard deletion');

const healthy = createHarness({ markers: { [key('baseline127')]: '1' }, unresolved: {} });
await healthy.ensure({ uid });
assert.equal(healthy.fetchCount(), 0, 'healthy completed cache remains D1 R0');

// App164 cost regression: a legacy PARTIAL marker may require one bounded
// authenticated recovery after a user-data change. Once it is confirmed,
// reopening Explore or upgrading the app must not reread that user's D1 rows.
const firstPartialRepair = createHarness({
  markers: { [key('partial')]: '1' }, unresolved: {}, responses: [snapshot(true)],
});
await firstPartialRepair.ensure({ uid });
assert.equal(firstPartialRepair.fetchCount(), 1, 'legacy partial metadata permits one bounded recovery');
assert.equal(firstPartialRepair.storage.get(key('repair182')), '1',
  'one-time repair guard must persist independently of the app version');
assert.equal(firstPartialRepair.storage.get(key('baseline127')), '1',
  'complete recovered snapshot becomes the durable local catalog');
const afterAppUpdate = createHarness({
  markers: Object.fromEntries(firstPartialRepair.storage), unresolved: {},
});
await afterAppUpdate.ensure({ uid });
assert.equal(afterAppUpdate.fetchCount(), 0,
  'same account after app update must use completed local catalog, D1 R0');
await afterAppUpdate.ensure({ uid });
assert.equal(afterAppUpdate.fetchCount(), 0, 'normal page revisit must stay D1 R0');


assert.match(source, /invalidateExplorePersonalLikeBaseline127\(uid\);\s*await ensurePersonalLikeBaseline127\(user, revision\);/,
  'changed revision must pass proof token through invalidation');
assert.match(source, /freshCanonicalSettlement: complete && payload\.data\.freshCanonicalSettlement === true/);
assert.doesNotMatch(source, /canonicalSettled:[\s\S]{0,120}likesSnapshotSource/);
assert.match(worker, /verifyFreshPersonalLikeSettlement189[\s\S]*await readPending\(\)[\s\S]*SELECT l\.track_id[\s\S]*await readPending\(\)[\s\S]*bucket\.head\(key\)/);
assert.match(worker, /freshCanonicalSettlement = Boolean\(settledLikeState189\)/);

const workerHelperStart = worker.indexOf('async function verifyFreshPersonalLikeSettlement189(');
const workerHelperEnd = worker.indexOf('\nasync function handleMySocialSnapshot042(', workerHelperStart);
assert.ok(workerHelperStart > 0 && workerHelperEnd > workerHelperStart);
const workerContext = {
  Number, String, Set, Array, JSON, Boolean,
  exploreSharedLikesKey061: uidValue => `likes/${uidValue}`,
  normalizeSharedLikesState161: raw => ({
    exact: raw.exact === true,
    likedIds: new Set(raw.likedTrackIds),
    exactLikeCount: raw.likedTrackIds.length,
    source: raw.source,
  }),
};
vm.runInNewContext(
  worker.slice(workerHelperStart, workerHelperEnd) +
    '\nthis.verify189 = verifyFreshPersonalLikeSettlement189;',
  workerContext,
);
const workerScenario = ({ queue = [{ q069: 0, q075: 0 }, { q069: 0, q075: 0 }],
  canonical = ids, r2 = ids, initialEtag = 'same', finalEtag = initialEtag } = {}) => {
  const pending = [...queue];
  let canonicalReads = 0;
  const env = {
    PROFILE_MEDIA: {
      get: async () => ({ etag: initialEtag, text: async () => JSON.stringify({ exact: true, likedTrackIds: r2 }) }),
      head: async () => ({ etag: finalEtag }),
    },
    DB: { prepare: sql => ({ bind: () => ({
      first: async () => pending.shift(),
      all: async () => { canonicalReads += 1; assert.match(sql, /LIMIT 2001/); return { results: canonical.map(track_id => ({ track_id })) }; },
    }) }) },
  };
  return { env, canonicalReads: () => canonicalReads };
};
const settledWorker = workerScenario();
assert.ok(await workerContext.verify189(settledWorker.env, uid), 'matching bounded set returns fresh proof');
assert.equal(settledWorker.canonicalReads(), 1);
assert.equal(await workerContext.verify189(workerScenario({ queue: [{ q069: 1, q075: 0 }] }).env, uid), null,
  'initial pending queue fails closed');
assert.equal(await workerContext.verify189(workerScenario({ queue: [{ q069: 0, q075: 0 }, { q069: 0, q075: 1 }] }).env, uid), null,
  'queue race after canonical read fails closed');
assert.equal(await workerContext.verify189(workerScenario({ canonical: ids.slice(0, 9) }).env, uid), null,
  'canonical/R2 mismatch fails closed');
assert.equal(await workerContext.verify189(workerScenario({ finalEtag: 'changed' }).env, uid), null,
  'R2 ETag race fails closed');

console.log('APP189_PRODUCTION_BASELINE_PATH_5_TO_10=PASS');
console.log('APP189_APP156_MARKERS_ONE_TIME_ENTRY=PASS');
console.log('APP189_FRESH_PROOF_AND_LIVE_OUTBOX=PASS');
console.log('APP189_ACCEPTED_PREAGGREGATE_AND_RACE_FAIL_CLOSED=PASS');
console.log('APP189_HEALTHY_CACHE_D1_R0=PASS');
console.log('APP164_ONE_TIME_PARTIAL_REPAIR_THEN_APP_UPDATE_D1_R0=PASS');
console.log('APP189_WORKER_QUEUE_SET_ETAG_RACE_GUARDS=PASS');

console.log('APP189_CHANGED_PRIVATE_REVISION_BOUNDED_SETTLEMENT_RETRY=PASS');

console.log('APP189_INVALIDATED_BASELINE_REVISION_RECOVERY=PASS');
