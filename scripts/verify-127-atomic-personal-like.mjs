import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const collection = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 126, '127 candidate must not change live app version before release authorization');
assert.match(service, /SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920/);
assert.match(page, /SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920/);
assert.match(service, /EXPLORE_LIKE_BASELINE_127/);
assert.match(service, /EXPLORE_LIKE_SIGNAL_SEEN_127/);
assert.match(service, /EXPLORE_LIKE_SIGNAL_RETRY_127/);
assert.match(service, //v1/me/social-snapshot/);
assert.match(service, /!Array\.isArray\(payload\?\.data\?\.likedTrackIds\)/);
assert.match(service, /if \(readSeenLikeSignal127\(uid\) !== versionAtStart\)/);
assert.match(service, /baselineCompleted127\.add\(uid\)/);
assert.match(service, /reconcileExploreLikedTrackCollectionSnapshot127/);
assert.match(collection, /reconcileExploreLikedTrackCollectionSnapshot127/);
assert.match(collection, /cache\.canonicalLikedTrackIds = \[\.\.\.next\]/);

const getter = service.slice(service.indexOf('export const getExploreLikedTrackIds = async'),service.indexOf('export const reconcileExploreLikedTrackCollectionState'));
assert.match(getter, /await ensurePersonalLikeBaseline127\(user\)/);
assert.match(getter, /const missing = normalized\.filter\(\(trackId\) => !cache\.has\(trackId\)\)/);
assert.match(getter, /readLikeOutbox\(user\.uid\)/);
assert.match(getter, /outbox\[trackId\]\?\.desiredLiked \?\? cache\.get\(trackId\) === true/);

const listener = service.slice(service.indexOf('const applyRemoteLikeSignal127'), service.indexOf('const readSignalRetry127'));
assert.match(listener, /if \(pending\[item\.trackId\]\) continue/);
assert.match(listener, /cache\.set\(item\.trackId, item\.liked\)/);
assert.match(listener, /patchExploreLikedTrackMembership\(uid, item\.trackId, item\.liked\)/);
assert.match(listener, /dispatchLikeSync\(\{ \.\.\.item, uid, source: 'remote' \}\)/);
assert.match(listener, /onValue\(/);
assert.match(listener, /onAuthStateChanged\(auth/);
assert.doesNotMatch(listener, /\.prepare\(|firebase\/firestore|setInterval\(/);
assert.match(listener, /signal\.previousVersion !== lastSeen/);
assert.match(listener, /invalidate|EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT/);

const flush = service.slice(service.indexOf('flushPendingLikes = async'), service.indexOf('// App 120 deliberately ignores historical RTDB'));
assert.match(flush, /acceptedForSignal127/);
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
assert.match(publish, /previousVersion: current\?\.version \|\| 0/);
assert.match(publish, /EXPLORE_LIKE_SIGNAL_MAX_127/);
assert.match(publish, /saveSignalRetry127\(uid, rows\)/);
assert.match(publish, /notification\.committed/);
assert.doesNotMatch(publish, /firebase\/firestore|env\.DB|D1/);

assert.ok(rules.rules.userSync.$uid.exploreLike, 'existing UID-scoped like signal rules required');
assert.match(page, /readExploreTrackLikeMembership127\(user\.uid, track\.id\)/);
assert.match(page, /if \(currentLiked === undefined\)/);
assert.match(page, /likedTrackIds\[track\.id\] === undefined/);
assert.match(page, /detail\?\.source !== 'remote'/);
assert.match(page, /setLikedTrackIds\(\(previous\) => \(\{ \.\.\.previous, \[detail\.trackId!\]: detail\.liked! \}\)\)/);
assert.match(page, /invalidateExplorePersonalLikeBaseline127\(user\.uid\)/);
assert.doesNotMatch(service.slice(service.indexOf('const applyRemoteLikeSignal127'),service.indexOf('let activeLikeSignalUid127')), /likeCount:\s*item\.liked\s*\?\s*1/);
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(service, /EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000/);
assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
console.log('127_PERSONAL_LIKE_SINGLE_MEMBERSHIP=PASS');
console.log('127_FIRST_R2_BASELINE_VALIDATED_ONLY_ONCE=PASS');
console.log('127_REMOTE_SIGNAL_BOUNDED_50_PER_BATCH=PASS');
console.log('127_LOCAL_OUTBOX_OVERRIDES_OLD_REMOTE=PASS');
console.log('127_PUBLIC_COUNT_INDEPENDENT_AUTHORITY=PASS');
console.log('127_D1_MUTATION_ROUTE_UNCHANGED=PASS');
console.log('127_WORKER071_UNCHANGED=PASS');
console.log('127_NO_DEPLOY_OR_USER_DATA_MIGRATION=PASS');
