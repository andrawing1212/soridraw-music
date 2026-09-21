import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const service = readFileSync('src/services/exploreLikeService.ts','utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json','utf8'));
const migration = readFileSync('cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql','utf8');

assert.equal(manifest.patches.at(-1),'082-like-d1only-route.mjs');
assert.match(worker,/SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921/);
assert.match(worker,/SORIDRAW_LIKE_D1ONLY_CANONICAL_171_20260921/);

const cutStart=worker.indexOf('async function readLikeCutoverState162(env) {');
const cutEnd=worker.indexOf('\n}',cutStart);
assert.ok(cutStart>=0 && cutEnd>cutStart);
const cut=worker.slice(cutStart,cutEnd+2);
for(const text of [
  "Number(value?.schemaVersion) === 2",
  "value?.relationMode === 'd1only171'",
  "proof172?.legacyIntakeClosed === true",
  "proof172?.legacyProcessorIdle === true",
  "proof172?.allEnvironmentWorkerShaVerified === true",
  "proof172?.relationTable === 'explore_like_overrides_171'",
  "proof172?.countTable === 'explore_like_count_deltas_171'",
  "proof172?.ownerProtocol === 'd1-only-171'",
  "return { mode: 'd1only171', cutoverToken: token }",
]) assert.ok(cut.includes(text),'missing 172 cutover condition: '+text);
assert.match(cut,/if \(!armed172\) throw new Error/);

const batchStart=worker.indexOf('async function handleLikeBatch034(request, env, cors) {');
const batchEnd=worker.indexOf('\n}',batchStart);
assert.ok(batchStart>=0 && batchEnd>batchStart);
const batch=worker.slice(batchStart,batchEnd+2);
for(const text of [
  "const cutover172 = await readLikeCutoverState162(env)",
  "if (cutover172.mode === 'd1only171')",
  "createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true })",
  "expectedRevision: mutation.expectedRevision",
  "operationId: mutation.operationId",
  "queue: 'd1only171'",
  "canonicalD1: 'settled'",
]) assert.ok(batch.includes(text),'missing 172 batch route contract: '+text);
if (worker.includes('SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922')) {
  for (const text of [
    "personalLikeSnapshot: 'settled'",
    "personalLikeProtocol: 'revision-safe-173'",
    "publicLikePublication: 'generation-safe-173'",
  ]) assert.ok(batch.includes(text),'missing 173 settlement upgrade on 172 route: '+text);
} else {
  assert.ok(batch.includes("personalLikeSnapshot: 'pending'"),
    'pre-173 172 route must keep personal snapshot pending');
}
assert.ok(batch.indexOf("if (cutover172.mode === 'd1only171')") <
  batch.indexOf('await assertLegacyLikeIntakeOpen165(env)'),
  '171 route must bypass the legacy drain marker only after final shared cutover');
assert.doesNotMatch(batch,/assertLegacyLikeWriterOpen163\(env, 'batch-like-intake'\)/);

const directStart=worker.indexOf('async function handleLikeD1Core(request, env, cors, trackId, shouldLike) {');
const directEnd=worker.indexOf('\n}',directStart);
const direct=worker.slice(directStart,directEnd+2);
assert.match(direct,/cutover172\.mode === 'd1only171'/);
assert.match(direct,/LIKE_CLIENT_REFRESH_REQUIRED/);
assert.doesNotMatch(direct,/assertLegacyLikeWriterOpen163\(env, 'direct-like'\)/);

const boundedStart=worker.indexOf('async function readBoundedEffectiveLikeMemberships162(');
const boundedEnd=worker.indexOf('\n}',boundedStart);
const bounded=worker.slice(boundedStart,boundedEnd+2);
assert.match(bounded,/explore_like_overrides_171/);
assert.match(bounded,/cutover\.mode === 'd1only171'/);
assert.doesNotMatch(bounded,/COUNT\(\*\)|OFFSET/i);

assert.match(service,/expectedRevision: pending\.expectedRevision \?\? 0/);
assert.match(service,/readLikeCanonicalRevisions172/);
assert.match(service,/persistLikeCanonicalRevisions172/);
assert.match(service,/result\.status === 'revision-conflict'/);
assert.match(service,/source: 'remote'/);
assert.match(migration,/WITHOUT ROWID/);
assert.doesNotMatch(migration,/CREATE\s+INDEX/i);

console.log('172_DORMANT_ROUTE_REQUIRES_SCHEMA2_SHARED_PROOF=PASS');
console.log('172_BATCH_W2_ROUTE_PRECEDES_LEGACY_QUEUE=PASS');
console.log('172_DIRECT_BODYLESS_ROUTE_FAILS_CLOSED_AFTER_CUTOVER=PASS');
console.log('172_CLIENT_EXPECTED_REVISION_BACKWARD_COMPATIBLE=PASS');
console.log('172_ROUTE_NOT_ARMED_BY_SOURCE_CHANGE=PASS');
