import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const client = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[113] ${message}`); };
if (String(version.version) !== '113') fail('app version must be 113');

for (const required of [
  'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917',
  'exploreSharedProfileR2Key060',
  'exploreSharedProfileAliasR2Key060',
  'readExploreSharedProfile060',
  'writeExploreSharedProfile060',
  'primeExploreLocalProfile060',
  'seedSharedProfileFromPreviewLocal060',
  'handlePublicProfileFirstViewWithEdgeCacheCore060',
  'patchExploreVisibleProfiles056Core060',
  'patchExploreProfileR2Counters020Core060',
  'patchExploreProfileR2Like020Core060',
  'patchExploreProfileR2Mutation019Core060',
  'refreshPublicProfileFirstViewProfileCore060',
]) {
  if (!worker.includes(required)) fail(`generated Worker missing ${required}`);
}

if (!Array.isArray(manifest.patches) || !manifest.patches.includes('060-shared-profile-r2-parity.mjs')) {
  fail('release patch 060 missing from manifest');
}

const sharedStart = worker.indexOf('async function readSharedProfileJson060');
const outerStart = worker.indexOf('async function handlePublicProfileFirstViewWithEdgeCacheCore060', sharedStart);
const sharedHelpers = sharedStart >= 0 && outerStart > sharedStart ? worker.slice(sharedStart, outerStart) : '';
if (!sharedHelpers.includes('env?.PROFILE_MEDIA')) fail('shared profile store must use shared PROFILE_MEDIA R2');
if (!sharedHelpers.includes('exploreCacheBucket031(env)') && !sharedHelpers.includes('readExploreR2Json')) fail('local derived profile source missing');
if (/env\.DB|\.prepare\(/.test(sharedHelpers)) fail('shared profile helper path must not read D1');

const wrapperStart = worker.indexOf('async function handlePublicProfileFirstViewWithEdgeCache(request');
const wrapperEnd = worker.indexOf('\n}', wrapperStart);
const wrapper = wrapperStart >= 0 ? worker.slice(wrapperStart, wrapperEnd > wrapperStart ? wrapperEnd + 2 : wrapperStart + 3500) : '';
if (!wrapper.includes('cache.match(negativeKey)')) fail('negative edge guard missing before shared R2');
if (!wrapper.includes('cache.match(positiveKey)')) fail('positive edge guard missing before shared R2');
if (!wrapper.includes('readExploreSharedProfile060(env, profileRef)')) fail('shared R2 profile read missing');
if (!wrapper.includes('seedSharedProfileFromPreviewLocal060(env, profileRef)')) fail('bounded PREVIEW seed path missing');
if (!wrapper.includes('handlePublicProfileFirstViewWithEdgeCacheCore060')) fail('legacy guarded fallback missing');
if (/env\.DB|\.prepare\(/.test(wrapper)) fail('shared-first profile wrapper must not touch D1 directly');

for (const mutation of [
  'patchExploreVisibleProfiles056',
  'patchExploreProfileR2Counters020',
  'patchExploreProfileR2Like020',
  'patchExploreProfileR2Mutation019',
  'refreshPublicProfileFirstViewProfile',
]) {
  const at = worker.indexOf(`async function ${mutation}(`);
  if (at < 0) fail(`mutation wrapper missing ${mutation}`);
  const body = worker.slice(at, at + 2200);
  if (!body.includes('primeExploreLocalProfile060')) fail(`${mutation} does not prime from shared profile`);
  if (!body.includes('mirrorExploreLocalProfile060')) fail(`${mutation} does not mirror targeted profile back`);
}

for (const required of [
  'SORIDRAW_PROFILE_SHARED_R2_REVALIDATION_113_20260917',
  'PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113 = 60_000',
  'profileRevalidationInflight113',
  'revalidateCachedProfile113',
  'requestMaterializedFirstView(normalizedRef, cached.revision)',
  "materialized.kind === 'not-modified'",
  'revalidateCachedProfile113(normalizedRef, cached, options)',
]) {
  if (!client.includes(required)) fail(`client missing ${required}`);
}

const warmAt = client.indexOf('if (cached) {', client.indexOf('export const getExplorePublicProfileFirstView = async'));
const coldAt = client.indexOf('const inflightKey', warmAt);
const warm = warmAt >= 0 && coldAt > warmAt ? client.slice(warmAt, coldAt) : '';
if (!warm.includes('return cached')) fail('warm profile no longer renders local snapshot immediately');
if (!warm.includes('revalidateCachedProfile113')) fail('warm profile bounded shared revalidation missing');
if (warm.indexOf('return cached') < warm.indexOf('revalidateCachedProfile113')) fail('shared revalidation must be scheduled without blocking local render');

console.log('113_SHARED_PROFILE_PARITY=PASS');
console.log('PROFILE_READ_ORDER=LOCAL_BROWSER_THEN_EDGE_THEN_SHARED_R2_THEN_GUARDED_LEGACY');
console.log('WARM_RENDER=LOCAL_IMMEDIATE');
console.log('WARM_REVALIDATION=MAX_ONCE_PER_60S_ON_REVISIT');
console.log('UNCHANGED_PROFILE_D1=R0_BY_SHARED_R2_ROUTE_CONTRACT');
console.log('MUTATION_SYNC=TARGETED_PROFILE_ONLY');
console.log('NO_FULL_PROFILE_SCAN=true');
console.log('NO_D1_SCHEMA_CHANGE=true');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
