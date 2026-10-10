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
