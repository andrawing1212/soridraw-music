import assert from 'node:assert/strict';
import {createOwnerQa730Runtime}
 from '../cloudflare/explore-worker/experiments/owner-follow-qa730-bridge.mjs';
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'qaSyntheticA',actorUid:'qaSyntheticB',authEpoch:'b'.repeat(32),
 probeToken:'c'.repeat(64),hmacSecret:'b'.repeat(64)};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_QA747_INJECT503:'1',OWNER583_QA_CONFIG:JSON.stringify(cfg)};
const values=new Map();let sendCalls=0,alarms=0,puts=0,deletes=0;
const storage={
 async get(k){return values.get(k)},
 async put(k,v){puts++;values.set(k,structuredClone(v))},
 async setAlarm(){alarms++},
 async delete(k){deletes++;values.delete(k)},
};
const send=async(url,opts)=>{sendCalls++;
 assert.equal(url,'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542');
 assert.equal(opts.method,'POST');
 return {ok:true,status:200,json:async()=>({ok:true,applied:true})};
};
const instance=createOwnerQa730Runtime({storage,env,now:()=>1800000000000,send});
const request=(method,path,data,token=cfg.probeToken)=>new Request(
 'https://qa.example/qa730/'+path,{
  method,headers:{'X-Owner583-Token':token,'Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{})});
const query=async(method,path,data,token)=>instance.fetch(request(method,path,data,token));
assert.equal((await query('POST','arm-503-747',null,'bad')).status,403);
assert.equal((await query('POST','arm-503-747')).status,409);
assert.equal((await query('POST','bootstrap',{
 version:8,followerCount:0,authEpoch:cfg.authEpoch,
 qaRtdbBaselineVerified:true})).status,200);
const beforeFaultPut=puts;
const armed=await query('POST','arm-503-747');
assert.equal(armed.status,200);
assert.deepEqual(await armed.json(),{ok:true,syntheticOnly:true,
 fault:'sender-503-once',expectedVersion:9});
assert.equal(puts,beforeFaultPut+1);
assert.equal((await query('POST','arm-503-747')).status,409);
const started=await query('PUT','follow');
assert.equal(started.status,200);
assert.equal((await started.json()).version,9);
assert.equal(sendCalls,0);
const alarmsBefore=alarms;
assert.equal(await instance.alarm(),true);
const delayed=await (await query('GET','status')).json();
assert.equal(delayed.pending,true);
assert.equal(delayed.attempts,1);
assert.equal(delayed.lastStatus,'retry-scheduled');
assert.equal(delayed.injected503Version,9);
assert.equal(delayed.recovered503Version,null);
assert.equal(sendCalls,0,'injected 503 cannot call Functions or claim ACK');
assert(alarms>alarmsBefore);
assert.equal(await instance.alarm(),true);
const settled=await (await query('GET','status')).json();
assert.equal(settled.version,9);
assert.equal(settled.pending,false);
assert.equal(settled.lastStatus,'applied');
assert.equal(settled.injected503Version,9);
assert.equal(settled.recovered503Version,9);
assert.equal(settled.recoveryAttemptCount,1);
assert.equal(sendCalls,1,'same revision attempts exactly one real relay after fault');
assert.equal(deletes,1,'one-time fault cleared after ACK');
assert.equal((await query('DELETE','follow')).status,200);
assert.equal(await instance.alarm(),true);
assert.equal(sendCalls,2,'next revision unaffected by fault injection');
const restored=createOwnerQa730Runtime({storage,env:{
 ...env,SORIDRAW_QA747_INJECT503:'0'},now:()=>1800000000000,send});
assert.equal((await restored.fetch(request('POST','arm-503-747'))).status,403);
console.log('APP747_QA_OUTBOUND_SENDER_503_ONCE_RETRY_OFFLINE=PASS');
console.log('APP747_QA_FIREBASE_FUNCTIONS_REAL_503_AND_RTD B=NOT_RUN'.replace('RTD B','RTDB'));
