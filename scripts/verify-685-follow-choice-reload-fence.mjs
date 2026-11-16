// APP685: the newest explicit local Follow/Unfollow survives route changes,
// reload and stale retained RTDB/GET without claiming a canonical ACK.
// No network, shared data or production mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/services/exploreFollowChoice685.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const entries=new Map();
const localStorage={
 getItem:key=>entries.has(key)?entries.get(key):null,
 setItem:(key,val)=>{entries.set(key,val);},
};
const exports={};
runInNewContext(compiled,{exports,localStorage,Date,JSON,Object,Number,String,Map,Set});
const {readExploreFollowLocalChoice685:read,
 rememberExploreFollowLocalChoice685:remember,
 shouldKeepExploreFollowChoice685:keep,
 shouldIgnoreExploreFollowSignal685:ignore,
 clearExploreFollowLocalChoice685:clear}=exports;
const now=1_800_000_000_000;
remember('B','C',true,false,now);
assert.equal(read('B','C',now).following,true,'clicked choice survives a reload');
assert.equal(read('A','C',now),null,'no cross-account cache bleed');
assert.equal(ignore('B','C',now-5,now+100),true,'old retained RTDB signal rejected');
assert.equal(ignore('B','C',now+5,now+100),false,'newer remote signal allowed');
assert.equal(keep('B','C',false,now-1,now+5),true,'old GET must not repaint');
assert.equal(keep('B','C',false,now+1,now+5),true,'pending intent protects any GET');
remember('B','C',true,true,now+100);
assert.equal(keep('B','C',false,now+120,now+500),true,
 'just confirmed state survives immediate revisit before R2 catches up');
assert.equal(keep('B','C',false,now+120,now+31_000),false,
 'local receipt has bounded precedence; later server truth wins');
remember('B','C',false,true,now+200);
assert.equal(read('B','C',now+300).following,false,'last unfollow choice wins');
remember('B','C',false,true,now+301,7);
assert.equal(read('B','C',now+302).targetFollowerCount,7,
 'canonical follower count survives one reload');
remember('B','C',false,true,now+303);
assert.equal(read('B','C',now+304).targetFollowerCount,7,
 'same-account settled notification cannot erase the exact count');
remember('B','C',true,false,now+305);
assert.equal(read('B','C',now+306).targetFollowerCount,undefined,
 'a new uncommitted choice cannot impersonate a canonical public receipt');
assert.equal(ignore('B','C',now+190,now+300),true);
assert.equal(read('B','C',now+11*60_000),null,'expired local receipt discarded');
remember('B','C',false,false,now+400);
clear('B','C');
assert.equal(read('B','C',now+401),null,
 'failed/unknown ACK must not keep a stale click that hijacks the next tap');
remember('B','C',true,true,now+402,4);
clear('B','C');
assert.equal(read('B','C',now+403),null,'clear affects only one target pair');
remember('B','D',true,true,now+404,2);
clear('B','C');
assert.equal(read('B','D',now+405).following,true,
 'failure cleanup must not erase any other pending or settled relation');

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const queue=readFileSync('src/services/exploreFollowBatchService380.ts','utf8');
const event=readFileSync('src/services/exploreFollowPendingResume681.ts','utf8');
const toggleStart=page.indexOf('  const toggleFollow = async () => {');
const toggleEnd=page.indexOf('  const closeMoreSheet',toggleStart);
assert.ok(toggleStart>0&&toggleEnd>toggleStart);
const toggle=page.slice(toggleStart,toggleEnd);
assert.match(toggle,/rememberExploreFollowLocalChoice685\(viewerUid,targetUid,requestedFollow,false\)/);
assert.match(toggle,/readPendingExploreFollowIntents380\(viewerUid\)/);
assert.match(toggle,/setFollowSavingUid685\(targetUid\)/);
assert.match(toggle,/paint\(requestedFollow, false\)/);
assert.match(toggle,/if \(persistConfirmed\) \{[\s\S]*?if \(canonical\?\.countVerified661===true\)/);
assert.match(toggle,/rememberExploreFollowLocalChoice685\(viewerUid,targetUid,\s*confirmed.isFollowing,true,Date.now\(\),/);
assert.match(toggle,/clearExploreFollowLocalChoice685\(viewerUid,targetUid\)/);
assert.match(toggle,/if\(latest\)paint\(restored,true,latest\)/);
assert.doesNotMatch(toggle,/rememberExploreFollowLocalChoice685\(viewerUid,targetUid,restored,true\)/,
 'never mark an unverified fallback as settled after a missing ACK');
assert.match(page,/void getExploreFollowState\(activeUser380,targetUid380,true\)/);
assert.doesNotMatch(page,/followerCount: failure380\.baseTargetFollowerCount/,
 'reload recovery must never write the pre-click count back over a committed server value');

assert.match(page,/confirmedFollower689===null&&/);
assert.match(page,/followerCount:confirmedFollower689\?\?/);
assert.match(page,/disabled=\{!followState\}/);
assert.match(page,/aria-busy=\{followSavingUid685===profile.uid\}/);
const followButton686=page.slice(
  page.indexOf('onClick={toggleFollow}'),
  page.indexOf('onClick={toggleFollow}')+650,
);
assert.match(followButton686,/followState\?\.isFollowing \? '팔로잉' : '팔로우'/);
assert.doesNotMatch(followButton686,/저장 중|팔로우 해제 ·/);
assert.match(page,/팔로워 <strong>\{formatCount\(profile\.followerCount\)\}<\/strong>/);
assert.match(page,/팔로잉 <strong>\{formatCount\(profile\.followingCount\)\}<\/strong>/);
assert.doesNotMatch(page,/팔로워 <strong>\{profileCountsVerifying|팔로워 <strong>\{profileCountsVerifying\|\|/);
console.log('APP686_ORIGINAL_FOLLOW_LABELS_AND_NUMERIC_COUNTS_RESTORED=PASS');
assert.match(page,/shouldIgnoreExploreFollowSignal685\(/);
assert.match(page,/const keepChoice685=!pending525&&shouldKeepExploreFollowChoice685\(/);
assert.match(event,/rememberExploreFollowLocalChoice685\(\s*value.viewerUid,value.targetUid,value.following,true\)/);
assert.match(queue,/if \(request.restoredUpdatedAt !== undefined\) return/);
assert.match(queue,/removeStored380\(entry.viewerUid, entry.targetUid\)/);
console.log('APP685_PERSISTED_LAST_FOLLOW_CHOICE_AND_ACCOUNT_ISOLATION=PASS');
console.log('APP685_OLD_GET_AND_RETAINED_RTDB_CANNOT_REVERSE_LAST_CLICK=PASS');
console.log('APP685_NO_DOUBLE_COUNT_WHILE_CANONICAL_SETTLEMENT_PENDING=PASS');
console.log('APP685_BOUNDED_RECEIPT_AND_NO_PAGE_ENTRY_SERVER_POLLING=PASS');
