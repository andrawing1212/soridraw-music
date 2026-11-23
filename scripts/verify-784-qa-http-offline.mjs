// APP784 synthetic HTTP integration, no real QA network or user data.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from './app776-qa-integration-worker.mjs';
const row='qa776_'+'c'.repeat(16),access='b'.repeat(64);
const epoch='a'.repeat(32),cutover='qa776_cutover_'+'d'.repeat(32);
const owner='qa776OwnerSynthetic',actor='qa776ActorSynthetic';
let following=0,changes=0,puts=0,removes=0;
const objects=new Map();
const db={prepare(sql){
 assert(sql.includes('app768_qa_synthetic_follow'));
 return {bind(...args){
  assert(args.includes(row));
  return {
   async first(){return {following}},
   async run(){
    if(sql.startsWith('UPDATE')){
     const [next,key,before]=args;
     const changed=Number(following)===Number(before);
     if(changed){following=next;changes++}
     return {meta:{rows_written:changed?1:0}};
    }
    if(sql.startsWith('DELETE')){removes++;return {meta:{rows_written:1}}}
    throw Error('QA784_UNEXPECTED_SQL');
   },
  };
 }};
}};
const bucket={
 async head(k){return objects.has(k)?{etag:'qa784-etag-'+k.slice(-5)}:null},
 async get(k){return objects.has(k)?{text:async()=>objects.get(k)}:null},
 async put(k,body,options){
  assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
  puts++;
  if(objects.has(k))return null;
  objects.set(k,body);return {etag:'qa784-etag'};
 },
 async delete(k){objects.delete(k)},
};
const env={SORIDRAW_ENVIRONMENT:'isolated-qa',APP776_ACCESS:access,
 APP776_ROW:row,APP776_EPOCH:epoch,APP776_CUTOVER:cutover,
 QA_APP776_D1:db,QA_APP776_R2:bucket};
const base='https://app784.qa.invalid';
const url='/v1/qa784/profiles/'+owner+'/follow';
async function request(method,body,authorized=true,path=url){
 const r=await worker.fetch(new Request(base+path,{method,
  headers:authorized?{'X-APP776-QA-Access':access}:{},
  ...(body===undefined?{}:{body})}),env);
 return {http:r.status,value:await r.json()};
}
const id=async(rev,desired)=>{
 const data=JSON.stringify([cutover,actor,owner,rev,desired]);
 const bytes=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(data)));
 return 'owner_follow_579_'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const followId=await id(1,true),unfollowId=await id(2,false);
const ordered=(op,rev)=>JSON.stringify({followOperationId:op,followExpectedRevision:rev});
const expect=(r,http,status)=>{assert.equal(r.http,http);assert.equal(r.value.status,status)};
expect(await request('PUT','{}',false),403,'DENIED');
let r=await request('PUT','{}');expect(r,201,'QA784_ONE_SYNTHETIC_CHANGE_SETTLED');
assert.equal(r.value.operationId,followId);assert.equal(r.value.kind,'legacy');
assert.equal(changes,1);assert.equal(puts,2);assert.equal(objects.size,2);
r=await request('PUT',ordered(followId,1));
expect(r,200,'QA784_ORDERED_REPLAY_READ_ONLY');
assert.equal(changes,1);assert.equal(puts,2);
r=await request('DELETE',ordered(unfollowId,2));
expect(r,201,'QA784_ONE_SYNTHETIC_CHANGE_SETTLED');
assert.equal(r.value.operationId,unfollowId);assert.equal(r.value.kind,'ordered');
assert.equal(changes,2);assert.equal(puts,4);assert.equal(objects.size,4);
r=await request('DELETE',ordered(unfollowId,2));
expect(r,200,'QA784_ORDERED_REPLAY_READ_ONLY');
assert.equal(changes,2);assert.equal(puts,4);
r=await request('PUT','{}');
expect(r,409,'HOLD');assert.equal(r.value.reason,'LEGACY_ABA_REPLAY_AMBIGUOUS');
r=await request('PUT',ordered(followId,1));
expect(r,409,'HOLD');assert.equal(changes,2);assert.equal(puts,4);
r=await request('PUT',JSON.stringify({followOperationId:followId}));
expect(r,409,'HOLD');assert.equal(changes,2);assert.equal(puts,4);
assert.equal(following,0);
console.log('APP784_QA_HTTP_LEGACY_FOLLOW_ORDERED_REPLAY_AND_UNFOLLOW=PASS');
console.log('APP784_QA_HTTP_IMMUTABLE_R2_4_OBJECTS_W1_PER_CHANGE=PASS');
console.log('APP784_QA_HTTP_ABA_STALE_OPERATION_HOLD_NO_WRITES=PASS');
console.log('APP784_REAL_SERVER_USER_AUTH_AND_GLOBAL_WRITER_CUTOVER=NOT_TESTED');
