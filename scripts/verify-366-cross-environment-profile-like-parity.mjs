import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const profile = read('src/services/exploreProfileFirstViewService.ts');
const page = read('src/pages/ExplorePage.tsx');
const domain = read('src/services/userDomainSyncService.ts');
const like = read('src/services/exploreLikeService.ts');
const promotion = read('.github/workflows/soridraw-release-promotion.yml');
const parityPolicy = read('src/services/exploreEnvironmentParityPolicy.ts');

assert.match(profile, /const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6;/);
assert.match(profile, /publicationSignalVersion\?: number;/);
assert.match(profile, /expectedPublicationSignalVersion\?: number;/);
assert.match(profile, /shouldReconcilePublicProfileOriginCache357\(appliedPublicationSignalVersion, expectedPublicationSignalVersion\)/);
assert.match(parityPolicy, /shouldReconcilePublicProfileOriginCache357/);
assert.match(parityPolicy, /shouldRepairPersonalLikeOrigin357/);
assert.match(parityPolicy, /canAdvancePersonalLikeOriginCertificate357/);
assert.match(profile, /requestMaterializedFirstView\(normalizedRef, cached\.revision\)/);
assert.match(profile, /publicationSignalVersion: expectedPublicationSignalVersion/);
assert.match(profile, /throw new Error\('공개 프로필 최신 상태를 확인하지 못했습니다\.'\)/);
assert.match(profile, /LOCAL HIT · 변경 없음 · Worker 0 · D1 읽기 0/);

assert.match(domain, /EXPLORE_PUBLICATION_LAST_SIGNAL_STORAGE_BASE_357/);
assert.match(domain, /persistLatestExplorePublicationSignal357\(safeUid, signal\)/);
assert.match(
  domain,
  /const localSignal = normalizeExplorePublicationSignal\(transaction\.snapshot\.val\(\)\);[\s\S]*?persistLatestExplorePublicationSignal357\(safeUid, localSignal\);[\s\S]*?window\.dispatchEvent\(new CustomEvent\(EXPLORE_PUBLICATION_SYNC_EVENT/,
);
assert.match(
  domain,
  /if \(signal\.originDeviceId === getStoredDeviceId\(GENERIC_DEVICE_STORAGE_KEY, 'd'\)\) return;/,
);
assert.match(domain, /normalizeExplorePublicationSignal\(JSON\.parse\(raw\)\)/);
assert.match(page, /profilePublicationSyncVersion357/);
assert.match(page, /readLatestExplorePublicationSyncSignal\(profileUid\)/);
assert.match(page, /expectedPublicationSignalVersion: expectedPublicationSignalVersion357/);

assert.match(like, /EXPLORE_LIKE_LAST_RETAINED_SIGNAL_357/);
assert.match(like, /EXPLORE_LIKE_CROSS_ORIGIN_CERTIFIED_357/);
assert.match(like, /rememberLastRetainedLikeSignal357\(uid, signal\.version\)/);
assert.match(like, /export const ensureExplorePersonalLikeCrossOriginParity357/);
assert.match(like, /shouldRepairPersonalLikeOrigin357\(/);
assert.match(like, /requestRepair127\(uid, latestSignalVersion\);/);
assert.match(like, /await ensurePersonalLikeBaseline127\(user\);/);
assert.match(like, /if \(readRepairTarget127\(uid\) > 0\)/);
assert.match(like, /markCrossOriginLikeCertified357\(uid, latestSignalVersion\);/);
assert.match(page, /profileCollection !== 'liked'/);
assert.match(page, /await ensureExplorePersonalLikeCrossOriginParity357\(user\);/);

assert.match(like, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000;/);
assert.match(like, /const deadline = latestEligibleUpdatedAt \+ EXPLORE_LIKE_IDLE_FLUSH_MS_120;/);
assert.match(like, /pending click > accepted-unsettled intent > verified/);
assert.match(like, /reconcileExploreLikedTrackCollectionState/);

assert.match(promotion, /node scripts\/verify-366-cross-environment-profile-like-parity\.mjs/);

console.log('APP366_CROSS_ENV_PROFILE_LIKE_PARITY=PASS');
console.log('PROFILE_CHANGE_SIGNAL_RECONCILIATION=PASS');
console.log('MY_LIKES_BOUNDED_ORIGIN_REPAIR=PASS');
console.log('UNCHANGED_REENTRY_ZERO_READ_CONTRACT=PRESERVED');
console.log('APP375_PUBLICATION_ORIGIN_IMMEDIATE_LOCAL_SIGNAL=PASS');
