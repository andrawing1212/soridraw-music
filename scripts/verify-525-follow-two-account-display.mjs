import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// APP525: real app helper and isolated A/B cross-account display contracts.
// Never touches live Firestore, D1, RTDB, R2, credentials or user data.
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const social=readFileSync('src/services/exploreSocialService.ts','utf8');
const slice=(src,a,b)=>{
 const start=src.indexOf(a),end=src.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'MISSING_ANCHOR '+a);
 return src.slice(start,end);
};
const source=slice(page,'const computeFollowTargetDisplay525 =','const safeCount =');
const transpiled=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText;
let pending=[];
const evalSource=transpiled+
 '\n({compute:computeFollowTargetDisplay525,pending:readPendingTargetFollowerCount525})';
const api=runInNewContext(evalSource,{
 readPendingExploreFollowIntents380:()=>pending,
});
assert.equal(api.compute(2,true,false),1,'B_TARGET_PROFILE_2_TO_1_IMMEDIATELY');
assert.equal(api.compute(1,false,true),2,'B_FOLLOW_1_TO_2_IMMEDIATELY');
assert.equal(api.compute(0,true,false),0,'COUNTER_FLOOR_ZERO');
pending=[{targetUid:'A',baseTargetFollowerCount:2,baseFollowing:true,desiredFollowing:false}];
assert.equal(api.pending('B','A'),1,'ASYNC_REHYDRATION_B_PENDING_1');
assert.equal(api.pending('A','A'),null,'A_SEES_ONLY_CANONICAL_OWN_PROFILE');
pending=[];
assert.equal(api.pending('B','A'),null,'AFTER_SETTLEMENT_NO_PENDING_OVERLAY');

const click=slice(page,'  const toggleFollow = async () => {',
 '  const closeMoreSheet = () => {');
assert.match(click,/await setExploreFollow\(user, targetUid, requestedFollow, profile\)/);
assert.doesNotMatch(click,/queueExploreFollowFinalState380\(/);
assert.match(click,/readPendingExploreFollowIntents380\(viewerUid\)/);
assert.match(click,/followMutationInFlightRef\.current/);
assert.match(click,/getExploreFollowState\(user, targetUid, true\)/);
assert.match(click,/if \(persistConfirmed\) \{/);
assert.match(click,/paint\(requestedFollow, false\)/);
assert.match(click,/if \(persistConfirmed\) \{[\s\S]*?patchExplorePublicProfileFirstViewProfile\(targetUid/);
assert.match(click,/paint\(requestedFollow, false\)/);
assert.match(page,/getExploreFollowState\(user, nextProfile\.uid, true\)/);
assert.match(page,/disabled=\{followBusy \|\| !followState\}/);
assert.match(page,/readPendingTargetFollowerCount525\(user\.uid,displayProfile379\.uid\)/);
assert.match(page,/readPendingTargetFollowerCount525\(user\.uid,displayRefreshedProfile379\.uid\)/);

// APP527 regression: no implicit follower-list request on focus/visibility.
const explicit=slice(page,
 '  const openProfileConnections376 = async (direction: ExploreProfileConnectionDirection) => {',
 '  // APP527: A\'s profile must not spend D1/R2 on window focus, blank-space');
assert.match(explicit,/const ownFollowers523 = direction === 'followers' && targetUid === user\?\.uid/);
assert.match(explicit,/profileConnectionsOpen376 !== 'followers'/);
assert.match(explicit,/if \(cached\) \{[\s\S]*?if \(!refreshOwn523\) \{[\s\S]*?return;/);
assert.match(explicit,/getExploreProfileConnections\(targetUid, direction, null, refreshOwn523\)/);
assert.match(explicit,/if \(!page.nextCursor\) \{/);
assert.doesNotMatch(page,/onOwnFollowersFocus525|ownFollowersHeaderLastCheck525Ref|ownFollowersHeaderInflight525Ref/);
const ownerBegin548=page.indexOf('  // APP542:');
const ownerEnd548=page.indexOf('  // APP527:',ownerBegin548);
assert.ok(ownerBegin548>0&&ownerEnd548>ownerBegin548);
const ownerSignal548=page.slice(ownerBegin548,ownerEnd548);
assert.match(ownerSignal548,/if\(confirmedNewEvent&&profileConnectionsOpen376Ref\.current==='followers'\)/);
assert.match(ownerSignal548,/getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
assert.match(ownerSignal548,/initialSnapshotHandled=true/);
assert.ok(ownerSignal548.includes('const changedList=isNewEvent||'));
assert.ok(ownerSignal548.includes('(!previousMarker&&profile?.followerCount!==count)'));
assert.ok(ownerSignal548.indexOf('const changedList=isNewEvent')<
 ownerSignal548.indexOf("if(confirmedNewEvent&&profileConnectionsOpen376Ref.current"),
 'COLD_RETAINED_NEW_REVISION_INVALIDATES_LIST_WITHOUT_NETWORK_GET');
assert.doesNotMatch(page.slice(0,ownerBegin548)+page.slice(ownerEnd548),
 /getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
assert.doesNotMatch(page,/window\.addEventListener\('focus',onOwnFollowersFocus525\)/);
assert.match(social,/forceServer \? 'no-store' : 'default'/);
assert.match(social,/if \(!normalizedCursor && !forceServer\)/);
console.log('APP647_ACTOR_B_CANONICAL_FOLLOW_COUNT_LEGACY_PENDING_PROTECTED=PASS');
console.log('APP527_OWNER_A_EXPLICIT_ONLY_NO_FOCUS_LIST_READ=PASS');
console.log('APP525_NO_BACKGROUND_POLL_NO_PRECOMMIT_PUBLIC_WRITE=PASS');
