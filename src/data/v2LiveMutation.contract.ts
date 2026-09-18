import assert from 'node:assert/strict';
import {
  BACKEND_V2_LIVE_MIRROR_RUNTIME_ENABLED,
  BACKEND_V2_MIRROR_RETRY_POLICY,
  assertV2LiveMirrorTarget,
  compareV2MirrorVersion,
  createSoridrawSongId,
  createV2MirrorMutationEnvelope,
  getV2MirrorRetryDelayMs,
  isLegacyV2FavoriteTargetId,
  isLegacyV2RecentPositionalId,
  isSoridrawSongId,
  isV2MirrorRetryExhausted,
  makeV2MirrorMutationId,
  normalizeSoridrawSongId,
} from './v2LiveMutation';

assert.equal(BACKEND_V2_LIVE_MIRROR_RUNTIME_ENABLED, false);

const stableId = createSoridrawSongId(() => '123e4567-e89b-12d3-a456-426614174000');
assert.equal(stableId, 'sd_123e4567e89b12d3a456426614174000');
assert.equal(isSoridrawSongId(stableId), true);
assert.equal(normalizeSoridrawSongId(stableId), stableId);
assert.equal(isSoridrawSongId('sd_not-a-uuid'), false);
assert.throws(() => createSoridrawSongId(() => 'not-a-uuid'), /UUID factory returned an invalid value/);

const legacyFavoriteId = 'v1f_0123456789abcdef0123456789abcdef';
const legacyRecentId = 'v1r_0123456789abcdef0123456789abcdef';
assert.equal(isLegacyV2FavoriteTargetId(legacyFavoriteId), true);
assert.equal(isLegacyV2RecentPositionalId(legacyRecentId), true);
assert.equal(assertV2LiveMirrorTarget('legacyFavorite', legacyFavoriteId), legacyFavoriteId);
assert.throws(
  () => assertV2LiveMirrorTarget('legacyFavorite', legacyRecentId),
  /positional v1r IDs are forbidden/,
);
assert.throws(
  () => assertV2LiveMirrorTarget('soridraw', legacyFavoriteId),
  /invalid soridrawSongId|target kind\/id mismatch/,
);

const envelope = createV2MirrorMutationEnvelope({
  uid: 'user-a',
  targetKind: 'soridraw',
  targetSongId: stableId,
  source: 'recent',
  operation: 'upsert',
  sourceUpdatedAtMs: 1000,
  enqueuedAtMs: 1100,
});
assert.equal(envelope.uid, 'user-a');
assert.equal(envelope.targetSongId, stableId);
assert.equal(envelope.sourceUpdatedAtMs, 1000);
assert.equal(envelope.enqueuedAtMs, 1100);
assert.equal(Object.prototype.hasOwnProperty.call(envelope, 'payload'), false);

const deterministicMutationId = makeV2MirrorMutationId({
  uid: 'user-a',
  targetKind: 'soridraw',
  targetSongId: stableId,
  source: 'recent',
  operation: 'upsert',
  sourceUpdatedAtMs: 1000,
});
assert.equal(envelope.mutationId, deterministicMutationId);
assert.equal(createV2MirrorMutationEnvelope({
  uid: 'user-a',
  targetKind: 'soridraw',
  targetSongId: stableId,
  source: 'recent',
  operation: 'upsert',
  sourceUpdatedAtMs: 1000,
  enqueuedAtMs: 9999,
}).mutationId, deterministicMutationId);

assert.equal(compareV2MirrorVersion({ sourceUpdatedAtMs: 100, mutationId: 'b' }, null), 'apply');
assert.equal(compareV2MirrorVersion(
  { sourceUpdatedAtMs: 101, mutationId: 'a' },
  { sourceUpdatedAtMs: 100, mutationId: 'z' },
), 'apply');
assert.equal(compareV2MirrorVersion(
  { sourceUpdatedAtMs: 99, mutationId: 'z' },
  { sourceUpdatedAtMs: 100, mutationId: 'a' },
), 'stale');
assert.equal(compareV2MirrorVersion(
  { sourceUpdatedAtMs: 100, mutationId: 'same' },
  { sourceUpdatedAtMs: 100, mutationId: 'same' },
), 'duplicate');
assert.equal(compareV2MirrorVersion(
  { sourceUpdatedAtMs: 100, mutationId: 'z' },
  { sourceUpdatedAtMs: 100, mutationId: 'a' },
), 'apply');
assert.equal(compareV2MirrorVersion(
  { sourceUpdatedAtMs: 100, mutationId: 'a' },
  { sourceUpdatedAtMs: 100, mutationId: 'z' },
), 'stale');

assert.equal(getV2MirrorRetryDelayMs(1), 5000);
assert.equal(getV2MirrorRetryDelayMs(2), 10000);
assert.equal(getV2MirrorRetryDelayMs(20), BACKEND_V2_MIRROR_RETRY_POLICY.maxDelayMs);
assert.equal(isV2MirrorRetryExhausted(BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts - 1), false);
assert.equal(isV2MirrorRetryExhausted(BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts), true);

console.log('Backend V2 Step 2-A4a live mutation contract PASS');
