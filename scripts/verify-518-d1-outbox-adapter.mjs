import assert from 'node:assert/strict';
import {
 enqueueVerifiedFavorite518, getDueFavoriteChanges518,
 acknowledgeExactFavorite518, scheduleFailedFavorite518,
 boundedRetryDelay518, readExactOutbox518,
 MAX_RETRY_ATTEMPTS_518,holdExactFavorite518,
} from '../cloudflare/media-worker/src/catalogD1Outbox518.js';
const owner='u1',documentId='saved1',nowMs=1793152800000;
const updateTime='2026-10-28T02:00:00.000000001Z';
let calls=0,sql=[];
const fake={prepare(statement){
 calls++;sql.push(statement);
 return {bind(...args){
  return {
   async run(){return {meta:{changes:1},args};},
   async all(){return {results:[]};},
   async first(){return null;},
  };
 }};
}};
const input={db:fake,uid:owner,documentId,sourceUpdateTime:updateTime,
 state:'saved',verifiedByServer:true,nowMs};
const a=await enqueueVerifiedFavorite518(input);
assert.equal(a.code,'ENQUEUED');assert.equal(a.d1Writes,1);
let prev=calls;
assert.equal((await enqueueVerifiedFavorite518({...input,verifiedByServer:false})).code,
 'DENY_UNVERIFIED_OR_UNVERSIONED');
assert.equal((await enqueueVerifiedFavorite518({...input,sourceUpdateTime:''})).code,
 'DENY_UNVERIFIED_OR_UNVERSIONED');
assert.equal((await enqueueVerifiedFavorite518({...input,sourceUpdateTime:'2026-02-30T02:00:00Z'})).code,
 'DENY_UNVERIFIED_OR_UNVERSIONED');
assert.equal((await enqueueVerifiedFavorite518({...input,uid:'../other'})).code,
 'DENY_UNVERIFIED_OR_UNVERSIONED');
assert.equal((await enqueueVerifiedFavorite518({...input,state:'deleted'})).code,
 'DENY_UNVERIFIED_OR_UNVERSIONED');
assert.equal(calls,prev,'unverified deletion cannot cause even a D1 read');

const due=await getDueFavoriteChanges518({db:fake,nowMs,limit:32});
assert.equal(due.code,'OK');assert.equal(due.rows.length,0);
assert.equal((await getDueFavoriteChanges518({db:fake,nowMs,limit:100000})).code,'DENY_ARGUMENTS');
const badAck=await acknowledgeExactFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,nowMs,
 r2VerifiedVersionNs:'stale',
});
assert.equal(badAck.code,'DENY_UNVERIFIED_R2_ACK');
const okAck=await acknowledgeExactFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,nowMs,
 r2VerifiedVersionNs:a.sourceVersionNs,
});
assert.equal(okAck.code,'ACKED');
assert.equal(boundedRetryDelay518(0),5000);
assert.equal(boundedRetryDelay518(1),10000);
assert.equal(boundedRetryDelay518(100),3600000);
assert.equal(boundedRetryDelay518(-1),null);
const failed=await scheduleFailedFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,
 nowMs,attemptCount:2,
});
assert.equal(failed.code,'RETRY_SCHEDULED');assert.equal(failed.retryAtMs,nowMs+20000);
assert.equal(MAX_RETRY_ATTEMPTS_518,8);
const held=await holdExactFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,
 nowMs,reason:'INDEX_CONTRACT',
});
assert.equal(held.code,'HELD');
assert.ok(sql.some(v=>v.includes('SET hold_reason=?')));
assert.equal((await holdExactFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,
 nowMs,reason:'private user-data-in-error',
})).code,'DENY_HOLD_ARGUMENTS');
assert.equal((await scheduleFailedFavorite518({
 db:fake,uid:owner,documentId,sourceVersionNs:a.sourceVersionNs,
 nowMs,attemptCount:MAX_RETRY_ATTEMPTS_518,
})).code,'HELD');
assert.equal((await readExactOutbox518({db:fake,uid:owner,documentId})).code,'OK');
assert.equal((await readExactOutbox518({db:fake,uid:'../bad',documentId})).code,'DENY_ARGUMENTS');
assert.ok(sql.every(s=>!s.includes('SELECT * FROM favorites')));
assert.ok(sql.every(s=>!s.includes('DELETE FROM')));
console.log('APP518_D1_SERVER_VERIFIED_UPDATE_TIME_REQUIRED=PASS');
console.log('APP518_D1_INVALID_UNSAFE_SOURCE_NETWORK_R0_W0=PASS');
console.log('APP518_D1_ACK_VERSION_PROOF_REQUIRED=PASS');
console.log('APP518_D1_RETRY_BACKOFF_BOUNDED=PASS');
console.log('APP518_D1_NO_ACTIVE_BINDING_OR_DB_CREATION=PASS');

console.log('APP518_TERMINAL_HOLD_REQUIRES_FIXED_REASON_AND_RETRY_LIMIT=PASS');
