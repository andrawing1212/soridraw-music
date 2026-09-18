import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

console.log('PASS shared D1 release system: fixed trigger-driven additive schema path, exact SHA/blob pinning, no per-release hardcoded migration, rollback of newly-created objects only');
