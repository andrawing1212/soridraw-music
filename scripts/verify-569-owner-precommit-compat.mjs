// APP569: follow-only owner-sync rollout compatibility, isolated fake DB.
// Existing (unenrolled) users must NEVER lose their canonical follow Writer.
import assert from 'node:assert/strict';
import {runOwnerFollowPrecommit557,APP557_OWNER_PRECOMMIT_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
assert.equal(APP557_OWNER_PRECOMMIT_COMPILED_OPEN,false);
const input=new Request('https://local.invalid/v1/profiles/A/follow',{
 method:'PUT',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({followOperationId:'operation_1234567890abcdef',
 followExpectedRevision:0}),
});
const EPOCH='0123456789abcdef0123456789abcdef';
let row=null,canonical=0,reads=0,reservations=0,r2=0;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 DB:{prepare:()=>({bind:()=>({first:async()=>{reads++;return row;}})})},
 PROFILE_MEDIA:{get:async()=>{r2++;throw Error('R2_NOT_NEEDED');}},
};
const canonicalResponse=()=>{canonical++;return Response.json({ok:true,canonical:true})};
const invoke=({enabled=true}={})=>runOwnerFollowPrecommit557({
 request:input,env,enabled,ctx:{},
 authenticate:async()=>({ok:true,uid:'B'}),
 reserve:async()=>{reservations++;return {ok:true}},
 callCanonical:canonicalResponse,
});
const check=async({epoch,hasRow=true,expectCanonical,expectR2,expectStatus,tag})=>{
 row=hasRow?{epoch,baseline:0,override_following:null}:null;
 canonical=reads=reservations=r2=0;
 const response=await invoke();
 assert.equal(response.status,expectStatus,tag+'_STATUS');
 assert.equal(canonical,expectCanonical,tag+'_CANONICAL');
 assert.equal(reads,1,tag+'_ONE_INDEXED_OWNER_LOOKUP');
 assert.equal(reservations,0,tag+'_NO_DURABLE_RESERVATION');
 assert.equal(r2,expectR2,tag+'_R2_COST');
};
await check({epoch:'',expectCanonical:1,expectR2:0,expectStatus:200,tag:'UNENROLLED'});
await check({epoch:'',hasRow:false,expectCanonical:1,expectR2:0,expectStatus:200,tag:'UNKNOWN_OWNER_CANONICAL_HANDLES_404'});
await check({epoch:'invalid',expectCanonical:0,expectR2:0,expectStatus:503,tag:'CORRUPT_EPOCH_FAIL_CLOSED'});
await check({epoch:EPOCH,expectCanonical:0,expectR2:1,expectStatus:503,tag:'ENROLLED_R2_DOWN_FAIL_CLOSED'});
row=null;canonical=reads=reservations=r2=0;
const off=await invoke({enabled:false});
assert.equal(off.status,200);assert.equal(canonical,1);
assert.equal(reads+reservations+r2,0,'DISABLED_ZERO_NEW_BACKEND_IO');
console.log('APP569_UNENROLLED_CANONICAL_FOLLOW_UNCHANGED=PASS');
console.log('APP569_CORRUPT_EPOCH_AND_ENROLLED_RELAY_FAIL_CLOSED=PASS');
console.log('APP569_DISABLED_ZERO_BACKEND_IO=PASS');


// APP579: a valid old/unversioned client gets a server-issued stable
// operation only for one explicitly enrolled, changed owner. The old request
// is never sent unchanged after durable reservation, and neither baseline
// counts nor non-enrolled users are modified by this adapter.
const manifest579={relationMode:'overlay348',writeMode:'active',
 profileCountsR2Exact:true,crashConsistentWriter354:true,
 orderedClientRequests354:true,legacyRelationWritersFrozen:true,
 legacyCounterWritersFrozen:true,cutoverToken:'qa_cutover_579'};
const profile579={body:{data:{profile:{uid:'A'}}},
 revision:22,followSync354:{token:'qa_cutover_579',exact:true,pending:{}}};
const blob579=value=>({text:async()=>JSON.stringify(value)});
let canonicalBodies579=[],tickets579=[],r2Reads579=[],dbReads579=0;
let ownerBefore579=0;
const compatEnv579={
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 DB:{prepare:()=>({bind:()=>({first:async()=>{
  dbReads579++;
  return {epoch:EPOCH,baseline:ownerBefore579,override_following:null};
 }})})},
 PROFILE_MEDIA:{get:async key=>{
  r2Reads579.push(key);
  if(key.endsWith('/active.json'))return blob579(manifest579);
  if(key.includes('follow-intents-v354'))return null;
  if(key.includes('shared-profile-v113'))return blob579(profile579);
  throw Error('UNEXPECTED_R2_KEY');
 }},
};
const invokeCompat579=async({method='PUT',body,enabled=true}={})=>
 runOwnerFollowPrecommit557({
  request:new Request('https://local.invalid/v1/profiles/A/follow',{
   method,headers:{Authorization:'Bearer synthetic', 'X-Firebase-AppCheck':'synthetic',
    ...(body===undefined?{}:{'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),
  }),env:compatEnv579,enabled,ctx:{},
  authenticate:async()=>({ok:true,uid:'B'}),
  reserve:async ticket=>{tickets579.push(ticket);return {ok:true};},
  callCanonical:async original=>{canonicalBodies579.push({
   method:original?.method||method,
   auth:original?.headers?.get('Authorization')||'untouched',
   appcheck:original?.headers?.get('X-Firebase-AppCheck')||'untouched',
   contentType:original?.headers?.get('Content-Type')||'',
   body:original?await original.clone().text():'untouched',
  });return Response.json({ok:true});},
 });
const reset579=()=>{canonicalBodies579=[];tickets579=[];r2Reads579=[];dbReads579=0;};
reset579();
let response579=await invokeCompat579();
assert.equal(response579.status,200);
assert.equal(tickets579.length,1,'LEGACY_CHANGED_MUST_RESERVE_BEFORE_CANONICAL');
assert.equal(canonicalBodies579.length,1);
const ticket579=tickets579[0],forwarded579=JSON.parse(canonicalBodies579[0].body);
assert.match(ticket579.operationId,/^owner_follow_579_[0-9a-f]{64}$/);
assert.deepEqual(forwarded579,{followOperationId:ticket579.operationId,
 followExpectedRevision:ticket579.expectedRevision});
assert.equal(ticket579.expectedRevision,0,'LEGACY_FIRST_PAIR_REVISION');
assert.equal(ticket579.priorR2Revision,22);
assert.equal(canonicalBodies579[0].auth,'Bearer synthetic');
assert.equal(canonicalBodies579[0].appcheck,'synthetic');
assert.match(canonicalBodies579[0].contentType,/application\/json/);
assert.equal(dbReads579,1);
assert.equal(r2Reads579.length,3,'ONLY_ENROLLED_CHANGED_R2_PREFLIGHT');
reset579();
response579=await invokeCompat579();
assert.equal(response579.status,200);
assert.equal(tickets579[0].operationId,ticket579.operationId,
 'LEGACY_RETRY_MUST_REUSE_STABLE_CANONICAL_ID');
assert.equal(tickets579[0].expectedRevision,ticket579.expectedRevision);
reset579();
response579=await invokeCompat579({method:'DELETE'});
assert.equal(response579.status,200);
assert.equal(tickets579.length,0,'SAME_STATE_MUST_NOT_RESERVE');
assert.equal(r2Reads579.length,0,'SAME_STATE_MUST_NOT_FETCH_R2');
reset579();
response579=await invokeCompat579({body:{followOperationId:'bad'}});
assert.equal(response579.status,200);
assert.equal(tickets579.length,0,'MALFORMED_VERSIONED_BODY_MUST_NOT_UPGRADE');
assert.equal(dbReads579,0,'MALFORMED_VERSIONED_BODY_PRESERVES_CANONICAL');
assert.equal(canonicalBodies579[0].body,'untouched');
reset579();
response579=await invokeCompat579({enabled:false});
assert.equal(response579.status,200);
assert.equal(tickets579.length,0);assert.equal(dbReads579,0);
assert.equal(r2Reads579.length,0,'OFF_ZERO_COMPAT_BILLING');
ownerBefore579=1;
reset579();
response579=await invokeCompat579({method:'DELETE'});
assert.equal(response579.status,200);
assert.equal(tickets579.length,1,'LEGACY_UNFOLLOW_CHANGED_RESERVES');
assert.notEqual(tickets579[0].operationId,ticket579.operationId);
assert.equal(JSON.parse(canonicalBodies579[0].body).followExpectedRevision,0);
console.log('APP579_LEGACY_CHANGED_PRECOMMIT_RESERVES_STABLE_SERVER_OPERATION=PASS');
console.log('APP579_AUTH_HEADERS_RETAINED_NOOP_PARTIAL_OFF_PRESERVED=PASS');
