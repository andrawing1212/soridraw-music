// APP790 combined source-only QA proof. Local signatures and local storage;
// no Firebase tokens, no real D1/R2/DO, no actual Functions/RTDB calls.
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign,createHmac,webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createApp790QaOwnerConnection,APP790_QA_CONNECTION_COMPILED_OPEN} from './app790-qa-auth-owner-connection.mjs';
globalThis.crypto??=webcrypto;
const frozen=process.argv[2];
assert(frozen,'frozen APP539 source checkout required');
const {sendOwnerFollowHttp539}=await import(pathToFileURL(resolve(frozen,'cloudflare/explore-worker/runtime/owner-follow-http-539.mjs')));
const config={projectId:'soridraw-app',projectNumber:'1083981050742',ownerUid:'qa790Owner',actorUid:'qa790Actor',authEpoch:'a'.repeat(32),hmacSecret:'b'.repeat(64)};
const {ownerUid,actorUid,authEpoch}=config,cutoverToken='qa790_isolated_new_epoch_00001';
let clock=1800000000000,marker={source:'QA790_TRUSTED_RTDB_MARKER',verified:true,ownerUid,authEpoch,version:7,followerCount:0};
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...keys.publicKey.export({format:'jwk'}),kid:'qa790-local',alg:'RS256',use:'sig'};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const sign=x=>{const v=encode({alg:'RS256',typ:'JWT',kid:jwk.kid})+'.'+encode(x);
 return v+'.'+createSign('RSA-SHA256').update(v).end().sign(keys.privateKey).toString('base64url')};
const auth=(uid=actorUid,project='soridraw-app')=>sign({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,auth_time:clock/1000-30,iat:clock/1000-20,exp:clock/1000+600});
const app=()=>sign({iss:'https://firebaseappcheck.googleapis.com/1083981050742',aud:['projects/1083981050742'],sub:'1:1083981050742:web:aabbccdd',iat:clock/1000-20,exp:clock/1000+600});
const request=(a,token=auth(),appToken=app())=>new Request('https://qa-only.invalid/qa730/verified/follow',{method:a.desired?'PUT':'DELETE',
 headers:{Authorization:'Bearer '+token,'X-Firebase-AppCheck':appToken,'Content-Type':'application/json'},
 body:JSON.stringify({followOperationId:a.canonicalOperationId,followExpectedRevision:a.expectedRevision})});
const objects=new Map(),memory=new Map();
let tag=0,alarm=null,issued=0,relayCalls=0,relay503=false,canonicalWrites=0,committed=null;
const copy=x=>structuredClone(x);
const bucket={async get(k){const x=objects.get(k);return x?{etag:x.etag,text:async()=>JSON.stringify(x.data)}:null},
 async put(k,v,options){const old=objects.get(k),c=options.onlyIf;
  if(c.etagDoesNotMatch==='*'&&old||c.etagMatches&&old?.etag!==c.etagMatches)return null;
  const value={etag:'e'+(++tag),data:JSON.parse(v)};objects.set(k,value);return {etag:value.etag}}};
const storage={async get(k){return memory.has(k)?copy(memory.get(k)):undefined},async getAlarm(){return alarm},async setAlarm(x){alarm=x},
 async transaction(fn){const draft=new Map([...memory].map(([k,v])=>[k,copy(v)]));let a=alarm;
  const result=await fn({async get(k){return draft.get(k)},async put(k,v){draft.set(k,copy(v))},async getAlarm(){return a},async setAlarm(x){a=x},async deleteAlarm(){a=null}});
  memory.clear();for(const [k,v] of draft)memory.set(k,v);alarm=a;return result}};
const op=(id,revision,desired)=>({ownerUid,actorUid,authEpoch,cutoverToken,canonicalOperationId:id,
 expectedRevision:revision,priorR2Revision:revision+6,desired,beforeFollowing:!desired});
const a=op('qa790_operation_follow_0000000001',7,true),b=op('qa790_operation_cancel_0000000001',8,false);
const proof=async ticket=>committed?.canonicalOperationId===ticket.canonicalOperationId?{
 ...ticket,source:'QA783_EXACT_D1_R2_SETTLED',verified:true,changed:true,canonicalD1Committed:true,
 r2ProjectionSettled:true,ownerEpochVerified:true,committedRevision:ticket.expectedRevision+1,
 nextR2Revision:ticket.priorR2Revision+1,d1OperationId:ticket.canonicalOperationId,r2OperationId:ticket.canonicalOperationId,
 followerCount:Number(ticket.desired),updatedAt:committed.updatedAt}:null;
const send=async(url,options)=>{
 if(options.method==='GET'){
  assert(['https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com','https://firebaseappcheck.googleapis.com/v1/jwks'].includes(url));
  return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'Cache-Control':'max-age=600'}})}
 assert.equal(url,'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542');
 assert.equal(options.redirect,'manual');relayCalls++;
 const p=JSON.parse(options.body),at=options.headers['X-Soridraw-Follow-Relay529-At'];
 assert.equal(options.headers['X-Soridraw-Follow-Relay529-Signature'],createHmac('sha256',config.hmacSecret).update(at+'.'+options.body).digest('hex'));
 assert.equal(p.ownerUid,ownerUid);assert.equal(p.authEpoch,authEpoch);
 assert.equal(p.revision,committed.expectedRevision+1);assert.equal(p.followerCount,Number(committed.desired));
 assert.equal(p.updatedAt,committed.updatedAt);
 if(relay503){relay503=false;return new Response('{}',{status:503})}
 const applied=p.revision>marker.version;
 if(applied)marker={...marker,version:p.revision,followerCount:p.followerCount};
 return new Response(JSON.stringify({ok:true,applied}),{status:200});
};
const args={enabled:true,scope:'APP790_ISOLATED_QA_SOURCE_ONLY',env:{SORIDRAW_ENVIRONMENT:'preview',QA790_ISOLATED:'1',QA790_R2:bucket},
 state:{storage},config,verifyBoundOwner:async()=>({ownerUid,verifiedOwnerDoIdentity:true}),now:()=>clock,issueId:()=>('qa790_server_receipt_'+String(++issued).padStart(16,'0')),
 readQaOwnerMarker:async()=>marker,verifySettledCanonical:proof,sendOwnerFollowHttp539,send,
 verifyTrustedEpoch:async a=>({source:'APP788_ISOLATED_SYNTHETIC_EPOCH_CERT',verified:true,ownerUid,actorUid,authEpoch,cutoverToken,
 allActiveAndLegacyWritersCovered:true,newEpochFromVerifiedGenesis:true,noHistoricalNamespaceReuse:true,
 ownerDoPitrIndependent:true,retentionAndAccountDeletionReviewed:true,physicalNamespaceIsolatedFromProduction:true,firstD1Revision:7,firstR2Revision:13})};
assert.equal(APP790_QA_CONNECTION_COMPILED_OPEN,false);assert.equal(createApp790QaOwnerConnection(),null);
assert.throws(()=>createApp790QaOwnerConnection({...args,env:{...args.env,SORIDRAW_ENVIRONMENT:'production'}}));
assert.throws(()=>createApp790QaOwnerConnection({...args,env:{...args.env,DB:{}}}));
const c=createApp790QaOwnerConnection(args);
assert.equal((await c.bootstrap(a)).status,'QA788_SYNTHETIC_GENESIS_FLOOR_CREATED');
const before=tag;
assert.equal((await c.reserve(request(a,auth(ownerUid)),a)).status,'HOLD');
assert.equal((await c.reserve(request(a,auth(actorUid,'soridraw-app-866a5')),a)).status,'HOLD');
assert.equal((await c.reserve(request(a,auth(),'invalid'),a)).status,'HOLD');
assert.equal(tag,before);assert.equal(issued,0);
let prepared=await c.reserve(request(a),a);
assert.equal(prepared.status,'QA788_ADMITTED_AND_OWNER_DO_RESERVED');
const receipt=prepared.receipt.operationId;
clock+=1000;assert.equal((await c.alarm()).status,'AWAITING_EXACT_SETTLEMENT');assert.equal(relayCalls,0);
clock+=16000;assert.equal((await c.alarm()).status,'AWAITING_EXACT_SETTLEMENT');assert.equal(relayCalls,0);
assert.equal(memory.get('app755-owner-follow-pending-v1').entries[0].delivery.attempts,0);
assert.equal((await c.armSettled(a,receipt)).status,'HOLD');
committed={...a,updatedAt:clock};canonicalWrites++;
assert.equal((await c.finalize(a,'wrong_receipt_00000000')).status,'HOLD');
assert.equal((await c.finalize(a,receipt)).status,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
assert.equal((await c.reserve(request(b),b)).status,'HOLD'); // RTDB baseline still old
assert.equal((await c.armSettled(a,receipt)).status,'QA790_EXISTING_ALARM_READY');
relay503=true;clock+=1000;assert.equal((await c.alarm()).retried,1);assert.equal(marker.version,7);
clock+=4000;assert.equal((await c.alarm()).delivered,1);assert.equal(marker.version,8);assert.equal(marker.followerCount,1);
assert.equal(relayCalls,2);assert.equal(canonicalWrites,1);
assert.equal((await c.alarm()).delivered,0);
prepared=await c.reserve(request(b),b);assert.equal(prepared.status,'QA788_ADMITTED_AND_OWNER_DO_RESERVED');
committed={...b,updatedAt:clock};canonicalWrites++;
assert.equal((await c.finalize(b,prepared.receipt.operationId)).status,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
assert.equal((await c.armSettled(b,prepared.receipt.operationId)).status,'QA790_EXISTING_ALARM_READY');
clock+=1000;assert.equal((await c.alarm()).delivered,1);
assert.equal(marker.version,9);assert.equal(marker.followerCount,0);assert.equal(canonicalWrites,2);
assert.equal(relayCalls,3);assert.equal((await c.reserve(request(a),a)).status,'HOLD');
console.log('APP790_LOCAL_RS256_QA_AUTH_AND_EXISTING_APP539_HMAC_FOLLOW_UNFOLLOW=PASS');
console.log('APP790_PRECOMMIT_WAIT_ZERO_RELAY_ATTEMPTS_EXACT_SETTLEMENT_REARM_503_RECOVERY=PASS');
console.log('APP790_SYNTHETIC_D1_COMMIT_COUNT_2_RELAY_ADDITIONAL_CANONICAL_WRITES_0=PASS');
console.log('APP790_REAL_AUTH_RTD_B_DEPLOYABLE_ENTRY_GLOBAL_WRITERS=NOT_TESTED_HOLD');
