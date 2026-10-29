// In-memory Firebase Admin transaction emulator: no real Firestore/Worker.
const assert=require('node:assert/strict');
const {readApp518EventGuard,readApp518OwnerQuarantine,
 recordApp518OwnerCollision,recordApp518EventFailure,
 resolveApp518EventFailure,APP518_FIREBASE_RETRY_LIMIT}
 =require('../lib/app518EventSafetyFence.js');
const {createHash}=require('node:crypto');
const {handleVerifiedApp518ExactSource,signApp518ServiceRequest}
 =require('../lib/app518ServerTransport.js');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const docs=new Map(), stats={reads:0,writes:0};
const makeRef=(name,id)=>({
 path:name+'/'+id,
 async get(){stats.reads++;let v=docs.get(this.path);
  return {exists:!!v,data:()=>v?{...v}:undefined};},
});
const db={
 collection(name){return {doc(id){assert.ok(id.length<=240);
  return makeRef(name,id);}};},
 async runTransaction(fn){
  const actions=[];
  const tx={
   async get(ref){return ref.get();},
   create(ref,data){actions.push(['create',ref,data]);},
   update(ref,data){actions.push(['update',ref,data]);},
  };
  const result=await fn(tx);
  for(const [op,ref,data] of actions){
   if(op==='create')assert.ok(!docs.has(ref.path),'duplicate create');
   if(op==='update')assert.ok(docs.has(ref.path),'missing update');
   docs.set(ref.path,{...docs.get(ref.path),...data});stats.writes++;
  }
  return result;
 },
};
const owner='ownerA',other='ownerB',id='one-song',eventId='event-1',
 nowMs=1793232000000,eventTimeMs=nowMs-1000;
const args={db,documentId:id,eventId,nowMs,eventTimeMs};
(async()=>{
let gate=await readApp518EventGuard(args);
assert.equal(gate,'EVENT_DELIVERY_ALLOWED');assert.equal(stats.writes,0);
assert.equal((await resolveApp518EventFailure({db,documentId:id,eventId,nowMs})),
 'NO_PREVIOUS_FAILURE');assert.equal(stats.writes,0);
for(let n=1;n<=APP518_FIREBASE_RETRY_LIMIT;n++){
 const failed=await recordApp518EventFailure({
  ...args,code:'APP518_DELIVERY_IO_FAILURE',terminal:false});
 assert.equal(failed.attempts,n);
 assert.equal(failed.retry,n<APP518_FIREBASE_RETRY_LIMIT);
 if(n<APP518_FIREBASE_RETRY_LIMIT)
  assert.equal(await readApp518EventGuard(args),'EVENT_RETRY_ALLOWED');
}
assert.equal(stats.writes,8);
assert.equal(await readApp518EventGuard(args),'HOLD_EVENT_ALREADY_TERMINAL');
assert.equal((await recordApp518EventFailure({
 ...args,code:'APP518_DELIVERY_IO_FAILURE',terminal:false})).retry,false);
assert.equal(stats.writes,8,'terminal duplicate W0');
assert.equal(await readApp518EventGuard({
 ...args,eventId:'event-old',nowMs:eventTimeMs+3600000}),
 'HOLD_EVENT_RETRY_WINDOW');
const terminal=await recordApp518EventFailure({
 ...args,eventId:'terminal-409',code:'DENY_SOURCE_OWNER_OR_STATE_MISMATCH',
 terminal:true});
assert.equal(terminal.retry,false);assert.equal(terminal.attempts,1);
const before=stats.writes;
assert.equal((await recordApp518EventFailure({
 ...args,eventId:'terminal-409',code:'DENY_INVALID_RECEIPT',terminal:true})).retry,false);
assert.equal(stats.writes,before,'terminal 409 must be durable W1 only');
const recovered='recover-once';
const fail=await recordApp518EventFailure({
 ...args,eventId:recovered,code:'APP518_DELIVERY_IO_FAILURE',terminal:false});
assert.equal(fail.retry,true);
assert.equal(await resolveApp518EventFailure({
 db,documentId:id,eventId:recovered,nowMs}), 'RESOLVED');
assert.equal(await readApp518EventGuard({...args,eventId:recovered}),
 'HOLD_EVENT_ALREADY_TERMINAL');
const quarantined=await recordApp518OwnerCollision({
 db,documentId:id,beforeUid:owner,afterUid:other,
 eventId:'uid-change-1',nowMs});
assert.equal(quarantined,'OWNER_QUARANTINE_CREATED');
assert.equal(await readApp518OwnerQuarantine(db,id),true);
assert.equal(await readApp518EventGuard({...args,eventId:'new-B-edit'}),
 'HOLD_OWNER_QUARANTINED');
const after=stats.writes;
assert.equal(await recordApp518OwnerCollision({
 db,documentId:id,beforeUid:owner,afterUid:other,
 eventId:'uid-change-1',nowMs}), 'HOLD_OWNER_QUARANTINED');
assert.equal(stats.writes,after,'duplicate conflict W0');
const ownerKey='server_music_note_owner_quarantine_518/'+hash(['owner',id]);
assert.ok(docs.has(ownerKey));
assert.equal(docs.get(ownerKey).beforeUid,owner);
assert.equal(docs.get(ownerKey).afterUid,other);
// A previously quarantined song must be rejected by the authenticated
// Firebase exact-source callback BEFORE any Firestore favorite read.
const secret='app518-private-server-secret-at-least-32-characters';
const reqBody={action:'exact-source',uid:other,documentId:id};
const signed=signApp518ServiceRequest({
 secret,body:reqBody,nowMs});
const handler=await handleVerifiedApp518ExactSource({
 request:{method:'POST',headers:signed.headers,
  rawBody:Buffer.from(signed.body)},
 db,secret,nowMs,
});
assert.equal(handler.status,409);
assert.equal(handler.code,'DENY_OWNER_QUARANTINED');
assert.equal(stats.writes,after,'quarantine callback W0');
assert.equal(docs.size,4,'one event failure + one terminal + one recovered + one owner fence');
console.log('APP518_FIREBASE_TRANSIENT_FAIL_MAX_8_WITH_DURABLE_TERMINAL=PASS');
console.log('APP518_FIREBASE_EXPIRED_EVENT_NEVER_RETRIES=PASS');
console.log('APP518_FIREBASE_409_TERMINAL_W1_DUPLICATE_W0=PASS');
console.log('APP518_OWNER_UID_CHANGE_PERSISTENT_QUARANTINE_REPLAY_W0=PASS');
console.log('APP518_OWNER_QUARANTINE_BLOCKS_LATER_B_AND_EXACT_CALLBACK=PASS');
// Audit 2026-10-29: broken ledger/owner transactions MUST reject, never
// quietly succeed and accept a lost event. This is a focused static wiring
// guard alongside the executed Firestore transaction simulation above.
const {readFileSync}=require('node:fs');
const sourceCode=readFileSync('functions/src/index.ts','utf8');
const trigger=sourceCode.slice(sourceCode.indexOf('export const app518FavoriteCatalogChanged='));
for(const code of [
 'APP518_OWNER_QUARANTINE_PERSIST_RETRY',
 'APP518_SAFETY_FENCE_READ_RETRY',
 'APP518_EXPIRY_LEDGER_PERSIST_RETRY',
 'APP518_FAILURE_LEDGER_PERSIST_RETRY',
 'APP518_EVENT_ID_OR_TIME_UNVERIFIED',
 'APP518_TERMINAL_LEDGER_NOT_DURABLE',
])assert.ok(trigger.includes('throw new Error("'+code+'")'),code);
for(const code of [
 'APP518_OWNER_QUARANTINE_WRITE_FAILED_STOPPED',
 'APP518_SAFETY_FENCE_UNAVAILABLE_STOPPED',
 'APP518_FAILURE_LEDGER_UNAVAILABLE_STOPPED',
])assert.ok(!trigger.includes(code),'must never swallow '+code);
// A mocked Firestore outage rejects both the exact-owner writer and the
// event read guard. No other-owner update may pass while a fence is unreadable.
const outage={
 collection(){return{doc(){return{
  async get(){throw Error('FIRESTORE_OUTAGE');},
 };}};},
 async runTransaction(){throw Error('FIRESTORE_OUTAGE');},
};
await assert.rejects(readApp518EventGuard({...args,db:outage}),/FIRESTORE_OUTAGE/);
await assert.rejects(recordApp518OwnerCollision({
 db:outage,documentId:'outage-song',beforeUid:owner,
 afterUid:other,eventId:'conflict-io',nowMs,
}),/FIRESTORE_OUTAGE/);
await assert.rejects(recordApp518EventFailure({
 ...args,db:outage,code:'APP518_DELIVERY_IO_FAILURE',terminal:false,
}),/FIRESTORE_OUTAGE/);
console.log('APP518_LEDGER_OUTAGE_FAILS_TRIGGER_CLOSED_NOT_SUCCESS=PASS');
console.log('APP518_UID_QUARANTINE_OUTAGE_NO_SILENT_DROP=PASS');
console.log('APP518_FIREBASE_EVENT_SAFETY_TEST_LIVE_IO=ZERO');

})().catch(error=>{console.error(error);process.exitCode=1;});
