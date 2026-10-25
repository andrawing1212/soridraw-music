#!/usr/bin/env node
// app498: deterministic, network-free Auth persistence recovery regression.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const ts = readFileSync('src/lib/authStorageRecovery.ts', 'utf8');
const source = readFileSync('src/App.tsx', 'utf8');
const { code } = await transform(ts, { loader: 'ts', format: 'esm', target: 'es2022' });
const { isRecoverableAuthStorageError: isStorageError, probeAuthStorageCapacity: probe, resolveAuthPersistence: resolve, recoverAuthPersistenceAfterWriteFailure: recoverAfter } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

for (const error of [
  { code: 22 }, { code: '22' }, { code: 1014 },
  { name: 'QuotaExceededError' }, { name: 'SecurityError' },
  { code: 'auth/web-storage-unsupported' },
  { message: 'The storage quota has been exceeded' },
  { cause: { code: 22 } },
]) {
  assert.equal(isStorageError(error), true, `storage error not recognized: ${JSON.stringify(error)}`);
}
for (const error of [
  null, {}, { code: 'auth/unauthorized-domain' },
  { code: 'auth/popup-blocked' }, { code: 'auth/invalid-credential' },
  { code: 'auth/too-many-requests' }, { name: 'TypeError', message: 'network failed' },
]) {
  assert.equal(isStorageError(error), false, `unrelated authentication error swallowed: ${JSON.stringify(error)}`);
}

// app500: IndexedDB remains eligible even if the tiny localStorage
// preference write failed. Only actual Auth storage failure may downgrade.
const attempts = [];
const setMode = async (mode) => { attempts.push(mode); };
assert.equal(await resolve('local', setMode), 'indexeddb');
assert.deepEqual(attempts.splice(0), ['indexeddb']);
assert.equal(await resolve('session', setMode), 'session');
assert.deepEqual(attempts.splice(0), ['session']);

const quota = () => Object.assign(new Error('quota exceeded'), { code: 22 });
assert.equal(await resolve('local', async (mode) => {
  attempts.push(mode);
  if (mode === 'indexeddb') throw quota();
}), 'local');
assert.deepEqual(attempts.splice(0), ['indexeddb', 'local']);

assert.equal(await resolve('local', async (mode) => {
  attempts.push(mode);
  if (mode === 'indexeddb' || mode === 'local') throw quota();
}), 'session');
assert.deepEqual(attempts.splice(0), ['indexeddb', 'local', 'session']);

assert.equal(await resolve('local', async (mode) => {
  attempts.push(mode);
  if (mode !== 'memory') throw quota();
}), 'memory');
assert.deepEqual(attempts.splice(0), ['indexeddb', 'local', 'session', 'memory']);

assert.equal(await resolve('local', setMode, true), 'indexeddb');
assert.deepEqual(attempts.splice(0), ['indexeddb']);
assert.equal(await resolve('local', async (mode) => {
  attempts.push(mode);
  if (mode === 'indexeddb') throw quota();
}, true), 'session');
assert.deepEqual(attempts.splice(0), ['indexeddb', 'session']);

assert.equal(await recoverAfter('indexeddb', setMode), 'local');
assert.deepEqual(attempts.splice(0), ['local']);
assert.equal(await recoverAfter('indexeddb', setMode, true), 'session');
assert.deepEqual(attempts.splice(0), ['session']);
assert.equal(await recoverAfter('local', setMode), 'session');
assert.deepEqual(attempts.splice(0), ['session']);
assert.equal(await recoverAfter('session', setMode), 'memory');
assert.deepEqual(attempts.splice(0), ['memory']);
await assert.rejects(() => recoverAfter('memory', setMode), /No remaining/);
assert.deepEqual(attempts, []);

await assert.rejects(
  () => resolve('local', async (mode) => {
    attempts.push(mode);
    throw Object.assign(new Error('Unauthorized domain'), { code: 'auth/unauthorized-domain' });
  }),
  (error) => error.code === 'auth/unauthorized-domain',
);
assert.deepEqual(attempts.splice(0), ['indexeddb']);

await assert.rejects(
  () => resolve('session', async (mode) => {
    attempts.push(mode);
    throw quota();
  }),
  (error) => error.code === 22,
);
assert.deepEqual(attempts.splice(0), ['session', 'memory']);

await assert.rejects(
  () => recoverAfter('indexeddb', async (mode) => {
    attempts.push(mode);
    throw Object.assign(new Error('Unauthorized domain'), { code: 'auth/unauthorized-domain' });
  }),
  (error) => error.code === 'auth/unauthorized-domain',
);
assert.deepEqual(attempts.splice(0), ['local']);

const existingDraft = new Map([['draft_music_note', 'preserve-user-data']]);
const probeOps = [];
const fakeStore = {
  setItem: (key, value) => { probeOps.push(['set', key, value.length]); existingDraft.set(key, value); },
  removeItem: (key) => { probeOps.push(['remove', key]); existingDraft.delete(key); },
};
probe(fakeStore);
assert.equal(existingDraft.size, 1, 'preflight must remove only its temporary key');
assert.equal(existingDraft.get('draft_music_note'), 'preserve-user-data');
assert.deepEqual(probeOps.map(row => row[0]), ['set', 'remove']);
assert.equal(probeOps[0][2], 4096);

let removedAfterQuota = false;
assert.throws(() => probe({
  setItem: () => { throw quota(); },
  removeItem: () => { removedAfterQuota = true; },
}), (error) => error.code === 22);
assert.equal(removedAfterQuota, false, 'failed preflight must not delete existing keys');

// Source integration protection. This check deliberately inspects only the
// login/persistence owner paths, not unrelated user data/cache behavior.
assert.match(source, /isRecoverableAuthStorageError, probeAuthStorageCapacity, resolveAuthPersistence, type AuthStorageMode/);
assert.match(source, /probeAuthStorageCapacity\(mode === 'local' \? localStorage : sessionStorage\)/);
assert.match(source, /const authPersistenceFallbackModeRef = useRef<AuthStorageMode \| null>\(null\)/);
assert.match(source, /const prepareAuthAttempt = async \(\) => \{/);
assert.match(source, /if \(auth\.currentUser\) return null;/);
assert.match(source, /if \(isRecoverableAuthStorageError\(popupError\)\) \{[\s\S]*?if \(auth\.currentUser\) \{/);
assert.ok(!/signOut\(|localStorage\.clear\(|sessionStorage\.clear\(/.test(source.slice(
  source.indexOf('const prepareAuthAttempt = async'), source.indexOf('const handleLogin = () =>')
)), 'app498 prepareAuthAttempt must not log out existing users or clear browser storage');
assert.ok(!/signOut\(|localStorage\.clear\(|sessionStorage\.clear\(/.test(source.slice(
  source.indexOf('const handleGoogleLogin = async'), source.indexOf('// 3. HANDLE REDIRECT RESULT')
)), 'app498 Google popup error handling must not log out users or erase browser storage');
assert.match(source, /resolveAuthPersistence\(preferredMode, applyAuthPersistence, preferenceStorageFull\)/);
assert.match(source, /if \(isRecoverableAuthStorageError\(popupError\)\) \{/);
assert.match(source, /authPersistenceFallbackModeRef\.current = nextMode/);
assert.match(source, /if \(authPersistenceFallbackModeRef\.current === 'memory'\) \{/);
assert.match(source, /if \(authPersistenceFallbackModeRef\.current === 'memory'\) \{/);
assert.ok(!source.includes('현재 브라우저에서는 로그인 유지 대신 탭 단위로 로그인됩니다.'),
  'Successful session fallback must not show a misleading blocking-style toast');
assert.ok(source.includes('임시 로그인으로 연결되었습니다. 브라우저를 닫으면 다시 로그인해야 할 수 있습니다.'),
  'Memory-only auth must still warn about possible sign-out');
assert.match(source, /const prepareAuthAttempt =[\s\S]*?try \{\s*localStorage\.setItem\('rememberLogin'/);
assert.match(source, /useEffect\(\(\) => \{\s*try \{\s*localStorage\.setItem\('rememberLogin'/);
const authPart = source.slice(source.indexOf('const prepareAuthAttempt = async'), source.indexOf('// 3. HANDLE REDIRECT RESULT'));
assert.ok(!/localStorage\.clear\(|sessionStorage\.clear\(|deleteDatabase\(|caches\.delete\(/.test(authPart),
  'Login recovery must not erase any browser/app cache');

const firebaseSource = readFileSync('src/firebase.js', 'utf8');
assert.ok(firebaseSource.includes('export const auth = getAuth(app);'));
assert.ok(!firebaseSource.includes('setPersistence(auth, initialAuthPersistence)'),
  'startup must never demote a restored account on a missing/blocked preference');
assert.ok(source.includes("mode === 'indexeddb'") && source.includes('indexedDBLocalPersistence'),
  'new sign-ins must try IndexedDB as a durable backend');
assert.ok(source.includes('recoverAuthPersistenceAfterWriteFailure('),
  'a late OAuth credential quota error must try remaining persistent stores');
assert.ok(source.includes('if (auth.currentUser) return null;'),
  'restored accounts must not be migrated without an explicit new login');

console.log('SORIDRAW_APP498_AUTH_STORAGE_RECOVERY=PASS');
console.log('SORIDRAW_APP500_DURABLE_AUTH_QUOTA_RECOVERY=PASS');
