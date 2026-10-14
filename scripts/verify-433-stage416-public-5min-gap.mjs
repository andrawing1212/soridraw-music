import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const settings=readFileSync('functions/src/exploreLikeBatchSettings416.ts','utf8');
const finalPublisher=readFileSync('functions/src/exploreLikePrivateFinal416.ts','utf8');
const panel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const patch056=readFileSync('cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs','utf8');
const patch065=readFileSync('cloudflare/explore-worker/patches/065-shared-like-count-targeted.mjs','utf8');
const contract=readFileSync('DOCS/LIKE_PRIVATE_IMMEDIATE_PUBLIC_5MIN_STAGE416.md','utf8');

assert.match(settings,/publicMinutes\s*:\s*number/);
assert.match(settings,/DEFAULT_LIKE_BATCH_TIMING_416\s*=\s*\{\s*privateMinutes\s*:\s*5\s*,\s*publicMinutes\s*:\s*5/);
assert.match(panel,/모든 사용자 공개숫자 공동 집계/);
assert.match(panel,/이미 진행 중인 개인 대기·공동 집계 창은 이전 주기를 유지합니다/);

assert.doesNotMatch(finalPublisher,/publicMinutes/);
assert.match(finalPublisher,/await notifySettledPublicLikes416\(/);
assert.match(finalPublisher,/publicNotified416:true/);

assert.match(entry,/const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 5 \* 1000/);
assert.match(entry,/const settledAggregate418 = await baseWorker\.scheduled/);
assert.match(entry,/await repairSharedPublicLikeCounts191\(this\.env\)/);
assert.match(patch056,/reconcileExplorePublicLikes056\(env\)/);
assert.match(patch065,/patchSharedFeedLikeCounts065\(env, changedItems\)/);

assert.match(contract,/canonical queue drain을 300s 늦추지 않는다/);
assert.match(contract,/canonical .*likes.* 및 .*track_stats.*와 .*repairSharedPublicLikeCounts191.*를/);
assert.match(contract,/canonical\/private ack와 public projection materialization 분리/);
assert.match(contract,/first80 밖의 곡 누락 금지/);

console.log('STAGE416_PUBLIC_SETTING_EXISTS_BUT_RUNTIME_UNUSED=PASS');
console.log('STAGE416_PUBLIC_SIGNAL_IS_CURRENTLY_IMMEDIATE_AFTER_PRIVATE_FINAL=PASS');
console.log('STAGE416_CANONICAL_AND_PUBLIC_R2_PROJECTION_CURRENTLY_COUPLED=PASS');
console.log('STAGE416_NAIVE_5S_TO_5MIN_TIMER_CHANGE_FORBIDDEN=PASS');
console.log('STAGE416_PUBLIC_CHANGED_ID_SOURCE_MUST_EXCEED_FIRST80=PASS');
console.log('STAGE416_PUBLIC_5MIN_GAP_PROVEN=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
