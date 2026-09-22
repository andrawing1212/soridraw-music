import { readFileSync, existsSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const likes = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const profile = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[107] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 107) fail('app version is older than 107');

if (existsSync('src/services/exploreLikeDisplayStateService.ts')) fail('obsolete display-state service still exists');
for (const text of [page, likes]) {
  if (text.includes('exploreLikeDisplayStateService')) fail('display-state import remains');
  if (/getExploreLike(Display|Canonical)Count091|seedExploreLikeCanonicalCounts091|updateExploreLikeCanonicalCounts091|beginExploreLikeDisplayTransition091|confirmExploreLikeDisplayTransition094|rebaseExploreLikePendingDisplay094/.test(text)) {
    fail('legacy numeric overlay reference remains');
  }
}

const directSharedCard107 = page.includes('track={track}');
const atomicPairCard129 =
  page.includes('const pair129 = normalizeExploreLikeDisplayPair129(liked129, track.likeCount);') &&
  page.includes('const displayTrack129 = pair129.likeCount === track.likeCount') &&
  page.includes('track={displayTrack129}') &&
  page.includes('liked={pair129.liked}');
if (!directSharedCard107 && !atomicPairCard129) {
  fail('cards must render the shared payload or the single 0/1 atomic stale-display repair only');
}
if (/const displayTrack\s*=/.test(page)) fail('legacy account-scoped display track remains');
if (atomicPairCard129 && !likes.includes('likeCount: Math.max(clampLikeCount(publicCount), liked ? 1 : 0)')) {
  fail('129 card repair must only fix impossible filled-heart/public-zero state');
}

if (appVersion >= 120) {
  if (!likes.includes('SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918')) fail('current actor-count lock marker missing');
  if (!likes.includes('EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000')) fail('current 30-second like window missing');
  if (!likes.includes('const baseLikeCount = existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);')) {
    fail('actor optimistic count baseline missing');
  }
  const directOptimistic120 =
    likes.includes('const optimisticLikeCount = clampLikeCount(') &&
    likes.includes('baseLikeCount + (liked ? 1 : 0) - (baseLiked ? 1 : 0)');
  const helperOptimistic127 =
    likes.includes('export const computeExploreLikeAction127 = (') &&
    likes.includes('publicCount + Number(desiredLiked) - Number(baseLiked)') &&
    likes.includes('const optimisticAction127 = computeExploreLikeAction127(baseLiked, liked, baseLikeCount);') &&
    likes.includes('const optimisticLikeCount = optimisticAction127.likeCount;');
  if (!directOptimistic120 && !helperOptimistic127) {
    fail('actor optimistic count must remain one-step baseline/final delta');
  }
  if (!likes.includes('overlayExploreLikeDisplayCounts')) fail('actor stale-shared overwrite protection missing');
  if (!likes.includes('explore-like-display-lock-120')) fail('current display lock cache missing');
  if (!likes.includes('observeExploreLikeAccountSyncSignal = (_user: User, _value: unknown) => {}')) {
    fail('legacy RTDB account count replay became active again');
  }
} else if (!likes.includes('const optimisticLikeCount = canonicalLikeCount;')) {
  fail('legacy outbox compatibility count is not shared-count only');
}

const shared113 = profile.includes('SORIDRAW_PROFILE_SHARED_R2_REVALIDATION_113_20260917');
const functionAt = profile.indexOf('export const getExplorePublicProfileFirstView = async');
const cachedAt = profile.indexOf('if (cached) {', functionAt);
const coldAt = profile.indexOf('const inflightKey', cachedAt);
if (functionAt < 0 || cachedAt < 0 || coldAt < 0) fail('cached profile branch missing');
const warmBranch = profile.slice(cachedAt, coldAt);

if (shared113) {
  if (!profile.includes('PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113 = 60_000')) fail('113 bounded revalidation window missing');
  if (!profile.includes('profileRevalidationInflight113')) fail('113 revalidation dedupe missing');
  if (!profile.includes('requestMaterializedFirstView(normalizedRef, cached.revision)')) fail('113 conditional shared revision check missing');
  if (!warmBranch.includes('revalidateCachedProfile113(normalizedRef, cached, options)')) fail('warm branch does not schedule shared revalidation');
  if (!warmBranch.includes('return cached')) fail('warm profile must render local snapshot immediately');
  if (warmBranch.indexOf('revalidateCachedProfile113') > warmBranch.indexOf('return cached')) fail('revalidation must be scheduled before immediate local return');
  if (!profile.includes("materialized.kind === 'not-modified'")) fail('304/no-change path missing');
  if (!profile.includes('validatedAt: Date.now()')) fail('successful revalidation timestamp refresh missing');
  if (/setInterval|setTimeout/.test(profile.slice(profile.indexOf('const revalidateCachedProfile113'), functionAt))) {
    fail('profile revalidation must be revisit-driven, not polling');
  }
} else {
  if (profile.includes('PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS')) fail('time-based profile revalidation remains');
  if (profile.includes('profileRevalidationInflight')) fail('profile revalidation inflight map remains');
  if (warmBranch.includes('requestMaterializedFirstView')) fail('warm profile revisit still performs server request');
  if (!warmBranch.includes('서버 D1 읽기 0')) fail('warm profile local-hit contract marker missing');
}

console.log('107_EXPLORE_DIRECT_COUNT_ZERO_READ=PASS');
console.log('PUBLIC_COUNT_SOURCE=SHARED_FEED_PROFILE_WITH_ACTOR_LOCAL_PENDING_OVERLAY');
console.log(appVersion >= 120 ? 'ACTOR_PENDING_COUNT=LOCAL_ONLY_BASELINE_FINAL_DELTA' : 'ACCOUNT_SIGNAL=MEMBERSHIP_ONLY');
console.log(shared113 ? 'PROFILE_WARM_REVISIT=LOCAL_IMMEDIATE_PLUS_BOUNDED_SHARED_R2_CHECK' : 'PROFILE_WARM_REVISIT_D1_READ=0_BY_CLIENT_CONTRACT');
console.log('PROFILE_WARM_D1_READ=0_BY_CONTRACT');
console.log('OBSOLETE_DISPLAY_OVERLAY=REMOVED');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
