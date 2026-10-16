import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';

const service=readFileSync('src/services/exploreLikeService.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const start=service.indexOf('export const stabilizeExploreLikeOptimisticCount413');
const stop=service.indexOf('// app414:',start);
assert.ok(start>=0&&stop>start,'real optimistic policy not found');
const compiled=(await transform(service.slice(start,stop).replaceAll('export const ','const '),{
  loader:'ts',target:'es2022',format:'cjs',
})).code;
const {stabilize,resolve,remote}=new Function('clampLikeCount',compiled+
  '\nreturn {stabilize:stabilizeExploreLikeOptimisticCount413,resolve:resolveExploreLikeAckCount420,remote:resolveExploreLikeRemoteDisplayCount420};'
)(n=>Math.max(0,Math.floor(Number(n)||0)));

const optimistic=(before,after,count,verified)=>stabilize(
  false,before,after,count,Math.max(0,count+Number(after)-Number(before)),verified,
);
assert.equal(optimistic(false,true,0,true),1,'verified empty song adds one');
assert.equal(optimistic(false,true,5,true),6,'verified false + published 5 adds one');
assert.equal(optimistic(true,false,5,true),4,'verified true - published 5 removes one');
assert.equal(optimistic(false,true,5,false),5,
  'app413 unknown/stale-empty-heart cannot invent another public like');
assert.equal(resolve(true,true,6,5),6,
  'deferred 448 PRIVATE ACK may not return old published 5 over actor 6');
assert.equal(resolve(true,true,4,5),4,
  'deferred 448 PRIVATE ACK may not return old published 5 over actor 4');
assert.equal(resolve(false,true,6,5),5,'immediate public contract stays unchanged');
assert.equal(resolve(true,false,6,5),5,
  'conflict/ineligible must use canonical result rather than optimistic state');
assert.equal(remote(5,6,5,undefined),6,
  'fresh device before public release: public base 5 authorizes private 6');
assert.equal(remote(7,6,5,undefined),7,
  'missed-public device: advanced public 7 rejects stale private 6');
assert.equal(remote(5,4,5,undefined),4,
  'same base also authorizes private unlike -1');
assert.equal(remote(7,6,undefined,false),7,
  'explicit heart-only retained row never changes public count');

// Exercise the real actor overlay and release-retirement source with one
// persisted account-private small changed-track row, not a fake public cache.
const overlayStart=service.indexOf('// Only a real changed-card publication');
const overlayEnd=service.indexOf('const dispatchLikeSync',overlayStart);
assert.ok(overlayStart>0&&overlayEnd>overlayStart,'actor public-release implementation missing');
const overlayJs=(await transform(
  service.slice(overlayStart,overlayEnd).replaceAll('export const ','const ').replace('export function ','function '),
  {loader:'ts',target:'es2022',format:'cjs'},
)).code;
let now=1_700_000_000_000;
let currentDevice='pc';
const allDeviceLocks=new Map();
const activePendings=new Map();
const key=uid=>currentDevice+':'+uid;
const pair=(liked,count)=>({liked,likeCount:Math.max(liked?1:0,Math.floor(Number(count)||0))});
const {overlay,retire}=new Function(
  'readActiveLikeOutbox414','readLikeDisplayLocks','persistLikeDisplayLocks',
  'readExploreTrackLikeMembership127','readExploreLikeIntentDetail416',
  'EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE','normalizeExploreLikeDisplayPair129',
  'clampLikeCount','Date','hasSettledExplorePublicLikeSignal396',
  overlayJs+
  '\nreturn {overlay:overlayExploreLikeDisplayCounts,retire:retireExploreLikeDisplayLockAfterPublicCount420};',
)(
  uid=>activePendings.get(key(uid))||{},
  uid=>({...allDeviceLocks.get(key(uid))}),
  (uid,locks)=>allDeviceLocks.set(key(uid),{...locks}),
  (_uid,_id)=>true,
  ()=>null,
  false,
  pair,
  n=>Math.max(0,Math.floor(Number(n)||0)),
  {now:()=>now},
  () => false,
);
const uid='actor',track='song';
const published=[{id:track,likeCount:5}];
const protectUntil=now+25*60_000;
for(const device of ['pc','mobile']){
  currentDevice=device;
  allDeviceLocks.set(key(uid),{[track]:{liked:true,likeCount:6,updatedAt:now,protectUntil,
    deferredPublic420:true,basePublicLikeCount420:5}});
  assert.equal(overlay(uid,published)[0].likeCount,6,
    device+' receives same-account provisional +1 while public remains exact base 5');
  assert.ok(allDeviceLocks.get(key(uid))[track],
    'base-matching shared public row keeps provisional actor lock');
}
// A later stale Feed payload must not roll either same-UID device back before
// the chosen 20 minute shared window has finished.
now+=20*60_000;
for(const device of ['pc','mobile']){
  currentDevice=device;
  assert.equal(overlay(uid,published)[0].likeCount,6,device+' survives 20 minute window');
}
// A different public value proves this actor's old base is no longer current,
 // even when this device missed the public RTDB invalidation.
currentDevice='pc';
assert.equal(overlay(uid,[{id:track,likeCount:7}])[0].likeCount,7,
  'advanced public 7 rejects stale private 6 without a local settlement ledger');
assert.equal(allDeviceLocks.get(key(uid))[track],undefined,
  'advanced public count retires stale base-5 actor lock');
allDeviceLocks.set(key(uid),{[track]:{liked:true,likeCount:6,updatedAt:now,protectUntil,
  deferredPublic420:true,basePublicLikeCount420:5}});
activePendings.set(key(uid),{[track]:{desiredLiked:false,optimisticLikeCount:5}});
assert.equal(retire(uid,track,now+500),false,'inflight newer local unlike outranks publication');
activePendings.delete(key(uid));
assert.equal(retire(uid,track,now-21*60_000),false,'older publication cannot erase newest ACK');
assert.equal(retire(uid,track,now+500),true,'newer exact publication retires old actor guard');
assert.equal(overlay(uid,[{id:track,likeCount:7}])[0].likeCount,7,'new published total includes other users');
currentDevice='mobile';
assert.equal(retire(uid,track,now+500),true,'same-UID other device also retires old count');
assert.equal(overlay(uid,[{id:track,likeCount:7}])[0].likeCount,7);

const acceptedAck=service.slice(service.indexOf('flushPendingLikes = async'),service.indexOf('const clearFlushTimer',service.indexOf('flushPendingLikes = async')));
assert.match(acceptedAck,/canonicalLikeCount = resolveExploreLikeAckCount420\(/);
assert.match(acceptedAck,/likeCount: canonicalLikeCount/);
assert.match(acceptedAck,/acceptedForSignal127\.push\(accepted\)/);
assert.match(acceptedAck,/basePublicLikeCount420: clampLikeCount\(pending\.baseLikeCount\)/,
  'sender must preserve the public count that the provisional +/-1 was based on');
assert.match(service,/basePublicLikeCount420: clampLikeCount\(value\.basePublicLikeCount420\)/,
  'RTDB decoder must preserve optional public-base count');
assert.match(service,/sharedCount !== basePublic420/,
  'persistent actor overlay must yield to any public count that advanced past its base');
assert.match(page,/resolveExploreLikeRemoteDisplayCount420\(/,
  'mounted React receiver must compare provisional count against current public base');
assert.match(acceptedAck,/publishConfirmedLikeSignal127\(uid, acceptedForSignal127\)/);
assert.match(service,/displayLocks\[item\.trackId\] = \{[\s\S]*?likeCount: clampLikeCount\(item\.likeCount\)/,
  'same-UID receiver retains accepted pair before UI notification');
assert.match(service,/persistLikeDisplayLocks\(uid, displayLocks\);[\s\S]*?markSeenLikeSignal127\(uid, signal\.version\);[\s\S]*?acceptedForUi141\.forEach\(dispatchLikeSync\)/,
  'app141 persist before remote UI dispatch');
assert.match(page,/retireExploreLikeDisplayLockAfterPublicCount420\([\s\S]*?user\.uid, row\.trackId, row\.at/);
assert.doesNotMatch(page,/retireExploreLikeDisplayLockAfterPublicCount420\([\s\S]{0,250}?Math\.max\(row\.at, card\.updatedAt\)/,
  'old published signal cannot borrow a newer card updatedAt to erase a newer actor lock');
assert.match(service,/result\.status !== 'already-desired'/,
  'a canonical no-change ACK cannot retain a speculative +1 for 25 minutes');
assert.match(page,/patchExploreFeedSessionCachesRow\(row\.trackId, \{ likeCount: card\.likeCount \}\)/,
  'public cache gets only public published count');
assert.match(service,/EXPLORE_LIKE_DEFERRED_PUBLIC_LOCK_MS_420 = 25 \* 60_000/);
assert.equal(JSON.parse(readFileSync('public/app-version.json','utf8')).version,420,
  'app420 must build a new app version; same-version app419 release is forbidden');
assert.match(page,/detail\.privateCountExact416 !== false && Number\.isSafeInteger\(detail\.likeCount\)/,
  'late personal signal must retain the heart without reverting a settled public count');
console.log('APP420_RELEASE_VERSION_420_AND_LATE_PRIVATE_REPAINT_GUARD=PASS');
console.log('APP420_VERIFIED_ACTOR_0_TO_1_AND_5_TO_6=PASS');
console.log('APP420_UNKNOWN_MEMBERSHIP_APP413_GUARD=PASS');
console.log('APP420_DEFERRED_PRIVATE_ACK_NO_OLD_PUBLIC_ROLLBACK=PASS');
console.log('APP420_PUBLIC_BASE_5_PRIVATE_6_FRESH_DEVICE=PASS');
console.log('APP420_ADVANCED_PUBLIC_7_REJECTS_STALE_PRIVATE_6=PASS');
console.log('APP420_SAME_UID_PC_MOBILE_20MIN_PROVISIONAL_DISPLAY=PASS');
console.log('APP420_NEWER_LOCAL_CLICK_AND_OLDER_PUBLIC_SIGNAL_PROTECTED=PASS');
console.log('APP420_CHANGED_CARD_PUBLIC_RELEASE_EXACT_COUNT=PASS');

 // A pre-existing/public changed-card signal can repaint a newer private click.
 // Exercise the actual React changed-card patch callback, rather than merely
 // verifying that retireExploreLikeDisplayLockAfterPublicCount420() returned false.
currentDevice='pc';
now+=1_000;
allDeviceLocks.set(key(uid),{[track]:{
 liked:true,likeCount:6,updatedAt:now,protectUntil:now+25*60_000,deferredPublic420:true,
}});
const patchStart=page.indexOf('const patchPublicCounts192 = (previous: ExploreTrack[]) => {');
const patchStop=page.indexOf('setTracks(patchPublicCounts192);',patchStart);
assert.ok(patchStart>=0&&patchStop>patchStart,'real React public repaint callback not found');
const patchSource=page.slice(patchStart,patchStop);
const patchJs=(await transform(patchSource,{loader:'ts',target:'es2022',format:'cjs'})).code;
const makePatch=new Function('settled','user','overlayExploreLikeDisplayCounts',
  patchJs+'\nreturn patchPublicCounts192;');
const preWindowSettle=new Map([[track,5]]);
const patchOld=makePatch(preWindowSettle,{uid},overlay);
const oldSignalAt=now-1;
assert.equal(retire(uid,track,oldSignalAt),false,
 'older published signal does not clear newer actor guard');
const protectedView=patchOld([{id:track,likeCount:6}]);
assert.equal(protectedView[0].likeCount,6,
 'public React repaint must NOT erase a newer actor provisional +1');
assert.equal(patchOld(protectedView),protectedView,
 'no extra React repaint when same actor display remains unchanged');
assert.ok(allDeviceLocks.get(key(uid))[track],
 'prior PUBLIC signal must leave newer PRIVATE lock active');
const newSignalAt=now+5_000;
assert.equal(retire(uid,track,newSignalAt),true,
 'truly newer published release retires old guard');
const patchNew=makePatch(new Map([[track,7]]),{uid},overlay);
assert.equal(patchNew(protectedView)[0].likeCount,7,
 'correct settled count from other users is eventually visible');
assert.match(page,/actorDisplay420 = overlayExploreLikeDisplayCounts\(user\.uid, \[/,
 'account liked-card cache must retain the same private actor overlay');
console.log('APP420_OLD_PUBLIC_SIGNAL_DOES_NOT_REPAINT_NEW_ACTOR_COUNT=PASS');
console.log('APP420_REAL_REACT_PUBLIC_REPAINT_RETIRE_AND_NO_REDUNDANT_RENDER=PASS');

console.log('APP420_NO_PUBLIC_WORKER_OR_SHARED_DATA_MUTATION=PASS');
