import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const candidatePath = 'cloudflare/explore-worker/candidates/372-first-publication-w2-cutover.sql';
const rollbackPath = 'cloudflare/explore-worker/candidates/372-first-publication-w2-cutover-rollback.sql';
const candidate = readFileSync(candidatePath, 'utf8');
const rollback = readFileSync(rollbackPath, 'utf8');
const wrangler = readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8');
const releaseRuntime = readFileSync('.deploy/release-worker-runtime.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8')).version;
const placeholder = '__SORIDRAW_PUBLICATION_W2_CUTOVER_MS__';

assert.equal(version, 361, 'app361 baseline must remain frozen while cutover is prep-only');
assert.match(candidate, /SORIDRAW 372 first-publication W2 cutover candidate/);
assert.match(candidate, /PREP ONLY\. DO NOT APPLY TO SHARED D1 WITHOUT EXPLICIT USER APPROVAL/);
assert.ok((candidate.match(new RegExp(placeholder, 'g')) || []).length >= 8, 'locked cutoff placeholder coverage missing');

const sqlOnly = candidate.replace(/--.*$/gm, '');
for (const forbidden of [
  /\bDROP\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDELETE\s+FROM\s+tracks\b/i,
  /\bUPDATE\s+tracks\b/i,
  /\bINSERT\s+INTO\s+tracks\b/i,
  /\bREPLACE\s+INTO\s+tracks\b/i,
]) assert.doesNotMatch(sqlOnly, forbidden, 'candidate mutates canonical track rows');

for (const name of [
  'idx_tracks_latest_order',
  'idx_tracks_owner_latest',
  'idx_tracks_owner_source',
  'idx_tracks_primary_genre_latest',
]) {
  assert.match(candidate, new RegExp('CREATE(?: UNIQUE)? INDEX ' + name + '[\\s\\S]*?WHERE source_type <> \\'music_note\\' OR created_at < ' + placeholder));
  assert.match(rollback, new RegExp('CREATE(?: UNIQUE)? INDEX ' + name + '[\\s\\S]*?ON tracks'));
}
assert.doesNotMatch(candidate, /DROP INDEX IF EXISTS idx_tracks_legacy_global_nonempty/i, 'bounded legacy-id uniqueness must stay intact');

for (const trigger of [
  'explore032_track_insert',
  'explore032_track_update',
  'soridraw_shared_rev_tracks_ai_051',
  'soridraw_shared_rev_tracks_au_051',
]) {
  const start = candidate.indexOf('CREATE TRIGGER ' + trigger);
  assert.ok(start >= 0, 'candidate trigger missing: ' + trigger);
  const next = candidate.indexOf('DROP TRIGGER IF EXISTS ', start + 20);
  const body = candidate.slice(start, next >= 0 ? next : candidate.length);
  assert.ok(body.includes("NEW.source_type <> 'music_note' OR NEW.created_at < " + placeholder), 'post-cutover exclusion missing: ' + trigger);
  const rbStart = rollback.indexOf('CREATE TRIGGER ' + trigger);
  assert.ok(rbStart >= 0, 'rollback trigger missing: ' + trigger);
  const rbNext = rollback.indexOf('DROP TRIGGER IF EXISTS ', rbStart + 20);
  const rbBody = rollback.slice(rbStart, rbNext >= 0 ? rbNext : rollback.length);
  assert.equal(rbBody.includes(placeholder), false, 'rollback retained cutover predicate: ' + trigger);
}

for (const flag of [
  'SORIDRAW_R2_CATALOG_V1',
  'SORIDRAW_R2_HYBRID_READ_V1',
  'SORIDRAW_PUBLICATION_R2_ONLY_READ_V1',
]) {
  assert.match(wrangler, new RegExp('"'+flag+'"\\s*:\\s*"1"'), 'R2 cutover flag is not active: ' + flag);
}
for (const token of [
  'const canonicalVars =',
  'vars: canonicalVars',
  "action === 'verify' && liveReleaseVarMismatches.length",
]) assert.ok(releaseRuntime.includes(token), 'TEST/PRODUCTION canonical-var release contract missing: ' + token);

const workflows = readdirSync('.github/workflows').filter((name) => /\.ya?ml$/i.test(name));
const directApply = workflows.filter((name) => readFileSync('.github/workflows/' + name, 'utf8').includes('372-first-publication-w2-cutover.sql'));
assert.deepEqual(directApply, [], 'prep-only shared-D1 candidate is wired directly to a workflow');

assert.match(rollback, /UPDATE\s+explore_derived_tracks/i, 'rollback legacy derived mirror missing');
assert.match(rollback, /UPDATE\s+explore_shared_revision/i, 'rollback shared revision writer missing');

console.log('APP372_FIRST_PUBLICATION_W2_CUTOVER_STATIC=PASS');
console.log('APP372_CANONICAL_TRACK_ROW_PRESERVED=PASS');
console.log('APP372_PRECUTOVER_AND_NON_MUSIC_NOTE_COMPAT=PASS');
console.log('APP372_R2_AUTHORITY_FLAGS=PASS');
console.log('APP372_AUTO_APPLY_WIRED=false');
console.log('APP372_USER_DATA_MIGRATION=false');
console.log('APP372_SHARED_D1_APPLIED=false');
console.log('APP372_BLOCKER=EXPLICIT_SHARED_D1_CUTOVER_APPROVAL_REQUIRED');
