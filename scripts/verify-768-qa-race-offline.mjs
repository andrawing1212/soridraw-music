// Offline safety smoke, not evidence of real Cloudflare atomicity.
import assert from 'node:assert/strict';
import worker from './app768-qa-race-worker.mjs';
const map=new Map();let puts=0,deletes=0;
const bucket={
 async put(k,v,opt){
  assert.match(k,/^internal\/qa767\/owner-follow-admissions\/[a-f0-9]{64}$/);
  assert.equal(opt?.onlyIf?.etagDoesNotMatch,'*');
  assert.equal(opt?.httpMetadata?.contentType,'application/json');
  puts++;await Promise.resolve();if(map.has(k))return null;
  map.set(k,String(v));return {etag:'qa-only-mock-etag'};},
 async head(k){return map.has(k)?{httpMetadata:{contentType:'application/json'}}:null;},
 async delete(k){deletes++;map.delete(k);}
};
const env={QA_APP768_R2:bucket,SORIDRAW_ENVIRONMENT:'isolated-qa',
 APP768_EPOCH:'1'.repeat(32),APP768_CUTOVER:'qa768_cutover_'+'2'.repeat(32),
 APP768_OPERATION:'qa768_op_'+'3'.repeat(32),APP768_ACCESS:'4'.repeat(64)};
const req=(path,method='GET',access=env.APP768_ACCESS)=>new Request(
 'https://qa.invalid'+path,{method,headers:{'X-APP768-QA-Access':access}});
assert.equal((await worker.fetch(req('/claim','POST','wrong'),env)).status,403);
assert.equal((await worker.fetch(req('/health'),{...env,SORIDRAW_ENVIRONMENT:'production'})).status,503);
assert.equal((await (await worker.fetch(req('/health'),env)).json()).empty,true);
const result=await Promise.all(Array.from({length:6},()=>worker.fetch(req('/claim','POST'),env)));
assert.equal(result.filter(x=>x.status===201).length,1);
assert.equal(result.filter(x=>x.status===409).length,5);
assert.equal(puts,6);assert.equal(map.size,1);
const item=await (await worker.fetch(req('/inspect'),env)).json();
assert.equal(item.exists,true);assert.equal(item.contentType,'application/json');
assert.equal((await worker.fetch(req('/cleanup','POST'),env)).status,200);
assert.equal(deletes,1);assert.equal(map.size,0);
console.log('APP768_OFFLINE_APP767_SIX_WAY_AND_QA_SCOPE=PASS');
console.log('APP768_OFFLINE_IS_NOT_REAL_R2=CONFIRMED');
