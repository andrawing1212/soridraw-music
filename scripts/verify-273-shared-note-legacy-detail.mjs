import assert from 'node:assert/strict';
import fs from 'node:fs';

const cache = fs.readFileSync('src/lib/musicNoteDetailCache.ts', 'utf8');
const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const shared = fs.readFileSync('src/services/exploreSharedNoteService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '273', 'app version must be 273');
assert.match(cache, /const SHARED_NOTE_DETAIL_VERSION = 273;/);
assert.match(cache, /isIncompleteLegacySharedNoteDetail/);
assert.match(cache, /if \(Number\(data\.sharedDetailVersion \|\| 0\) >= SHARED_NOTE_DETAIL_VERSION\) return false;/);
assert.match(cache, /return !promptPresent \|\| !lyricsPresent;/);
assert.match(cache, /if \(isIncompleteLegacySharedNoteDetail\(record\.data\)\) return false;/);
assert.match(page, /legacySharedNoteNeedsHydration273 = isSharedMusicNoteItem\(song\)/);
assert.match(page, /!song\?\.__catalogSummary && !legacySharedNoteNeedsHydration273/);

assert.match(shared, /sharedDetailVersion: 273/);
assert.match(shared, /setDoc\(doc\(db, 'favorites', documentId\), payload, \{ merge: true \}\)/);
assert.match(shared, /scheduleCatalogSnapshotPublishIfDirty\('musicNote', uid, \[catalogItem\]/);
assert.doesNotMatch(shared, /getDocs\(/, 'shared-note save must not add a collection read');
assert.doesNotMatch(shared, /collection\(db, 'favorites'\)/, 'shared-note save must stay single-document');

console.log('APP273_LEGACY_SHARED_NOTE_DETAIL_CACHE_REFRESH=PASS');
console.log('APP273_NEW_SHARED_NOTE_DETAIL_VERSION=PASS');
console.log('APP273_SHARED_NOTE_SAVE_COST_SHAPE=PASS');
