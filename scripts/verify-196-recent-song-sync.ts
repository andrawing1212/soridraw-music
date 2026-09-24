import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { needsRecentSongsServerRead, needsRecentSongsSignalRecheck } from '../src/lib/recentSongsSyncGate';

const gate = (overrides: Record<string, number | boolean> = {}) => ({
  hasLocalCache: true,
  profileVersion: 100,
  localDocumentVersion: 100,
  pendingSignalVersion: 0,
  acknowledgedSignalVersion: 0,
  ...overrides,
});

assert.equal(needsRecentSongsServerRead(gate()), false, 'unchanged cached reentry must read zero');
assert.equal(needsRecentSongsServerRead(gate({ hasLocalCache: false })), true, 'fresh device reads once');
assert.equal(needsRecentSongsServerRead(gate({ profileVersion: 200 })), true, 'new profile revision reads once');
assert.equal(needsRecentSongsServerRead(gate({ pendingSignalVersion: 200 })), true,
  'RTDB 200 cannot be discarded because profile cache still says 100');
assert.equal(needsRecentSongsServerRead(gate({ pendingSignalVersion: 200, acknowledgedSignalVersion: 200 })), false,
  'verified duplicate signal must read zero');
assert.equal(needsRecentSongsSignalRecheck({
  newestSignalVersion: 300, signalVersionAtRead: 200, acknowledgedSignalVersion: 200,
}), true, '300 arriving during 200 read must trigger one bounded follow-up');
assert.equal(needsRecentSongsSignalRecheck({
  newestSignalVersion: 200, signalVersionAtRead: 200, acknowledgedSignalVersion: 200,
}), false, 'unchanged in-flight signal cannot trigger a second read');

const app = readFileSync('src/App.tsx', 'utf8');
const sync = readFileSync('src/services/userDomainSyncService.ts', 'utf8');
for(const marker of [
  'SORIDRAW_RECENT_SONGS_SIGNAL_ACK_196_20260925',
  'needsRecentSongsServerRead({',
  'needsRecentSongsSignalRecheck({',
  'acknowledgeRecentSongsSignalVersion(user.uid, readSignalVersion)',
  'saveRecentSongsCache(user.uid, {',
  'recentSongsSaveInFlightRef.current > 0',
  "recentSongTextWritePendingRef.current?.uid === user.uid",
  "recentReadMutationEpoch !== readRecentSongsMutationEpoch(user.uid)",
  'if (!snap.exists() && Array.isArray(currentCache?.history)',
  'throw e;',
  'Failed to persist completed generation in background:',
]) assert.ok(app.includes(marker), 'Recent-song protection missing: ' + marker);

assert.ok(sync.includes('persistedRecentVersion || now'), 'recent write must publish canonical document version');
assert.ok(sync.includes('rememberRecentSongsPendingSignalVersion(uid, signal.version)'), 'signal must survive off-Studio');
assert.ok(sync.includes('acknowledgeRecentSongsSignalVersion(uid, signal.version)'), 'same-device signal must be acknowledged');
assert.ok(sync.includes("if (kind === 'recentSongs' && result == null) return"), 'mutation epoch skip cannot signal write');

const verification = app.slice(app.indexOf('const runRecentSongsServerSyncIfNeeded'), app.indexOf('const handleRecentSongsVersionSignal'));
assert.ok(verification.indexOf('saveRecentSongsCache(user.uid, {') < verification.indexOf('acknowledgeRecentSongsSignalVersion(user.uid, readSignalVersion)'),
  'ACK must follow local cache save');
assert.equal((verification.match(/getDocFromServer\(ref\)/g) || []).length, 1, 'new signal triggers one bounded document fetch');

console.log('RECENT_SONGS_196_PROFILE_100_RTDB_200=PASS');
console.log('RECENT_SONGS_196_INFLIGHT_200_TO_300=PASS');
console.log('RECENT_SONGS_196_UNCHANGED_R0_W0=PASS');
console.log('RECENT_SONGS_196_LOCAL_GENERATED_RESULT_PROTECTED=PASS');
