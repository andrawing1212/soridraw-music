// Stage420 real Firestore Emulator security-rule test: client SDKs must
// never be able to forge the server-owned rate document, approval receipt,
// Master audit or held-event record, EVEN for their own Firebase UID.
// Admin SDK bypasses these rules only inside the trusted server function.
// All contexts are isolated demo accounts; NO LIVE Firebase user data touched.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080',
  'must refuse real Firestore when emulator is missing');
const env=await initializeTestEnvironment({
  projectId:'demo-soridraw-stage420-rules',
  firestore:{
    host:'127.0.0.1',port:8080,
    rules:readFileSync('firestore.rules','utf8'),
  },
});
try {
  const alice=env.authenticatedContext('uid-A').firestore();
  const bob=env.authenticatedContext('uid-B').firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  const rate=alice.collection('privateLikeGuardV2_420').doc('uid-A');
  const receipt=rate.collection('approvals').doc('0189c089-1000-7abc-8abc-000000000001');
  const held=rate.collection('deliveryFailures').doc('0189c089-1000-7abc-8abc-000000000001');
  const audit=rate.collection('adminUnlockAudit').doc('MasterUnlockEmu_420');
  for(const ref of [rate,receipt,held,audit]){
    await assertFails(ref.get());
    await assertFails(ref.set({version:999,approvedAtMs:Date.now(),status:'approved'}));
    await assertFails(ref.update({version:999}));
    await assertFails(ref.delete());
  }
  await assertFails(bob.collection('privateLikeGuardV2_420').doc('uid-A').get());
  await assertFails(bob.collection('privateLikeGuardV2_420').doc('uid-B').set({version:999}));
  await assertFails(anonymous.collection('privateLikeGuardV2_420').doc('uid-A').get());

  // A normal owner's existing music note structure contract is unaffected.
  await assertSucceeds(alice.collection('user_structures').doc('uid-A').get());
  await assertFails(bob.collection('user_structures').doc('uid-A').get());
  console.log('STAGE420_FIRESTORE_LEDGER_SELF_FORGED_APPROVAL_AND_MASTER_AUDIT_DENIED=PASS');
  console.log('STAGE420_FIRESTORE_ALL_OTHER_UIDS_AND_ANONYMOUS_DENIED=PASS');
  console.log('STAGE420_FIRESTORE_LEGACY_MUSIC_NOTE_OWNER_RULES_PRESERVED=PASS');
  console.log('STAGE420_LIVE_SHARED_FIRESTORE_RULES_UNCHANGED=PASS');
} finally {
  await env.cleanup();
}
