import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerFile = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerFile, 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

assert.ok(Number(version.version) >= 125, 'app125 first-update preservation must remain available in later releases');
assert.match(page, /SORIDRAW_EXPLORE_UPDATE_FIRST_SHARED_CONVERGENCE_125_20260920/);
assert.match(page, /EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_PREFIX\}:\$\{__SORIDRAW_APP_VERSION__\}:\$\{sort\}/);
assert.match(page, /const oneTimeSharedRepair124 = feedRequest && !hasExploreSharedLikeCacheRepair124\(requestUrl\)/);
assert.match(page, /const snapshot = await fetchFeedSnapshot108\(null\)/);
assert.match(page, /setTracks\(overlayActorLikeCounts120\(cachedTracks\)\)/);
assert.match(page, /patchExploreFeedSessionCachesRow\(track.id, \{ likeCount: track.likeCount \}\)/);
assert.match(page, /markExploreSharedLikeCacheRepair124\(requestUrl\)/);
assert.doesNotMatch(page, /window\.localStorage\.clear\(/);

const applyStart = page.indexOf('const applyPayload =');
const applyEnd = page.indexOf('if (cachedRows) {', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart, '125 snapshot apply boundary');
const apply = page.slice(applyStart, applyEnd);
assert.match(apply, /payload\?\.ok !== true \|\| !Array\.isArray\(payload\?\.data\?\.items\)/);
assert.match(apply, /throw new Error\('Invalid Explore snapshot; preserving the previous Feed'\)/);
assert.ok(
  apply.indexOf('setTracks(displayTracks);') <
  apply.indexOf('syncSharedPublicCountsToLocal110(normalizedTracks);') &&
  apply.indexOf('syncSharedPublicCountsToLocal110(normalizedTracks);') <
  apply.indexOf('markExploreSharedLikeCacheRepair124(requestUrl);'),
  '125 completion marker must follow successful snapshot, display and shared cache update'
);
const firstStart = page.indexOf('const oneTimeSharedRepair124 =');
const firstEnd = page.indexOf('const revalidateRequested', firstStart);
const first = page.slice(firstStart, firstEnd);
assert.match(first, /fetchFeedSnapshot108\(null\)/);
assert.match(first, /applyPayload\(snapshot\.payload, snapshot\.revision\)/);
assert.doesNotMatch(first, /markExploreSharedLikeCacheRepair124\(requestUrl\)/, 'first attempt must not mark itself');
assert.doesNotMatch(first, /fetchRevision\(/, 'update must never perform D1 feed revision read');

for (const name of ['069-shared-feed-targeted-parity.mjs', '070-shared-feed-legacy-writer-guard.mjs', '071-publication-canonical-like-parity.mjs']) {
  assert.ok(manifest.patches.includes(name), 'replayable patch missing ' + name);
}
assert.ok(
  manifest.patches.indexOf('069-shared-feed-targeted-parity.mjs') <
  manifest.patches.indexOf('070-shared-feed-legacy-writer-guard.mjs') &&
  manifest.patches.indexOf('070-shared-feed-legacy-writer-guard.mjs') <
  manifest.patches.indexOf('071-publication-canonical-like-parity.mjs'),
  'patch application order must preserve 069 → 070 → 071'
);

function functionText(name) {
  const prefixes = ['async function ', 'function '];
  const start = prefixes.map(prefix => worker.indexOf(prefix + name + '(')).filter(x => x >= 0)[0];
  if (start === undefined) throw Error('missing runtime ' + name);
  const brace = worker.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < worker.length; i += 1) {
    const c = worker[i], next = worker[i+1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (c === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return worker.slice(start, i+1);
  }
  throw Error('unterminated runtime ' + name);
}

const get = name => functionText(name);
const local = get('syncExploreFeedR2Publication043Core044');
const shared = get('sharedFeedNext069');
const profile = get('patchExploreProfileR2Publication043Core044');
const likePatch = get('patchSharedFeedLikeCounts065');
for (const text of [local, shared, profile]) {
  assert.match(text, /likeCount: (?:incomingItem|incoming|change\.item)\.likeCount/);
}
assert.match(local, /likeCount: incomingItem\.likeCount \}/);
assert.match(shared, /likeCount: incoming\.likeCount \}/);
assert.match(profile, /likeCount: change\.item\.likeCount \}/);
assert.match(likePatch, /onlyIf: \{ etagMatches: object\.etag \}/);
assert.doesNotMatch(likePatch, /env\.DB|\.prepare\s*\(/);

const observed = [];
let canonical = 1;
let missing = false;
const env = {
  DB: {
    prepare(sql) {
      assert.match(sql, /WHERE t\.id=\?/);
      assert.match(sql, /LEFT JOIN track_stats s ON s\.track_id=t\.id/);
      assert.doesNotMatch(sql, /ORDER BY|OFFSET|SELECT \*/i);
      return { bind(id) {
        assert.equal(id, 'test-song');
        return { first: async () => missing ? null : { like_count: canonical } };
      }};
    },
  },
};
const runtime = new Function(
  'syncExploreFeedR2Publication043Core069',
  'syncExploreSharedFeedTargeted069',
  'patchExploreProfileR2Publication043Core046',
  'sortExploreFeedItems012', 'buildExploreFeedCursor012', 'EXPLORE_R2_FEED_LIMIT',
  [
    get('readCanonicalPublicationLike071'),
    get('withCanonicalPublicationLike071'),
    get('sharedFeedId069'),
    shared,
    get('syncExploreFeedR2Publication043'),
    get('patchExploreProfileR2Publication043'),
    'return { sharedFeedNext069, syncExploreFeedR2Publication043, patchExploreProfileR2Publication043 };',
  ].join('\n'),
)(
  async (_env, item) => { observed.push({ target: 'local', item }); return { ok: true }; },
  async (_env, operation) => { observed.push({ target: 'shared', operation }); return { ok: true }; },
  async (_env, _uid, change) => { observed.push({ target: 'profile', change }); return { ok: true }; },
  (items, sort) => [...items].sort((a, b) => sort === 'popular'
    ? Number(b.likeCount || 0) - Number(a.likeCount || 0)
    : Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
  () => null,
  40,
);

const incoming = { id: 'test-song', title: 'Original', publishedAt: 5, likeCount: 0, stats: { likeCount: 0 } };
let result = await runtime.syncExploreFeedR2Publication043(env, incoming);
assert.equal(result.ok, true);
assert.equal(observed.length, 2);
assert.equal(observed[0].item.likeCount, 1);
assert.equal(observed[1].operation.item.likeCount, 1);
assert.equal(incoming.likeCount, 0, 'metadata input must not be mutated');
const previous = { payload: { data: { items: [incoming] } }, updatedAt: 0 };
const updated = runtime.sharedFeedNext069(previous, 'latest', observed[1].operation);
assert.equal(updated.payload.data.items[0].likeCount, 1, 'stale public zero must be replaced by canonical one');
assert.equal(updated.payload.data.items[0].stats.likeCount, 1);
result = await runtime.patchExploreProfileR2Publication043(env, 'owner', { trackId: 'test-song', item: incoming });
assert.equal(result.ok, true);
assert.equal(observed.at(-1).change.item.likeCount, 1);
assert.equal(observed.at(-1).change.item.stats.likeCount, 1);
console.log('125_REPUBLISH_CANONICAL_ONE_FEED_PROFILE=PASS');

canonical = 0;
observed.length = 0;
await runtime.syncExploreFeedR2Publication043(env, incoming);
const unlike = runtime.sharedFeedNext069(updated, 'latest', observed[1].operation);
assert.equal(unlike.payload.data.items[0].likeCount, 0, 'legitimate unlike must be allowed to reduce count');
assert.equal(unlike.payload.data.items[0].stats.likeCount, 0);
console.log('125_CANONICAL_UNLIKE_ZERO_NOT_MAX_GUARD=PASS');

observed.length = 0;
missing = true;
result = await runtime.syncExploreFeedR2Publication043(env, incoming);
assert.equal(result.ok, false);
assert.equal(result.repairNeeded, true);
assert.equal(observed.length, 0, 'canonical absence must not write a derived zero');
console.log('125_MISSING_CANONICAL_FAIL_CLOSED=PASS');
console.log('125_UPDATE_REFRESH_SHARED_R2_ONCE_PER_VERSION_AND_SORT=PASS');
console.log('125_NO_NAVIGATION_D1_AND_NO_BULK_FEED_REBUILD=PASS');
