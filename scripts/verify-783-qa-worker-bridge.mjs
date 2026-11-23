// APP783 isolated QA Worker wiring. In-memory fake bindings; no external calls.
import assert from 'node:assert/strict';
import worker from './app776-qa-integration-worker.mjs';
const access='b'.repeat(64),row='qa776_'+'c'.repeat(16);
let following=0,updates=0;
const objects=new Map();
const d1={prepare(sql){
 assert(sql.includes('app768_qa_synthetic_follow'));
 return {bind(...args){
  assert(args.includes(row));
  return {
   async first(){return {following}},
   async run(){
    if(!sql.startsWith('UPDATE'))throw Error('TEST_SQL_NOT_AUTHORIZED');
    const won=following===0;if(won){following=1;updates++;}
    return {meta:{rows_written:won?1:0}};
   },
  };
 }};
}};
const r2={
 async put(key,body,options){
  assert.equal(options.onlyIf.etagDoesNotMatch,'*');
  if(objects.has(key))return null;
  objects.set(key,body);
  return {etag:'etag'+objects.size};
 },
 async get(key){return objects.has(key)?{text:async()=>objects.get(key)}:null},
 async head(key){return objects.has(key)?{etag:'etag'+objects.size}:null},
 async delete(key){objects.delete(key)},
};
const env={SORIDRAW_ENVIRONMENT:'isolated-qa',APP776_ACCESS:access,APP776_ROW:row,
 APP776_CUTOVER:'qa776_cutover_'+'d'.repeat(32),
 APP776_EPOCH:'a'.repeat(32),QA_APP776_D1:d1,QA_APP776_R2:r2};
async function send(path,authorized=true){
 const req=new Request('https://qa.example'+path,{
  method:path.endsWith('health')?'GET':'POST',
  headers:authorized?{'X-APP776-QA-Access':access}:{},
 });
 const r=await worker.fetch(req,env);
 return {code:r.status,body:await r.json()};
}
const check=(r,code,status)=>{assert.equal(r.code,code);assert.equal(r.body.status,status);};
check(await send('/app783/claim',false),403,'DENIED');
check(await send('/app783/health'),200,'QA783_READY');
check(await send('/app783/settle'),409,'HOLD');
check(await send('/app783/claim'),201,'ADMISSION_ONLY_NOT_D1_COMMIT');
check(await send('/app783/claim'),409,'HOLD');
let result=await send('/app783/fault');check(result,409,'HOLD');
assert.equal(result.body.reason,'CANONICAL_PROOF_UNAVAILABLE');
check(await send('/app783/commit'),201,'QA783_SYNTHETIC_D1_COMMIT');
check(await send('/app783/commit'),409,'QA783_D1_NO_NEW_CHANGE');
check(await send('/app783/settle'),201,'QA_IMMUTABLE_SETTLED_ONLY');
const first=(await send('/app783/health')).body.settledEtag;
check(await send('/app783/settle'),200,'EXACT_QA_SETTLED_REPLAY_READ_ONLY');
result=await send('/app783/stale');check(result,409,'HOLD');
assert.equal(result.body.reason,'REPLAY_EXACT_CANONICAL_REVISION_MISMATCH');
assert.equal((await send('/app783/health')).body.settledEtag,first);
assert.equal(updates,1);
assert.equal(objects.size,2);
console.log('APP783_QA_WORKER_SYNTHETIC_R2_D1_FAULT_DUPLICATE=PASS');
console.log('APP783_WORKER_REAL_CLOUDFLARE=NOT_TESTED_IN_THIS_JOB');
