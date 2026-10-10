import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { buildStage420PrivateRulesCandidate } from './build-420-private-rules-candidate.mjs';

// Requires firebase database emulator at 127.0.0.1:9000. No live Firebase
// account, credentials, shared user data, or deployment are ever touched.
const source = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const candidate = buildStage420PrivateRulesCandidate(source);
const environment = await initializeTestEnvironment({
  projectId: 'demo-soridraw-stage420-rules',
  database: {
    host: '127.0.0.1',
    port: 9000,
    rules: JSON.stringify(source),
  },
});
const owner = environment.authenticatedContext('uid-A').database();
const other = environment.authenticatedContext('uid-B').database();
const noUser = environment.unauthenticatedContext().database();
const path = name => owner.ref('userSync/uid-A/' + name);
const expectOldGood = async () => {
  // Existing userSync write grant must support all current six channels,
  // INCLUDING delete. Old clients can use account-private RTDB independently
  // from the experimental server-only like change.
  for (const child of [
    'musicNote', 'recentSongs', 'libraryPlaylist', 'exploreLike',
    'exploreFollow', 'explorePublication',
  ]) {
    await assertSucceeds(path(child).remove());
  }
  await assertFails(other.ref('userSync/uid-A/musicNote').remove());
  await assertFails(noUser.ref('userSync/uid-A/musicNote').remove());
};
try {
  // Source currently allows old client private-like writes; prove the bypass.
  await assertSucceeds(path('exploreLikeIntent416').remove());
  await expectOldGood();
  console.log('STAGE420_EMULATOR_CURRENT_416_DIRECT_WRITE_BYPASS=REPRODUCED');

  await environment.loadDatabaseRules({ rules: JSON.stringify(candidate) });
  await expectOldGood();
  await assertFails(path('exploreLikeIntent416').remove());
  await assertFails(path('exploreLikeIntent416').set({
    version: 1, results: [{
      trackId: 'one', ownerUid: 'artist', liked: true,
      operationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      version: 1, at: Date.now(), status: 'pending',
    }],
  }));
  await assertFails(owner.ref('userSync/uid-A').remove());
  await assertFails(owner.ref('userSync/uid-A/unauthorizedOther').set('bad'));
  await assertFails(owner.ref('privateLikeSync420/uid-A').set({ version: 1 }));
  await assertFails(owner.ref('privateLikeSync420/uid-A').remove());
  // Master-only audit records must never be visible to an ordinary UID.
  // Populate them using bypassRules only inside this demo emulator.
  await environment.withSecurityRulesDisabled(async (adminContext) => {
    await adminContext.database().ref('privateLikeSync420/uid-A').set({
      display: { version: 1, rate: { lockedUntilMs: 0 }, results: [] },
      adminUnlockAudit: [{ actorUid: 'master-secret-uid', reason: 'private reason', at: 12 }],
    });
  });
  await assertFails(owner.ref('privateLikeSync420/uid-A').get());
  await assertFails(owner.ref('privateLikeSync420/uid-A/adminUnlockAudit').get());
  await assertFails(other.ref('privateLikeSync420/uid-A/display').get());
  await assertFails(noUser.ref('privateLikeSync420/uid-A/display').get());
  await assertSucceeds(owner.ref('privateLikeSync420/uid-A/display').get());
  // Legacy confirmed signal 127 and five other channels remain authorized.
  console.log('STAGE420_EMULATOR_DIRECT_LIKE_WRITE_AND_ROOT_DELETE_DENIED=PASS');
  console.log('STAGE420_EMULATOR_SIX_LEGACY_SIGNAL_CHANNELS_AND_UID_ISOLATION=PASS');
  console.log('STAGE420_EMULATOR_SERVER_ONLY_ROOT_READ_PRIVACY=PASS');
  console.log('STAGE420_REAL_SHARED_RULES_DEPLOY=NOT_RUN');
} finally {
  await environment.cleanup();
}
