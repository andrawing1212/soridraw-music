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
code += '\nmodule.exports = {publishGuardedLikeIntent420, subscribeGuardedLikeIntent420, planGuardedLikeDecision420};';
const calls = [];
const listeners = [];
const mock = {
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
    return { data: { ok: true, allowed: true, warning: false,
      lockedUntilMs: 0, remainingInWindow: 39, version: 1, duplicate: false } };
  },
};
const module = { exports: {} };
vm.runInNewContext(code, { module, ...mock, console, Date, Number, Error }, { timeout: 1000 });
const { publishGuardedLikeIntent420: publish, subscribeGuardedLikeIntent420: subscribe, planGuardedLikeDecision420: plan } = module.exports;
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
  lockedUntilMs: 0, remainingInWindow: 39, version: 1, duplicate: false };
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
console.log('STAGE420_APP392_CUTOVER_AND_LATENCY=NOT_TESTED');
