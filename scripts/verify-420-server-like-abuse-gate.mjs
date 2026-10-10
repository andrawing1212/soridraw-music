// Isolated Stage420 Firebase Admin transaction contract, NO live RTDB calls.
// This test validates the server-side function and client-facing policy agree,
// but does not claim abuse protection is active until old direct RTDB access
// is revoked safely after account-private rules migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

function loadModule(file, exportedNames) {
  let source = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' });
  source = source.replaceAll('export const ', 'const ');
  source += '\nmodule.exports = {' + exportedNames.join(',') + '};';
  const module = { exports: {} };
  vm.runInNewContext(source, { module, console, Number, Math, Date, Error }, { timeout: 1000 });
  return module.exports;
}
const client = loadModule('src/services/exploreLikeAbusePolicy420.ts', [
  'emptyExploreLikeAbuseState420', 'evaluateExploreLikeAbuseClick420',
]);
const server = loadModule('functions/src/exploreLikeAbuseGate420.ts', [
  'publishGuardedLikeSignal420',
]);
const store = new Map();
const writes = [];
const clone = obj => obj == null ? obj : JSON.parse(JSON.stringify(obj));
const database = {
  ref: path => ({
    transaction: async (update) => {
      const before = clone(store.get(path) || null);
      const next = update(before);
      if (next === undefined) {
        return { committed: false, snapshot: { val: () => clone(before) } };
      }
      writes.push(path);
      store.set(path, clone(next));
      return { committed: true, snapshot: { val: () => clone(next) } };
    },
  }),
};
const base = 400 * 60_000;
const uid = 'account-a';
const mk = number => ({
  trackId: 'track-' + number,
  ownerUid: 'artist-uid',
  liked: number % 2 === 0,
  operationId: 'aaaaaaaa-aaaa-4aaa-aaaa-' + String(number).padStart(12, '0'),
});
let expected = client.emptyExploreLikeAbuseState420();
for (let n = 1; n <= 40; n++) {
  const at = base + n * 100;
  const actual = await server.publishGuardedLikeSignal420(database, uid, mk(n), at);
  const prediction = client.evaluateExploreLikeAbuseClick420(expected, at);
  assert.equal(actual.allowed, prediction.allowed);
  assert.equal(actual.warning, prediction.warning);
  assert.equal(actual.remainingInWindow, prediction.remainingInWindow);
  expected = prediction.nextState;
}
const rejectAt = base + 48_000;
const beforeDenied = writes.length;
const rejected = await server.publishGuardedLikeSignal420(database, uid, mk(41), rejectAt);
assert.equal(rejected.allowed, false);
assert.equal(rejected.lockedUntilMs, 0);
assert.equal(writes.length, beforeDenied, '41st request must not commit another RTDB write');
// Idempotent old same operation is NOT counted twice or charged as a new write.
const duplicate = await server.publishGuardedLikeSignal420(database, uid, mk(40), rejectAt);
assert.equal(duplicate.allowed, true);
assert.equal(duplicate.duplicate, true);
assert.equal(writes.length, beforeDenied);
for (let n = 42; n <= 81; n++) {
  const at = base + 60_000 + (n - 41) * 100;
  const actual = await server.publishGuardedLikeSignal420(database, uid, mk(n), at);
  const prediction = client.evaluateExploreLikeAbuseClick420(expected, at);
  assert.equal(actual.allowed, prediction.allowed);
  assert.equal(actual.lockedUntilMs, prediction.lockedUntilMs);
  expected = prediction.nextState;
}
const locked = store.get('privateLikeSync420/' + uid);
assert.equal(locked.rate.lockedUntilMs, base + 64_000 + 120 * 60_000);
const beforeLocked = writes.length;
const lockedTry = await server.publishGuardedLikeSignal420(
  database, uid, mk(82), locked.rate.lockedUntilMs - 1,
);
assert.equal(lockedTry.allowed, false);
assert.equal(writes.length, beforeLocked);
const restored = await server.publishGuardedLikeSignal420(
  database, uid, mk(83), locked.rate.lockedUntilMs,
);
assert.equal(restored.allowed, true);
assert.equal(restored.lockedUntilMs, 0);
const secondAccount = await server.publishGuardedLikeSignal420(
  database, 'account-b', mk(90), base + 1_000,
);
assert.equal(secondAccount.allowed, true, 'one account must never lock another');
assert(store.get('privateLikeSync420/account-b'));
for (const [invalidUid, bad] of [['', mk(91)], ['account-a', {
  ...mk(92), trackId: '',
}]]) {
  await assert.rejects(server.publishGuardedLikeSignal420(
    database, invalidUid, bad, base + 2_000,
  ), /INVALID_PRIVATE_LIKE_REQUEST/);
}
assert(store.get('privateLikeSync420/account-a').results.length <= 50);
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules;
assert.equal(rules.userSync.$uid['.write'], 'auth != null && auth.uid === $uid');
assert.equal(rules.privateLikeSync420, undefined,
  'new server-only private root intentionally not installed in live rules yet');
console.log('STAGE420_SERVER_30_WARN_40_DENY=PASS');
console.log('STAGE420_SERVER_CONSECUTIVE_120_MIN_AND_RECOVERY=PASS');
console.log('STAGE420_SERVER_DUPLICATE_IDEMPOTENT_AND_UID_ISOLATED=PASS');
console.log('STAGE420_SERVER_ATOMIC_MOCK_POLICY_PARITY=PASS');
console.log('STAGE420_DIRECT_LEGACY_RTDB_REVOKE_REQUIRED=HOLD');
