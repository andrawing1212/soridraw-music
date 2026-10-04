import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const migrationPath = 'cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid.sql';
const rollbackPath = 'cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid_rollback.sql';
const workerPath = 'cloudflare/explore-worker/canonical/preview-worker.js';

const migration = readFileSync(migrationPath, 'utf8');
const rollback = readFileSync(rollbackPath, 'utf8');
const worker = readFileSync(workerPath, 'utf8');

assert.match(migration, /SORIDRAW 357 candidate/i, 'candidate marker missing');
assert.match(migration, /DROP TRIGGER IF EXISTS explore032_track_update/i, 'track trigger replacement missing');
assert.match(migration, /CREATE TRIGGER explore032_track_update/i, 'replacement trigger missing');

assert.doesNotMatch(
  migration,
  /(?:DROP|CREATE|UPDATE|INSERT|DELETE)[\s\S]{0,120}soridraw_shared_rev_tracks_au_051/i,
  'candidate must not mutate protected shared revision trigger',
);
assert.doesNotMatch(
  migration,
  /UPDATE\s+explore_shared_revision/i,
  'candidate must not directly write shared revision',
);

// Normal source-media swap must not rewrite the legacy derived row.
assert.doesNotMatch(
  migration,
  /UPDATE\s+explore_derived_tracks\s+SET\s+row_json/i,
  'media-only legacy derived mirror still present',
);

// Non-media/content changes still retain the legacy recovery projection.
assert.match(migration, /INSERT INTO explore_derived_tracks/i, 'content recovery projection removed');
for (const required of [
  'OLD.title IS NOT NEW.title',
  'OLD.description IS NOT NEW.description',
  'OLD.lyrics IS NOT NEW.lyrics',
  'OLD.status IS NOT NEW.status',
  'OLD.published_at IS NOT NEW.published_at',
  'OLD.share_payload_json IS NOT NEW.share_payload_json',
  'OLD.primary_genre IS NOT NEW.primary_genre',
]) {
  assert.ok(migration.includes(required), `legacy content recovery guard missing: ${required}`);
}

// Media columns may wake the trigger, but media-only changes must not enter the
// derived UPSERT predicate.
const whereStart = migration.indexOf('WHERE t.id=NEW.id');
const conflictStart = migration.indexOf('ON CONFLICT(id)', whereStart);
assert.ok(whereStart >= 0 && conflictStart > whereStart, 'derived recovery predicate missing');
const derivedPredicate = migration.slice(whereStart, conflictStart);
for (const mediaOnly of [
  'OLD.cover_url IS NOT NEW.cover_url',
  'OLD.duration_seconds IS NOT NEW.duration_seconds',
  'OLD.suno_url_primary IS NOT NEW.suno_url_primary',
  'OLD.suno_url_secondary IS NOT NEW.suno_url_secondary',
]) {
  assert.equal(derivedPredicate.includes(mediaOnly), false, `media-only predicate would still write derived row: ${mediaOnly}`);
}

// Rollback must restore the current media mirror exactly enough to recover safely.
assert.match(rollback, /UPDATE\s+explore_derived_tracks\s+SET\s+row_json/i, 'rollback media mirror missing');
assert.match(rollback, /OLD\.suno_url_primary IS NOT NEW\.suno_url_primary/i, 'rollback primary media guard missing');
assert.match(rollback, /NOT EXISTS \(SELECT 1 FROM explore_derived_tracks d WHERE d\.id=NEW\.id\)/i, 'rollback missing-derived repair missing');

// PREVIEW candidate code must already have the R2 authority that replaces the
// skipped D1 media mirror.
for (const required of [
  'SORIDRAW_R2_HYBRID_READ_336_20261004',
  'syncExploreCatalogTrack066',
  'readSharedTrackCard062',
  'syncExploreFeedR2Publication043',
  'patchExploreProfileR2Publication043',
]) {
  assert.ok(worker.includes(required), `PREVIEW Worker R2 compatibility missing: ${required}`);
}

// This candidate must remain prep-only until an explicit cross-environment gate is
// completed. No workflow may auto-apply it merely because the file exists.
const workflowNames = readdirSync('.github/workflows').filter((name) => /\.ya?ml$/i.test(name));
const applyReferences = [];
for (const name of workflowNames) {
  const source = readFileSync(`.github/workflows/${name}`, 'utf8');
  if (source.includes('20261005_01_publication_source_swap_w2_post_hybrid.sql')) {
    applyReferences.push(name);
  }
}
assert.deepEqual(applyReferences, [], 'candidate migration is wired to an automatic workflow');

console.log('PUBLICATION_SOURCE_SWAP_W2_CANDIDATE=PASS');
console.log('EXPECTED_NORMAL_PHYSICAL_WRITES=2');
console.log('CANONICAL_TRACK_WRITE=1');
console.log('LEGACY_DERIVED_MEDIA_WRITE=0');
console.log('SHARED_REVISION_WRITE=1');
console.log('PREVIEW_R2_HYBRID_AUTHORITY=PASS');
console.log('AUTO_APPLY_WIRED=false');
console.log('USER_DATA_MIGRATION=false');
console.log('CUTOVER_READY=false');
console.log('BLOCKER=TEST_PRODUCTION_HYBRID_READ_NOT_YET_PROMOTED');
