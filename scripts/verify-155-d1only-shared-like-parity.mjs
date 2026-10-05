import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/083-d1only-shared-like-parity.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const generatedPath = process.env.SORIDRAW_GENERATED_WORKER || '';
const generated = generatedPath ? readFileSync(generatedPath, 'utf8') : '';

assert.match(service, /trackId: pending\.trackId,\s*ownerUid: pending\.ownerUid,\s*liked: pending\.desiredLiked/);
assert.ok(manifest.patches.includes('083-d1only-shared-like-parity.mjs'));
assert.ok(
  manifest.patches.indexOf('083-d1only-shared-like-parity.mjs') >
  manifest.patches.indexOf('082-like-d1only-route.mjs'),
  '083 must run after 082 d1only route'
);

for (const token of [
  'SORIDRAW_D1ONLY_SHARED_LIKE_PARITY_083_20260924',
  'patchSharedFeedLikeCounts065(env, sharedRows155)',
  'patchExploreVisibleProfiles056(env, sharedRows155)',
  'ownerUid',
  'Promise.allSettled',
]) assert.ok(patch.includes(token), '083 patch missing: ' + token);

assert.doesNotMatch(
  patch.slice(patch.indexOf("const replacement ="), patch.indexOf("body=body.replace")),
  /env\.DB|\.prepare\s*\(|\.batch\s*\(/,
  '083 shared projection must not add D1 work'
);

if (generated) {
  for (const token of [
    'SORIDRAW_D1ONLY_SHARED_LIKE_PARITY_083_20260924',
    'patchSharedFeedLikeCounts065(env, sharedRows155)',
    'patchExploreVisibleProfiles056(env, sharedRows155)',
    "queue: 'd1only171'",
  ]) assert.ok(generated.includes(token), 'generated Worker missing: ' + token);
}

console.log('D1ONLY_SHARED_LIKE_PARITY=PASS');
console.log('SHARED_FEED_PROFILE_CARD_TARGETED_ONLY=PASS');
console.log('EXTRA_D1_WORK=0');
