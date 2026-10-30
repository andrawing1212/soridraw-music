import assert from 'node:assert/strict';
import {
 readExactCanonicalWithReceipt518,receiveVerifiedHardDeleteEvent518,
} from '../cloudflare/media-worker/src/catalogHardDeleteSource518.js';
import {parseFirestoreUpdateTimeNs518} from '../cloudflare/media-worker/src/catalogCanonicalFence518.js';
const uid='owner',documentId='song';
const t1='2026-10-28T13:11:07.000000123Z';
const t2='2026-10-28T13:11:08.000000001Z';
const before='2026-10-28T13:11:06.000000111Z';
let favorite={uid,documentId,verifiedByServer:true,exists:false};
let receipt={uid,documentId,verifiedByServer:true,
 deleteEventId:'server-delete-1',updateTime:t1,
 beforeSourceVersionNs:parseFirestoreUpdateTimeNs518(before)};
let receiptReads=0;
const read=()=>readExactCanonicalWithReceipt518({
 uid,documentId,readExactFavorite:async()=>favorite,
 readExactPrivateReceipt:async()=>{receiptReads++;return receipt;},
});
let res=await read();
assert.equal(res.code,'VERIFIED_HARD_DELETE');
assert.equal(res.canonical.state,'removed');
assert.equal(res.canonical.updateTime,t1);
favorite={uid,documentId,verifiedByServer:true,exists:true,
 updateTime:t2, saved:true,item:{id:documentId,uid,title:'resaved'}};
res=await read();
assert.equal(res.code,'VERIFIED_FAVORITE');
assert.equal(res.canonical.state,'saved');
assert.equal(res.canonical.updateTime,t2);
assert.equal(receiptReads,1,'current saved document must not read old receipt');
favorite={uid,documentId,verifiedByServer:true,exists:false};
receipt=null;
assert.equal((await read()).code,'HOLD_NO_VERIFIED_HARD_DELETE_RECEIPT');
receipt={uid,documentId,verifiedByServer:true,deleteEventId:'event',
 updateTime:'2026-02-30T01:00:00Z'};
assert.equal((await read()).code,'HOLD_NO_VERIFIED_HARD_DELETE_RECEIPT');
receipt={uid:'another',documentId,verifiedByServer:true,
 deleteEventId:'event',updateTime:t1};
assert.equal((await read()).code,'HOLD_NO_VERIFIED_HARD_DELETE_RECEIPT');
favorite={uid,documentId,verifiedByServer:false,exists:false};
assert.equal((await read()).code,'DENY_UNVERIFIED_FAVORITE');
// Transactional server delete after which exact owner favorite is still absent.
let w=0;
const db={prepare:()=>({bind(){return {async run(){
 w++;return {meta:{changes:1}};
}};}})};
res=await receiveVerifiedHardDeleteEvent518({
 db,uid,documentId,deleteEventId:'server-event-a',
 beforeOwnerUid:uid,beforeUpdateTime:before,verifiedServerDeleteEvent:true,nowMs:1000,
 transactExactAbsentReceipt:async params=>{
  assert.equal(params.neverRecreateFavorite,true);
  assert.equal(params.requireServerCommitTimestamp,true);
  return {code:'RECEIPT_COMMITTED',provenTransactional:true,ownerVerified:true};
 },
 readExactAfterReceipt:async()=>({
  uid,documentId,verifiedByServer:true,favoriteExists:false,
  receipt:{uid,documentId,deleteEventId:'server-event-a',updateTime:t1,
   beforeSourceVersionNs:parseFirestoreUpdateTimeNs518(before)},
 }),
});
assert.equal(res.code,'ENQUEUED');
assert.equal(res.firestoreReceiptWrites,1);
assert.equal(res.d1Writes,1);
assert.equal(w,1);
res=await receiveVerifiedHardDeleteEvent518({
 db,uid,documentId,deleteEventId:'server-event-a',
 beforeOwnerUid:uid,beforeUpdateTime:before,verifiedServerDeleteEvent:false,nowMs:1000,
 transactExactAbsentReceipt:async()=>{throw Error('unreachable')},
 readExactAfterReceipt:async()=>{throw Error('unreachable')},
});
assert.equal(res.queued,false);assert.equal(w,1);
console.log('APP518_EXACT_CANONICAL_RECEIPT_READ_NO_HARD_DELETE_GUESS=PASS');
console.log('APP518_LATER_SAVE_OVERRIDES_OLD_PRIVATE_RECEIPT=PASS');
console.log('APP518_VERIFIED_DELETE_EVENT_ONLY_D1_ENQUEUE=PASS');
console.log('APP518_NO_LIVE_FIRESTORE_R2_WRITES=PASS');
