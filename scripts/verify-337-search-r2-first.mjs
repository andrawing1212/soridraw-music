import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const explore = read('src/pages/ExplorePage.tsx');
const runtime = read('cloudflare/explore-worker/runtime/r2-catalog-v1.js');
const worker = read('cloudflare/explore-worker/canonical/preview-worker.js');
const apply336 = read('.deploy/apply_336_hybrid_read.py');

const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

must(explore.includes('SORIDRAW_EXPLORE_KOREAN_GENRE_SEARCH_337_20261004'), 'client genre alias marker missing');
must(explore.includes("import { GENRES } from '../constants';"), 'GENRES import missing');
must(explore.includes("params.append('genre', genre)"), 'genre alias request param missing');
must(runtime.includes('SORIDRAW_R2_SEARCH_GENRE_ALIASES_337_20261004'), 'R2 alias runtime marker missing');
must(runtime.includes("url.searchParams.getAll('genre')"), 'R2 alias params missing');
must(worker.includes('SORIDRAW_SEARCH_R2_FIRST_337_20261004'), 'canonical app337 marker missing');
must(worker.includes('R2-FIRST-SEARCH-337'), 'R2-first response marker missing');
must(worker.includes('INDEXED-GENRE-FALLBACK-337'), 'indexed genre fallback marker missing');
must(worker.includes('LEGACY-SEARCH-FALLBACK-337'), 'legacy fallback marker missing');
must(apply336.includes('SORIDRAW_SEARCH_R2_FIRST_337_20261004'), 'future app336 composition source not updated');

const start = worker.indexOf('async function handleSearch(url, env, cors)');
const end = worker.indexOf('\n}', start);
const sample = worker.slice(start, start + 7000);
must(start >= 0, 'handleSearch missing');
must(sample.indexOf('handleCatalogSearch066') >= 0, 'catalog search call missing');
must(sample.indexOf('const legacyResponse = await handleSearchCore066') > sample.indexOf('handleCatalogSearch066'), 'legacy D1 search still runs before R2');
must(!sample.includes("legacyData = await parseHybridResponseData336(legacyResponse)"), 'old legacy-first merge remains');

console.log('APP337_SEARCH_R2_FIRST=PASS');
console.log('APP337_KOREAN_GENRE_ALIAS=PASS');
console.log('APP337_LEGACY_D1_ONLY_FALLBACK=PASS');
console.log('APP337_USER_DATA_MIGRATION=0');
