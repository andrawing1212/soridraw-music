import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform, build } from 'esbuild';
import vm from 'node:vm';
const source = readFileSync('src/services/exploreCreatorRecommendations.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { rankExploreCreators } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const track = (ownerUid, primaryGenre = 'pop', id = ownerUid) => ({ id, ownerUid, primaryGenre });
const genreSignal = (genre) => {
  const key = ({ '네오 소울': 'neo_soul', 'Neo Soul': 'neo_soul' })[genre] || genre;
  return { key, family: ['neo_soul','soul'].includes(key) ? 'soul' : key };
};
const options = {
  currentUid: 'self', viewerGenres: ['네오 소울'],
  profileGenres: new Map([['exact',['Neo Soul']], ['family',['soul']], ['curated',['pop']]]),
  curated: [track('self'),track('curated'),track('curated','soul','duplicate')],
  latest: [track('latest'),track('family'),track('curated')],
  popular: [track('popular'),track('exact','pop'),track('latest')],
  genreSignal, songGenre: (track) => track.primaryGenre,
};
assert.deepEqual(rankExploreCreators(options).map((t) => t.ownerUid), ['exact','family','curated','latest','popular']);
assert.deepEqual(rankExploreCreators({ ...options, viewerGenres: [] }).map((t) => t.ownerUid), ['curated','latest','family','popular','exact']);
assert.equal(rankExploreCreators({ ...options, limit: 2 }).length, 2);
assert.deepEqual(rankExploreCreators({ ...options, curated: [], latest: [], popular: [] }), []);
const many = Array.from({ length: 1000 }, (_, i) => track('u' + i));
assert.equal(rankExploreCreators({ ...options, curated: many, latest: [], popular: [], limit: 1000 }).length, 40);
assert.doesNotMatch(source, /fetch\(|getDoc|Firestore|localStorage/, 'ranking must perform zero server IO');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const ranking = page.slice(page.indexOf('// Use the already-loaded three pools.'), page.indexOf('const activeRecommendationGenre221'));
assert.match(ranking, /curated: curatedTracks307, latest: tracks\.filter[\s\S]*popular: popularTracks/);
assert.match(ranking, /const recommendedCreators345 = useMemo/);
assert.match(ranking, /readCachedExplorePublicProfile/);
assert.doesNotMatch(ranking, /fetch\(|getExplorePublicProfile\(|getExplorePublicProfileFirstView\(/);
const constantsBuild = await build({ entryPoints: ['src/constants.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const constants = await import('data:text/javascript;base64,' + Buffer.from(constantsBuild.outputFiles[0].text).toString('base64'));
const genreDefinitions = page.slice(page.indexOf('type ExploreGenreCatalogEntry342 ='), page.indexOf('const resolveExploreRecommendationGenre343 ='));
const signalStart = ranking.indexOf('const genreSignal =');
const signalEnd = ranking.indexOf('\n    };', signalStart) + '\n    };'.length;
assert.ok(signalStart >= 0 && signalEnd > signalStart);
const actualSignalCode = await transform(genreDefinitions + '\n' + ranking.slice(signalStart, signalEnd) + '\n genreSignal;', { loader: 'ts' });
const actualSignal = vm.runInNewContext(actualSignalCode.code, {
  GENRES: constants.GENRES, GENRE_HIERARCHY: constants.GENRE_HIERARCHY,
  safeText: (value) => String(value ?? '').trim(),
});
assert.equal(actualSignal('네오 소울').key, actualSignal('Neo Soul').key);
assert.equal(actualSignal('neo_soul').key, actualSignal('Neo Soul').key);
assert.equal(actualSignal('네오 소울').family, actualSignal('소울').family);
assert.deepEqual(rankExploreCreators({ ...options, genreSignal: actualSignal, profileGenres: new Map([
  ['exact',['neo_soul']], ['family',['소울']], ['curated',['팝']],
]) }).map((t) => t.ownerUid), ['exact','family','curated','latest','popular']);
console.log('CREATOR_PROFILE_GENRE_PRIORITY=PASS');
console.log('CREATOR_ACTUAL_CATALOG_KOREAN_ENGLISH_ALIAS=PASS');
console.log('CREATOR_CURATED_LATEST_POPULAR_FALLBACK=PASS');
console.log('CREATOR_SELF_DEDUP_BOUND_LOCAL_IO=PASS');
console.log('CREATOR_COLD_PROFILE_GENRES=UNAVAILABLE (existing local summaries only; no N+1 hydration)');
