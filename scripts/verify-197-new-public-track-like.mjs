import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

// Exercise the actual production membership reader + visible-track hydration.
// Never replace these with a separate test implementation of their logic.
const source = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const extract = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'missing source: ' + start);
  return source.slice(from, to);
};
const implementation = [
  extract('export const readExploreTrackLikeMembership127 =', '\nconst scopedLikeKey127 ='),
  extract('export const getExploreLikedTrackIds =', '\n// App129 single-authority rule:'),
].join('\n').replaceAll('export const ', 'const ');
const compiled = (await transform(implementation, {
  loader: 'ts', format: 'cjs', target: 'es2022',
})).code;

const createHarness = ({ complete, existing = {}, pending = {}, unresolved = {}, serverLiked = [] }) => {
  const uid = 'test-account';
  const cache = new Map(Object.entries(existing));
  const verified = new Set();
  const calls = [];
  let writes = 0;
  const context = {
    EXPLORE_LIKE_BATCH_MAX: 50,
    EXPLORE_LIKE_BASELINE_127: 'complete-baseline',
    baselineCompleted127: complete ? new Set([uid]) : new Set(),
    scopedLikeKey127: (prefix, id) => prefix + ':' + id,
    readLikeLocal127: () => '',
    hasLocalLikeCatalog135: () => true, // Existing device, even if R2 is partial.
    readLikeOutbox: () => pending,
    readSnapshotPending127: () => unresolved,
    getLikedStateCache: () => cache,
    readTargetedVerifiedLikeTracks127: () => verified,
    installLikeSignalRetry127: () => {},
    checkExplorePersonalLikeRevision127: async () => {},
    ensurePersonalLikeBaseline127: async () => {},
    persistLikedStateCache: () => { writes += 1; },
    persistTargetedVerifiedLikeTracks127: () => {},
    markLocalLikeCatalogReady135: () => {},
    schedulePendingFlush: () => {},
    requestExploreLike: async (_user, route) => {
      calls.push(route);
      return { data: { likedTrackIds: serverLiked } };
    },
    console,
  };
  const factory = new Function(...Object.keys(context),
    compiled + '\nreturn { readExploreTrackLikeMembership127, getExploreLikedTrackIds };');
  return {
    service: factory(...Object.values(context)),
    user: { uid },
    cache,
    calls,
    get writes() { return writes; },
  };
};

const complete = createHarness({
  complete: true, existing: { 'existing-liked': true, 'existing-unliked': false },
});
assert.equal(complete.service.readExploreTrackLikeMembership127(complete.user.uid, 'newly-published'), undefined);
assert.deepEqual(
  await complete.service.getExploreLikedTrackIds(complete.user, [
    'existing-liked', 'existing-unliked', 'newly-published',
  ]),
  ['existing-liked'],
);
assert.equal(complete.service.readExploreTrackLikeMembership127(complete.user.uid, 'newly-published'), false,
  'newly published song must have a click-authoritative unliked state');
assert.equal(complete.cache.get('existing-liked'), true, 'existing positive heart protected');
assert.equal(complete.cache.get('existing-unliked'), false, 'existing negative heart protected');
assert.deepEqual(complete.calls, [], 'complete snapshot may initialize unseen negative ID with no D1 read');
assert.equal(complete.writes, 1, 'only the new local membership needs durable persistence');
await complete.service.getExploreLikedTrackIds(complete.user, ['newly-published']);
assert.equal(complete.writes, 1, 'warm revisit must not rewrite cache');
assert.deepEqual(complete.calls, [], 'warm revisit must not read server');

const pending = createHarness({
  complete: true, existing: { 'existing-liked': true },
  pending: { 'newly-published': { desiredLiked: true, retryCount: 0 } },
});
assert.deepEqual(await pending.service.getExploreLikedTrackIds(pending.user, ['newly-published']), ['newly-published']);
assert.equal(pending.service.readExploreTrackLikeMembership127(pending.user.uid, 'newly-published'), true,
  'unsubmitted local click wins');
assert.equal(pending.cache.has('newly-published'), false, 'new negative seed must not overwrite pending click');
assert.equal(pending.writes, 0);

const accepted = createHarness({ complete: true, unresolved: { 'newly-published': true } });
assert.deepEqual(await accepted.service.getExploreLikedTrackIds(accepted.user, ['newly-published']), ['newly-published']);
assert.equal(accepted.service.readExploreTrackLikeMembership127(accepted.user.uid, 'newly-published'), true,
  'accepted cross-device heart wins');

const partial = createHarness({ complete: false, existing: { 'existing-liked': true } });
assert.deepEqual(await partial.service.getExploreLikedTrackIds(partial.user, ['existing-liked', 'newly-published']),
  ['existing-liked']);
assert.equal(partial.calls.length, 1, 'partial snapshot verifies only missing visible ID');
assert.equal(new URL('https://example.test' + partial.calls[0]).searchParams.get('trackIds'),
  'newly-published');
assert.equal(partial.service.readExploreTrackLikeMembership127(partial.user.uid, 'newly-published'), false);
await partial.service.getExploreLikedTrackIds(partial.user, ['existing-liked', 'newly-published']);
assert.equal(partial.calls.length, 1, 'targeted verification is reused on return');

const remoteTrue = createHarness({ complete: false, serverLiked: ['newly-published'] });
assert.deepEqual(await remoteTrue.service.getExploreLikedTrackIds(remoteTrue.user, ['newly-published']),
  ['newly-published']);
assert.equal(remoteTrue.service.readExploreTrackLikeMembership127(remoteTrue.user.uid, 'newly-published'), true,
  'partial catalog cannot guess a remote liked track is unliked');

console.log('APP197_NEW_PUBLISHED_FIRST_LIKE_READY=PASS');
console.log('APP197_EXISTING_HEART_AND_UNSENT_INTENT_PROTECTED=PASS');
console.log('APP197_PARTIAL_CATALOG_TARGETED_ONLY=PASS');
console.log('APP197_WARM_REVISIT_R0_W0=PASS');
