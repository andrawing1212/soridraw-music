// APP605: compare original deployed bytes versus OFF-sidecar candidate
// in local workerd. External network disabled. Only two forbidden-origin
// routes are checked; this does not prove all user flows or full rollback.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Miniflare,createFetchMock} from 'miniflare';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=why=>{throw Error('APP605_RUNTIME_HOLD_'+why)};
const root=join(process.env.RUNNER_TEMP||'/missing-app605','app605');
const baseline=join(root,'baseline','preview-entry.js');
const candidate=join(root,'candidate','preview-entry.js');
const proof=JSON.parse(readFileSync(join(root,'candidate-proof.json'),'utf8'));
const before=readFileSync(baseline),after=readFileSync(candidate);
if(proof.prefixBytes!==before.length||!after.subarray(0,before.length).equals(before))
 fail('ACTIVE_CODE_BYTES_NOT_PRESERVED');
if(sha(before)!==proof.sourceSha||sha(after)!==proof.candidateSha)
 fail('SOURCE_HASH_DRIFT');
if(proof.compatibilityDate!=='2026-08-28'||!proof.compiledOff)
 fail('COMPAT_OR_OFF_DRIFT');
const cases=[
 {method:'GET',path:'/v1/me/notifications/inbox',origin:'https://invalid.invalid'},
 {method:'OPTIONS',path:'/v1/me/notifications/inbox',origin:'https://invalid.invalid'},
];
const started=[];
async function launch(script){
 const mock=createFetchMock();
 mock.disableNetConnect();
 const m=new Miniflare({
  // Pin both paths inside the same temporary worker root. Without this,
  // Miniflare may generate illegal ../ module specifiers for scripts under RUNNER_TEMP.
  rootPath:dirname(script),modulesRoot:dirname(script),
  modules:true,scriptPath:'preview-entry.js',
  compatibilityDate:'2026-08-28',
  bindings:{
   SORIDRAW_ENVIRONMENT:'preview',ENV_NAME:'preview',
   BOOTSTRAP_TOKEN:'APP605_LOCAL_DUMMY_NOT_REAL',
   SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019:'1',
  },
  fetchMock:mock,d1Databases:['DB','RATE_DB'],
  r2Buckets:['PROFILE_MEDIA','EXPLORE_CACHE'],
  durableObjects:{
   EXPLORE_LIKE_BATCH_SCHEDULER:'ExploreLikeBatchScheduler103',
  },
 });
 started.push(m);return m;
}
async function response(m,test){
 const res=await m.dispatchFetch('https://preview.soridraw.com'+test.path,{
  method:test.method,headers:{Origin:test.origin},
 });
 const b=Buffer.from(await res.arrayBuffer());
 return {status:res.status,contentType:res.headers.get('content-type')||'',
  cache:res.headers.get('cache-control')||'',bodySha:sha(b)};
}
async function probeLikeDo(m){
 // Use one local-only object name, and an invalid GET path that is not a
 // mutation command. This proves the exported Like DO class is resolvable.
 const namespace=await m.getDurableObjectNamespace('EXPLORE_LIKE_BATCH_SCHEDULER');
 assert.ok(namespace,'APP606_LIKE_DO_NAMESPACE_UNAVAILABLE');
 const id=namespace.idFromName('APP606_SYNTHETIC_READ_ONLY_NOT_A_REAL_USER');
 const stub=namespace.get(id);
 const res=await stub.fetch(new Request(
  'https://local.invalid/__app606_read_only_unrecognized_probe__',{method:'GET'}));
 const bytes=Buffer.from(await res.arrayBuffer());
 if(res.status<400||res.status>=500)
  fail('LIKE_DO_READ_ONLY_PROBE_UNEXPECTED_STATUS_'+res.status);
 return {status:res.status,bodySha:sha(bytes),
  contentType:res.headers.get('content-type')||''};
}
try{
 const a=await launch(baseline),b=await launch(candidate);
 for(const t of cases){
  const x=await response(a,t),y=await response(b,t);
  assert.deepEqual(x,y,'APP605_EXISTING_PATH_RESPONSE_DIVERGED');
  if(!(x.status>=400&&x.status<500)&&x.status!==204)
   fail('UNSAFE_ROUTE_STATUS_'+x.status);
  console.log('APP605_LOCAL_WORKER_RUNTIME_PARITY_'+t.method+'_REJECT=PASS');
 }
 const likeBaseline=await probeLikeDo(a);
 const likeCandidate=await probeLikeDo(b);
 assert.deepEqual(likeBaseline,likeCandidate,
  'APP606_LIKE_DO_BASELINE_VS_CANDIDATE_RESPONSE_DIVERGED');
 console.log('APP606_LIKE_DO_CLASS_EXPORTED_AND_READONLY_PATH_PARITY=PASS');
 console.log('APP605_WORKER_COMPAT_DATE_2026_08_28=PASS');
 console.log('APP605_ACTIVE_PREFIX_BYTES_AND_DO_V1_UNCHANGED=PASS');
 console.log('APP605_NETWORK_DISABLED_AND_NO_REMOTE_MUTATION=PASS');
}finally{
 await Promise.allSettled(started.map(x=>x.dispose()));
}
