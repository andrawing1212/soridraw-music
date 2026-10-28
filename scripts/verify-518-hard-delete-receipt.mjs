import assert from 'node:assert/strict';
import {settleVerifiedHardDelete518}
 from '../cloudflare/media-worker/src/catalogHardDeleteReceipt518.js';
import {enqueueVerifiedFavorite518} from '../cloudflare/media-worker/src/catalogD1Outbox518.js';
import {parseFirestoreUpdateTimeNs518} from '../cloudflare/media-worker/src/catalogCanonicalFence518.js';
const uid='owner-1',documentId='favorite-1',event='server-event-delete-1';
const receiptTime='2026-10-28T13:11:07.000000123Z';
const savedTime='2026-10-28T13:11:08.000000001Z';
const before='2026-10-28T13:11:06.000000111Z';
const make=()=>{
 let favorite=null,receipt=null,transactions=0,receiptWrites=0;
 const transactExactAbsentReceipt=async({requireReadBeforeWrite,writeOnlyIfFavoriteAbsent,
   requireServerCommitTimestamp,neverRecreateFavorite,deleteEventId,beforeUpdateTime})=>{
  assert.equal(requireReadBeforeWrite,true);
  assert.equal(writeOnlyIfFavoriteAbsent,true);
  assert.equal(requireServerCommitTimestamp,true);
  assert.equal(neverRecreateFavorite,true);
  transactions++;
  if(favorite!==null)return {code:'ACTIVE_FAVORITE',
   provenTransactional:true,ownerVerified:true};
  const gen=parseFirestoreUpdateTimeNs518(beforeUpdateTime);
  if(receipt){
   if(receipt.beforeSourceVersionNs>gen)return {
    code:'STALE_OLDER_DELETE_EVENT',provenTransactional:true,ownerVerified:true};
   if(receipt.beforeSourceVersionNs===gen)return {
    code:receipt.deleteEventId===deleteEventId?'RECEIPT_ALREADY_EXISTS'
      :'HOLD_CONFLICTING_SAME_DELETE_GENERATION',
    provenTransactional:true,ownerVerified:true};
  }
  receipt={uid,documentId,deleteEventId,updateTime:receiptTime,
   beforeSourceVersionNs:gen};
  receiptWrites++;return {code:receiptWrites===1?'RECEIPT_COMMITTED':'RECEIPT_ADVANCED',
   provenTransactional:true,ownerVerified:true};
 };
 const readExactAfterReceipt=async()=>({
  uid,documentId,verifiedByServer:true,favoriteExists:favorite!==null,receipt,
 });
 const run=(more={})=>settleVerifiedHardDelete518({
  uid,documentId,deleteEventId:event,verifiedServerDeleteEvent:true,
  beforeOwnerUid:uid,beforeUpdateTime:before,transactExactAbsentReceipt,readExactAfterReceipt,...more,
 });
 return {run,setFavorite:v=>favorite=v,setReceipt:v=>receipt=v,
  costs:()=>({transactions,receiptWrites})};
};
let t=make();
let r=await t.run();
assert.equal(r.code,'VERIFIED_HARD_DELETE_RECEIPT');
assert.equal(r.allowD1Enqueue,true);assert.equal(r.allowR2Write,false);
assert.equal(r.canonical.state,'removed');
assert.equal(r.canonical.updateTime,receiptTime);
assert.equal(t.costs().receiptWrites,1);
assert.equal((await t.run()).code,'VERIFIED_HARD_DELETE_RECEIPT');
assert.equal(t.costs().receiptWrites,1,'duplicate trigger W0');
// New save wins after old deletion signal; never publish stale removal.
t=make();t.setFavorite({uid,documentId,updateTime:savedTime});
r=await t.run();
assert.equal(r.code,'SKIP_LATEST_FAVORITE_PRESENT');
assert.equal(t.costs().receiptWrites,0);
// Race: absent at transaction, new save immediately after receipt commit,
// before post-commit read: still refuse removal.
t=make();
const original=t.run;
r=await t.run({
 readExactAfterReceipt:async()=>({
  uid,documentId,verifiedByServer:true,favoriteExists:true,
  receipt:{uid,documentId,deleteEventId:event,updateTime:receiptTime,
   beforeSourceVersionNs:parseFirestoreUpdateTimeNs518(before)},
 })
});
assert.equal(r.code,'HOLD_LATER_FAVORITE_WRITE');
assert.equal(r.allowD1Enqueue,false);
// Source can be converted to current D1 outbox version, never before.updateTime
let binds=[];
const db={prepare:()=>({bind(...values){binds.push(values);return {
 async run(){return {meta:{changes:1}};}
}}})};
t=make();
r=await t.run();
const queued=await enqueueVerifiedFavorite518({
 db,uid,documentId,sourceUpdateTime:r.canonical.updateTime,
 state:'removed',verifiedByServer:true,nowMs:2000,
});
assert.equal(queued.code,'ENQUEUED');
assert.equal(binds.length,1);
assert.equal(binds[0][3],'removed');
// Rejected source/owner/event and unverifiable transaction cost zero.
for(const over of [
 {verifiedServerDeleteEvent:false},
 {beforeOwnerUid:'another'},
 {beforeUpdateTime:''},
 {deleteEventId:'../unsafe'},
 {transactExactAbsentReceipt:async()=>({
  code:'RECEIPT_COMMITTED',provenTransactional:false,ownerVerified:true,
 })},
 {readExactAfterReceipt:async()=>({
  uid:'wrong',documentId,verifiedByServer:true,favoriteExists:false,
 })},
 {transactExactAbsentReceipt:async()=>{throw Error('offline')}},
]){
 t=make();
 r=await t.run(over);
 assert.equal(r.allowD1Enqueue,false);
 assert.equal(r.allowR2Write,false);
}
// Second hard delete after a genuine newer re-save advances receipt W1.
// A delayed first event cannot overwrite the latest deletion receipt.
t=make();
r=await t.run();
const second=await t.run({deleteEventId:'server-event-delete-2',
 beforeUpdateTime:savedTime});
assert.equal(second.code,'VERIFIED_HARD_DELETE_RECEIPT');
assert.equal(second.receiptWrites,1);
assert.equal(t.costs().receiptWrites,2);
const stale=await t.run();
assert.equal(stale.allowD1Enqueue,false);
assert.equal(stale.code,'DENY_UNPROVEN_TRANSACTION');
assert.equal(t.costs().receiptWrites,2);
console.log('APP518_SECOND_HARD_DELETE_W1_OLD_EVENT_W0=PASS');
console.log('APP518_HARD_DELETE_PRIVATE_SERVER_COMMIT_RECEIPT=PASS');
console.log('APP518_DUPLICATE_HARD_DELETE_RECEIPT_FIRESTORE_W0=PASS');
console.log('APP518_LATER_SAVE_OVERRIDES_OLD_DELETE_EVENT=PASS');
console.log('APP518_POST_COMMIT_RECHECK_BEFORE_D1_QUEUE=PASS');
console.log('APP518_UNVERIFIED_DELETE_NO_CATALOG_WRITE=PASS');
console.log('APP518_RECEIPT_TEST_REAL_FIRESTORE_WRITES=ZERO');
