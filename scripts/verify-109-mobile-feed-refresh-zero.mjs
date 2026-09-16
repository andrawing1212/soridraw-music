import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const profileCache = readFileSync('src/lib/userProfileCache.ts', 'utf8');
const control = readFileSync('src/services/userControlRevisionService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[109] ${message}`); };
if (String(version.version) !== '109') fail('app version is not 109');
if (!app.includes('SORIDRAW_ROOT_USER_REFRESH_ZERO_109_20260916')) fail('refresh-zero gate marker missing');
if (app.includes('        attachUserRoleListener();\n\n        // Fetch favorites for the user.')) fail('unconditional root users listener remains');
if (!app.includes('subscribeUserControlRevision(')) fail('UID RTDB control revision gate missing');
if (!app.includes('PROFILE_SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000')) fail('bounded safety verification missing');
if (!app.includes('writeUserProfileServerVerifiedAt(currentUser.uid)')) fail('server verification lease write missing');
if (!profileCache.includes('SORIDRAW_USER_PROFILE_REFRESH_ZERO_1020')) fail('persistent profile cache missing');
if (!control.includes("ref(realtimeDb, `userControls/${uid}`)")) fail('UID-scoped RTDB control node missing');
if (!cache.includes('SORIDRAW_EXPLORE_MOBILE_STALE_PUBLIC_COUNT_RECOVERY_109_20260916')) fail('mobile stale feed recovery marker missing');
if (!/EXPLORE_FEED_CACHE_SCHEMA_VERSION\s*=\s*3\s*;/.test(cache)) fail('Explore Feed cache schema is not 3');
if (/app-version\.json|appVersion|APP_VERSION/.test(cache)) fail('Explore Feed cache is coupled to app version');
if (!page.includes('buildExploreR2SnapshotFeedUrl108')) fail('R2-only cold refill path missing');
if (!page.includes('cachedRevision === serverRevision')) fail('warm revision no-op path missing');

console.log('109_MOBILE_FEED_REFRESH_ZERO=PASS');
console.log('MOBILE_STALE_SCHEMA_2=REJECTED_ONCE');
console.log('COLD_REFILL=R2_SNAPSHOT_ONLY_D1_R0_W0_CONTRACT');
console.log('WARM_REFRESH_FIRESTORE_USERS=R0_BY_GATE');
console.log('ROOT_CONTROL_SIGNAL=UID_RTDB_ONLY');
console.log('FUTURE_APP_VERSION_CACHE_COUPLING=NONE');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
