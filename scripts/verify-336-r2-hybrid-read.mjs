import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EXPLORE_R2_HYBRID_SCHEMA_336,
  isExploreR2HybridReadEnabled336,
  orderHybridItems336,
  mergeHybridItems336,
  hybridBoundary336,
  hybridCursorPayload336,
  hybridCursorState336,
  mergeHybridSearch336,
} from '../cloudflare/explore-worker/runtime/r2-hybrid-read-336.js';

const legacy = [
  { id: 'old-3', publishedAt: 300, likeCount: 3, profilePinned: false, media: 'legacy-old-3' },
  { id: 'shared', publishedAt: 250, likeCount: 1, profilePinned: false, media: 'legacy-stale' },
  { id: 'old-1', publishedAt: 100, likeCount: 20, profilePinned: true, media: 'legacy-old-1' },
];

const catalog = [
  { id: 'new-4', publishedAt: 400, likeCount: 8, profilePinned: false, media: 'r2-new-4' },
  { id: 'shared', publishedAt: 250, likeCount: 99, profilePinned: true, media: 'r2-authority' },
  { id: 'new-2', publishedAt: 200, likeCount: 4, profilePinned: false, media: 'r2-new-2' },
];

assert.equal(EXPLORE_R2_HYBRID_SCHEMA_336, 1);
assert.equal(isExploreR2HybridReadEnabled336({ SORIDRAW_R2_CATALOG_V1: '1', SORIDRAW_R2_HYBRID_READ_V1: '1' }), true);
assert.equal(isExploreR2HybridReadEnabled336({ SORIDRAW_R2_CATALOG_V1: '1' }), false);
assert.equal(isExploreR2HybridReadEnabled336({ SORIDRAW_R2_HYBRID_READ_V1: '1' }), false);

assert.deepEqual(
  orderHybridItems336(legacy, [], 'latest').map((x) => x.id),
  ['old-3', 'shared', 'old-1'],
  'legacy-only latest ordering changed'
);
assert.deepEqual(
  orderHybridItems336([], catalog, 'latest').map((x) => x.id),
  ['new-4', 'shared', 'new-2'],
  'catalog-only latest ordering changed'
);

const mixedLatest = orderHybridItems336(legacy, catalog, 'latest');
assert.deepEqual(
  mixedLatest.map((x) => x.id),
  ['new-4', 'old-3', 'shared', 'new-2', 'old-1'],
  'mixed latest ordering mismatch'
);
assert.equal(mixedLatest.filter((x) => x.id === 'shared').length, 1, 'duplicate shared track survived merge');
assert.equal(mixedLatest.find((x) => x.id === 'shared')?.media, 'r2-authority', 'stale legacy media overwrote R2 authority');
assert.equal(mixedLatest.find((x) => x.id === 'shared')?.likeCount, 99, 'stale legacy count overwrote R2 authority');

const mixedPopular = orderHybridItems336(legacy, catalog, 'popular');
assert.equal(mixedPopular[0].id, 'shared', 'R2 like count did not control popular ordering');
assert.equal(mixedPopular[1].id, 'old-1', 'legacy-only popular track missing');

const mixedProfile = orderHybridItems336(legacy, catalog, 'profile');
assert.deepEqual(
  mixedProfile.slice(0, 2).map((x) => x.id),
  ['shared', 'old-1'],
  'profile pinned ordering mismatch'
);

const page = mergeHybridItems336(legacy, catalog, 'latest', 3);
assert.equal(page.items.length, 3);
assert.equal(page.ordered.length, 5);
assert.deepEqual(hybridBoundary336('latest', page.items.at(-1)), { publishedAt: 250, id: 'shared' });
assert.deepEqual(hybridBoundary336('popular', mixedPopular[0]), { likeCount: 99, publishedAt: 250, id: 'shared' });
assert.deepEqual(hybridBoundary336('profile', mixedProfile[0]), { profilePinned: 1, publishedAt: 250, id: 'shared' });

const cursorPayload = hybridCursorPayload336('latest', 'internal/explore/catalog-v1/latest/', {
  boundary: { publishedAt: 250, id: 'shared' },
  r2Started: true,
  r2Done: false,
  r2Next: { r2Cursor: 'cursor-1' },
  r2Carry: ['new-2', 'new-2', '', 'new-1'],
});
assert.equal(cursorPayload.hybridV1, 1);
assert.deepEqual(cursorPayload.r2Carry, ['new-2', 'new-1']);
assert.deepEqual(
  hybridCursorState336(cursorPayload, 'latest', 'internal/explore/catalog-v1/latest/'),
  {
    boundary: { publishedAt: 250, id: 'shared' },
    r2Started: true,
    r2Done: false,
    r2Next: { r2Cursor: 'cursor-1' },
    r2Carry: ['new-2', 'new-1'],
  }
);
assert.equal(hybridCursorState336(cursorPayload, 'popular', 'internal/explore/catalog-v1/latest/'), null);
assert.equal(hybridCursorState336(cursorPayload, 'latest', 'wrong-prefix'), null);

const search = mergeHybridSearch336(
  {
    query: 'night',
    items: [
      { id: 'legacy-only', title: 'Night Road', publishedAt: 100 },
      { id: 'same-search', title: 'Night Old', publishedAt: 90, media: 'stale' },
    ],
    creators: [{ uid: 'u-old', nickname: 'Old Artist' }],
    nextCursor: 'legacy-next',
  },
  {
    query: 'night',
    items: [
      { id: 'same-search', title: 'Night New', publishedAt: 90, media: 'fresh' },
      { id: 'catalog-only', title: 'Night', publishedAt: 80 },
    ],
    creators: [
      { uid: 'u-old', nickname: 'R2 Artist' },
      { uid: 'u-new', nickname: 'New Artist' },
    ],
    nextCursor: null,
  },
  'night',
  20
);
assert.equal(search.items.filter((x) => x.id === 'same-search').length, 1);
assert.equal(search.items.find((x) => x.id === 'same-search')?.media, 'fresh');
assert.equal(search.items[0].id, 'catalog-only', 'exact-title search priority changed');
assert.equal(search.creators.find((x) => x.uid === 'u-old')?.nickname, 'R2 Artist');
assert.equal(search.nextCursor, 'legacy-next', 'legacy deep-search cursor was lost');

const runtimeSource = fs.readFileSync(new URL('../cloudflare/explore-worker/runtime/r2-hybrid-read-336.js', import.meta.url), 'utf8');
assert.match(runtimeSource, /SORIDRAW_R2_HYBRID_READ_336_20261004/);
assert.doesNotMatch(runtimeSource, /\.prepare\s*\(|env\?*\.DB|env\.DB/);
assert.doesNotMatch(runtimeSource, /\b(?:CREATE|DROP|ALTER)\s+(?:TABLE|INDEX|TRIGGER)\b/i);

const composerSource = fs.readFileSync(new URL('../.deploy/apply_336_hybrid_read.py', import.meta.url), 'utf8');
assert.match(composerSource, /pageIndex < 4/);
assert.match(composerSource, /filterLegacyCatalogOwned336/);
assert.match(composerSource, /readCatalogJson066\(env, catalogMetaKey066\(id\)\)/);
assert.doesNotMatch(composerSource, /d1 execute|wrangler|migration|backfill/i);

const generatedPath = process.env.SORIDRAW_GENERATED_WORKER || '';
if (generatedPath) {
  const worker = fs.readFileSync(generatedPath, 'utf8');
  for (const token of [
    'SORIDRAW_R2_HYBRID_READ_336_20261004',
    'isExploreR2HybridReadEnabled336',
    'filterLegacyCatalogOwned336',
    'collectHybridCatalog336',
    'buildHybridNextCursor336',
    'handleFeedWithEdgeCacheCore336',
    'handleProfileTracksCore336',
    'handleGenreTracksCore336',
    'handleSearchCore336',
    'R2-LEGACY-FEED-336',
    'R2-LEGACY-PROFILE-336',
    'R2-LEGACY-GENRE-336',
    'R2-LEGACY-SEARCH-336',
  ]) {
    assert.ok(worker.includes(token), 'generated worker missing ' + token);
  }
  assert.ok(worker.indexOf('SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919')
    < worker.indexOf('SORIDRAW_R2_HYBRID_READ_336_20261004'), 'hybrid layer must compose after catalog runtime');
  assert.match(
    worker,
    /async function collectHybridLegacyKind336\(env, baseUrl, limit, boundary, prefix, kind, fetchPage\)/,
    'hybrid legacy collector must receive Worker env explicitly'
  );
  assert.equal(
    (worker.match(/collectHybridLegacyKind336\(\s*env,\s*url,/g) || []).length,
    3,
    'feed/profile/genre must all pass Worker env to the legacy catalog-ownership filter'
  );
}

console.log('APP336_HYBRID_READ_HELPERS=PASS');
console.log('APP336_LEGACY_ONLY=PASS');
console.log('APP336_CATALOG_ONLY=PASS');
console.log('APP336_MIXED_DEDUPE=PASS');
console.log('APP336_R2_DUPLICATE_AUTHORITY=PASS');
console.log('APP336_CURSOR_STATE=PASS');
console.log('APP336_SEARCH_MERGE=PASS');
console.log('APP336_BOUNDED_COMPAT_SCAN_MAX_PAGES=4');
console.log('APP336_SHARED_D1_SCHEMA_CHANGE=0');
console.log('APP336_USER_DATA_MIGRATION=0');
