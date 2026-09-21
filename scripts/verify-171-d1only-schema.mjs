import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = 'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql';
const sql = readFileSync(path, 'utf8');

assert.match(sql, /SORIDRAW 171: UNAPPLIED D1-only like cutover candidate/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_like_overrides_171/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_like_count_deltas_171/);
assert.match(sql, /PRIMARY KEY \(user_uid, track_id\)[\s\S]*WITHOUT ROWID/);
assert.match(sql, /PRIMARY KEY \(track_id\)[\s\S]*WITHOUT ROWID/);
assert.match(sql, /revision INTEGER NOT NULL CHECK \(revision >= 1\)/);
assert.match(sql, /last_operation_id TEXT NOT NULL/);
assert.match(sql, /generation INTEGER NOT NULL CHECK \(generation >= 1\)/);
assert.doesNotMatch(sql, /CREATE\s+INDEX/i);
assert.doesNotMatch(sql, /\b(?:DROP|ALTER|UPDATE|DELETE|INSERT|REPLACE)\b/i);
assert.doesNotMatch(sql, /explore_like_overrides_157/);
console.log('171_UNAPPLIED_SCHEMA_TWO_HOT_ROWS_NO_SECONDARY_INDEX=PASS');
console.log('171_SCHEMA_NO_BACKFILL_NO_SEED_NO_DESTRUCTIVE_DDL=PASS');
