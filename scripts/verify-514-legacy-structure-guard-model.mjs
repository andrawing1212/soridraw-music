import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SOURCE-ONLY compatibility model. Real Firestore emulator checks live in
// verify-514-legacy-rules-emulator.mjs; this fast model checks the staged
// writer-token gate without touching user data or deploying any Rules.
const read = path => readFileSync(path, 'utf8');
const proposed = read('DOCS/APP514_USER_STRUCTURES_GUARD_CANDIDATE.md');
const liveRules = read('firestore.rules');
const modern = read('src/services/musicNoteFolderStructureBatch.ts');
const page = read('src/pages/FavoritesPage.tsx');
assert.match(proposed, /이전 토큰과 다른 새 토큰/);
assert.match(liveRules, /function safeMusicNoteFolderUpdate\(\)/);
assert.match(liveRules, /nextToken != oldToken/);
assert.match(liveRules, /nextVersion > oldVersion/);
assert.match(modern, /await runTransaction\(db, async \(transaction\)/);
assert.match(modern, /serverVersion >= version/);
assert.match(page, /writeMusicNoteStructureIfNewer\(user\.uid, structureSyncPatch,/);
assert.match(page, /publishMusicNoteStructureDelta\(user\.uid, structureSyncPatch\)/);

// Legacy setDoc(...,{merge:true}) writes a *complete mode array* and a
// proposed local-clock version to the same document. Apply Firestore's merge
// semantics on the represented fields; do not assume current time implies a
// newer user action.
const legacyMerge = (before, patch) => ({
  ...before, ...patch,
  ...(patch.musicNoteFolders ? { musicNoteFolders: { ...(before.musicNoteFolders || {}), ...patch.musicNoteFolders } } : {}),
});
const candidateAccept = (before, after) => {
  const foldersChanged = JSON.stringify(before.musicNoteFolders) !== JSON.stringify(after.musicNoteFolders);
  if (!foldersChanged || !before.musicNoteStructureWriterToken) return true;
  return Number.isFinite(before.musicNoteStructureVersion)
    && Number.isFinite(after.musicNoteStructureVersion)
    && after.musicNoteStructureVersion > before.musicNoteStructureVersion
    && typeof after.musicNoteStructureWriterToken === 'string'
    && after.musicNoteStructureWriterToken.length >= 8
    && after.musicNoteStructureWriterToken !== before.musicNoteStructureWriterToken;
};
const initial = {
  musicNoteStructureVersion: 100001,
  musicNoteStructureWriterToken: 'modern-writer-100001',
  musicNoteFolders: { myNote: [{ id:'f',title:'newer-device' }] },
  musicNoteCardState: { items: { s: { liked: true } } },
};
const oldFolder = legacyMerge(initial, {
  musicNoteStructureVersion:100000, musicNoteFolders:{ myNote:[{id:'f',title:'older-device'}] },
});
assert.equal(candidateAccept(initial, oldFolder), false);
assert.equal(oldFolder.musicNoteFolders.myNote[0].title, 'older-device');
console.log('APP514_LEGACY_STALE_OVERWRITE_DENIED_BY_STAGED_RULE_MODEL=PASS');

const futureModern = legacyMerge(initial, {
  musicNoteStructureVersion:100002,
  musicNoteStructureWriterToken: 'modern-writer-100002',
  musicNoteFolders:{myNote:[{id:'f',title:'newest-device'}]},
});
assert.equal(candidateAccept(initial, futureModern), true);
console.log('APP514_MODERN_FRESH_TOKEN_STRICT_MONOTONIC_ACCEPT_MODEL=PASS');

const oldCard = legacyMerge(initial, {
  musicNoteStructureVersion:100000, musicNoteCardState:{items:{s:{liked:false}}},
});
assert.equal(candidateAccept(initial,oldCard),true,
  'card-only writes remain compatible with long-open older tabs');
console.log('APP514_OLD_CARD_STATE_WRITE_ALLOWED_MODEL=PASS');

const legacyHighClock = legacyMerge(initial, {
  musicNoteStructureVersion:200000,
  musicNoteFolders:{myNote:[{id:'f',title:'stale-intent-fast-clock'}]},
});
assert.equal(candidateAccept(initial,legacyHighClock),false,
  'unchanged writer token blocks a fast-clock stale folder update');
console.log('APP514_HIGH_CLOCK_OLD_FOLDER_BLOCKED_BY_TOKEN_MODEL=PASS');

const oldWithoutVersion = legacyMerge(initial, {
  musicNoteFolders:{myNote:[{id:'f',title:'no-version-old-client'}]},
});
assert.equal(candidateAccept(initial,oldWithoutVersion),false,
  'merge:true retains the modern writer token, so old write is rejected');
console.log('APP514_VERSIONLESS_LEGACY_CLIENT_MUST_UPGRADE=PASS');

// Unrelated collections retain their existing paths and rules.
// Source rules are NOT deployed here.
assert.match(liveRules,/match \/favorites\/\{favoriteId\}/);
assert.match(liveRules,/match \/user_recent_songs\/\{uid\}/);
assert.match(liveRules,/match \/user_playlists\/\{uid\}\/lists\/\{playlistId\}/);
console.log('APP514_STAGED_RULES_SOURCE_AND_OTHER_COLLECTIONS_UNTOUCHED=PASS');
