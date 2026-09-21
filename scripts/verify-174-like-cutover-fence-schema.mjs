import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = 'cloudflare/explore-worker/migrations/20260922_01_explore_like_cutover_control_v174_additive.sql';
const sql = readFileSync(path, 'utf8');

assert.match(sql, /SORIDRAW 174: SOURCE-ONLY atomic D1 cutover fence candidate/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_like_cutover_control_174/);
assert.match(sql, /phase TEXT NOT NULL CHECK \(phase IN \('open', 'draining', 'frozen'\)\)/);
assert.match(sql, /approved_worker_sha256 TEXT NOT NULL DEFAULT ''/);
assert.match(sql, /drain_token_hash TEXT NOT NULL DEFAULT ''/);
assert.match(sql, /INSERT OR IGNORE INTO explore_like_cutover_control_174/);
assert.match(sql, /VALUES \(1, 'open', 0, '', '', 0, 0\)/);
assert.doesNotMatch(sql, /CREATE\s+INDEX/i);
assert.doesNotMatch(sql, /\b(?:DROP|ALTER|REPLACE)\b/i);
assert.match(sql, /CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_transition_guard/);
assert.match(sql, /174 freeze requires drained queues and idle processor/);
assert.match(sql, /CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_identity_guard/);
assert.match(sql, /CREATE TRIGGER IF NOT EXISTS explore_like_cutover_control_174_frozen_guard/);
for (const table of [
  'likes', 'track_stats', 'tracks', 'public_profiles',
  'explore_derived_tracks', 'explore_derived_changes',
  'explore_like_overrides_171', 'explore_like_count_deltas_171',
]) {
  const mutation = new RegExp(
    '\\b(?:INSERT\\s+(?:OR\\s+IGNORE\\s+)?INTO|UPDATE|DELETE\\s+FROM)\\s+' + table + '\\b',
    'i',
  );
  assert.doesNotMatch(sql, mutation, '174 migration must not mutate user/canonical table ' + table);
}

console.log('174_CONTROL_SCHEMA_ADDITIVE_SYSTEM_METADATA_ONLY=PASS');
console.log('174_CONTROL_SCHEMA_NO_SECONDARY_INDEX=PASS');
console.log('174_CONTROL_SCHEMA_FREEZE_INVARIANT_IN_D1_TRIGGER=PASS');
console.log('174_CONTROL_SCHEMA_USER_DATA_MUTATION=0');
