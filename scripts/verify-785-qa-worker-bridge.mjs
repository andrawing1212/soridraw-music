// APP785: isolated QA Worker bridge only; no external requests or users.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from './app776-qa-integration-worker.mjs';
const OWNER='qa776OwnerSynthetic',ACTOR='qa776ActorSynthetic';
const ROW='qa776_'+ 'a'.repeat(16),EPOCH='b'.repeat(32);
const CUTOVER='qa776_cutover_'+'c'.repeat(32),ACCESS='d'.repeat(64);
const CAP='application/json; soridraw-follow=ordered-354';
let following=0,writes=0,r2Writes=0;
const db={prepare(sql){return{bind(...args){return{
 async first(){assert(sql.includes('app768_qa_synthetic_follow'));return {following}},
 async run(){
  assert(sql.includes('app768_qa_synthetic_follow'));
  const [next,key,previous]=args;
  assert.equal(key,ROW);
  const success=previous===following&&next!==following;
  if(success){following=next;writes++;}
  return {meta:{rows_written:success?1:0}};
 }
}}}}};
const r2={
 async get(){return null},async head(){return null},
 async put(){r2Writes++;throw Error('QA785_R2_WRITE_FORBIDDEN')},
 async delete(){throw Error('QA785_DELETE_FORBIDDEN')},
};
const env={SORIDRAW_ENVIRONMENT:'isolated-qa',
 APP785_ISOLATED_TEST:'1',APP776_ACCESS:ACCESS,APP776_EPOCH:EPOCH,
 APP776_CUTOVER:CUTOVER,APP776_ROW:ROW,QA_APP776_D1:db,QA_APP776_R2:r2};
const path='https://qa.invalid/v1/profiles/'+OWNER+'/follow';
async function call(method,{accept,body,authorized=true}={}){
 const response=await worker.fetch(new Request(path,{method,
 headers:{...(accept?{Accept:accept}:{}),
  ...(authorized?{'X-APP776-QA-Access':ACCESS}:{})},
 ...(body===undefined?{}:{body})}),env);
 return {code:response.status,data:await response.json()};
}
const h=await call('PUT',{accept:CAP,authorized:false});
assert.equal(h.code,403);assert.equal(writes,0);
for(const [method,next] of [['PUT',1],['DELETE',0],['PUT',1]]){
 const r=await call(method);
 assert.equal(r.code,200);assert.equal(r.data.status,'QA785_CANONICAL_CHANGED');
 assert.equal(r.data.rowsWritten,1);assert.equal(following,next);
}
assert.equal(writes,3);
const probe=await call('DELETE',{accept:CAP});
assert.equal(probe.code,409);
assert.equal(probe.data.error.code,'FOLLOW_ORDER_REQUIRED');
assert.equal(writes,3);assert.equal(following,1);
const ID='owner_follow_579_'+createHash('sha256').update(JSON.stringify([
 CUTOVER,ACTOR,OWNER,3,false])).digest('hex');
const body=JSON.stringify({followOperationId:ID,followExpectedRevision:3});
const next=await call('DELETE',{accept:CAP,body});
assert.equal(next.code,200);assert.equal(next.data.status,'QA785_CANONICAL_CHANGED');
assert.equal(next.data.rowsWritten,1);assert.equal(writes,4);assert.equal(following,0);
const again=await call('DELETE',{accept:CAP,body});
assert.equal(again.code,200);assert.equal(again.data.rowsWritten,0);
const stale=await call('PUT',{accept:CAP,body:JSON.stringify({
 followOperationId:ID,followExpectedRevision:1})});
assert.equal(stale.code,409);assert.equal(writes,4);
assert.equal(r2Writes,0);
console.log('APP785_QA_WORKER_OLD_FOLLOW_UNFOLLOW_REFOLLOW_PASS');
console.log('APP785_QA_WORKER_CAPABILITY_PROBE_W0_ORDERED_W1_REPLAY_W0_PASS');
console.log('APP785_QA_WORKER_R2_WRITES_ZERO_AUTH_SCOPE_PASS');
console.log('APP785_ACTUAL_CLOUDFLARE_QA=NOT_TESTED_IN_OFFLINE_JOB');
