import assert from 'node:assert/strict';
import {runOwnerFollowPrecommit557} from '../cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
const C='soulforceC',A='actorA',token='test_cutover_680';
const manifest={relationMode:'overlay348',writeMode:'active',
 profileCountsR2Exact:true,crashConsistentWriter354:true,
 orderedClientRequests354:true,legacyRelationWritersFrozen:true,
 legacyCounterWritersFrozen:true,cutoverToken:token};
const profile={revision:12,body:{data:{profile:{uid:C}}},
 followSync354:{token,exact:true,pending:{}}};
const asR2=x=>x===null?null:{text:async()=>JSON.stringify(x)};
const media={get:async(key)=>{
 if(key==='internal/explore/follow-cutover-v348/active.json')return asR2(manifest);
 if(key.startsWith('internal/explore/shared-profile-v113/'))return asR2(profile);
 return null;
}};
const body=()=>new Request('https://preview/v1/profiles/'+C+'/follow',{
 method:'PUT',headers:{Origin:'https://preview.soridraw.com'},body:'{}'});
const build=async({publicTarget=1,epoch='',flag='1',baseline=0}={})=>{
 let reservations=[],writes=0,canonicalBody=[];
 const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680:flag,PROFILE_MEDIA:media,
 DB:{prepare:()=>({bind:()=>({first:async()=>({epoch,public_target:publicTarget,
 baseline,override_following:null})})})}};
 const response=await runOwnerFollowPrecommit557({
  request:body(),env,ctx:{},enabled:true,publicWithoutEpoch:true,
  authenticate:async()=>({ok:true,uid:A}),
  reserve:async ticket=>{reservations.push(ticket);return {ok:true}},
  callCanonical:async req=>{writes++;canonicalBody.push(await req.clone().text());
   return Response.json({ok:true})},
 });
 assert.equal(response.status,200);
 assert.equal(writes,1);
 return {reservations,canonicalBody};
};
let actual=await build();
assert.equal(actual.reservations.length,1);
assert.equal(actual.reservations[0].ownerUid,C);
assert.equal(actual.reservations[0].actorUid,A);
assert.equal(actual.reservations[0].authEpoch,'0'.repeat(32));
assert.equal(actual.reservations[0].priorR2Revision,12);
assert.equal(actual.reservations[0].desired,true);
assert.match(actual.canonicalBody[0],/followOperationId/);
actual=await build();
assert.equal(actual.reservations[0].operationId,
 (await build()).reservations[0].operationId,'identical retries use stable operation ID');
assert.equal((await build({publicTarget:0})).reservations.length,0);
assert.equal((await build({flag:'0'})).reservations.length,0);
assert.equal((await build({baseline:1})).reservations.length,0);
assert.equal((await build({epoch:'a'.repeat(32)})).reservations[0].authEpoch,'a'.repeat(32));
console.log('APP680_PUBLIC_UNENROLLED_EXACT_DURABLE_RESERVATION=PASS');
console.log('APP680_PRIVATE_UNCHANGED_NOOP_AND_LEGACY_REPLAY=PASS');
