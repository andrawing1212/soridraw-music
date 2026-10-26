import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SOURCE-ONLY compatibility model. This is NOT a Firestore emulator test.
// It proves whether the proposed fence could reject legacy writes, and where
// it still cannot establish causal order. Never touch user data or real Rules.
const read = path => readFileSync(path, 'utf8');
const proposed = read('DOCS/APP514_USER_STRUCTURES_GUARD_CANDIDATE.md');
const liveRules = read('firestore.rules');
const modern = read('src/services/musicNoteFolderStructureBatch.ts');
const page = read('src/pages/FavoritesPage.tsx');
assert.match(proposed, /match \/user_structures\/\{uid\}/);
assert.match(proposed, /afterVersion > beforeVersion/);
assert.match(proposed, /changed\.hasAny\(\['musicNoteFolders'\]\)/);
assert.match(liveRules, /match \/user_structures\/\{uid\} \{\s*allow read, write: if isOwner\(uid\) \|\| isAdmin\(\);/);
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
  if (!Object.hasOwn(before, 'musicNoteStructureVersion')) return true;
  const first = before.musicNoteStructureVersion;
  const next = after.musicNoteStructureVersion;
  const foldersChanged = JSON.stringify(before.musicNoteFolders) !== JSON.stringify(after.musicNoteFolders);
  return Number.isInteger(first) && Number.isInteger(next)
    && next >= first && (!foldersChanged || next > first);
};
const initial = {
  musicNoteStructureVersion: 100001,
  musicNoteFolders: { myNote: [{ id:'f',title:'newer-device' }] },
  musicNoteCardState: { items: { s: { liked: true } } },
};
const oldFolder = legacyMerge(initial, {
  musicNoteStructureVersion:100000, musicNoteFolders:{ myNote:[{id:'f',title:'older-device'}] },
});
assert.equal(candidateAccept(initial, oldFolder), false);
assert.equal(oldFolder.musicNoteFolders.myNote[0].title, 'older-device');
console.log('APP514_LEGACY_STALE_OVERWRITE_DENIED_BY_CANDIDATE_MODEL=PASS');

const futureModern = legacyMerge(initial, {
  musicNoteStructureVersion:100002, musicNoteFolders:{myNote:[{id:'f',title:'newest-device'}]},
});
assert.equal(candidateAccept(initial, futureModern), true);
console.log('APP514_MODERN_STRICT_MONOTONIC_ACCEPT_MODEL=PASS');

const oldCard = legacyMerge(initial, {
  musicNoteStructureVersion:100000, musicNoteCardState:{items:{s:{liked:false}}},
});
assert.equal(candidateAccept(initial,oldCard),false,
  'old card-state writer can be rejected although the folder is unchanged');
console.log('APP514_LEGACY_CARD_WRITE_COMPATIBILITY_REGRESSION_CONFIRMED=PASS');

const legacyHighClock = legacyMerge(initial, {
  musicNoteStructureVersion:200000,
  musicNoteFolders:{myNote:[{id:'f',title:'stale-intent-fast-clock'}]},
});
assert.equal(candidateAccept(initial,legacyHighClock),true,
  'higher device-clock version can still overwrite a newer human intent');
console.log('APP514_HIGH_CLOCK_STALE_CLIENT_NOT_PROTECTED_BY_VERSION_ONLY=PASS');

const oldWithoutVersion = legacyMerge(initial, {
  musicNoteFolders:{myNote:[{id:'f',title:'no-version-old-client'}]},
});
assert.equal(candidateAccept(initial,oldWithoutVersion),false,
  'merge:true retains the old version and changes folders; the proposal rejects it');
console.log('APP514_VERSIONLESS_LEGACY_CLIENT_MUST_UPGRADE=PASS');

// Unrelated documents retain existing paths and rules; the proposed snippet
// cannot be treated as a deployed safeguard.
assert.match(liveRules,/match \/favorites\/\{favoriteId\}/);
assert.match(liveRules,/match \/user_recent_songs\/\{uid\}/);
assert.match(liveRules,/match \/user_playlists\/\{uid\}\/lists\/\{playlistId\}/);
console.log('APP514_LIVE_RULES_UNCHANGED_AND_OTHER_COLLECTIONS_UNTOUCHED=PASS');
