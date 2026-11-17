// Isolated APP713 HMAC oracle test, no Firebase or Cloudflare requests.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyCurrentActor713,APP713_ACTOR_ORACLE_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-actor-verify-713.mjs';
assert.equal(APP713_ACTOR_ORACLE_COMPILED_OPEN,false);
const uid='rcZ2GZrBndOZzT8C635eiNBjYIJ2',operationId='click713_test_operation_00000000000';
const secret='test_shared_follow_hmac_secret_1234567890_x';
const now=()=>Date.now();
const env={SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_FOLLOW_SERVER_CLICK_713:'1',
 SORIDRAW_FOLLOW_CANARY_UID_713:uid,
 SORIDRAW_OWNER_FOLLOW_HMAC_539:secret};
const key=createHmac('sha256',secret).update('soridraw:preview:actor-proof:713').digest();
let reads=0;
const send=async(_url,request)=>{
 reads++;
 const subject=JSON.parse(request.body);
 const actual=createHmac('sha256',key).update(subject.at+'.'+request.body).digest('hex');
 assert.equal(request.headers['X-Soridraw-Actor-713-Signature'],actual);
 const response=JSON.stringify({...subject,ok:true,at:now()});
 return new Response(response,{status:200,headers:{
  'X-Soridraw-Actor-713-Proof':createHmac('sha256',key).update(response).digest('hex'),
 }});
};
const args={actorUid:uid,operationId,issuedAtSec:Math.floor(now()/1000)-5,
 env,send,now};
assert.equal(await verifyCurrentActor713(args),true);
assert.equal(reads,1);
assert.equal(await verifyCurrentActor713({...args,actorUid:'not-allowed'}),false);
assert.equal(await verifyCurrentActor713({...args,env:{...env,SORIDRAW_ENVIRONMENT:'production'}}),false);
assert.equal(await verifyCurrentActor713({...args,env:{...env,SORIDRAW_FOLLOW_SERVER_CLICK_713:'0'}}),false);
assert.equal(reads,1,'other actors and disabled modes call no Firebase Function');
assert.equal(await verifyCurrentActor713({...args,send:async()=>new Response('{"ok":true}',{
 status:200,headers:{'X-Soridraw-Actor-713-Proof':'0'.repeat(64)}})}),false);
assert.equal(await verifyCurrentActor713({...args,send:async()=>new Response('{}',{status:409})}),false);
console.log('APP713_ACTOR_HMAC_CURRENT_GENERATION_CANARY_FAIL_CLOSED=PASS');
