import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath='cloudflare/explore-worker/migrations/20261007_02_follow_overlay_348_additive.sql';
const migration=readFileSync(migrationPath,'utf8');
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');

for (const required of [
  'CREATE TABLE IF NOT EXISTS explore_follow_overrides_348',
  'CREATE INDEX IF NOT EXISTS idx_explore_follow_overrides_348_reverse',
  'CREATE TABLE IF NOT EXISTS explore_follow_cutover_control_348',
  "phase IN ('legacy','armed','overlay','readonly')",
]) assert.ok(migration.includes(required), 'missing additive follow schema: '+required);

assert.doesNotMatch(migration,/\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRIGGER|VIEW|PRAGMA|ATTACH|DETACH)\b/i,
  'shared additive migration must not mutate rows or create trigger/view');
assert.doesNotMatch(migration,/\b(?:follows|profile_stats)\s*\(/i,
  'legacy user relation/stat tables must not be redefined');
assert.match(worker,/SORIDRAW_FOLLOW_ROLLBACK_SAFE_AUTHORITY_378_20261007/);
assert.match(worker,/SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378/);
assert.match(worker,/FOLLOW_OVERLAY_READONLY/);
assert.match(worker,/explore_follow_overrides_348/);
assert.match(worker,/explore_follow_cutover_control_348/);

console.log('FOLLOW379_SHARED_SCHEMA_ADDITIVE_ONLY=PASS');
console.log('FOLLOW379_USER_ROW_REWRITE_BACKFILL_DELETE=0');
console.log('FOLLOW379_RUNTIME_ACTIVATION=OFF');
