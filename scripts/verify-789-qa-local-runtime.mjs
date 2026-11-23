// APP789: run the exact frozen-source bundle on LOCAL workerd only.
// No Cloudflare credentials, production bindings, or network requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const [bundle,installDir]=process.argv.slice(2);
assert(bundle&&installDir);
const require=createRequire(resolve(installDir,'package.json'));
const {Miniflare}=require('miniflare');
const ids=['qa789_operation_follow_0000000000001','qa789_operation_follow_0000000000002'];
async function scenario(waitMs){
 const bindings={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
  QA789_ISOLATED:'1',QA789_ROW:'qa789_'+'a'.repeat(16),
  QA789_CUTOVER:'qa789_cutover_'+'b'.repeat(32),QA789_EPOCH:'c'.repeat(32),
  QA789_ACCESS:'d'.repeat(64),QA789_DO_NAME:'qa789_123456789'};
 const mf=new Miniflare({
  modules:true,script:readFileSync(resolve(bundle),'utf8'),compatibilityDate:'2026-06-17',
  cf:false,bindings,
  durableObjects:{OWNER558_DO:{className:'OwnerFollowIsolated558',useSQLite:true}},
  d1Databases:{QA789_D1:'00000000-0000-4000-8000-000000000789'},
  r2Buckets:['QA789_R2'],outboundService:()=>new Response('LOCAL_NETWORK_BLOCKED',{status:503}),
 });
 try{
  const db=await mf.getD1Database('QA789_D1');
  await db.prepare('CREATE TABLE app768_qa_synthetic_follow (k TEXT PRIMARY KEY, following INTEGER NOT NULL)').run();
  await db.prepare('INSERT INTO app768_qa_synthetic_follow(k,following) VALUES(?,0)').bind(bindings.QA789_ROW).run();
  async function call(method,path,body,authorized=true){
   const response=await mf.dispatchFetch('http://localhost'+path,{method,
    headers:{...(authorized?{'X-QA789-Access':bindings.QA789_ACCESS}:{}),
     ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
   const value=await response.json().catch(()=>null);
   return {code:response.status,value};
  }
  const check=(v,code,status)=>{assert.equal(v.code,code,JSON.stringify(v));assert.equal(v.value?.status,status,JSON.stringify(v));};
  check(await call('GET','/qa789/health',undefined,false),403,'DENIED');
  check(await call('GET','/qa789/health'),200,'QA789_REAL_R2_D1_READY');
  check(await call('POST','/qa789/do/bootstrap'),200,'QA788_SYNTHETIC_GENESIS_FLOOR_CREATED');
  const race=await Promise.all(ids.map(canonicalOperationId=>call('POST','/qa789/do/reserve',{
   canonicalOperationId,expectedRevision:7,priorR2Revision:13,desired:true})));
  const winners=race.map((v,i)=>({v,id:ids[i]})).filter(x=>x.v.code===200&&x.v.value?.status==='QA788_ADMITTED_AND_OWNER_DO_RESERVED');
  assert.equal(winners.length,1,JSON.stringify(race));
  assert.equal(race.filter(v=>v.code===409).length,1,JSON.stringify(race));
  const winner=winners[0].id;
  if(waitMs)await new Promise(done=>setTimeout(done,waitMs));
  const commit=await call('POST','/qa789/commit',{canonicalOperationId:winner});
  const d1=await db.prepare('SELECT following FROM app768_qa_synthetic_follow WHERE k=?').bind(bindings.QA789_ROW).first();
  console.log('APP789_LOCAL_COMMIT_RESULT',JSON.stringify({waitMs,http:commit.code,status:commit.value?.status,reason:commit.value?.reason,following:d1?.following}));
  check(commit,200,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
  assert.equal(commit.value.d1RowsWritten,1);
  assert.equal(commit.value.r2ProjectionSettled,true);
  assert.equal(commit.value.stage,'POSTCOMMIT_RECEIPT');
  assert.equal(commit.value.diagnostic,null);
  assert.equal(d1.following,1);
  const history=await call('GET','/qa789/do/history');
  check(history,200,'QA788_READ_ONLY_HISTORY');assert.equal(history.value.floorD1Revision,8);assert.equal(history.value.pending,false);
  check(await call('POST','/qa789/do/reserve',{canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,desired:true}),409,'HOLD');
  check(await call('POST','/qa789/do/wipe'),200,'QA789_EXACT_SYNTHETIC_DO_WIPED');
  check(await call('POST','/qa789/do/reserve',{canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,desired:true}),409,'HOLD');
 }finally{await mf.dispose()}
}
await scenario(0);
await scenario(1500);
console.log('APP789_LOCAL_WORKERD_SQLITE_D1_R2_IMMEDIATE_AND_ALARM_WINDOW=PASS');
