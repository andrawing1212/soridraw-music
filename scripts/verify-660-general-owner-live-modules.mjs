import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {patchExplore660,patchOwner660} from './lib/owner-follow-general660.mjs';
import {handleOwnerEpochBinding544} from '../cloudflare/explore-worker/runtime/owner-follow-enrollment-544.mjs';
const fixture=n=>readFileSync('scripts/fixtures/owner-follow660/'+n,'utf8');
const load=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const C='rcZ2GZrBndOZzT8C635eiNBjYIJ2',B='synthetic_owner_B';
const secret='x'.repeat(40),epoch='a'.repeat(32);
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:C,
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',
 SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:'1',
 SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:'1',SORIDRAW_OWNER_FOLLOW_HMAC_539:secret,
 SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:secret,SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:secret,
 SORIDRAW_OWNER_FOLLOW_BIND_544:'1',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542'};
const owner=await load(patchOwner660(fixture('worker.mjs')));
const states=new Map(),instances=new Map();let writes=0,deliveries=[];
function state(uid){
 if(!states.has(uid)){
  const data=new Map();let alarm=null;
  states.set(uid,{storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{writes++;data.set(k,structuredClone(v))},delete:async k=>data.delete(k),getAlarm:async()=>alarm,setAlarm:async t=>{alarm=t}}});
 }
 return states.get(uid);
}
const namespace={idFromName:uid=>uid,get(uid){
 if(!instances.has(uid))instances.set(uid,owner.createOwnerDoService600({state:state(uid),env,deliver:async({reservation})=>{deliveries.push(reservation.ownerUid);return {status:'delivered'}}}));
 return instances.get(uid);
}};
env.OWNER_FOLLOW_DO_600=namespace;
const ticket=uid=>({ownerUid:uid,actorUid:'synthetic_actor',operationId:'operation_123456789',cutoverToken:'cutover',authEpoch:epoch,desired:true,beforeFollowing:false,expectedRevision:1,priorR2Revision:1});
const req=(uid,changes={},key=secret)=>new Request('https://private/internal/owner-follow/reserve600',{method:'POST',headers:{'X-Soridraw-Owner-Bridge-600':key},body:JSON.stringify({...ticket(uid),...changes})});
for(const uid of [C,B]){
 assert.equal((await owner.default.fetch(req(uid),env)).status,200);
 const before=writes;
 assert.equal((await (await owner.default.fetch(req(uid),env)).json()).status,'already-reserved');
 assert.equal(writes,before,'duplicate reservations do not write');
}
assert.equal(states.size,2,'one namespace per owner');
const before=writes;
assert.equal((await owner.default.fetch(req(B,{},'wrong'),env)).status,403);
assert.equal((await (await owner.default.fetch(req(B,{desired:false}),env)).json()).status,'invalid-reservation');
for(const environment of ['test','production'])assert.equal((await owner.default.fetch(req(B),{...env,SORIDRAW_ENVIRONMENT:environment})).status,503);
for(const field of ['SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653'])assert.equal((await owner.default.fetch(req(B),{...env,[field]:''})).status,403);
assert.equal(writes,before,'rejected requests do not write');
// Reconstruct service over durable state to exercise alarm after restart.
for(const uid of [C,B]){
 const service=owner.createOwnerDoService600({state:state(uid),env,deliver:async({reservation})=>{deliveries.push(reservation.ownerUid);return {status:'delivered'}}});
 assert.equal((await service.alarm()).status,'delivered');
 assert.equal(await state(uid).storage.get('pending'),undefined);
}
assert.deepEqual(deliveries,[C,B]);
// Unsettled replay stays queued; existing canonical proof remains required.
await owner.default.fetch(req(B),env);
const pending=owner.createOwnerDoService600({state:state(B),env,deliver:async()=>({status:'not-settled'})});
assert.equal((await pending.alarm()).status,'retry-scheduled');
assert.equal((await state(B).storage.get('pending')).entries.length,1);
// Exercise the real wrapper with only transport/canonical dependencies stubbed.
let code=patchExplore660(fixture('owner-follow-entry-607.mjs'));
code=code.replace(/import[\s\S]*?from\s*['"][^'"]+['"];\n/g,'');
code=`const WorkerEntrypoint=class{};const ExploreLikeBatchScheduler103=class{};const validateExploreAuth307=()=>{};
const original={fetch:async()=>Response.json({path:'canonical'}),scheduled:()=>123};
const runOwnerFollowPrecommit557=async()=>Response.json({path:'precommit'});
const handleOwnerEpochBinding544=async()=>Response.json({path:'enroll'});
const verifyLiveOwnerEpoch547=()=>{};const reserveOwnerFollowViaService601=()=>{};
const handleOwnerFollowReplayService601=async({allowedCanaryUid})=>Response.json({allowedCanaryUid});\n`+code;
const wrapper=await load(code);env.OWNER_FOLLOW_RESERVATION_SERVICE_600={fetch:async()=>{}};
const follow=(uid,method='PUT',origin='https://preview.soridraw.com')=>new Request('https://preview/v1/profiles/'+uid+'/follow',{method,headers:{Origin:origin}});
assert.equal((await (await wrapper.default.fetch(follow(B),env,{})).json()).path,'precommit');
for(const method of ['PUT','DELETE'])assert.equal((await (await wrapper.default.fetch(follow(C,method),env,{})).json()).path,'precommit');
for(const environment of ['test','production'])assert.equal((await (await wrapper.default.fetch(follow(B),{...env,SORIDRAW_ENVIRONMENT:environment},{})).json()).path,'canonical');
assert.equal((await (await wrapper.default.fetch(follow(B,'PUT','https://soridraw.com'),env,{})).json()).path,'canonical');
assert.equal((await (await wrapper.default.fetch(follow(B,'GET'),env,{})).json()).path,'canonical');
assert.equal(wrapper.default.scheduled(),123);
const replay=new wrapper.OwnerFollowReplayEntrypoint607();replay.env=env;
assert.equal((await (await replay.fetch(new Request('https://private'))).json()).allowedCanaryUid,null);
// Enrollment can accept B's signed subject but still rejects stale live epoch before DB.
const at=1700000000000,body=JSON.stringify({uid:B,authEpoch:epoch,authCreatedAtMs:at-1000,action:'bind',at});
const signature=createHmac('sha256',secret).update(at+'.'+body).digest('hex');
const enrollReq=()=>new Request('https://private',{method:'POST',headers:{'X-Soridraw-Owner-Epoch-At':String(at),'X-Soridraw-Owner-Epoch-Signature':signature},body});
let verified=0;const verify=async()=>{verified++;return false};
let response=await handleOwnerEpochBinding544({request:enrollReq(),env,enabled:true,now:()=>at,verify});
assert.equal((await response.json()).code,'AUTH_GENERATION_NOT_CURRENT');assert.equal(verified,1);
response=await handleOwnerEpochBinding544({request:enrollReq(),env:{...env,SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:''},enabled:true,now:()=>at,verify});
assert.equal((await response.json()).code,'OWNER_CANARY_HOLD');assert.equal(verified,1);
console.log('APP660_A_B_OWNER_ISOLATION_RESTART_IDEMPOTENCY_AUTH_PREVIEW_BOUNDARY=PASS');
