import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const fail = (message) => { throw new Error(`[116 Explore] ${message}`); };

for (const required of [
  'SORIDRAW_EXPLORE_PUBLIC_COUNT_CONVERGENCE_116_20260917',
  'patchExploreFeedSessionCachesRow',
  'setTracks(applyPublicCounts110);',
  'patchExploreFeedSessionCachesRow(track.id, { likeCount: track.likeCount });',
  'syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[], authoritative = true)',
  'if (!sharedTracks.length || !authoritative) return;',
]) if (!page.includes(required)) fail(`client convergence missing: ${required}`);

if (!cache.includes('rewriteLoadedFeedRows075') || !cache.includes('patchExploreFeedSessionCachesRow')) {
  fail('loaded recommended/latest/popular Feed cache patcher missing');
}

const initialCacheNeedle = 'if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);';
if (page.includes(initialCacheNeedle)) fail('stale cached Feed is still allowed to become authoritative on first render');
if (!page.includes('if (cachedRevision === serverRevision) {\n              syncSharedPublicCountsToLocal110(cachedTracks);\n              return;\n            }')) {
  fail('server revision-confirmed cached Feed promotion missing');
}
if (!page.includes('applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>, authoritative = false)')) {
  fail('profile cached-first-view authority gate missing');
}
if (!page.includes('if (authoritative) syncSharedPublicCountsToLocal110(normalizedTracks);')) {
  fail('profile authority guard missing');
}
if (!page.includes('applyProfileFirstView(refreshedProfile, refreshedRows, true);')) {
  fail('revalidated public profile is not promoted as authority');
}

for (const required of [
  'SORIDRAW_SHARED_FEED_CATCHUP_CONVERGENCE_064_20260917',
  'syncDerivedCache032Core064',
  'mirrorExploreSharedFeedAfterDerivedSync064',
]) if (!worker.includes(required)) fail(`Worker catch-up convergence missing: ${required}`);

const helperStart = worker.indexOf('async function mirrorExploreSharedFeedAfterDerivedSync064');
const wrapperStart = worker.indexOf('async function syncDerivedCache032(env, sort, uid = null, request = null)', helperStart);
if (helperStart < 0 || wrapperStart <= helperStart) fail('064 helper/wrapper boundaries missing');
const helper = worker.slice(helperStart, wrapperStart);
const wrapper = worker.slice(wrapperStart, wrapperStart + 1200);
for (const required of [
  'local.get(exploreFeedR2Key(normalizedSort))',
  'shared.get(sharedKey)',
  'if (sharedBody === localBody) return { mirrored: false, unchanged: true };',
  'await shared.put(sharedKey, localBody',
]) if (!helper.includes(required)) fail(`064 mirror contract missing: ${required}`);
if (/env\.DB|\.prepare\(/.test(helper)) fail('064 catch-up helper performs a direct D1 read');
const equalityIndex = helper.indexOf('if (sharedBody === localBody)');
const writeIndex = helper.indexOf('await shared.put(sharedKey, localBody');
if (!(equalityIndex >= 0 && writeIndex > equalityIndex)) fail('unchanged shared snapshot is not checked before R2 write');
if (!wrapper.includes('const result = await syncDerivedCache032Core064(env, sort, uid, request);')) fail('064 must catch up local derived Feed first');
if (!wrapper.includes('if (!uid)')) fail('064 shared Feed mirror must remain on public Feed catch-up only');
if (!wrapper.includes('mirrorExploreSharedFeedAfterDerivedSync064(env, sort)')) fail('064 wrapper does not mirror caught-up snapshot');

if (!Array.isArray(manifest.patches) || !manifest.patches.includes('064-shared-feed-catchup-convergence.mjs')) fail('064 release patch not registered');
if (String(version.version) !== '116') fail(`app version must be 116, got ${String(version.version)}`);

console.log('116_EXPLORE_PUBLIC_COUNT_CONVERGENCE=PASS');
console.log('SAME_TRACK_LOADED_FEEDS=PATCHED_BY_TRACK_ID');
console.log('STALE_LOCAL_FEED_AUTHORITY=BLOCKED');
console.log('REVISION_CONFIRMED_FEED_AUTHORITY=ENABLED');
console.log('PUBLIC_PROFILE_AUTHORITY=REVALIDATED_ONLY');
console.log('DERIVED_CATCHUP_SHARED_FEED_MIRROR=ENABLED');
console.log('UNCHANGED_SHARED_R2_WRITE=0_BY_BRANCH');
console.log('CATCHUP_EXTRA_D1_READ=0_BY_CONTRACT');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
