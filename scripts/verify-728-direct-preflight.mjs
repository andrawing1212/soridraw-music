import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessApp728 } from './app728-direct-preflight.mjs';

const sha = 'a'.repeat(40);
const baseBindings = [
  { name: 'DB', type: 'd1', id: 'shared-db' },
  { name: 'PROFILE_MEDIA', type: 'r2_bucket', bucket: 'soridraw-profile-media' },
  { name: 'EXPLORE_LIKE_BATCH_SCHEDULER', type: 'durable_object_namespace' },
];
function worker(name, bindings = baseBindings) {
  return { name, activeVersion: 'version-uuid', trafficPercent: 100, compatibilityDate: '2026-08-28', bindings: bindings.map(x => ({ ...x })) };
}
const base = () => ({
  sourceSha: sha, lockedPreviewSha: sha,
  sourceVersion: 507, previewAppVersion: '507',
  previewHosting: { release: 'preview-release', version: 'preview-version' },
  productionHosting: { release: 'production-release', version: 'production-version' },
  previewIndexHash: 'index-abc', builtIndexHash: 'index-abc', productionIndexHash: 'index-old',
  canonical: { migrations: [{ tag: 'v1' }], durable_objects: { bindings: [{ class_name: 'ExploreLikeBatchScheduler103' }] } },
  workers: {
    previewExplore: worker('soridraw-explore-preview'),
    productionExplore: worker('soridraw-explore-api'),
    previewMedia: worker('soridraw-media-preview', [
      { name: 'CATALOG', type: 'r2_bucket', bucket: 'soridraw-user-catalog' },
      { name: 'MEDIA', type: 'r2_bucket', bucket: 'soridraw-media-preview' },
    ]),
    productionMedia: worker('soridraw-media', [
      { name: 'CATALOG', type: 'r2_bucket', bucket: 'soridraw-user-catalog' },
      { name: 'MEDIA', type: 'r2_bucket', bucket: 'soridraw-media' },
    ]),
  },
});
const check = (facts, code) => assert(assessApp728(facts).blockers.includes(code), `missing HOLD: ${code}`);
const safe = base();
assert.deepEqual(assessApp728(safe).blockers,
  ['PREVIEW_PRODUCTION_BUNDLE_IDENTITY_NOT_PROVEN', 'PRODUCTION_ROLLBACK_NOT_PROVEN']);
const badSha = base(); badSha.lockedPreviewSha = 'b'.repeat(40); check(badSha, 'SOURCE_SHA_NOT_LOCKED');
const badMigration = base(); badMigration.canonical.migrations.push({ tag: 'v2', new_sqlite_classes: ['OwnerFollowerRecovery557'] }); check(badMigration, 'UNRELEASED_OWNER_DO_V2_MIGRATION');
const badHash = base(); badHash.builtIndexHash = 'different'; check(badHash, 'PREVIEW_BUILD_ARTIFACT_MISMATCH');
const badDb = base(); badDb.workers.productionExplore.bindings = baseBindings.map(x => x.name === 'DB' ? { ...x, id: 'wrong' } : x); check(badDb, 'SHARED_D1_ID_DRIFT');
const badMedia = base(); badMedia.workers.productionMedia.bindings[0].bucket = 'different'; check(badMedia, 'MEDIA_CATALOG_BINDING_MISMATCH_productionMedia');
const badMissing = base(); badMissing.workers.previewExplore.activeVersion = ''; check(badMissing, 'ACTIVE_WORKER_UNVERIFIED_previewExplore');
const badBindings = base(); badBindings.workers.productionExplore.bindings.push({ name: 'SOMETHING_NEW', type: 'service' }); check(badBindings, 'EXPLORE_BINDING_SHAPE_DRIFT');
const badRuntime = base(); badRuntime.workers.productionExplore.compatibilityDate = '2026-08-06'; check(badRuntime, 'EXPLORE_RUNTIME_DATE_DRIFT');

const workflow = readFileSync('.github/workflows/soridraw-app728-direct-preflight.yml', 'utf8');
const script = readFileSync('scripts/app728-direct-preflight.mjs', 'utf8');
assert(workflow.includes('workflow_dispatch:'));
assert(workflow.includes('issue_comment:'));
assert(workflow.includes('github.actor == github.repository_owner'));
assert(workflow.includes('github.event.issue.number == 1245'));
assert(workflow.includes("startsWith(github.event.comment.body, '/app728-readonly ')"));
assert(workflow.includes("s@^/app728-readonly ([0-9a-f]{40})$@"));
assert(workflow.includes('contents: read'));
assert(workflow.includes('ref: ${{ github.workflow_sha }}'));
assert(workflow.includes('APP728_SOURCE_SHA'));
assert(!/(?:test\.soridraw|soridraw-test|\btest upload\b|\btest activate\b)/i.test(workflow));
assert(!/(?:firebase-tools.+deploy|hosting:clone|wrangler.+(?:deploy|rollback|upload)|\bgit push\b|\bPOST\b|\bPUT\b|\bDELETE\b|\bPATCH\b)/i.test(workflow));
assert(!/fetch\([^\n]+method:\s*['"](?:POST|PUT|DELETE|PATCH)/i.test(script));
assert(!/\b(?:cfPut|cfPost|cloudflareDeploy)\s*\(/.test(script));
console.log('APP728_DIRECT_PREFLIGHT_OFFLINE_GUARDS=PASS (9 synthetic cases, GET-only workflow)');
