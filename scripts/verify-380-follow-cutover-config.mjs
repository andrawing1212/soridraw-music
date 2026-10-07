import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
const sql=readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

assert.equal(config?.vars?.SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378,'1');
assert.match(worker,/SORIDRAW_FOLLOW_ROLLBACK_SAFE_AUTHORITY_378_20261007/);
assert.match(worker,/SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378/);
assert.ok(worker.includes('internal/explore/follow-cutover-v348/active.json'),
  'follow348 shared cutover manifest key changed');
for (const required of [
  'explore_follow_cutover_control_348_no_downgrade',
  'explore_follow_cutover_control_348_no_delete',
  "phase IN ('legacy','armed','overlay','readonly')",
]) assert.ok(sql.includes(required),'missing one-way authority guard: '+required);

console.log('FOLLOW380_LIFECYCLE_CANONICAL_VAR=PASS');
console.log('FOLLOW380_SHARED_MANIFEST_KEY=PASS');
console.log('FOLLOW380_ONE_WAY_D1_GUARDS_SOURCE=PASS');
console.log('FOLLOW380_CUTOVER_RUNTIME_ACTIVATION=NOT_PERFORMED_BY_VERIFIER');
