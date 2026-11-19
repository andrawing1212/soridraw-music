import assert from 'node:assert/strict';
import {createOwnerQa730Runtime} from '../cloudflare/explore-worker/experiments/owner-follow-qa730-bridge.mjs';
import newEntry,{OwnerFollowIsolated558} from '../cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs';
import oldEntry from '../cloudflare/explore-worker/experiments/owner-follow-isolated-558-entry.mjs';
import {readFileSync} from 'node:fs';

const cfg={
 projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'syntheticOwnerA',actorUid:'syntheticActorB',
 authEpoch:'c'.repeat(32),hmacSecret:'a'.repeat(64),probeToken:'b'.repeat(64),
};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
  OWNER583_QA_CONFIG:JSON.stringify(cfg)};
let t=1800000000000;
let sent=0,failOnce=true,seenVersions=[];
const send=async(url,request)=>{
 assert.equal(url,'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542');
 assert.equal(request.method,'POST');
 assert.match(request.headers['X-Soridraw-Follow-Relay529-Signature'],/^[0-9a-f]{64}$/);
 const body=JSON.parse(request.body);
 assert.equal(body.ownerUid,cfg.ownerUid);
 assert.equal(body.authEpoch,cfg.authEpoch);
 seenVersions.push(body.revision);
 sent++;
 if(failOnce){failOnce=false;return {ok:false,status:503,json:async()=>({ok:false})};}
 return {ok:true,status:200,json:async()=>({ok:true,applied:true})};
};
const data=new Map();
let alarmAt=null,setAlarms=0,puts=0;
const storage={
 async get(k){return data.get(k)},
 async put(k,v){puts++;data.set(k,structuredClone(v))},
 async setAlarm(v){setAlarms++;alarmAt=v},
 async getAlarm(){return alarmAt},
 async delete(k){data.delete(k)},
 async deleteAll(){data.clear()},
 async deleteAlarm(){alarmAt=null},
};
const qa=createOwnerQa730Runtime({storage,env,send,now:()=>t});
assert.equal(qa.enabled(),true);
const url='https://qa.invalid/qa730/';
const request=(method,path,body=null,token=cfg.probeToken)=>new Request(url+path,{
 method,headers:{'X-Owner583-Token':token,'Content-Type':'application/json'},
 ...(body?{body:JSON.stringify(body)}:{})
});
const get=async(method,path,body=null,token=cfg.probeToken)=>
 qa.fetch(request(method,path,body,token));
assert.equal((await get('GET','status',null,'wrong')).status,403);
assert.equal((await get('PUT','follow')).status,409);
assert.equal((await get('POST','bootstrap',{version:6,followerCount:0,authEpoch:cfg.authEpoch})).status,409);
const init=await get('POST','bootstrap',{
 version:6,followerCount:0,authEpoch:cfg.authEpoch,qaRtdbBaselineVerified:true,
});
assert.equal(init.status,200);
assert.equal((await init.json()).version,6);
assert.equal((await get('POST','bootstrap',{
 version:6,followerCount:0,authEpoch:cfg.authEpoch,qaRtdbBaselineVerified:true,
})).status,409);
assert.equal((await get('DELETE','follow')).status,200); // no-op before any reservation
assert.equal((await get('PUT','follow', {followOperationId:'forged'})).status,503);
let status=await (await get('GET','status')).json();
assert.equal(status.version,6);
assert.equal(status.pending,false);
assert.equal(sent,0);
const follows=await get('PUT','follow');
assert.equal(follows.status,200);
assert.deepEqual(await follows.json(),{
 ok:true,syntheticOnly:true,changed:true,version:7,queuedByDurableAlarm:true,
});
status=await (await get('GET','status')).json();
assert.equal(status.pending,true);
assert.equal(status.followerCount,1);
assert.equal(status.version,7);
assert.equal(sent,0,'response handler must NEVER directly call RTDB');
assert.equal((await get('DELETE','follow')).status,409,'pending must be replayed first');
assert.equal(await qa.alarm(),true);
status=await (await get('GET','status')).json();
assert.equal(status.pending,true);
assert.equal(status.attempts,1);
assert.equal(status.lastStatus,'retry-scheduled');
assert.equal(await qa.alarm(),true);
status=await (await get('GET','status')).json();
assert.equal(status.pending,false);
assert.equal(status.lastStatus,'applied');
assert.deepEqual(seenVersions,[7,7], 'retry uses exact durable receipt revision');
const unfollows=await get('DELETE','follow');
assert.equal(unfollows.status,200);
assert.equal((await unfollows.json()).version,8);
assert.equal(sent,2);
assert.equal(await qa.alarm(),true);
status=await (await get('GET','status')).json();
assert.equal(status.version,8);
assert.equal(status.pending,false);
assert.equal(status.followerCount,0);
assert.deepEqual(seenVersions,[7,7,8]);
assert(setAlarms>=3);
assert(puts>0);
assert.equal((await get('PUT','follow', {followExpectedRevision:123})).status,503);
const blocked=createOwnerQa730Runtime({storage,env:{...env,DB:{danger:'shared'}},send,now:()=>t});
assert.equal(blocked.enabled(),false);
assert.equal((await blocked.fetch(request('GET','status'))).status,403);

// QA entry delegates all original /qa583 URLs unchanged and uses a DIFFERENT
// DO ID for new /qa730 routes with the same existing namespace/class.
const source=new URL('../cloudflare/explore-worker/experiments/owner-follow-qa730-entry.mjs',import.meta.url);
const s=readFileSync(source,'utf8');
assert(s.includes("idFromName('qa730-isolated-owner-only')"));
assert(!s.includes('wrangler deploy'));
assert(!s.includes('new_sqlite_classes'));
assert.strictEqual(typeof OwnerFollowIsolated558,'function');
const ids=[];
const entryEnv={...env,OWNER558_DO:{
 idFromName(x){ids.push(x);return x},
 get(id){return {fetch:async()=>Response.json({ok:true,syntheticOnly:true,id})}},
}};
const ok=await newEntry.fetch(request('GET','status'),entryEnv,{});
assert.equal(ok.status,200);
assert.deepEqual(ids,['qa730-isolated-owner-only']);
assert.equal((await newEntry.fetch(request('GET','status',null,'bad'),entryEnv,{})).status,403);
assert.equal((await newEntry.fetch(request('GET','status'),{...entryEnv,PROFILE_MEDIA:{}},{})).status,403);
const legacy=await newEntry.fetch(new Request('https://qa.invalid/qa583/status',{
 headers:{'X-Owner583-Token':cfg.probeToken},
}),entryEnv,{});
assert.equal(legacy.status,200,'existing APP583 route preserved');
assert.deepEqual(ids,['qa730-isolated-owner-only','synthetic-owner-only']);
assert.equal(typeof oldEntry.fetch,'function');

const qaWrangler=JSON.parse(readFileSync('cloudflare/explore-worker/wrangler.owner-qa-583.json','utf8'));
assert.equal(qaWrangler.account_id,'b60fcd62c679c64db19f0b0e0c2f3429');
assert.deepEqual(qaWrangler.durable_objects.bindings,[{
 name:'OWNER558_DO',class_name:'OwnerFollowIsolated558',
}]);
assert.deepEqual(qaWrangler.migrations,[{tag:'v1',new_sqlite_classes:['OwnerFollowIsolated558']}]);
console.log('APP732_QA730_REAL_CODE_LOCAL_ISOLATED_CONTRACT=PASS');
console.log('APP732_QA730_RELAY_RECOVERY_RTD B=SIMULATED_ONLY'.replace('RTD B','RTDB'));
console.log('APP732_CLOUDFLARE_QA_DEPLOY=NOT_RUN; FIREBASE_QA_REAL_RECEIVER=NOT_RUN');
