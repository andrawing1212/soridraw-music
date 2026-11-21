// APP769 offline mock of one-shot QA D1+R2 failure-window test.
// Never uses cloud secrets or Cloudflare networks.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const oldFetch=globalThis.fetch;
const saved=Object.fromEntries(['GITHUB_RUN_ID','RUNNER_TEMP','GITHUB_REPOSITORY',
 'GITHUB_REF','GITHUB_EVENT_NAME','CLOUDFLARE_ACCOUNT_ID',
 'CLOUDFLARE_QA_API_TOKEN','CLOUDFLARE_QA_DATA_TOKEN'].map(x=>[x,process.env[x]]));
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const ROOT='https://api.cloudflare.com/client/v4/accounts/'+QA;
const uuid='87654321-1111-2222-3333-aaaaaaaaaaaa';
const tmp=mkdtempSync(join(tmpdir(),'app769-offline-'));
Object.assign(process.env,{
 GITHUB_RUN_ID:'44959999999',RUNNER_TEMP:tmp,
 GITHUB_REPOSITORY:'andrawing1212/soridraw-music',GITHUB_REF:'refs/heads/main',
 GITHUB_EVENT_NAME:'push',CLOUDFLARE_ACCOUNT_ID:QA,
 CLOUDFLARE_QA_API_TOKEN:'synthetic-worker-qa-read-token-012345',
 CLOUDFLARE_QA_DATA_TOKEN:'synthetic-data-qa-token-012345678',
});
const rows=new Map(),objects=new Map();
const counts={upload:0,insert:0,failedSql:0,deleteRows:0,deleteObjects:0};
const ok=result=>Response.json({success:true,result});
const query=(results,rows_written=0)=>ok([{success:true,meta:{rows_written},
 results}]);
globalThis.fetch=async(url,opts={})=>{
 const u=String(url),method=opts.method||'GET';
 assert(u.startsWith(ROOT+'/'),'must never call outside QA account');
 assert.match(opts.headers?.Authorization||'',/^Bearer synthetic-(worker|data)/);
 if(u===ROOT+'/workers/scripts/soridraw-owner-qa-583/deployments'){
  assert.equal(method,'GET');
  return ok({deployments:[{versions:[{
   version_id:'4ed70845-6a4b-4a80-9c51-ed95d0becc38',percentage:100}]}]});
 }
 if(u===ROOT+'/d1/database'){
  assert.equal(method,'GET');
  return ok([{uuid,name:'soridraw-qa-app768-d1'}]);
 }
 if(u===ROOT+'/r2/buckets'){
  assert.equal(method,'GET');
  return ok({buckets:[{name:'soridraw-qa-app768-r2'}]});
 }
 if(u===ROOT+'/d1/database/'+uuid+'/query'){
  assert.equal(method,'POST');
  const sql=JSON.parse(opts.body).sql;
  assert(sql.includes('app768_qa_synthetic_follow'));
  if(sql.startsWith('SELECT COUNT')){
   const k=sql.match(/WHERE k='(qa769_[ab]_[a-f0-9]{16})'/)?.[1];
   assert(k);return query([{n:rows.has(k)?1:0}]);
  }
  if(sql.includes('app769_invalid_column')){
   counts.failedSql++;
   return Response.json({success:false,errors:[{code:1000}]},{status:400});
  }
  if(sql.startsWith('INSERT INTO')){
   const k=sql.match(/VALUES \('(qa769_[ab]_[a-f0-9]{16})',1\)/)?.[1];
   assert(k);assert(!rows.has(k),'duplicate physical D1 insert prohibited');
   rows.set(k,1);counts.insert++;return query([],2);
  }
  if(sql.startsWith('DELETE FROM')){
   for(const k of [...rows.keys()]){
    if(sql.includes("'"+k+"'"))rows.delete(k);
   }
   counts.deleteRows++;return query([],1);
  }
  throw Error('UNEXPECTED_QA_SQL');
 }
 if(u.startsWith(ROOT+'/r2/buckets/soridraw-qa-app768-r2/objects/')){
  const k=u.split('/objects/')[1];
  assert.match(k,/^app769-only-qa-[ab]-[a-f0-9]{16}$/);
  if(method==='PUT'){
   assert(opts.body instanceof Blob);
   assert(!objects.has(k));objects.set(k,await opts.body.text());
   counts.upload++;return ok({key:k});
  }
  if(method==='DELETE'){
   objects.delete(k);counts.deleteObjects++;return ok({key:k});
  }
 }
 throw Error('UNEXPECTED_QA_REQUEST_'+method);
};
try{
 const {app769Qa}=await import('./app769-qa-post-admission.mjs');
 await app769Qa.prepare();
 await app769Qa.exercise();
 assert.equal(counts.upload,2);
 assert.equal(counts.failedSql,1);
 assert.equal(counts.insert,1,'lost ACK must not trigger a second D1 insert');
 assert.equal(rows.size,1);
 assert.equal(objects.size,2);
 await app769Qa.cleanup();
 assert.equal(rows.size,0);
 assert.equal(objects.size,0);
 assert.equal(counts.deleteObjects,2);
 assert.equal(counts.deleteRows,1);
 console.log('APP769_OFFLINE_FAILURE_ACK_LOSS_NO_DOUBLE_WRITE=PASS');
 console.log('APP769_OFFLINE_EXACT_QA_D1_R2_CLEANUP=PASS');
 console.log('APP769_OFFLINE_REAL_CLOUDFLARE_API_CALLS=0');
}finally{
 globalThis.fetch=oldFetch;
 for(const [k,v] of Object.entries(saved)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
 rmSync(tmp,{recursive:true,force:true});
}
