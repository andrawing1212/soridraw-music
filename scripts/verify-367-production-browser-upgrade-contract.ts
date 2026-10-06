import assert from 'node:assert/strict';
import {
  canAdvancePersonalLikeOriginCertificate357,
  shouldReconcilePublicProfileOriginCache357,
  shouldRepairPersonalLikeOrigin357,
} from '../src/services/exploreEnvironmentParityPolicy';

assert.equal(shouldReconcilePublicProfileOriginCache357(7, 8), true);
assert.equal(shouldReconcilePublicProfileOriginCache357(8, 8), false);
assert.equal(shouldReconcilePublicProfileOriginCache357(8, 0), false);
assert.equal(shouldReconcilePublicProfileOriginCache357(undefined, 11), true);

assert.equal(shouldRepairPersonalLikeOrigin357({ hasLocalState: true, latestSignalVersion: 12, certifiedSignalVersion: 7 }), true);
assert.equal(shouldRepairPersonalLikeOrigin357({ hasLocalState: true, latestSignalVersion: 12, certifiedSignalVersion: 12 }), false);
assert.equal(shouldRepairPersonalLikeOrigin357({ hasLocalState: false, latestSignalVersion: 12, certifiedSignalVersion: 0 }), false);
assert.equal(shouldRepairPersonalLikeOrigin357({ hasLocalState: true, latestSignalVersion: 0, certifiedSignalVersion: 0 }), false);

assert.equal(canAdvancePersonalLikeOriginCertificate357({ seenBefore: 12, signalPreviousVersion: 12, certifiedBefore: 12, repairTargetAfter: 0 }), true);
assert.equal(canAdvancePersonalLikeOriginCertificate357({ seenBefore: 12, signalPreviousVersion: 11, certifiedBefore: 12, repairTargetAfter: 0 }), false);
assert.equal(canAdvancePersonalLikeOriginCertificate357({ seenBefore: 12, signalPreviousVersion: 12, certifiedBefore: 9, repairTargetAfter: 0 }), false);
assert.equal(canAdvancePersonalLikeOriginCertificate357({ seenBefore: 12, signalPreviousVersion: 12, certifiedBefore: 12, repairTargetAfter: 15 }), false);

console.log('APP367_PRODUCTION_BROWSER_UPGRADE_CONTRACT=PASS');
console.log('OLD_PRODUCTION_CACHE_TO_NEW_RELEASE=PASS');
console.log('EMPTY_OR_UNCHANGED_CACHE_NO_FORCED_SERVER_READ=PASS');
console.log('PERSONAL_LIKE_ORIGIN_CERTIFICATE_CONTINUITY=PASS');
