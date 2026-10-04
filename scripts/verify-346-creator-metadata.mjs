import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { transform } from 'esbuild';
const source = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const ast = ts.createSourceFile('worker.js',source,99,true,ts.ScriptKind.JS);
const fn = name => ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)?.getText(ast);
const context = { decodeTrackLyrics270: () => ({}), readPublicShareBundle015: () => null };
vm.createContext(context);
vm.runInContext(fn('parseProfileGenres')+'\n'+fn('mapTrackRow'),context);
assert.equal(context.mapTrackRow({}).ownerProfileGenres,null);
assert.equal(JSON.stringify(context.mapTrackRow({owner_profile_genres:'[]'}).ownerProfileGenres),'[]');
assert.equal(JSON.stringify(context.mapTrackRow({owner_profile_genres:'["soul"]',primary_genre:'rock'}).ownerProfileGenres),'["soul"]');
let selfReads=0;
const snapshotContext = { readFollowCutoverState348: async () => ({mode:'legacy'}), EXPLORE_R2_FOLLOW_LIMIT: 5000, requireExploreAuth: async () => ({uid:'self'}),
 readSharedLikesState161: async () => ({likedIds:new Set(), exact:true, exactLikeCount:0, source:'r2'}),
 readExploreFollowingR2Bundle: async () => [],
 readExploreSharedProfileByUid247: async (env,uid) => {selfReads++;assert.equal(uid,'self');return {body:{data:{profile:{uid,genres:['soul'],updatedAt:4}}}};},
 json: value => value, URL, console };
vm.createContext(snapshotContext); vm.runInContext(fn('handleMySocialSnapshot042'),snapshotContext);
const result = await snapshotContext.handleMySocialSnapshot042({url:'https://preview.example/v1/me/social-snapshot'}, {}, {});
assert.equal(selfReads,1); assert.equal(JSON.stringify(result.data.viewerProfile.genres),'["soul"]');
assert.equal(JSON.stringify(result.data.likedTrackIds),'[]');
snapshotContext.readExploreSharedProfileByUid247 = async () => {throw new Error('R2 unavailable');};
const degraded = await snapshotContext.handleMySocialSnapshot042({url:'https://preview.example/v1/me/social-snapshot'}, {}, {});
assert.equal(degraded.data.viewerProfile,null); assert.equal(degraded.ok,true);
assert.match(fn('handleFeed'),/p\.genre_override AS owner_profile_genres/);
assert.match(fn('derivedItems032'),/owner_profile_genres: p\.genre_override/);
assert.match(fn('publicationBuildFeedItem016'),/owner_profile_genres/);
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(page,/!profileGenres\.has\(track.ownerUid\) && Array\.isArray\(track.ownerProfileGenres\)/);
assert.match(page,/readExploreViewerGenres\(currentUid\)/);
console.log('COLD_METADATA_CONTRACT=PASS; SELF_R2_READS=1; EXTRA_WORKER_REQUESTS=0; EXTRA_D1_QUERIES=0');
console.log('LEGACY_FEED_WITHOUT_GENRES=UNKNOWN; LIVE_COLD_DEVICE_RELEASE_GATE=NOT_VERIFIED');

const cacheSource = readFileSync('src/services/exploreCreatorProfileCache.ts','utf8').replace(/^import[^\n]+\n/, '').replace(/export /g,'');
const compiledCache = await transform(cacheSource, {loader:'ts'});
let stored;
const cacheContext = {readSoridrawPersistentCache: () => stored, writeSoridrawPersistentCache: value => {stored = value;}};
vm.createContext(cacheContext);vm.runInContext(compiledCache.code + '\nthis.remember=rememberExploreViewerGenres;this.read=readExploreViewerGenres;',cacheContext);
cacheContext.remember('self',{uid:'self',genres:['soul'],updatedAt:10});
cacheContext.remember('self',{uid:'self',genres:['rock'],updatedAt:9});
assert.equal(JSON.stringify(cacheContext.read('self')),'["soul"]');
cacheContext.remember('self',{uid:'other',genres:['pop'],updatedAt:11});
assert.equal(JSON.stringify(cacheContext.read('self')),'["soul"]');
assert.equal(cacheContext.read('other'),null);
cacheContext.remember('self',{uid:'self',genres:[],updatedAt:11});
assert.equal(JSON.stringify(cacheContext.read('self')),'[]');
console.log('VIEWER_CACHE_OLD_RESPONSE_UID_EMPTY_GENRES=PASS');
