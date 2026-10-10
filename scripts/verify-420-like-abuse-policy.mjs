import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

let source = stripTypeScriptTypes(
  readFileSync('src/services/exploreLikeAbusePolicy420.ts', 'utf8'), { mode: 'strip' },
);
source = source.replaceAll('export const ', 'const ');
source += `
module.exports = {
  emptyExploreLikeAbuseState420,
  evaluateExploreLikeAbuseClick420,
  EXPLORE_LIKE_ABUSE_SUSPEND_MS_420,
};`;
const module = { exports: {} };
vm.runInNewContext(source, { module, Math, Error, Number }, { timeout: 1000 });
const { emptyExploreLikeAbuseState420: empty, evaluateExploreLikeAbuseClick420: evaluate,
  EXPLORE_LIKE_ABUSE_SUSPEND_MS_420: twoHours } = module.exports;

const base = 300 * 60_000;
let state = empty();
for (let i = 1; i <= 40; i++) {
  const result = evaluate(state, base + i * 100);
  assert.equal(result.allowed, true, 'the first 40 clicks remain allowed');
  assert.equal(result.warning, i >= 30, 'warn exactly on >=30 in a minute');
  assert.equal(result.remainingInWindow, 40 - i);
  assert.equal(result.newlySuspended, false, 'one capped minute cannot lock for two hours');
  state = result.nextState;
}
let extra = evaluate(state, base + 59_500);
assert.equal(extra.allowed, false, '41st click in same minute blocked');
assert.equal(extra.lockedUntilMs, 0, 'one capped minute cannot force two-hour lock');
const stateAfterReject = state;
assert.equal(extra.nextState, stateAfterReject, 'repeated rejects must not rewrite rate state');

// Same authenticated UID across multiple devices/tabs uses ONE shared state.
for (let i = 1; i <= 40; i++) {
  const device = i % 2 === 0 ? 'PC' : 'mobile';
  const result = evaluate(state, base + 60_000 + i * 100);
  assert.equal(result.allowed, true, device + ' click should use the shared allowance');
  assert.equal(result.newlySuspended, i === 40);
  state = result.nextState;
}
assert.equal(state.lockedUntilMs, base + 60_000 + 4_000 + twoHours,
  'second consecutive capped window must lock for exactly 120 minutes');
assert.equal(evaluate(state, base + 60_000 + 5_000).allowed, false);
assert.equal(evaluate(state, state.lockedUntilMs - 1).allowed, false);
const recovered = evaluate(state, state.lockedUntilMs);
assert.equal(recovered.allowed, true, 'auto unlock at 120-minute deadline');
assert.equal(recovered.warning, false);
assert.equal(recovered.nextState.acceptedInWindow, 1);

// Two busy minutes separated by inactivity are NOT 'consecutive'.
let paused = empty();
for (let i = 0; i < 40; i++) paused = evaluate(paused, base + i * 80).nextState;
for (let i = 0; i < 40; i++) {
  const result = evaluate(paused, base + 3 * 60_000 + i * 80);
  assert.equal(result.newlySuspended, false);
  paused = result.nextState;
}
assert.equal(paused.lockedUntilMs, 0);

// A first-minute warning is not itself a suspension.
let normal = empty();
for (let i = 1; i <= 30; i++) normal = evaluate(normal, base + i * 100).nextState;
assert.equal(normal.acceptedInWindow, 30);
const nextMinute = evaluate(normal, base + 60_100);
assert.equal(nextMinute.allowed, true);
assert.equal(nextMinute.newlySuspended, false);
assert.equal(nextMinute.warning, false);

// Rejected attempts do not erase a preexisting lock or mutate shared state.
const lock = state;
for (let i = 0; i < 100; i++) {
  const result = evaluate(lock, lock.lockedUntilMs - 1000 + i);
  assert.equal(result.allowed, false);
  assert.equal(result.nextState, lock);
}
assert.throws(() => evaluate(empty(), NaN), /trusted/);
assert.throws(() => evaluate(empty(), -1), /trusted/);

// This is NOT a security test: missing parent-level RTDB revocation and a
// server-side atomic owner still let a hostile REST client bypass UX checks.
const rt = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules.userSync.$uid;
assert.equal(rt['.write'], 'auth != null && auth.uid === $uid');
assert.equal(rt.exploreLikeIntent416['.validate'].includes('lockedUntil'), false);
console.log('STAGE420_30_WARN_40_LIMIT=PASS');
console.log('STAGE420_TWO_CONSECUTIVE_MINUTES_LOCK_120_MIN=PASS');
console.log('STAGE420_SAME_UID_TWO_DEVICE_ATOMIC_MODEL=PASS');
console.log('STAGE420_AUTO_RELEASE_AND_UNRELATED_MINUTES=PASS');
console.log('STAGE420_NO_SERVER_ENFORCEMENT_YET=EXPECTED');
