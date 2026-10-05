import { readFileSync } from 'node:fs';
import {
  EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066,
  isExploreR2CatalogEnabled066,
  isExploreR2CatalogReadEnabled066,
  isExploreR2FirstPublisherEnabled066,
  normalizeCatalogText066,
  catalogTitleTokens066,
  normalizeCatalogTrack066,
  catalogLatestKey066,
  catalogPopularKey066,
  catalogDescendingText066,
  catalogProfileKey066,
  catalogMarkerKeys066,
  catalogMarkerDiff066,
  catalogArtistMarkerKeys066,
  buildFirstPublisherSharedProfileBundle066,
} from '../cloudflare/explore-worker/runtime/r2-catalog-v1.js';

const fail = (message) => { throw new Error(`[W2 R2 Phase A] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const runtime = readFileSync('cloudflare/explore-worker/runtime/r2-catalog-v1.js', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/066-publication-r2-catalog-phase-a.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const appVersion = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const workerPath = process.env.SORIDRAW_GENERATED_WORKER || '';
const worker = workerPath ? readFileSync(workerPath, 'utf8') : '';

assert(runtime.includes('SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919'), 'runtime marker missing');
assert(patch.includes('SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919'), 'patch marker missing');
assert(!/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(runtime), 'catalog runtime directly accesses D1');
assert(!/track_search_fts|profile_search_fts/.test(runtime), 'catalog runtime uses D1 FTS');
assert(!/CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX|CREATE\s+TRIGGER|DROP\s+TRIGGER/i.test(patch), 'phase-a patch contains D1 schema mutation');
assert(!/CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+INDEX|CREATE\s+TRIGGER|DROP\s+TRIGGER/i.test(runtime), 'phase-a runtime contains D1 schema mutation');

assert(!isExploreR2CatalogEnabled066({}), 'catalog write gate must default OFF');
assert(!isExploreR2CatalogReadEnabled066({}), 'catalog read gate must default OFF');
assert(!isExploreR2FirstPublisherEnabled066({}), 'first-publisher gate must default OFF');
assert(isExploreR2CatalogEnabled066({ SORIDRAW_R2_CATALOG_V1: '1' }), 'catalog write gate must enable independently');
assert(!isExploreR2CatalogReadEnabled066({ SORIDRAW_R2_CATALOG_V1: '1' }), 'read gate must stay OFF when only write-prep is enabled');
assert(!isExploreR2FirstPublisherEnabled066({ SORIDRAW_R2_CATALOG_V1: '1' }), 'first-publisher gate must stay OFF when only write-prep is enabled');
assert(isExploreR2CatalogReadEnabled066({
  SORIDRAW_R2_CATALOG_V1: '1',
  SORIDRAW_R2_CATALOG_READ_V1: '1',
}), 'catalog read gate requires explicit second flag');
assert(isExploreR2FirstPublisherEnabled066({
  SORIDRAW_R2_CATALOG_V1: '1',
  SORIDRAW_R2_FIRST_PUBLISHER_V1: '1',
}), 'first-publisher gate requires explicit second flag');

const tokens = catalogTitleTokens066('  Through   the Night — 밤의 노래 Through  ');
assert(tokens.length > 0, 'title tokens empty');
assert(tokens.length <= EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066, 'title token bound exceeded');
assert(new Set(tokens).size === tokens.length, 'title tokens are not unique');
assert(tokens[0] === normalizeCatalogText066('Through the Night — 밤의 노래 Through'), 'full normalized title must be first token');

const base = normalizeCatalogTrack066({
  id: 'track-A',
  ownerUid: 'user-A',
  title: 'Through the Night',
  publishedAt: 2000,
  likeCount: 8,
  profilePinned: false,
  primaryGenre: 'Indie Pop',
});
assert(base?.id === 'track-A', 'track normalization failed');

const older = { ...base, id: 'track-old', publishedAt: 1000 };
assert(catalogLatestKey066(base) < catalogLatestKey066(older), 'latest key must sort newer first');

const lessPopular = { ...base, id: 'track-less', likeCount: 2 };
assert(catalogPopularKey066(base) < catalogPopularKey066(lessPopular), 'popular key must sort higher likes first');
const sameLikesOlder = { ...base, id: 'track-same-old', publishedAt: 1500 };
assert(catalogPopularKey066(base) < catalogPopularKey066(sameLikesOlder), 'popular tie must sort newer first');

const idA = { ...base, id: 'track-a' };
const idZ = { ...base, id: 'track-z' };
assert(catalogDescendingText066('track-z') < catalogDescendingText066('track-a'), 'descending id codec must invert lexical order');
assert(catalogLatestKey066(idZ) < catalogLatestKey066(idA), 'latest equal-time tie must preserve D1 id DESC');
assert(catalogPopularKey066(idZ) < catalogPopularKey066(idA), 'popular equal-rank tie must preserve D1 id DESC');

const pinned = { ...base, id: 'track-pin', profilePinned: true };
assert(catalogProfileKey066(pinned) < catalogProfileKey066(base), 'profile pinned track must sort first');
assert(catalogProfileKey066({ ...idZ, ownerUid: base.ownerUid }) < catalogProfileKey066({ ...idA, ownerUid: base.ownerUid }), 'profile equal-time tie must preserve D1 id DESC');

const baseKeys = catalogMarkerKeys066(base);
const sameDiff = catalogMarkerDiff066(baseKeys, catalogMarkerKeys066({ ...base }));
assert(sameDiff.add.length === 0 && sameDiff.remove.length === 0, 'unchanged track rewrites markers');

const likeKeys = catalogMarkerKeys066({ ...base, likeCount: 9 });
const likeDiff = catalogMarkerDiff066(baseKeys, likeKeys);
assert(likeDiff.add.length === 1 && likeDiff.remove.length === 1, 'like change must move one marker only');
assert(likeDiff.add[0].includes('/popular/') && likeDiff.remove[0].includes('/popular/'), 'like change must only move popular marker');

const pinKeys = catalogMarkerKeys066({ ...base, profilePinned: true });
const pinDiff = catalogMarkerDiff066(baseKeys, pinKeys);
assert(pinDiff.add.length === 1 && pinDiff.remove.length === 1, 'pin change must move one marker only');
assert(pinDiff.add[0].includes('/profile/') && pinDiff.remove[0].includes('/profile/'), 'pin change must only move profile marker');

const privateDiff = catalogMarkerDiff066(baseKeys, []);
assert(privateDiff.add.length === 0 && privateDiff.remove.length === baseKeys.length, 'private transition must only remove current markers');

const artistKeys = catalogArtistMarkerKeys066({
  uid: 'user-A',
  nickname: 'SORIDRAW Artist',
  handle: '@soridraw_artist',
});
assert(artistKeys.length === 2, 'artist nickname + handle markers missing');
assert(artistKeys.some((key) => key.includes('/artist/name/')), 'artist nickname marker missing');
assert(artistKeys.some((key) => key.includes('/artist/handle/')), 'artist handle marker missing');

const firstProfile = buildFirstPublisherSharedProfileBundle066({
  uid: 'new-user',
  displayName: 'New Artist',
  picture: 'https://example.com/avatar.png',
  email: 'artist@example.com',
}, 123456789);
assert(firstProfile?.schemaVersion === 1, 'first publisher profile schema invalid');
assert(firstProfile?.firstPublisherBootstrap066 === true, 'first publisher bootstrap marker missing');
assert(firstProfile?.uid === 'new-user', 'first publisher uid invalid');
assert(Array.isArray(firstProfile?.body?.data?.items), 'first publisher profile items missing');
assert(firstProfile.body.data.items.length === 0, 'first publisher profile must start with empty items');
assert(Number(firstProfile.body.data.profile?.trackCount || 0) === 0, 'first publisher profile must start at trackCount 0');
assert(firstProfile.body.data.profile?.nickname === 'New Artist', 'first publisher nickname fallback invalid');

for (const required of [
  'SORIDRAW_R2_CATALOG_V1',
  'SORIDRAW_R2_CATALOG_READ_V1',
  'SORIDRAW_R2_FIRST_PUBLISHER_V1',
  'isExploreR2CatalogReadEnabled066',
  'isExploreR2FirstPublisherEnabled066',
  'ensureFirstPublisherSharedProfile066',
  'firstPublisherProfileTrackDelta066',
  'finalizeFirstPublisherProfile066',
  'syncExploreCatalogTrack066',
  'removeExploreCatalogTrack066',
  'patchExploreCatalogLike066',
  'handleCatalogFeed066',
  'handleCatalogProfileTracks066',
  'handleCatalogGenre066',
  'handleCatalogSearch066',
]) assert(runtime.includes(required), `runtime contract missing: ${required}`);

for (const required of [
  "wrapAsyncFunction('publicationEnsureProfile016', 'Core066'",
  "functionRange('handleMusicNotePublicationSingleWrite016')",
  'firstPublisherProfileTrackDelta066(env, authContext.uid, source.id)',
  'finalizeFirstPublisherProfile066(env, authContext.uid)',
  'first-publisher idempotent repair deferred',
  "wrapAsyncFunction('handleFeedWithEdgeCache', 'Core066'",
  "wrapAsyncFunction('handleProfileTracks', 'Core066'",
  "wrapAsyncFunction('handleGenreTracks', 'Core066'",
  "wrapAsyncFunction('handleSearch', 'Core066'",
  'isExploreR2CatalogReadEnabled066',
  'isExploreR2FirstPublisherEnabled066',
  "functionRange('handleMyProfileUpdate')",
  'syncExploreCatalogArtist066(env, profile)',
]) assert(patch.includes(required), `patch contract missing: ${required}`);

const releasePatches = Array.isArray(manifest?.patches) ? manifest.patches : [];
assert(releasePatches.includes('066-publication-r2-catalog-phase-a.mjs'), '066 release patch missing from manifest');
assert(String(appVersion.version) === '124', `app version changed unexpectedly: ${String(appVersion.version)}`);

if (worker) {
  for (const required of [
    'SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919',
    'publicationEnsureProfile016Core066',
    'handleFeedWithEdgeCacheCore066',
    'handleProfileTracksCore066',
    'handleGenreTracksCore066',
    'handleSearchCore066',
  ]) assert(worker.includes(required), `generated Worker missing: ${required}`);

  const injectedStart = worker.indexOf('SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919');
  const injectedEnd = worker.indexOf('async function publicationReadProfileR2024Core066', injectedStart);
  assert(injectedStart >= 0 && injectedEnd > injectedStart, 'generated R2 helper boundary invalid');
  const injected = worker.slice(injectedStart, injectedEnd);
  assert(!/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(injected), 'generated R2 helper directly accesses D1');
  assert(!/track_search_fts|profile_search_fts/.test(injected), 'generated R2 helper uses FTS');

  assert(!worker.includes('async function writeExploreSharedProfile060Core066('), 'generic shared-profile writer must not be wrapped by 066');

  const profileEditStart = worker.indexOf('async function handleMyProfileUpdate(');
  const profileEditEnd = worker.indexOf('async function handleProfileMediaUpload(', profileEditStart);
  const profileEdit = profileEditStart >= 0
    ? worker.slice(profileEditStart, profileEditEnd > profileEditStart ? profileEditEnd : profileEditStart + 9000)
    : '';
  assert(profileEdit.includes('syncExploreCatalogArtist066(env, profile)'), 'explicit profile edit artist catalog sync missing');

  const profileReadStart = worker.indexOf('async function publicationReadProfileR2024(env, authContext)');
  const profileReadEnd = worker.indexOf('async function publicationEnsureProfile016', profileReadStart);
  const profileRead = profileReadStart >= 0
    ? worker.slice(profileReadStart, profileReadEnd > profileReadStart ? profileReadEnd : profileReadStart + 5000)
    : '';
  assert(profileRead.includes('readExploreR2Json(env, exploreProfileR2Key(uid))'), 'first-publisher retry must inspect local R2 bundle');
  assert(profileRead.includes('firstPublisherBootstrap066'), 'first-publisher retry marker must survive profile read');

  const publicationStart = worker.indexOf('async function handleMusicNotePublicationSingleWrite016(');
  const publicationEnd = worker.indexOf('async function handleMusicNotePublication', publicationStart + 20);
  const publication = publicationStart >= 0
    ? worker.slice(publicationStart, publicationEnd > publicationStart ? publicationEnd : publicationStart + 18000)
    : '';
  assert(publication.includes('firstPublisherProfileTrackDelta066(env, authContext.uid, source.id)'), 'first-publisher track delta wiring missing');
  assert(publication.includes('finalizeFirstPublisherProfile066(env, authContext.uid)'), 'first-publisher finalize wiring missing');
  assert(publication.includes('first-publisher idempotent repair deferred'), 'first-publisher retry repair branch missing');
  assert(publication.includes('trackCountDelta: profileTrackCountDelta066'), 'first-publisher exact trackCount delta missing');
  assert(publication.indexOf('firstPublisherProfileTrackDelta066(env, authContext.uid, source.id)')
    < publication.indexOf('trackCountDelta: profileTrackCountDelta066'), 'first-publisher delta must be resolved before profile patch');

  const ensureStart = worker.indexOf('async function publicationEnsureProfile016(env, authContext, row, now)');
  const ensureEnd = worker.indexOf('async function publicationBuildFeedItem016', ensureStart);
  const ensure = ensureStart >= 0 ? worker.slice(ensureStart, ensureEnd > ensureStart ? ensureEnd : ensureStart + 3500) : '';
  assert(ensure.includes('ensureFirstPublisherSharedProfile066'), 'generated first-publisher R2 branch missing');
  assert(ensure.includes('isExploreR2FirstPublisherEnabled066(env)'), 'generated first-publisher dedicated cutover guard missing');
  assert(ensure.includes('return await publicationEnsureProfile016Core066'), 'generated first-publisher legacy fallback missing');

  const searchStart = worker.indexOf('async function handleSearch(url, env, cors)');
  const search = searchStart >= 0 ? worker.slice(searchStart, searchStart + 1700) : '';
  assert(search.includes('if (!isExploreR2CatalogReadEnabled066(env))'), 'generated search read-cutover guard missing');
  assert(search.includes('handleSearchCore066'), 'generated search legacy fallback missing');
}

assert(runtime.includes("{ isPublic: true, previousMeta: previous }"), 'like catalog mutation must reuse already-read meta');

console.log('W2_R2_CATALOG_PHASE_A=PASS');
console.log('TITLE_TOKEN_BOUND=' + EXPLORE_R2_CATALOG_TITLE_TOKEN_LIMIT_066);
console.log('MUTATION_MARKERS=TARGETED');
console.log('D1_FTS_WRITE_PATH=ABSENT_FROM_CATALOG');
console.log('D1_SCHEMA_CHANGE=false');
console.log('USER_DATA_MIGRATION=false');
console.log('CATALOG_WRITE_DEFAULT=OFF');
console.log('CATALOG_READ_DEFAULT=OFF');
console.log('FIRST_PUBLISHER_DEFAULT=OFF');
console.log('APP_VERSION=124_UNCHANGED');
