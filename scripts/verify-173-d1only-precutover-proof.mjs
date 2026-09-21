import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateD1OnlyPreCutoverProof173,
  LIKE_D1ONLY_RELATION_TABLE_173,
  LIKE_D1ONLY_COUNT_TABLE_173,
  LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173,
} from '../cloudflare/explore-worker/scripts/like-d1only-precutover-proof-173.mjs';

const migration = readFileSync(
  'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql',
  'utf8',
);
const cleaned = migration.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
const statements = cleaned.split(';').map((value) => value.trim()).filter(Boolean);
const relationSql = statements.find((value) => /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_overrides_171/i.test(value));
const countSql = statements.find((value) => /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+explore_like_count_deltas_171/i.test(value));
assert.ok(relationSql && countSql);

const source = readFileSync(
  'cloudflare/explore-worker/scripts/like-d1only-precutover-proof-173.mjs',
  'utf8',
);
for (const forbidden of [
  "['r2', 'object', 'put'",
  "['d1', 'execute', 'DB', '--remote', '--command', 'INSERT",
  "['d1', 'execute', 'DB', '--remote', '--command', 'UPDATE",
  "['d1', 'execute', 'DB', '--remote', '--command', 'DELETE",
  'wrangler deploy',
]) {
  assert.equal(source.includes(forbidden), false, 'proof controller must be read-only: ' + forbidden);
}
assert.match(source, /non-read-only D1 statement rejected/);
assert.match(source, /LIKE_D1ONLY_PRECUTOVER_PROOF_173_20260922/);

const schemaRows = [
  { type: 'table', name: LIKE_D1ONLY_RELATION_TABLE_173, tbl_name: LIKE_D1ONLY_RELATION_TABLE_173, sql: relationSql.replace(/IF\s+NOT\s+EXISTS\s+/i, '') },
  { type: 'table', name: LIKE_D1ONLY_COUNT_TABLE_173, tbl_name: LIKE_D1ONLY_COUNT_TABLE_173, sql: countSql.replace(/IF\s+NOT\s+EXISTS\s+/i, '') },
];
const queueZero = { queuePending: { '035': 0, '066': 0, '069': 0, '075': 0 }, processor: { id: 1, lease_until: 0, owner: '' } };
const approvedWorkerSha256 = 'a'.repeat(64);
const workerEvidence = Object.fromEntries(
  ['preview', 'test', 'production'].map((environment) => [environment, {
    versionId: environment + '-version',
    sha256: approvedWorkerSha256,
    markers: [...LIKE_PRECUTOVER_REQUIRED_WORKER_MARKERS_173],
  }]),
);
const observedAt = 1_000_000;
const drainManifest = {
  schemaVersion: 1,
  phase: 'draining',
  allEnvironmentIntakeReady: true,
  ownerProtocol: 'uid143-track147-158',
  drainToken: 'cutover-token-never-exported',
  armedAt: observedAt - 35_000,
};

const ready = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: queueZero,
  secondObservation: queueZero,
  drainManifest,
  workerEvidence,
  approvedWorkerSha256,
  observedAt,
});
assert.equal(ready.ready, true);
assert.equal(ready.proof.proofAuthority, 'release-controller-173');
assert.equal(ready.proof.legacyIntakeClosed, true);
assert.deepEqual(ready.proof.legacyQueueRows, { '035': 0, '066': 0, '069': 0, '075': 0 });
assert.equal(ready.proof.queueStablePasses, 2);
assert.equal(ready.proof.legacyProcessorIdle, true);
assert.equal(ready.proof.d1OnlyHotSecondaryIndexes, 0);
assert.match(ready.proof.drainTokenHash, /^[0-9a-f]{64}$/);
assert.equal(JSON.stringify(ready.proof).includes(drainManifest.drainToken), false, 'raw drain token must not enter proof');
assert.equal(ready.proof.approvedWorkerSha256, approvedWorkerSha256);
assert.deepEqual(Object.keys(ready.proof.workerSha256ByEnvironment).sort(), ['preview', 'production', 'test']);

const staleQueue = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: queueZero,
  secondObservation: { ...queueZero, queuePending: { ...queueZero.queuePending, '069': 1 } },
  drainManifest,
  workerEvidence,
  approvedWorkerSha256,
  observedAt,
});
assert.equal(staleQueue.ready, false);
assert.ok(staleQueue.reasons.includes('legacy-queues-second-pass-not-zero'));

const activeProcessor = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: queueZero,
  secondObservation: { ...queueZero, processor: { id: 1, lease_until: observedAt + 1_000, owner: 'busy' } },
  drainManifest,
  workerEvidence,
  approvedWorkerSha256,
  observedAt,
});
assert.equal(activeProcessor.ready, false);
assert.ok(activeProcessor.reasons.includes('legacy-processor-not-idle'));

const tooYoungDrain = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: queueZero,
  secondObservation: queueZero,
  drainManifest: { ...drainManifest, armedAt: observedAt - 5_000 },
  workerEvidence,
  approvedWorkerSha256,
  observedAt,
});
assert.equal(tooYoungDrain.ready, false);
assert.ok(tooYoungDrain.reasons.includes('drain-marker-or-quiescence-not-ready'));

const oldWorker = evaluateD1OnlyPreCutoverProof173({
  schemaRows,
  firstObservation: queueZero,
  secondObservation: queueZero,
  drainManifest,
  workerEvidence: {
    ...workerEvidence,
    test: { ...workerEvidence.test, markers: workerEvidence.test.markers.filter((marker) => !marker.includes('REVISION_ROUTE_173')) },
  },
  observedAt,
});
assert.equal(oldWorker.ready, false);
assert.ok(oldWorker.reasons.includes('all-environment-worker-source-not-exact-approved-173'));

const indexedSchema = evaluateD1OnlyPreCutoverProof173({
  schemaRows: [
    ...schemaRows,
    { type: 'index', name: 'forbidden_hot_idx', tbl_name: LIKE_D1ONLY_RELATION_TABLE_173, sql: 'CREATE INDEX forbidden_hot_idx ON explore_like_overrides_171(track_id)' },
  ],
  firstObservation: queueZero,
  secondObservation: queueZero,
  drainManifest,
  workerEvidence,
  approvedWorkerSha256,
  observedAt,
});
assert.equal(indexedSchema.ready, false);
assert.ok(indexedSchema.reasons.includes('171-hot-secondary-index-present'));

console.log('173_PRECUTOVER_EXACT_171_SCHEMA_NO_HOT_INDEX=PASS');
console.log('173_PRECUTOVER_TWO_ZERO_QUEUE_PASSES_PROCESSOR_IDLE=PASS');
console.log('173_PRECUTOVER_DRAIN_QUIESCENCE_REQUIRED=PASS');
console.log('173_PRECUTOVER_ALL_ENV_ACTIVE_SOURCE_EXACT_APPROVED_SHA_MARKERS_REQUIRED=PASS');
console.log('173_PRECUTOVER_RAW_DRAIN_TOKEN_NOT_IN_PROOF=PASS');
console.log('173_PRECUTOVER_CONTROLLER_READ_ONLY=PASS');
