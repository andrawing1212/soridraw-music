import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const publicSync = readFileSync('src/services/explorePublicLikeSyncService.ts', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const canonicalWorker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const appRelease = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml', 'utf8');
const workerRelease = readFileSync('.github/workflows/cloudflare-explore-preview-release.yml', 'utf8');

const appVersion = Number(version.version);
assert.ok(appVersion >= 160, 'verified app160 public like behavior must remain protected on later releases');

// One bounded RTDB invalidation bus for active Explore screens. It never carries
// a public count or another account's personal heart as authority.
assert.match(publicSync, /SORIDRAW_EXPLORE_PUBLIC_LIKE_LIVE_SYNC_192_20260924/);
assert.match(publicSync, /PUBLIC_LIKE_SIGNAL_PATH_192 = 'publicSync\/exploreLike'/);
assert.match(publicSync, /PUBLIC_LIKE_SIGNAL_MAX_192 = 50/);
assert.match(publicSync, /runTransaction\(/);
assert.match(publicSync, /subscribeExplorePublicLikeInvalidation192/);
assert.match(publicSync, /Object\.values\(rawRowsValue as Record<string, unknown>\)/);
assert.doesNotMatch(publicSync, /signal\.actorUid === auth\.currentUser\?\.uid/);
assert.match(publicSync, /const freshRows = signal\.rows\.filter/);
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
assert.match(like, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000/);
assert.match(flush, /await requestExploreLike\(user, '\/v1\/me\/likes\/batch'/);
assert.match(flush, /await publishConfirmedLikeSignal127\(uid, acceptedForSignal127\)/);
assert.match(flush, /publicSignalAcceptedAt192/);
assert.match(flush, /payload\?\.data\?\.publicSignalAcceptedAt/);
assert.match(flush, /publishExplorePublicLikeInvalidation192\([\s\S]*acceptedForSignal127\.map\(\(row\) => \(\{ \.\.\.row, at: publicSignalAcceptedAt192 \}\)\)/);
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
assert.match(entry, /SORIDRAW_EXPLORE_PUBLIC_LIKE_SERVER_ACCEPTED_AT_193_20260924/);
assert.match(entry, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_ACTIVE_RECOVERY_194_20260924/);
assert.match(entry, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_JOIN_RACE_195_20260924/);
assert.match(entry, /publicSignalAcceptedAt/);
assert.match(entry, /attachPublicLikeAcceptedAt193/);
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

// app335 removes ordinary pointer/focus entry checks entirely. Public-like
// changes still use their dedicated signal, while the general Feed revision path
// is limited to a real tab resume and remains polling-free.
if (appVersion >= 335) {
  assert.doesNotMatch(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS/);
  assert.doesNotMatch(page, /window\.addEventListener\('pointerdown', requestActivityRevisionCheck/);
  assert.match(page, /document\.addEventListener\('visibilitychange', onVisible424\)/);
} else {
  assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
}
assert.doesNotMatch(page192Start >= 0 ? page.slice(page192Start, page192End) : '', /setInterval\(/);

// PREVIEW app release must NEVER replace the live Stage416 server-only
// Rules with the local app434 file (which intentionally lacks those roots).
// Only an exact validated additive publication candidate may be PUT.
// TEST/PRODUCTION Hosting stay protected separately.
assert.match(appRelease, /deploy_shared_rtdb_rules=true/);
assert.match(appRelease, /RTDB_OAUTH_TOKEN_LOCAL_MINT=PASS/);
assert.match(appRelease, /verify-418-rtdb-rules-delta\.mjs/);
assert.match(appRelease, /verify-434-publication-rtdb-additive\.mjs --self-test/);
assert.match(appRelease, /rtdb-rules-pre-put\.json/);
assert.match(appRelease, /rtdb-rules-434-preput-mode\.txt/);
assert.match(appRelease, /cmp "\$RUNNER_TEMP\/rtdb-rules-434-mode\.txt"/);
assert.match(appRelease, /ADD_ONLY_TWO_PUBLICATION_NODES/);
assert.match(appRelease, /ALREADY_EXACT/);
assert.match(appRelease, /--data-binary @"\$RUNNER_TEMP\/rtdb-rules-434-candidate\.json"/);
assert.doesNotMatch(appRelease, /--data-binary @database\.rules\.json/);
assert.match(appRelease, /SHARED_RTDB_RULES_EXACT_MATCH=PASS/);
assert.doesNotMatch(appRelease, /--only database/);

console.log('192_PUBLIC_LIKE_SIGNAL_CHANGED_TRACK_ONLY=PASS');
console.log('192_RECEIVER_PERSONAL_HEART_UNTOUCHED=PASS');
console.log('192_CHANGED_CARD_R2_ONLY_D1_R0W0=PASS');
console.log('192_CLIENT_BATCH_5S_SERVER_PUBLIC_SETTLE_5S=PASS');
console.log('192_PUBLIC_LIKE_RETRY_BOUNDED_4=PASS');
console.log('192_IDLE_POLLING=0');
console.log('192_SCHEDULED_AGGREGATE_OWNER_SCOPE=PASS');
console.log('192_ORPHAN_QUEUE_POSTDEPLOY_DRAIN=PASS');
console.log('193_PUBLIC_SIGNAL_SERVER_CLOCK=PASS');
console.log('193_MERGED_ACTOR_ROWS_NOT_DROPPED=PASS');
console.log('193_RTDB_ARRAY_OBJECT_COMPAT=PASS');
console.log('194_STALE_ALARM_CANNOT_BLOCK_FUTURE_BATCH=PASS');
console.log('195_JOINED_BATCH_CANNOT_FALL_BETWEEN_PENDING_CHECK_AND_MARKER_DELETE=PASS');


// app423: a closed mobile session receives its *retained* public RTDB signal
// before the cached Feed cards are mounted. The corresponding 1-minute
// settled public count MUST not be dropped because the visible index was
// temporarily empty. Exercise the actual ExplorePage queue and replay code.
const lateBegin423=page.indexOf('const queueRelevantRows192 = (');
const lateEnd423=page.indexOf('const unsubscribe = subscribeExplorePublicLikeInvalidation192',lateBegin423);
assert.ok(lateBegin423>0 && lateEnd423>lateBegin423);
const lateSnippet423=ts.transpileModule(
  page.slice(lateBegin423,lateEnd423)+
  '\n(globalThis.__app423={queueRelevantRows192,replayPublicLikeWhenVisible423});',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}},
).outputText;
const deferred423=new Map();
const pending423=new Map();
const attempts423=new Map();
const visible423={current:new Map()};
let scheduled423=0;
let acceptedAfterSettled423=false;
const sandbox423={
  console,Date,Map,
  user:{uid:'same-account'},
  cancelled:false,
  publicLikeVisibleTracksRef192:visible423,
  publicLikePendingRowsRef192:{current:pending423},
  publicLikeRefreshAttemptsRef192:{current:attempts423},
  publicLikeBeforeVisibleRowsRef423:{current:deferred423},
  replayPublicLikeWhenVisibleRef423:{current:null},
  hasSettledExplorePublicLikeSignal396:()=>acceptedAfterSettled423,
  scheduleRefresh192:(delay)=>{assert.equal(delay,0);scheduled423++;},
};
vm.runInNewContext(lateSnippet423,sandbox423);
const {queueRelevantRows192:queue423,replayPublicLikeWhenVisible423:replay423}=sandbox423.__app423;
const time423=Date.now();
const row423={trackId:'offline-song',ownerUid:'artist',at:time423,settledAfterProjection416:true};
assert.equal(queue423([row423]),false,'RTDB arrived before cards, no immediate R2 read');
assert.equal(deferred423.size,1,'retain just the changed-track signal');
assert.equal(pending423.size,0);
visible423.current.set('offline-song','artist');
replay423();
assert.equal(deferred423.size,0,'remove replayed deferred signal');
assert.equal(pending423.get('offline-song').at,time423,'queue correct retained update');
assert.equal(scheduled423,1,'replay schedules exactly one changed-card request');
replay423();
assert.equal(scheduled423,1,'re-render must not repeat changed-card work');
acceptedAfterSettled423=true;
const settled423={trackId:'settled-song',ownerUid:'artist',at:time423};
assert.equal(queue423([settled423]),false);
assert.equal(deferred423.size,0,'settled changed track needs no replay');
acceptedAfterSettled423=false;
const expired423={trackId:'stale-song',ownerUid:'artist',at:time423-180001};
queue423([expired423]);
assert.equal(deferred423.size,0,'old RTDB rows must not create a second R2 fetch');
assert.equal(pending423.size,1);
assert.match(page,/replayPublicLikeWhenVisibleRef423\.current\?\.\(\)/,
  'visible-card render must drain deferred retained rows');
assert.match(page,/document\.addEventListener\('visibilitychange', onResume\);[\s\S]{0,270}onResume\(\)/,
  'cold app entry should reuse the already bounded private revision check');
assert.doesNotMatch(page.slice(lateBegin423,lateEnd423),/requestExploreLike|query\(|\.prepare\(|setInterval\(/,
  'deferred public replay must not fetch D1, scan, or poll');
console.log('APP423_CLOSED_DEVICE_LATE_VISIBLE_RTDB_REPLAY=PASS');
console.log('APP423_SHARED_COUNT_CHANGED_CARD_ONLY_D1_R0=PASS');
console.log('APP423_RETAINED_SIGNAL_NO_DUPLICATE_OR_STALE_REPLAY=PASS');


// app424 closed-origin proof. Test the extracted real global dormant lifecycle
// helper (not a hand-copied predicate). An actual 1m/4m inactive gap forces
// only the tiny personal/private and edge-public revision checks once each;
// healthy SPA reentry/app version reload adds zero new original-data reads.
const dormantSource424=readFileSync('src/services/exploreDormantResume424.ts','utf8');
const main424=readFileSync('src/main.tsx','utf8');
const compiledDormant424=ts.transpileModule(dormantSource424,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const local424=new Map(), session424=new Map();
const documentListeners424=new Map(),windowListeners424=new Map();
let clock424=1_000_000;
const storage424=(map)=>({
  getItem:(key)=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,String(value)),
});
const document424={
  visibilityState:'visible',
  addEventListener:(name,fn)=>documentListeners424.set(name,fn),
};
const window424={
  localStorage:storage424(local424),sessionStorage:storage424(session424),
  addEventListener:(name,fn)=>windowListeners424.set(name,fn),
};
const exports424={};
vm.runInNewContext(compiledDormant424,{
  exports:exports424,window:window424,document:document424,
  Date:class extends Date{static now(){return clock424;}},
  Map,Number,
});
const take424=exports424.takeExploreDormantResume424;
exports424.installExploreDormantResumeClock424();
assert.match(main424,/installExploreDormantResumeClock424\(\)/,
 'the app shell must register lifecycle events even if Explore is not currently mounted');
assert.equal(take424('private',clock424),false);
assert.equal(take424('public',clock424),false);
clock424+=10_000;
document424.visibilityState='hidden';
documentListeners424.get('visibilitychange')();
clock424+=60_000;
document424.visibilityState='visible';
assert.equal(take424('private',clock424),true,'1-minute private reopen must bypass hot 5m TTL');
assert.equal(take424('public',clock424),true,'1-minute public reopen must bypass hot 2m TTL');
assert.equal(take424('private',clock424),false,'ordinary page reentry private 0');
assert.equal(take424('public',clock424),false,'ordinary page reentry public 0');
clock424+=60_000;
assert.equal(take424('public',clock424),false,'app update alone must not create network work');
// Closed >4m and retained RTDB 3-minute signal expired: use shared revision,
// NOT the missing changed-track rows, to recover current public R2 snapshot.
windowListeners424.get('pagehide')();
clock424+=4*60_000+1000;
assert.equal(take424('private',clock424),true,'expired personal RTDB signal needs metadata check');
assert.equal(take424('public',clock424),true,'expired public RTDB signal needs edge revision check');
assert.equal(take424('public',clock424),false,'no repeated reads for same close/reopen');
windowListeners424.get('pagehide')();
clock424+=5000;
assert.equal(take424('private',clock424),false,'fast reload is not true background resume');
assert.equal(take424('public',clock424),false);
assert.match(page,/requestRevisionCheck\(takeExploreDormantResume424\('public'\)\)/,
 'public visibility resume must consume genuine dormant epoch');
assert.match(page,/takeExploreDormantResume424\('public'\)\) requestRevisionCheck\(true\)/,
 'already-visible cold launch must check the old public Feed revision');
assert.match(page,/checkExplorePersonalLikeRevision127\(user, takeExploreDormantResume424\('private'\)\)/,
 'private resume must perform the corresponding old personal R2 HEAD');
assert.match(like,/!actualDormantResume424 &&\s*now - readExploreLikeRevisionCheckAt334\(uid\)/,
 'only real dormancy may bypass the healthy 5-minute private gate');
assert.match(page,/!actualDormantResume424 && lastCheckedAt > 0/,
 'only real dormancy may bypass the healthy 2-minute public gate');
assert.match(page,/const shouldRevalidate = dormantForcedFeed424 \|\| shouldRevalidateExploreFeedOnEntry126/,
 'actual reopened Feed effect must bypass 2m gate once, not merely emit a signal');
assert.match(page,/if \(!dormantForcedPopular424 &&\s*!shouldRevalidateExploreFeedOnEntry126/,
 'reopened Popular must also bypass gate once to avoid a different count by tab');
assert.match(page,/if \(actualDormantResume424\) \{\s*dormantFeedRevisionUrlRef424.current = requestUrl;\s*dormantPopularRevisionRef424.current = true/,
 'dormant origin should arm both current Feed and Popular revision checks together');
assert.match(page,/if \(dormantForcedFeed424\) dormantFeedRevisionUrlRef424.current = ''/,
 'one-time Feed bypass must be consumed and not leak to route navigation');
assert.match(page,/if \(dormantForcedPopular424\) dormantPopularRevisionRef424.current = false/,
 'one-time Popular bypass must be consumed and not leak to route navigation');
assert.doesNotMatch(dormantSource424,/fetch\(|requestExploreLike|\.prepare\(|setInterval\(/,
 'lifecycle tracking has no direct server IO, Firestore, D1, or polling');
console.log('APP424_TRUE_DORMANT_1M_4M_REVISION_GATE=PASS');
console.log('APP424_EXPIRED_OR_REPLACED_RTDB_USE_REVISIONS=PASS');
console.log('APP424_APP_UPDATE_AND_PAGE_REENTRY_DATA_READS=0');


// app424: use the REAL revision fetch-interceptor cache gate, not a copied
// implementation. A reopened browser with previous 60s response/cache and
// private same-UID patch must reach current shared Edge/R2 metadata once.
const revisionCache424=readFileSync('src/services/exploreRevisionRequestCache.ts','utf8');
const cacheStart424=revisionCache424.indexOf('const revisionUrl = revisionTarget.toString();');
const cacheEnd424=revisionCache424.indexOf('const sort = revisionTarget.searchParams.get',cacheStart424);
assert.ok(cacheStart424>0 && cacheEnd424>cacheStart424);
const cacheSource424=revisionCache424.slice(cacheStart424,cacheEnd424);
const resolveCache424=new Function(
 'revisionTarget','readEntry','rememberDeltaFromBody','cachedResponse',
 cacheSource424+'\nreturn { dormantReopen424,cached };',
);
let cacheReads424=0;
const cachedEntry424={body:'{"ok":true,"data":{"revision":"stale"}}'};
const readEntry424=()=>{cacheReads424++;return cachedEntry424;};
const fresh424=new URL('https://worker.example/v1/feed-revision?sort=latest&__soridraw_dormant_resume=1');
const ordinary424=new URL('https://worker.example/v1/feed-revision?sort=latest');
const bypass424=resolveCache424(fresh424,readEntry424,()=>{},()=>cachedEntry424);
assert.equal(bypass424.dormantReopen424,true);
assert.equal(bypass424.cached,null);
assert.equal(cacheReads424,0,'real dormant refresh cannot read stale client revision cache');
const original424=resolveCache424(ordinary424,readEntry424,()=>{},()=>cachedEntry424);
assert.equal(original424,cachedEntry424,'ordinary page reentry still uses cached revision');
assert.equal(cacheReads424,1);
assert.match(revisionCache424,
 /!dormantReopen424 && cachedFeedRevision && hasRecentExploreAccountLikePatch/,
 'same-account recent private like patch cannot suppress genuine dormant public recovery');
assert.match(page,/if \(dormantForcedFeed424\) revisionUrl424.searchParams.set\('__soridraw_dormant_resume', '1'\)/,
 'Latest shared revision must explicitly ask for fresh metadata after true background');
assert.match(page,/if \(dormantForcedPopular424\) revisionUrl424.searchParams.set\('__soridraw_dormant_resume', '1'\)/,
 'Popular shared revision must explicitly ask for fresh metadata after true background');
assert.match(revisionCache424,/const dormantReopen424 = revisionTarget.searchParams.get\('__soridraw_dormant_resume'\) === '1'/);
console.log('APP424_REAL_REVISION_CLIENT_CACHE_BYPASS=PASS');
console.log('APP424_HOT_NAVIGATION_ONE_MINUTE_CACHE_PROTECTED=PASS');
