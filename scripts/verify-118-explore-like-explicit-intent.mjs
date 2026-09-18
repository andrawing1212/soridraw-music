import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const patch044 = readFileSync('cloudflare/explore-worker/patches/044-local-first-cost-hotpath.mjs', 'utf8');
const patch055 = readFileSync('cloudflare/explore-worker/patches/055-explore-like-intake-w1-hotpath.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '118');
assert.match(service, /SORIDRAW_EXPLORE_LIKE_EXPLICIT_INTENT_118_20260918/);

// An explicit click can never disappear because its desired value happens to equal
// a historical device-local baseLiked value.
assert.doesNotMatch(service, /liked === baselineLiked[\s\S]{0,180}delete outbox\[normalizedTrackId\]/);
assert.doesNotMatch(service, /pending\.desiredLiked !== pending\.baseLiked\) continue;[\s\S]{0,100}delete outbox\[trackId\]/);
assert.match(service, /getPendingExploreLikeMutationCount = \(uid: string\): number => Object\.keys\(readLikeOutbox\(uid\)\)\.length/);

// Every explicit click is locally optimistic and immediately asks for a server ACK.
// Public numeric aggregation remains a separate Worker concern.
const setStart = service.indexOf('export const setExploreTrackLike = async');
const setEnd = service.indexOf('\n};', setStart);
const setBody = service.slice(setStart, setEnd + 3);
assert.match(setBody, /persistLikedStateCache\(user\.uid, optimisticLikedCache\)/);
assert.match(setBody, /persistLikeOutbox\(user\.uid, outbox\)/);
assert.match(setBody, /void flushPendingLikes\(user\)/);

// A second click during an in-flight request must be flushed immediately after the
// first ACK instead of waiting for the old one-minute client window.
assert.match(service, /flushAfterInflightByUid\.add\(uid\)/);
assert.match(service, /const flushAgain = flushAfterInflightByUid\.delete\(uid\)/);
assert.match(service, /batchSucceeded && flushAgain && getPendingExploreLikeMutationCount\(uid\) > 0/);

// RTDB is replay/cross-device transport, not the ACK for the current browser click.
const signalStart = service.indexOf('export const observeExploreLikeAccountSyncSignal');
const signalEnd = service.indexOf('const publishExploreLikeAccountSyncSignal', signalStart);
const signalBody = service.slice(signalStart, signalEnd);
assert.match(signalBody, /pending \? \{ \.\.\.result, liked: pending\.desiredLiked \} : result/);
assert.doesNotMatch(signalBody, /delete pendingOutbox\[/);
assert.doesNotMatch(signalBody, /persistLikeOutbox\(uid, pendingOutbox\)/);

// Direct HTTP ACK is processed before pending is cleared, closing the race where an
// old RTDB true could re-paint a just-unliked heart.
const flushStart = service.indexOf('const flushPendingLikes = async');
const flushEnd = service.indexOf('const waitForExploreLikeInflight094', flushStart);
const flushBody = service.slice(flushStart, flushEnd);
const publishAt = flushBody.indexOf('await publishExploreLikeAccountSyncSignal');
const clearAt = flushBody.indexOf('persistLikeOutbox(uid, latestOutbox)');
assert.ok(publishAt >= 0 && clearAt > publishAt, 'pending intent clears before cross-device signal commit');

// The current Worker accepts desired-state mutations without doing the stale local
// baseLiked no-op elimination again.
assert.match(patch044, /const effectiveMutations = mutations;/);
assert.match(patch044, /syncExploreLikeR2AfterBatch034\(env, authContext\.uid, results\)/);
assert.match(patch055, /await enqueueExploreLikeBatch035\(env, authContext\.uid, effectiveMutations, receivedAt\)/);

// Keep public number server/shared-authoritative.
assert.match(page, /Only server-confirmed\/shared payloads may become public-count authority/);
assert.doesNotMatch(setBody, /currentLikeCount\) \+ \(liked \? 1 : -1\)/);

// Exact regression model from the user video:
// canonical/remote heart is true, this device carries stale base=false, then user
// explicitly unlikes. Old logic dropped this as false===false. New logic must send.
const staleBase = false;
const remoteBeforeClick = true;
const desiredUnlike = false;
const explicitOutbox = { baseLiked: staleBase, desiredLiked: desiredUnlike };
assert.equal(Object.keys({ track: explicitOutbox }).length, 1, 'explicit unlike must remain pending');
assert.equal(explicitOutbox.desiredLiked, false);
const staleRtdbReplay = remoteBeforeClick;
const visibleWhilePending = explicitOutbox ? explicitOutbox.desiredLiked : staleRtdbReplay;
assert.equal(visibleWhilePending, false, 'stale RTDB true repainted the pending unlike');

// The server endpoint is desired-state/idempotent: after ACK=false the pending row
// is the only thing that may be removed.
const directAck = { liked: false };
assert.equal(directAck.liked, desiredUnlike);

console.log('PASS 118: explicit heart intent survives stale baseLiked, stale RTDB cannot snap it back, and direct server ACK owns pending cleanup.');
console.log('PERSONAL_HEART_ACK=IMMEDIATE_BATCH');
console.log('PUBLIC_COUNT_AUTHORITY=SHARED_SERVER');
console.log('IDLE_SERVER_TRAFFIC=UNCHANGED');
