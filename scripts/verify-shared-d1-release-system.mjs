import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateLikeCutoverPreflight164,
  inspectLikeCutoverPreflight164,
  LIKE_CUTOVER_EXPECTED_DDL_164,
  LIKE_CUTOVER_RELATION_TABLE_164,
  LIKE_CUTOVER_RELATION_INDEX_164,
} from '../cloudflare/explore-worker/scripts/like-cutover-preflight-164.mjs';

const workflow = readFileSync('.github/workflows/cloudflare-explore-shared-d1-release.yml', 'utf8');

for (const required of [
  "migration=\"$(sed -n 's/^migration=//p'",
  "blob=\"$(sed -n 's/^migration_blob=//p'",
  "verifier=\"$(sed -n 's/^verifier=//p'",
  'git merge-base --is-ancestor "$target" origin/preview',
  'git hash-object "$migration_path"',
  'ADDITIVE_DDL_STATIC_SAFETY=PASS',
  'INDEX_TARGET_MUST_BE_NEW_TABLE',
  'DROP INDEX IF EXISTS',
  'DROP TABLE IF EXISTS',
  'ALL_WORKER_VERSIONS_UNCHANGED=PASS',
  'MAIN_PRODUCTION_REFS_UNCHANGED=PASS',
  'SHARED_D1_ADDITIVE_RELEASE=PASS',
]) {
  assert.ok(workflow.includes(required), `shared D1 workflow missing guard: ${required}`);
}

for (const forbidden of [
  'APPROVED_MIGRATION:',
  'APPROVED_MIGRATION_BLOB:',
  '20260911_01_explore_like_deferred_batches.sql',
  'SHARED_D1_035_RELEASE=PASS',
]) {
  assert.ok(!workflow.includes(forbidden), `shared D1 workflow still release-specific: ${forbidden}`);
}

assert.match(workflow, /CREATE\\s\+TABLE\\s\+IF\\s\+NOT\\s\+EXISTS/);
assert.match(workflow, /CREATE\\s\+INDEX\\s\+IF\\s\+NOT\\s\+EXISTS/);
assert.match(workflow, /DROP\|ALTER\|INSERT\|UPDATE\|DELETE\|REPLACE\|PRAGMA\|ATTACH\|DETACH\|VACUUM\|REINDEX/);
assert.match(workflow, /migration.*\^20\[0-9\]\{6\}/);
assert.match(workflow, /verifier.*scripts\//);
assert.match(workflow, /explore_derived_state/);
assert.match(workflow, /assertDerivedBaseD1Ready/);

const preflight164Source = readFileSync('cloudflare/explore-worker/scripts/like-cutover-preflight-164.mjs', 'utf8');
assert.equal(
  preflight164Source.split('d1Query164(config,').length - 1,
  4,
  '164 preflight gained an unreviewed D1 query call or definition'
);
assert.match(preflight164Source, /function d1Query164\(config, sql, run\)/);
assert.match(preflight164Source, /d1Query164\(config, schemaSql164, run\)/);
assert.match(preflight164Source, /d1Query164\(config, statement, run\)/);
assert.match(preflight164Source, /SELECT 1 AS pending FROM explore_like_user_queue_075 q/);
assert.match(preflight164Source, /q\.updated_at > s\.processed_at/);
assert.match(preflight164Source, /q\.user_uid > s\.processed_uid/);
assert.match(preflight164Source, /075 processing cursor missing or invalid/);
assert.match(preflight164Source, /LIMIT 1/);
assert.doesNotMatch(preflight164Source, /COUNT\s*\(\s*\*\s*\)/i);
assert.doesNotMatch(preflight164Source, /\['d1',\s*'execute'[\s\S]*'--file'/);

const schema164 = [
  {
    type: 'table',
    name: LIKE_CUTOVER_RELATION_TABLE_164,
    tbl_name: LIKE_CUTOVER_RELATION_TABLE_164,
    sql: LIKE_CUTOVER_EXPECTED_DDL_164.table,
  },
  {
    type: 'index',
    name: LIKE_CUTOVER_RELATION_INDEX_164,
    tbl_name: LIKE_CUTOVER_RELATION_TABLE_164,
    sql: LIKE_CUTOVER_EXPECTED_DDL_164.index,
  },
];
const queuesEmpty164 = { '035': 0, '066': 0, '069': 0, '075': 0 };

const intakeOpen164 = evaluateLikeCutoverPreflight164({
  schemaRows: schema164,
  queuePending: queuesEmpty164,
  legacyIntakeClosed: false,
});
assert.equal(intakeOpen164.ready, false);
assert.equal(intakeOpen164.proof, null);
assert.ok(intakeOpen164.reasons.includes('legacy-intake-open'));

const pending164 = evaluateLikeCutoverPreflight164({
  schemaRows: schema164,
  queuePending: { ...queuesEmpty164, '069': 1 },
  legacyIntakeClosed: true,
});
assert.equal(pending164.ready, false);
assert.equal(pending164.proof, null);
assert.ok(pending164.reasons.includes('queue-069-pending'));

const schemaMissing164 = evaluateLikeCutoverPreflight164({
  schemaRows: [],
  queuePending: queuesEmpty164,
  legacyIntakeClosed: true,
});
assert.equal(schemaMissing164.ready, false);
assert.equal(schemaMissing164.observation.overlay157SchemaOwnerReady, false);

const ready164 = evaluateLikeCutoverPreflight164({
  schemaRows: schema164,
  queuePending: queuesEmpty164,
  legacyIntakeClosed: true,
});
assert.equal(ready164.ready, true);
assert.deepEqual(ready164.proof.legacyQueueRows, queuesEmpty164);
assert.equal(ready164.proof.overlay157SchemaOwnerReady, true);
assert.equal(ready164.proof.overlay157SchemaOwner, 'shared-d1');
assert.equal(ready164.proof.overlay157RelationTable, LIKE_CUTOVER_RELATION_TABLE_164);
assert.equal(ready164.proof.ownerProtocol, 'uid143-track147-158');

// A 075 row is not pending merely because it is still physically stored.
// The table is an append/rewrite queue with a high-water cursor. Exercise the
// actual remote preflight's generated SQL using a mock Wrangler response.
const rows164 = [...schema164, {
  type: 'table', name: 'explore_like_user_queue_075',
  tbl_name: 'explore_like_user_queue_075',
  sql: 'CREATE TABLE explore_like_user_queue_075 (user_uid TEXT)',
}];
const statements164 = [];
const replay164 = (args) => {
  const sql = args[args.indexOf('--command') + 1];
  statements164.push(sql);
  const result = sql.includes('FROM sqlite_schema') ? rows164
    : sql.includes('FROM explore_like_user_queue_state_075 WHERE id') ?
      [{ processed_at: 1000, processed_uid: 'user-b' }]
    : sql.includes('FROM explore_like_user_queue_075 q') ? [] : [];
  return JSON.stringify([{ success: true, results: result }]);
};
const processed164 = inspectLikeCutoverPreflight164('mock-wrangler.jsonc',
  { legacyIntakeClosed: false }, replay164);
assert.equal(processed164.observation.queuePending['075'], 0);
assert.ok(statements164.some((sql) => sql.includes('q.updated_at > s.processed_at')));
assert.ok(statements164.some((sql) => sql.includes('q.user_uid > s.processed_uid')));
const invalidCursor164 = (args) => {
  const sql = args[args.indexOf('--command') + 1];
  const rows = sql.includes('FROM sqlite_schema') ? rows164 : [];
  return JSON.stringify([{ success: true, results: rows }]);
};
assert.throws(() => inspectLikeCutoverPreflight164('mock-wrangler.jsonc',
  { legacyIntakeClosed: false }, invalidCursor164), /processing cursor missing or invalid/);
console.log('164_075_PROCESSED_ROWS_NOT_PENDING_CURSOR_REQUIRED=PASS');

console.log('164_READONLY_CUTOVER_PREFLIGHT_MODEL=PASS');
console.log('PASS shared D1 release system: fixed trigger-driven additive schema path, exact SHA/blob pinning, no per-release hardcoded migration, rollback of newly-created objects only');
