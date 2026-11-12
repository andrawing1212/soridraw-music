// APP583: QA-only signed DO relay. No live infrastructure accessed.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createQaOwnerRelay583,parseOwnerQaConfig583}
 from '../cloudflare/explore-worker/experiments/owner-follow-qa-live-583.mjs';
const cfg={actorUid:'B',authEpoch:'a'.repeat(32),hmacSecret:'b'.repeat(64),
 ownerUid:'A',probeToken:'c'.repeat(64),projectId:'soridraw-app',
 projectNumber:'1083981050742'};
assert.equal(parseOwnerQaConfig583(JSON.stringify({...cfg,projectId:'soridraw-app-866a5'})),null);
assert.equal(parseOwnerQaConfig583(JSON.stringify({...cfg,probeToken:cfg.hmacSecret})),null);
let at=1800000000000,alarmAt=null,sends=0;
const map=new Map();const meter={get:0,put:0,setAlarm:0};
const storage={
 async get(k){meter.get++;return structuredClone(map.get(k))},
 async put(k,v){meter.put++;map.set(k,structuredClone(v))},
 async getAlarm(){return alarmAt},
 async setAlarm(t){meter.setAlarm++;alarmAt=t},
};
const sent=[];
const send=async(url,opts)=>{
 sends++;sent.push(JSON.parse(opts.body));
 assert.equal(url,'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542');
 const signature=createHmac('sha256',cfg.hmacSecret)
  .update(opts.headers['X-Soridraw-Follow-Relay529-At']+'.'+opts.body).digest('hex');
 assert.equal(signature,opts.headers['X-Soridraw-Follow-Relay529-Signature']);
 return {ok:true,status:200,json:async()=>({ok:true,applied:true})};
};
const env={OWNER583_QA_CONFIG:JSON.stringify(cfg),
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1'};
const qa=createQaOwnerRelay583({storage,env,now:()=>at,send});
const req=(method,path,token=cfg.probeToken)=>new Request('https://qa.invalid'+path,{
 method,headers:{'X-Owner583-Token':token}});
assert.equal((await qa.fetch(req('PUT','/qa583/follow','bad'))).status,403);
assert.equal(meter.put,0);
assert.equal((await qa.fetch(req('PUT','/qa583/follow'))).status,200);
assert.equal(meter.put,1);
assert.equal(alarmAt,at+1000);
assert.equal((await qa.fetch(req('PUT','/qa583/follow'))).status,200);
assert.equal(meter.put,1,'duplicate follow cannot write');
await qa.alarm();
assert.equal(sends,1);assert.equal(sent[0].followerCount,1);
let status=await (await qa.fetch(req('GET','/qa583/status'))).json();
assert.equal(status.version,1);assert.equal(status.pending,false);
assert.equal((await qa.fetch(req('DELETE','/qa583/follow'))).status,200);
await qa.alarm();
assert.equal(sends,2);assert.equal(sent[1].followerCount,0);
assert.deepEqual(sent.map(x=>x.revision),[1,2]);
status=await (await qa.fetch(req('GET','/qa583/status'))).json();
assert.equal(status.version,2);assert.equal(status.pending,false);
const hold=createQaOwnerRelay583({storage,env:{...env,DB:{}},now:()=>at,send});
assert.equal((await hold.fetch(req('PUT','/qa583/follow'))).status,403);
const offline=createQaOwnerRelay583({storage,env,now:()=>at,
 send:async()=>({ok:false,status:503,json:async()=>({ok:false})})});
await offline.fetch(req('PUT','/qa583/follow'));
await offline.alarm();await offline.alarm();await offline.alarm();
status=await (await offline.fetch(req('GET','/qa583/status'))).json();
assert.equal(status.hold,true);assert.equal(status.attempts,3);
assert.equal(sends,2,'offline must not call original mock transport');
console.log('APP583_QA_ONE_PAIR_FOLLOW_UNFOLLOW_SIGNED_FUNCTION_RELAY=PASS');
console.log('APP583_QA_NO_D1_R2_AND_RETRY_HOLD=PASS');
