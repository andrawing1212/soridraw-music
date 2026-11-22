// APP774 — signed OFFLINE evidence of precommit bypass in the *actual pinned*
// PREVIEW source. This deliberately does not patch legacy Writer behaviour.
// No Cloudflare, Auth, R2, D1, DO, production or user data.
import assert from 'node:assert/strict';
import {runOwnerFollowPrecommit557,APP557_OWNER_PRECOMMIT_COMPILED_OPEN}
 from '../pinned-preview/cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs';
import {readFileSync} from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP774_QA_NO_NETWORK')};
const source=readFileSync(
 'pinned-preview/cloudflare/explore-worker/runtime/owner-follow-precommit-557.mjs','utf8');
assert.equal(APP557_OWNER_PRECOMMIT_COMPILED_OPEN,false);
assert.match(source,/if\(!row\|\|\(row\.epoch===''&&!publicOnly680\)\)return callCanonical\(\);/);
assert.match(source,/if\(!ordered&&!unversioned\)return callCanonical\(\);/);
assert.match(source,/if\(!enabled\|\|env\?\.SORIDRAW_ENVIRONMENT!=='preview'/);
const env={
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 DB:{prepare:()=>({bind:()=>({first:async()=>({
  epoch:'',baseline:0,override_following:null,
 })})})},
};
const request=body=>new Request('https://preview.soridraw.com/v1/profiles/qa774Owner/follow',{
 method:'PUT',headers:{'Content-Type':'application/json'},body});
let bypass=0,reserve=0;
const args={
 env,enabled:true,publicWithoutEpoch:false,
 authenticate:async()=>({ok:true,uid:'qa774Actor'}),
 reserve:async()=>{reserve++;throw Error('NOT_EXPECTED')},
 callCanonical:async()=>{bypass++;return Response.json({ok:true,from:'LEGACY_CANONICAL_MOCK'})},
};
try{
 const cases=['','{}','{"followOperationId":"partial"}'];
 for(const body of cases){
  const response=await runOwnerFollowPrecommit557({...args,request:request(body)});
  assert.equal(response.status,200);
  assert.equal((await response.json()).from,'LEGACY_CANONICAL_MOCK');
 }
 assert.equal(bypass,3,'legacy requests were not fenced at unified intake');
 assert.equal(reserve,0,'no R2/DO reservation was invoked');
 const before=bypass;
 const calls=await Promise.all([
  runOwnerFollowPrecommit557({...args,request:request('{}')}),
  runOwnerFollowPrecommit557({...args,request:request('{}')}),
 ]);
 assert.equal(calls.filter(x=>x.status===200).length,2);
 assert.equal(bypass-before,2);
 assert.equal(reserve,0);
 console.log('APP774_PINNED_PREVIEW_LEGACY_BYPASS_WITNESS=PASS');
 console.log('APP774_UNVERSIONED_AND_PARTIAL_ENVELOPES_MOCK_CANONICAL_CALLS=3');
 console.log('APP774_CONCURRENT_MOCK_CANONICAL_CALLS=2');
 console.log('APP774_ALL_LEGACY_WRITERS_MANDATORY_NEW_ADMISSION=FAIL_HOLD');
 console.log('APP774_REAL_CANONICAL_WRITER_D1_W1_W2=NOT_TESTED');
 console.log('APP774_PREVIEW_PRODUCTION_TEST_SHARED_MUTATIONS=0');
}finally{globalThis.fetch=original;}
