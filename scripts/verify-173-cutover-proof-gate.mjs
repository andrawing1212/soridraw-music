import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateD1OnlyPreCutoverProof173,
  LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173,
} from '../cloudflare/explore-worker/scripts/like-d1only-precutover-proof-173.mjs';

const patch = readFileSync('cloudflare/explore-worker/patches/082-like-d1only-route.mjs', 'utf8');
for (const required of [
  "proof172?.proofAuthority === 'release-controller-173'",
  "Number(proof172?.queueStablePasses) === 2",
  "proof172?.legacyProcessorIdle === true",
  "proof172?.allEnvironmentWorkerShaVerified === true",
  "proof172?.d1OnlySchemaOwnerReady === true",
  "Number(proof172?.d1OnlyHotSecondaryIndexes) === 0",
  "proof172?.relationTable === 'explore_like_overrides_171'",
  "proof172?.countTable === 'explore_like_count_deltas_171'",
  "proof172?.ownerProtocol === 'd1-only-171'",
  "proof172?.drainQuiescenceMs) >= 30000",
  "approvedWorkerSha256",
  "workerSha256ByEnvironment",
  "workerVersionByEnvironment",
  "workerMarkerReadyByEnvironment",
]) {
  assert.ok(patch.includes(required), '082 final gate missing controller proof field: ' + required);
}
assert.match(patch, /\^\[0-9a-f\]\{64\}\$\/i/);
assert.match(patch, /\['preview', 'test', 'production'\]\.every/);

const migration = readFileSync(
  'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql',
  'utf8',
);
const cleaned = migration.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
const statements = cleaned.split(';').map((value) => value.trim()).filter(Boolean);
const relationSql = statements.find((value) => /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_overrides_171/i.test(value));
const countSql = statements.find((value) => /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_count_deltas_171/i.test(value));
assert.ok(relationSql && countSql);

const schemaRows = [
  { type: 'table', name: 'explore_like_overrides_171', tbl_name: 'explore_like_overrides_171', sql: relationSql },
  { type: 'table', name: 'explore_like_count_deltas_171', tbl_name: 'explore_like_count_deltas_171', sql: countSql },
];
const zero = {
  queuePending: { '035': 0, '066': 0, '069': 0, '075': 0 },
  processor: { id: 1, lease_until: 0, owner: '' },
};
const now = 10_000_000;
const drain = {
  schemaVersion: 1,
  phase: 'draining',
  allEnvironmentIntakeReady: true,
  ownerProtocol: 'uid143-track147-158',
  drainToken: 'proof-token',
  armedAt: now - 35_000,
};
const approvedWorkerSha256 = 'b'.repeat(64);
const evidence = Object.fromEntries(['preview','test','production'].map((stage) => [stage, {
  versionId: stage + '-v',
  sha256: approvedWorkerSha256,
  markers: [...LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173],
}]));
const result = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: zero,
  secondObservation: zero,
  drainManifest: drain,
  workerEvidence: evidence,
  approvedWorkerSha256,
  observedAt: now,
});
assert.equal(result.ready, true);
assert.equal(result.proof.proofAuthority, 'release-controller-173');
assert.equal(result.proof.approvedWorkerSha256, approvedWorkerSha256);
assert.equal(result.proof.queueStablePasses, 2);
assert.equal(result.proof.legacyProcessorIdle, true);
assert.equal(result.proof.d1OnlyHotSecondaryIndexes, 0);
assert.equal(result.proof.drainQuiescenceMs >= 30000, true);
for (const stage of ['preview','test','production']) {
  assert.match(result.proof.workerSha256ByEnvironment[stage], /^[0-9a-f]{64}$/i);
  assert.ok(result.proof.workerVersionByEnvironment[stage]);
  assert.equal(result.proof.workerMarkerReadyByEnvironment[stage], true);
}

console.log('173_CUTOVER_FINAL_GATE_REQUIRES_CONTROLLER_PROOF=PASS');
console.log('173_CUTOVER_FINAL_GATE_REQUIRES_TWO_ZERO_PASSES_IDLE=PASS');
console.log('173_CUTOVER_FINAL_GATE_REQUIRES_ALL_ENV_EXACT_APPROVED_SOURCE_SHA=PASS');
console.log('173_CUTOVER_FINAL_GATE_REQUIRES_30S_QUIESCENCE=PASS');
console.log('173_CUTOVER_FINAL_GATE_REQUIRES_EXACT_171_SCHEMA_NO_HOT_INDEX=PASS');
