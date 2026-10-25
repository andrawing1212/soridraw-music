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
  { code: 'auth/unsupported-persistence-type' },
  { message: 'The storage quota has been exceeded' },
  { cause: { code: 22 } },
]) {
  assert.equal(isStorageError(error), true, `storage error not recognized: ${JSON.stringify(error)}`);
}
for (const error of [
  null, {}, { code: 'auth/unauthorized-domain' },
  { code: 'auth/invalid-persistence-type' },
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
assert.match(source, /isRecoverableAuthStorageError, probeAuthStorageCapacity, resolveAuthPersistence, recoverAuthPersistenceAfterWriteFailure, type AuthStorageMode/);
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
assert.ok(!source.includes('현재 브라우저에서는 로그인 유지 대신 탭 단위로 로그인됩니다.'),
  'Successful session fallback must not show a misleading blocking-style toast');
assert.ok(source.includes('로그인은 연결되었지만 이 브라우저에서 장기 저장은 실패했습니다.'),
  'Session and memory auth must both warn remember-login users');
assert.match(source, /const prepareAuthAttempt =[\s\S]*?writeRememberLoginPreference\(rememberLogin\)/);
assert.match(source, /useEffect\(\(\) => \{[\s\S]*?writeRememberLoginPreference\(rememberLogin\);\s*\}, \[rememberLogin\]\)/);
const authPart = source.slice(source.indexOf('const prepareAuthAttempt = async'), source.indexOf('// 3. HANDLE REDIRECT RESULT'));
assert.ok(!/localStorage\.clear\(|sessionStorage\.clear\(|deleteDatabase\(|caches\.delete\(/.test(authPart),
  'Login recovery must not erase any browser/app cache');

const firebaseSource = readFileSync('src/firebase.js', 'utf8');
assert.ok(firebaseSource.includes('export const auth = initializeAuth(app, {'));
assert.ok(!firebaseSource.includes('setPersistence(auth, initialAuthPersistence)'),
  'startup must never demote a restored account on a missing/blocked preference');
assert.ok(source.includes("mode === 'indexeddb'") && source.includes('indexedDBLocalPersistence'),
  'new sign-ins must try IndexedDB as a durable backend');
assert.ok(source.includes('recoverAuthPersistenceAfterWriteFailure('),
  'a late OAuth credential quota error must try remaining persistent stores');
assert.ok(source.includes('if (auth.currentUser) return null;'),
  'restored accounts must not be migrated without an explicit new login');
assert.match(source, /authPersistenceFallbackModeRef\.current = null;\s*authPersistenceActiveModeRef\.current = null;\s*\}, \[rememberLogin\]\)/,
  'changing the remember-login checkbox must discard a prior temporary downgrade');

const emailFlow = source.slice(source.indexOf('const handleEmailAuth = async'),
  source.indexOf('const ensureAuthUserDocument = async'));
assert.ok(emailFlow.includes("authMode === 'login'") && emailFlow.includes('recoverAuthPersistenceAfterWriteFailure('),
  'late email-login quota errors must attempt remaining storage backends');
assert.ok(emailFlow.includes("authMode === 'signup'") && emailFlow.includes('회원가입을 반복하지 말고'),
  'uncertain signup result must never blindly retry remote account creation');
const emailRecovery = emailFlow.slice(emailFlow.indexOf("console.error('Email auth error:'"));
assert.ok(!/signInWithEmailAndPassword\(|createUserWithEmailAndPassword\(|signOut\(|localStorage\.clear\(|sessionStorage\.clear\(/.test(emailRecovery),
  'email quota recovery must not replay credentials, sign out, or clear app data');


const { runInNewContext } = await import('node:vm');
const firebasePreferenceBlock = firebaseSource.slice(firebaseSource.indexOf('const REMEMBER_LOGIN_COOKIE'),
  firebaseSource.indexOf('export const googleProvider ='));
assert.ok(firebasePreferenceBlock.includes('const REMEMBER_LOGIN_COOKIE'));
assert.match(firebasePreferenceBlock, /popupRedirectResolver: browserPopupRedirectResolver/,
  'explicit Auth initializer must retain mobile Google popup/redirect resolver');
assert.match(firebasePreferenceBlock, /\[browserSessionPersistence, indexedDBLocalPersistence, browserLocalPersistence\]/,
  'OFF must initialize SESSION first; Firebase otherwise migrates tab-only credentials to LOCAL');
assert.match(firebasePreferenceBlock, /\[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence\]/,
  'ON must initialize durable IndexedDB first and allow Web local fallback');
assert.ok(!firebasePreferenceBlock.includes('accessToken') && !firebasePreferenceBlock.includes('refreshToken'),
  'functional cookie must never hold Firebase credentials');

const preferenceFixture = ({ initial = {}, blocked = false, cookieInitial = '' } = {}) => {
  const store = new Map(Object.entries(initial));
  const cookieStore = new Map();
  if (cookieInitial) {
    const [key, value] = cookieInitial.split('=');
    cookieStore.set(key, value);
  }
  const browser = {
    localStorage: {
      getItem: key => { if (blocked) throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); return store.has(key) ? store.get(key) : null; },
      setItem: (key, value) => { if (blocked) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); store.set(key, value); },
    },
  };
  const document = {
    get cookie() { return [...cookieStore].map(([k,v]) => k+'='+v).join('; '); },
    set cookie(text) { const [kv] = text.split(';'); const pos = kv.indexOf('='); cookieStore.set(kv.slice(0,pos), kv.slice(pos+1)); },
  };
  const ctx = { window: browser, document, location: { protocol: 'https:' },
    app: {}, indexedDBLocalPersistence: 'indexeddb',
    browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    browserPopupRedirectResolver: 'popup',
    initializeAuth: (_app, deps) => deps,
  };
  return runInNewContext(firebasePreferenceBlock.replace(/export const /g, 'const ')
      + '\n({ auth, readRememberLoginPreference, writeRememberLoginPreference })', ctx);
};
const fromLocalTrue = preferenceFixture({ initial: { rememberLogin: 'true' } });
assert.equal(fromLocalTrue.readRememberLoginPreference(), true);
assert.deepEqual(Array.from(fromLocalTrue.auth.persistence), ['indexeddb','local','session']);
assert.equal(fromLocalTrue.auth.popupRedirectResolver, 'popup');

const fromLocalFalse = preferenceFixture({ initial: { rememberLogin: 'false' } });
assert.equal(fromLocalFalse.readRememberLoginPreference(), false);
assert.deepEqual(Array.from(fromLocalFalse.auth.persistence), ['session','indexeddb','local']);
const brandNew = preferenceFixture();
assert.equal(brandNew.readRememberLoginPreference(), false);
assert.equal(brandNew.auth.persistence[0], 'session');

const quotaButCookieOn = preferenceFixture({
  initial: {rememberLogin:'false'}, blocked: true,
  cookieInitial: 'soridraw_remember_login_v1=1',
});
assert.equal(quotaButCookieOn.readRememberLoginPreference(), true);
assert.equal(quotaButCookieOn.auth.persistence[0], 'indexeddb');
assert.equal(quotaButCookieOn.writeRememberLoginPreference(true), false);
assert.equal(quotaButCookieOn.readRememberLoginPreference(), true,
  'cookie must preserve ON when localStorage write is blocked');
const blockedWithoutCookie = preferenceFixture({blocked:true});
assert.equal(blockedWithoutCookie.readRememberLoginPreference(), true,
  'storage errors are unknown, not an explicit user opt-out');
assert.equal(blockedWithoutCookie.auth.persistence[0], 'indexeddb');
const recovered = preferenceFixture({initial:{rememberLogin:'false'}});
assert.equal(recovered.writeRememberLoginPreference(true), true);
assert.equal(recovered.readRememberLoginPreference(), true);
assert.equal(recovered.writeRememberLoginPreference(false), true);
assert.equal(recovered.readRememberLoginPreference(), false);

assert.match(source, /authPersistenceActiveModeRef.current === 'session'[\s\S]*?authPersistenceActiveModeRef.current === 'memory'/,
  'both temporary fallback modes must be disclosed for remember-login ON');
console.log('SORIDRAW_APP500_PREFERENCE_RESTORE_POLICY=PASS');

console.log('SORIDRAW_APP498_AUTH_STORAGE_RECOVERY=PASS');
console.log('SORIDRAW_APP500_DURABLE_AUTH_QUOTA_RECOVERY=PASS');
