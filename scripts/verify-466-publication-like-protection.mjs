import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const shared = readFileSync('cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs', 'utf8');
const config = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));
const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const publicSync = readFileSync('src/services/explorePublicPublicationSyncService.ts', 'utf8');
const like = readFileSync('.agents/skills/local-first-like-sync/references/soridraw-app410-like-convergence-frozen.md', 'utf8');

const exists = (fragment, description) =>
  assert(entry.includes(fragment), 'Protected v466 wrapper route missing: ' + description);
const bounded = (start, end) => {
  const s = entry.indexOf(start), e = entry.indexOf(end, s + start.length);
  assert(s >= 0 && e > s, 'Protected bounded wrapper block missing: ' + start);
  return entry.slice(s, e);
};

// This is a SOURCE protection check, not an assertion that live PC/mobile
// publication/like buttons have already been physically reverified.
assert(!Object.hasOwn(config.vars || {}, 'SORIDRAW_CURATED_SHARED_V466'),
  'New curated R2 path must stay OFF before independent release audit');
assert.match(shared, /SORIDRAW_CURATED_SHARED_V466/);
assert.match(shared, /String\(env\?\.SORIDRAW_CURATED_SHARED_V466 \|\| ''\) === '1'/);
assert(!/firestore|favoriteCount|user_recent_songs|suno_tracks|likeCount|DELETE FROM tracks/i.test(shared),
  'Curated shared module must not modify canonical songs/likes/favorites');

// Different feature owners: promotion is curated metadata, it is not a
// like, Studio private save-heart, or a song publication request.
const curatedRoutes = bounded("const segments307 = url.pathname.split('/').filter(Boolean);",
  "const isProfileUpdate244 = request.method === 'PATCH'");
for (const route of [
  "'/v1/curated-revision'", "'/v1/curated'", "'/v1/manage/curated'",
  "'/v1/me/explore-management-access'", "segments307[1] === 'curation'",
]) assert(curatedRoutes.includes(route), 'Curation routing changed: ' + route);
assert.match(curatedRoutes, /sharedCuratedEnabled466\(env\)\s*\?\s*handleCuratedSharedRevision466/);
assert.match(curatedRoutes, /sharedCuratedEnabled466\(env\)\s*\?\s*handleCuratedSharedPublic466/);
assert.match(curatedRoutes, /: handleCuratedRevision307\(request, env\)/);
assert.match(curatedRoutes, /: handleCuratedPublic307\(request, env, ctx\)/);
assert(!/\/v1\/me\/likes|\/v1\/me\/favorites|\/v1\/me\/music-note-publications/.test(curatedRoutes),
  'Curated direct interception must not swallow original user action routes');

// The canonical public/private and batch publication action must complete
// before any derived curated promotion/visibility cache synchronization.
const dispatch = bounded('const isTrackVisibilityMutation307 = request.method',
  'const publicLikeAcceptedAt193 = Date.now();');
assert.match(dispatch, /request\.method === 'PATCH'\s*&&\s*\/\^\\\/v1\\\/tracks/);
assert.match(dispatch, /request\.method === 'POST'\s*&&\s*url\.pathname === '\/v1\/me\/music-note-publications\/batch'/);
const dispatchBase = dispatch.indexOf('let response = await baseWorker.fetch(request, env, ctx);');
const dispatchGuard = dispatch.indexOf('if ((isTrackVisibilityMutation307 || isPublicationBatch307) && response.ok)');
const dispatchSync = dispatch.indexOf('await syncCuratedPublicationResults307(request, env, results307, ctx);');
assert(dispatchBase >= 0 && dispatchGuard > dispatchBase && dispatchSync > dispatchGuard,
  'Public/private and Music Note publication must settle at original base Worker before curation sync');
assert.match(dispatch, /catch \(error\) \{\s*console\.warn\('\[app307\] curated publication sync skipped:/);
assert.doesNotMatch(dispatch, /await\s+env\.DB\.prepare|UPDATE users|DELETE FROM|setDoc\(/,
  'Post-publication curated update must not directly rewrite canonical user records');

// The response must still pass through the frozen public-like batching and
// receipt path regardless of whether the request is curated or published.
const footer = entry.slice(entry.indexOf('const publicLikeAcceptedAt193 = Date.now();'));
assert.match(footer, /const scheduledResponse = await ensureQueuedLikeBatchScheduled103\(request, env, response, ctx\);/);
assert.match(footer, /return attachPublicLikeAcceptedAt193\(request, scheduledResponse, publicLikeAcceptedAt193\);/);
assert.match(entry, /const EXPLORE_LIKE_BATCH_ROUTE_103 = '\/v1\/me\/likes\/batch';/);
assert.match(like, /app410/);

// The client publication queue must still separate pending vs confirmed state
// and must not interpret promotion-cache updates as publication success.
assert.match(publication, /overlayPendingPublicationStates/);
assert.match(publication, /flushPendingExplorePublicationsForPageExit/);
assert.match(publication, /refreshExploreMusicNotePublicationContent428/);
assert.match(publicSync, /fetchExplorePublicPublicationLiveCard432/);
assert.match(shared, /LIMIT 40/);
assert.match(shared, /onlyIf/);
assert.match(shared, /forceTrackIds/);
assert.doesNotMatch(shared, /\bUPDATE\s+(?:tracks|curated_picks)|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b/i,
  'Only bounded derived curation readers are permitted in new v466 module');

console.log('APP466_PUBLIC_PRIVATE_BASE_SETTLEMENT_BEFORE_CURATION=PASS');
console.log('APP466_LIKE_UNLIKE_RECEIPT_AND_QUEUE_ROUTING_PROTECTED=PASS');
console.log('APP466_STUDIO_FAVORITES_AND_PUBLICATION_DOMAIN_ISOLATION=PASS');
console.log('APP466_SHARED_R2_OFF_NO_CANONICAL_USER_MUTATION=PASS');
