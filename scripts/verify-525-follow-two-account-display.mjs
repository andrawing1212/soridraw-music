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
assert.match(click,/optimisticTargetFollowerCount525=computeFollowTargetDisplay525\(/);
assert.match(click,/followerCount: optimisticTargetFollowerCount525/);
assert.match(click,/previous\?\.uid===targetUid[\s\S]*?followerCount:optimisticTargetFollowerCount525/);
assert.match(click,/queueExploreFollowFinalState380\(/);
assert.match(click,/deferTargetFollowers: true/);
assert.doesNotMatch(click.slice(0,click.indexOf('queueExploreFollowFinalState380')),
 /patchExplorePublicProfileFirstViewProfile\(targetUid/,
 'NO_UNSETTLED_PUBLIC_CACHE_WRITES');
assert.match(page,/readPendingTargetFollowerCount525\(user\.uid,displayProfile379\.uid\)/);
assert.match(page,/readPendingTargetFollowerCount525\(user\.uid,displayRefreshedProfile379\.uid\)/);

const owner=slice(page,
 '  // APP525: B\'s private follow signal does not reach A.',
 '  const loadMoreProfileConnections376 =');
assert.match(owner,/profile\?\.uid!==ownerUid/);
assert.match(owner,/document\.visibilityState!=='visible'/);
assert.match(owner,/window\.addEventListener\('focus',onOwnFollowersFocus525\)/);
assert.match(owner,/document\.addEventListener\('visibilitychange',onOwnFollowersFocus525\)/);
assert.match(owner,/ownFollowersHeaderLastCheck525Ref\.current\.get\(ownerUid\)/);
assert.match(owner,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523/);
assert.match(owner,/ownFollowersHeaderInflight525Ref\.current\.has\(ownerUid\)/);
assert.match(owner,/getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
assert.match(owner,/if\(page525\.nextCursor\)return/);
assert.match(owner,/patchExplorePublicProfileFirstViewProfile\(ownerUid,\{followerCount:exact\}\)/);
assert.match(owner,/setProfile\(previous=>previous\?\.uid===ownerUid/);
assert.doesNotMatch(owner,/setInterval\(|setTimeout\(|runTransaction\(/);
assert.match(social,/forceServer \? 'no-store' : 'default'/);
assert.match(social,/if \(!normalizedCursor && !forceServer\)/);
console.log('APP525_ACTOR_B_INSTANT_FOLLOWER_COUNT_PENDING_RELOAD=PASS');
console.log('APP525_OWNER_A_FOCUS_ONE_BOUNDED_FRESH_LIST_RECHECK=PASS');
console.log('APP525_NO_BACKGROUND_POLL_NO_PRECOMMIT_PUBLIC_WRITE=PASS');
