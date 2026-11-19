import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp728DirectReleasePlan, planExactBindingInheritance } from './app728-release-plan.mjs';

const v = '350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const bind = (name, type) => ({ name, type });
function worker(version = v) {
  return { activeVersion: version, trafficPercent: 100, pinnedBindingsVerified: true,
    schedulesVerified: true, schedules: [{ cron: '37 * * * *' }],
    bindings: [bind('DB', 'd1'), bind('R2', 'r2_bucket'), bind('SECRET', 'secret_text')] };
}
const mock = () => ({
  sourceSha: 'a'.repeat(40), lockedPreviewSha: 'a'.repeat(40), distDigest: 'b'.repeat(64),
  previewHosting: { version: 'sites/soridraw-preview/versions/abcdef0123' },
  productionHosting: { version: 'sites/soridraw/versions/oldprod0123' },
  workers: { previewExplore: worker(), productionExplore: worker(), previewMedia: worker(), productionMedia: worker() },
});
const base = mock();
const plan = buildApp728DirectReleasePlan(base);
assert.equal(plan.status, 'HOLD');
assert.equal(plan.executable, false);
assert.equal(plan.testEnvironmentTouched, false);
assert.equal(plan.source.hostingVersion, 'abcdef0123');
assert.equal(plan.immutableRollbackTargets.hosting.sourceVersion, 'oldprod0123');
assert.equal(plan.proposedPromotion.hosting.sourceVersion, 'abcdef0123');
assert(plan.blockerCodes.includes('ROLLBACK_REHEARSAL_NOT_VERIFIED'));
assert.equal(plan.proposedPromotion.workerBindingInheritance.productionExplore.bindingCount, 3);
assert(plan.proposedPromotion.workerBindingInheritance.productionExplore.descriptors.every(b => b.version_id === v && b.type === 'inherit'));
assert(!plan.proposedPromotion.workerBindingInheritance.productionExplore.descriptors.some(d => d.version_id === 'latest'));
assert(!JSON.stringify(plan).includes('SECRET_VALUE'));
assert.equal(plan.planFingerprintSha256, buildApp728DirectReleasePlan(mock()).planFingerprintSha256);

const missingPin = mock(); missingPin.workers.productionExplore.pinnedBindingsVerified = false;
assert(buildApp728DirectReleasePlan(missingPin).blockerCodes.includes('LIVE_PINNED_BINDING_INHERITANCE_UNPROVEN_productionExplore'));
const missingSchedule = mock(); missingSchedule.workers.productionExplore.schedulesVerified = false;
assert(buildApp728DirectReleasePlan(missingSchedule).blockerCodes.includes('LIVE_SCHEDULE_SNAPSHOT_UNVERIFIED_productionExplore'));
const moved = mock(); moved.workers.productionMedia.trafficPercent = 30;
assert(buildApp728DirectReleasePlan(moved).blockerCodes.includes('LIVE_ACTIVE_VERSION_UNVERIFIED_productionMedia'));
const duplicate = worker(); duplicate.bindings.push(bind('DB', 'd1'));
assert.equal(planExactBindingInheritance(duplicate), null);
const missingOldHosting = mock(); missingOldHosting.productionHosting.version = 'sites/soridraw-preview/versions/wrong';
assert.equal(buildApp728DirectReleasePlan(missingOldHosting).immutableRollbackTargets.hosting, null);
const emptySha = mock(); emptySha.sourceSha = 'INVALID';
assert(buildApp728DirectReleasePlan(emptySha).blockerCodes.includes('IMMUTABLE_SOURCE_SHA_UNVERIFIED'));
const unsound = mock(); unsound.workers.productionExplore.hasUnexpectedMigration = true;
assert(buildApp728DirectReleasePlan(unsound).blockerCodes.includes('LIVE_UNSAFE_DO_MIGRATION_productionExplore'));

const workflow = readFileSync('.github/workflows/soridraw-app728-direct-preflight.yml', 'utf8');
assert(workflow.includes('verify-728-release-plan.mjs'));
assert(workflow.includes('contents: read'));
assert(!/hosting:clone|wrangler.*(?:deploy|upload|rollback)|firebase-tools.*deploy|\bgit push\b/.test(workflow));
console.log('APP728_ROLLBACK_RELEASE_PLAN_OFFLINE=PASS (immutable versions, pinned binding inheritance, HOLD and failure cases)');
