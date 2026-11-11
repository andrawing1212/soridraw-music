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
