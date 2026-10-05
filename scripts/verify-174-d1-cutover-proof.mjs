import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateLikeD1CutoverProof174,
  LIKE_CUTOVER_CONTROL_TABLE_174,
  LIKE_CUTOVER_CONTROL_TRIGGERS_174,
  LIKE_CUTOVER_REQUIRED_MARKERS_174,
} from '../cloudflare/explore-worker/scripts/like-d1-cutover-proof-174.mjs';

const cleanSql = (sql) => String(sql || '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .trim();

const m171 = cleanSql(readFileSync(
  'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql',
  'utf8',
));
const m174 = cleanSql(readFileSync(
  'cloudflare/explore-worker/migrations/20260922_01_explore_like_cutover_control_v174_additive.sql',
  'utf8',
));

const tableFrom = (raw, name) => {
  const start = raw.indexOf('CREATE TABLE IF NOT EXISTS ' + name);
  assert.ok(start >= 0);
  const end = raw.indexOf('\n);', start);
  assert.ok(end > start);
  return raw.slice(start, end + 3).trim();
};
const triggerFrom = (raw, name) => {
  const needle = 'CREATE TRIGGER IF NOT EXISTS ' + name;
  const start = raw.indexOf(needle);
  assert.ok(start >= 0);
  const next = raw.indexOf('CREATE TRIGGER IF NOT EXISTS ', start + needle.length);
  return raw.slice(start, next >= 0 ? next : raw.length).trim().replace(/;+\s*$/, '');
};
const table171 = (name) => {
  const start = m171.indexOf('CREATE TABLE IF NOT EXISTS ' + name);
  assert.ok(start >= 0);
  const end = m171.indexOf(';', start);
  assert.ok(end > start);
  return m171.slice(start, end).trim();
};

const schemaRows = [
  { type: 'table', name: 'explore_like_overrides_171', tbl_name: 'explore_like_overrides_171', sql: table171('explore_like_overrides_171') },
  { type: 'table', name: 'explore_like_count_deltas_171', tbl_name: 'explore_like_count_deltas_171', sql: table171('explore_like_count_deltas_171') },
  { type: 'table', name: LIKE_CUTOVER_CONTROL_TABLE_174, tbl_name: LIKE_CUTOVER_CONTROL_TABLE_174, sql: tableFrom(m174, LIKE_CUTOVER_CONTROL_TABLE_174) },
  ...LIKE_CUTOVER_CONTROL_TRIGGERS_174.map((name) => ({
    type: 'trigger',
    name,
    tbl_name: LIKE_CUTOVER_CONTROL_TABLE_174,
    sql: triggerFrom(m174, name),
  })),
];

const approved = 'd'.repeat(64);
const workerEvidence = Object.fromEntries(['preview','test','production'].map((stage) => [stage, {
  versionId: stage + '-174',
  sha256: approved,
  markers: [...LIKE_CUTOVER_REQUIRED_MARKERS_174],
}]));
const queuePending = { '035': 0, '066': 0, '069': 0, '075': 0 };
const processor = { id: 1, lease_until: 0, owner: '' };
const controlRow = {
  id: 1,
  phase: 'frozen',
  epoch: 2,
  approved_worker_sha256: approved,
  drain_token_hash: 'e'.repeat(64),
  phase_changed_at: 100,
  frozen_at: 200,
};

const ready = evaluateLikeD1CutoverProof174({
  schemaRows,
  controlRow,
  queuePending,
  processor,
  workerEvidence,
  approvedWorkerSha256: approved,
  observedAt: 300,
});
assert.equal(ready.ready, true);
assert.equal(ready.proof.proofAuthority, 'release-controller-174');
assert.equal(ready.proof.d1AtomicFenceReady, true);
assert.equal(ready.proof.d1FencePhase, 'frozen');
assert.equal(ready.proof.d1FenceEpoch, 2);
assert.equal(ready.proof.approvedWorkerSha256, approved);
assert.deepEqual(ready.proof.legacyQueueRows, queuePending);
assert.equal(ready.proof.legacyProcessorIdle, true);
assert.equal(ready.proof.d1OnlyHotSecondaryIndexes, 0);

for (const [label, patch, reason] of [
  ['open-control', { controlRow: { ...controlRow, phase: 'open', frozen_at: 0 } }, '174-control-not-frozen-for-approved-worker'],
  ['pending-queue', { queuePending: { ...queuePending, '069': 1 } }, 'legacy-queues-not-drained'],
  ['busy-processor', { processor: { id: 1, lease_until: 999, owner: 'busy' } }, 'legacy-processor-not-idle'],
  ['wrong-worker', { workerEvidence: { ...workerEvidence, test: { ...workerEvidence.test, sha256: 'f'.repeat(64) } } }, 'all-environment-worker-source-not-exact-approved-174'],
  ['wrong-control-sha', { controlRow: { ...controlRow, approved_worker_sha256: 'f'.repeat(64) } }, '174-control-not-frozen-for-approved-worker'],
]) {
  const result = evaluateLikeD1CutoverProof174({
    schemaRows,
    controlRow,
    queuePending,
    processor,
    workerEvidence,
    approvedWorkerSha256: approved,
    observedAt: 300,
    ...patch,
  });
  assert.equal(result.ready, false, label);
  assert.ok(result.reasons.includes(reason), label + ' reason');
}

const missingTrigger = evaluateLikeD1CutoverProof174({
  schemaRows: schemaRows.filter((row) => row.name !== LIKE_CUTOVER_CONTROL_TRIGGERS_174[0]),
  controlRow,
  queuePending,
  processor,
  workerEvidence,
  approvedWorkerSha256: approved,
  observedAt: 300,
});
assert.equal(missingTrigger.ready, false);
assert.ok(missingTrigger.reasons.includes('174-control-trigger-not-exact'));

const indexed = evaluateLikeD1CutoverProof174({
  schemaRows: [...schemaRows, {
    type: 'index', name: 'forbidden_174_idx',
    tbl_name: 'explore_like_overrides_171',
    sql: 'CREATE INDEX forbidden_174_idx ON explore_like_overrides_171(track_id)',
  }],
  controlRow,
  queuePending,
  processor,
  workerEvidence,
  approvedWorkerSha256: approved,
  observedAt: 300,
});
assert.equal(indexed.ready, false);
assert.ok(indexed.reasons.includes('hot-secondary-index-present'));

const proofSource = readFileSync(
  'cloudflare/explore-worker/scripts/like-d1-cutover-proof-174.mjs', 'utf8'
);
assert.match(proofSource, /non-read-only D1 statement rejected/);
assert.doesNotMatch(proofSource, /\['d1',\s*'execute'[\s\S]{0,300}\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/);

console.log('174_PROOF_REQUIRES_EXACT_CONTROL_TABLE_AND_TRIGGERS=PASS');
console.log('174_PROOF_REQUIRES_D1_FROZEN_ZERO_QUEUES_IDLE_PROCESSOR=PASS');
console.log('174_PROOF_REQUIRES_ALL_ENV_EXACT_APPROVED_SOURCE=PASS');
console.log('174_PROOF_READ_ONLY=PASS');
