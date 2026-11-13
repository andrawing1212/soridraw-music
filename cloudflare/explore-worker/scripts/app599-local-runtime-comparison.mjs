// APP599: compare two SAFE existing routes in a local Workers runtime only.
// All external HTTP disabled, all D1/R2/DO bindings locally simulated.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Miniflare,createFetchMock} from 'miniflare';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('APP599_HOLD_'+s);};
const need=(v,s)=>{if(!v)fail(s);};
const dir=join(process.env.RUNNER_TEMP||'/invalid-runner-temp','app598-owner-do-candidate');
const conf=JSON.parse(readFileSync(new URL('../canonical/wrangler.preview.jsonc',import.meta.url),'utf8'));
const evidence=JSON.parse(readFileSync(join(dir,'sanitized-evidence.json'),'utf8'));
const candidate=readFileSync(join(dir,'candidate-worker.mjs'));
need(evidence.originalBytes>5000,'MISSING_VERIFIED_ORIGINAL');
need(sha(candidate)===evidence.candidateSHA256,'CANDIDATE_BYTES_CHANGED');
const original=candidate.subarray(0,evidence.originalBytes);
need(sha(original)===evidence.originalModuleSHA256,'ORIGINAL_HASH_CHANGED');
need(candidate.subarray(0,evidence.originalBytes).equals(original),'PREFIX_NOT_PRESERVED');
const originalFile=join(dir,'active-worker-baseline.mjs');
writeFileSync(originalFile,original,{mode:0o600});
const live=evidence.sourceOnlyExistingBindingNamesAndTypes;
need(Array.isArray(live)&&live.length>10,'LIVE_BINDING_INVENTORY_MISSING');
const declared=new Set([
 ...Object.keys(conf.vars||{}),
 ...(conf.ratelimits||[]).map(x=>x.name),
 ...(conf.d1_databases||[]).map(x=>x.binding),
 ...(conf.r2_buckets||[]).map(x=>x.binding),
 ...(conf.durable_objects?.bindings||[]).map(x=>x.name),
]);
const missing=live.filter(x=>!declared.has(x.name)).map(x=>x.name).sort();
const expectedMissing=[
 'BOOTSTRAP_TOKEN','ENV_NAME','EXPLORE_MIRROR_TOKEN','PROD_BASE',
 'SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019','SORIDRAW_NOTIFICATION_RETENTION_013',
 'SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET','TARGET_BASE'
].sort();
assert.deepEqual(missing,expectedMissing);
need(conf.keep_vars===true,'KEEP_VARS_NOT_ENABLED');
need(conf.migrations?.length===2&&conf.migrations[1].tag==='v2'&&
 conf.migrations[1].new_sqlite_classes?.includes('OwnerFollowerRecovery557'),
 'OWNER_DO_MIGRATION_V2_MISSING');
need(evidence.oldMigrationVersion!=='v2','OWNER_DO_ALREADY_MIGRATED');
console.log('APP599_FULL_LIVE_BINDINGS='+live.length);
console.log('APP599_DASHBOARD_ONLY_BINDING_NAMES='+missing.length);
console.log('APP599_KEEP_VARS=true; EXPLICIT_PARITY=NOT_PROVEN');
console.log('APP599_DO_V2_ROLLBACK_ACROSS_LIFECYCLE=BLOCKED_BY_CLOUDFLARE_POLICY');
const fakeBindings={
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019:'1',
 ENV_NAME:'preview',BOOTSTRAP_TOKEN:'LOCAL_DUMMY_DO_NOT_REUSE',
};
const cases=[
 {name:'forbidden-origin-notification-get',method:'GET',path:'/v1/me/notifications/inbox',origin:'https://invalid.invalid'},
 {name:'forbidden-origin-notification-options',method:'OPTIONS',path:'/v1/me/notifications/inbox',origin:'https://invalid.invalid'},
];
const instances=[];
function start(path,isCandidate){
 const mock=createFetchMock();mock.disableNetConnect();
 const opts={
  modules:true,scriptPath:path,compatibilityDate:'2026-08-28',fetchMock:mock,
  bindings:fakeBindings,d1Databases:['DB','RATE_DB'],r2Buckets:['PROFILE_MEDIA','EXPLORE_CACHE'],
  durableObjects:{
   EXPLORE_LIKE_BATCH_SCHEDULER:'ExploreLikeBatchScheduler103',
   ...(isCandidate?{OWNER_FOLLOW_RECOVERY_557:'OwnerFollowerRecovery557'}:{}),
  },
 };
 const mf=new Miniflare(opts);instances.push(mf);return mf;
}
async function snapshot(mf,tc){
 const url='https://preview.soridraw.com'+tc.path;
 const res=await mf.dispatchFetch(url,{method:tc.method,headers:{Origin:tc.origin}});
 const body=await res.arrayBuffer();
 return {status:res.status,contentType:res.headers.get('content-type')||'',
  cacheControl:res.headers.get('cache-control')||'',bodySha256:sha(Buffer.from(body))};
}
try{
 const before=start(originalFile,false),after=start(join(dir,'candidate-worker.mjs'),true);
 for(const tc of cases){
  const a=await snapshot(before,tc),b=await snapshot(after,tc);
  assert.deepEqual(b,a,'APP599_RUNTIME_DIVERGENCE_'+tc.name);
  need(tc.method==='OPTIONS'?[204,403,404,405].includes(a.status):(a.status>=400&&a.status<500),
   'UNSAFE_OR_UNEXPECTED_RESPONSE_'+tc.name+'_'+a.status);
  console.log('APP599_SCOPED_ROUTE_PARITY='+tc.name+':PASS_STATUS_'+a.status);
 }
 const namespace=await after.getDurableObjectNamespace('OWNER_FOLLOW_RECOVERY_557');
 const stub=namespace.get(namespace.idFromName('local-app599-never-real-user'));
 const res=await stub.fetch('https://invalid.invalid/owner-follow/reserve557',{method:'POST',body:'{}'});
 need(res.status===503,'OWNER_DO_NOT_OFF_503');
 console.log('APP599_LOCAL_OWNER_DO_503=PASS');
 console.log('APP599_EXTERNAL_HTTP_DISABLED=PASS');
 console.log('APP599_LOCAL_D1_R2_ONLY=PASS');
 console.log('APP599_NO_LIVE_WORKER_DEPLOY=PASS');
 console.log('APP599_ROUTE_PARITY_SCOPE=ONLY_TWO_REJECT_PATHS_NOT_ALL_USER_FUNCTIONS');
}finally{
 await Promise.allSettled(instances.map(m=>m.dispose()));
}
