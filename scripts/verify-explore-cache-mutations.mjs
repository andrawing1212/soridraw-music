import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { applyCacheMutationSafety } from '../cloudflare/explore-worker/scripts/cache-mutation-safety.mjs';

function helpers(file, variable = 'helpers') {
  const text = readFileSync(`cloudflare/explore-worker/patches/${file}`, 'utf8').replaceAll('\r\n', '\n');
  const start = text.indexOf(`const ${variable} = `) + `const ${variable} = `.length;
  const end = text.indexOf('\n`;\n', start) + 2;
  assert.ok(start > 0 && end > start);
  return vm.runInNewContext(text.slice(start, end), { marker: 'fixture' });
}

const oldFeed = helpers('009-explore-r2-feed-like-bundles.mjs');
const publication = helpers('012-explore-publication-incremental-feed-sync.mjs');
const profile = helpers('019-publication-profile-r2-delta.mjs', 'helperSource');
const oldProfile = helpers('020-profile-r2-alias-bounded-repair.mjs');
const fixture = `${oldFeed}\n${publication}\n${profile}\n${oldProfile}
${helpers('031-explore-shared-canonical-data.mjs')}
async function syncExploreFeedR2Private017() { throw new Error('legacy private'); }
async function syncExploreFeedR2OptionPatch017() { throw new Error('legacy options'); }
const PUBLIC_PROFILE_FIRST_VIEW_LIMIT = 50;
const EXPLORE_R2_PROFILE_SCHEMA_VERSION = 1;
const exploreProfileR2Key = uid => 'profile/' + uid;
`;
const upgraded = applyCacheMutationSafety(fixture);
assert.equal(applyCacheMutationSafety(upgraded), upgraded, 'upgrade must be idempotent');
new vm.Script(upgraded);
const patchDir = mkdtempSync(join(tmpdir(), 'soridraw-cas-patch-'));
try {
  writeFileSync(join(patchDir, 'worker.js'), fixture + '\n// SORIDRAW_EXPLORE_SHARED_CANONICAL_DATA_031_20260909');
  const patchFile = resolve('cloudflare/explore-worker/patches/031-explore-shared-canonical-data.mjs');
  const options = { encoding: 'utf8', env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchDir } };
  const applied = spawnSync(process.execPath, [patchFile], options);
  assert.equal(applied.status, 0, applied.stderr);
  const once = readFileSync(join(patchDir, 'worker.js'), 'utf8');
  assert.ok(once.includes('SORIDRAW_CACHE_MUTATION_CAS_052'));
  assert.equal(spawnSync(process.execPath, ['--check', join(patchDir, 'worker.js')], options).status, 0);
  assert.equal(spawnSync(process.execPath, [patchFile], options).status, 0);
  assert.equal(readFileSync(join(patchDir, 'worker.js'), 'utf8'), once);
} finally { rmSync(patchDir, { recursive: true, force: true }); }
console.log('PASS already-applied 031 upgrade, syntax and replay idempotency');

const feedKey = sort => `internal/explore/feed-v1/${sort}-40.json`;
const track = (id, likeCount = 0, publishedAt = 1) => ({ id, likeCount, publishedAt, title: id });
const feed = items => ({ schemaVersion: 1, payload: { data: { items, nextCursor: 'older' } } });
const profileBundle = items => ({ schemaVersion: 1, revision: 1, body: { data: {
  profile: { uid: 'owner', trackCount: items.length, bio: 'keep' }, items, revision: 1
} } });

function setup(items = [track('a'), track('b')]) {
  let sequence = 0;
  const objects = new Map();
  const counts = { get: 0, put: 0, conflict: 0, query: 0 };
  const canonical = new Map(items.map(item => [item.id, { ...item }]));
  const seed = (key, payload) => objects.set(key, { body: JSON.stringify(payload), etag: String(++sequence) });
  seed(feedKey('latest'), feed(items)); seed(feedKey('popular'), feed(items));
  seed('profile/owner', profileBundle(items));
  const env = { EXPLORE_CACHE: {
    async head(key) { const item = objects.get(key); return item ? { etag: item.etag } : null; },
    async get(key) {
      counts.get++; const item = objects.get(key);
      return item ? { etag: item.etag, text: async () => item.body } : null;
    },
    async put(key, body, options) {
      counts.put++;
      assert.ok(options.onlyIf?.etagMatches || options.onlyIf?.etagDoesNotMatch === '*', 'every mutation write must be conditional');
      if (options.onlyIf.etagMatches ? objects.get(key)?.etag !== options.onlyIf.etagMatches : objects.has(key)) { counts.conflict++; return null; }
      const etag = String(++sequence); objects.set(key, { body, etag }); return { etag };
    }
  }, DB: { prepare(sql) {
    if (sql.includes('FROM likes WHERE')) return { bind(id) { return { async first() { counts.query++; return { track_id: id }; } }; } };
    if (sql.includes('FROM profile_stats')) return { bind() { return { async first() { counts.query++; return { follower_count: 3 }; } }; } };
    assert.match(sql, /WHERE t\.id = \?/); assert.match(sql, /LIMIT 1/);
    assert.doesNotMatch(sql, /ORDER BY|COUNT\(|OFFSET/i);
    return { bind(id) { return { async first() { counts.query++; return canonical.get(id) || null; } }; } };
  } } };
  const ctx = vm.createContext({ console, mapTrackRow: row => row,
    encodeCursor: value => JSON.stringify(value) });
  vm.runInContext(upgraded, ctx);
  return { ctx, env, canonical, counts, objects, seed,
    read: key => JSON.parse(objects.get(key).body) };
}

let s = setup();
s.canonical.get('a').likeCount = 1; s.canonical.get('b').likeCount = 2;
await Promise.all([s.ctx.patchExploreFeedR2LikeCount(s.env, 'a', 1), s.ctx.patchExploreFeedR2LikeCount(s.env, 'b', 2)]);
for (const sort of ['latest', 'popular']) {
  const result = s.read(feedKey(sort)).payload.data.items;
  assert.equal(result.find(x => x.id === 'a').likeCount, 1);
  assert.equal(result.find(x => x.id === 'b').likeCount, 2);
}
assert.ok(s.counts.conflict > 0, 'test must force a conflicting write');
console.log('PASS concurrent likes preserve both changes');

s = setup();
s.canonical.get('a').likeCount = 4;
s.canonical.set('new', track('new', 0, 100)); s.canonical.delete('b');
await Promise.all([
  s.ctx.syncExploreFeedR2Publication012(s.env, track('new', 0, 100)),
  s.ctx.syncExploreFeedR2Private017(s.env, 'b'),
  s.ctx.patchExploreFeedR2LikeCount(s.env, 'a', 4),
  s.ctx.syncExploreFeedR2OptionPatch017(s.env, 'a', { allowFollowerSave: true })
]);
for (const sort of ['latest', 'popular']) {
  const result = s.read(feedKey(sort)).payload.data.items;
  assert.ok(result.some(x => x.id === 'new'));
  assert.ok(!result.some(x => x.id === 'b'));
  assert.equal(result.find(x => x.id === 'a').likeCount, 4);
  assert.equal(result.find(x => x.id === 'a').allowFollowerSave, true);
}
console.log('PASS publication/private/options/like conflicts');

s = setup(); s.canonical.get('a').likeCount = 5;
s.canonical.set('new', track('new')); s.canonical.delete('b');
await Promise.all([
  s.ctx.patchExploreProfileR2Mutation019(s.env, 'owner', { trackId: 'new', item: track('new'), trackCountDelta: 1 }),
  s.ctx.patchExploreProfileR2Mutation019(s.env, 'owner', { trackId: 'b', remove: true, trackCountDelta: -1 }),
  s.ctx.patchExploreProfileR2Like020(s.env, 'owner', 'a', 5),
  s.ctx.patchExploreProfileR2Counters020(s.env, 'owner', { followerCount: 3 })
]);
const data = s.read('profile/owner').body.data;
assert.equal(data.profile.trackCount, 2); assert.equal(data.profile.followerCount, 3);
assert.equal(data.profile.bio, 'keep'); assert.equal(data.revision, 5);
assert.equal(data.items.find(x => x.id === 'a').likeCount, 5);
assert.ok(data.items.some(x => x.id === 'new')); assert.ok(!data.items.some(x => x.id === 'b'));
console.log('PASS profile deltas and monotonic revision');

s = setup(Array.from({ length: 40 }, (_, i) => track(`t${i}`, 10, 100 - i)));
s.canonical.set('outside', track('outside', 11, 200));
const latestBefore = s.objects.get(feedKey('latest')).body;
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'outside', 11);
assert.equal(s.objects.get(feedKey('latest')).body, latestBefore);
assert.equal(s.counts.query, 1); assert.equal(s.counts.put, 1);
const ranked = s.read(feedKey('popular')).payload.data;
assert.equal(ranked.items.length, 40); assert.equal(ranked.items[0].id, 'outside');
assert.equal(JSON.parse(ranked.nextCursor).id, ranked.items.at(-1).id);
console.log('PASS outside candidate enters top 40: 1 ID query, 0 latest writes, 1 popular write');
s.canonical.set('low', track('low', 0, 200));
const writes = s.counts.put;
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'low', 0);
assert.equal(s.counts.put, writes, 'ineligible candidate must not rewrite bundle');
console.log('PASS outside ineligible candidate no-op');

s = setup(); s.canonical.get('a').likeCount = 7;
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'a', 1);
assert.equal(s.read(feedKey('popular')).payload.data.items.find(x => x.id === 'a').likeCount, 7);
const before = s.counts.put;
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'a', 1);
assert.equal(s.counts.put, before);
console.log('PASS stale like response and duplicate no-op');

s = setup(); s.objects.delete(feedKey('popular'));
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'missing', 10);
assert.equal(s.counts.query, 0); assert.equal(s.counts.put, 0);
s.objects.set(feedKey('popular'), { body: '{broken', etag: 'broken' });
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'missing', 10);
assert.equal(s.counts.query, 0); assert.equal(s.counts.put, 0);
console.log('PASS missing/corrupt mutation cache: no rebuild or data writes');

s = setup(); s.canonical.delete('b'); s.env.EXPLORE_CACHE.put = async () => null;
await assert.rejects(s.ctx.syncExploreFeedR2Private017(s.env, 'b'), /contention/);
assert.equal(s.read(feedKey('latest')).payload.data.items.length, 2);
console.log('PASS exhausted conflicts fail without an unconditional overwrite');

// An old full rebuild must not undo a successful delta, or delete the good cache.
s = setup();
s.ctx.buildExploreFeedR2PayloadCore052 = async () => feed([track('a'), track('b')]);
const stale = await s.ctx.buildExploreFeedR2Payload(s.env, 'latest');
s.canonical.get('a').likeCount = 9;
await s.ctx.patchExploreFeedR2LikeCount(s.env, 'a', 9);
await assert.rejects(s.ctx.writeExploreR2Json(s.env, feedKey('latest'), stale), /superseded/);
assert.equal(s.read(feedKey('latest')).payload.data.items.find(x => x.id === 'a').likeCount, 9);
console.log('PASS stale full snapshot cannot overwrite mutation');

s = setup();
s.ctx.readPublicProfileFirstViewBaseProfile = async () => ({ uid: 'owner', handle: 'artist', bio: 'edited' });
s.ctx.writeExploreProfileAlias020 = async () => true;
s.canonical.get('a').likeCount = 4;
await Promise.all([
  s.ctx.refreshOrPrebuildPublicProfileFirstView(s.env, 'owner'),
  s.ctx.patchExploreProfileR2Like020(s.env, 'owner', 'a', 4)
]);
assert.equal(s.read('profile/owner').body.data.profile.bio, 'edited');
assert.equal(s.read('profile/owner').body.data.items.find(x => x.id === 'a').likeCount, 4);
console.log('PASS profile edit and like preserve both fields');

s = setup();
s.seed('internal/explore/likes-v1/viewer.json', { schemaVersion: 1, likedTrackIds: [] });
await Promise.all([
  s.ctx.syncExploreLikeR2AfterMutation(s.env, 'viewer', 'a', true),
  s.ctx.syncExploreLikeR2AfterMutation(s.env, 'viewer', 'b', true)
]);
assert.deepEqual(s.read('internal/explore/likes-v1/viewer.json').likedTrackIds.sort(), ['a','b']);
console.log('PASS viewer like-list concurrent mutations');
console.log('VERIFY_EXPLORE_CACHE_MUTATIONS=PASS');
