import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const defaults = { warningPerMinute: 30, limitPerMinute: 40, suspensionMinutes: 120 };
const mockModule = (path, names, context = {}) => {
  let code = stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'strip' });
  code = code.replace(/^import\s+.*?from\s+'[^']+';\s*$/gm, '')
    .replaceAll('export const ', 'const ');
  code += '\nmodule.exports = {' + names.join(',') + '};';
  const module = { exports: {} };
  vm.runInNewContext(code, { module, Number, Math, Date, Error, console, ...context }, { timeout: 1000 });
  return module.exports;
};
const settings = mockModule('functions/src/exploreLikeAbuseSettings420.ts', [
  'DEFAULT_LIKE_ABUSE_SETTINGS_420',
  'validateLikeAbuseSettings420',
  'readLikeAbuseSettings420',
  'overrideCachedLikeAbuseSettings420',
]);
assert.deepEqual({ ...settings.DEFAULT_LIKE_ABUSE_SETTINGS_420 }, defaults);
const custom = settings.validateLikeAbuseSettings420({
  warningPerMinute: 5, limitPerMinute: 6, suspensionMinutes: 60,
});
for (const invalid of [
  { warningPerMinute: 30, limitPerMinute: 29, suspensionMinutes: 120 },
  { warningPerMinute: 30, limitPerMinute: 40, suspensionMinutes: 0 },
  { warningPerMinute: 0, limitPerMinute: 40, suspensionMinutes: 120 },
  { warningPerMinute: 30, limitPerMinute: 9999, suspensionMinutes: 120 },
]) assert.throws(() => settings.validateLikeAbuseSettings420(invalid), /INVALID/);
let reads = 0;
const database = {
  ref: path => ({
    get: async () => {
      assert.equal(path, 'privateLikeSettings420/current');
      reads++;
      return { val: () => null };
    },
  }),
};
const first = await settings.readLikeAbuseSettings420(database, 100_000);
const second = await settings.readLikeAbuseSettings420(database, 100_200);
assert.equal(reads, 1, 'normal click cannot read Master settings again');
assert.deepEqual({ ...first }, defaults);
assert.deepEqual({ ...second }, defaults);
settings.overrideCachedLikeAbuseSettings420(custom);
const third = await settings.readLikeAbuseSettings420(database, Date.now() + 100);
assert.equal(third.limitPerMinute, 6);
assert.equal(reads, 1);

const guard = mockModule('functions/src/exploreLikeAbuseGate420.ts',
  ['publishGuardedLikeSignal420'],
  { DEFAULT_LIKE_ABUSE_SETTINGS_420: defaults },
);
const cache = new Map();
const db = {
  ref: path => ({
    transaction: async update => {
      const current = cache.get(path) || null;
      const result = update(current);
      if (result === undefined) return {
        committed: false, snapshot: { val: () => current },
      };
      cache.set(path, result);
      return { committed: true, snapshot: { val: () => result } };
    },
  }),
};
const epoch = 400 * 60_000;
const mk = n => ({
  trackId: 'track-' + n, ownerUid: 'artist',
  liked: n % 2 === 0,
  operationId: 'eeeeeeee-eeee-4eee-aeee-' + String(n).padStart(12, '0'),
});
// Master settings change during an existing window does not retroactively
// change the quota used by that account in the current minute.
let out = await guard.publishGuardedLikeSignal420(db, 'policy-account', mk(1), epoch + 200);
assert.equal(out.remainingInWindow, 39);
for (let i = 2; i <= 5; i++) {
  out = await guard.publishGuardedLikeSignal420(db, 'policy-account', mk(i), epoch + i * 200, custom);
}
assert.equal(out.warning, false);
assert.equal(out.remainingInWindow, 35);
for (let i = 6; i <= 11; i++) {
  out = await guard.publishGuardedLikeSignal420(db, 'policy-account', mk(i), epoch + 60_000 + (i - 5) * 200, custom);
  assert.equal(out.warning, i >= 10);
}
assert.equal(out.remainingInWindow, 0);
let blocked = await guard.publishGuardedLikeSignal420(db, 'policy-account', mk(12), epoch + 62_000, custom);
assert.equal(blocked.allowed, false);
for (let i = 13; i <= 18; i++) {
  out = await guard.publishGuardedLikeSignal420(db, 'policy-account', mk(i), epoch + 120_000 + (i - 12) * 200, custom);
}
assert.equal(out.lockedUntilMs, epoch + 121_200 + 60 * 60_000,
  'custom Master suspension applies from the next window, not old one');
const functions = readFileSync('functions/src/index.ts', 'utf8');
for (const name of [
  'masterGetExploreLikePolicy420', 'masterSetExploreLikePolicy420',
]) {
  const start = functions.indexOf('export const ' + name + ' = onCall(');
  assert(start > 0, name + ' missing');
  const end = functions.indexOf('\nexport const ', start + 10);
  const section = functions.slice(start, end === -1 ? undefined : end);
  assert.match(section, /requireMasterCaller\(request\)/,
    'Master policy controls must verify role on server');
}
assert.match(functions, /readLikeAbuseSettings420\(database\)/,
  'likes must use the single cached Master policy, not per-click Firestore reads');
console.log('STAGE420_MASTER_SETTINGS_DEFAULT_30_40_120=PASS');
console.log('STAGE420_MASTER_VALIDATION_AND_CACHED_READ=PASS');
console.log('STAGE420_MASTER_POLICY_NEXT_WINDOW_ONLY=PASS');
console.log('STAGE420_MASTER_ONLY_BACKEND_SETTINGS_API=PASS');
console.log('STAGE420_MASTER_UI_AND_LIVE_DEPLOY=NOT_TESTED');
