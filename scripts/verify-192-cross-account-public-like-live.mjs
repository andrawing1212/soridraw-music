import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const publicSync = readFileSync('src/services/explorePublicLikeSyncService.ts', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const canonicalWorker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const appRelease = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml', 'utf8');
const workerRelease = readFileSync('.github/workflows/cloudflare-explore-preview-release.yml', 'utf8');

assert.equal(String(version.version), '159');

// One bounded RTDB invalidation bus for active Explore screens. It never carries
// a public count or another account's personal heart as authority.
assert.match(publicSync, /SORIDRAW_EXPLORE_PUBLIC_LIKE_LIVE_SYNC_192_20260924/);
assert.match(publicSync, /PUBLIC_LIKE_SIGNAL_PATH_192 = 'publicSync\/exploreLike'/);
assert.match(publicSync, /PUBLIC_LIKE_SIGNAL_MAX_192 = 50/);
assert.match(publicSync, /runTransaction\(/);
assert.match(publicSync, /subscribeExplorePublicLikeInvalidation192/);
const mergeStart = publicSync.indexOf('export const mergeExplorePublicLikeSignal192');
const fetchStart = publicSync.indexOf('export const fetchExplorePublicLikeCards192');
assert.ok(mergeStart >= 0 && fetchStart > mergeStart);
const signalAuthority = publicSync.slice(mergeStart, fetchStart);
assert.doesNotMatch(signalAuthority, /likeCount/);
assert.match(signalAuthority, /trackId/);
assert.match(signalAuthority, /ownerUid/);
assert.match(signalAuthority, /at:/);
assert.match(signalAuthority, /row\?\.at/);
assert.match(signalAuthority, /Math\.min\(Math\.floor\(now\), Math\.floor\(Number\(row\.at\)\)\)/);


// Scheduled aggregation must be executable. A historical materialization wrote
// literal "\\n" text after a line comment, commenting out the owner declaration
// and crashing every queue drain with "ReferenceError: owner is not defined".
assert.match(
  canonicalWorker,
  /pending work\.\n  \/\/ Idle cron remains free[\s\S]{0,180}await assertLegacyLikeWriterOpen163\(env, 'scheduled-like-aggregate'\);\n\n  const owner = 'like042_'/,
);
assert.doesNotMatch(
  canonicalWorker,
  /pending work\.\\n  \/\/ Idle cron remains free[\s\S]{0,220}const owner = 'like042_'/,
);

// Public signal is emitted only after the accepted W1 batch path, and failure to
// notify cannot replay the canonical mutation.
const flushStart = like.indexOf('flushPendingLikes = async');
const flushEnd = like.indexOf('// App 120 deliberately ignores', flushStart);
assert.ok(flushStart >= 0 && flushEnd > flushStart);
const flush = like.slice(flushStart, flushEnd);
assert.match(like, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(flush, /await requestExploreLike\(user, '\/v1\/me\/likes\/batch'/);
assert.match(flush, /await publishConfirmedLikeSignal127\(uid, acceptedForSignal127\)/);
assert.match(flush, /publishExplorePublicLikeInvalidation192\([\s\S]*acceptedForSignal127\.map\(\(row\) => \(\{ \.\.\.row, at: acknowledgedAt \}\)\)/);
assert.ok(
  flush.indexOf('persistLikeOutbox(uid, latest);') <
  flush.indexOf('publishExplorePublicLikeInvalidation192('),
  'public invalidation must follow durable local ACK handling',
);
assert.match(flush, /Never replay an accepted D1 mutation/);

// Receivers fetch only exact changed-track R2 cards. The settled shared count is
// applied across loaded Feed/Profile/Liked card surfaces but never changes the
// receiving account's filled-heart membership.
assert.match(page, /subscribeExplorePublicLikeInvalidation192/);
assert.match(page, /fetchExplorePublicLikeCards192/);
assert.match(page, /card\.updatedAt < row\.at/);
assert.match(page, /patchExploreFeedSessionCachesRow\(row\.trackId, \{ likeCount: card\.likeCount \}\)/);
assert.match(page, /patchExplorePublicProfileFirstViewTrack\(ownerUid, row\.trackId, \{ likeCount: card\.likeCount \}\)/);
assert.match(page, /setTracks\(patchPublicCounts192\)/);
assert.match(page, /setProfileTracks\(patchPublicCounts192\)/);
assert.match(page, /setProfileLikedTracks\(patchPublicCounts192\)/);
assert.match(page, /attempts >= 4/);
const page192Start = page.indexOf('publicLikeVisibleTracksRef192.current');
const page192End = page.indexOf('// SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920', page192Start);
assert.ok(page192Start >= 0 && page192End > page192Start);
assert.doesNotMatch(page.slice(page192Start, page192End), /setLikedTrackIds\(/);

// Worker public-card endpoint is R2-only and bounded; normal idle users do not
// poll it. Existing 30-second client batching remains intact while shared public
// projection wakes five seconds after W1 acceptance.
assert.match(entry, /SORIDRAW_EXPLORE_PUBLIC_LIKE_CARD_READ_192_20260924/);
assert.match(entry, /PUBLIC_LIKE_CARD_MAX_192 = 50/);
assert.match(entry, /const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 5 \* 1000/);
const workerStart = entry.indexOf('// SORIDRAW_EXPLORE_PUBLIC_LIKE_CARD_READ_192_20260924');
const workerEnd = entry.indexOf('async function scheduleExploreLikeAggregate103', workerStart);
assert.ok(workerStart >= 0 && workerEnd > workerStart);
const worker192 = entry.slice(workerStart, workerEnd);
assert.match(worker192, /PROFILE_MEDIA/);
assert.match(worker192, /bucket\.get\(/);
assert.doesNotMatch(worker192, /env\?\.DB|env\.DB|\.prepare\s*\(/);
assert.match(worker192, /X-SORIDRAW-D1-Read', '0'/);
assert.match(worker192, /X-SORIDRAW-D1-Write', '0'/);
assert.match(workerRelease, /\/v1\/public-like-cards\?trackIds=/);
assert.match(workerRelease, /PUBLIC_LIKE_CARD_192_ITEMS=PASS/);
assert.match(workerRelease, /PUBLIC_LIKE_CARD_192_D1_R0_W0=PASS/);
assert.match(entry, /SORIDRAW_PREDEPLOY_PENDING_LIKE_DRAIN_192_20260924/);
assert.match(entry, /controller\?\.cron === 'soridraw-preview-pending-like-drain-192'[\s\S]*await baseWorker\.scheduled[\s\S]*await repairSharedPublicLikeCounts191\(env\)/);
assert.match(workerRelease, /POST_DEPLOY_PENDING_069_DRAIN_REQUIRED=\$pending069/);
assert.match(workerRelease, /POST_DEPLOY_PENDING_069_TEMP_CRON=ENABLED/);
assert.match(workerRelease, /POST_DEPLOY_PENDING_069_ATTEMPT=\$attempt COUNT=\$current_pending/);
assert.match(workerRelease, /POST_DEPLOY_PENDING_069_DRAIN=PASS/);
assert.match(workerRelease, /preview-temp-drain-cron-192\.json/);
assert.match(workerRelease, /"cron":"\*\/1 \* \* \* \*"/);
assert.match(workerRelease, /PREVIEW_FIXED_CRON_CLEAR=PASS/);
assert.doesNotMatch(workerRelease, /PRE_DEPLOY_PENDING_069_DRAIN=START/);
assert.doesNotMatch(workerRelease, /wrangler\.preview\.jsonc[\s\S]{0,200}triggers\s*:/);

// Shared rules expose only this small authenticated invalidation node. A writer
// must identify itself; counts are deliberately absent from the signal schema.
const publicRule = rules?.rules?.publicSync?.exploreLike;
assert.equal(publicRule?.['.read'], 'auth != null');
assert.match(String(publicRule?.['.write'] || ''), /actorUid.*auth\.uid/);
assert.match(String(publicRule?.['.validate'] || ''), /hasChildren\(\['version','at','actorUid','rows'\]\)/);
assert.match(String(publicRule?.rows?.$index?.['.validate'] || ''), /\^\(0\|\[1-9\]\|\[1-4\]\[0-9\]\)\$/);
assert.equal(publicRule?.rows?.$index?.$other?.['.validate'], false);
assert.equal(publicRule?.rows?.$index?.likeCount, undefined);
assert.match(String(publicRule?.rows?.$index?.trackId?.['.validate'] || ''), /length <= 512/);

// The normal two-minute activity gate remains for unchanged users. The new path
// is change-driven only and does not turn app entry into a polling loop.
assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
assert.doesNotMatch(page192Start >= 0 ? page.slice(page192Start, page192End) : '', /setInterval\(/);

// PREVIEW app release can deploy the additive shared RTDB rule and verifies the
// exact live rule document; TEST/PRODUCTION Hosting remain protected separately.
assert.match(appRelease, /deploy_shared_rtdb_rules=true/);
assert.match(appRelease, /RTDB_OAUTH_TOKEN_LOCAL_MINT=PASS/);
assert.match(appRelease, /-X PUT/);
assert.match(appRelease, /--data-binary @database\.rules\.json/);
assert.match(appRelease, /SHARED_RTDB_RULES_EXACT_MATCH=PASS/);
assert.doesNotMatch(appRelease, /--only database/);

console.log('192_PUBLIC_LIKE_SIGNAL_CHANGED_TRACK_ONLY=PASS');
console.log('192_RECEIVER_PERSONAL_HEART_UNTOUCHED=PASS');
console.log('192_CHANGED_CARD_R2_ONLY_D1_R0W0=PASS');
console.log('192_CLIENT_BATCH_30S_SERVER_PUBLIC_SETTLE_5S=PASS');
console.log('192_PUBLIC_LIKE_RETRY_BOUNDED_4=PASS');
console.log('192_IDLE_POLLING=0');
console.log('192_SCHEDULED_AGGREGATE_OWNER_SCOPE=PASS');
console.log('192_ORPHAN_QUEUE_POSTDEPLOY_DRAIN=PASS');
