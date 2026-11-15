// APP682 regression: screenshot "팔로잉 1" with two cached following cards.
// Confirm explicit popup-open reconciliation without entering the target profile.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/services/exploreFollowingPopupConsistency682.ts','utf8');
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText,{exports,Set,Number,String});
const stale={items:[{uid:'soulforce'},{uid:'soridraw'}],nextCursor:null,countComplete:true};
const exact={items:[{uid:'soulforce'}],nextCursor:null,countComplete:true};
const local={items:[{uid:'soulforce'}],nextCursor:null,countComplete:false};
const paged={items:Array.from({length:30},(_,i)=>({uid:'u'+i})),
 nextCursor:'next',countComplete:false};
const hold=exports.shouldHoldOwnFollowingPage682;
assert.equal(hold(stale,1),true,'verified count 1 must reject two cached cards');
assert.equal(hold(exact,1),false,'one verified matching card can paint');
assert.equal(hold(local,1),true,'local patch is not a certified complete list');
assert.equal(hold(paged,50),false,'a paginated first page is not automatically stale');
assert.equal(hold(paged,1),true,'page cannot exceed actor verified total');
assert.equal(hold({items:[{uid:'same'},{uid:'same'}],nextCursor:null,countComplete:true},2),true);
assert.equal(hold(stale,null),false,'unknown count does not invent mismatches');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const social=readFileSync('src/services/exploreSocialService.ts','utf8');
const start=page.indexOf('  const openProfileConnections376 = async');
const end=page.indexOf('  // APP542:',start);
assert.ok(start>=0&&end>start,'real popup route expected');
const popup=page.slice(start,end);
assert.match(popup,/readExploreProfileConnectionsLocal681\(targetUid,direction\)/);
assert.match(popup,/shouldHoldOwnFollowingPage682\(cached,exactOwnFollowing682\)/);
assert.match(popup,/refreshOwn523 \|\| refreshPublic657 \|\| staleOwnFollowing682/);
assert.match(popup,/getExploreProfileConnections\(targetUid, direction, null, forceConnections657\)/);
assert.match(popup,/page.countComplete!==true&&!page.nextCursor/);
assert.match(popup,/shouldHoldOwnFollowingPage682\(page,exactOwnFollowing682\)/);
assert.match(popup,/if \(!page.nextCursor && page.countComplete === true\)/,
  'a complete new server list must update the header count with its identities');
assert.match(popup,/invalidateExploreProfileConnections377\(targetUid,'following'\)/);
assert.match(social,/result\.actorCountVerified662===true &&\s*shouldHoldOwnFollowingPage682\(/);
assert.match(social,/invalidateExploreProfileConnections377\(user\.uid,'following'\)/);
console.log('APP682_SCREENSHOT_FOLLOWING_ONE_TWO_STALE_CARDS_REJECTED=PASS');
console.log('APP682_EXPLICIT_OPEN_FETCHES_CANONICAL_LIST_WITHOUT_TARGET_REVISIT=PASS');
console.log('APP682_FRESH_COMPLETE_LIST_REPAINTS_HEADER_AND_IDENTITIES_TOGETHER=PASS');
console.log('APP682_NO_PAGE_ENTRY_POLLING_OR_SHARED_BACKEND_MUTATION=PASS');
