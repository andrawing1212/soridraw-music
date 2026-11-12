// APP557 source-only authenticated boundary against actual overlay 354 shapes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runOwnerFollowPrecommit557,APP557_OWNER_PRECOMMIT_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
import {reserveOwnerFollowViaDo557}
 from '../cloudflare/explore-worker/runtime/owner-follow-do-557.mjs';
assert.equal(APP557_OWNER_PRECOMMIT_COMPILED_OPEN,false);
const id='op_1234567890abcdef',epoch='0123456789abcdef0123456789abcdef';
let baseline=0,cutoverReady=true,profileExact=true,stale=false,sameId=false,authOK=true,doOK=true;
const tally={auth:0,canonical:0,reserve:0,r2:0,d1R:0,d1W:0};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 PROFILE_MEDIA:{get:async key=>{
  tally.r2++;
  if(key==='internal/explore/follow-cutover-v348/active.json'){
   return {text:async()=>JSON.stringify({cutoverToken:'cutover-token',
    relationMode:'overlay348',writeMode:'active',
    crashConsistentWriter354:true,orderedClientRequests354:true,
    legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true,
    profileCountsR2Exact:cutoverReady})};
  }
  if(key==='internal/explore/shared-profile-v113/A.json')
   return {text:async()=>JSON.stringify({revision:18,body:{data:{profile:{uid:'A'}}},
    followSync354:{token:'cutover-token',exact:profileExact,pending:{}}})};
  assert.equal(key,'internal/explore/follow-intents-v354/cutover-token/B/A.json');
  if(stale)return {text:async()=>JSON.stringify({token:'cutover-token',actor:'B',target:'A',
    revision:5,settled:true})};
  if(sameId)return {text:async()=>JSON.stringify({
    token:'cutover-token',actor:'B',target:'A',id,
    following:true,expectedRevision:0,revision:5,settled:false,
  })};
  return null; // fresh pair, expectedRevision=0
 }},
 DB:{prepare:sql=>{assert.match(sql,/explore_follow_overrides_348/);return {bind:(...args)=>{
  assert.deepEqual(args,['B','A','B','A','A']);
  return {first:async()=>{tally.d1R++;return {epoch,baseline,override_following:null}}};
 }};}}};
const request=(operationId=id)=>new Request('https://preview.test/v1/profiles/A/follow',{
 method:'PUT',headers:{Authorization:'Bearer synthetic-token','X-Firebase-AppCheck':'local-token'},
 body:JSON.stringify({followOperationId:operationId,followExpectedRevision:0})});
let lastTicket;
const authenticate=async()=>{
 tally.auth++;
 return authOK?{ok:true,uid:'B'}:{ok:false,response:new Response('401',{status:401})};
};
const reserve=async ticket=>{
 tally.reserve++;lastTicket=ticket;
 return {ok:doOK,status:doOK?'reserved':'unavailable'};
};
const callCanonical=async()=>{tally.canonical++;return Response.json({ok:true})};
const run=async(options={})=>runOwnerFollowPrecommit557({
 request:request(),env,authenticate,callCanonical,reserve,enabled:true,...options});
assert.equal((await runOwnerFollowPrecommit557({
 request:request(),env,authenticate,callCanonical,reserve})).status,200);
assert.equal(tally.auth,0,'compiled OFF must add zero auth/r2/d1/DO work');
assert.equal((await run()).status,200);
assert.deepEqual({actor:lastTicket.actorUid,owner:lastTicket.ownerUid,
 op:lastTicket.operationId,expected:lastTicket.expectedRevision,desired:lastTicket.desired,
 before:lastTicket.beforeFollowing,prior:lastTicket.priorR2Revision},
 {actor:'B',owner:'A',op:id,expected:0,desired:true,before:false,prior:18});
assert.equal(tally.reserve,1);
baseline=1;
const writes=tally.reserve,beforeNoopR2=tally.r2;
assert.equal((await run()).status,200);
assert.equal(tally.reserve,writes,'canonical no-op must NOT reserve a DO alarm');
assert.equal(tally.r2,beforeNoopR2,'no-op admission must consume ZERO extra R2 GETs');
// Existing exact operation may be pending after an ambiguous canonical ACK.
// One manifest + one pair intent read suffices; no owner profile read, no DO.
baseline=0;sameId=true;
const beforeRetryR2=tally.r2,beforeRetryReserves=tally.reserve;
assert.equal((await run()).status,200);
assert.equal(tally.r2-beforeRetryR2,2,'same-id retry must skip owner R2 GET');
assert.equal(tally.reserve,beforeRetryReserves,'same-id retry cannot reserve twice');
sameId=false;doOK=false;
const beforeCanonical=tally.canonical;
assert.equal((await run()).status,503);
assert.equal(tally.canonical,beforeCanonical,'DO persistence failure must block canonical mutation');
doOK=true;authOK=false;
const beforeRead=tally.r2;
assert.equal((await run()).status,401);
assert.equal(tally.r2,beforeRead,'unauthenticated request may not read owner R2');
authOK=true;stale=true;
assert.equal((await run()).status,503);
stale=false;cutoverReady=false;
assert.equal((await run()).status,503);
cutoverReady=true;profileExact=false;
assert.equal((await run()).status,503);
profileExact=true;
const beforeReserve=tally.reserve;
assert.equal((await run({request:request('bad-operation')})).status,200);
assert.equal(tally.reserve,beforeReserve,'invalid operation uses frozen canonical rejection path');
const missing=await reserveOwnerFollowViaDo557(lastTicket,env);
assert.equal(missing.status,'missing-do-binding');
assert.equal(tally.d1W,0);
const preview=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(preview,/APP557_OWNER_PRECOMMIT_COMPILED_OPEN &&/);
assert.match(preview,/authenticate:validateExploreAuth307/);
assert.match(preview,/reserve:reserveOwnerFollowViaDo557,enabled:true/);
assert.match(preview,/response=await baseWorker.fetch\(request,env,ctx\)/);
console.log('APP557_AUTHENTICATED_PRECOMMIT_BEFORE_CANONICAL=PASS');
console.log('APP557_DISABLED_ZERO_IO_NOOP_NO_RESERVATION_AND_FAIL_CLOSED=PASS');
console.log('APP557_D1_CANONICAL_WRITES_ZERO_SOURCE_ONLY=PASS');
