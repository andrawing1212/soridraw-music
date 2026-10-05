import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patch = readFileSync('cloudflare/explore-worker/patches/082-like-d1only-route.mjs', 'utf8');
for (const required of [
  "proof172?.proofAuthority === 'release-controller-174'",
  "proof172?.legacyIntakeClosed === true",
  "proof172?.legacyProcessorIdle === true",
  "proof172?.allEnvironmentWorkerShaVerified === true",
  "proof172?.d1AtomicFenceReady === true",
  "proof172?.d1FenceTable === 'explore_like_cutover_control_174'",
  "proof172?.d1FencePhase === 'frozen'",
  "proof172?.d1FenceEpoch",
  "proof172?.d1FenceFrozenAt",
  "proof172?.approvedWorkerSha256",
  "proof172?.workerSha256ByEnvironment",
  "proof172?.workerVersionByEnvironment",
  "proof172?.workerMarkerReadyByEnvironment",
  "proof172?.d1OnlySchemaOwnerReady === true",
  "Number(proof172?.d1OnlyHotSecondaryIndexes) === 0",
  "proof172?.relationTable === 'explore_like_overrides_171'",
  "proof172?.countTable === 'explore_like_count_deltas_171'",
  "proof172?.ownerProtocol === 'd1-only-171'",
]) {
  assert.ok(patch.includes(required), 'final 082 gate missing: ' + required);
}
assert.equal(patch.includes("proof172?.proofAuthority === 'release-controller-173'"), false);
assert.equal(patch.includes('proof172?.drainQuiescenceMs'), false);
assert.equal(patch.includes('proof172?.queueStablePasses'), false);

const fencePatch = readFileSync(
  'cloudflare/explore-worker/patches/084-like-d1-atomic-cutover-fence.mjs', 'utf8'
);
for (const required of [
  "phase = 'open'",
  "phase IN ('open', 'draining')",
  "phase = 'frozen'",
  'env.DB.batch([',
  'await assertD1OnlyFrozen174(env);',
]) {
  assert.ok(fencePatch.includes(required), '174 product fence missing: ' + required);
}

const migration = readFileSync(
  'cloudflare/explore-worker/migrations/20260922_01_explore_like_cutover_control_v174_additive.sql',
  'utf8',
);
assert.match(migration, /174 freeze requires drained queues and idle processor/);
assert.match(migration, /174 frozen phase is forward-only/);
assert.match(migration, /explore_like_cutover_control_174_frozen_guard/);

console.log('174_FINAL_MARKER_REQUIRES_D1_FROZEN_PROOF=PASS');
console.log('174_ELAPSED_TIME_PROOF_NO_LONGER_AUTHORIZES_CUTOVER=PASS');
console.log('174_D1_SCHEMA_ENFORCES_FREEZE_PRECONDITIONS=PASS');
