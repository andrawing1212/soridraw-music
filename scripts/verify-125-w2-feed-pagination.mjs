import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/067-w2-feed-pagination.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const functionText = (source, name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, 'missing function ' + name);
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
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
};

assert.ok(Array.isArray(manifest.patches));
const p066 = manifest.patches.indexOf('066-publication-w2-shared-r2-authority.mjs');
const p067 = manifest.patches.indexOf('067-w2-feed-pagination.mjs');
assert.ok(p066 >= 0 && p067 === p066 + 1, '067 must layer directly after 066');

for (const required of [
  'SORIDRAW_W2_FEED_PAGINATION_067_20260919',
  'handleFeedWithEdgeCacheCore067',
  'handleW2FeedCursor067',
  'readLegacyFeedCandidates067',
  'readW2FeedCandidates067',
  'initializeW2State067',
  'w2State067',
  'HYBRID-W2-R2-D1-067',
]) {
  assert.ok(worker.includes(required), 'generated Worker missing ' + required);
}

const outer = functionText(worker, 'handleFeedWithEdgeCache');
assert.match(outer, /if \(!cursor \|\| limit !== 40\) return await handleFeedWithEdgeCacheCore067/);
assert.match(outer, /handleW2FeedCursor067\(request, url, env, cors\)/);
assert.ok(
  outer.indexOf('handleW2FeedCursor067') < outer.lastIndexOf('handleFeedWithEdgeCacheCore067'),
  'cursor hybrid path must run before legacy fallback core',
);

const legacy = functionText(worker, 'readLegacyFeedCandidates067');
assert.match(legacy, /explore_derived_tracks AS d INDEXED BY/);
assert.match(legacy, /JOIN tracks AS c ON c\.id=d\.id/);
assert.match(legacy, /c\.is_public=1/);
assert.match(legacy, /c\.status='published'/);
assert.match(legacy, /c\.publication_storage_version <> 1/);
assert.doesNotMatch(legacy, /FROM\s+tracks\s+(?:AS\s+)?t\b/i);
assert.doesNotMatch(legacy, /SELECT\s+\*\s+FROM\s+tracks/i);

const w2List = functionText(worker, 'listW2FeedPage067');
assert.match(w2List, /PROFILE_MEDIA/);
assert.match(w2List, /exploreW2FeedIndexPrefix066\(sort\)/);
assert.match(w2List, /include:\s*\['customMetadata'\]/);
assert.match(w2List, /options\.cursor = state\.cursor/);
assert.doesNotMatch(w2List, /env\.DB|\.prepare\(/);

const w2Read = functionText(worker, 'readW2FeedCandidates067');
assert.match(w2Read, /readSharedTrackCard062\(env, meta\.trackId\)/);
assert.match(w2Read, /w2FeedRankKey066\(sort, item\) === String\(object\?\.key \|\| ''\)/);
assert.doesNotMatch(w2Read, /env\.DB|\.prepare\(/);

const init = functionText(worker, 'initializeW2State067');
assert.match(init, /feedMetaAfterBoundary067/);
assert.match(init, /readSharedTrackCard062/);
assert.match(init, /w2FeedRankKey066/);

const handler = functionText(worker, 'handleW2FeedCursor067');
assert.match(handler, /Promise\.all\(\[/);
assert.match(handler, /readLegacyFeedCandidates067/);
assert.match(handler, /readW2FeedCandidates067/);
assert.match(handler, /sortExploreFeedItems012/);
assert.match(handler, /nextW2StateForBoundary067/);
assert.match(handler, /encodeCursor\(feedRankCursor067/);

for (const forbidden of [
  'SELECT * FROM tracks',
  'ORDER BY c.published_at',
  'ORDER BY t.published_at',
  'buildExploreFeedR2Payload',
  'syncDerivedCache032',
]) {
  assert.ok(!patch.includes(forbidden), '067 patch must not reintroduce expensive path: ' + forbidden);
}

// Small executable cursor-state model from the generated Worker. This does not touch D1/R2;
// it proves the opaque R2 cursor+offset state advances around the same global ranking boundary.
const modelNames = [
  'feedRankCursor067',
  'feedMeta067',
  'feedMetaAfterBoundary067',
  'normalizeW2State067',
  'stateAfterW2Object067',
  'initializeW2State067',
  'listW2FeedPage067',
  'readW2FeedCandidates067',
  'nextW2StateForBoundary067',
];
const cards = new Map([
  ['w2a', { id: 'w2a', publishedAt: 105, stats: { likeCount: 2 }, _key: 'k0' }],
  ['w2b', { id: 'w2b', publishedAt: 95, stats: { likeCount: 2 }, _key: 'k1' }],
  ['w2c', { id: 'w2c', publishedAt: 85, stats: { likeCount: 1 }, _key: 'k2' }],
]);
const objects = [
  { key: 'k0', customMetadata: { trackId: 'w2a', publishedAt: '105', likeCount: '2' } },
  { key: 'k1', customMetadata: { trackId: 'w2b', publishedAt: '95', likeCount: '2' } },
  { key: 'k2', customMetadata: { trackId: 'w2c', publishedAt: '85', likeCount: '1' } },
];
const ctx = vm.createContext({
  console,
  Map,
  Math,
  Number,
  String,
  Boolean,
  Promise,
  EXPLORE_W2_FEED_LIST_PAGE_067: 100,
  EXPLORE_W2_FEED_SCAN_PAGES_067: 4,
  getExploreFeedItemId012: (item) => String(item?.id || ''),
  getExploreFeedItemLikeCount012: (item) => Math.max(0, Number(item?.stats?.likeCount || item?.likeCount || 0)),
  exploreW2FeedIndexPrefix066: () => 'unused/',
  w2FeedRankKey066: (_sort, item) => item?._key || '',
  readSharedTrackCard062: async (_env, trackId) => cards.get(trackId) || null,
});
for (const name of modelNames) vm.runInContext(functionText(worker, name), ctx);
const env = {
  PROFILE_MEDIA: {
    async list() { return { objects, truncated: false, cursor: null }; },
  },
};
const boundary = { publishedAt: 100, id: 'legacy-boundary' };
const start = await ctx.initializeW2State067(env, 'latest', boundary);
assert.deepEqual({ cursor: start.cursor, offset: start.offset, end: start.end }, { cursor: null, offset: 1, end: false });
const candidates = await ctx.readW2FeedCandidates067(env, 'latest', start, 41);
assert.deepEqual(candidates.entries.map((entry) => entry.item.id), ['w2b', 'w2c']);
const next = ctx.nextW2StateForBoundary067(
  'latest',
  start,
  candidates.positions,
  candidates.stateAfterScan,
  { id: 'legacy-90', publishedAt: 90, stats: { likeCount: 0 } },
);
assert.equal(next.offset, 2, 'next page W2 state must advance to first W2 item below global boundary');

console.log('APP125_W2_FEED_PAGINATION_STATIC=PASS');
console.log('APP125_W2_FEED_PAGE2_PATH=LEGACY_INDEXED_D1_PLUS_W2_SHARED_R2');
console.log('APP125_W2_FEED_CANONICAL_TRACKS_FULL_SCAN=ABSENT');
console.log('APP125_W2_R2_CURSOR=OPAQUE_CURSOR_PLUS_OFFSET');
console.log('APP125_W2_STALE_RANK_OBJECT=IGNORED_BY_CARD_KEY_MATCH');
console.log('APP125_SHARED_D1_EXECUTION=NOT_RUN');
