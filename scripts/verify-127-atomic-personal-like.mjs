import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const collection = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const legacyPatch = readFileSync('cloudflare/explore-worker/patches/072-personal-like-r2-revision.mjs', 'utf8');

assert.ok(Number(version.version) >= 127, '127 atomic personal-like contract requires app version 127 or newer');
assert.match(service, /SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920/);
assert.match(page, /SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920/);
assert.match(service, /EXPLORE_LIKE_BASELINE_127/);
assert.match(service, /EXPLORE_LIKE_SIGNAL_SEEN_127/);
assert.match(service, /EXPLORE_LIKE_SIGNAL_RETRY_127/);
assert.match(service, /EXPLORE_LIKE_SIGNAL_GAP_127/);
assert.ok(service.includes('/v1/me/social-snapshot'));
assert.match(service, /!Array\.isArray\(payload\?\.data\?\.likedTrackIds\)/);
assert.match(service, /Promise<ExploreLikeBaselineSnapshot161>/);
assert.match(service, /complete: boolean/);
assert.match(service, /exactLikeCount: number \| null/);
assert.match(service, /if \(readSeenLikeSignal127\(uid\) !== versionAtStart \|\|/);
assert.match(service, /readRepairTarget127\(uid\) !== repairAtStart/);
assert.match(service, /markSeenLikeSignal127\(uid, repairAtStart\)/);
assert.match(service, /writeLikeLocal127\(scopedLikeKey127\(EXPLORE_LIKE_REPAIR_TARGET_127, uid\), ''\)/);
assert.match(service, /baselineCompleted127\.add\(uid\)/);
assert.match(service, /reconcileExploreLikedTrackCollectionSnapshot127/);
assert.match(service, /EXPLORE_LIKE_PARTIAL_BASELINE_161/);
assert.match(service, /EXPLORE_LIKE_TARGETED_VERIFIED_127/);
assert.match(service, /readTargetedVerifiedLikeTracks127/);
assert.match(service, /persistTargetedVerifiedLikeTracks127/);
assert.match(service, /clearTargetedVerifiedLikeTracks127/);
assert.match(service, /EXPLORE_LIKE_TARGETED_VERIFIED_130/);
assert.match(service, /readCurrentPersonalLikeRevision130/);
assert.match(service, /targetedVerifiedRevisionByUid130/);

assert.match(service, /const baselineReady127 = baselineCompleted127\.has\(user\.uid\)/,
  'verified complete catalog must remain zero-read authority on normal entry');
assert.match(service, /const missing = baselineReady127 \? \[\] : normalized\.filter/,
  'verified complete Explore entry must not issue targeted D1 membership reads');
assert.match(service, /return !cache\.has\(trackId\);/,
  'partial catalog may verify only previously unknown visible IDs');
assert.match(service, /Legacy partial R2 is a positive catalog hint/,
  'partial legacy R2 may merge positive catalog hints without forcing page-entry D1 scans');
assert.doesNotMatch(service, /currentRevision && !partial161/,
  'app update/partial marker must not discard a revision-bound local catalog');

assert.match(service, /String\(raw\?\.revision \|\| ''\) === currentRevision/);
assert.match(service, /JSON\.stringify\(\{ revision: currentRevision, trackIds: bounded \}\)/);
assert.match(service, /SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_ACK_RESTORE_131_20260922/);
assert.match(service, /acceptedForSignal127\.push\(accepted\)/);
assert.match(service, /EXPLORE_LIKE_PARTIAL_BASELINE_161, uid\), ''\)/);
assert.doesNotMatch(service, /좋아요 저장은 접수됐지만 다른 기기 동기화는 확인 중이에요/);
assert.match(service, /payload\.data\.likesComplete === true/);
assert.match(service, /exactLikeCount === likedTrackIds\.length/);
assert.match(service, /if \(!snapshot161\.complete\)/);
assert.match(service, /writeLikeLocal127\(scopedLikeKey127\(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid\), '1'\)/);
assert.match(service, /writeLikeLocal127\(scopedLikeKey127\(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid\), ''\)/);
assert.doesNotMatch(service, /likedIds\.length >= 2000/,
  '161 must use explicit exact metadata, not the old size heuristic');
assert.match(service, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(collection, /reconcileExploreLikedTrackCollectionSnapshot127/);
assert.match(collection, /cache\.canonicalLikedTrackIds = \[\.\.\.next\]/);
assert.match(collection, /export const seedExploreLikedTrackCandidates129 =/);
assert.match(collection, /const next = new Set\(cache\.canonicalLikedTrackIds \|\| \[\]\)/);
assert.match(service, /seedExploreLikedTrackCandidates129\(uid, likedIds\)/);
assert.ok(
  service.indexOf('seedExploreLikedTrackCandidates129(uid, likedIds)') <
    service.indexOf("writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid), '1')"),
  'partial R2 IDs must be retained as candidates before the partial marker is stored',
);
assert.match(service, /export const getExploreKnownLikeCandidateIds127 =/);
assert.match(service, /if \(readExploreTrackLikeMembership127\(normalizedUid, trackId\) === true\)/);
const collectionReconcile129 = service.slice(
  service.indexOf('export const reconcileExploreLikedTrackCollectionState ='),
  service.indexOf('export const setExploreTrackLike ='),
);
assert.doesNotMatch(collectionReconcile129, /cache\.set\(/,
  'My Likes collection must never overwrite heart membership authority');
assert.match(collection, /authoritativeLikedTrackIds\?: string\[\]/);
assert.match(collection, /const explicitAuthority = Array\.isArray\(authoritativeLikedTrackIds\)/);
assert.match(page, /getExploreKnownLikeCandidateIds127\(user\.uid\)/);
assert.match(page, /await getExploreLikedTrackIds\(user, candidates\.slice\(start, start \+ 50\)\)/);
assert.match(page, /const rows = await getExploreLikedTracks\(user, effectiveLikedTrackIds\)/);
assert.match(page, /rememberExploreLikedTrack\(/);


const getter = service.slice(service.indexOf('export const getExploreLikedTrackIds = async'),service.indexOf('export const reconcileExploreLikedTrackCollectionState'));
assert.match(getter, /await ensurePersonalLikeBaseline127\(user\)/);
assert.match(getter, /const verified127 = readTargetedVerifiedLikeTracks127\(user\.uid\)/);
assert.match(getter, /const baselineReady127 = baselineCompleted127\.has\(user\.uid\)/);
assert.match(getter, /if \(baselineReady127\) \{[\s\S]*?cache\.set\(trackId, false\);[\s\S]*?persistLikedStateCache\(user\.uid, cache\);/);
assert.match(getter, /const missing = baselineReady127 \? \[\] : normalized\.filter/);
assert.match(getter, /return !cache\.has\(trackId\);/);
assert.match(getter, /readLikeOutbox\(user\.uid\)/);
assert.match(getter, /const currentOutbox127 = readLikeOutbox\(user\.uid\)/);
assert.match(getter, /const currentUnresolved127 = readSnapshotPending127\(user\.uid\)/);
assert.match(getter, /if \(currentOutbox127\[trackId\] \|\|/);
assert.match(getter, /Object\.prototype\.hasOwnProperty\.call\(currentUnresolved127, trackId\)/);
assert.ok(getter.indexOf('const currentOutbox127 =') > getter.indexOf('await requestExploreLike(user,'),
  'late API payload must re-read pending state after network request');
assert.match(getter, /cache\.set\(trackId, likedIds\.has\(trackId\)\)/);
assert.match(getter, /verified127\.add\(trackId\)/);
assert.match(getter, /persistTargetedVerifiedLikeTracks127\(user\.uid, verified127\)/);
assert.match(getter, /outbox\[trackId\]\?\.desiredLiked \?\? unresolved\[trackId\] \?\? cache\.get\(trackId\) === true/);

const membershipStart127 = service.indexOf('export const readExploreTrackLikeMembership127 =');
const membershipEnd127 = service.indexOf('\n};', membershipStart127) + 3;
const membership127 = service.slice(membershipStart127, membershipEnd127);
assert.match(membership127, /baselineReady/);
assert.match(membership127, /readTargetedVerifiedLikeTracks127\(uid\)\.has\(id\)/);
assert.match(membership127, /return getLikedStateCache\(uid\)\.get\(id\)/);

const listener = service.slice(service.indexOf('const applyRemoteLikeSignal127'), service.indexOf('const readSignalRetry127'));
// The frozen app382 listener skips an unsent LOCAL intention; a historical
// deferredSignal390 branch was removed before Stage408 and is not an authority.
assert.match(listener, /if \(pending\[item\.trackId\]\) continue;/);
assert.match(listener, /const pending = readLikeOutbox\(uid\)/);
assert.doesNotMatch(listener, /pending\[item\.trackId\] \|\| Object\.prototype\.hasOwnProperty\.call\(unresolved, item\.trackId\)/,
  'a previous accepted-but-unsettled value must not suppress a newer cross-device ACK');
assert.match(listener, /cache\.set\(item\.trackId, item\.liked\)/);
assert.match(listener, /patchExploreLikedTrackMembership\(uid, item\.trackId, item\.liked\)/);
assert.match(listener, /unresolved\[item\.trackId\] = item\.liked/,
  'accepted device state must outrank a partial legacy R2/D1 snapshot');
assert.match(listener, /persistLikeDisplayLocks\(uid, displayLocks\)/,
  'accepted remote count must survive an Explore remount or early RTDB event');
assert.match(listener, /acceptedForUi141\.push\(\{ \.\.\.item, uid, source: 'remote' \}\)/);
assert.match(listener, /acceptedForUi141\.forEach\(dispatchLikeSync\)/);
assert.ok(
  listener.indexOf('writeSnapshotPending127(uid, unresolved)') <
    listener.indexOf('acceptedForUi141.forEach(dispatchLikeSync)'),
  'remote changed-track UI must observe durable membership before notification',
);
assert.doesNotMatch(listener, /if \(cache\.get\(item\.trackId\) === item\.liked\) continue/,
  'an unchanged heart must not suppress a changed accepted public count');
assert.doesNotMatch(listener, /lastSeen === 0 && baselineAlreadyVerified/,
  'the first retained account signal must not be discarded just because an older R2 baseline exists');
assert.match(listener, /onValue\(/);
assert.match(listener, /onAuthStateChanged\(auth/);
assert.doesNotMatch(listener, /\.prepare\(|firebase\/firestore|setInterval\(/);
assert.match(listener, /signal\.previousVersion !== lastSeen/);
assert.match(listener, /const needsRepair = gap \|\| readRepairTarget127\(uid\) > 0;/);
assert.ok(listener.indexOf('const needsRepair = gap || readRepairTarget127(uid) > 0;') < listener.indexOf('const pending = readLikeOutbox(uid)'),
  'gap must be recorded before applying retained exact rows');
assert.doesNotMatch(
  listener.slice(listener.indexOf('const needsRepair = gap || readRepairTarget127(uid) > 0;'), listener.indexOf('const pending = readLikeOutbox(uid)')),
  /\breturn\s*;/,
  'current retained exact rows must not be discarded merely because an older interval was missed',
);
assert.ok(
  listener.indexOf('markSeenLikeSignal127(uid, signal.version)') <
    listener.indexOf('void ensurePersonalLikeBaseline127(current)', listener.indexOf('markSeenLikeSignal127(uid, signal.version)')),
  'exact changed-track rows must be applied before the R2 gap repair',
);
assert.match(listener, /invalidate|EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT/);

const flush = service.slice(service.indexOf('flushPendingLikes = async'), service.indexOf('// App 120 deliberately ignores historical RTDB'));
assert.match(flush, /acceptedForSignal127/);

assert.match(flush, /operationId: pending\.operationId/, 'stable ID must accompany the batch request');
assert.match(flush, /if \(!mutation\.operationId\)/, 'legacy outbox ID must be backfilled once');
assert.match(flush, /if \(upgradedLegacyOutbox144\) persistLikeOutbox\(uid, outbox\)/,
  'backfilled operation ID must be saved before the HTTP request');
assert.ok(flush.indexOf('persistLikeOutbox(uid, outbox)') < flush.indexOf("requestExploreLike(user, '/v1/me/likes/batch'"),
  'persist before transport');
assert.match(service, /operationId: createExploreLikeOperationId144\(\)/,
  'every new click must receive a new stable operation ID');
assert.match(service, /operationId: typeof row\.operationId === 'string'/,
  'persisted ID must survive local cache normalization');
const operationStart144 = service.indexOf('export const createExploreLikeOperationId144 =');
const operationEnd144 = service.indexOf('\n};', operationStart144) + 3;
assert.ok(operationStart144 > 0 && operationEnd144 > operationStart144);
const operationJS144 = ts.transpileModule(
  service.slice(operationStart144, operationEnd144).replace(/^export /, '') +
    '\nreturn createExploreLikeOperationId144;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
).outputText;
let generated144 = 0;
const makeOperation144 = new Function('crypto', operationJS144)({
  randomUUID: () => '00000000-0000-4000-8000-' + String(++generated144).padStart(12, '0'),
});
assert.notEqual(makeOperation144(), makeOperation144(), 'two clicks must differ');
assert.equal(generated144, 2, 'a retry must reuse its stored ID, not call generator again');

assert.match(flush, /const sentByTrack127 = new Map\(batchEntries\.map\(\(pending\) => \[pending\.trackId, pending\.desiredLiked\]\)\)/);
assert.match(flush, /row\.status !== 'revision-conflict'/);
assert.match(flush, /row\.status !== 'ineligible'/);
assert.match(flush, /sentByTrack127\.get\(row\.trackId\) !== row\.liked/);
assert.ok(flush.indexOf('const sentByTrack127 =') < flush.indexOf('const latest = readLikeOutbox(uid);', flush.indexOf('const sentByTrack127 =')),
  'unexpected reply mismatch must abort before any accepted outbox is cleared');
const replyMatches127 = (sent, returned) => !returned.some((row) =>
  row.status !== 'revision-conflict' &&
  row.status !== 'ineligible' &&
  sent.get(row.trackId) !== row.liked
);
assert.equal(replyMatches127(new Map([['song', true]]), [{ trackId: 'song', liked: true }]), true);
assert.equal(replyMatches127(new Map([['song', true]]), [{ trackId: 'song', liked: false }]), false);
assert.equal(replyMatches127(new Map([['song', false]]), [{ trackId: 'song', liked: true }]), false);
assert.equal(replyMatches127(new Map([['song', true]]), [{ trackId: 'song', liked: false, status: 'revision-conflict' }]), true);
assert.equal(replyMatches127(new Map([['song', true]]), [{ trackId: 'song', liked: false, status: 'ineligible' }]), true);
assert.match(flush, /persistLikeCanonicalRevisions172\(uid, canonicalRevisions172\)/);
assert.match(flush, /expectedRevision: pending\.expectedRevision \?\? 0/);
assert.match(flush, /result\.status === 'revision-conflict'/);
assert.match(flush, /source: 'remote'/);
assert.match(flush, /hasNewerPending && current/);
assert.match(flush, /latest\[pending\.trackId\] = rebaseExploreLikeAfterInFlight127\(current, pending\)/);
assert.match(flush, /current && current\.updatedAt > pending\.updatedAt/);
// Current canonical-revision ACK rebases from the server-returned liked/count/revision.
 // The legacy fallback helper remains for revisionless ACK and ambiguous failure;
 // requiring four textual helper calls would reject the safer revision-based path.
assert.match(flush, /if \(hasNewerPending && current\) \{/);
assert.match(flush, /expectedRevision: Number\(result\.revision\)/);
assert.match(flush, /baseLiked = result\.liked/);
assert.match(flush, /baseLikeCount = canonicalLikeCount/);
assert.match(flush, /latest\[pending\.trackId\] = rebaseExploreLikeAfterInFlight127\(current, pending\)/);
assert.ok(
  (flush.match(/rebaseExploreLikeAfterInFlight127\(current, pending\)/g) || []).length >= 2,
  'revisionless ACK and ambiguous failure must still preserve a newer explicit click',
);
assert.match(flush, /const canonicalLikeSettled127 =\s*\n\s*payload\?\.data\?\.canonicalD1 === 'settled' \|\|\s*\n\s*canBroadcastExploreLikeSnapshot127\(payload\?\.data\?\.personalLikeSnapshot\)/,
  'canonical D1 settlement must outrank derived R2 publication state');
assert.match(flush, /if \(canonicalLikeSettled127\) \{/);
assert.match(flush, /snapshotPending127\[pending\.trackId\] = result\.liked/);
assert.match(flush, /writeSnapshotPending127\(uid, snapshotPending127\)/);
assert.ok(flush.indexOf('writeSnapshotPending127(uid, snapshotPending127)') <
  flush.indexOf('persistLikeOutbox(uid, latest);',flush.indexOf('writeSnapshotPending127(uid, snapshotPending127)')),
  'persist the unmaterialized state before clearing accepted D1 outbox');
assert.doesNotMatch(flush, /if \(!canonicalLikeSettled127 && batchEntries\[0\]\)/,
  'server-accepted account heart must not wait on a settled flag that current Worker never emits');
assert.ok(
  flush.indexOf('acceptedForSignal127.push(accepted)') < flush.indexOf('if (canonicalLikeSettled127) {'),
  'accepted account state must be queued for cross-device sync before canonical aggregate settlement gating',
);
assert.match(flush, /dispatchLikeSync\(\{ \.\.\.accepted, source: canonicalLikeSettled127 \? 'confirmed' : 'local' \}\)/);
assert.match(flush, /persistLikedStateCache\(uid, cache\)/);
assert.match(flush, /persistLikeOutbox\(uid, latest\)/);
assert.ok(flush.indexOf('persistLikeOutbox(uid, latest);') < flush.indexOf('await publishConfirmedLikeSignal127(uid, acceptedForSignal127)'), 'publish only after durable batch ACK');
assert.match(flush, /catch \(notifyError\)/);
assert.match(flush, /signal pending retry/);
assert.equal((flush.match(/\/v1\/me\/likes\/batch/g)||[]).length,1,'only one D1 intake request per 30s batch');
assert.doesNotMatch(flush, /runTransaction\(/);

const publish = service.slice(service.indexOf('const publishConfirmedLikeSignal127'), service.indexOf('let likeSignalRetryListenerInstalled127'));
assert.match(publish, /setRealtimeValue\(/,
  'app140 live changed-track signal must use the proven RTDB set transport');
assert.match(publish, /const previousVersion = Math\.max\(0, readSeenLikeSignal127\(uid\)\)/);
assert.match(publish, /const version = Math\.max\(Date\.now\(\), previousVersion \+ 1\)/);
assert.match(publish, /previousVersion: forceGap \? 0 : previousVersion/);
assert.match(publish, /markSeenLikeSignal127\(uid, version\)/);
assert.match(publish, /if \(pending\.size > EXPLORE_LIKE_SIGNAL_MAX_127\)/);
assert.ok(publish.indexOf('const task = signalPublishInFlight127.get(uid)') < publish.indexOf('saveSignalRetry127(uid, rows)'), 'in-flight notification must serialize before durable queue mutation');
assert.match(publish, /EXPLORE_LIKE_SIGNAL_MAX_127/);
assert.match(publish, /saveSignalRetry127\(uid, rows\)/);
assert.doesNotMatch(publish, /runTransaction\(|firebase\/firestore|env\.DB|requestExploreLike\(|fetch\(/);

assert.ok(rules.rules.userSync.$uid.exploreLike, 'existing UID-scoped like signal rules required');
assert.match(page, /readExploreTrackLikeMembership127\(user\.uid, track\.id\)/);
assert.match(service, /computeExploreLikeAction127\(baseLiked, liked, baseLikeCount\)/);
assert.match(service, /normalizeExploreLikeDisplayPair129/);
assert.match(page, /const pair129 = normalizeExploreLikeDisplayPair129\(liked129, (?:track|authorityTrack217)\.likeCount\)/);
assert.match(page, /Heart \+ count are one accepted like atom/);
assert.match(service, /readExploreTrackLikeMembership127\(uid, normalizedTrackId\) \?\? !liked/);
assert.match(service, /const now = nextExploreLikeMutationAt127\(existing\?\.updatedAt \|\| 0, Date\.now\(\)\)/);
const clockStart127 = service.indexOf('export const nextExploreLikeMutationAt127 =');
// The 144 exported UUID helper now follows the clock: do not feed the other
// ES-module export into an isolated new Function() CommonJS transpilation.
const clockEnd127 = service.indexOf('export const createExploreLikeOperationId144 =', clockStart127);
assert.ok(clockStart127 > 0 && clockEnd127 > clockStart127);
const clockSource127 = service.slice(clockStart127, clockEnd127)
  .replace('export const nextExploreLikeMutationAt127', 'const nextExploreLikeMutationAt127');
const clockJs127 = ts.transpileModule(clockSource127 + '; return nextExploreLikeMutationAt127;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const nextMutationAt127 = new Function(clockJs127)();
assert.equal(nextMutationAt127(100, 100), 101, 'same-ms second click must be distinguishable');
assert.equal(nextMutationAt127(101, 100), 102, 'clock rollback must not revive an older ACK');
assert.equal(nextMutationAt127(50, 200), 200, 'normal clock progression stays unchanged');
assert.match(service, /EXPLORE_LIKE_SNAPSHOT_PENDING_127/);
assert.match(service, /outbox\[id\]\?\.desiredLiked \?\? unresolved\[id\] \?\? confirmed\.has\(id\)/);
assert.match(service, /readSnapshotPending127\(uid\)/);
const gateSource = service.slice(service.indexOf('export const canBroadcastExploreLikeSnapshot127 ='),
  service.indexOf('const readSnapshotPending127 =')).replace('export const canBroadcastExploreLikeSnapshot127', 'const canBroadcastExploreLikeSnapshot127');
const gateJs = ts.transpileModule(gateSource + '; return canBroadcastExploreLikeSnapshot127;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const canBroadcast = new Function(gateJs)();
assert.equal(canBroadcast('updated'), false, 'R2 cache update precedes final canonical D1 application');
assert.equal(canBroadcast('settled'), true, 'reserved for a future independently verified canonical settlement proof');
assert.equal(canBroadcast('pending'), false);
assert.equal(canBroadcast(undefined), false, 'legacy Worker response cannot be treated as materialized');
assert.equal(canBroadcast('failed'), false);
const transitionStart = service.indexOf('const clampLikeCount =');
const transitionEnd = service.indexOf('const readLikedStateStorage =', transitionStart);
assert.ok(transitionStart > 0 && transitionEnd > transitionStart);
const transitionSource = service.slice(transitionStart, transitionEnd)
  // Strip *all* exports in this extracted helper block: it also contains
  // exported clock/UUID helpers, and new Function has no CommonJS exports.
  .replaceAll('export const ', 'const ');
const js = ts.transpileModule(transitionSource + '; return computeExploreLikeAction127;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const compute = new Function(js)();
assert.deepEqual(compute(false, true, 0), { liked: true, likeCount: 1 });
assert.deepEqual(compute(false, true, 1), { liked: true, likeCount: 2 }, 'retain another user\'s like');
assert.deepEqual(compute(true, false, 2), { liked: false, likeCount: 1 }, 'unlike only the current user');
assert.deepEqual(compute(true, false, 1), { liked: false, likeCount: 0 });
assert.deepEqual(compute(false, false, 1), { liked: false, likeCount: 1 }, 'a non-owner with public count one stays unliked');
assert.deepEqual(compute(true, true, 1), { liked: true, likeCount: 1 }, 'repeating the same state changes neither count nor heart');
assert.deepEqual(compute(true, true, 0), { liked: true, likeCount: 1 }, 'filled heart can never render with zero total');
assert.deepEqual(compute(true, false, 0), { liked: false, likeCount: 0 }, 'stale impossible zero is repaired before unlike delta');
assert.deepEqual(compute(false, false, 0), { liked: false, likeCount: 0 }, 'unliked zero remains zero');

// An in-flight true can reach canonical D1 after the same user's later false.
// Compare the later intent against the earlier accepted desired state rather
// than its original baseline, or the unlike is dropped as a false/false no-op.
const rebaseStart127 = service.indexOf('const rebaseExploreLikeAfterInFlight127 =');
const rebaseEnd127 = service.indexOf('\n\nflushPendingLikes = async', rebaseStart127);
assert.ok(rebaseStart127 > 0 && rebaseEnd127 > rebaseStart127);
const rebaseSource127 = service.slice(rebaseStart127, rebaseEnd127);
const rebaseJs127 = ts.transpileModule(rebaseSource127 + '; return rebaseExploreLikeAfterInFlight127;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const rebase = new Function('computeExploreLikeAction127', rebaseJs127)(compute);
const firstInflight = {
  trackId: 'song', ownerUid: 'owner', baseLiked: false, desiredLiked: true,
  baseLikeCount: 0, optimisticLikeCount: 1, queuedAt: 100, updatedAt: 101, retryCount: 0,
};
const secondUnlike = { ...firstInflight, desiredLiked: false, optimisticLikeCount: 0, updatedAt: 102 };
const rebasedUnlike = rebase(secondUnlike, firstInflight);
assert.equal(rebasedUnlike.baseLiked, true);
assert.equal(rebasedUnlike.desiredLiked, false);
assert.equal(rebasedUnlike.optimisticLikeCount, 0);
assert.equal(rebasedUnlike.updatedAt, 102);
assert.notEqual(rebasedUnlike.desiredLiked, rebasedUnlike.baseLiked,
  'final unlike must still be transmitted after older like ACK or lost response');
const thirdRelike = rebase({ ...secondUnlike, desiredLiked: true, updatedAt: 103 }, firstInflight);
assert.equal(thirdRelike.desiredLiked, thirdRelike.baseLiked,
  'third click to like is correctly coalesced with first accepted like');
const unrelatedUserCount = rebase({ ...secondUnlike, optimisticLikeCount: 3 }, { ...firstInflight, optimisticLikeCount: 4 });
assert.equal(unrelatedUserCount.optimisticLikeCount, 3, 'rebase must preserve other users\' likes');
assert.match(page, /if \(currentLiked === undefined\)/);
assert.match(page, /likedTrackIds\[track\.id\] === undefined/);
assert.match(page, /detail\?\.source !== 'remote'/);
assert.match(page, /const effectiveLiked127 = readExploreTrackLikeMembership127\(user\.uid, detail\.trackId\)/);
assert.match(page, /if \(effectiveLiked127 !== detail\.liked\) return/);
assert.match(page, /setLikedTrackIds\(\(previous\) => \(\{ \.\.\.previous, \[detail\.trackId!\]: pair129\.liked \}\)\)/);
assert.match(page, /const liked = readExploreTrackLikeMembership127\(user\.uid, id\) \?\? likedSet\.has\(id\)/);
assert.match(page, /verifiedMembership\.forEach\(\(liked, id\) => \{ next\[id\] = liked; \}\)/);
assert.doesNotMatch(page, /invalidateExplorePersonalLikeBaseline127\(user\.uid\)/);
assert.match(page, /checkExplorePersonalLikeRevision127\(user\)/);
assert.doesNotMatch(page, /window\.addEventListener\('focus', onResume\)/, 'app335 reload/focus must not spend a private-like revision Worker request');
assert.match(page, /document\.addEventListener\('visibilitychange', onResume\)/);
assert.match(service, /EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 \* 60_000/);
assert.match(service, /if \(previous !== revision\) \{/);
assert.match(service, /await ensurePersonalLikeBaseline127\(user\)/);
assert.match(service, /writeLikeLocal127\(key, revision\)/);
assert.match(service, /writeExploreLikeRevisionCheckAt334\(uid, Date\.now\(\) - EXPLORE_LIKE_LEGACY_CHECK_MS_127 \+ 30_000\)/);
assert.match(legacyPatch, /requireExploreAuth\(request\)/);
assert.match(legacyPatch, /bucket\.head\(exploreSharedLikesKey061\(authContext\.uid\)\)/);
assert.match(legacyPatch, /\/v1\/me\/likes-revision/);
const legacyHandler = legacyPatch.slice(legacyPatch.indexOf('const handler = ['), legacyPatch.indexOf('const anchorCount ='));
assert.doesNotMatch(legacyHandler, /env\.DB\.prepare\(|caches\.default|rebuildExploreLikeR2Bundle/);
assert.doesNotMatch(service.slice(service.indexOf('const applyRemoteLikeSignal127'),service.indexOf('let activeLikeSignalUid127')), /likeCount:\s*item\.liked\s*\?\s*1/);
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000/);
assert.match(service, /EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000/);
assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
console.log('127_PERSONAL_LIKE_SINGLE_MEMBERSHIP=PASS');
console.log('127_ATOMIC_TRANSITION_TESTS=PASS');
console.log('127_UNMATERIALIZED_SNAPSHOT_LOCAL_GUARD_NO_REMOTE_REPLAY=PASS');
console.log('127_LEGACY_R2_HEAD_GATED_AND_ACCOUNT_PRIVATE=PASS');
console.log('127_FAILED_REPAIR_RETRY_DURABLE=PASS');
console.log('127_FIRST_R2_BASELINE_VALIDATED_ONLY_ONCE=PASS');
console.log('127_REMOTE_SIGNAL_BOUNDED_50_PER_BATCH=PASS');
console.log('127_LOCAL_OUTBOX_OVERRIDES_OLD_REMOTE=PASS');
console.log('127_LATE_HYDRATION_PRESERVES_LOCAL_INTENT=PASS');
console.log('127_REMOTE_RENDER_GUARDED_BY_EFFECTIVE_MEMBERSHIP=PASS');
console.log('127_SAME_MS_ACK_LOCAL_REVISION=PASS');
console.log('127_INFLIGHT_LIKE_THEN_FINAL_UNLIKE_PRESERVED=PASS');
console.log('127_AMBIGUOUS_ACK_FOLLOWUP_NOT_DROPPED=PASS');
console.log('127_MISMATCHED_INTAKE_REPLY_RETAINS_LAST_INTENT=PASS');
console.log('144_OPERATION_ID_PERSISTED_RETRY_STABLE_AND_NEW_CLICK_UNIQUE=PASS');
console.log('129_HEART_COUNT_ONE_ATOM=PASS');
console.log('127_D1_MUTATION_ROUTE_UNCHANGED=PASS');
console.log('127_WORKER071_UNCHANGED=PASS');
console.log('127_NO_DEPLOY_OR_USER_DATA_MIGRATION=PASS');

const resumeStart134 = page.indexOf('const onResume = () => {');
const resumeEnd134 = page.indexOf('document.addEventListener(\'visibilitychange\', onResume)', resumeStart134);
assert.ok(resumeStart134 > 0 && resumeEnd134 > resumeStart134, 'Explore real-tab-resume block missing');
const resume134 = page.slice(resumeStart134, resumeEnd134);
assert.doesNotMatch(resume134, /likeHydrationKeyRef\.current = ''/,
  'cached tab resume must not reset like hydration and trigger another D1 membership read');
assert.match(resume134, /checkExplorePersonalLikeRevision127\(user\)/,
  'real tab resume may check only the tiny private revision');


// Stage416: exercise the real app357/359 parity orchestrator in isolation.
// A known-contiguous like signal must not turn a settlement-only My Likes
// navigation into a second authenticated full-repair snapshot. Genuine gaps
// still take the original repair path and keep all fail-closed guards.
const parityStart416 = service.indexOf('export const ensureExplorePersonalLikeCrossOriginParity357 = async (');
const parityEnd416 = service.indexOf('// SORIDRAW_EXPLORE_LIKE_LEGACY_R2_COMPAT_072_20260920', parityStart416);
assert.ok(parityStart416 > 0 && parityEnd416 > parityStart416, '416 parity owner missing');
const parityJS416 = ts.transpileModule(
  service.slice(parityStart416, parityEnd416).replace('export const ensureExplorePersonalLikeCrossOriginParity357', 'const ensureExplorePersonalLikeCrossOriginParity357'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const runParity416 = async ({ certified = 100, settled = 0, pending = true } = {}) => {
  const calls = [];
  let guards = pending ? { 'track-pending': true } : {};
  const latest = 100;
  const context = {
    hasLikedStateStorage127: () => true,
    readLastRetainedLikeSignal357: () => latest,
    readCrossOriginLikeCertified357: () => certified,
    readCrossOriginLikeSettled359: () => settled,
    readCrossOriginLikeSettlementAttempted359: () => 0,
    readCrossOriginLikeAttempted358: () => 0,
    isCrossOriginLikeRetryDeferred416: () => false,
    deferCrossOriginLikeRetry416: () => calls.push('defer-416'),
    EXPLORE_LIKE_CROSS_ORIGIN_RETRY_AFTER_416: 'retry-416',
    shouldRepairPersonalLikeOrigin357: ({ latestSignalVersion, certifiedSignalVersion }) =>
      certifiedSignalVersion < latestSignalVersion,
    shouldAttemptPersonalLikeOriginSettlement359: ({ latestSignalVersion, settledSignalVersion, attemptedSignalVersion }) =>
      latestSignalVersion > settledSignalVersion && latestSignalVersion > attemptedSignalVersion,
    shouldAttemptPersonalLikeOriginRepair358: () => true,
    markCrossOriginLikeAttempted358: () => calls.push('mark-358'),
    markCrossOriginLikeSettlementAttempted359: () => calls.push('mark-359'),
    crossOriginParityInFlight357: new Map(),
    requestRepair127: () => calls.push('repair-target'),
    writeLikeLocal127: (key, value) => calls.push('write:' + key + ':' + value),
    scopedLikeKey127: (key) => key,
    EXPLORE_LIKE_REPAIR_ATTEMPTED_182: 'repair-182',
    EXPLORE_LIKE_SETTLEMENT_ATTEMPTED_189: 'settlement-189',
    ensurePersonalLikeBaseline127: async (_user, revision) => {
      calls.push(revision ? 'baseline:settlement' : 'baseline:normal');
      if (revision) guards = {};
    },
    readSnapshotPending127: () => guards,
    requestPersonalLikeRevision127: async () => { calls.push('revision'); return 'rev-confirmed'; },
    invalidateExplorePersonalLikeBaseline127: () => calls.push('invalidate'),
    readRepairTarget127: () => 0,
    markCrossOriginLikeCertified357: () => calls.push('certified'),
    markCrossOriginLikeSettled359: () => calls.push('settled'),
  };
  const make = new Function(...Object.keys(context),
    parityJS416 + '\nreturn ensureExplorePersonalLikeCrossOriginParity357;');
  await make(...Object.values(context))({ uid: 'test-member' });
  return calls;
};
const settlementOnly416 = await runParity416({ certified: 100, settled: 0 });
assert.ok(settlementOnly416.includes('baseline:settlement'), '416 targeted settlement must remain');
assert.ok(!settlementOnly416.includes('repair-target'), '416 settlement-only must not request full canonical repair');
assert.ok(!settlementOnly416.includes('write:repair-182:'), '416 settlement-only must not rearm repair 182');
assert.ok(settlementOnly416.includes('settled'), '416 successful proof remains certified');
const genuineGap416 = await runParity416({ certified: 0, settled: 0 });
assert.ok(genuineGap416.includes('repair-target'), '416 genuine remote signal gap needs repair');
assert.ok(genuineGap416.includes('write:repair-182:'), '416 genuine gap retains full repair eligibility');
assert.ok(genuineGap416.includes('baseline:settlement'), '416 genuine gap also retains unsettled guard proof');
const healthy416 = await runParity416({ certified: 100, settled: 100 });
assert.equal(healthy416.length, 0, '416 healthy account re-entry must never recheck snapshot');
console.log('416_SETTLEMENT_ONLY_NO_EXTRA_FULL_REPAIR=PASS');
console.log('416_GENUINE_SIGNAL_GAP_STILL_REPAIRS=PASS');
console.log('416_HEALTHY_REENTRY_ZERO_REQUESTS=PASS');


// Stage416: exercise the real failed-gap cooldown helper and parity function,
// including the already-attempted app358 marker and repeated My Likes visits.
// The separate ensureBaseline call after parity must also honor the local gate.
const baselineGuard416 = service.slice(
  service.indexOf('const ensurePersonalLikeBaseline127 = async ('),
  service.indexOf('export const invalidateExplorePersonalLikeBaseline127'),
);
assert.match(baselineGuard416,
  /readRepairTarget127\(uid\) > 0 &&\s+isCrossOriginLikeRetryDeferred416\(uid, readLastRetainedLikeSignal357\(uid\)\)/,
  '416 follow-up baseline must not bypass failed-gap cooldown');
const helperStart416 = service.indexOf('const isCrossOriginLikeRetryDeferred416 = ');
const helperEnd416 = service.indexOf('const readCrossOriginLikeCertified357 = ', helperStart416);
assert.ok(helperStart416 > 0 && helperEnd416 > helperStart416);
const helperJS416 = ts.transpileModule(
  service.slice(helperStart416, helperEnd416),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const retryStore416 = new Map();
const retryCalls416 = [];
let retryClock416 = 1_000_000;
let retryLatest416 = 100;
let retryCertified416 = 0;
let retrySettled416 = 0;
let retryAttempted416 = 100; // the same signal was already attempted
let retryRepairTarget416 = 0;
let retryFail416 = true;
const retryContext416 = {
  Date: { now: () => retryClock416 },
  EXPLORE_LIKE_CROSS_ORIGIN_RETRY_AFTER_416: 'retry-416',
  EXPLORE_LIKE_CROSS_ORIGIN_RETRY_WAIT_MS_416: 60_000,
  EXPLORE_LIKE_BASELINE_127: 'baseline-127',
  scopedLikeKey127: (key, uid) => uid + ':' + key,
  readLikeLocal127: key => retryStore416.get(key) || '',
  writeLikeLocal127: (key, value) => retryStore416.set(key, value),
  hasLikedStateStorage127: () => true,
  readLastRetainedLikeSignal357: () => retryLatest416,
  readCrossOriginLikeCertified357: () => retryCertified416,
  shouldRepairPersonalLikeOrigin357: ({ latestSignalVersion, certifiedSignalVersion }) =>
    latestSignalVersion > certifiedSignalVersion,
  readCrossOriginLikeSettled359: () => retrySettled416,
  readCrossOriginLikeSettlementAttempted359: () => 100,
  shouldAttemptPersonalLikeOriginSettlement359: ({ latestSignalVersion, settledSignalVersion, attemptedSignalVersion }) =>
    latestSignalVersion > settledSignalVersion && latestSignalVersion > attemptedSignalVersion,
  crossOriginParityInFlight357: new Map(),
  readCrossOriginLikeAttempted358: () => retryAttempted416,
  shouldAttemptPersonalLikeOriginRepair358: ({ latestSignalVersion, attemptedSignalVersion }) =>
    latestSignalVersion > attemptedSignalVersion,
  markCrossOriginLikeAttempted358: (_uid, v) => { retryAttempted416 = v; },
  markCrossOriginLikeSettlementAttempted359: () => {},
  requestRepair127: () => { retryRepairTarget416 = retryLatest416; retryCalls416.push('full-rearm'); },
  EXPLORE_LIKE_REPAIR_ATTEMPTED_182: 'repair-182',
  EXPLORE_LIKE_SETTLEMENT_ATTEMPTED_189: 'settlement-189',
  ensurePersonalLikeBaseline127: async () => {
    retryCalls416.push('baseline');
    if (retryFail416) throw new Error('simulated transient network failure');
    retryRepairTarget416 = 0;
  },
  readSnapshotPending127: () => ({}),
  requestPersonalLikeRevision127: async () => 'revision',
  invalidateExplorePersonalLikeBaseline127: () => {},
  readRepairTarget127: () => retryRepairTarget416,
  markCrossOriginLikeCertified357: (_uid, v) => { retryCertified416 = v; },
  markCrossOriginLikeSettled359: (_uid, v) => { retrySettled416 = v; },
};
const retryFn416 = new Function(...Object.keys(retryContext416),
  helperJS416 + '\n' + parityJS416 +
  '\nreturn { visit: ensureExplorePersonalLikeCrossOriginParity357, deferred: isCrossOriginLikeRetryDeferred416 };'
)(...Object.values(retryContext416));
const retryVisit416 = async () => {
  try { await retryFn416.visit({ uid: 'test-member' }); } catch { /* offline-like failure */ }
};
await retryVisit416();
await retryVisit416();
await retryVisit416();
assert.equal(retryCalls416.filter(x => x === 'full-rearm').length, 1,
  '416 same signal must not rearm FULL repair on every page entry');
assert.equal(retryCalls416.filter(x => x === 'baseline').length, 1,
  '416 same signal must not repeatedly fetch baseline');
assert.equal(retryFn416.deferred('test-member', 101), false,
  '416 newer signal must bypass old retry cooldown');
retryClock416 += 60_001;
retryFail416 = false;
await retryVisit416();
assert.equal(retryCalls416.filter(x => x === 'full-rearm').length, 2,
  '416 genuine failure must become retryable after cooldown');
assert.equal(retryCertified416, 100, '416 recovered gap must certify signal');
assert.equal(retrySettled416, 100, '416 recovered gap must settle signal');
assert.equal(retryStore416.get('test-member:retry-416'), '',
  '416 successful recovery must clear retry marker');
await retryVisit416();
assert.equal(retryCalls416.filter(x => x === 'full-rearm').length, 2,
  '416 healthy revisit must remain network-free');
// A new retained event must escape an existing failed-event cooldown
// immediately, not wait for its old 60-second clock.
retryLatest416 = 101;
retryFail416 = true;
await retryVisit416();
assert.equal(retryCalls416.filter(x => x === 'full-rearm').length, 3);
retryLatest416 = 102;
retryFail416 = false;
await retryVisit416();
assert.equal(retryCalls416.filter(x => x === 'full-rearm').length, 4,
  '416 newer signal must trigger repair immediately even during older cooldown');
assert.equal(retryCertified416, 102, '416 newer signal must be certified');
console.log('416_FAILED_GAP_REPEAT_READ_COOLDOWN=PASS');
console.log('416_NEW_SIGNAL_BYPASS_AND_BOUNDED_RECOVERY=PASS');


// A FULL repair can finish before the later app189 targeted proof fails.
// On recovery do not rebuild that already-complete FULL baseline again.
const runCompletedFullTargetedFailure416 = async (priorAttempt, initialBaseline, expectedFull) => {
  const store = new Map([['test-member:baseline', initialBaseline]]);
  let now = 1_000_000;
  let attempted = priorAttempt;
  let repairTarget = 0;
  let certified = 0;
  let settled = 0;
  let pending = { 'old-like': true };
  let proofFails = true;
  let fullCalls = 0;
  let proofCalls = 0;
  const context = {
    ...retryContext416,
    Date: { now: () => now },
    readLastRetainedLikeSignal357: () => 100,
    EXPLORE_LIKE_BASELINE_127: 'baseline',
    scopedLikeKey127: (key, uid) => uid + ':' + key,
    readLikeLocal127: key => store.get(key) || '',
    writeLikeLocal127: (key, value) => store.set(key, value),
    readCrossOriginLikeCertified357: () => certified,
    readCrossOriginLikeSettled359: () => settled,
    readCrossOriginLikeAttempted358: () => attempted,
    readCrossOriginLikeSettlementAttempted359: () => 100,
    markCrossOriginLikeAttempted358: (_uid, version) => { attempted = version; },
    requestRepair127: () => {
      repairTarget = 100;
      fullCalls++;
      store.set('test-member:baseline', '');
    },
    readRepairTarget127: () => repairTarget,
    ensurePersonalLikeBaseline127: async (_user, revision) => {
      if (repairTarget) {
        repairTarget = 0;
        store.set('test-member:baseline', '1');
      }
      if (revision) {
        pending = {};
        store.set('test-member:baseline', '1');
      }
    },
    readSnapshotPending127: () => pending,
    requestPersonalLikeRevision127: async () => {
      proofCalls++;
      if (proofFails) throw new Error('simulated targeted proof failure');
      return 'verified-revision';
    },
    invalidateExplorePersonalLikeBaseline127: () => store.set('test-member:baseline', ''),
    markCrossOriginLikeCertified357: (_uid, version) => { certified = version; },
    markCrossOriginLikeSettled359: (_uid, version) => { settled = version; },
  };
  const { visit } = new Function(...Object.keys(context),
    helperJS416 + '\n' + parityJS416 +
    '\nreturn {visit: ensureExplorePersonalLikeCrossOriginParity357};'
  )(...Object.values(context));
  let firstFailed = false;
  try { await visit({ uid: 'test-member' }); }
  catch { firstFailed = true; }
  assert.equal(firstFailed, true, '416 first targeted proof failure must remain visible');
  const firstFullCalls = fullCalls;
  await visit({ uid: 'test-member' }); // cooldown: no extra FULL read
  assert.equal(fullCalls, firstFullCalls, '416 immediate retry must be suppressed');
  now += 60_001;
  proofFails = false;
  await visit({ uid: 'test-member' });
  assert.equal(fullCalls, expectedFull,
    '416 must not repeat a FULL baseline that already succeeded');
  assert.equal(proofCalls, 2, '416 should retry only targeted proof once after cooldown');
  assert.equal(certified, 100);
  assert.equal(settled, 100);
  assert.deepEqual(pending, {});
};
await runCompletedFullTargetedFailure416(0, '1', 1);
await runCompletedFullTargetedFailure416(100, '', 1);
await runCompletedFullTargetedFailure416(100, '1', 0);
console.log('416_COMPLETED_FULL_TARGETED_PROOF_RETRY_NO_REBUILD=PASS');

// Stage416/417: always execute the exact Worker canonical proof safety gates with
// the existing personal-like workflow; never treat queued/R2 as settled.
await import('./verify-417-bounded-like-proof.mjs');
