// Proves the two incompatible outcomes of a SAME-DOCUMENT-ONLY revision.
// Successful diagnostics are not product acceptance. Always exits nonzero
// when either legacy physical deletion or delete/recreate protection fails.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildRulesCandidate293, urlFields293, colorFields293 } from './rules-candidate.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080',
  'Refusing to run without the exact local Firestore Emulator');
const requireTools = createRequire(path.resolve(process.env.SORIDRAW_EMULATOR_TOOLS || '.', 'package.json'));
const { initializeTestEnvironment, assertFails, assertSucceeds } = requireTools('@firebase/rules-unit-testing');
const baseline = fs.readFileSync('firestore.rules', 'utf8');
const legacyUrl = 'https://suno.com/song/legacy-fixture';
let checks = 0;
const pass = (label) => { checks++; console.log(`PASS ${label}`); };
const costs = [];

for (const allowProtectedDelete of [false, true]) {
  const env = await initializeTestEnvironment({
    projectId: `demo-issue293-${allowProtectedDelete ? 'allow' : 'deny'}-delete`,
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: buildRulesCandidate293(baseline, { allowProtectedDelete }),
    },
  });
  try {
    const pc = env.authenticatedContext('alice').firestore();
    const mobile = env.authenticatedContext('alice').firestore();
    const other = env.authenticatedContext('bob').firestore();
    const ref = pc.doc('favorites/song');
    await assertSucceeds(ref.set({ uid: 'alice', title: 'Original', sunoUrl: legacyUrl, favoriteColorTag: 'red' }));
    pass('legacy create before opt-in');
    const draft = { baseUrl: 0, updates: { sunoLinks: [{ url: legacyUrl }], sunoShareUrl: legacyUrl } };
    let reads = 0;
    let writes = 0;
    // Transaction fixture: edit-time base stays fixed across retries.
    const settle = async (base, patch) => pc.runTransaction(async (tx) => {
      reads++;
      const data = (await tx.get(ref)).data();
      if ((data.urlRevision293 || 0) !== base) throw new Error('URL_CONFLICT');
      writes++;
      tx.update(ref, { ...patch, urlRevision293: base + 1 });
    });
    await assertSucceeds(settle(0, { sunoLinks: [], sunoShareUrl: null, sunoUrl: null }));
    costs.push({ policy: allowProtectedDelete ? 'allow-delete' : 'deny-delete', operation: 'first URL deletion', sdkReads: reads, sdkWrites: writes });
    assert.equal(reads, 1);
    assert.equal(writes, 1);
    pass('one transaction read and one write, no contention');
    const pending = JSON.stringify(draft);
    await assert.rejects(settle(draft.baseUrl, draft.updates), /URL_CONFLICT/);
    assert.equal(JSON.stringify(draft), pending);
    assert.equal(writes, 1);
    pass('stale edit-time revision rejected; draft unchanged; no additional write');

    await assertSucceeds(ref.update({ favoriteColorTag: null, colorTag: null, colorRevision293: 1 }));
    await assertFails(ref.update({ sunoLinks: [{ url: legacyUrl }], sunoShareUrl: legacyUrl }));
    await assertFails(ref.update({ favoriteColorTag: 'red' }));
    pass('legacy late URL and color resurrection rejected');
    for (const field of urlFields293) {
      await assertFails(ref.update({ [field]: 'old value' }));
    }
    for (const field of colorFields293) {
      await assertFails(ref.update({ [field]: 'red' }));
    }
    pass('protected legacy aliases cannot bypass revisions');
    await assertFails(ref.update({ urlRevision293: 0, sunoShareUrl: legacyUrl }));
    await assertFails(ref.update({ colorRevision293: 0, favoriteColorTag: 'red' }));
    await assertFails(ref.set({ uid: 'alice', sunoUrl: legacyUrl }));
    pass('revision reset and whole-document legacy replacement rejected');

    await assertSucceeds(ref.update({ title: 'Edited', lyrics: { ko: 'lyrics' }, updatedAtMs: 10 }));
    await assertSucceeds(ref.update({ saved: false, favoriteRemoved: true, unsavedAt: 11, isPublic: false }));
    await assertSucceeds(ref.update({ saved: true, favoriteRemoved: false, unsavedAt: null }));
    pass('legacy title/lyrics and save-heart unsave/restore patches permitted');
    await assertFails(other.doc('favorites/song').update({ title: 'wrong owner' }));
    pass('UID isolation');

    // Actual offline SDK queue, not merely an old timestamp fixture.
    await mobile.disableNetwork();
    const queued = mobile.doc('favorites/song').update({ sunoUrl: legacyUrl });
    const rejected = assertFails(queued);
    await mobile.enableNetwork();
    await rejected;
    pass('legacy offline queued URL write denied after reconnect');

    if (allowProtectedDelete) {
      await assertSucceeds(ref.delete());
      await assertSucceeds(ref.set({ uid: 'alice', sunoUrl: legacyUrl, favoriteColorTag: 'red' }));
      const recreated = (await ref.get()).data();
      assert.equal(recreated.sunoUrl, legacyUrl);
      assert.equal(recreated.favoriteColorTag, 'red');
      assert.equal(recreated.urlRevision293, undefined);
      console.log('ACCEPTANCE_FAIL allowing physical delete permits stale recreate/revision reset');
    } else {
      await assertFails(ref.delete());
      console.log('ACCEPTANCE_FAIL denying physical delete blocks existing permanent-delete operation');
    }
  } finally {
    await env.cleanup();
  }
}
console.log(JSON.stringify({ checks, sdkOperationCounts: costs, billedReadsMeasured: false }));
console.log('ISSUE293_SINGLE_DOCUMENT_COMPATIBILITY_GATE=FAIL');
process.exitCode = 1;
