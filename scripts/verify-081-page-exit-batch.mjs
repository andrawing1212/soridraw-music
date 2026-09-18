import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const coordinator = read('src/lib/pageSyncCoordinator.ts');
const likes = read('src/services/exploreLikeService.ts');
const publications = read('src/services/explorePublicationService.ts');
const catalog = read('src/lib/userDataEngine.ts');
const drafts = read('src/lib/musicNoteDetailDraft.ts');
const favorites = read('src/pages/FavoritesPage.tsx');
const library = read('src/pages/SunoLibraryPage.tsx');
const exploreShell = read('src/components/explore/ExploreShell.tsx');
const app = read('src/App.tsx');
const overlay = read('src/components/CacheDiagnosticsOverlay.tsx');
const patches = JSON.parse(read('cloudflare/explore-worker/release-patches.json'));

assert.ok(coordinator.includes('SORIDRAW_PAGE_EXIT_BATCH_SYNC_081'), '081 coordinator marker missing');
assert.ok(coordinator.includes('if (pendingChanges <= 0)'), 'zero-dirty page transition must return before flush');
assert.ok(coordinator.includes("status: 'noop'"), 'zero-dirty diagnostics missing');
assert.ok(coordinator.includes('pageClosing'), 'window-close local-only guard missing');
assert.ok(coordinator.includes("window.addEventListener('pagehide'"), 'page close marker missing');
assert.ok(coordinator.includes('flushPendingExploreLikesForPageExit'), 'like outbox not wired to page sync');
assert.ok(coordinator.includes('flushPendingExplorePublicationsForPageExit'), 'publication outbox not wired to page sync');
assert.ok(coordinator.includes('flushPendingCatalogPublishes'), 'catalog delta not wired to page sync');

assert.ok(likes.includes('export const getPendingExploreLikeMutationCount'), 'like pending count export missing');
assert.ok(likes.includes('export const flushPendingExploreLikesForPageExit'), 'like page-exit flush export missing');
const crossDevice089 = likes.includes('SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914');
if (crossDevice089) {
  assert.ok(likes.includes('const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 5_000;'), '089 preview batch window must remain 5s');
  assert.ok(likes.includes('const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 5_000;'), '089 default batch window must remain 5s');
  assert.ok(likes.includes('schedulePendingLikes(user);'), '089 like changes must schedule one bounded batched flush');
  assert.ok(likes.includes('resumePendingLikes(user);'), '089 persisted pending likes must resume batched flush after restart');
} else {
  assert.ok(!likes.includes('schedulePendingLikes(user);'), 'like mutation still schedules automatic network flush');
  assert.ok(!likes.includes('resumePendingLikes(user);'), 'like read path still schedules pending network flush');
}

for (const token of [
  'EXPLORE_PUBLICATION_OUTBOX_CACHE_KEY',
  'export const getPendingExplorePublicationMutationCount',
  'export const flushPendingExplorePublicationsForPageExit',
  '/v1/me/music-note-publications/batch',
]) assert.ok(publications.includes(token), `publication outbox missing ${token}`);
assert.ok(!publications.includes("requestExplore(user, '/v1/publications'"), 'publication UI still writes server immediately');
assert.ok(!publications.includes('`/v1/tracks/${encodeURIComponent(normalizedTrackId)}/visibility`'), 'visibility UI still writes server immediately');
assert.ok(!publications.includes('`/v1/tracks/${encodeURIComponent(normalizedTrackId)}/publication-options`'), 'publication options still write server immediately');

assert.ok(catalog.includes('export const flushPendingCatalogPublishes'), 'catalog page-exit flush missing');
assert.ok(catalog.includes('export const getPendingCatalogPublishCount'), 'catalog pending count missing');
const scheduleBlock = catalog.slice(
  catalog.indexOf('export const scheduleCatalogSnapshotPublishIfDirty'),
  catalog.indexOf('export const getCatalogRenderBatchSize'),
);
assert.doesNotMatch(scheduleBlock, /setTimeout\(/, 'catalog server publish still uses timer');

assert.ok(drafts.includes('listMusicNoteDetailDrafts'), 'detail draft durable outbox listing missing');
assert.ok(favorites.includes('registerPageSyncHandler'), 'Music Note local Firestore flush not registered');
assert.ok(favorites.includes("flushSoridrawPageSync(activeUser, 'music-note-exit')"), 'Music Note route exit sync missing');
assert.ok(!favorites.includes("window.addEventListener('pagehide', flushOnPageExit)"), 'detail still writes server on window close');
assert.ok(!favorites.includes("window.addEventListener('pagehide', flushIfDirty)"), 'card state still writes server on window close');
assert.ok(!favorites.includes("flushFavoriteDetailPendingPatch('detail-close')"), 'detail modal close still writes server');
assert.ok(!favorites.includes("flushFavoriteDetailPendingPatch('idle')"), 'detail edit still writes server on idle timer');

assert.ok(library.includes("flushSoridrawPageSync(auth.currentUser, 'library-exit')"), 'Library page exit sync missing');
assert.ok(app.includes('recoverSoridrawPendingSync'), 'startup outbox recovery missing');
assert.ok(exploreShell.includes("flushSoridrawPageSync(activeUser, 'route-change')"), 'Explore page exit sync missing');
assert.ok(overlay.includes('PAGE SYNC'), 'integrated page sync diagnostics missing');

assert.ok(patches.patches.includes('048-page-exit-publication-batch.mjs'), '048 page-exit publication patch missing');
assert.equal(patches.patches.at(-1), '051-publication-write-returning.mjs', '051 publication write-returning must remain final Worker patch');
if (process.env.SORIDRAW_GENERATED_WORKER) {
  const worker = read(process.env.SORIDRAW_GENERATED_WORKER);
  for (const token of [
    'SORIDRAW_PAGE_EXIT_PUBLICATION_BATCH_048_20260914',
    'handleMusicNotePublicationBatch048',
    '/v1/me/music-note-publications/batch',
  ]) assert.ok(worker.includes(token), `generated Worker missing ${token}`);
}

console.log(crossDevice089
  ? 'PASS 081/089: zero-dirty navigation has no request; likes use one 5s batched flush plus page-exit fallback; publications/catalog remain page-exit batched; unload stays local-only.'
  : 'PASS 081: zero-dirty navigation has no server request; likes/publications/catalog are page-exit batched; unload is local-only; startup replays durable pending changes.');
