// APP776 local isolated QA Worker HTTP integration test. Fake D1+R2 only.
// No Cloudflare/Firebase network, no canonical user data or deployments.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from './app776-qa-integration-worker.mjs';
const original=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP776_OFFLINE_NETWORK_FORBIDDEN')};
const epoch='a'.repeat(32),access='b'.repeat(64),row='qa776_'+'c'.repeat(16);
const cutover='qa776_cutover_'+'d'.repeat(32);
let value=0,exists=true,updates=0,cleaned=0;
const objects=new Map();
const binding={
 prepare(sql){
  assert(sql.includes('app768_qa_synthetic_follow'));
  return {bind(...args){
   assert(args.includes(row));
   return {
    async first(){
     assert(sql.startsWith('SELECT following'));
     return exists?{following:value}:null;
    },
    async run(){
     if(sql.startsWith('UPDATE')){
      const [desired,key,previous]=args;
      assert.equal(key,row);
      const win=exists&&value===previous;
      if(win){value=desired;updates++}
      return {meta:{rows_written:win?1:0}};
     }
     if(sql.startsWith('DELETE')){
      const count=exists?1:0;
      exists=false;cleaned++;
      return {meta:{rows_written:count}};
     }
     throw Error('UNEXPECTED_SQL');
    },
   };
  }};
 },
};
const env={
 SORIDRAW_ENVIRONMENT:'isolated-qa',APP776_ACCESS:access,
 APP776_EPOCH:epoch,APP776_CUTOVER:cutover,APP776_ROW:row,
 QA_APP776_D1:binding,
 QA_APP776_R2:{
  async put(key,body,options){
   assert(key.startsWith('internal/qa776/synthetic-follow/'+row+'/'));
   assert.equal(options.onlyIf.etagDoesNotMatch,'*');
   if(objects.has(key))return null;
   objects.set(key,body);
   return {etag:'mock-etag'};
  },
  async head(key){return objects.has(key)?{etag:'mock-etag'}:null},
  async delete(key){objects.delete(key)},
 },
};
const base='https://qa776.example.test',endpoint='/v1/profiles/qa776OwnerSynthetic/follow';
async function invoke(method,path=endpoint,body,authorized=true){
 return worker.fetch(new Request(base+path,{
  method,headers:authorized?{'X-APP776-QA-Access':access}:{},
  ...(body===undefined?{}:{body}),
 }),env);
}
const json=async r=>({code:r.status,value:await r.json()});
async function operationId(revision,desired){
 const input=JSON.stringify([cutover,'qa776ActorSynthetic','qa776OwnerSynthetic',revision,desired]);
 const digest=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(input)));
 return 'owner_follow_579_'+[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
}
try{
 let r=await json(await invoke('GET','/health'));
 assert.deepEqual([r.code,r.value.status,r.value.following],[200,'QA_READY',false]);
 r=await json(await invoke('PUT',endpoint,'{}',false));
 assert.deepEqual([r.code,r.value.status],[403,'DENIED']);
 r=await json(await invoke('PUT',endpoint,'{"followOperationId":"invalid"}'));
 assert.equal(r.code,409);
 assert.equal(r.value.status,'QA_ENTRY_HOLD');
 assert.equal(updates,0);
 const pair=await Promise.all([invoke('PUT',endpoint,'{}'),invoke('PUT',endpoint,'{}')]);
 const p=await Promise.all(pair.map(json));
 assert.equal(p.filter(x=>x.code===201&&x.value.envelopeKind==='legacy'&&
  x.value.d1RowsWritten===1).length,1);
 assert.equal(p.filter(x=>x.code===200&&x.value.status==='QA_NO_CHANGE'||
  x.code===409&&['QA_DUPLICATE_ADMISSION','QA_ENTRY_HOLD'].includes(x.value.status)).length,1);
 assert.equal(value,1);
 assert.equal(updates,1);
 const ordered=JSON.stringify({followOperationId:await operationId(2,false),
  followExpectedRevision:2});
 const second=await Promise.all([invoke('DELETE',endpoint,ordered),invoke('DELETE',endpoint,ordered)]);
 const q=await Promise.all(second.map(json));
 assert.equal(q.filter(x=>x.code===201&&x.value.envelopeKind==='ordered'&&
  x.value.d1RowsWritten===1).length,1);
 assert.equal(q.filter(x=>x.code===200&&x.value.status==='QA_NO_CHANGE'||
  x.code===409&&['QA_DUPLICATE_ADMISSION','QA_ENTRY_HOLD'].includes(x.value.status)).length,1);
 assert.equal(value,0);
 assert.equal(updates,2);
 assert.equal(objects.size,2);
 r=await json(await invoke('PUT',endpoint,'{}'));
 assert.deepEqual([r.code,r.value.status],[409,'QA_DUPLICATE_ADMISSION']);
 assert.equal(updates,2);
 r=await json(await invoke('POST','/cleanup'));
 assert.deepEqual([r.code,r.value.status],[200,'QA_CLEANED']);
 assert.equal(exists,false);
 assert.equal(objects.size,0);
 assert.equal(cleaned,1);
 console.log('APP776_LOCAL_HTTP_UNIFIED_LEGACY_FOLLOW_ORDERED_UNFOLLOW=PASS');
 console.log('APP776_LOCAL_CONCURRENT_W1_ONCE_PER_MUTATION=PASS');
 console.log('APP776_LOCAL_R2_REPLAY_AND_EXACT_CLEANUP=PASS');
 console.log('APP776_LOCAL_REAL_NETWORK_D1_R2_WRITES=0');
 console.log('APP776_LIVE_AUTH_SIGNED_AND_GLOBAL_WRITER_CUTOVER=NOT_TESTED_HOLD');
}finally{globalThis.fetch=original}
