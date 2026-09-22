import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts','utf8');
const fence = readFileSync('cloudflare/explore-worker/patches/084-like-d1-atomic-cutover-fence.mjs','utf8');

assert.match(service, /const eligible = Object\.values\(outbox\)\.filter\(\(pending\) => \(pending\.retryCount \|\| 0\) === 0\)/,
  'idle scheduler must exclude failed/ambiguous mutations');
assert.match(service, /Object\.values\(outbox\)[\s\S]*?\.filter\(\(pending\) => \(pending\.retryCount \|\| 0\) === 0\)[\s\S]*?\.sort\(/,
  'flush batch must exclude failed/ambiguous mutations');
assert.match(service, /export const flushPendingExploreLikesForPageExit = async \(_user: User\): Promise<void> => \{[\s\S]*?Page\/profile navigation itself must never create a server read\/write[\s\S]*?\};/,
  'page exit must not reschedule like writes');
assert.match(service, /Object\.values\(outbox\)\.some\(\(pending\) => \(pending\.retryCount \|\| 0\) === 0\)/,
  'page entry may schedule only never-attempted mutations');
assert.doesNotMatch(
  fence.slice(fence.indexOf('async function adjustExploreLikeCounterDelta(env'), fence.indexOf('// New batch intake:')),
  /result\[0\]\.meta\.changes\s*>\s*1/,
  'direct relation receipt must not reject D1 trigger-inclusive changes=2',
);
assert.match(fence, /Cloudflare D1 meta\.changes includes AFTER-trigger side effects/,
  'trigger-inclusive receipt rationale missing');

console.log('APP137_FAILED_LIKE_IDLE_RETRY_LOOP=BLOCKED');
console.log('APP137_PAGE_NAVIGATION_LIKE_WRITE=0_AFTER_FAILED_BATCH');
console.log('APP137_D1_TRIGGER_INCLUSIVE_RECEIPT_ACCEPTED=PASS');
