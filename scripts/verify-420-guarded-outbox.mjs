// Source-only Stage420 state-machine test. No Firebase/Worker/network calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const file = 'src/services/exploreLikeGuardedOutbox420.ts';
let source = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' });
source = source.replaceAll('export const ', 'const ');
source += '\nmodule.exports={resolveGuardedOutbox420,canFlushGuardedOutbox420,settleGuardedOutbox420};';
const module = { exports: {} };
vm.runInNewContext(source, { module, Number, Error }, { timeout: 2000 });
const { resolveGuardedOutbox420: resolve, canFlushGuardedOutbox420: flush, settleGuardedOutbox420: settle } = module.exports;
const sent = { uid:'account-a',trackId:'track-a',ownerUid:'artist-a',
  desiredLiked:true,operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  baseLiked:false,updatedAt:1234,guardStatus:'awaiting' };
const proof = {uid:sent.uid,trackId:sent.trackId,liked:false,
  source:'verified-personal-snapshot',version:10 };
const permit = {ok:true,allowed:true,lockedUntilMs:0,
  guardPermit420:'v1.dGVzdC1wZXJtaXQ.aGVhZGVyLXNpZw' };
const deny = {...permit,allowed:false};
assert.equal(flush(sent),false,'pending authorization cannot create canonical batch');
assert.equal(flush({...sent,guardStatus:'approved'}),false,
  'the server approval flag alone cannot grant a canonical write');
assert.equal(flush({...sent,guardStatus:'approved',
  guardPermit420:permit.guardPermit420}),true);
const result = (latest,reply,evidence) => resolve(sent,latest,reply,evidence);
assert.equal(result(sent,null,proof).action,'await-reply','unknown response preserves outbox');
assert.equal(result(sent,permit,proof).action,'approved');
assert.equal(result(sent,permit,proof).guardPermit420,permit.guardPermit420);
assert.equal(result(sent,{...permit,guardPermit420:undefined},proof).action,'await-reply',
  'a missing signed Worker permit must not approve canonical intake');
assert.equal(result(sent,deny,null).action,'await-proof','never infer truth from public likes');
assert.equal(result(sent,deny,{...proof,uid:'another'}).action,'await-proof');
assert.equal(result(sent,deny,{...proof,trackId:'other'}).action,'await-proof');
assert.equal(result(sent,deny,{...proof,version:-1}).action,'await-proof');
assert.equal(result(sent,deny,{...proof,source:'untrusted-public-count'}).action,'await-proof',
  'public counters are not personal proof');
assert.equal(result(sent,{...permit,ok:false},proof).action,'await-reply',
  'invalid callable replies cannot approve canonical batches');
assert.equal(result(sent,deny,proof).action,'rollback');
assert.equal(result(sent,deny,proof).liked,false);
for (const mutation of [
  {...sent,operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'},
  {...sent,desiredLiked:false},
  {...sent,updatedAt:1235},
  {...sent,uid:'another'},
  {...sent,trackId:'other'},
  {...sent,ownerUid:'another'},
  null,
]) {
  assert.equal(result(mutation,deny,proof).action,'superseded',
    'stale denied response must not erase latest intent');
}
let current = {latest:sent,evidence:proof};
const order = [];
const committed = [];
const invoke = reply => settle(sent,reply,()=>{order.push('read');return current;},
  decision=>{order.push('persist');committed.push(decision.action);},
  decision=>{assert.equal(order[order.length-1],'persist');order.push('notify');});
assert.equal(invoke(null).action,'await-reply');
assert.deepEqual(order,['read']);
order.length=0;
assert.equal(invoke(deny).action,'rollback');
assert.deepEqual(order,['read','persist','notify'],'persist must precede UI notification');
assert.deepEqual(committed,['rollback']);
order.length=0;
current = {latest:{...sent,desiredLiked:false},evidence:proof};
assert.equal(invoke(deny).action,'superseded');
assert.deepEqual(order,['read'],'superseded response must not persist or repaint');
order.length=0;
current = {latest:sent,evidence:proof};
assert.equal(invoke(permit).action,'approved');
assert.deepEqual(order,['read','persist','notify']);
console.log('STAGE420_GUARDED_OUTBOX_APPROVAL_ONLY_FLUSH=PASS');
console.log('STAGE420_SIGNED_PERMIT_REQUIRED_BEFORE_CANONICAL=PASS');
console.log('STAGE420_UNKNOWN_OR_NO_PROOF_RETAINS_OUTBOX=PASS');
console.log('STAGE420_LATE_DENIAL_NEVER_REMOVES_NEWER_INTENT=PASS');
console.log('STAGE420_SAME_UID_EXACT_CANONICAL_ROLLBACK=PASS');
console.log('STAGE420_PERSIST_BEFORE_UI_NOTIFY=PASS');
console.log('STAGE420_APP392_CLIENT_WIRING_AND_REAL_QA=NOT_TESTED');
