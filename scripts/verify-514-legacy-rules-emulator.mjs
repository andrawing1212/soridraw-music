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
  // The modern B canonical value is already lost here if the trigger archive
  // fails or never runs. This is a deliberate negative deployment gate.
  assert.notEqual((await getDoc(oldPc)).data()?.musicNoteFolders?.myNote?.[0]?.title,
    initial.musicNoteFolders.myNote[0].title);
  console.log('APP515_SINGLE_DOCUMENT_LEGACY_OVERWRITE_ARCHIVE_FAILURE=KNOWN_RISK');
  await assertFails(setDoc(doc(coexistence.authenticatedContext('not-owner').firestore(), path), {
    musicNoteFolders: { myNote: [{ id: 'f', title: 'forged' }] },
  }, { merge: true }));
  console.log('APP514_SHARED_RULES_LEGACY_OWNER_EDIT_ACCEPTED_NONOWNER_DENIED=PASS');
  console.log('APP514_LEGACY_OVERWRITE_REMAINS_A_RELEASE_GATE_NOT_A_PASS=KNOWN_RISK');

// app515 RELEASE-BLOCKED FEASIBILITY PROOF. An old browser always writes
// user_structures/{uid}; a new client COULD write a distinct v2 document.
// A failed/no-op Functions archive can then leave both edits durable.
// This candidate exists in emulator memory ONLY. No app path or live Rules
// are switched, and this test does NOT declare full migration complete.
const separateV2Candidate = liveRules.replace(ownerParent, ownerParent + `
    match /user_structures/{uid}/folder_state/{stateId} {
      allow get: if stateId == 'v2' && isOwner(uid);
      allow list, delete: if false;
      allow create: if stateId == 'v2' && isOwner(uid)
        && request.resource.data.schemaVersion == 2
        && request.resource.data.musicNoteStructureVersion is number
        && request.resource.data.musicNoteStructureVersion > 0
        && request.resource.data.musicNoteStructureWriterToken is string;
      allow update: if stateId == 'v2' && isOwner(uid)
        && request.resource.data.schemaVersion == 2
        && request.resource.data.musicNoteStructureVersion is number
        && request.resource.data.musicNoteStructureVersion > resource.data.musicNoteStructureVersion
        && request.resource.data.musicNoteStructureWriterToken is string
        && request.resource.data.musicNoteStructureWriterToken != resource.data.musicNoteStructureWriterToken;
    }
`);
assert.notEqual(separateV2Candidate, liveRules);
const isolated = await initializeTestEnvironment({
  projectId: 'demo-soridraw-app515-dual-path',
  firestore: { host: '127.0.0.1', port: 8099, rules: separateV2Candidate },
});
try {
  const ownerDb = isolated.authenticatedContext(uid).firestore();
  const legacyPath = doc(ownerDb, path);
  const v2Path = doc(ownerDb, path, 'folder_state', 'v2');
  const otherV2 = doc(isolated.authenticatedContext('not-owner').firestore(),
    path, 'folder_state', 'v2');
  await isolated.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), {
      musicNoteFolders: {
        myNote: [{ id: 'a', title: 'Old PC original' }],
        sharedNote: [{ id: 's', title: 'Shared original' }],
      },
      musicNoteStructureVersion: 99,
    });
  });
  // The new B device saves to its independent document using one W1.
  await assertSucceeds(setDoc(v2Path, {
    schemaVersion: 2, musicNoteStructureVersion: 100001,
    musicNoteStructureWriterToken: 'mobile-b-token-100001',
    musicNoteFolders: {
      myNote: [{ id: 'b', title: 'Mobile B latest' }],
      sharedNote: [{ id: 's', title: 'Shared original' }],
    },
  }));
  // After B commits, long-open old A does its existing legacy setDoc.
  // Simulate COMPLETE archive/Functions failure: NO legacy_recovery write.
  await assertSucceeds(setDoc(legacyPath, {
    musicNoteStructureVersion: 100000,
    musicNoteFolders: { myNote: [{ id: 'a', title: 'PC A unsaved edit' }] },
  }, { merge: true }));
  await assertFails(setDoc(v2Path, {
    schemaVersion: 2, musicNoteStructureVersion: 100000,
    musicNoteStructureWriterToken: 'stale-modern-replay',
    musicNoteFolders: { myNote: [{ id: 'x', title: 'stale modern' }] },
  }, { merge: true }));
  await assertFails(setDoc(v2Path, {
    schemaVersion: 2, musicNoteStructureVersion: 100002,
    musicNoteStructureWriterToken: 'mobile-b-token-100001',
    musicNoteFolders: { myNote: [{ id: 'x', title: 'same token' }] },
  }, { merge: true }));
  const bSaved = (await getDoc(v2Path)).data();
  const aSaved = (await getDoc(legacyPath)).data();
  assert.equal(bSaved?.musicNoteFolders?.myNote?.[0]?.title, 'Mobile B latest');
  assert.equal(aSaved?.musicNoteFolders?.myNote?.[0]?.title, 'PC A unsaved edit');
  assert.equal(aSaved?.musicNoteFolders?.sharedNote?.[0]?.title, 'Shared original');
  await assertFails(getDoc(otherV2));
  await assertFails(setDoc(otherV2, { schemaVersion: 2 }));
  await assertFails(setDoc(doc(isolated.authenticatedContext(uid).firestore(),
    path, 'folder_state', 'v3'), { schemaVersion: 3 }));
  // Even a second legitimate old edit cannot change the newer branch.
  await assertSucceeds(setDoc(legacyPath, {
    musicNoteFolders: { myNote: [{ id: 'a', title: 'PC A final edit' }] },
  }, { merge: true }));
  assert.equal((await getDoc(v2Path)).data()?.musicNoteFolders?.myNote?.[0]?.title,
    'Mobile B latest');
  assert.equal((await getDoc(legacyPath)).data()?.musicNoteFolders?.myNote?.[0]?.title,
    'PC A final edit');
  console.log('APP515_ISOLATED_V2_CANONICAL_SURVIVES_LEGACY_STALE_WRITES_WITHOUT_FUNCTION_ARCHIVE=PASS');
  console.log('APP515_LEGACY_AND_MODERN_EDITS_STORED_SEPARATELY_W1_EACH=PASS');
  // Release is still blocked: new app migration/read/dual-path compare,
  // concurrent modern-new writes, hard 1MiB guards and shared Rules are NOT
  // deployed or connected. Old-vs-old clients still write one legacy document.
} finally {
  await isolated.cleanup();
}

} finally {
  await coexistence.cleanup();
}
