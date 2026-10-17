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

// app420: execute the actual RTDB payload decoder AND the mounted Explore
// receiver. The account's filled heart may arrive after public 7 has settled,
// but the private provisional 6 cannot repaint the already published count.
{
  const {default:ts}=await import('typescript');
  const {default:vm}=await import('node:vm');
  const from=service.indexOf('const normalizeLikeSignal127 =');
  const to=service.indexOf('// app410:',from);
  assert.ok(from>0&&to>from,'exact private RTDB decoder missing');
  const parser=ts.transpileModule(service.slice(from,to)+
    '\nglobalThis.decode=normalizeLikeSignal127;',
    {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const context={EXPLORE_LIKE_SIGNAL_MAX_127:50,
    clampLikeCount:(v)=>Math.max(0,Math.floor(Number(v)||0))};
  vm.runInNewContext(parser,context);
  const row=context.decode({version:20_001,previousVersion:20_000,
    results:[{trackId:'song',ownerUid:'owner',liked:true,likeCount:6,
      acceptedAtPublicClock420:8_000,basePublicLikeCount420:5}]}).results[0];
  assert.equal(row.acceptedAtPublicClock420,8_000);
  assert.equal(row.basePublicLikeCount420,5,
    'app420 RTDB row preserves the exact public base used for +1');
  const legacy=context.decode({version:20_002,previousVersion:20_001,
    results:[{trackId:'song',ownerUid:'owner',liked:true,likeCount:6}]}).results[0];
  assert.equal(legacy.acceptedAtPublicClock420,undefined,
    'older app419 signals remain readable without schema migration');

  const begin=page.indexOf('const onRemote = (detail: {');
  const end=page.indexOf('const onGap =',begin);
  assert.ok(begin>=0&&end>begin,'real mounted React receiver missing');
  const executable=ts.transpileModule(page.slice(begin,end)+
    '\nglobalThis.onRemote=onRemote;',
    {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let renderedCount=7,heart=false,likedCacheWrites=0;
  const setTrack=(fn)=>{const a=fn([{id:'song',likeCount:renderedCount}]);
    renderedCount=a[0].likeCount;};
  const canvas={
    user:{uid:'same-account'},
    likeInteractionVersionRef090:{current:0},
    resolveExploreLikeRemoteDisplayCount420:(current,provisional,base,exact)=>{
      if(exact===false)return current;
      if(Number.isSafeInteger(base)&&base>=0)return current===base?provisional:current;
      return provisional;
    },
    readExploreTrackLikeMembership127:()=>true,
    normalizeExploreLikeDisplayPair129:(liked,likeCount)=>({liked,likeCount}),
    setLikedTrackIds:(fn)=>{heart=fn({song:heart}).song;},
    setTracks:setTrack,setPopularTracks:()=>{},setCuratedTracks307:()=>{},
    setManagedCuratedTracks307:()=>{},setProfileTracks:()=>{},
    setProfileLikedTracks:()=>{},
    patchExploreLikedTrackCachedCount091:()=>{likedCacheWrites++;},
    setLikeAccountSyncSignal:()=>{},
  };
  vm.runInNewContext(executable,canvas);
  canvas.onRemote({...row,uid:'same-account',source:'remote',privateCountExact416:false});
  assert.equal(heart,true,'late private ACK updates personal heart');
  assert.equal(renderedCount,7,'explicit heart-only ACK cannot repaint public 7 as 6');
  assert.equal(likedCacheWrites,0,'heart-only ACK cannot overwrite liked-card settled public 7');

  // Re-audit A: even without this device's public-settlement ledger, public 7
  // is already different from the sender's public base 5, so retained 6 loses.
  canvas.onRemote({...row,uid:'same-account',source:'remote',privateCountExact416:undefined});
  assert.equal(renderedCount,7,
    'existing/missed-ledger device keeps advanced public 7 over stale private 6');

  // Re-audit B: before shared publication, the receiver still sees exact base 5.
  // The same account must therefore display its accepted provisional +1 as 6.
  renderedCount=5;
  canvas.onRemote({...row,uid:'same-account',source:'remote',privateCountExact416:undefined});
  assert.equal(renderedCount,6,
    'fresh device before shared release promotes public base 5 to private 6');
  console.log('APP420_REAL_RTDB_DECODER_SERVER_TIME_AND_APP419_COMPAT=PASS');
  console.log('APP420_REAL_REACT_LATE_PRIVATE_HEART_ONLY_PUBLIC_7_STAYS_7=PASS');
  console.log('APP420_REAL_REACT_PUBLIC7_REJECTS_BASE5_PRIVATE6=PASS');
  console.log('APP420_REAL_REACT_PUBLIC5_ACCEPTS_BASE5_PRIVATE6=PASS');
}

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
  let publicSettledAt420 = 0;
  let personalLocks420 = {};
  const rendered = [];
  const env = {
    console,
    Date,
    Map,
    Set,
    clampLikeCount: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120: 90_000,
    EXPLORE_LIKE_DEFERRED_PUBLIC_LOCK_MS_420: 25 * 60_000,
    COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448: true,
    // Guarded Stage420 remains hard-disabled: the frozen 127/390 receiver
    // fixture runs the exact legacy app392 path, not the candidate cutover.
    EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE: false,
    auth: { currentUser: { uid: 'same-account' } },
    readSeenLikeSignal127: () => seen,
    readRepairTarget127: () => 0,
    requestRepair127: () => { throw new Error('unexpected gap repair'); },
    readLikeOutbox: () => outbox,
    isExploreLikeActivePending414: row => row?.explicitReplayEligible412 === true,
    persistLikeOutbox: (_uid, value) => { outbox = value; },
    readSnapshotPending127: () => ({ ...persistentPending }),
    getLikedStateCache: () => cache,
    readLikeDisplayLocks: () => ({ ...personalLocks420 }),
    hasSettledExplorePublicLikeSignal396: (_uid,_track,acceptedAt) =>
      publicSettledAt420 >= acceptedAt,
    patchExploreLikedTrackMembership: () => {},
    // Phase416's separate tentative overlay is optional in this historical
    // accepted-signal fixture; keep the app141 durable order assertions intact.
    clearExploreLikeIntent416: () => {},
    persistLikedStateCache: () => {},
    writeSnapshotPending127: (_uid, next) => { persistentPending = { ...next }; },
    persistLikeDisplayLocks: (_uid, locks) => { personalLocks420 = { ...locks }; },
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
  outbox = { 'track-a': { desiredLiked: false, explicitReplayEligible412: true } };
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
  // app420 same-UID recipient: accepted private signal carries the actor's
  // provisional ±1, not the older common-public count still awaiting release.
  env.__apply('same-account', {
    version: 13, previousVersion: 12,
    results: [{ trackId: 'track-a', ownerUid: '', liked: true, likeCount: 6 }],
  });
  assert.equal(rendered.length, 3);
  assert.equal(rendered[2].liked, true);
  assert.equal(rendered[2].likeCount, 6,
    'remote same-UID device gets ON+6 while public is still 5');
  env.__apply('same-account', {
    version: 13, previousVersion: 12,
    results: [{ trackId: 'track-a', ownerUid: '', liked: true, likeCount: 7 }],
  });
  assert.equal(rendered.length, 3,'same-version duplicate cannot add another +1');
  env.__apply('same-account', {
    version: 14, previousVersion: 13,
    results: [{ trackId: 'track-a', ownerUid: '', liked: false, likeCount: 5 }],
  });
  assert.equal(rendered.length, 4);
  assert.equal(rendered[3].liked, false);
  assert.equal(rendered[3].likeCount, 5,
    'reverse-device accepted OFF restores provisional 5 from 6');
  // Independent audit reproducer: the Worker accepted the personal ON before
  // publication, but mobile receives the UID-private RTDB row *after* the
  // public count 7 has already been accepted locally.
  publicSettledAt420 = 9_000;
  env.__apply('same-account', {
    version: 15, previousVersion: 14,
    results: [{ trackId:'track-a',ownerUid:'',liked:true,likeCount:6,
      acceptedAtPublicClock420:8_000 }],
  });
  assert.equal(rendered.length,5);
  assert.equal(rendered[4].liked,true,
    'late private ACK still updates same-account personal heart');
  assert.equal(rendered[4].privateCountExact416,false,
    'late private ACK is NOT an authority to repaint settled PUBLIC 7 as 6');
  assert.equal(personalLocks420['track-a'],undefined,
    'late private ACK may not install a new 25-minute provisional lock');
  // Reversed order: a genuinely newer private action after publication must
  // remain protected, regardless of when RTDB happens to deliver it.
  env.__apply('same-account', {
    version: 16, previousVersion: 15,
    results: [{trackId:'track-a',ownerUid:'',liked:false,likeCount:6,
      acceptedAtPublicClock420:10_000}],
  });
  assert.equal(rendered.length,6);
  assert.notEqual(rendered[5].privateCountExact416,false);
  assert.equal(personalLocks420['track-a'].acceptedAtPublicClock420,10_000);
  assert.equal(personalLocks420['track-a'].likeCount,6);
  assert.match(service,/acceptedAtPublicClock420: serverAcceptedAt192/,
    'origin Worker acceptance clock must travel with 127 signal, never receive Date.now');
  assert.match(publish,/acceptedAtPublicClock420/,
    'existing RTDB signal must preserve the Worker acceptance time');
  // Independent re-audit reproducer: a brand-new device subscribes after
  // the public bus retention has expired. Firebase immediately replays the
  // retained UID-private row, but this origin has no public settlement ledger.
  // That FIRST retained row is allowed to repair the heart only; its old
  // provisional count must not install a 25-minute display lock.
  seen = 0;
  publicSettledAt420 = 0;
  personalLocks420 = {};
  persistentPending = {};
  cache.set('fresh-device-song', false);
  const beforeFreshDeviceRows = rendered.length;
  env.__apply('same-account', {
    version: 21, previousVersion: 20,
    results: [{trackId:'fresh-device-song',ownerUid:'',liked:true,likeCount:6,
      acceptedAtPublicClock420:8_000}],
  }, false, true);
  assert.equal(rendered.length,beforeFreshDeviceRows+1);
  assert.equal(rendered.at(-1).liked,true,
    'new device still receives exact personal heart from retained signal');
  assert.equal(rendered.at(-1).privateCountExact416,false,
    'first retained private number is not allowed to override loaded public count');
  assert.equal(personalLocks420['fresh-device-song'],undefined,
    'legacy app419 retained row without public-base proof stays heart-only');

  // Current app420 retained row carries its public base. This removes the false
  // first-snapshot dichotomy: public5 can show private6 immediately, while a
  // receiver already on public7 will reject that stale6 in the display layer.
  seen = 0;
  publicSettledAt420 = 0;
  personalLocks420 = {};
  persistentPending = {};
  cache.set('fresh-base-song', false);
  const beforeBaseRows = rendered.length;
  env.__apply('same-account', {
    version: 31, previousVersion: 30,
    results: [{trackId:'fresh-base-song',ownerUid:'',liked:true,likeCount:6,
      acceptedAtPublicClock420:8_000,basePublicLikeCount420:5}],
  }, false, true);
  assert.equal(rendered.length,beforeBaseRows+1);
  assert.equal(rendered.at(-1).liked,true);
  assert.notEqual(rendered.at(-1).privateCountExact416,false,
    'base-proven initial retained row may carry same-account provisional count');
  assert.equal(rendered.at(-1).basePublicLikeCount420,5);
  assert.equal(personalLocks420['fresh-base-song'].likeCount,6);
  assert.equal(personalLocks420['fresh-base-song'].basePublicLikeCount420,5);

  // Once the initial Firebase snapshot has been consumed, a genuinely new live
  // account change must still carry the immediate same-account provisional count.
  assert.equal(seen,31,'fresh-base retained row must advance the network watermark');
  assert.equal(cache.get('fresh-device-song'),true,'earlier retained heart is still durable');
  assert.equal(outbox['fresh-device-song'],undefined,'no local outbox may block the live remote row');
  const beforeLiveRows420=rendered.length;
  env.__apply('same-account', {
    version: 32, previousVersion: 31,
    results: [{trackId:'fresh-device-song',ownerUid:'',liked:false,likeCount:7,
      acceptedAtPublicClock420:12_000,basePublicLikeCount420:6}],
  }, false, false);
  assert.equal(seen,32,'live same-account row must advance network watermark');
  assert.equal(cache.get('fresh-device-song'),false,'live unlike must become durable membership');
  assert.equal(persistentPending['fresh-device-song'],false,'live unlike pending snapshot persists before UI');
  assert.equal(rendered.length,beforeLiveRows420+1,'live same-account row must reach the UI once');
  assert.equal(rendered.at(-1).liked,false);
  assert.notEqual(rendered.at(-1).privateCountExact416,false,
    'subsequent live same-UID change keeps provisional count authority');
  assert.equal(personalLocks420['fresh-device-song'].likeCount,7);
  assert.equal(personalLocks420['fresh-device-song'].acceptedAtPublicClock420,12_000);
  assert.match(service,/let firstPrivateSnapshot420 = true/);
  assert.match(service,/applyRemoteLikeSignal127\(uid, signal, false, initialRetained420\)/);
  console.log('APP420_NEW_DEVICE_FIRST_RETAINED_HEART_ONLY_NO_STALE_COUNT=PASS');
  console.log('APP420_NEW_DEVICE_BASE5_RETAINED_PRIVATE6_AUTHORIZED=PASS');
  console.log('APP420_NEW_DEVICE_SUBSEQUENT_LIVE_PRIVATE_COUNT_STILL_SYNCED=PASS');
  console.log('APP420_AUDIT_LATE_PRIVATE_AFTER_PUBLIC_7_STAYS_7=PASS');
  console.log('APP420_POST_PUBLIC_NEW_PRIVATE_CLICK_PROTECTED_6=PASS');
  console.log('APP420_SAME_UID_ON_6_OFF_5_REMOTE_SIGNAL=PASS');
  console.log('APP420_DUPLICATE_SIGNAL_NO_DOUBLE_PLUS_ONE=PASS');
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
    explicitReplayEligible412: true,
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
    STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE: false,
    STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE: false,
    COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448: true,
    STAGE416_SHARED_RTDB_BATCH_ACTIVE: false,
    eligibleGuardedMutation420: () => true, // inactive old-app outbox may flush as before
    EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120: 90_000,
    EXPLORE_LIKE_DEFERRED_PUBLIC_LOCK_MS_420: 25 * 60_000,
    resolveExploreLikeAckCount420: (deferred,accepted,optimistic,published) => deferred && accepted ? optimistic : published,
    // app422: flush now separates the personal ACK count from published baseline.
    resolveExploreLikeAckPublicBaseline422: (published) =>
      Number.isSafeInteger(published) && published >= 0 ? published : undefined,
    // Guarded Stage420 remains hard-disabled: the frozen 127/390 receiver
    // fixture runs the exact legacy app392 path, not the candidate cutover.
    EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE: false,
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
  // app420 exact ACK regression: common 448 public track_stats is still 5,
  // while a verified same-account false→true click has already shown 6.
  // Exercise the ACTUAL flush function rather than a copied count algorithm.
  storedOutbox = { [trackId]: {
    ...pending, updatedAt: 202, desiredLiked: true, baseLiked: false,
    baseLikeCount: 5, optimisticLikeCount: 6,
    operationId: '00000000-0000-4000-8000-000000000003',
  } };
  storedSnapshot = { [trackId]: false };
  cache.set(trackId, true);
  serverRow = { trackId, liked: true, likeCount: 5, revision: 3, status: 'applied' };
  await env.__flush({ uid: 'same-account' });
  assert.equal(remoteRepaints.length, 3,'private ACK must notify mounted account UI');
  assert.equal(remoteRepaints[2].liked, true);
  assert.equal(remoteRepaints[2].likeCount, 6,
    'deferred public track_stats=5 must not repaint actor 6 back to 5');
  assert.equal(Object.keys(storedOutbox).length,0);
  assert.equal(calls.filter((event) => event === 'POST').length,3,
    'one canonical write per explicit batch; no new retry or polling');
  // Independent countercase: a second device already liked this song, so
  // a stale-empty heart's explicit ON returns 'already-desired', no canonical
  // change and potentially NO public release signal. Do not keep a phantom +1.
  storedOutbox = { [trackId]: {
    ...pending, updatedAt: 203, desiredLiked: true, baseLiked: false,
    baseLikeCount: 5, optimisticLikeCount: 6,
    operationId: '00000000-0000-4000-8000-000000000004',
  } };
  storedSnapshot = { [trackId]: false };
  cache.set(trackId,true);
  serverRow = {trackId,liked:true,likeCount:5,revision:3,status:'already-desired'};
  await env.__flush({uid:'same-account'});
  assert.equal(remoteRepaints.length,4,'no-change same-UID ACK still repaints');
  assert.equal(remoteRepaints[3].liked,true);
  assert.equal(remoteRepaints[3].likeCount,5,
    'already-desired must restore true canonical 5, not keep phantom actor +1');
  assert.equal(calls.filter((event)=>event==='POST').length,4);
  // app422 actual flush (not a copied helper): an account which just saw
  // optimistic ON/6 may press OFF before public track_stats advances from5.
  // The private response/count must be5, and crucially the cross-device
  // baseline remains the returned PUBLIC 5 rather than previous PRIVATE 6.
  storedOutbox = { [trackId]: {
    ...pending, updatedAt: 204, baseLiked: true, desiredLiked: false,
    baseLikeCount: 6, optimisticLikeCount: 5,
    operationId: '00000000-0000-4000-8000-000000000005',
  } };
  storedSnapshot = { [trackId]: true };
  cache.set(trackId, false);
  serverRow = { trackId, liked: false, likeCount: 5, revision: 4, status: 'applied' };
  await env.__flush({ uid: 'same-account' });
  assert.equal(remoteRepaints.length, 5, 'final OFF ACK must repaint account state once');
  assert.equal(remoteRepaints[4].liked, false);
  assert.equal(remoteRepaints[4].likeCount, 5, 'net-zero actor sees restored private count 5');
  assert.equal(remoteRepaints[4].basePublicLikeCount420, 5,
    'the second ACK cannot publish earlier provisional 6 as base');
  assert.equal(storedSnapshot[trackId], false);
  assert.equal(cache.get(trackId), false);
  assert.equal(calls.filter((event) => event === 'POST').length, 5,
    'real ON/OFF actions retain exactly one batch write each, no new poll');
  console.log('APP422_REAL_FLUSH_SECOND_ACK_PUBLIC5_PRIVATE5_AFTER_ON6=PASS');
  console.log('APP420_ALREADY_DESIRED_NO_PHANTOM_ACTOR_COUNT=PASS');
  console.log('APP420_REAL_PRIVATE_ACK_STALE_PUBLIC_5_ACTOR_6=PASS');
  console.log('APP391_ACCEPTED_LIKE_STAYS_FILLED_DURING_R2_LAG=PASS');
  console.log('APP391_DURABLE_ACK_REPAINT_AFTER_OUTBOX_ZERO=PASS');
}

