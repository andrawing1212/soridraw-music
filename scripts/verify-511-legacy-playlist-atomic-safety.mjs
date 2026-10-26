import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// app511 prevents a dangerous rules-only "fix" from breaking existing users.
// This is a SOURCE CONTRACT + deterministic atomic-batch model, not a
// Firestore emulator or a claim that stale versions are fully solved.
const rules = readFileSync('firestore.rules', 'utf8');
const playlist = readFileSync('src/services/playlistService.ts', 'utf8');
const batch = readFileSync('src/services/libraryPlaylistRevisionBatch.ts', 'utf8');

assert.match(rules, /match \/users\/\{uid\}/);
assert.match(rules, /allow update: if \(isOwner\(uid\) && isValidSelfUpdate\(\)\) \|\| isMaster\(\) \|\| validUserManagerUpdate\(\);/);
assert.ok(!rules.includes('playlistsRevisionNeverDecreases'),
  'A global monotonic guard would reject legacy atomic batches with user edits');

// Legacy/library active writers compose user version and actual song/item
// mutations in ONE atomic commit, not a stand-alone derived-version update.
const mixed = playlist.match(/batch\.update\(doc\(db, 'users', (?:safeUid|uid)\), \{ 'syncVersions\.playlists': syncVersion \}\);/g) || [];
assert.ok(mixed.length >= 6, 'must audit all active mixed legacy batches');
for (const section of ['flushLibraryPlaylistRenameBatch', 'flushLibraryPlaylistOrderBatch', 'addPlaylistItem', 'deletePlaylistItem', 'movePlaylistItem']) {
  const start = playlist.indexOf('export const ' + section);
  assert.ok(start >= 0, 'missing existing canonical operation ' + section);
  const tail = playlist.slice(start, start + 9000);
  assert.match(tail, /batch\.(update|set|delete)\(/, section + ' canonical batch');
  assert.match(tail, /'syncVersions\.playlists': syncVersion/, section + ' compatibility signal in batch');
  assert.match(tail, /await batch\.commit\(\)/, section + ' atomic commit');
}
assert.match(batch, /runTransaction\(db, async \(transaction\)/,
  'app510 modern transaction must remain to protect new-vs-new races');

// Model of a pre-existing external old browser with a 50 revision and its
// canonical playlist edit after another tab has already written revision 51.
const simulate = (enforceMonotonic) => {
  const state = { version: 51, canonicalItem: 'old-title' };
  const proposed = { version: 50, canonicalItem: 'new-title' };
  const accepted = !enforceMonotonic || proposed.version >= state.version;
  if (accepted) Object.assign(state, proposed); // all-or-nothing
  return { accepted, state };
};
const openRules = simulate(false);
const unsafeRules = simulate(true);
assert.equal(openRules.accepted, true);
assert.equal(openRules.state.canonicalItem, 'new-title');
assert.equal(openRules.state.version, 50, 'known remaining legacy downgrade risk');
assert.equal(unsafeRules.accepted, false);
assert.equal(unsafeRules.state.canonicalItem, 'old-title',
  'global rule would silently stop users canonical Library edits');
assert.equal(unsafeRules.state.version, 51);
console.log('APP511_LEGACY_ATOMIC_EDIT_MUST_NOT_BE_REJECTED=PASS');
console.log('APP511_NEW_CLIENT_TRANSACTION_AND_LEGACY_RISK_EXPLICIT=PASS');
console.log('APP511_NO_SHARED_RULES_CHANGE_REQUIRED=PASS');
