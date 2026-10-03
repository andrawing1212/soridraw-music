import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const profile = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const curation = readFileSync('src/services/exploreCurationService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const session = readFileSync('src/services/exploreSessionCache.ts', 'utf8');

// app334: browser reload must respect the already-persistent revision cache.
// Actual TTL expiry and mutation signals still own bounded freshness checks.
assert.match(revision, /app334: the one-minute revision response cache survives browser reloads/);
assert.doesNotMatch(revision, /browserReloaded211|reloadedRevisionUrls211|bypassReloadCache211/);
assert.match(revision, /const cached = readEntry\(revisionUrl\)/);

// Public profile: keep the existing persistent validatedAt window, but do not
// force one Worker request merely because navigation.type === reload.
assert.match(profile, /app334: a browser reload is not a profile-change signal/);
assert.doesNotMatch(profile, /browserReloadedProfile211|profileReloadRevalidated211|forceReloadRevalidation211/);
assert.match(profile, /if \(!force && cached\.validatedAt > 0 && age < PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS_113\) return/);
assert.match(profile, /revalidateExplorePublicProfileFirstView335/);
assert.match(profile, /revalidateCachedProfile113\(normalizedRef, cached, options\)/);
const profileWarm335 = profile.slice(
  profile.indexOf('export const getExplorePublicProfileFirstView = async'),
  profile.indexOf('const inflightKey', profile.indexOf('export const getExplorePublicProfileFirstView = async')),
);
assert.doesNotMatch(profileWarm335, /revalidateCachedProfile113/, 'app335 warm profile entry/reload must stay Worker-free');

// Music Note publication state: validation time survives reload, while pending
// publication outbox still bypasses the gate.
assert.match(publication, /PUBLICATION_REVISION_CHECK_MS_334 = 60_000/);
assert.match(publication, /readPublicationRevisionCheckAt334\(uid\)/);
assert.match(publication, /getPendingExplorePublicationMutationCount\(uid\) > 0/);
assert.match(publication, /markPublicationServerValidated334\(uid\)/);
assert.match(publication, /options: \{ revalidate\?: boolean \} = \{\}/);
assert.match(publication, /cached && options\.revalidate !== true/);
assert.match(publication, /revalidateExploreMusicNotePublicationStates335/);
assert.match(favorites, /document\.addEventListener\('visibilitychange', onPublicationResume335\)/);

// Explore feed and private like revision clocks survive reload without changing
// the existing 2-minute / 5-minute semantic cadence.
assert.match(page, /EXPLORE_FEED_REVISION_CHECK_STORAGE_PREFIX_334/);
assert.match(page, /readExploreFeedLastRevisionCheckAt334\(revisionCheckKey154\)/);
assert.match(page, /readExploreFeedLastRevisionCheckAt334\(revisionCheckKey304\)/);
assert.match(like, /EXPLORE_LIKE_REVISION_CHECK_STORAGE_PREFIX_334/);
assert.match(like, /readExploreLikeRevisionCheckAt334\(uid\)/);
assert.match(like, /EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 \* 60_000/);

// Admin/master management permission is a UI hint backed by server authorization.
// Keep a short UID + local-role-signature cache so reloads do not re-request it.
assert.match(curation, /SORIDRAW_CURATION_ACCESS_RECHECK_MS_334 = 5 \* 60_000/);
assert.match(curation, /readCurationAccessCache334\(uid\)/);
assert.match(curation, /curationAccessInflight334/);
assert.match(page, /getExploreCurationAccess307\(user, signature\)/);
assert.match(curation, /soridraw-curated-local-335/);
assert.match(curation, /revalidateSoridrawCuratedTracks335/);
assert.match(page, /revalidateSoridrawCuratedTracks335\(\)/);

// Same-source republish must be driven by an explicit dialog source choice, not
// a stale background Music Note snapshot.
assert.match(favorites, /initialSunoIndex: 0 \| 1/);
assert.match(favorites, /selectedSunoIndex !== initialSunoIndex/);
assert.doesNotMatch(
  favorites.slice(
    favorites.indexOf('const submitFavoriteExplorePublicationDialog'),
    favorites.indexOf('const makeFavoriteExplorePublicationPrivate'),
  ),
  /selectedUrl !== latestMainUrl/,
);

// Do not turn the optimization into a release-wide cache bust.
assert.match(session, /const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3;/);
assert.match(profile, /const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6;/);
assert.doesNotMatch(revision, /invalidateExploreFeedSessionCache\(/);

assert.doesNotMatch(page, /window\.addEventListener\('pageshow', requestRevisionCheck\)/);
assert.doesNotMatch(page, /window\.addEventListener\('focus', requestRevisionCheck\)/);
assert.match(page, /window\.addEventListener\('pointerdown', requestActivityRevisionCheck/);
assert.match(page, /document\.addEventListener\('visibilitychange', requestRevisionCheck\)/);

console.log('PASS 211/335: warm browser entry/reload is Worker-free for Feed/profile/curation/publication checks; bounded freshness moves to real post-entry activity or tab resume; same-source republish remains visibility-only.');
