import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {createApp518ServerBridge} from '../cloudflare/media-worker/src/catalogServerBridge518.js';
const uid='owner',documentId='doc-1',nowMs=1793152800000;
const version='001793152800000000001';
const secret='app518-bridge-internal-secret-of-sufficient-length';
const payload={action:'enqueue',uid,documentId,
 sourceVersionNs:version,desiredState:'saved'};
const sign=(value,when=nowMs)=>new Request('https://trusted.internal.test/app518',{
 method:'POST',headers:{'content-type':'application/json',
 'x-soridraw-server-time-518':String(when),
 'x-soridraw-server-signature-518':createHmac('sha256',secret)
   .update(String(when)+'\n'+JSON.stringify(value)).digest('hex'),
 },body:JSON.stringify(value),
});
let d1Writes=0,reads=0;
const db={
 prepare(sql){return {bind(...args){return {
  async run(){if(!sql.includes('music_note_catalog_daily_budget_518'))d1Writes++;return {meta:{changes:1}};},
  async all(){reads++;return {results:[]};},
  async first(){reads++;return null;},
 };}};},
 async batch(){throw Error('unexpected full index');},
};
const env={CATALOG_OUTBOX_518:db,ACCOUNT_D1_BUDGET_518:db,
 CATALOG_SERVER_HMAC_518:secret,
 SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
 SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
 SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED',
 CATALOG:{async get(){throw Error('unused in ingest');},
  async put(){throw Error('unused in ingest');}},
};
const canonical=()=>({uid,documentId,verifiedByServer:true,
 state:'saved',updateTime:'2026-10-28T02:00:00.000000001Z',
 item:{id:documentId,uid}});
const build=(settings={})=>createApp518ServerBridge({
 env,sharedReleaseFencesVerified:true,signedAccountD1CutoverVerified:true,
 readExactCanonical:async()=>canonical(),
 projectItem:item=>item,sortItems:items=>items,...settings,
});
let bridge=build();
assert.equal(bridge.enabled,true);
// An outbox-local ledger is NEVER evidence of account-wide coverage.
const missingSharedLedger=build({env:{...env,ACCOUNT_D1_BUDGET_518:undefined}});
assert.equal(missingSharedLedger.enabled,false);
assert.equal((await missingSharedLedger.ingestSignedRequest({
 request:sign(payload),nowMs,
})).code,'HOLD_RELEASE_OR_SERVER_DEPENDENCIES');
assert.equal(d1Writes,0,'missing account ledger must write nothing');
let response=await bridge.ingestSignedRequest({request:sign(payload),nowMs});
assert.equal(response.code,'ENQUEUED');assert.equal(response.d1Writes,1);
assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({request:sign({...payload,uid:'attacker'}),
 nowMs});
assert.equal(response.code,'HOLD_CANONICAL_UNVERIFIED');assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({
 request:sign({...payload,sourceVersionNs:'001793152800000000999'}),nowMs,
});
assert.equal(response.code,'STALE_SIGNED_EVENT_NO_WRITE');
assert.equal(d1Writes,1);
response=await bridge.ingestSignedRequest({
 request:new Request('https://trusted.internal.test/app518',{method:'POST',
 headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),
 nowMs,
});
assert.notEqual(response.code,'ENQUEUED');assert.equal(d1Writes,1);
const off=build({sharedReleaseFencesVerified:false});
assert.equal(off.enabled,false);
response=await off.ingestSignedRequest({request:sign(payload),nowMs});
assert.equal(response.code,'HOLD_RELEASE_OR_SERVER_DEPENDENCIES');
assert.equal(d1Writes,1);
const retry=await bridge.drainServerPending({nowMs,limit:4});
assert.equal(retry.code,'OK');
assert.equal(retry.attempted,0);
// One extra indexed D1 lookup protects the account-wide reservation from duplicate writes.
assert.equal(reads,2);assert.equal(d1Writes,1);
const signedRetry=await bridge.ingestSignedRequest({
 request:sign({action:'retry',uid,documentId}),nowMs,
});
assert.equal(signedRetry.code,'RETRY_ARMED');
assert.equal(signedRetry.d1Writes,1);
assert.equal(d1Writes,2);
// P1 bridge->delivery integration: transient first-index R2 failure
// must schedule a bounded retry, not set a permanent outbox HOLD.
// Uses the actual bridge/drain/staging modules, not a copied error string.
const queuedRow={owner_uid:uid,favorite_id:documentId,
 source_version_ns:version,desired_state:'saved',ack_version_ns:null,
 attempt_count:0,next_attempt_ms:0,hold_reason:null};
let retries=0,holds=0,cloudReads=0,cloudPuts=0;
const pendingDb={prepare(sql){return {bind(...args){return {
 async first(){return null;}, // no existing owner index
 async all(){return {results:queuedRow.hold_reason===null&&
   queuedRow.next_attempt_ms<=args[0]?[{...queuedRow}]:[]};},
 async run(){
  if(sql.includes('music_note_catalog_daily_budget_518'))
   return {success:true,meta:{changes:1}};
  if(sql.includes('SET hold_reason=?')){
   assert.equal(args[2],uid);
   assert.equal(args[3],documentId);
   assert.equal(args[4],queuedRow.source_version_ns);
   queuedRow.hold_reason=args[0];holds++;
   return {meta:{changes:1}};
  }
  if(!sql.includes('attempt_count=attempt_count+1'))
   throw Error('unexpected bridge outbox write: '+sql);
  assert.equal(args[4],queuedRow.source_version_ns);
  assert.equal(args[5],queuedRow.attempt_count);
  queuedRow.next_attempt_ms=args[0];queuedRow.attempt_count++;
  retries++;return {meta:{changes:1}};
 },
};}};},async batch(){throw Error('no staging rows should be written');}};
const transientBridge=build({env:{
 ...env,CATALOG_OUTBOX_518:pendingDb,
 CATALOG:{
  async get(){cloudReads++;throw Error('transient R2 materialization failure');},
  async put(){cloudPuts++;throw Error('unexpected R2 write');},
 },
}});
assert.equal(transientBridge.enabled,true);
const processed=await transientBridge.drainServerPending({nowMs,limit:4});
assert.equal(processed.attempted,1);
assert.equal(processed.acked,0);
assert.equal(processed.retry,1);
assert.equal(processed.held,0);
assert.equal(queuedRow.hold_reason,null);
assert.equal(queuedRow.attempt_count,1);
assert.ok(queuedRow.next_attempt_ms>nowMs);
assert.equal(retries,1);
assert.equal(cloudReads,1);
assert.equal(cloudPuts,0);
assert.equal((await transientBridge.drainServerPending({nowMs,limit:4})).attempted,0);
assert.equal(retries,1,'same due tick must not retry repeatedly');
// Real R2 provider contract failures (foreign owner, corrupt JSON) must
// propagate through first-index into the durable outbox HOLD, not IO retry.
const illegalHeads=[
 {etag:'E-foreign',size:20,customMetadata:{uid:'other-user',
   kind:'musicNote'},async text(){return '{}';}},
 {etag:'E-corrupt',size:20,customMetadata:{uid,kind:'musicNote'},
  async text(){return '{invalid-json';}},
];
for(const invalidR2Head of illegalHeads){
 Object.assign(queuedRow,{attempt_count:0,next_attempt_ms:0,
  hold_reason:null,ack_version_ns:null});
 const beforeRetries=retries,beforeHolds=holds,beforePuts=cloudPuts;
 const contractBridge=build({env:{...env,CATALOG_OUTBOX_518:pendingDb,
  CATALOG:{
   async get(){cloudReads++;return invalidR2Head;},
   async put(){cloudPuts++;throw Error('forbidden PUT');},
  },
 }});
 const denied=await contractBridge.drainServerPending({nowMs,limit:4});
 assert.equal(denied.attempted,1);
 assert.equal(denied.acked,0);
 assert.equal(denied.retry,0);
 assert.equal(denied.held,1);
 assert.equal(queuedRow.hold_reason,'INDEX_CONTRACT');
 assert.equal(retries,beforeRetries,'bad owner/schema must not retry as IO');
 assert.equal(holds,beforeHolds+1);
 assert.equal(cloudPuts,beforePuts,'invalid HEAD must not PUT');
 assert.equal((await contractBridge.drainServerPending({nowMs,limit:4})).attempted,0);
}
// Work P1/P2 exact integration: the REAL R2 provider -> server bridge ->
// first index / READY compaction -> delivery must preserve permanent-vs-IO.
// The fake D1 contains only ONE owner/source version; there is no live IO.
const basePath='catalog/v5/'+uid+'/musicNote/bases/200.json';
const headFixture={...createEmptyCatalogJournal({
 kind:'musicNote',baseKey:basePath,baseRevision:200,itemCount:0,now:2000,
}),canonicalAuthority518:true};
const baseFixture={schemaVersion:4,authority:'server',kind:'musicNote',
 complete:true,revision:200,itemCount:0,items:[]};
function storedHead(mode){
 const body=JSON.stringify(headFixture);
 return {etag:'"current-200"',size:Buffer.byteLength(body),
  customMetadata:{uid,kind:'musicNote',
   revision:String(headFixture.headRevision),
   itemCount:String(headFixture.itemCount),
   baseRevision:String(headFixture.baseRevision)},
  async text(){
   if(mode==='HEAD_STREAM')throw Error('TEMP_HEAD_BODY_IO');
   if(mode==='HEAD_JSON')return '{broken-json';
   return body;
  },
 };
}
function storedBase(mode){
 return {etag:'"base-200"',size:Buffer.byteLength(JSON.stringify(baseFixture)),
  customMetadata:{uid:mode==='BASE_FOREIGN'?'other-owner':uid,
   kind:'musicNote'},
  async text(){
   if(mode==='BASE_STREAM')throw Error('TEMP_BASE_BODY_IO');
   if(mode==='BASE_JSON')return '{broken-json';
   return JSON.stringify(baseFixture);
  },
 };
}
function deliveryFixture(ready){
 const row={owner_uid:uid,favorite_id:documentId,
  source_version_ns:version,desired_state:'saved',ack_version_ns:null,
  attempt_count:0,next_attempt_ms:0,hold_reason:null};
 const counter={retry:0,hold:0,puts:0,fullBaseReads:0,headReads:0,
  unexpectedWrites:0};
 const meta={generation:100,indexed_revision:100,expected_count:0,
  head_etag:'"old-100"',status:'ready'};
 const database={
  prepare(sql){return {bind(...args){return {
   async all(){return {results:row.hold_reason===null&&
    row.next_attempt_ms<=args[0]?[{...row}]:[]};},
   async first(){
    if(sql.includes('FROM music_note_catalog_index_meta_518'))
     return ready?{...meta}:null;
    if(sql.includes('FROM music_note_catalog_outbox_518'))
     return {source_version_ns:row.source_version_ns,
      desired_state:row.desired_state};
    throw Error('unexpected D1 select: '+sql);
   },
   async run(){
  if(sql.includes('music_note_catalog_daily_budget_518'))
   return {success:true,meta:{changes:1}};
    if(sql.includes('SET hold_reason=?')){
     assert.equal(args[2],uid);
     assert.equal(args[3],documentId);
     row.hold_reason=args[0];counter.hold++;
     return {meta:{changes:1}};
    }
    if(sql.includes('attempt_count=attempt_count+1')){
     assert.equal(args[4],version);
     assert.equal(args[5],row.attempt_count);
     row.next_attempt_ms=args[0];row.attempt_count++;
     counter.retry++;return {meta:{changes:1}};
    }
    counter.unexpectedWrites++;throw Error('unapproved index write');
   },
  };}};},
  async batch(){counter.unexpectedWrites++;throw Error('unexpected D1 batch');},
 };
 return {row,counter,database};
}
for(const [mode,ready,terminal] of [
 ['HEAD_STREAM',false,false],['BASE_STREAM',false,false],
 ['HEAD_JSON',false,true],['BASE_JSON',false,true],
 ['BASE_FOREIGN',true,true],['BASE_STREAM',true,false],
]){
 const {row,counter,database}=deliveryFixture(ready);
 const testBridge=build({env:{...env,CATALOG_OUTBOX_518:database,
  CATALOG:{
   async get(key){
    if(key.endsWith('/journal.json')){counter.headReads++;return storedHead(mode);}
    if(key===basePath){counter.fullBaseReads++;return storedBase(mode);}
    throw Error('unapproved R2 key');
   },
   async put(){counter.puts++;throw Error('FORBIDDEN_PUT');},
  },
 }});
 const receipt=await testBridge.drainServerPending({nowMs,limit:4});
 assert.equal(receipt.code,'OK',mode);
 assert.equal(receipt.attempted,1,mode);
 assert.equal(receipt.acked,0,mode);
 assert.equal(receipt.held,terminal?1:0,mode);
 assert.equal(receipt.retry,terminal?0:1,mode);
 assert.equal(row.hold_reason,terminal?'INDEX_CONTRACT':null,mode);
 assert.equal(counter.puts,0,mode);
 assert.equal(counter.unexpectedWrites,0,mode);
 assert.equal(counter.hold,terminal?1:0,mode);
 assert.equal(counter.retry,terminal?0:1,mode);
 if(terminal){
  assert.equal((await testBridge.drainServerPending({nowMs:nowMs+1000000})).attempted,0);
 }else{
  assert.ok(row.next_attempt_ms>nowMs,mode);
  assert.equal((await testBridge.drainServerPending({nowMs:nowMs})).attempted,0);
  // Exact same source is still eligible at the bounded next attempt.
  const next=await testBridge.drainServerPending({
   nowMs:row.next_attempt_ms,limit:4,
  });
  assert.equal(next.attempted,1,mode);
  assert.equal(next.retry,1,mode);
  assert.equal(row.hold_reason,null,mode);
 }
}
// Audit P1-2: the actual delivery loop must hold a permanent Firebase
// 409 owner/receipt violation once, but retry a temporary callback outage.
// No authenticated source => no R2 HEAD read or PUT.
const {CatalogFirebaseSourceHold518}
 =await import('../cloudflare/media-worker/src/catalogFirebaseFetcher518.js');
for(const isPermanent of [true,false]){
 const {row,counter,database}=deliveryFixture(false);
 const faultBridge=build({
  env:{...env,CATALOG_OUTBOX_518:database,
   CATALOG:{async get(){throw Error('FORBIDDEN_R2_GET');},
    async put(){throw Error('FORBIDDEN_R2_PUT');}}},
  readExactCanonical:async()=>{
   if(isPermanent)throw new CatalogFirebaseSourceHold518('DENY_OWNER_OR_ABSENT');
   throw Error('APP518_EXACT_SOURCE_UNAVAILABLE');
  },
 });
 const receipt=await faultBridge.drainServerPending({nowMs,limit:1});
 assert.equal(receipt.attempted,1);
 assert.equal(receipt.acked,0);
 assert.equal(receipt.held,isPermanent?1:0);
 assert.equal(receipt.retry,isPermanent?0:1);
 assert.equal(row.hold_reason,isPermanent?'SOURCE_CONTRACT':null);
 assert.equal(counter.puts,0);
}
// PREVIEW one-song trial: valid HMAC is NOT authorization to enqueue a
// different owner/song. Delivery cursor must also be exact-owner scoped.
const pilot=build({pilotScope:{uid,documentId}});
const prevWrites=d1Writes;
const deniedPilot=await pilot.ingestSignedRequest({
 request:sign({...payload,documentId:'unrelated-song'}),nowMs,
});
assert.equal(deniedPilot.code,'DENY_OUTSIDE_PREVIEW_PILOT');
assert.equal(d1Writes,prevWrites,'other song must have D1 W0');
const {getDueFavoriteChanges518,SELECT_DUE_PILOT_518}
 =await import('../cloudflare/media-worker/src/catalogD1Outbox518.js');
let selected=0;
const exactDb={prepare(sql){
 assert.equal(sql,SELECT_DUE_PILOT_518,'never select all pending owners');
 return {bind(...args){
 assert.deepEqual(args,[nowMs,uid,documentId,1]);
 return {async all(){selected++;return {results:[]};}};
 }};
}};
const scopedDue=await getDueFavoriteChanges518({
 db:exactDb,nowMs,limit:1,pilotUid:uid,pilotDocumentId:documentId,
});
assert.equal(scopedDue.code,'OK');assert.equal(selected,1);
assert.equal((await getDueFavoriteChanges518({
 db:exactDb,nowMs,limit:1,pilotUid:uid,
})).code,'DENY_PILOT_SCOPE');
console.log('APP518_PREVIEW_PILOT_HMAC_AND_D1_EXACT_SONG_ONLY=PASS');
console.log('APP518_FIREBASE_409_SOURCE_HOLD_VS_5XX_BOUNDED_DELIVERY_RETRY=PASS');
console.log('APP518_BRIDGE_HEAD_BASE_STREAM_IO_RETRY_JSON_CONTRACT_HOLD=PASS');
console.log('APP518_BRIDGE_READY_COMPACTION_FOREIGN_BASE_HOLD_IO_RETRY=PASS');
console.log('APP518_BRIDGE_FOREIGN_OWNER_AND_BAD_JSON_TERMINAL_HOLD=PASS');
console.log('APP518_BRIDGE_TRANSIENT_INDEX_FAILURE_RETAINS_BOUNDED_RETRY=PASS');
console.log('APP518_SIGNED_EVENT_FRESH_EXACT_FIRESTORE_BEFORE_D1=PASS');
console.log('APP518_STALE_FOREIGN_UNSIGNED_EVENT_D1_W0=PASS');
console.log('APP518_SHARED_RELEASE_FENCE_GATE_PREVENTS_BOOTSTRAP=PASS');
console.log('APP518_EMPTY_RETRY_BATCH_R2_R0_D1_W0=PASS');
console.log('APP518_SERVER_BRIDGE_NO_LIVE_ROUTES_OR_DATA=PASS');
