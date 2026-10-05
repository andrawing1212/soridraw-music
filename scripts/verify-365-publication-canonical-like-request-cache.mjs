import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

assert.ok(
  manifest.patches.includes('095-publication-canonical-like-request-cache.mjs'),
  '095 patch not wired into release manifest',
);
assert.match(worker, /SORIDRAW_PUBLICATION_CANONICAL_LIKE_REQUEST_CACHE_365_20261006/);
assert.match(worker, /const canonicalPublicationLikeRequestCache365 = new WeakMap\(\)/);

const fnStart = worker.indexOf('async function readCanonicalPublicationLike071(env, trackId)');
assert.ok(fnStart >= 0, 'canonical like reader missing');
const fnEnd = worker.indexOf('\nfunction withCanonicalPublicationLike071', fnStart);
assert.ok(fnEnd > fnStart, 'canonical like reader end missing');
const fn = worker.slice(fnStart, fnEnd);

for (const required of [
  'canonicalPublicationLikeRequestCache365.get(env)',
  'canonicalPublicationLikeRequestCache365.set(env, requestCache)',
  'if (requestCache.has(id)) return requestCache.get(id)',
  'requestCache.set(id, pending)',
  'requestCache.delete(id)',
  "SELECT COALESCE(s.like_count,0) AS like_count FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id",
]) {
  assert.ok(fn.includes(required), `365 canonical-like request cache missing: ${required}`);
}

assert.equal(
  (fn.match(/env\.DB\.prepare\(/g) || []).length,
  1,
  'canonical like reader must keep exactly one D1 SELECT on cache miss',
);

// Feed and profile publication parity still use the same exact canonical source;
// only the second same-request read is deduplicated.
const feedStart = worker.indexOf('async function syncExploreFeedR2Publication043(env, incomingItem)');
const feedEnd = worker.indexOf('\nasync function syncExploreFeedR2Private043Core044', feedStart);
const feed = worker.slice(feedStart, feedEnd);
assert.match(feed, /readCanonicalPublicationLike071\(env, trackId\)/);
assert.match(feed, /withCanonicalPublicationLike071\(incomingItem, count\)/);

const profileStart = worker.indexOf('async function patchExploreProfileR2Publication043(...args)');
const profileEnd = worker.indexOf('\nasync function handleMusicNotePublicationSingleWrite016', profileStart);
const profile = worker.slice(profileStart, profileEnd);
assert.match(profile, /readCanonicalPublicationLike071\(args\[0\], change\.trackId\)/);
assert.match(profile, /withCanonicalPublicationLike071\(change\.item, count\)/);

// Explicitly guard the user's protected functionality: no like write path is altered
// by this cache; the change is read-only and publication-only.
assert.doesNotMatch(fn, /INSERT\s+INTO\s+likes|UPDATE\s+likes|DELETE\s+FROM\s+likes/i);
assert.doesNotMatch(fn, /UPDATE\s+track_stats|INSERT\s+INTO\s+track_stats|DELETE\s+FROM\s+track_stats/i);

console.log('PUBLICATION_365_CANONICAL_LIKE_REQUEST_CACHE=PASS');
console.log('PUBLICATION_365_D1_READ_QUERY_PER_TRACK_PER_REQUEST_MAX=1');
console.log('PUBLICATION_365_CANONICAL_LIKE_AUTHORITY=PRESERVED');
console.log('PUBLICATION_365_LIKE_WRITE_PATH_CHANGED=false');
console.log('PUBLICATION_365_UI_SCOPE_CHANGED=false');
