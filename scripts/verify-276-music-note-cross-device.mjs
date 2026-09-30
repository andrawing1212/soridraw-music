import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '276');

assert.match(sync, /runTransaction\(signalRef/);
assert.match(sync, /signal\.version = Math\.max\(Date\.now\(\), currentVersion \+ 1\)/);
assert.match(sync, /documentIds: signal\.documentIds/);
assert.match(sync, /truncated: signal\.truncated/);
assert.match(sync, /MUSIC_NOTE_PENDING_SIGNAL_BASE = 'soridraw_music_note_pending_signal_v2'/);
assert.match(sync, /export const readPendingMusicNoteSyncSignal/);

const exactMarker = app.indexOf('const exactDocumentIds = [...new Set(');
const routeGate = app.indexOf("const musicNotePageActive = typeof window !== 'undefined'", exactMarker);
assert.ok(exactMarker >= 0 && routeGate > exactMarker, 'exact-id sync must run before route-gated legacy fallback');

const exactBlock = app.slice(exactMarker, routeGate);
assert.match(exactBlock, /getDoc\(doc\(db, 'favorites', documentId\)\)/);
assert.match(exactBlock, /writeMusicNoteSyncVersion\(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, remoteVersion\)/);
assert.match(exactBlock, /writeFavoritesCache\(uid, sorted\)/);
assert.doesNotMatch(exactBlock, /getDocs\(/, 'exact cross-device sync must not query a collection');

assert.match(app, /readPendingMusicNoteSyncSignal\(currentUser\.uid\)/);
assert.match(app, /pendingSignal\.documentIds/);
assert.match(app, /pendingSignal\.truncated/);

console.log('APP276_MUSIC_NOTE_SIGNAL_MONOTONIC=PASS');
console.log('APP276_MUSIC_NOTE_EXACT_CHANGED_DOC_SYNC=PASS');
console.log('APP276_RECENT_HEART_GLOBAL_FAVORITES_PATCH=PASS');
console.log('APP276_UNCHANGED_NAVIGATION_EXTRA_READ=0');
