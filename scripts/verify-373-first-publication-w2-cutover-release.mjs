import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cutoff = '1791309600000';
const approval = 'user_explicit_shared_d1_cutover_approved_2026-10-07T01:13:29+09:00';
const migrationPath = 'cloudflare/explore-worker/migrations/20261007_01_first_publication_w2_cutover.sql';
const rollbackPath = 'cloudflare/explore-worker/migrations/20261007_01_first_publication_w2_cutover_rollback.sql';
const workflowPath = '.github/workflows/cloudflare-explore-shared-d1-release.yml';

const migration = readFileSync(migrationPath, 'utf8');
const rollback = readFileSync(rollbackPath, 'utf8');
const workflow = readFileSync(workflowPath, 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8')).version;

assert.ok(Number(version) >= 361, 'app version must not regress below the app361 publication-parity baseline');
assert.ok(migration.includes('SORIDRAW 373 APPROVED shared-D1 first-publication W2 cutover'));
assert.ok(migration.includes('APPROVAL=' + approval));
assert.ok(migration.includes('LOCKED_CUTOVER_MS=' + cutoff));
assert.doesNotMatch(migration, /__SORIDRAW_PUBLICATION_W2_CUTOVER_MS__/);
assert.ok(rollback.includes('SORIDRAW 373 rollback'));
assert.ok(rollback.includes('APPROVAL=' + approval));

const sqlOnly = migration.replace(/--.*$/gm, '');
for (const forbidden of [
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\s+tracks\b/i,
  /\bUPDATE\s+tracks\b/i,
  /\bINSERT\s+INTO\s+tracks\b/i,
  /\bREPLACE\s+INTO\s+tracks\b/i,
]) assert.doesNotMatch(sqlOnly, forbidden, 'approved schema cutover must not rewrite canonical track rows');

const indexes = [
  'idx_tracks_latest_order',
  'idx_tracks_owner_latest',
  'idx_tracks_owner_source',
  'idx_tracks_primary_genre_latest',
];
const triggers = [
  'explore032_track_insert',
  'explore032_track_update',
  'soridraw_shared_rev_tracks_ai_051',
  'soridraw_shared_rev_tracks_au_051',
];

for (const name of indexes) {
  assert.equal((migration.match(new RegExp('DROP INDEX IF EXISTS ' + name, 'g')) || []).length, 1, 'migration drop mismatch ' + name);
  assert.equal((migration.match(new RegExp('CREATE(?: UNIQUE)? INDEX ' + name, 'g')) || []).length, 1, 'migration create mismatch ' + name);
  const start = migration.indexOf('CREATE INDEX ' + name) >= 0 ? migration.indexOf('CREATE INDEX ' + name) : migration.indexOf('CREATE UNIQUE INDEX ' + name);
  const next = migration.indexOf('DROP ', start + 1);
  const body = migration.slice(start, next >= 0 ? next : migration.length);
  assert.ok(body.includes("source_type <> 'music_note' OR created_at < " + cutoff), 'partial predicate missing ' + name);
}
for (const name of triggers) {
  assert.equal((migration.match(new RegExp('DROP TRIGGER IF EXISTS ' + name, 'g')) || []).length, 1, 'migration trigger drop mismatch ' + name);
  assert.equal((migration.match(new RegExp('CREATE TRIGGER ' + name, 'g')) || []).length, 1, 'migration trigger create mismatch ' + name);
  const start = migration.indexOf('CREATE TRIGGER ' + name);
  const next = migration.indexOf('DROP TRIGGER IF EXISTS ', start + 1);
  const body = migration.slice(start, next >= 0 ? next : migration.length);
  assert.ok(body.includes("NEW.source_type <> 'music_note' OR NEW.created_at < " + cutoff), 'trigger cutoff predicate missing ' + name);
}
assert.doesNotMatch(migration, /idx_tracks_legacy_global_nonempty/);
assert.doesNotMatch(rollback, new RegExp(cutoff));
assert.match(rollback, /CREATE UNIQUE INDEX idx_tracks_owner_source/);
assert.match(rollback, /CREATE TRIGGER explore032_track_insert/);
assert.match(rollback, /CREATE TRIGGER soridraw_shared_rev_tracks_ai_051/);

for (const required of [
  "publication_w2_cutover_373",
  "20261007_01_first_publication_w2_cutover.sql",
  "20261007_01_first_publication_w2_cutover_rollback.sql",
  "scripts/verify-373-first-publication-w2-cutover-release.mjs",
  "APP373_LIVE_FIRST_PUBLIC_REMOTE_D1_W2=PASS",
  "APP373_SHARED_D1_CUTOVER=PASS",
  "APP373_USER_ROWS_UNCHANGED=PASS",
  "APP373_ALL_WORKERS_UNCHANGED=PASS",
]) assert.ok(workflow.includes(required), 'shared D1 workflow missing app373 guard: ' + required);

assert.ok(readFileSync('scripts/verify-shared-d1-release-system.mjs','utf8').includes('APP373_SHARED_D1_WORKFLOW_BASH_SYNTAX=PASS'));
console.log('APP373_APPROVED_CUTOVER_STATIC=PASS');
console.log('APP373_LOCKED_CUTOVER_MS=' + cutoff);
console.log('APP373_CANONICAL_USER_ROW_REWRITE=0');
console.log('APP373_ROLLBACK_SOURCE=PASS');
console.log('APP373_SCHEMA_ONLY_RELEASE=PASS');
