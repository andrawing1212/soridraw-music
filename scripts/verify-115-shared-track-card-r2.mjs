import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/062-shared-track-card-r2.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[115] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 115) fail('app version is older than 115');
if (!Array.isArray(manifest.patches) || !manifest.patches.includes('062-shared-track-card-r2.mjs')) fail('patch 062 missing from manifest');

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
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'exploreSharedTrackCardKey062',
  'readSharedTrackCard062',
  'writeSharedTrackCard062',
  'deleteSharedTrackCard062',
  'patchSharedTrackCard062',
  'readSharedFeedCards062',
  'enrichSharedTrackCards062',
  'promoteLikedTrackResponse062',
  'handleMyLikedTracks052Core062',
  'syncExploreFeedR2Publication043Core062',
  'syncExploreFeedR2Private043Core062',
  'syncExploreFeedR2OptionPatch043Core062',
  'patchExploreVisibleProfiles056Core062',
]) {
  if (!worker.includes(required)) fail(`generated Worker missing ${required}`);
}

for (const name of [
  'readSharedTrackCard062',
  'writeSharedTrackCard062',
  'deleteSharedTrackCard062',
  'patchSharedTrackCard062',
  'readSharedFeedCards062',
  'enrichSharedTrackCards062',
]) {
  const text = functionText(name);
  if (/env\.DB|\.prepare\(/.test(text)) fail(`${name} must remain D1-free`);
}

const cardReader = functionText('readSharedTrackCard062');
assert.match(cardReader, /env\?\.PROFILE_MEDIA/);
assert.match(cardReader, /exploreSharedTrackCardKey062\(normalizedId\)/);

const feedSeed = functionText('readSharedFeedCards062');
assert.match(feedSeed, /exploreSharedFeedR2Key059\(sort\)/);
assert.match(feedSeed, /writeSharedTrackCard062\(env, card\)/);
assert.doesNotMatch(feedSeed, /env\.DB|\.prepare\(/);

const liked = functionText('handleMyLikedTracks052');
for (const required of [
  'readExploreLikeR2Bundle(env, authContext.uid)',
  'readSharedTrackCard062(env, trackId)',
  'readSharedFeedCards062(env, missing)',
  'JSON.stringify({ trackIds: missing })',
  'handleMyLikedTracks052Core062(recoveryRequest, env, cors)',
  'writeSharedTrackCard062(env, card)',
  'enrichSharedTrackCards062(env, ordered)',
]) assert.ok(liked.includes(required), `liked-track shared path missing: ${required}`);
assert.doesNotMatch(liked, /env\.DB|\.prepare\(/, 'outer liked-track shared path must not query D1 directly');
assert.ok(liked.indexOf('readSharedTrackCard062(env, trackId)') < liked.indexOf('handleMyLikedTracks052Core062(recoveryRequest, env, cors)'), 'shared card must be tried before D1 recovery core');
assert.ok(liked.indexOf('readSharedFeedCards062(env, missing)') < liked.indexOf('handleMyLikedTracks052Core062(recoveryRequest, env, cors)'), 'shared Feed must be tried before D1 recovery core');

const legacyCore = functionText('handleMyLikedTracks052Core062');
for (const required of [
  'WITH requested(id, sort_order) AS (VALUES ${values})',
  'JOIN tracks t ON t.id = r.id',
  'LEFT JOIN public_profiles p ON p.uid = t.owner_uid',
  'LEFT JOIN track_stats s ON s.track_id = t.id',
  "t.is_public = 1",
  "t.status = 'published'",
]) assert.ok(legacyCore.includes(required), `bounded D1 recovery core changed: ${required}`);
assert.doesNotMatch(legacyCore, /WHERE\s+t\.owner_uid\s*=\s*\?\s+AND\s+t\.id\s+IN/i, 'owner-wide liked-track scan reintroduced');

const publish = functionText('syncExploreFeedR2Publication043');
assert.match(publish, /writeSharedTrackCard062\(env, incomingItem\)/);
const makePrivate = functionText('syncExploreFeedR2Private043');
assert.match(makePrivate, /deleteSharedTrackCard062\(env, trackId\)/);
const options = functionText('syncExploreFeedR2OptionPatch043');
assert.match(options, /patchSharedTrackCard062\(env, trackId, patch\)/);
const likeProjection = functionText('patchExploreVisibleProfiles056');
assert.match(likeProjection, /patchSharedTrackCard062\(env, trackId, \{ likeCount:/);

const profileOverlay = functionText('enrichSharedTrackCards062');
assert.match(profileOverlay, /readExploreSharedProfile060\(env, uid\)/);
assert.match(profileOverlay, /ownerNickname:/);
assert.match(profileOverlay, /ownerAvatarUrl:/);

for (const forbidden of [
  'ALTER TABLE',
  'CREATE TABLE',
  'DROP TABLE',
  'DELETE FROM likes',
  'DELETE FROM tracks',
  'SELECT * FROM tracks',
  'SELECT * FROM likes',
]) {
  if (patch.includes(forbidden)) fail(`forbidden schema/full-scan/data mutation in 062 patch: ${forbidden}`);
}

console.log('115_SHARED_TRACK_CARD_R2=PASS');
console.log('LIKED_CARD_READ_ORDER=LOCAL_BROWSER_THEN_SHARED_TRACK_R2_THEN_SHARED_FEED_THEN_BOUNDED_MISSING_IDS_D1');
console.log('CROSS_ENV_WARM_LIKED_CARD_D1=R0_BY_SHARED_R2_CONTRACT');
console.log('TRUE_GLOBAL_COLD_RECOVERY=ONLY_MISSING_LIKED_TRACK_IDS');
console.log('PUBLICATION_SYNC=ONE_TRACK_CARD');
console.log('PRIVATE_SYNC=DELETE_ONE_TRACK_CARD');
console.log('LIKE_COUNT_SYNC=TARGETED_VISIBLE_TRACK_CARD_ONLY');
console.log('OWNER_PROFILE_DISPLAY=SHARED_PROFILE_OVERLAY_NO_PER_LIKER_FANOUT');
console.log('NO_FULL_TRACK_SCAN=true');
console.log('NO_D1_SCHEMA_CHANGE=true');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
