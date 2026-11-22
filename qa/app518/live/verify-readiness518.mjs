import assert from 'node:assert/strict';
import {inspectCloudflareQa518,inspectFirebaseQa518}
  from './readiness518.mjs';
import {QA518} from '../isolated/qaGate518.mjs';
const fail=(p,code)=>assert.rejects(p,e=>e?.message===code);
const dbId='11111111-1111-4111-8111-111111111111';
const original=[
 {id:QA518.originalWorker},
];
const responses={
 '/workers/scripts':original,
 '/d1/database?per_page=100&page=1':[{name:QA518.d1Name,uuid:dbId}],
 '/r2/buckets?per_page=100':[{name:QA518.r2Name}],
 '/workers/scripts/soridraw-owner-qa-583/deployments':
  {deployments:[{versions:[{version_id:QA518.originalVersion,percentage:100}]}]},
 '/workers/scripts/soridraw-owner-qa-583/settings':{
  bindings:[{name:'OWNER558_DO',type:'durable_object_namespace'},
    {name:'OWNER583_QA_CONFIG',type:'secret_text'},
    {name:'OTHER',type:'secret_text'},
    {name:'CONSTANT',type:'plain_text'}],
 },
 ['/d1/database/'+dbId+'/query']:{result:[{
  success:true,meta:{rows_written:0},results:[],
 }]},
};
const mkFetch=({change={},status=200}={})=>async(url,init)=>{
  const path=new URL(url).pathname+new URL(url).search;
  if(!Object.prototype.hasOwnProperty.call(responses,path))
    throw Error('UNEXPECTED_PATH '+path);
  if(path.includes('/d1/database/'+dbId+'/query')){
    assert.equal(init.method,'POST');
    const sql=JSON.parse(init.body).sql;
    assert.ok(sql.startsWith('SELECT name FROM sqlite_master'));
    assert.ok(!/\b(?:DROP|UPDATE|DELETE|INSERT|PRAGMA|ATTACH)\b/i.test(sql));
  }else assert.equal(init.method,'GET');
  return {status,json:async()=>({success:true,result:
   Object.prototype.hasOwnProperty.call(change,path)?change[path]:responses[path]})};
};
const auth={workerToken:'x'.repeat(40),storageToken:'y'.repeat(40),
 dataToken:'z'.repeat(40)};
const inspect=async(opts={})=>inspectCloudflareQa518({
 ...auth,call:mkFetch(opts),
});
const result=await inspect();
assert.equal(result.cloudMutations,0);
assert.equal(result.d1RowsWritten,0);
assert.equal(result.app518TablesPresent,0);
assert.equal(result.existingWorkerCount,1);
await fail(inspect({change:{'/workers/scripts':[...original,{id:'foreign-writer'}]}}),
 'HOLD_QA_ACCOUNT_RESOURCES_DRIFTED');
await fail(inspect({change:{
 '/workers/scripts/soridraw-owner-qa-583/deployments':
  {deployments:[{versions:[{version_id:'unknown',percentage:100}]}]},
}}),'HOLD_QA_ORIGINAL_WORKER_VERSION_DRIFTED');
await fail(inspect({change:{
 '/workers/scripts/soridraw-owner-qa-583/settings':{
  bindings:[...responses['/workers/scripts/soridraw-owner-qa-583/settings'].bindings,
    {name:'EXTRA_D1',type:'d1_database'}],
 },
}}),'HOLD_QA_ORIGINAL_WORKER_BINDING_CHANGED');
await fail(inspect({change:{['/d1/database/'+dbId+'/query']:{
 result:[{success:true,meta:{rows_written:1},results:[]}],
}}}),'HOLD_QA_D1_SELECT_NOT_W0');
await fail(inspect({change:{['/d1/database/'+dbId+'/query']:{
 result:[{success:true,meta:{rows_written:0},
 results:[{name:'music_note_catalog_outbox_518'}]}],
}}}),'HOLD_QA_PARTIAL_OR_OLD_APP518_TABLES');
await fail(inspectCloudflareQa518({
 ...auth,call:mkFetch({status:403}),
}),'HOLD_QA_METADATA_HTTP_403');
const g={
 project:{projectId:'soridraw-app',projectNumber:'1083981050742'},
 database:{name:'projects/soridraw-app/databases/(default)',
  locationId:'asia-northeast3',edition:'STANDARD',type:'FIRESTORE_NATIVE'},
 functions:[{name:'projects/soridraw-app/locations/asia-northeast3/functions/publishExploreOwnerFollower542'}],
};
assert.equal(inspectFirebaseQa518(g).cloudMutations,0);
assert.throws(()=>inspectFirebaseQa518({...g,project:{
 ...g.project,projectId:'soridraw-app-866a5'}}),
 /HOLD_QA_FIREBASE_PROJECT_DRIFT/);
assert.throws(()=>inspectFirebaseQa518({...g,functions:[
 ...g.functions,{name:'app518QaExactFavoriteSource'}]}),
 /HOLD_QA_FIREBASE_FUNCTIONS_DRIFT/);
console.log('APP518_QA_LIVE_METADATA_SCOPE_ORIGINAL_VERSION_AND_W0=PASS');
console.log('APP518_QA_FOREIGN_WRITER_PARTIAL_SCHEMA_PROD_PROJECT=DENIED');
console.log('APP518_QA_SOURCE_ONLY_NO_CLOUD_MUTATIONS=PASS');
