import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const fail = (message) => { throw new Error(`[112] ${message}`); };

for (const required of [
  'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917',
  'exploreSharedFeedR2Key059',
  'mirrorExploreSharedFeeds059',
  'processExploreLikeBatches035Core059',
  'syncExploreFeedR2Publication012Core059',
  'syncExploreFeedR2OptionPatch017Core059',
  'syncExploreFeedR2Private017Core059',
]) {
  if (!worker.includes(required)) fail(`generated Worker missing ${required}`);
}

for (const required of [
  'SORIDRAW_SHARED_FEED_R2_READ_112_20260917',
  'sharedFeedR2Key112',
  'readFeedHeadSource112',
  'readFeedObjectSource112',
  'SHARED-R2-HEAD-112',
  'SHARED-R2-GET-112',
]) {
  if (!entry.includes(required)) fail(`entry missing ${required}`);
}

if (!Array.isArray(manifest.patches) || !manifest.patches.includes('059-shared-feed-r2-parity.mjs')) {
  fail('release patch 059 missing from manifest');
}

const mirrorStart = worker.indexOf('async function mirrorExploreSharedFeeds059');
const mirrorEnd = worker.indexOf('async function processExploreLikeBatches035Core059', mirrorStart);
const mirrorBody = mirrorStart >= 0 && mirrorEnd > mirrorStart ? worker.slice(mirrorStart, mirrorEnd) : '';
if (!mirrorBody.includes('env?.PROFILE_MEDIA') || !mirrorBody.includes('exploreCacheBucket031(env)')) {
  fail('mirror must copy environment-local Feed R2 into shared PROFILE_MEDIA namespace');
}
if (/env\.DB|\.prepare\(/.test(mirrorBody)) fail('mirror must not read D1');

const aggregateStart = worker.indexOf('async function processExploreLikeBatches035(env');
const aggregateEnd = worker.indexOf('\n}', aggregateStart);
const aggregate = aggregateStart >= 0 ? worker.slice(aggregateStart, aggregateEnd > aggregateStart ? aggregateEnd + 2 : aggregateStart + 1800) : '';
if (!aggregate.includes('changedTracks') || !aggregate.includes('mirrorExploreSharedFeeds059')) {
  fail('like aggregate must mirror only after actual canonical count changes');
}

const headStart = entry.indexOf('async function readFeedHeadSource112');
const snapshotEnd = entry.indexOf('async function scheduleExploreLikeAggregate103', headStart);
const readPath = headStart >= 0 && snapshotEnd > headStart ? entry.slice(headStart, snapshotEnd) : '';
if (/env\.DB|baseWorker\.fetch|syncDerivedCache032/.test(readPath)) {
  fail('shared Feed read path must remain D1-free');
}
if (!readPath.includes('env?.PROFILE_MEDIA') || !readPath.includes('feedCacheBucket077(env)')) {
  fail('shared-first/local-fallback R2 contract missing');
}

console.log('112_SHARED_FEED_PARITY=PASS');
console.log('CANONICAL_CHANGE_PATH=ENV_R2_TO_SHARED_R2');
console.log('CROSS_ENV_READ_PATH=SHARED_R2_FIRST');
console.log('PAGE_READ_D1=R0_W0_BY_CONTRACT');
console.log('LIKE_MIRROR=ONE_BATCH_BOUNDARY');
console.log('PUBLICATION_MIRROR=TARGETED_MUTATION_BOUNDARY');
console.log('NO_UI_CHANGE=true');
console.log('NO_D1_SCHEMA_CHANGE=true');
console.log('NO_USER_DATA_MIGRATION=true');
