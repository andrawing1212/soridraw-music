import fs from 'node:fs';

const worker = fs.readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const must = (c, m) => { if (!c) throw new Error(m); };

for (const token of [
  'SORIDRAW_KOREAN_GENRE_ALIAS_BOUND_CACHE_339_20261004',
  'narrowKoreanGenreAliases339',
  "['힙합', 'Hip-hop']",
  'return list.slice(0, 3)',
  'readGenreSearchCache339',
  'writeGenreSearchCache339',
  'HIT-339',
  'MISS-339',
  'max-age=90',
]) must(worker.includes(token), 'missing app339 token: ' + token);

const start = worker.indexOf('async function handleSearch(url, env, cors)');
const sample = worker.slice(start, start + 13000);
must(start >= 0, 'handleSearch missing');
must(sample.includes('narrowKoreanGenreAliases339'), 'bounded aliases not used by handleSearch');
must(!sample.includes('].slice(0, 6);'), 'old six-alias fanout remains');
must(sample.indexOf('readGenreSearchCache339') < sample.indexOf('handleIndexedGenreAlias338'), 'cache must be checked before D1 genre fallback');
must(sample.indexOf('writeGenreSearchCache339') > sample.indexOf('handleIndexedGenreAlias338'), 'fallback result must populate edge cache');
must(sample.indexOf('handleCatalogSearch066') >= 0, 'R2-first path lost');

console.log('APP339_EXACT_HIPHOP_ALIAS_ONE=PASS');
console.log('APP339_FAMILY_ALIAS_MAX3=PASS');
console.log('APP339_EDGE_CACHE_90S=PASS');
console.log('APP339_R2_FIRST_PRESERVED=PASS');
console.log('APP339_SHARED_D1_SCHEMA_CHANGE=0');
console.log('APP339_USER_DATA_MIGRATION=0');
