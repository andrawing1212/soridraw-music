import assert from 'node:assert/strict';
import {
  BACKEND_V2_BACKFILL_RUNTIME_ENABLED,
  BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED,
  BACKEND_V2_V1_DELETE_RUNTIME_ENABLED,
  assertStep2DScaffoldInert,
  buildV2SongDryRunBatch,
  buildV2SongDryRunPlan,
  buildV2SongPayload,
  evaluateSongIdentity,
  validateV2SongPayloadPreservation,
} from './v2ShadowValidation';

assert.equal(BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED, false);
assert.equal(BACKEND_V2_BACKFILL_RUNTIME_ENABLED, false);
assert.equal(BACKEND_V2_V1_DELETE_RUNTIME_ENABLED, false);
assert.doesNotThrow(() => assertStep2DScaffoldInert());

const sourcePayload = {
  title: 'Keep title',
  lyrics: 'Keep lyrics',
  prompt: 'Keep prompt',
  providerPayload: { nested: true, score: 0 },
  customUnknownField: ['keep', { everything: true }],
  schemaVersion: 1,
};

const plannedPayload = buildV2SongPayload({
  sourcePayload,
  musicNote: true,
  recentVisible: true,
  v2UpdatedAtMs: 1234,
  legacyRecentIndex: 2,
  legacyFavoriteId: 'fav-1',
  legacyFavoriteKey: 'legacy-key-1',
});

assert.equal(plannedPayload.schemaVersion, 2);
assert.equal(plannedPayload.musicNote, true);
assert.equal(plannedPayload.recentVisible, true);
assert.equal(plannedPayload.v2UpdatedAtMs, 1234);
assert.equal(plannedPayload.legacyRecentIndex, 2);
assert.equal(plannedPayload.legacyFavoriteId, 'fav-1');
assert.equal(plannedPayload.legacyFavoriteKey, 'legacy-key-1');
assert.deepEqual(plannedPayload.providerPayload, sourcePayload.providerPayload);
assert.deepEqual(plannedPayload.customUnknownField, sourcePayload.customUnknownField);
assert.equal(validateV2SongPayloadPreservation(sourcePayload, plannedPayload).valid, true);

const changedUnknown = {
  ...plannedPayload,
  providerPayload: { nested: false, score: 0 },
};
const changedValidation = validateV2SongPayloadPreservation(sourcePayload, changedUnknown);
assert.equal(changedValidation.valid, false);
assert.deepEqual(changedValidation.changedSourceFields, ['providerPayload']);

assert.deepEqual(
  evaluateSongIdentity({ explicitCanonicalId: { sourceId: 'song-1', targetId: 'song-1' } }),
  { sameRecord: true, rule: 'explicit-canonical-id' },
);
assert.deepEqual(
  evaluateSongIdentity({
    trustedProviderIdentity: {
      sourceProvider: 'music-api',
      sourceTrackId: 'track-1',
      targetProvider: 'music-api',
      targetTrackId: 'track-1',
    },
  }),
  { sameRecord: true, rule: 'trusted-provider-identity' },
);
assert.deepEqual(
  evaluateSongIdentity({
    trustedLegacyKey: {
      sourceKey: 'legacy-1',
      targetKey: 'legacy-1',
      corroboratedStableIdentity: true,
    },
  }),
  { sameRecord: true, rule: 'trusted-legacy-key-with-corroboration' },
);
assert.deepEqual(
  evaluateSongIdentity({
    trustedLegacyKey: {
      sourceKey: 'legacy-1',
      targetKey: 'legacy-1',
      corroboratedStableIdentity: false,
    },
  }),
  { sameRecord: false, rule: 'no-trusted-match' },
);

const createPlan = buildV2SongDryRunPlan({
  uid: 'user-a',
  targetSongId: 'song-new',
  sourcePayload,
  musicNote: false,
  recentVisible: true,
  v2UpdatedAtMs: 2000,
});
assert.equal(createPlan.action, 'would-create');
assert.equal(createPlan.targetPath, 'users/user-a/songs/song-new');
assert.equal(createPlan.dryRun, true);
assert.equal(createPlan.executable, false);
assert.equal(createPlan.writePerformed, false);

// Same title/lyrics/prompt are never enough to prove identity. Existing target + no trusted evidence must conflict.
const sameContentNoIdentity = buildV2SongDryRunPlan({
  uid: 'user-a',
  targetSongId: 'song-existing',
  sourcePayload,
  musicNote: true,
  recentVisible: true,
  v2UpdatedAtMs: 3000,
  existingTarget: buildV2SongPayload({
    sourcePayload,
    musicNote: true,
    recentVisible: true,
    v2UpdatedAtMs: 3000,
  }),
});
assert.equal(sameContentNoIdentity.identityDecision.sameRecord, false);
assert.equal(sameContentNoIdentity.action, 'conflict-preserve-both');

const exactTrustedTarget = buildV2SongPayload({
  sourcePayload,
  musicNote: true,
  recentVisible: false,
  v2UpdatedAtMs: 4000,
});
const noOpTrusted = buildV2SongDryRunPlan({
  uid: 'user-a',
  targetSongId: 'song-trusted',
  sourcePayload,
  musicNote: true,
  recentVisible: false,
  v2UpdatedAtMs: 4000,
  identityEvidence: {
    explicitCanonicalId: { sourceId: 'song-trusted', targetId: 'song-trusted' },
  },
  existingTarget: exactTrustedTarget,
});
assert.equal(noOpTrusted.action, 'no-op-trusted');

const updateTrusted = buildV2SongDryRunPlan({
  uid: 'user-a',
  targetSongId: 'song-trusted',
  sourcePayload,
  musicNote: true,
  recentVisible: false,
  v2UpdatedAtMs: 5000,
  identityEvidence: {
    explicitCanonicalId: { sourceId: 'song-trusted', targetId: 'song-trusted' },
  },
  existingTarget: exactTrustedTarget,
});
assert.equal(updateTrusted.action, 'would-update-trusted');
assert.equal(updateTrusted.writePerformed, false);

const duplicateBatch = buildV2SongDryRunBatch([
  {
    uid: 'user-a',
    targetSongId: 'dup',
    sourcePayload: { title: 'A' },
    musicNote: false,
    recentVisible: true,
    v2UpdatedAtMs: 1,
  },
  {
    uid: 'user-a',
    targetSongId: 'dup',
    sourcePayload: { title: 'B' },
    musicNote: true,
    recentVisible: false,
    v2UpdatedAtMs: 2,
  },
]);
assert.deepEqual(duplicateBatch.duplicateTargetIds, ['user-a::dup']);
assert.equal(duplicateBatch.writeOperations, 0);
assert.equal(duplicateBatch.summary.conflicts, 2);
assert.equal(duplicateBatch.plans.every((plan) => plan.action === 'conflict-preserve-both'), true);

assert.throws(
  () => buildV2SongPayload({
    sourcePayload,
    musicNote: false,
    recentVisible: false,
    v2UpdatedAtMs: -1,
  }),
  /non-negative integer/,
);

console.log('Backend V2 Step 2-D shadow/validator/dry-run contract PASS');
