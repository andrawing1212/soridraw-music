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
  assert.equal(await readApp518EventGuard(args),'EVENT_DELIVERY_ALLOWED');
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
console.log('APP518_FIREBASE_EVENT_SAFETY_TEST_LIVE_IO=ZERO');
