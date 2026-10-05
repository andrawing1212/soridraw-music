import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const runtime = readFileSync('cloudflare/explore-worker/runtime/publication-r2-only-read-358.js', 'utf8');
const composer = readFileSync('.deploy/apply_358_r2_only_publication_read.py', 'utf8');
const wrangler = readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8');

const extractFunction = (source, name) => {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] || '';
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

assert.ok(runtime.includes('SORIDRAW_PUBLICATION_R2_ONLY_READ_CUTOVER_358_20261005'));
assert.ok(runtime.includes("SORIDRAW_PUBLICATION_R2_ONLY_READ_V1"));
assert.doesNotMatch(runtime, /\b(?:env\.?DB|\.prepare\s*\()/, 'pure R2-only gate added D1 access');
assert.ok(composer.includes('flag remains OFF'), 'composer does not declare dormant behavior');

for (const marker of [
  'SORIDRAW_PUBLICATION_R2_ONLY_READ_CUTOVER_358_20261005',
  'SORIDRAW_R2_HYBRID_READ_336_20261004',
  'SORIDRAW_SEARCH_R2_ONLY_341_20261004',
  'handleFeedWithEdgeCacheCore358',
  'handleProfileTracksCore358',
  'handleGenreTracksCore358',
  'handlePublicationR2OnlyFeed358',
  'handlePublicationR2OnlyProfile358',
  'handlePublicationR2OnlyGenre358',
]) assert.ok(worker.includes(marker), `canonical Worker missing: ${marker}`);

const feedWrapper = extractFunction(worker, 'handleFeedWithEdgeCache');
const profileWrapper = extractFunction(worker, 'handleProfileTracks');
const genreWrapper = extractFunction(worker, 'handleGenreTracks');
for (const [label, fn, core, r2only] of [
  ['feed', feedWrapper, 'handleFeedWithEdgeCacheCore358', 'handlePublicationR2OnlyFeed358'],
  ['profile', profileWrapper, 'handleProfileTracksCore358', 'handlePublicationR2OnlyProfile358'],
  ['genre', genreWrapper, 'handleGenreTracksCore358', 'handlePublicationR2OnlyGenre358'],
]) {
  assert.ok(fn.includes('isExplorePublicationR2OnlyReadEnabled358(env)'), `${label} flag guard missing`);
  assert.ok(fn.includes(core), `${label} frozen OFF path missing`);
  assert.ok(fn.includes(r2only), `${label} R2-only path missing`);
}

for (const name of [
  'publicationR2OnlyCatalogPage358',
  'handlePublicationR2OnlyFeed358',
  'handlePublicationR2OnlyProfile358',
  'handlePublicationR2OnlyGenre358',
]) {
  const fn = extractFunction(worker, name);
  assert.doesNotMatch(fn, /\b(?:env\.?DB|\.prepare\s*\()/, `${name} must not access D1`);
}

const pageHelper = extractFunction(worker, 'publicationR2OnlyCatalogPage358');
assert.ok(pageHelper.includes('collectHybridCatalog336'), 'R2-only list does not use catalog');
assert.ok(pageHelper.includes('mergeHybridItems336([], catalog.items'), 'R2-only list still merges legacy rows');
assert.ok(pageHelper.includes('buildHybridNextCursor336'), 'R2-only pagination guard missing');

assert.ok(extractFunction(worker, 'handlePublicationR2OnlyFeed358').includes("catalogListPrefix066(sort)"));
assert.ok(extractFunction(worker, 'handlePublicationR2OnlyProfile358').includes("catalogListPrefix066('profile', uid)"));
assert.ok(extractFunction(worker, 'handlePublicationR2OnlyGenre358').includes("catalogListPrefix066('genre', genre)"));

const search = extractFunction(worker, 'handleSearch');
assert.ok(search.includes('SORIDRAW_SEARCH_R2_ONLY_341_20261004'), 'search R2-only authority lost');
assert.doesNotMatch(search, /handleSearchCore336\(url, env, cors\)[\s\S]*isExplorePublicationR2OnlyReadEnabled358/, '358 must not weaken app341 search');

assert.match(
  wrangler,
  /"SORIDRAW_PUBLICATION_R2_ONLY_READ_V1"\s*:\s*"1"/,
  'PREVIEW R2-only cutover flag must be active for live validation',
);

console.log('PUBLICATION_R2_ONLY_358_SOURCE=PASS');
console.log('PUBLICATION_R2_ONLY_358_PREVIEW_FLAG_ACTIVE=PASS');
console.log('PUBLICATION_R2_ONLY_358_NORMAL_PATH_D1_READ=0');
console.log('PUBLICATION_R2_ONLY_358_NORMAL_PATH_D1_WRITE=0');
console.log('PUBLICATION_R2_ONLY_358_FEED_PROFILE_GENRE=R2_ONLY');
console.log('PUBLICATION_R2_ONLY_358_SEARCH_APP341_PROTECTED=PASS');
console.log('PUBLICATION_R2_ONLY_358_CROSS_ENV_CUTOVER_READY=false');
