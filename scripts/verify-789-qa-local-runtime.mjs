// APP789: run the exact frozen-source bundle on LOCAL workerd only.
// No Cloudflare credentials, production bindings, or network requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {continueQa789Settlement} from './app789-qa-settlement-recovery.mjs';
import {webcrypto} from 'node:crypto';
const [bundle,installDir]=process.argv.slice(2);
assert(bundle&&installDir);
const require=createRequire(resolve(installDir,'package.json'));
const {Miniflare}=require('miniflare');
const ids=['qa789_operation_follow_0000000000001','qa789_operation_follow_0000000000002'];
async function scenario(waitMs,simulateReset=false){
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
  const expectedReceiptId=winners[0].v.value.receipt.operationId;
  const body={canonicalOperationId:winner,expectedReceiptId};
  if(waitMs)await new Promise(done=>setTimeout(done,waitMs));
  const commit=await call('POST','/qa789/commit',body);
  const d1=await db.prepare('SELECT following FROM app768_qa_synthetic_follow WHERE k=?').bind(bindings.QA789_ROW).first();
  console.log('APP789_LOCAL_COMMIT_RESULT',JSON.stringify({waitMs,http:commit.code,status:commit.value?.status,reason:commit.value?.reason,following:d1?.following}));
  check(commit,200,'QA789_CANONICAL_WRITTEN_PENDING_SETTLEMENT');
  assert.equal(commit.value.d1RowsWritten,1);
  assert.equal(commit.value.r2ProjectionSettled,true);
  assert.equal(commit.value.stage,'CANONICAL_WRITTEN');
  assert.equal(commit.value.canonicalRetryAuthorized,false);
  assert.equal(d1.following,1);
  const r2=await mf.getR2Bucket('QA789_R2');
  const digest=async values=>Buffer.from(await webcrypto.subtle.digest('SHA-256',
   new TextEncoder().encode(JSON.stringify(values)))).toString('hex');
  const fields=[bindings.QA789_CUTOVER,'qa789OwnerSynthetic','qa789ActorSynthetic',bindings.QA789_EPOCH,winner];
  const hash=await digest(fields);
  const projection='internal/qa789/projection/'+hash;
  const settled='internal/qa783/owner-follow-settled/'+hash;
  const floor='internal/qa788/owner-floor/'+await digest([
   bindings.QA789_CUTOVER,'qa789OwnerSynthetic',bindings.QA789_EPOCH]);
  const beforeProjection=await r2.head(projection);
  const beforeFloor=await r2.head(floor);
  assert(beforeProjection&&beforeFloor);assert.equal(await r2.head(settled),null);
  check(await call('POST','/qa789/do/finalize',{canonicalOperationId:winner}),409,'HOLD');
  const wrong=await call('POST','/qa789/do/finalize',{...body,expectedReceiptId:'qa789_do_receipt_'+'0'.repeat(32)});
  check(wrong,409,'HOLD');assert.equal(wrong.value.reason,'DO_RECEIPT_IDENTITY_MISMATCH');
  assert.equal(await r2.head(settled),null);
  check(await call('POST','/qa789/commit',body),409,'HOLD');
  const resetResult={code:409,value:{status:'HOLD',reason:'DO_RECEIPT_LOOKUP_UNCERTAIN',
   stage:'POSTCOMMIT_RECEIPT',diagnostic:'STATE_READ__OBJECT_RESET',d1RowsWritten:0,
   canonicalRetryAuthorized:false}};
  let sent=0;
  const get=async(method,path,payload)=>{
   assert.equal(method,'POST');assert.equal(path,'/qa789/do/finalize');assert.deepEqual(payload,body);
   sent++;
   if(simulateReset&&sent===1)return resetResult; // emulate actual reset response before settlement
   return call(method,path,payload);
  };
  const finalized=await continueQa789Settlement({get,commit,...body});
  assert.equal(finalized.attempts,simulateReset?2:1);
  assert.equal(sent,finalized.attempts);
  check(finalized.result,200,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
  assert.equal(finalized.result.value.d1RowsWritten,0);
  assert.equal(finalized.result.value.canonicalRetryAuthorized,false);
  assert.equal(finalized.result.value.diagnostic,null);
  const afterSettled=await r2.head(settled),afterFloor=await r2.head(floor);
  assert(afterSettled&&afterFloor);
  assert.notEqual(afterFloor.etag,beforeFloor.etag);
  assert.equal((await r2.head(projection)).etag,beforeProjection.etag);
  const replay=await call('POST','/qa789/do/finalize',body);
  check(replay,200,'QA788_FLOOR_ALREADY_SETTLED_NO_WRITE');
  assert.equal(replay.value.d1RowsWritten,0);
  assert.equal((await r2.head(settled)).etag,afterSettled.etag);
  assert.equal((await r2.head(floor)).etag,afterFloor.etag);
  assert.equal((await r2.head(projection)).etag,beforeProjection.etag);
  let persistent=0;
  const exhausted=await continueQa789Settlement({commit,...body,get:async()=>{persistent++;return resetResult}});
  assert.equal(exhausted.attempts,2);assert.equal(persistent,2);assert.equal(exhausted.result.code,409);
  let blocked=0;
  const absent=await continueQa789Settlement({commit,...body,get:async()=>{blocked++;return wrong}});
  assert.equal(absent.attempts,1);assert.equal(blocked,1);
  const unconfirmed=await continueQa789Settlement({commit:{code:409},...body,get:async()=>{throw Error('must not call')}});
  assert.equal(unconfirmed.attempts,0);
  await assert.rejects(continueQa789Settlement({commit,...body,get:async()=>{throw Error('unknown ACK')}}),/unknown ACK/);
  console.log('APP789_LOCAL_RECOVERY '+JSON.stringify({simulateReset,attempts:finalized.attempts,
   canonicalD1W1:true,recoveryD1W0:true,projectionUnchanged:true,settledReplayUnchanged:true}));
  const history=await call('GET','/qa789/do/history');
  check(history,200,'QA788_READ_ONLY_HISTORY');assert.equal(history.value.floorD1Revision,8);assert.equal(history.value.pending,false);
  check(await call('POST','/qa789/do/reserve',{canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,desired:true}),409,'HOLD');
  check(await call('POST','/qa789/do/wipe'),200,'QA789_EXACT_SYNTHETIC_DO_WIPED');
  const missing=await call('POST','/qa789/do/finalize',body);
  check(missing,409,'HOLD');assert.equal(missing.value.reason,'DO_RECEIPT_AUTHORITATIVELY_ABSENT');
  check(await call('POST','/qa789/do/reserve',{canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,desired:true}),409,'HOLD');
  assert.equal((await r2.head(settled)).etag,afterSettled.etag);
  assert.equal((await r2.head(floor)).etag,afterFloor.etag);
 }finally{await mf.dispose()}
}
await scenario(0);
await scenario(1500,true);
console.log('APP789_LOCAL_WORKERD_SQLITE_D1_R2_IMMEDIATE_AND_ALARM_WINDOW=PASS');
