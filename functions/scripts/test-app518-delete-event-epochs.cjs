// Offline test of the compiled Firebase Admin app518 provider. No real Firebase app.
const assert=require('node:assert/strict');
const {recordHardDeleteApp518,readExactApp518Source}
 =require('../lib/app518CanonicalSourceProvider.js');
const uid='owner',documentId='song-1';
const at=(iso)=>{
 const ms=Date.parse(iso.slice(0,19)+'Z');
 return {seconds:Math.floor(ms/1000),nanoseconds:Number(iso.match(/\.(\d+)Z$/)?.[1]||'0')};
};
const old='2026-10-28T13:11:06.000000111Z';
const saved='2026-10-28T13:11:08.000000001Z';
const laterReceipt='2026-10-28T13:11:09.000000222Z';
let receiptCommitTime='2026-10-28T13:11:07.000000123Z';
let favorite=null,receipt=null,writes=0,transactions=0;
const favoriteRef={kind:'favorite'};
const receiptRef={kind:'receipt'};
const snap=(kind)=>{
 const data=kind==='favorite'?favorite:receipt;
 return {exists:!!data,updateTime:data?.updateTime?at(data.updateTime):undefined,
  data:()=>data?{...data}:undefined};
};
const db={
 collection(name){return {doc(id){
  if(name==='favorites'){assert.equal(id,documentId);return favoriteRef;}
  assert.equal(name,'server_music_note_delete_receipts_518');
  assert.ok(id.length>0);return receiptRef;
 }};},
 async runTransaction(fn){
  transactions++;
  const pending=[];
  const tx={
   get:async ref=>snap(ref.kind),
   create:(ref,value)=>pending.push(['create',ref,value]),
   update:(ref,value)=>pending.push(['update',ref,value]),
  };
  const result=await fn(tx);
  for(const [operation,ref,value] of pending){
   assert.equal(ref,receiptRef);
   if(operation==='create')assert.equal(receipt,null);
   if(operation==='update')assert.ok(receipt);
   receipt={...receipt,...value,
    serverWrittenAt:'SERVER_TIMESTAMP',
    updateTime:receiptCommitTime};
   writes++;
  }
  return result;
 },
};
async function deletion(eventId,beforeUpdateTime,over={}){
 return recordHardDeleteApp518({db,uid,documentId,deleteEventId:eventId,
  beforeOwnerUid:uid,beforeUpdateTime,verifiedServerDeleteEvent:true,...over});
}
(async()=>{
 let result=await deletion('delete-event-1',old);
 assert.equal(result.code,'VERIFIED_DELETE_RECEIPT');
 assert.equal(result.receiptWrite,1);
 assert.equal(writes,1);
 assert.equal((await readExactApp518Source(db,uid,documentId)).source?.updateTime,
  '2026-10-28T13:11:07.000000123Z');
 result=await deletion('delete-event-1',old);
 assert.equal(result.receiptWrite,0);
 assert.equal(writes,1,'duplicate event W0');
 favorite={uid,updateTime:saved,saved:true};
 result=await deletion('delete-event-1',old);
 assert.equal(result.code,'SKIP_NEWER_SAVE_PRESENT');
 assert.equal(writes,1,'later save wins, W0');
 const sourceSaved=await readExactApp518Source(db,uid,documentId);
 assert.equal(sourceSaved.source?.state,'saved');
 assert.equal(sourceSaved.source?.updateTime,saved);
 favorite=null;receiptCommitTime=laterReceipt;
 result=await deletion('delete-event-2',saved);
 assert.equal(result.code,'VERIFIED_DELETE_RECEIPT');
 assert.equal(result.receiptWrite,1);
 assert.equal(writes,2,'second genuine delete advances same receipt W1');
 assert.equal(receipt.deleteEventId,'delete-event-2');
 assert.equal((await readExactApp518Source(db,uid,documentId)).source?.updateTime,
   laterReceipt);
 result=await deletion('delete-event-1',old);
 assert.equal(result.code,'STALE_OLDER_DELETE_EVENT');
 assert.equal(writes,2,'late old delete must not downgrade');
 result=await deletion('delete-other',saved);
 assert.equal(result.code,'HOLD_CONFLICTING_SAME_DELETE_GENERATION');
 assert.equal(writes,2,'same-generation different event W0');
 result=await deletion('delete-event-2',saved);
 assert.equal(result.receiptWrite,0);
 assert.equal(writes,2);
 result=await deletion('bad', 'client-date-wrong');
 assert.equal(result.code,'DENY_UNVERIFIED_DELETE_EVENT');
 assert.equal(writes,2);
 result=await deletion('bad','2026-10-28T13:11:10Z',{beforeOwnerUid:'other'});
 assert.equal(result.code,'DENY_UNVERIFIED_DELETE_EVENT');
 assert.equal(writes,2);
 receipt={uid,documentId,deleteEventId:'legacy-without-version',
  updateTime:'2026-10-28T13:11:11Z'};
 result=await deletion('delete-event-3','2026-10-28T13:11:12Z');
 assert.equal(result.code,'HOLD_UNVERSIONED_RECEIPT');
 assert.equal((await readExactApp518Source(db,uid,documentId)).code,
  'DENY_INVALID_RECEIPT');
 assert.equal(writes,2);
 console.log('APP518_FIREBASE_REAL_PROVIDER_SECOND_HARD_DELETE_EPOCH=PASS');
 console.log('APP518_FIREBASE_REAL_PROVIDER_OLD_EVENT_W0_AND_DUPLICATE_W0=PASS');
 console.log('APP518_FIREBASE_REAL_PROVIDER_LATER_SAVE_WINS=PASS');
 console.log('APP518_FIREBASE_PRIVATE_RECEIPT_ONLY_W1_PER_TRUE_DELETE=PASS');
 console.log('APP518_FIREBASE_PROVIDER_TEST_LIVE_IO=ZERO');
})().catch(e=>{console.error(e);process.exitCode=1;});
