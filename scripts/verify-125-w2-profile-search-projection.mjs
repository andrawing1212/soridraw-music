import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/068-w2-profile-search-projection.mjs', 'utf8');
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
const p067 = manifest.patches.indexOf('067-w2-feed-pagination.mjs');
const p068 = manifest.patches.indexOf('068-w2-profile-search-projection.mjs');
assert.equal(p068, p067 + 1, '068 must layer directly after 067');

for (const required of [
  'SORIDRAW_W2_PROFILE_SEARCH_PROJECTION_068_20260919',
  'bootstrapPublicationProfileR2068',
  'EXPLORE_W2_PROFILE_INDEX_PREFIX_068',
  'EXPLORE_W2_TITLE_INDEX_PREFIX_068',
  'EXPLORE_W2_GENRE_INDEX_PREFIX_068',
  'EXPLORE_W2_CREATOR_INDEX_PREFIX_068',
  'syncExploreFeedR2Publication043Core068',
  'syncExploreFeedR2Private043Core068',
  'syncExploreFeedR2OptionPatch043Core068',
  'handlePublicProfileCore068',
]) assert.ok(worker.includes(required), 'generated Worker missing ' + required);

const publish = functionText(worker, 'handleMusicNotePublicationSingleWrite016');
assert.match(publish, /bootstrapPublicationProfileR2068\(env, authContext, now\)/);
assert.doesNotMatch(publish, /publicationEnsureProfile016\(env, authContext, previous, now\)/,
  'brand-new Music Note publication must not create D1 public_profiles');
assert.match(publish, /publication_storage_version/);

for (const name of [
  'bootstrapPublicationProfileR2068',
  'putW2ProjectionObject068',
  'ensureW2CreatorIndex068',
  'updateW2SecondaryProjection068',
  'removeW2SecondaryProjection068',
]) {
  const block = functionText(worker, name);
  assert.doesNotMatch(block, /env\.DB|\.prepare\(/, name + ' must remain D1-free');
}

const bootstrap = functionText(worker, 'bootstrapPublicationProfileR2068');
assert.match(bootstrap, /readExploreSharedProfile060/);
assert.match(bootstrap, /writeExploreR2Json/);
assert.match(bootstrap, /writeExploreSharedProfile060/);
assert.match(bootstrap, /ensureW2CreatorIndex068/);

const publishProjection = functionText(worker, 'syncExploreFeedR2Publication043');
assert.match(publishProjection, /Number\(storageVersion \|\| 0\) === 1/);
assert.match(publishProjection, /updateW2SecondaryProjection068/);

const privateProjection = functionText(worker, 'syncExploreFeedR2Private043');
assert.match(privateProjection, /Number\(storageVersion \|\| 0\) === 1/);
assert.match(privateProjection, /removeW2SecondaryProjection068/);

const profile = functionText(worker, 'handlePublicProfile');
assert.ok(profile.indexOf('readExploreSharedProfile060') < profile.indexOf('handlePublicProfileCore068'),
  'public profile must try shared R2 before D1 legacy core');

const follow = functionText(worker, 'handleFollowR2Core');
assert.ok(follow.indexOf('readExploreSharedProfile060') < follow.indexOf('SELECT uid FROM public_profiles'),
  'follow target must accept shared R2 profile before D1 fallback');

for (const required of [
  'internal/explore/w2-profile-index-v125/',
  'internal/explore/w2-title-index-v125/',
  'internal/explore/w2-genre-index-v125/',
  'internal/explore/w2-creator-index-v125/',
]) assert.ok(patch.includes(required), 'missing R2 projection prefix ' + required);

for (const forbidden of [
  'INSERT INTO track_search_fts',
  'INSERT INTO track_tags',
  'UPDATE track_search_fts',
  'DELETE FROM track_search_fts',
]) assert.ok(!patch.includes(forbidden), '068 must not add D1 publication search writes: ' + forbidden);

console.log('APP125_FIRST_PUBLIC_PROFILE_R2_BOOTSTRAP=PASS');
console.log('APP125_FIRST_PUBLIC_PROFILE_D1_WRITE=ABSENT_BY_CONTRACT');
console.log('APP125_W2_TITLE_PROJECTION=R2');
console.log('APP125_W2_GENRE_PROJECTION=R2');
console.log('APP125_W2_CREATOR_PROJECTION=R2');
console.log('APP125_PUBLIC_PROFILE_LOOKUP=SHARED_R2_FIRST');
console.log('APP125_FOLLOW_TARGET=SHARED_R2_FIRST_WITH_D1_FALLBACK');
console.log('APP125_SHARED_D1_EXECUTION=NOT_RUN');
