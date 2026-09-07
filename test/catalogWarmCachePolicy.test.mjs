import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseWarmCatalogWithoutRemote,
  readCatalogProfileRevision,
  shouldRefreshCatalogForProfile,
} from '../src/lib/catalogWarmCachePolicy.ts';

test('warm restart skips Worker when profile proves local Catalog current', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 500, sessionValidated: false }), true);
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 510, profileRevision: 500, sessionValidated: false }), true);
});

test('unknown profile never promotes cross-session local Catalog by itself', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 0, sessionValidated: false }), false);
});

test('newer profile invalidates warm Catalog', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 501, sessionValidated: false }), false);
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 500, profileRevision: 501 }), true);
});

test('same profile version causes no background Catalog request', () => {
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 500, profileRevision: 500 }), false);
  assert.equal(shouldRefreshCatalogForProfile({ catalogRevision: 510, profileRevision: 500 }), false);
});

test('session-validated local still works when profile token is unavailable', () => {
  assert.equal(canUseWarmCatalogWithoutRemote({ localRevision: 500, profileRevision: 0, sessionValidated: true }), true);
});

test('Music Note revision uses strongest existing invalidation token', () => {
  assert.equal(readCatalogProfileRevision('musicNote', {
    syncVersions: { musicNote: 100 },
    favoriteSyncSignalUpdatedAt: 120,
    favoriteSyncSignal: { at: 110 },
  }), 120);
});

test('Library revision uses library syncVersion only', () => {
  assert.equal(readCatalogProfileRevision('library', {
    syncVersions: { library: 230, musicNote: 999 },
    favoriteSyncSignalUpdatedAt: 888,
  }), 230);
});
