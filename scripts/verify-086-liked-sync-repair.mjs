import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const functionText = (source, name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `missing function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
};

assert.ok(Number(version.version) >= 86, `expected app version 086+, got ${version.version}`);
assert.ok(manifest.patches.includes('053-liked-track-schema-repair.mjs'));
assert.match(worker, /SORIDRAW_LIKED_TRACK_SCHEMA_REPAIR_053_20260914/);

const handler = functionText(worker, 'handleMyLikedTracks052');
assert.match(handler, /const canonicalLikedTrackIds = \[\.\.\.likedIds\]/);
assert.match(handler, /if \(!trackIds\.length\)[\s\S]{0,240}likedTrackIds: canonicalLikedTrackIds/);
assert.match(handler, /p\.nickname AS owner_nickname/);
assert.match(handler, /p\.avatar_url AS owner_avatar_url/);
assert.match(handler, /LEFT JOIN public_profiles p ON p\.uid = t\.owner_uid/);
assert.doesNotMatch(handler, /LEFT JOIN profiles p ON p\.uid = t\.owner_uid/);
assert.doesNotMatch(handler, /t\.owner_nickname|t\.owner_avatar_url/);
assert.match(handler, /JOIN tracks t ON t\.id = r\.id/);
assert.doesNotMatch(handler, /WHERE t\.owner_uid = \? AND t\.id IN/);

assert.match(liked, /SORIDRAW_EXPLORE_LIKED_TRACK_CANONICAL_REPAIR_086_20260914/);
assert.match(liked, /canonicalLikedTrackIds: string\[\] \| null/);
assert.match(liked, /requestLikedTracks\(user, \[\]\)/);
assert.match(liked, /export const invalidateExploreLikedTrackCollection/);
assert.match(liked, /export const patchExploreLikedTrackMembership/);
assert.doesNotMatch(liked, /firestoreMeasured|updateDoc\(|setDoc\(|addDoc\(/);

assert.match(like, /patchExploreLikedTrackMembership/);
assert.doesNotMatch(like, /clearExplorePersonalSocialSnapshot/);
assert.doesNotMatch(like, /invalidateExploreLikedTrackCollection/);
assert.doesNotMatch(like, /if \(missedSignal\)/);
assert.match(like, /SORIDRAW_EXPLORE_UPDATE_ZERO_READ_099_20260916/);
assert.match(like, /rememberAccountSyncResults\(uid, effectiveResults\);[\s\S]{0,320}patchExploreLikedTrackMembership\(uid, result\.trackId, result\.liked\);/);
assert.match(like, /patchExplorePersonalSocialLike\(user\.uid, normalizedTrackId, liked\);[\s\S]{0,180}patchExploreLikedTrackMembership\(user\.uid, normalizedTrackId, liked\);/);

console.log('PASS 086/099: liked collection keeps valid profile joins and canonical local membership; warm cache stays request-free, while missed account signal gaps preserve cache and merge retained RTDB deltas without full liked-list rehydrate.');
