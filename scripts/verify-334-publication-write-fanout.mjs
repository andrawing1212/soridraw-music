import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_compaction.sql', 'utf8');
const rollback = readFileSync('cloudflare/explore-worker/migrations/20261004_02_publication_write_fanout_rollback.sql', 'utf8');

for (const index of [
  'idx_tracks_owner_suno_url',
  'idx_tracks_source_type_latest',
  'idx_tracks_owner_profile_order',
  'idx_tracks_title',
]) {
  assert.match(migration, new RegExp(`DROP INDEX IF EXISTS ${index.replace(/[.*+?^$()|[\\]\\]/g, '\\$&')}`), `missing drop for ${index}`);
  assert.match(rollback, new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${index.replace(/[.*+?^$()|[\\]\\]/g, '\\$&')}`), `missing rollback for ${index}`);
}

assert.match(
  migration,
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_legacy_global_nonempty[\s\S]*WHERE legacy_global_id IS NOT NULL AND TRIM\(legacy_global_id\) <> ''/,
  'legacy uniqueness must remain for real legacy ids only',
);
assert.match(migration, /DROP INDEX IF EXISTS idx_tracks_legacy_global;/, 'legacy full index must be retired');
assert.match(rollback, /CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_legacy_global ON tracks \(legacy_global_id\)/, 'legacy full index rollback missing');

const triggerStart = migration.indexOf('CREATE TRIGGER explore079_music_note_derived_track_insert');
assert.ok(triggerStart >= 0, 'repair-only Music Note derived-profile trigger missing');
const triggerBody = migration.slice(triggerStart);
assert.match(triggerBody, /INSERT INTO explore_derived_profiles\(uid\)/, 'missing derived-profile repair insert');
assert.doesNotMatch(triggerBody, /SET track_count\s*=/, 'normal Music Note first publication must not rewrite obsolete derived track_count');

for (const forbidden of [
  /DELETE\s+FROM\s+tracks/i,
  /UPDATE\s+tracks/i,
  /INSERT\s+INTO\s+tracks/i,
  /DELETE\s+FROM\s+explore_derived_tracks/i,
  /UPDATE\s+explore_derived_tracks/i,
  /DROP\s+TABLE/i,
  /ALTER\s+TABLE/i,
]) {
  assert.doesNotMatch(migration, forbidden, `migration contains forbidden user-row/table mutation: ${forbidden}`);
}

assert.match(rollback, /SET track_count = track_count \+ NEW\.active/, 'rollback must restore old derived track_count maintenance');

console.log('APP334_D1_SCHEMA_USER_ROWS_UNTOUCHED=PASS');
console.log('APP334_REDUNDANT_PUBLICATION_INDEXES_REMOVED=PASS');
console.log('APP334_LEGACY_UNIQUENESS_PRESERVED=PASS');
console.log('APP334_DERIVED_PROFILE_REPAIR_PRESERVED=PASS');
console.log('APP334_ROLLBACK_SOURCE=PASS');
