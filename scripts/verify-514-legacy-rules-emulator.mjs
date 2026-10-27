import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

// The deployable shared Rules MUST keep old browsers able to save. Exercise
// the restrictive future design only as an in-memory emulator candidate,
// never by placing that guard in the deployable firestore.rules file.
const liveRules = readFileSync('firestore.rules', 'utf8');
const ownerParent = `    match /user_structures/{uid} {
      allow read, write: if isOwner(uid) || isAdmin();
    }`;
assert.ok(liveRules.includes(ownerParent), 'shared Rules must remain legacy-compatible');
assert.doesNotMatch(liveRules, /function safeMusicNoteFolderUpdate\(\)/);
const guardedParent = `    match /user_structures/{uid} {
      function safeMusicNoteFolderUpdate() {
        let changed = request.resource.data.diff(resource.data).affectedKeys();
        let oldVersion = resource.data.get('musicNoteStructureVersion', 0);
        let nextVersion = request.resource.data.get('musicNoteStructureVersion', 0);
        let oldToken = resource.data.get('musicNoteStructureWriterToken', '');
        let nextToken = request.resource.data.get('musicNoteStructureWriterToken', '');
        return !changed.hasAny(['musicNoteFolders'])
          || oldToken == ''
          || (oldVersion is number && nextVersion is number
            && nextVersion > oldVersion
            && nextToken is string && nextToken.size() >= 8
            && nextToken != oldToken);
      }
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid) || isAdmin();
      allow update: if (isOwner(uid) || isAdmin()) && safeMusicNoteFolderUpdate();
      allow delete: if isOwner(uid) || isAdmin();
    }`;
const rules = liveRules.replace(ownerParent, guardedParent);
assert.match(rules, /function safeMusicNoteFolderUpdate\(\)/);
const uid = 'fixture-app514-owner';
const path = 'user_structures/' + uid;
const env = await initializeTestEnvironment({
  projectId: 'demo-soridraw-app514-guard',
  firestore: { host: '127.0.0.1', port: 8099, rules },
});
const initial = {
  musicNoteStructureVersion: 100001,
  musicNoteStructureWriterToken: 'modern-writer-100001',
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
    musicNoteStructureWriterToken: 'modern-writer-100002',
    musicNoteFolders: { myNote: [{ id: 'f', title: 'new-client' }] } }, { merge: true }));
  assert.equal(await readTitle(), 'new-client');
  console.log('APP514_EMULATOR_FRESH_MODERN_FOLDER_ACCEPTED=PASS');

  await assertSucceeds(setDoc(owner, { musicNoteStructureVersion: 100000,
    musicNoteCardState: { items: { s: { liked: false } } } }, { merge: true }));
  assert.equal((await getDoc(owner)).data()?.musicNoteCardState?.items?.s?.liked, false);
  assert.equal(await readTitle(), 'new-client');
  console.log('APP514_EMULATOR_OLD_CARD_STATE_WRITER_STILL_WORKS=PASS');

  await assertFails(setDoc(owner, {
    musicNoteFolders: { myNote: [{ id: 'f', title: 'versionless-legacy' }] },
  }, { merge: true }));
  console.log('APP514_EMULATOR_VERSIONLESS_OLD_CLIENT_DENIED=PASS');

  await assertFails(setDoc(other, {
    musicNoteStructureVersion: 100003,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'forged' }] },
  }, { merge: true }));
  console.log('APP514_EMULATOR_NONOWNER_DENIED=PASS');

  // Old browser with a fast local clock still has the unchanged modern token.
  // Do not allow it to overwrite the legitimate new folder just by advancing
  // its timestamp-based numeric version.
  await assertFails(setDoc(owner, {
    musicNoteStructureVersion: 200000,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'old-intent-fast-clock' }] },
  }, { merge: true }));
  assert.equal(await readTitle(), 'new-client');
  console.log('APP514_EMULATOR_FAST_CLOCK_OLD_FOLDER_DENIED=PASS');

  // Full modern edit is still accepted even when an old card-only write
  // pushed the legacy numeric version down.
  await assertSucceeds(setDoc(owner, {
    musicNoteStructureVersion: 100001,
    musicNoteStructureWriterToken: 'modern-writer-100003',
    musicNoteFolders: { myNote: [{ id: 'f', title: 'newest-modern' }] },
  }, { merge: true }));
  assert.equal(await readTitle(), 'newest-modern');
  console.log('APP514_EMULATOR_MODERN_AFTER_LEGACY_CARD_ONLY=PASS');

  // Old data with no writer token must remain editable during transition.
  // The owner can only write its own document; simulate a tokenless document
  // on the same owner path after testing the main locked document.
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), {
      musicNoteFolders: { myNote: [{ id: 'f', title: 'tokenless' }] },
      musicNoteStructureVersion: 4,
    });
  });
  await assertSucceeds(setDoc(owner, {
    musicNoteFolders: { myNote: [{ id: 'f', title: 'old-before-upgrade' }] },
    musicNoteStructureVersion: 5,
  }, { merge: true }));
  assert.equal(await readTitle(), 'old-before-upgrade');
  console.log('APP514_EMULATOR_TOKENLESS_EXISTING_USER_NOT_LOCKED=PASS');

  // Immutable archive: trusted trigger/Admin SDK can create, owner can
  // read only after pressing the recovery button; no account can mutate it.
  const archivedPath = path + '/legacy_recovery/' + 'a'.repeat(40);
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), archivedPath), {
      schemaVersion: 1, source: 'legacy-writer-after-modern', observedAtMs: 1000,
      changedModes: ['myNote'],
      beforeFolders: { myNote: [{ id: 'f', title: 'before' }] },
      afterFolders: { myNote: [{ id: 'f', title: 'after' }] },
    });
  });
  const ownerArchive = doc(env.authenticatedContext(uid).firestore(), archivedPath);
  const otherArchive = doc(env.authenticatedContext('not-owner').firestore(), archivedPath);
  assert.equal((await assertSucceeds(getDoc(ownerArchive))).data()?.beforeFolders?.myNote?.[0]?.title, 'before');
  assert.equal((await assertSucceeds(getDocs(collection(
    env.authenticatedContext(uid).firestore(), path, 'legacy_recovery',
  )))).size, 1);
  await assertFails(getDoc(otherArchive));
  await assertFails(getDocs(collection(env.authenticatedContext('not-owner').firestore(), path, 'legacy_recovery')));
  await assertFails(setDoc(ownerArchive, { observedAtMs: 2 }, { merge: true }));
  await assertFails(setDoc(otherArchive, { observedAtMs: 2 }, { merge: true }));
  console.log('APP514_EMULATOR_RECOVERY_OWNER_READ_ONLY_NONOWNER_DENIED=PASS');
  const partPath = archivedPath + '/parts/beforeFolders_myNote_0';
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), partPath), { payload: '[{"id":"default"}]' });
  });
  assert.equal((await assertSucceeds(getDoc(doc(
    env.authenticatedContext(uid).firestore(), partPath,
  )))).data()?.payload, '[{"id":"default"}]');
  await assertFails(getDoc(doc(env.authenticatedContext('not-owner').firestore(), partPath)));
  await assertFails(getDocs(collection(env.authenticatedContext(uid).firestore(), archivedPath, 'parts')));
  await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), partPath), { payload:'forged' }));
  console.log('APP514_EMULATOR_IMMUTABLE_ARCHIVE_SHARD_OWNER_EXACT_READ_ONLY=PASS');

  const favorite = doc(env.authenticatedContext(uid).firestore(), 'favorites/fixture-app514-song');
  await assertSucceeds(setDoc(favorite, { uid, title: 'isolated fake song' }));
  console.log('APP514_EMULATOR_UNRELATED_FAVORITES_WRITE_ALLOWED=PASS');
} finally {
  await env.cleanup();
}
console.log('APP514_EMULATOR_STAGED_FOLDER_FENCE_CANDIDATE_ONLY=PASS');

// The actual deployable shared Rules must accept a legitimate old PC edit,
// even after a modern writer has created a token. The same test also shows
// why we cannot claim legacy-vs-modern freshness is fully resolved yet.
const coexistence = await initializeTestEnvironment({
  projectId: 'demo-soridraw-app514-legacy-live',
  firestore: { host: '127.0.0.1', port: 8099, rules: liveRules },
});
try {
  await coexistence.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), initial);
  });
  const oldPc = doc(coexistence.authenticatedContext(uid).firestore(), path);
  await assertSucceeds(setDoc(oldPc, {
    musicNoteStructureVersion: 100000,
    musicNoteFolders: { myNote: [{ id: 'f', title: 'legitimate-old-PC-save' }] },
  }, { merge: true }));
  assert.equal((await getDoc(oldPc)).data()?.musicNoteFolders?.myNote?.[0]?.title,
    'legitimate-old-PC-save');
  await assertFails(setDoc(doc(coexistence.authenticatedContext('not-owner').firestore(), path), {
    musicNoteFolders: { myNote: [{ id: 'f', title: 'forged' }] },
  }, { merge: true }));
  console.log('APP514_SHARED_RULES_LEGACY_OWNER_EDIT_ACCEPTED_NONOWNER_DENIED=PASS');
  console.log('APP514_LEGACY_OVERWRITE_REMAINS_A_RELEASE_GATE_NOT_A_PASS=KNOWN_RISK');
} finally {
  await coexistence.cleanup();
}
