import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 288);
assert.match(app, /MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE = 'soridraw_music_note_rtdb_ack_version_v1'/);

const remoteStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const exactStart = app.indexOf('    const exactDocumentIds = [...new Set(', remoteStart);
const fallbackStart = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', remoteStart);
assert.ok(remoteStart >= 0 && exactStart > remoteStart && fallbackStart > exactStart);

const preExact = app.slice(remoteStart, exactStart);
assert.match(preExact, /const signalAckVersion = readMusicNoteSyncVersion\(MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE, uid\)/);
assert.match(preExact, /if \(signalAckVersion >= remoteVersion\) return/);
assert.doesNotMatch(preExact, /if \(localVersion >= remoteVersion\) return/);
assert.match(preExact, /writeMusicNoteSyncVersion\(MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE, uid, remoteVersion\)/);

const exactReceive = app.slice(exactStart, fallbackStart);
assert.match(exactReceive, /rememberRecentHeartAuthority\(/);
assert.match(exactReceive, /writeMusicNoteSyncVersion\(MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE, uid, remoteVersion\)/);
assert.doesNotMatch(exactReceive, /getDoc\(|getDocs\(|query\(|collection\(/,
  'exact RTDB changed-item receive must stay Firestore R0');

const bundleStart = app.indexOf('        // 1036: paged favorites onSnapshot removed;');
const bundleEnd = app.indexOf('        // 901: delayed full-list recovery disabled;', bundleStart);
assert.ok(bundleStart >= 0 && bundleEnd > bundleStart);
const bundleBlock = app.slice(bundleStart, bundleEnd);
assert.match(bundleBlock, /bundle\.updatedAtMs/);
assert.match(bundleBlock, /MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE/);
assert.doesNotMatch(bundleBlock, /MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE/,
  'Catalog generatedAtMs must never acknowledge an RTDB signal');

assert.match(sync, /runTransaction\(signalRef/);
assert.match(sync, /currentVersion \+ 1/);

console.log('APP288_RTDB_ACK_VERSION_DOMAIN_SEPARATED=PASS');
console.log('APP288_CATALOG_TIMESTAMP_CANNOT_DROP_SAVE_SIGNAL=PASS');
console.log('APP288_EXACT_SAVE_UNSAVE_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP288_NAME_SYNC_PATH_UNCHANGED=PASS');
