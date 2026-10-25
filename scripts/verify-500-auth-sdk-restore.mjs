#!/usr/bin/env node
// app500: real pinned Firebase Auth SDK bootstrap, not source-string simulation.
// No network, actual Firebase account, Firebase project credentials or media.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { protectInitialAuthRestore, getAuthUserStorageKey } from '../src/lib/authRestorePersistence.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('offline Auth SDK fixture: network disabled'); };
const authKey = getAuthUserStorageKey('app500-offline-test', 'app500-sdk-check');
const savedUid = 'test-restored-existing-account';
const originalAccount = {
  uid: savedUid,
  emailVerified: false,
  isAnonymous: false,
  providerData: [],
  stsTokenManager: {
    refreshToken: 'fixture-not-a-credential',
    accessToken: 'fixture-not-an-id-token',
    expirationTime: Date.now() + 3600000,
  },
};
const browserStore = new Map([[authKey, originalAccount]]);
let removals = 0, rejectedWrites = 0, harmlessWarning = 0;
class ExistingLocalAuthPersistence {
  static type = 'LOCAL';
  type = 'LOCAL';
  _shouldAllowMigration = true;
  async _isAvailable() { return true; }
  async _get(key) { return browserStore.get(key) ?? null; }
  async _set(key, value) {
    if (key === authKey && rejectedWrites++ < 1) {
      const error = new Error('quota exceeded at actual restored credential write');
      error.name = 'QuotaExceededError';
      throw error;
    }
    browserStore.set(key, value);
  }
  async _remove(key) { removals++; browserStore.delete(key); }
  _addListener() {}
  _removeListener() {}
}

const app = initializeApp({
  apiKey: 'app500-offline-test',
  appId: 'test-app-id',
}, 'app500-sdk-check');
try {
  const guarded = protectInitialAuthRestore(ExistingLocalAuthPersistence, () => harmlessWarning++);
  const auth = initializeAuth(app, { persistence: guarded.persistence });
  await Promise.race([
    auth.authStateReady(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Auth bootstrap timed out')), 12000)),
  ]);
  guarded.markReady();
  assert.equal(auth.currentUser?.uid, savedUid,
    'real SDK must finish restoring the same UID even when initial user rewrite hits quota');
  assert.equal(browserStore.get(authKey)?.uid, savedUid,
    'old LOCAL authentication key must remain for a previously open browser tab');
  assert.equal(removals, 0, 'Auth initialization must not remove legacy tab credentials');
  assert.equal(harmlessWarning, 1, 'same-UID quota during startup must be handled exactly once');

  const {persistence, markReady} = protectInitialAuthRestore(ExistingLocalAuthPersistence);
  markReady();
  const store = new persistence();
  await assert.rejects(() => store._set(authKey, originalAccount),
    'quota after startup is not a successful persistent credential write');
  assert.equal(browserStore.get(authKey)?.uid, savedUid);

  // A fresh signed-out Auth must still accept explicit memory-only selection.
  // No network signin is needed to verify that SDK remains usable.
  await setPersistence(auth, inMemoryPersistence);
  assert.equal(auth.currentUser?.uid, savedUid, 'SDK must not lose the account unexpectedly');
  console.log('SORIDRAW_APP500_REAL_FIREBASE_AUTH_BOOTSTRAP=PASS');
} finally {
  globalThis.fetch = originalFetch;
  await deleteApp(app);
}
