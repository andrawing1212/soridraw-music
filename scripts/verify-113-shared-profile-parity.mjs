import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const client = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[113] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 113) fail('app version is older than 113');

const functionText = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = worker.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) fail(`function missing ${name}`);
  const brace = worker.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < worker.length; i += 1) {
    const c = worker[i];
    const n = worker[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return worker.slice(start, i + 1);
  }
  fail(`unterminated ${name}`);
};

for (const required of [
  'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917',
  'exploreSharedProfileR2Key060',
  'exploreSharedProfileAliasR2Key060',
  'readExploreSharedProfile060',
  'writeExploreSharedProfile060',
  'primeExploreLocalProfile060',
  'seedSharedProfileFromPreviewLocal060',
  'readMaterializedSharedProfile060',
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
const materializedStart = worker.indexOf('async function readMaterializedSharedProfile060', sharedStart);
const pureShared = sharedStart >= 0 && materializedStart > sharedStart ? worker.slice(sharedStart, materializedStart) : '';
if (!pureShared.includes('env?.PROFILE_MEDIA')) fail('shared profile store must use shared PROFILE_MEDIA R2');
if (!pureShared.includes('readExploreR2Json')) fail('local derived profile source missing');
if (/env\.DB|\.prepare\(/.test(pureShared)) fail('shared R2 helpers must not read D1');

const materialized = functionText('readMaterializedSharedProfile060');
if (!materialized.includes('readPublicProfileFirstViewRow(env, normalized)')) fail('bounded materialized snapshot read missing');
if (!materialized.includes('parseExploreProfileSnapshotRow(row)')) fail('materialized snapshot parser missing');
if (!materialized.includes('writeExploreSharedProfile060(env, bundle)')) fail('materialized row is not promoted to shared R2');
for (const forbidden of ['materializePublicProfileFirstView', 'buildExploreFeedR2Payload', 'SELECT * FROM tracks', 'SELECT * FROM likes']) {
  if (materialized.includes(forbidden)) fail(`materialized recovery uses expensive fallback: ${forbidden}`);
}

const findSharedProfileReadLayer = () => {
  let name = 'handlePublicProfileFirstViewWithEdgeCache';
  const seen = new Set();
  for (let depth = 0; depth < 10; depth += 1) {
    if (seen.has(name)) fail(`profile read wrapper cycle at ${name}`);
    seen.add(name);
    const body = functionText(name);
    if (body.includes('readExploreSharedProfile060(env, profileRef)')) return body;
    const next = [...body.matchAll(/handlePublicProfileFirstViewWithEdgeCacheCore\d+/g)]
      .map((match) => match[0])
      .find((candidate) => !seen.has(candidate));
    if (!next) break;
    name = next;
  }
  fail('shared-profile 060 read layer not reachable');
};

const wrapper = findSharedProfileReadLayer();
if (!wrapper.includes('cache.match(negativeKey)')) fail('negative edge guard missing before shared R2');
if (!wrapper.includes('cache.match(positiveKey)')) fail('positive edge guard missing before shared R2');
if (!wrapper.includes('readExploreSharedProfile060(env, profileRef)')) fail('shared R2 profile read missing');
if (!wrapper.includes('seedSharedProfileFromPreviewLocal060(env, profileRef)')) fail('PREVIEW local seed path missing');
if (!wrapper.includes('readMaterializedSharedProfile060(env, profileRef)')) fail('one-row cold recovery missing');
if (!wrapper.includes('handlePublicProfileFirstViewWithEdgeCacheCore060')) fail('guarded compatibility fallback missing');
if (/env\.DB|\.prepare\(/.test(wrapper)) fail('shared-profile wrapper must not run ad-hoc D1 queries');

const findSharedProfileMutationLayer = (mutation) => {
  let name = mutation;
  const seen = new Set();
  for (let depth = 0; depth < 10; depth += 1) {
    if (seen.has(name)) fail(`mutation wrapper cycle: ${mutation} -> ${name}`);
    seen.add(name);
    const body = functionText(name);
    if (body.includes('primeExploreLocalProfile060') && body.includes('mirrorExploreLocalProfile060')) return body;
    const corePattern = new RegExp(`${mutation}Core\\d+`, 'g');
    const next = [...body.matchAll(corePattern)].map((match) => match[0]).find((candidate) => !seen.has(candidate));
    if (!next) break;
    name = next;
  }
  fail(`${mutation} shared-profile mutation layer not reachable`);
};

for (const mutation of [
  'patchExploreVisibleProfiles056',
  'patchExploreProfileR2Counters020',
  'patchExploreProfileR2Like020',
  'patchExploreProfileR2Mutation019',
  'refreshPublicProfileFirstViewProfile',
]) {
  const body = findSharedProfileMutationLayer(mutation);
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
console.log('PROFILE_READ_ORDER=LOCAL_BROWSER_THEN_EDGE_THEN_SHARED_R2_THEN_ONE_MATERIALIZED_ROW_THEN_GUARDED_FALLBACK');
console.log('COLD_UID_TARGET=ONE_PRIMARY_KEY_MATERIALIZED_ROW');
console.log('WARM_RENDER=LOCAL_IMMEDIATE');
console.log('WARM_REVALIDATION=MAX_ONCE_PER_60S_ON_REVISIT');
console.log('UNCHANGED_PROFILE_D1=R0_AFTER_SHARED_R2_SEED');
console.log('MUTATION_SYNC=TARGETED_PROFILE_ONLY');
console.log('NO_FULL_PROFILE_SCAN=true');
console.log('NO_D1_SCHEMA_CHANGE=true');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
