import assert from 'node:assert/strict';
import {createVerifiedPublicFollowClaim669} from '../cloudflare/explore-worker/runtime/public-follow-proven-pair-669.mjs';
const reservation={actorUid:'Actor',ownerUid:'Target',operationId:'operation_1234567890',
 cutoverToken:'token',priorR2Revision:10};
let proofCalls=0,sqlCalls=0,r2Calls=0;
const profile=(uid,rev)=>({
 uid,revision:rev,body:{data:{profile:{uid,followerCount:uid==='Actor'?1:8,
  followingCount:uid==='Actor'?9:2}}},
 followSync354:{exact:true,pending:{}},
});
const items={Actor:profile('Actor',17),Target:profile('Target',21)};
const rows=[
 {uid:'Actor',isPublic:1,epoch:'a'.repeat(32)},
 {uid:'Target',isPublic:1,epoch:'b'.repeat(32)},
];
const env={
 DB:{prepare(sql){
 assert.match(sql,/WHERE p.uid IN \(\?,\?\) LIMIT 2/);
 return {bind(...uids){
 assert.deepEqual(uids,['Actor','Target']);
 return {async all(){sqlCalls++;return {results:rows}}};
 }};
 }},
 PROFILE_MEDIA:{async get(path){r2Calls++;
 const uid=decodeURIComponent(path.match(/([^/]+)\.json$/)?.[1]||'');
 return items[uid]?{async text(){return JSON.stringify(items[uid])}}:null;
 }},
};
const verified=async()=>{proofCalls++;return {committed:true,status:'committed'}};
const run=(changes={})=>createVerifiedPublicFollowClaim669({
 reservation,env,now:()=>1800000000000,verify:verified,...changes,
});
let value=await run();
assert.equal(value.ready,true);
assert.equal(value.claim.actor.followingCount,9);
assert.equal(value.claim.target.followerCount,8);
assert.equal(value.claim.actor.generation,'0'.repeat(32));
assert.equal(value.claim.target.generation,'0'.repeat(32));
assert.deepEqual(value.readScope,{d1Rows:2,r2Objects:2});
assert.equal(sqlCalls,1);assert.equal(r2Calls,2);assert.equal(proofCalls,1);
const before=()=>[sqlCalls,r2Calls];
assert.equal((await run({verify:async()=>({committed:false,status:'intent-not-settled'})})).ready,false);
assert.deepEqual(before(),[1,2]);
rows[1].isPublic=0;
assert.equal((await run()).status,'not-public');
assert.equal(r2Calls,2);rows[1].isPublic=1;
rows[0].epoch='bad';
assert.equal((await run()).ready,true); // No enrollment requirement
rows[0].epoch='a'.repeat(32);
items.Target.followSync354.pending={x:1};
assert.equal((await run()).status,'r2-not-exact');
items.Target.followSync354.pending={};
items.Actor.followSync354.exact=false;
assert.equal((await run()).status,'r2-not-exact');
items.Actor.followSync354.exact=true;
items.Target.revision=10;
assert.equal((await run()).status,'target-revision-not-advanced');
items.Target.revision=21;
items.Actor.body.data.profile.followerCount=-1;
assert.equal((await run()).status,'r2-not-exact');
items.Actor.body.data.profile.followerCount=1;
const previousR2Calls=r2Calls;
rows[0].isPublic=0;
value=await run();
assert.equal(value.ready,true);
assert.equal(value.claim.actor,null);
assert.equal(value.claim.target.followerCount,8);
assert.deepEqual(value.readScope,{d1Rows:2,r2Objects:1});
assert.equal(r2Calls,previousR2Calls+1);
rows.splice(0,1);
value=await run();
assert.equal(value.ready,true);
assert.equal(value.claim.actor,null);
assert.deepEqual(value.readScope,{d1Rows:1,r2Objects:1});
rows.unshift({uid:'Actor',isPublic:1,epoch:'a'.repeat(32)});
assert.equal((await run({reservation:{...reservation,ownerUid:'Actor'}})).status,'invalid-reservation');
console.log('APP670_PRIVATE_OR_UNLISTED_ACTOR_NEVER_PUBLICLY_EMITTED=PASS');
console.log('APP669_EXACT_COMMIT_BEFORE_PUBLIC_R2_READ=PASS');
console.log('APP669_PUBLIC_STATUS_GENERATION_EXACT_PENDING_AND_REVISION_FENCES=PASS');
console.log('APP669_BOUNDED_ONE_D1_PAGE_TWO_R2_OBJECTS_NO_WRITES=PASS');
