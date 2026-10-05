import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'cloudflare/explore-worker/migrations/20260930_02_profile_shared_revision_retire.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const clean = sql
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ')
  .replace(/\s+/g, ' ')
  .trim();

assert.match(clean, /^DROP\s+TRIGGER\s+IF\s+EXISTS\s+soridraw_shared_rev_public_profiles_au_051\s*;?$/i);
for (const forbidden of [
  /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i,
  /\b(?:CREATE|ALTER)\s+(?:TABLE|INDEX)\b/i,
  /\bexplore032_/i,
  /\bexplore079_/i,
  /\btracks\b/i,
  /\btrack_stats\b/i,
  /\blikes\b/i,
  /\bprofile_stats\b/i,
]) {
  assert.ok(!forbidden.test(clean), `forbidden migration token: ${forbidden}`);
}

const prior = fs.readFileSync('cloudflare/explore-worker/migrations/20260930_01_profile_source_trigger_compaction.sql', 'utf8');
for (const protectedName of [
  'explore032_profile_update',
  'explore032_profile_delete',
  'explore032_derived_profile_update',
  'explore032_derived_profile_feed',
]) {
  assert.ok(prior.includes(protectedName), `249 protected profile trigger missing: ${protectedName}`);
}

console.log('250_PROFILE_SHARED_REVISION_RETIRE_STATIC=PASS');
console.log('250_MIGRATION_SCOPE=DROP_ONE_TRIGGER_ONLY');
console.log('250_USER_DATA_MUTATION=0_BY_SQL');
console.log('250_249_PROFILE_TRIGGER_PROTECTION=PASS');
