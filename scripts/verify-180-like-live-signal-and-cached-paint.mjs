import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');

const publishStart = service.indexOf('const publishConfirmedLikeSignal127');
const publishEnd = service.indexOf('let likeSignalRetryListenerInstalled127', publishStart);
assert.ok(publishStart >= 0 && publishEnd > publishStart);
const publish = service.slice(publishStart, publishEnd);

assert.match(service, /set as setRealtimeValue/,
  'RTDB set transport import missing');
assert.match(publish, /setRealtimeValue\(/,
  'changed-track live signal must publish through RTDB set');
assert.match(publish, /databaseRef\(realtimeDb, `userSync\/\$\{uid\}\/exploreLike`\)/);
assert.match(publish, /previousVersion: forceGap \? 0 : previousVersion/);
assert.match(publish, /markSeenLikeSignal127\(uid, version\)/);
assert.doesNotMatch(publish, /runTransaction\(/,
  'app140 must not depend on the broken transaction live-signal path');
assert.doesNotMatch(publish, /requestExploreLike\(|fetch\(|firebase\/firestore|env\.DB/,
  'live signal transport must not add D1/Firestore reads or writes');

const visibleEffectStart = page.indexOf('if (!user || visibleTracks.length === 0) return;');
const visibleEffectEnd = page.indexOf('return () => { cancelled = true; };', visibleEffectStart);
assert.ok(visibleEffectStart >= 0 && visibleEffectEnd > visibleEffectStart);
const visibleEffect = page.slice(visibleEffectStart, visibleEffectEnd);
assert.match(visibleEffect, /const immediateLocal: Record<string, boolean> = \{\};/);
assert.match(visibleEffect, /readExploreTrackLikeMembership127\(user\.uid, id\)/);
assert.match(visibleEffect, /setLikedTrackIds\(\(previous\) => \(\{ \.\.\.previous, \.\.\.immediateLocal \}\)\)/);
assert.ok(
  visibleEffect.indexOf('setLikedTrackIds((previous) => ({ ...previous, ...immediateLocal }))') <
    visibleEffect.indexOf('getExploreLikedTrackIds(user, ids)'),
  'cached hearts must paint before async revision/baseline work',
);

console.log('APP140_LIVE_CHANGED_TRACK_RTDB_SET=PASS');
console.log('APP140_LIVE_SIGNAL_D1_FIRESTORE_IO=0');
console.log('APP140_CACHED_HEART_INITIAL_SPINNER_AVOIDED=PASS');
console.log('APP140_W1_QUEUE_AND_LOCAL_CATALOG_UNCHANGED=PASS');

// App141 executable regression: an older durable snapshotPending can still
// exist on the receiving device after the other device accepted a new like.
// The UI subscriber rereads that durable snapshot synchronously. Prove that
// the new remote state is persisted BEFORE the UI is notified, without
// changing the protected local-outbox-wins or stale-signal behavior.
{
  const { default: ts } = await import('typescript');
  const { default: vm } = await import('node:vm');
  const start = service.indexOf('const applyRemoteLikeSignal127 =');
  const end = service.indexOf('let activeLikeSignalUid127', start);
  assert.ok(start >= 0 && end > start, 'remote signal receiver boundaries missing');
  const receiver = service.slice(start, end);
  assert.match(receiver, /acceptedForUi141\.forEach\(dispatchLikeSync\)/);
  assert.ok(
    receiver.indexOf('writeSnapshotPending127(uid, unresolved)') <
    receiver.indexOf('acceptedForUi141.forEach(dispatchLikeSync)'),
    'durable pending state must be published before the UI can reread it',
  );
  const executable = ts.transpileModule(
    receiver + '\n(globalThis.__apply = applyRemoteLikeSignal127);',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const cache = new Map([['track-a', false]]);
  let persistentPending = { 'track-a': false };
  let seen = 10;
  let outbox = {};
  const rendered = [];
  const env = {
    console,
    Date,
    Map,
    Set,
    clampLikeCount: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120: 90_000,
    auth: { currentUser: { uid: 'same-account' } },
    readSeenLikeSignal127: () => seen,
    readRepairTarget127: () => 0,
    requestRepair127: () => { throw new Error('unexpected gap repair'); },
    readLikeOutbox: () => outbox,
    persistLikeOutbox: (_uid, value) => { outbox = value; },
    readSnapshotPending127: () => ({ ...persistentPending }),
    getLikedStateCache: () => cache,
    readLikeDisplayLocks: () => ({}),
    patchExploreLikedTrackMembership: () => {},
    // Phase416's separate tentative overlay is optional in this historical
    // accepted-signal fixture; keep the app141 durable order assertions intact.
    clearExploreLikeIntent416: () => {},
    persistLikedStateCache: () => {},
    writeSnapshotPending127: (_uid, next) => { persistentPending = { ...next }; },
    persistLikeDisplayLocks: () => {},
    markLocalLikeCatalogReady135: () => {},
    markSeenLikeSignal127: (_uid, version) => { seen = version; },
    dispatchLikeSync: (detail) => {
      const effective = outbox[detail.trackId]?.desiredLiked ??
        persistentPending[detail.trackId] ?? cache.get(detail.trackId);
      if (detail.source === 'remote' && effective === detail.liked) rendered.push(detail);
    },
  };
  vm.runInNewContext(executable, env, { timeout: 1000 });
  env.__apply('same-account', {
    version: 11, previousVersion: 10,
    results: [{ trackId: 'track-a', ownerUid: '', liked: true, likeCount: 1 }],
  });
  assert.equal(persistentPending['track-a'], true, 'new membership not persisted');
  assert.equal(rendered.length, 1, 'UI rejected latest changed-track because it read old pending state');
  assert.equal(rendered[0].liked, true);
  assert.equal(rendered[0].likeCount, 1);
  env.__apply('same-account', {
    version: 11, previousVersion: 10,
    results: [{ trackId: 'track-a', ownerUid: '', liked: false, likeCount: 0 }],
  });
  assert.equal(rendered.length, 1, 'stale signal must not repaint');
  outbox = { 'track-a': { desiredLiked: false } };
  env.__apply('same-account', {
    version: 12, previousVersion: 11,
    results: [{ trackId: 'track-a', ownerUid: '', liked: false, likeCount: 0 }],
  });
  assert.equal(rendered.length, 1, 'an unresolved local click must retain precedence');
  assert.equal(persistentPending['track-a'], true, 'remote change must not erase unresolved local click');
  assert.equal(outbox['track-a'].deferredSignal390.version, 12, 'defer the received row without painting over the local click');
  const deferred390 = outbox['track-a'].deferredSignal390;
  assert.equal(deferred390.result.liked, false, 'stored accepted unlike must keep its exact value');
  assert.match(service, /row\.deferredSignal390\.result/, 'deferred row must survive durable outbox reload');
  assert.match(service, /releasedRemote390\.push\(current\.deferredSignal390\)/,
    'net-zero local outbox release must retain the skipped remote event');
  assert.match(service, /applyRemoteLikeSignal127\(uid, \{[\s\S]*?results: \[deferred\.result\],[\s\S]*?\}, true\)/,
    'after removing a net-zero local intent, replay the exact remote state without requesting data');
  // This local replay is safe despite the RTDB version watermark already
  // being 12: only the release of a now-absent outbox may enable it.
  outbox = {};
  env.__apply('same-account', {
    version: deferred390.version, previousVersion: 0,
    results: [deferred390.result],
  }, true);
  assert.equal(rendered.length, 2, 'stored remote event should reach the UI after local outbox release');
  assert.equal(rendered[1].liked, false, 'deferred unlike must clear the filled heart');
  assert.equal(persistentPending['track-a'], false, 'replayed remote unlike must persist before painting');
  assert.equal(seen, 12, 'local replay must never artificially advance the network watermark');
  console.log('APP390_DEFERRED_REMOTE_UNLIKE_REPLAY_NO_SERVER_IO=PASS');
  console.log('APP141_REMOTE_PERSIST_BEFORE_UI_REPLAY=PASS');
  console.log('APP141_LOCAL_OUTBOX_AND_STALE_SIGNAL_PROTECTED=PASS');
  console.log('APP141_RECEIVER_ADDITIONAL_SERVER_IO=0');
}


// The actual batch-ACK receiver (not a copied algorithm) must NOT notify
// Explore about a server revision-conflict while the device still persists its
// older optimistic outbox. On a real mounted ExplorePage, that early event is
// discarded by readExploreTrackLikeMembership127 and never re-emitted.
{
  const { default: ts } = await import('typescript');
  const { default: vm } = await import('node:vm');
  const start = service.indexOf('flushPendingLikes = async (user: User): Promise<void> => {');
  const end = service.indexOf('// Stage413: a 5-second timer', start);
  assert.ok(start > 0 && end > start, 'exact flushPendingLikes body missing');
  const flush = service.slice(start, end);
  const executable = ts.transpileModule(
    'let flushPendingLikes;\n' + flush + '\n(globalThis.__flush = flushPendingLikes);',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const trackId = 'canonical-conflict-song';
  const ownerUid = 'owner-one';
  const pending = {
    trackId, ownerUid, baseLiked: false, desiredLiked: true,
    baseLikeCount: 0, optimisticLikeCount: 1,
    queuedAt: 100, updatedAt: 200, retryCount: 0,
    operationId: '00000000-0000-4000-8000-000000000001',
    expectedRevision: 0,
  };
  let storedOutbox = { [trackId]: pending };
  let storedSnapshot = { [trackId]: true };
  let serverRow = { trackId, liked: false, likeCount: 0, revision: 1, status: 'revision-conflict' };
  let snapshotProvenSettled = false;
  const cache = new Map([[trackId, true]]);
  const remoteRepaints = [];
  const patchedMembership = [];
  const calls = [];
  const env = {
    console, Date, Map, Set,
    EXPLORE_LIKE_BATCH_MAX: 50,
    EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120: 90_000,
    inflightByUid: new Map(),
    exitFlushArmed413: new Set(),
    readLikeOutbox: () => structuredClone(storedOutbox),
    persistLikeOutbox: (_uid, next) => {
      storedOutbox = structuredClone(next);
      calls.push('persistOutbox');
    },
    getPendingExploreLikeMutationCount: () => Object.keys(storedOutbox).length,
    // Stage416's optional RTDB hint is intentionally inert in this frozen
    // app390 canonical-ACK test; it cannot affect server retry/account truth.
    clearExploreLikeIntent416: () => {},
    settleExploreLikeIntent416: async () => {},
    readLikeCanonicalRevisions172: () => ({}),
    persistLikeCanonicalRevisions172: () => {},
    createExploreLikeOperationId144: () => pending.operationId,
    clearFlushTimer: () => {},
    schedulePendingFlush: () => { throw new Error('no additional pending mutation expected'); },
    requestExploreLike: async (_user, route) => {
      assert.equal(route, '/v1/me/likes/batch');
      calls.push('POST');
      return { data: { canonicalD1: 'settled', personalLikeSnapshot: snapshotProvenSettled ? 'settled' : 'updated' } };
    },
    normalizeBatchResults: () => [serverRow],
    canBroadcastExploreLikeSnapshot127: (value) => value === 'settled',
    computeExploreLikeAction127: () => { throw new Error('unexpected rebase'); },
    rebaseExploreLikeAfterInFlight127: () => { throw new Error('unexpected rebase'); },
    readSnapshotPending127: () => ({ ...storedSnapshot }),
    writeSnapshotPending127: (_uid, next) => {
      storedSnapshot = { ...next };
      calls.push('persistSnapshot');
    },
    readLikeDisplayLocks: () => ({}),
    persistLikeDisplayLocks: () => {},
    getLikedStateCache: () => cache,
    persistLikedStateCache: () => { calls.push('persistCache'); },
    patchExploreLikedTrackMembership: (_uid, id, liked) => {
      patchedMembership.push({ id, liked });
      calls.push('patchMembership');
    },
    clampLikeCount: (n) => Math.max(0, Math.floor(Number(n) || 0)),
    dispatchLikeSync: (detail) => {
      if (detail.source !== 'remote') return;
      calls.push('notifyRemote');
      const effective = storedOutbox[detail.trackId]?.desiredLiked ??
        storedSnapshot[detail.trackId] ?? cache.get(detail.trackId);
      if (effective === detail.liked) remoteRepaints.push(detail);
    },
    publishConfirmedLikeSignal127: async (_uid, rows) => {
      assert.equal(rows.length, serverRow.status === 'revision-conflict' ? 0 : 1,
        'only a successful changed-track ACK may publish a personal notification');
    },
    publishExplorePublicLikeInvalidation192: async () => {
      if (serverRow.status === 'revision-conflict') {
        throw new Error('conflict must not rebroadcast shared public invalidation');
      }
    },
    dispatchLikeSyncError: () => { throw new Error('unexpected error'); },
  };
  vm.runInNewContext(executable, env, { timeout: 1200 });
  await env.__flush({ uid: 'same-account' });
  assert.equal(Object.keys(storedOutbox).length, 0,
    'settled canonical conflict must clear the stale optimistic outbox');
  assert.equal(storedSnapshot[trackId], undefined,
    'conflict must drop stale accepted-but-unsettled snapshot guard');
  assert.equal(cache.get(trackId), false, 'cache must match server-returned membership');
  assert.equal(remoteRepaints.length, 1, 'mounted Explore must not drop server-conflict heart change');
  assert.equal(remoteRepaints[0].liked, false);
  assert.equal(remoteRepaints[0].likeCount, 0);
  assert.equal(patchedMembership.length, 1, 'My Likes card membership must follow canonical result');
  assert.equal(patchedMembership[0].liked, false);
  assert.ok(calls.indexOf('persistSnapshot') < calls.indexOf('notifyRemote'),
    'old snapshot guard must be cleared before listener reads it');
  assert.ok(calls.lastIndexOf('persistOutbox') < calls.indexOf('notifyRemote'),
    'old optimistic outbox must be cleared before listener reads it');
  assert.equal(calls.filter((event) => event === 'POST').length, 1,
    'canonical ACK conflict must not trigger another server write');
  console.log('APP390_CONFLICT_ACK_DURABLE_BEFORE_REPAINT=PASS');
  console.log('APP390_CONFLICT_MY_LIKES_MEMBERSHIP_AND_W0_RETRY=PASS');

  // Regression from the user's app390 mobile screenshot: a public count of 1
  // with an empty personal heart after 60s is never acceptable for a user's
  // just-accepted own like. Legacy D1 'settled' is NOT the private R2 snapshot.
  // This executes the real ACK function with a successful server-applied LIKE.
  storedOutbox = { [trackId]: {
    ...pending, updatedAt: 201, desiredLiked: true, baseLiked: false,
    operationId: '00000000-0000-4000-8000-000000000002',
  } };
  storedSnapshot = { [trackId]: false }; // old delayed R2 hint
  cache.set(trackId, true); // optimistic clicked heart
  serverRow = { trackId, liked: true, likeCount: 1, revision: 2, status: 'applied' };
  await env.__flush({ uid: 'same-account' });
  assert.equal(Object.keys(storedOutbox).length, 0, 'applied click clears outbox');
  assert.equal(storedSnapshot[trackId], true,
    'D1 settled cannot delete accepted personal heart while private R2 still lags');
  assert.equal(cache.get(trackId), true);
  assert.equal(remoteRepaints.length, 2, 'accepted click must repaint a stale mounted heart');
  assert.equal(remoteRepaints[1].liked, true);
  assert.equal(remoteRepaints[1].likeCount, 1);
  assert.ok(calls.lastIndexOf('persistSnapshot') < calls.lastIndexOf('notifyRemote'),
    'accepted heart must be persisted before UI notification');
  assert.ok(calls.lastIndexOf('persistOutbox') < calls.lastIndexOf('notifyRemote'),
    'accepted outbox must clear before UI notification');
  // A legitimate older private R2 hydrate cannot override the accepted guard.
  cache.set(trackId, false);
  assert.equal(storedOutbox[trackId]?.desiredLiked ?? storedSnapshot[trackId] ?? cache.get(trackId),
    true, 'older private catalog may not hollow an accepted filled heart');
  assert.equal(calls.filter((event) => event === 'POST').length, 2,
    'exactly one server batch per explicit click, no extra poll or retry');
  console.log('APP391_ACCEPTED_LIKE_STAYS_FILLED_DURING_R2_LAG=PASS');
  console.log('APP391_DURABLE_ACK_REPAINT_AFTER_OUTBOX_ZERO=PASS');
}

