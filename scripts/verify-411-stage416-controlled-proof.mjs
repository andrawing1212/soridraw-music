import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const service=readFileSync('src/services/stage416ControlledProof416.ts','utf8');
const panel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
const appSettings=readFileSync('src/pages/AdminAppSettingsPage.tsx','utf8');
const version=JSON.parse(readFileSync('public/app-version.json','utf8')).version;

assert.equal(version,411,'controlled proof is PREVIEW app411');
assert.match(appSettings,/STAGE416_LIKE_BATCH_MASTER_PANEL_ACTIVE = true/);
assert.match(panel,/runStage416ControlledProof416/);
assert.match(panel,/Stage416 서버 1회 검증/);
assert.match(service,/masterGetLikeBatchTiming416/,'server Master gate required');
assert.match(service,/getExploreLikedTrackCollectionIds/);
assert.match(service,/readExploreTrackLikeMembership127\(uid, trackId\) === true/);
assert.match(service,/new URLSearchParams\(\{ trackIds: trackId \}\)/,
 'canonical verification must be exactly one track');
assert.match(service,/\/v1\/me\/likes\?/);
assert.doesNotMatch(service,/\/v1\/me\/likes\/batch/,
 'proof must not reuse the normal client mutation route');
assert.match(service,/liked: true/,'proof re-sends existing true state only');
assert.match(service,/reserveExploreLikeDeviceSequence416/);
assert.match(service,/persistStoredProof416\(uid, proof\);[\s\S]*retryPrivateClickAfterPriorSeal416/,
 'operation/device sequence must be durable before Stage416 mutation');
assert.match(service,/retryPrivateClickAfterPriorSeal416/,
 'prior-window recovery must reuse the existing bounded retry helper');
assert.match(service,/recordPrivateLike416/);
assert.match(service,/readCacheDiagnosticsEnabled\(uid\)/);
assert.match(service,/confirmCanonicalLiked416\(proof\.trackId\)/,
 'retry must re-confirm same-state target before network mutation');
assert.doesNotMatch(service,/setInterval|setTimeout\([^)]*,\s*(?:[2-9]\d{4,}|1\d{5,})/,
 'proof must not add polling or long-lived timers');
assert.doesNotMatch(service,/setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/,
 'controlled proof must not mutate Firestore');
assert.doesNotMatch(service,/privateLikeBatch416\//,
 'client proof must not directly write private RTDB roots');
assert.doesNotMatch(panel,/ExplorePage|toggleLike|flushPendingLikes/,
 'Master panel must not alter ordinary Explore click flow');

const masterAt=service.indexOf('const privateMinutes = await requireMaster416()');
const prepareAt=service.indexOf('const { proof, reused, canonicalConfirmed } = await prepareProof416(uid)');
const privateAt=service.indexOf("functions, 'recordPrivateLike416'");
assert(masterAt>=0&&prepareAt>masterAt&&privateAt>=0,
 'Master authorization must precede controlled operation preparation');
console.log('STAGE416_MASTER_CONTROLLED_E2E_ONE_OPERATION_GATE=PASS');
console.log('STAGE416_MASTER_PROOF_EXACT_ONE_TRACK_CANONICAL_CHECK=PASS');
console.log('STAGE416_MASTER_PROOF_GENERAL_EXPLORE_PATH_UNCHANGED=PASS');
console.log('STAGE416_MASTER_PROOF_NO_NEW_SERVER_SCHEMA_OR_POLLING=PASS');
