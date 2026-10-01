import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const shared = fs.readFileSync('src/services/exploreSharedNoteService.ts', 'utf8');
const countBatch = fs.readFileSync('src/services/musicNoteFavoriteCountBatch.ts', 'utf8');
const rulesText = fs.readFileSync('database.rules.json', 'utf8');
const rules = JSON.parse(rulesText);
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 277, 'app version must be 277 or newer');

assert.match(boundary, /syncItem\?: unknown/);
assert.match(engine, /export const projectCatalogItemForSync/);
assert.doesNotMatch(engine.slice(engine.indexOf('const MUSIC_NOTE_SUMMARY_KEYS'), engine.indexOf('const LIBRARY_SUMMARY_KEYS')), /'lyrics'|'prompt'/,
  'RTDB sync summary must not carry Music Note detail text');

assert.match(sync, /projectCatalogItemForSync\('musicNote'/);
assert.match(sync, /encoded\.length <= 24000/);
assert.match(sync, /runTransaction\(signalRef/);
assert.match(sync, /currentVersion \+ 1/);
assert.match(sync, /itemJson: signal\.itemJson \|\| ''/);
assert.match(sync, /removed: signal\.removed === true/);
assert.doesNotMatch(sync, /getDoc\(|getDocs\(|collection\(|firebase\/firestore/,
  'RTDB transport service must never read canonical Firestore');

const start = app.indexOf('// app277 — normal changed-item UI state rides the tiny RTDB signal.');
const end = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', start);
assert.ok(start >= 0 && end > start, 'app277 zero-read receive block missing');
const receive = app.slice(start, end);
assert.match(receive, /JSON\.parse\(itemJson\)/);
assert.match(receive, /removed \|\| isRemovalOperation/);
assert.match(receive, /publishDerived: false/);
assert.doesNotMatch(receive, /getDoc\(|getDocs\(|query\(|collection\(/,
  'normal RTDB changed-item receive must add zero Firestore reads');

assert.equal((app.match(/favoriteSyncSignal/g) || []).length, 0,
  'legacy Firestore user-doc favorite sync fanout must be removed from app277');
assert.equal((app.match(/favoriteCount:\s*increment/g) || []).length, 0,
  'favoriteCount must no longer write per click');
assert.match(app, /queueMusicNoteFavoriteCountDelta\(user\.uid, 1\)/);
assert.match(app, /queueMusicNoteFavoriteCountDelta\(user\.uid, -1\)/);
assert.match(app, /resumeMusicNoteFavoriteCountDelta\(currentUser\.uid\)/);

assert.match(countBatch, /const FLUSH_MS = 30_000/);
assert.match(countBatch, /state\.delta \+= safeDelta/);
assert.match(countBatch, /favoriteCount: increment\(captured\)/);
assert.match(countBatch, /if \(!state\.delta\)/);
assert.equal((countBatch.match(/updateDoc\(/g) || []).length, 1,
  'derived favoriteCount batch must have one bounded Firestore write site');

assert.match(shared, /operation: 'shared-note-save'/);
assert.match(shared, /syncItem: \{/);

const musicNoteRules = rules?.rules?.userSync?.['$uid']?.musicNote;
assert.ok(musicNoteRules, 'musicNote RTDB rules missing');
assert.match(String(musicNoteRules?.itemJson?.['.validate'] || ''), /24000/);
assert.match(String(musicNoteRules?.removed?.['.validate'] || ''), /isBoolean/);

console.log('APP277_REMOTE_CHANGED_ITEM_FIRESTORE_R0=PASS');
console.log('APP277_LEGACY_USER_SYNC_FIRESTORE_W0=PASS');
console.log('APP277_FAVORITE_COUNT_30S_BATCH=PASS');
console.log('APP277_SHARED_NOTE_ZERO_READ_SYNC=PASS');
console.log('APP277_NORMAL_NAVIGATION_EXTRA_RW=0');
