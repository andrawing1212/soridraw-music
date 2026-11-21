// APP766: ONLY schema metadata and error-closed fixtures, no live resources.
import assert from 'node:assert/strict';
import {assessApp766Schema,runApp766LiveSchema}
 from './app766-live-d1-history-schema-readonly.mjs';
const pair=`CREATE TABLE explore_follow_overrides_348 (
 follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL,
 following INTEGER NOT NULL, mutation_id TEXT NOT NULL,
 PRIMARY KEY (follower_uid, following_uid)) WITHOUT ROWID`;
const rows=[
 {type:'table',name:'explore_follow_overrides_348',sql:pair},
 {type:'table',name:'profile_stats',sql:'CREATE TABLE profile_stats (uid TEXT PRIMARY KEY, follower_count INTEGER)'},
 {type:'table',name:'explore_owner_follow_outbox_529',
  sql:'CREATE TABLE explore_owner_follow_outbox_529(owner_uid TEXT PRIMARY KEY, revision INTEGER)'},
];
const result=assessApp766Schema(rows);
assert.equal(result.status,'SCHEMA_OBSERVED_APP765_HOLD');
assert.equal(result.overlayPairUnique,true);
assert.equal(result.schemaOnlyRead,true);
assert.equal(result.sharedUserRowsRead,0);
assert.equal(result.sharedDatabaseWrites,0);
assert.equal(result.productionDeploymentAuthorized,false);
assert(result.possibleHistoryTableNames.includes('explore_owner_follow_outbox_529'));
// An arbitrary table that looks append-only is NOT proof of continuous
// insertion coverage since origin or independent PITR parity.
const fabricated=assessApp766Schema([...rows,{
 type:'table',name:'follow_operation_history_ledger',
 sql:'CREATE TABLE follow_operation_history_ledger (operation_id TEXT PRIMARY KEY,revision INTEGER)',
}]);
assert.equal(fabricated.status,'SCHEMA_OBSERVED_APP765_HOLD');
assert.equal(fabricated.operationCoverageFromOrigin,'UNVERIFIED');
assert.equal(fabricated.exactOperationStatus,'UNVERIFIED');
assert.equal(fabricated.externallyPinnedRevisionFloor,'UNVERIFIED');
assert.throws(()=>assessApp766Schema([]),/SCHEMA_EMPTY/);
assert.throws(()=>assessApp766Schema([...rows,rows[0]]),/SCHEMA_ROW_INVALID/);
assert.throws(()=>assessApp766Schema([{type:'table',name:'invalid',sql:null}]),
 /SCHEMA_ROW_INVALID/);
let calls=[];
const prior=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),method:options.method,
   body:options.body?JSON.parse(options.body):null});
  if(calls.length===1)return Response.json({success:true,result:{
   uuid:'217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
   name:'soridraw-explore-db'}});
  return Response.json({success:true,result:[{
   success:true,results:rows,meta:{rows_read:3,rows_written:0}}]});
 };
 const got=await runApp766LiveSchema({token:'synthetic_token_test_0123456789012345'});
 assert.equal(got.status,'SCHEMA_OBSERVED_APP765_HOLD');
 assert.equal(calls.length,2,'one database ID GET and one metadata SELECT');
 assert.deepEqual(calls.map(x=>x.method),['GET','POST']);
 assert(calls[1].body.sql.startsWith('SELECT type, name, sql FROM sqlite_schema'));
 assert(!/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE|CREATE)\b/i.test(calls[1].body.sql));
 assert(!/\bFROM\s+(?!sqlite_schema)/i.test(calls[1].body.sql));
 // Explicit drift refuses before any schema query.
 calls=[];
 globalThis.fetch=async()=>{
  calls.push(1);
  return Response.json({success:true,result:{uuid:'wrong',name:'other'}});
 };
 await assert.rejects(
  ()=>runApp766LiveSchema({token:'synthetic_token_test_0123456789012345'}),
  /CANONICAL_D1_IDENTITY_MISMATCH/);
 assert.equal(calls.length,1);
}finally{globalThis.fetch=prior;}
console.log('APP766_SOURCE_SCHEMA_ONLY_NEVER_PROVES_MONOTONIC_LEDGER=PASS');
console.log('APP766_PINNED_CANONICAL_D1_ONE_SELECT_NO_USER_ROWS_OR_WRITES=PASS');
console.log('APP766_ACTUAL_LIVE_D1_METADATA=NOT_RUN_IN_OFFLINE_TEST');
console.log('APP766_APPEND_ONLY_REUSE_PROVEN=NO; APP765_INTEGRATION=HOLD');
