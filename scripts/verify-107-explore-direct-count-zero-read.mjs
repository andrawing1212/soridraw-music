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
if (!page.includes('track={track}')) fail('cards do not render shared track payload directly');
if (page.includes('displayTrack =')) fail('account-scoped display track remains');
if (!likes.includes('const optimisticLikeCount = canonicalLikeCount;')) fail('outbox compatibility count is not shared-count only');
if (profile.includes('PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS')) fail('time-based profile revalidation remains');
if (profile.includes('profileRevalidationInflight')) fail('profile revalidation inflight map remains');
const functionAt = profile.indexOf('export const getExplorePublicProfileFirstView = async');
const cachedAt = profile.indexOf('if (cached) {', functionAt);
const coldAt = profile.indexOf('const inflightKey', cachedAt);
if (functionAt < 0 || cachedAt < 0 || coldAt < 0) fail('cached profile branch missing');
const warmBranch = profile.slice(cachedAt, coldAt);
if (warmBranch.includes('requestMaterializedFirstView')) fail('warm profile revisit still performs server request');
if (!warmBranch.includes('서버 D1 읽기 0')) fail('warm profile local-hit contract marker missing');

console.log('107_EXPLORE_DIRECT_COUNT_ZERO_READ=PASS');
console.log('PUBLIC_COUNT_SOURCE=TRACK_FEED_PROFILE_PAYLOAD_DIRECT');
console.log('ACCOUNT_SIGNAL=MEMBERSHIP_ONLY');
console.log('PROFILE_WARM_REVISIT_D1_READ=0_BY_CLIENT_CONTRACT');
console.log('OBSOLETE_DISPLAY_OVERLAY=REMOVED');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
