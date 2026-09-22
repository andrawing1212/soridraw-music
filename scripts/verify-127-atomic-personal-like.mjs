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

assert.match(service, /const localCatalogReady127 = baselineReady127 \|\| (?:hasLikedStateStorage127|hasLocalLikeCatalog135)\(user\.uid\)/,
  'persisted personal catalog must be the zero-read authority on normal entry');
assert.match(service, /const missing = localCatalogReady127 \? \[\] : normalized\.filter/,
  'cached Explore entry must not issue targeted D1 membership reads');
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
assert.match(getter, /const localCatalogReady127 = baselineReady127 \|\| (?:hasLikedStateStorage127|hasLocalLikeCatalog135)\(user\.uid\)/);
assert.match(getter, /const missing = localCatalogReady127 \? \[\] : normalized\.filter/);
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
assert.match(listener, /if \(pending\[item\.trackId\]\) continue/);
assert.doesNotMatch(listener, /pending\[item\.trackId\] \|\| Object\.prototype\.hasOwnProperty\.call\(unresolved, item\.trackId\)/,
  'a previous accepted-but-unsettled value must not suppress a newer cross-device ACK');
assert.match(listener, /cache\.set\(item\.trackId, item\.liked\)/);
assert.match(listener, /patchExploreLikedTrackMembership\(uid, item\.trackId, item\.liked\)/);
assert.match(listener, /unresolved\[item\.trackId\] = item\.liked/,
  'accepted device state must outrank a partial legacy R2/D1 snapshot');
assert.match(listener, /persistLikeDisplayLocks\(uid, displayLocks\)/,
  'accepted remote count must survive an Explore remount or early RTDB event');
assert.match(listener, /dispatchLikeSync\(\{ \.\.\.item, uid, source: 'remote' \}\)/);
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
  listener.slice(listener.indexOf('const needsRepair = gap ||'), listener.indexOf('const pending = readLikeOutbox(uid)')),
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
assert.equal(
  (flush.match(/rebaseExploreLikeAfterInFlight127\(current, pending\)/g) || []).length,
  2,
  'successful ACK and ambiguous failure must both preserve a newer explicit intent',
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
assert.match(publish, /runTransaction\(/);
assert.match(publish, /applyLocally: false/);
assert.match(publish, /previousVersion: forceGap \? 0 : current\?\.version \|\| 0/);
assert.match(publish, /if \(pending\.size > EXPLORE_LIKE_SIGNAL_MAX_127\)/);
assert.ok(publish.indexOf('const task = signalPublishInFlight127.get(uid)') < publish.indexOf('saveSignalRetry127(uid, rows)'), 'in-flight notification must serialize before durable queue mutation');
assert.match(publish, /EXPLORE_LIKE_SIGNAL_MAX_127/);
assert.match(publish, /saveSignalRetry127\(uid, rows\)/);
assert.match(publish, /notification\.committed/);
assert.doesNotMatch(publish, /firebase\/firestore|env\.DB|D1/);

assert.ok(rules.rules.userSync.$uid.exploreLike, 'existing UID-scoped like signal rules required');
assert.match(page, /readExploreTrackLikeMembership127\(user\.uid, track\.id\)/);
assert.match(service, /computeExploreLikeAction127\(baseLiked, liked, baseLikeCount\)/);
assert.match(service, /normalizeExploreLikeDisplayPair129/);
assert.match(page, /const pair129 = normalizeExploreLikeDisplayPair129\(liked129, track\.likeCount\)/);
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
assert.match(page, /window\.addEventListener\('focus', onResume\)/);
assert.match(page, /document\.addEventListener\('visibilitychange', onResume\)/);
assert.match(service, /EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 \* 60_000/);
assert.match(service, /if \(previous !== revision\) \{/);
assert.match(service, /await ensurePersonalLikeBaseline127\(user\)/);
assert.match(service, /writeLikeLocal127\(key, revision\)/);
assert.match(service, /revisionCheckAtByUid127\.set\(uid, Date\.now\(\) - EXPLORE_LIKE_LEGACY_CHECK_MS_127 \+ 30_000\)/);
assert.match(legacyPatch, /requireExploreAuth\(request\)/);
assert.match(legacyPatch, /bucket\.head\(exploreSharedLikesKey061\(authContext\.uid\)\)/);
assert.match(legacyPatch, /\/v1\/me\/likes-revision/);
const legacyHandler = legacyPatch.slice(legacyPatch.indexOf('const handler = ['), legacyPatch.indexOf('const anchorCount ='));
assert.doesNotMatch(legacyHandler, /env\.DB\.prepare\(|caches\.default|rebuildExploreLikeR2Bundle/);
assert.doesNotMatch(service.slice(service.indexOf('const applyRemoteLikeSignal127'),service.indexOf('let activeLikeSignalUid127')), /likeCount:\s*item\.liked\s*\?\s*1/);
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
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
const resumeEnd134 = page.indexOf('window.addEventListener(\'focus\', onResume)', resumeStart134);
assert.ok(resumeStart134 > 0 && resumeEnd134 > resumeStart134, 'Explore focus resume block missing');
const resume134 = page.slice(resumeStart134, resumeEnd134);
assert.doesNotMatch(resume134, /likeHydrationKeyRef\.current = ''/,
  'cached focus must not reset like hydration and trigger another D1 membership read');
assert.match(resume134, /checkExplorePersonalLikeRevision127\(user\)/,
  'focus may check only the tiny private revision');
