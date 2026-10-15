import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const version=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const service=readFileSync('src/services/stage416ControlledProof416.ts','utf8');
const panel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
const like=readFileSync('src/services/exploreLikeService.ts','utf8');
const transport=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
const finalEndpoint=readFileSync('functions/src/exploreLikePrivateFinalEndpoint416.ts','utf8');
const task=readFileSync('functions/src/exploreLikePublicTask416.ts','utf8');
const receipt=readFileSync('functions/src/exploreLikePublicReleaseEndpoint416.ts','utf8');
const functionsIndex=readFileSync('functions/src/index.ts','utf8');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const workerLock=readFileSync('cloudflare/explore-worker/canonical/source-sha256.txt','utf8').trim();

assert.equal(version,417,'controlled public proof candidate must be PREVIEW app417');

// Ordinary Explore/app410 path remains frozen and does not enter Stage416.
assert.match(like,/const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(like,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE = false/);
assert.match(transport,/export const STAGE416_SHARED_RTDB_BATCH_ACTIVE=false/);

// Only the Master diagnostic path can create this one real unlike operation.
const publicProofStart=service.indexOf('export const runStage416ControlledPublicProof416');
assert.ok(publicProofStart>=0,'Master public proof function missing');
const publicProof=service.slice(publicProofStart);
assert.match(publicProof,/await requireMaster416\(\)/,'server Master authorization required');
assert.match(publicProof,/publicMinutes !== 5/,'controlled public proof must require exact 5m policy');
assert.match(publicProof,/confirmCanonicalLiked416\(proof\.trackId\)/);
assert.match(publicProof,/liked: false/,'controlled proof must perform one real unlike');
assert.match(publicProof,/functions, 'recordPrivateLike416'/);
assert.match(publicProof,/readStoredPublicProof416\(uid\)\?\.operationId === proof\.operationId/);
assert.doesNotMatch(publicProof,/\/v1\/me\/likes\/batch/);
assert.doesNotMatch(publicProof,/setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/);
assert.match(panel,/실제 좋아요 1곡 해제 · 공개 5분 검증/);
assert.match(panel,/마스터 계정의 실제 좋아요 1곡이 해제됩니다/);
assert.doesNotMatch(panel,/ExplorePage|toggleLike|flushPendingLikes/);
const previewIntakeStart=functionsIndex.indexOf('export const recordPrivateLike416 = onCall');
const previewIntakeEnd=functionsIndex.indexOf('export const recordPrivateLike416Test',previewIntakeStart);
const previewIntake=functionsIndex.slice(previewIntakeStart,previewIntakeEnd);
assert.match(previewIntake,/await requireMasterCaller\(request\)/,
 'PREVIEW Stage416 intake must independently enforce Master server-side');
assert.match(previewIntake,/enforceAppCheck:\s*true/);

// Shared server source is active only for the PREVIEW candidate.
assert.match(finalEndpoint,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(finalEndpoint,/STAGE416_PREVIEW_PUBLIC_FIVE_MINUTE_ACTIVE=true/);
assert.match(finalEndpoint,/config\.environment==='preview'/);
assert.match(task,/STAGE416_PUBLIC_RELEASE_TASK_ACTIVE=false/);
assert.match(task,/STAGE416_PREVIEW_PUBLIC_RELEASE_TASK_ACTIVE=true/);
assert.match(task,/config\.environment==='preview'/);
assert.match(receipt,/STAGE416_PUBLIC_RELEASE_ENDPOINT_ACTIVE=false/);
assert.match(receipt,/STAGE416_PREVIEW_PUBLIC_RELEASE_ENDPOINT_ACTIVE=true/);
assert.match(receipt,/config\.environment==='preview'/);

// PREVIEW Worker public routes are on, but only exact signed Stage416 deltas
// are withheld. Ordinary 075/legacy changes remain on the existing immediate path.
assert.match(entry,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=true/);
assert.doesNotMatch(entry,/__SORIDRAW_DEFER_PUBLIC_416/);
assert.match(worker,/SORIDRAW_STAGE416_MASTER_ONLY_PUBLIC_444_20261015/);
assert.match(worker,/\.filter\(\(row\)=>Number\(row\?\.stage416_signed\|\|0\)===1\)/);
assert.match(worker,/stage416Changed416=changedTrackIds416\.length>0/);
assert.match(worker,/processExploreLikeUserQueueWave075\(\s*env, now, Date\.now\(\), false\)/);
assert.doesNotMatch(worker,/__SORIDRAW_DEFER_PUBLIC_416/);
assert.equal(createHash('sha256').update(worker,'utf8').digest('hex'),workerLock,
 'canonical Worker SHA lock must match exact candidate bytes');

console.log('STAGE416_APP410_ORDINARY_EXPLORE_PATH_FROZEN=PASS');
console.log('STAGE416_MASTER_REAL_UNLIKE_EXACT_ONE_OPERATION_GATE=PASS');
console.log('STAGE416_PREVIEW_ONLY_SERVER_PUBLIC_GATES=PASS');
console.log('STAGE416_SIGNED_ONLY_PUBLIC_DELAY_ORDINARY_075_IMMEDIATE=PASS');
console.log('STAGE416_CANONICAL_WORKER_SHA_LOCK=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
