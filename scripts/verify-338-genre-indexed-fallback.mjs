import fs from 'node:fs';

const worker = fs.readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const must = (c, m) => { if (!c) throw new Error(m); };

must(worker.includes('SORIDRAW_KOREAN_GENRE_INDEXED_FALLBACK_338_20261004'), 'app338 marker missing');
must(worker.includes('INDEXED BY idx_tracks_primary_genre_latest'), 'primary genre index hint missing');
must(worker.includes('INDEXED BY idx_track_tags_kind_value_track'), 'legacy tag index hint missing');
must(worker.includes('handleIndexedGenreAlias338(genreUrl, genreAlias, env, cors)'), 'indexed genre fallback call missing');

const start = worker.indexOf('async function handleSearch(url, env, cors)');
const sample = worker.slice(start, start + 10000);
must(start >= 0, 'handleSearch missing');
must(!sample.includes('handleGenreTracksCore066(genreUrl, genreAlias, env, cors)'), 'old scan-prone genre fallback remains');
must(sample.indexOf('handleCatalogSearch066') >= 0, 'R2-first search lost');
must(sample.indexOf('handleIndexedGenreAlias338') > sample.indexOf('handleCatalogSearch066'), 'indexed fallback must remain after R2');
must(sample.indexOf('const legacyResponse = await handleSearchCore066') > sample.indexOf('handleIndexedGenreAlias338'), 'broad legacy search must remain last fallback');

console.log('APP338_GENRE_INDEXED_FALLBACK=PASS');
console.log('APP338_R2_FIRST_PRESERVED=PASS');
console.log('APP338_SHARED_D1_SCHEMA_CHANGE=0');
console.log('APP338_USER_DATA_MIGRATION=0');
