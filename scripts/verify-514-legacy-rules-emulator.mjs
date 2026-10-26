import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Real Firestore emulator, real Rules parser and enforcement. No production
// project/network/data. The source firestore.rules file is NEVER modified.
const proposed = readFileSync('DOCS/APP514_USER_STRUCTURES_GUARD_CANDIDATE.md', 'utf8');
const snippet = proposed.match(/```firestore\s*\n([\s\S]*?)\n```/)?.[1];
assert.ok(snippet, 'candidate snippet is missing');
const original = readFileSync('firestore.rules', 'utf8');
const baseline = `match /user_structures/{uid} {
      allow read, write: if isOwner(uid) || isAdmin();
    }`;
assert.equal(original.split(baseline).length, 2, 'must have one unchanged user_structures rule');
const rules = original.replace(baseline, snippet);
const uid = 'fixture-app514-owner';
const path = 'user_structures/' + uid;
const env = await initializeTestEnvironment({
  projectId: 'demo-soridraw-app514-guard',
  firestore: { host: '127.0.0.1', port: 8099, rules },
});
const initial = {
  musicNoteStructureVersion: 100001,
  musicNoteFolders: { myNote: [{ id: 'f', title: 'canonical-new' }] },
  musicNoteCardState: { items: { s: { liked: true } } },
};
try {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), initial);
  });
  const owner = doc(env.authenticatedContext(uid).firestore(), path);
  const other = doc(env.authenticatedContext('not-owner').firestore(), path);
  const readTitle = async () => (await getDoc(owner)).data()?.musicNoteFolders?.myNote?.[0]?.title;

  await assertFails(setDoc(owner, { musicNoteStructureVersion: 100000,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'stale-old-client' }] } }, { merge: true }));
  assert.equal(await readTitle(), 'canonical-new');
  console.log('APP514_EMULATOR_LEGACY_STALE_FOLDER_DENIED=PASS');

  await assertFails(setDoc(owner, { musicNoteStructureVersion: 100001,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'equal-version-change' }] } }, { merge: true }));
  assert.equal(await readTitle(), 'canonical-new');
  console.log('APP514_EMULATOR_EQUAL_VERSION_FOLDER_DENIED=PASS');

  await assertSucceeds(setDoc(owner, { musicNoteStructureVersion: 100002,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'new-client' }] } }, { merge: true }));
  assert.equal(await readTitle(), 'new-client');
  console.log('APP514_EMULATOR_FRESH_MODERN_FOLDER_ACCEPTED=PASS');

  await assertFails(setDoc(owner, { musicNoteStructureVersion: 100000,
    musicNoteCardState: { items: { s: { liked: false } } } }, { merge: true }));
  console.log('APP514_EMULATOR_OLD_CARD_STATE_WRITER_REJECTED_COMPAT_BLOCKER=PASS');

  await assertFails(setDoc(owner, {
    musicNoteFolders: { myNote: [{ id: 'f', title: 'versionless-legacy' }] },
  }, { merge: true }));
  console.log('APP514_EMULATOR_VERSIONLESS_OLD_CLIENT_DENIED=PASS');

  await assertFails(setDoc(other, {
    musicNoteStructureVersion: 100003,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'forged' }] },
  }, { merge: true }));
  console.log('APP514_EMULATOR_NONOWNER_DENIED=PASS');

  // Confirms the candidate is NOT a complete solution: device-clock version
  // can be higher for an older human intent. Do not activate this rule alone.
  await assertSucceeds(setDoc(owner, {
    musicNoteStructureVersion: 200000,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'old-intent-fast-clock' }] },
  }, { merge: true }));
  assert.equal(await readTitle(), 'old-intent-fast-clock');
  console.log('APP514_EMULATOR_FAST_CLOCK_STALE_INTENT_CAN_OVERWRITE=CONFIRMED_RISK');

  const favorite = doc(env.authenticatedContext(uid).firestore(), 'favorites/fixture-app514-song');
  await assertSucceeds(setDoc(favorite, { uid, title: 'isolated fake song' }));
  console.log('APP514_EMULATOR_UNRELATED_FAVORITES_WRITE_ALLOWED=PASS');
} finally {
  await env.cleanup();
}
console.log('APP514_EMULATOR_CANDIDATE_VALID_BUT_UNSAFE_FOR_LEGACY_RELEASE=PASS');
