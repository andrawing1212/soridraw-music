import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

let code = stripTypeScriptTypes(
  readFileSync('src/services/exploreLikeGuardedTransport420.ts', 'utf8'),
  { mode: 'strip' },
);
code = code.replace(/^import\s+.*?from\s+'[^']+';\s*$/gm, '')
  .replaceAll('export const ', 'const ');
assert(!/^import\s/m.test(code));
code += '\nmodule.exports = {publishGuardedLikeIntent420, subscribeGuardedLikeIntent420, planGuardedLikeDecision420, submitGuardedOutboxCandidate420, renewGuardedLikePermitCandidate420, recoverGuardedLikePermitCandidate420};';
const calls = [];
const listeners = [];
const permit420 = 'v1.dGVzdC1wZXJtaXQ.aGVhZGVyLXNpZw';
let nextReply = null;
let rejectNetwork = false;
let rejectPublishOnly = false;
let recoveryResponse = {ok:true,recovered:false};
const lockQueues = new Map();
const browserNavigator = {
  locks: {
    request: async (name, opts, callback) => {
      assert.equal(opts.mode, 'exclusive');
      const previous = lockQueues.get(name) || Promise.resolve();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const current = previous.then(() => gate);
      lockQueues.set(name, current);
      await previous;
      try { return await callback(); }
      finally {
        release();
        if (lockQueues.get(name) === current) lockQueues.delete(name);
      }
    },
  },
};
const mock = {
  settleGuardedOutbox420: (sent, reply, read, commit, notify) => {
    const state = read();
    if (!state.latest || state.latest.operationId !== sent.operationId)
      return { action: 'superseded', canFlush: false };
    if (!reply || (reply.allowed && !reply.guardPermit420))
      return { action: 'await-reply', canFlush: false };
    if (!reply.allowed && !state.evidence)
      return { action: 'await-proof', canFlush: false };
    const decision = reply.allowed
      ? { action: 'approved', canFlush: true, guardPermit420: reply.guardPermit420 }
      : { action: 'rollback', canFlush: false, liked: state.evidence.liked, evidenceVersion: state.evidence.version };
    commit(decision);
    notify(decision);
    return decision;
  },
  functions: {},
  realtimeDb: {},
  databaseRef: (_db, path) => path,
  onValue: (path, handler) => {
    listeners.push({ path, handler });
    handler({ val: () => null }); // initial cold replay
    return () => { listeners.length = 0; };
  },
  httpsCallable: (_fn, name) => async (args) => {
    calls.push({ name, args });
    if (rejectNetwork || (rejectPublishOnly && name === 'publishExploreLikeIntent420')) {
      throw new Error('NETWORK_ERROR');
    }
    if (name === 'recoverExploreLikePermit420') return {data:recoveryResponse};
    return { data: nextReply || { ok: true, allowed: true, warning: false,
      lockedUntilMs: 0, remainingInWindow: 39, version: 1, duplicate: false,
      guardPermit420: permit420 } };
  },
};
const module = { exports: {} };
vm.runInNewContext(code, { module, ...mock, navigator:browserNavigator, console, Date, Number, Error }, { timeout: 1000 });
const { publishGuardedLikeIntent420: publish, subscribeGuardedLikeIntent420: subscribe, planGuardedLikeDecision420: plan, submitGuardedOutboxCandidate420: submit } = module.exports;
const mutation = {
  trackId: 'track-1',
  ownerUid: 'artist-1',
  liked: true,
  operationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
};
const decision = await publish(mutation);
assert.equal(decision.allowed, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'publishExploreLikeIntent420');
assert.equal('uid' in calls[0].args, false, 'caller never supplies a privileged UID');
assert.equal(listeners.length, 0, 'publisher must not spawn a subscriber or a direct RTDB transaction');
await assert.rejects(publish({ ...mutation, operationId: 'bad' }), /INVALID_GUARDED_LIKE_REQUEST/);
// Network result may arrive after one or many subsequent clicks.
const latest = { ...mutation, desiredLiked: mutation.liked };
const accepted = { ok: true, allowed: true, warning: false,
  lockedUntilMs: 0, remainingInWindow: 39, version: 1, duplicate: false,
  guardPermit420: permit420 };
const denied = { ...accepted, allowed: false, remainingInWindow: 0 };
assert.equal(plan(mutation, latest, accepted), 'retain-canonical-pending',
  'private delivery acceptance is not canonical settlement');
assert.equal(plan(mutation, latest, denied), 'reject-matching-only');
assert.equal(plan(mutation, latest, null), 'retain-unconfirmed',
  'a network error is not proof of denial');
assert.equal(plan(mutation, null, denied), 'ignore-superseded');
for (const newer of [
  { ...latest, operationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' },
  { ...latest, desiredLiked: !latest.desiredLiked },
  { ...latest, trackId: 'other-track' },
  { ...latest, ownerUid: 'different-owner' },
]) {
  assert.equal(plan(mutation, newer, denied), 'ignore-superseded',
    'stale Function denial must not erase newer click');
}
// The candidate send-and-settle adapter never touches a canonical batch
// before a specific authenticated callable acceptance.
const pending = { uid:'uid-a', trackId:mutation.trackId, ownerUid:mutation.ownerUid,
  desiredLiked:mutation.liked, operationId:mutation.operationId,
  baseLiked:false, updatedAt:1000,guardStatus:'awaiting' };
let persisted = [];
const commits = [];
let currentPending = pending;
const reader = () => ({ latest:currentPending,
  evidence:{ uid:'uid-a',trackId:mutation.trackId,liked:false,
    source:'verified-local-baseline',version:7 } });
const markFirstAttempt = sent => {
  if (!currentPending || currentPending.operationId !== sent.operationId ||
      currentPending.updatedAt !== sent.updatedAt ||
      currentPending.guardAttempt420 === 'sent-unconfirmed' ||
      currentPending.guardStatus !== 'awaiting') return false;
  currentPending = { ...currentPending, guardAttempt420: 'sent-unconfirmed' };
  return true;
};
const save = decision => { persisted.push(decision.action); commits.push('persist'); };
const repaint = () => { assert.equal(commits[commits.length - 1],'persist'); commits.push('paint'); };
nextReply = denied;
let actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'rollback');
assert.deepEqual(commits,['persist','paint']);
currentPending = {...pending,operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'};
commits.length = 0; persisted = [];
actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'superseded','late rejected response must not roll back new click');
assert.equal(commits.length,0);
currentPending = pending;
nextReply = accepted;
actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'approved');
assert.equal(actual.guardPermit420,permit420);
assert.equal(currentPending.guardAttempt420,'sent-unconfirmed');
const callsBeforeLostAckReplay = calls.length;
actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'await-reply','original ACK loss must never republish same operation');
assert.equal(calls.length,callsBeforeLostAckReplay,'51-event eviction must not convert a sent click into a fresh rate write');
// Two concurrent tabs share the same browser lock and outbox storage.
// Only the first should reach the rate-controlled Firebase Callable.
currentPending=pending;
nextReply=accepted;
const beforeConcurrent=calls.filter(c => c.name === 'publishExploreLikeIntent420').length;
const concurrent=await Promise.all([
  submit(pending,reader,save,repaint,markFirstAttempt),
  submit(pending,reader,save,repaint,markFirstAttempt),
]);
assert.deepEqual(concurrent.map(v => v.action).sort(),['approved','await-reply']);
assert.equal(
  calls.filter(c => c.name === 'publishExploreLikeIntent420').length - beforeConcurrent,
  1, 'two simultaneous tabs must not double-publish a first click',
);
assert.equal(lockQueues.size,0,'browser lock must be released even on second-tab refusal');
// If safe inter-tab coordination is unsupported, fail closed: do not send.
currentPending=pending;
const savedLocks=browserNavigator.locks;
browserNavigator.locks=undefined;
const beforeUnsupported=calls.length;
const unsupported=await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(unsupported.action,'await-reply');
assert.equal(calls.length,beforeUnsupported);
assert.equal(currentPending.guardAttempt420,undefined,'no marker when no network send');
browserNavigator.locks=savedLocks;
// Failed durable storage cannot authorize a network send either.
const beforeFailedStorage=calls.length;
const failedStorage=await submit(pending,reader,save,repaint,()=>false);
assert.equal(failedStorage.action,'await-reply');
assert.equal(calls.length,beforeFailedStorage);
// A newer local operationId supersedes a stale first attempt in another tab.
currentPending={...pending,operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'};
const beforeNewer=calls.length;
const staleAttempt=await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(staleAttempt.action,'superseded');
assert.equal(calls.length,beforeNewer);
currentPending=pending;
nextReply = {...accepted, guardPermit420:undefined};
commits.length=0;
await assert.rejects(publish(mutation),/INVALID_GUARDED_LIKE_RESPONSE/);
actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'await-reply',
  'a callable allowed response without a certificate must not write canonical');
assert.equal(commits.length,0);
// Renewal of exact approved outbox MUST call the proof-only endpoint, never
// the initial-rate endpoint. A stale/newer click is not overwritten.
nextReply = {ok:true,renewed:true,guardPermit420:permit420};
const approved = {...pending,guardStatus:'approved',guardPermit420:permit420};
const callCount = calls.length;
const freshToken = await module.exports.renewGuardedLikePermitCandidate420({
  trackId:mutation.trackId,liked:true,operationId:mutation.operationId,
},permit420);
assert.equal(freshToken,permit420);
assert.equal(calls[callCount].name,'renewExploreLikePermit420');
assert.equal('uid' in calls[callCount].args,false);
currentPending=approved;
actual=await submit(approved,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'approved');
assert.equal(calls.at(-1).name,'renewExploreLikePermit420');
assert.equal(calls.at(-1).args.operationId,mutation.operationId);
assert.equal(calls.at(-1).args.previousGuardPermit420,permit420);
const beforeMissing=calls.length;
actual=await submit({...approved,guardPermit420:undefined},reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'await-reply');
assert.equal(calls.length,beforeMissing,'missing proof must not fall back to new-click endpoint');
nextReply = accepted;
currentPending=pending;
rejectNetwork = true;
commits.length = 0;
actual = await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'await-reply','network error must keep unapproved outbox');
assert.equal(commits.length,0);
rejectNetwork = false; nextReply = null;
// Genuine first ACK loss: server already has an exact approved row.
// Recovery must not call publish a second time or mutate canonical storage.
currentPending=pending;
nextReply=accepted;
rejectPublishOnly=true;
recoveryResponse={ok:true,recovered:true,guardPermit420:permit420};
const beforeExactRecovery=calls.length;
actual=await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'approved');
assert.deepEqual(calls.slice(beforeExactRecovery).map(c=>c.name),[
  'publishExploreLikeIntent420','recoverExploreLikePermit420',
]);
assert.equal('uid' in calls.at(-1).args,false,'server UID comes from Firebase auth');
assert.equal(calls.at(-1).args.operationId,pending.operationId);
assert.equal(currentPending.guardAttempt420,'sent-unconfirmed');
// Approval record missing/51st eviction: client MUST retain the durable row,
// and MUST NOT silently turn the old click into a new rate transaction.
currentPending=pending;
recoveryResponse={ok:true,recovered:false};
const beforeEvicted=calls.length;
actual=await submit(pending,reader,save,repaint,markFirstAttempt);
assert.equal(actual.action,'await-reply');
assert.deepEqual(calls.slice(beforeEvicted).map(c=>c.name),[
  'publishExploreLikeIntent420','recoverExploreLikePermit420',
]);
assert.equal(currentPending.guardAttempt420,'sent-unconfirmed');
rejectPublishOnly=false;
const incoming = [];
const off = subscribe('uid-a', (row) => incoming.push(row));
assert.equal(listeners.length, 1);
assert.equal(listeners[0].path, 'privateLikeSync420/uid-a/display');
assert.equal(incoming.length, 0, 'cold retained unconfirmed hints cannot paint canonical state');
const event = { ...mutation, version: 1, status: 'pending', at: Date.now() };
listeners[0].handler({ val: () => ({ version: 1, results: [event] }) });
assert.equal(incoming.length, 1);
assert.equal(incoming[0].trackId, 'track-1');
listeners[0].handler({ val: () => ({ version: 1, results: [event] }) });
assert.equal(incoming.length, 1, 'duplicate event must not repaint');
const stale = { ...mutation, trackId: 'old-track', version: 2, at: Date.now() - 60_000, status: 'pending' };
listeners[0].handler({ val: () => ({ version: 2, results: [stale] }) });
assert.equal(incoming.length, 1, 'stale replay cannot repaint a private heart');
off();
assert.equal(listeners.length, 0);
const functionCode = readFileSync('functions/src/index.ts', 'utf8');
assert.match(functionCode, /export const publishExploreLikeIntent420 = onCall\(/);
const rulesBuilder = readFileSync('scripts/build-420-private-rules-candidate.mjs', 'utf8');
assert.match(rulesBuilder, /'adminUnlockAudit': \{ '\.read': false \}/,
  'Master audit must stay inaccessible to app users');
assert.doesNotMatch(code, /runTransaction|set\(|update\(/,
  'guarded transport must not reintroduce a direct private RTDB write');
console.log('STAGE420_GUARDED_CALLABLE_NO_DIRECT_RTDATABASE_WRITE=PASS');
console.log('STAGE420_SERVER_ONLY_DISPLAY_AND_ADMIN_AUDIT_ISOLATION=PASS');
console.log('STAGE420_PROVISIONAL_PRIVATE_HEART_REPLAY_GUARD=PASS');
console.log('STAGE420_STALE_REJECTION_AND_NETWORK_UNKNOWN_OUTBOX_GUARD=PASS');
console.log('STAGE420_GUARDED_SEND_SETTLE_CANDIDATE_NO_DIRECT_FALLBACK=PASS');
console.log('STAGE420_MISSING_SIGNED_PERMIT_STAYS_UNAPPROVED=PASS');
console.log('STAGE420_APP392_CUTOVER_AND_LATENCY=NOT_TESTED');

console.log('STAGE420_DORMANT_APPROVED_RENEWAL_NO_RATE_REPLAY=PASS');
console.log('STAGE420_MISSING_PROOF_RENEWAL_FAIL_CLOSED=PASS');
console.log('STAGE420_EXACT_FIRST_ACK_LOSS_BOUNDED_RECOVERY_NO_REPUBLISH=PASS');
console.log('STAGE420_EVICTED_PROOF_FAIL_CLOSED=PASS');
console.log('STAGE420_DURABLE_FIRST_SEND_MARKER_REPLAY_W0_GUARD=PASS');
console.log('STAGE420_CROSSTAB_FIRST_SEND_EXCLUSIVE_LEASE=PASS');
console.log('STAGE420_MISSING_LOCK_OR_STORAGE_FAIL_CLOSED=PASS');
