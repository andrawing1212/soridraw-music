// APP768 offline simulation of exactly one QA D1 and one QA R2 bucket.
// No tokens or real Cloudflare calls, no production data.
import assert from 'node:assert/strict';
import {app768Physical} from './app768-qa-provision-and-physical.mjs';
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const ROOT='https://api.cloudflare.com/client/v4/accounts/'+QA;
const uuid='87654321-1111-2222-3333-aaaaaaaaaaaa';
const DB='soridraw-qa-app768-d1',BUCKET='soridraw-qa-app768-r2';
let database=null,bucket=null,table=false,keys=new Map(),counter=new Map(),
 d1Writes=[],writes=[],qaTables=new Map();
function bump(k){counter.set(k,(counter.get(k)||0)+1)}
function ok(result){return Response.json({success:true,result})}
function qResult(rows_written,results=[]){
 return ok([{success:true,results,meta:{rows_written,rows_read:results.length}}]);
}
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{
 const u=String(url),method=opts.method||'GET';
 assert(u.startsWith(ROOT+'/'),'request must use isolated account only');
 assert(opts.headers?.Authorization==='Bearer synthetic-qa-data-token-0123456789'||
   opts.headers?.Authorization==='Bearer synthetic-qa-worker-token-0123456789');
 bump(method+':'+u.split('?')[0]);
 if(u.endsWith('/workers/scripts/soridraw-owner-qa-583/deployments')){
  assert.equal(method,'GET');
  return ok({deployments:[{versions:[{
   version_id:'4ed70845-6a4b-4a80-9c51-ed95d0becc38',percentage:100}]}]});
 }
 if(u===ROOT+'/d1/database'){
  if(method==='GET')return ok(database?[database]:[]);
  assert.equal(method,'POST');
  const b=JSON.parse(opts.body);assert.equal(b.name,DB);
  assert.equal(database,null,'must never create two QA databases');
  return ok(database={uuid,name:DB});
 }
 if(u===ROOT+'/r2/buckets'){
  if(method==='GET')return ok({buckets:bucket?[bucket]:[]});
  assert.equal(method,'POST');
  const b=JSON.parse(opts.body);assert.equal(b.name,BUCKET);
  assert.equal(bucket,null,'must never create two QA buckets');
  return ok(bucket={name:BUCKET});
 }
 if(u===ROOT+'/d1/database/'+uuid+'/query'){
  assert.equal(method,'POST');
  const sql=JSON.parse(opts.body).sql;
  assert(!/profile_stats|explore_|follows|users/i.test(sql));
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS')){
   table=true;return qResult(0);
  }
  assert(table);
  if(sql.startsWith('INSERT INTO')){
   const id=sql.match(/'(qa768_[ab])'/)?.[1];assert(id);
   assert(!qaTables.has(id));qaTables.set(id,0);
   d1Writes.push(1);return qResult(1);
  }
  if(sql.startsWith('UPDATE')){
   const n=sql.includes('IN (')?2:1;
   d1Writes.push(n);return qResult(n);
  }
  if(sql.startsWith('DELETE')){
   const n=[...qaTables].length;qaTables.clear();return qResult(n);
  }
  if(sql.startsWith('SELECT COUNT')){
   return qResult(0,[{n:qaTables.size}]);
  }
  throw Error('INVALID_SQL');
 }
 if(u.startsWith(ROOT+'/r2/buckets/'+BUCKET+'/objects/')){
  const key=u.split('/objects/')[1];
  assert.match(key,/^app768-only-qa-[0-9a-f]{16}$/);
  if(method==='PUT'){
   assert(opts.body instanceof FormData);
   const body=opts.body.get('body');assert(body instanceof Blob);
   keys.set(key,await body.text());writes.push(key);
   return ok({key,etag:'synthetic-etag'});
  }
  if(method==='DELETE'){
   keys.delete(key);return ok({key});
  }
 }
 throw Error('UNEXPECTED_METHOD_OR_URL_'+method+':'+u);
};
try{
 const run=async()=>app768Physical({
  dataToken:'synthetic-qa-data-token-0123456789',
  workerToken:'synthetic-qa-worker-token-0123456789',
 });
 assert.equal((await run()).qaPhysical,true);
 assert.equal((counter.get('POST:'+ROOT+'/d1/database')||0),1);
 assert.equal((counter.get('POST:'+ROOT+'/r2/buckets')||0),1);
 assert.deepEqual(d1Writes,[1,1,1,2]);
 assert.equal(keys.size,0);
 assert.equal(qaTables.size,0);
 assert.equal(writes.length,1);
 await run();
 assert.equal((counter.get('POST:'+ROOT+'/d1/database')||0),1,
  'second run reuses existing QA D1');
 assert.equal((counter.get('POST:'+ROOT+'/r2/buckets')||0),1,
  'second run reuses existing QA R2');
 assert.equal(keys.size,0);
 assert.equal(qaTables.size,0);
}finally{globalThis.fetch=oldFetch;}
console.log('APP768_ONE_QA_D1_R2_CREATION_ONLY_PINNED_ACCOUNT=PASS');
console.log('APP768_QA_SYNTHETIC_D1_W1_W2_AND_EXACT_CLEANUP=PASS');
console.log('APP768_R2_MANAGEMENT_UPLOAD_NOT_WORKERS_CONDITIONAL_PASS=PASS');
console.log('APP768_REAL_ACCOUNT_READS_WRITES=0_OFFLINE');
