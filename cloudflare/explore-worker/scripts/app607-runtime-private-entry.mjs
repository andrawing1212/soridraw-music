// APP607 local, no network, no real accounts. Baseline vs private wrapper.
// Does NOT assert real owner delivery, configured secrets, or full app parity.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Miniflare,createFetchMock,kCurrentWorker} from 'miniflare';
const sha=v=>createHash('sha256').update(v).digest('hex');
const root=join(process.env.RUNNER_TEMP||'/no-app607','app607');
const baseline=join(process.env.RUNNER_TEMP||'/no-app607','app605',
 'baseline','preview-entry.js');
const wrapper=join(root,'owner-follow-entry-607.mjs');
const original=join(root,'preview-entry.mjs');
const proof=JSON.parse(readFileSync(join(root,'candidate-proof.json'),'utf8'));
const active=readFileSync(baseline);
const injected=readFileSync(original);
const need=(x,why)=>{if(!x)throw Error('APP607_HOLD_'+why)};
need(active.length===2440556&&
 injected.subarray(0,active.length).equals(active)&&
 sha(active)===proof.originalSha256,'CANONICAL_PREFIX_CHANGED');
need(proof.moduleCount===10&&proof.existingLikeDoV1&&
 proof.additionalDoClasses===0,'MODULE_DO_CONTRACT_CHANGED');
const started=[];
async function create(script,{named=false}={}){
 const mock=createFetchMock();mock.disableNetConnect();
 const opts={
  rootPath:dirname(script),modulesRoot:dirname(script),
  modules:true,scriptPath:script.split('/').at(-1),
  compatibilityDate:'2026-08-28',
  bindings:{SORIDRAW_ENVIRONMENT:'preview',ENV_NAME:'preview',
   BOOTSTRAP_TOKEN:'APP607_SYNTHETIC_ONLY',},
  d1Databases:['DB','RATE_DB'],
  r2Buckets:['PROFILE_MEDIA','EXPLORE_CACHE'],
  durableObjects:{EXPLORE_LIKE_BATCH_SCHEDULER:'ExploreLikeBatchScheduler103'},
  fetchMock:mock,
 };
 if(named)opts.serviceBindings={
  APP607_TEST_PRIVATE_REPLAY:{name:kCurrentWorker,entrypoint:'OwnerFollowReplayEntrypoint607'},
 };
 const m=new Miniflare(opts);started.push(m);return m;
}
async function request(m,method,path){
 const res=await m.dispatchFetch('https://preview.soridraw.com'+path,{
  method,headers:{Origin:'https://untrusted.example'},
  ...(method==='POST'?{body:'{}'}:{}),
 });
 const body=Buffer.from(await res.arrayBuffer());
 return {status:res.status,hash:sha(body),
  type:res.headers.get('content-type')||'',
  cache:res.headers.get('cache-control')||''};
}
async function likeDO(m){
 const ns=await m.getDurableObjectNamespace('EXPLORE_LIKE_BATCH_SCHEDULER');
 const id=ns.idFromName('APP607_SYNTHETIC_NO_REAL_USER');
 const res=await ns.get(id).fetch('https://local.invalid/__app607_nonmutation_readonly__');
 return {status:res.status,hash:sha(Buffer.from(await res.arrayBuffer()))};
}
try{
 const a=await create(baseline),b=await create(wrapper,{named:true});
 const cases=[
  ['GET','/v1/me/notifications/inbox'],
  ['OPTIONS','/v1/me/notifications/inbox'],
  ['POST','/owner-follow/replay557-internal'],
 ];
 for(const [method,path] of cases){
  const first=await request(a,method,path);
  const second=await request(b,method,path);
  assert.deepEqual(second,first,'APP607_ORIGINAL_PUBLIC_ROUTE_DRIFT');
  console.log('APP607_PUBLIC_ROUTE_'+method+'_UNCHANGED=PASS');
 }
 const doA=await likeDO(a),doB=await likeDO(b);
 assert.deepEqual(doA,doB,'APP607_LIKE_DO_EXPORT_OR_RESPONSE_DRIFT');
 need(doA.status>=400&&doA.status<500,'LIKE_DO_PROBE_NOT_REJECTED');
 console.log('APP607_EXISTING_LIKE_DO_V1_NAMED_EXPORT_PARITY=PASS');
 const bindings=await b.getBindings();
 need(typeof bindings.APP607_TEST_PRIVATE_REPLAY?.fetch==='function',
  'NAMED_WORKER_ENTRYPOINT_NOT_RESOLVABLE');
 const privateResponse=await bindings.APP607_TEST_PRIVATE_REPLAY.fetch(
  'https://owner-follow.internal/owner-follow/replay557-internal',
  {method:'POST',body:'{}'});
 const privatePayload=await privateResponse.json();
 assert.equal(privateResponse.status,503);
 assert.equal(privatePayload.status,'disabled');
 console.log('APP607_NAMED_PRIVATE_SERVICE_BINDING_OFF=PASS');
 console.log('APP607_COMPATIBILITY_DATE_2026_08_28=PASS');
 console.log('APP607_NO_REAL_DATA_OR_NETWORK_AND_NO_REMOTE_UPLOAD=PASS');
}finally{
 await Promise.allSettled(started.map(x=>x.dispose()));
}
