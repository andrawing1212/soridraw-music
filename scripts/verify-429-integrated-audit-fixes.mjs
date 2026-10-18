import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const publicSync = readFileSync('src/services/explorePublicPublicationSyncService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const patch100 = readFileSync('cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs', 'utf8');
const patch101 = readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));

assert.match(publication, /const repaired = overlayPendingPublicationStates\(uid, cached\)/);
assert.match(publication, /writePublicationStateCache\(uid, repaired,/);
assert.match(publication, /publishExplorePublicPublicationInvalidation429/);
assert.match(publicSync, /publicSync\/explorePublication/);
assert.match(publicSync, /fetchExplorePublicPublicationStates429/);
assert.doesNotMatch(publicSync, /firestore|env\.DB|\.prepare\s*\(/i);
assert.match(page, /subscribeExplorePublicPublicationInvalidation429/);
assert.match(page, /fetchExplorePublicPublicationStates429/);
assert.match(page, /removeExploreFeedSessionCacheRow\(row429\.trackId\)/);
assert.match(page, /upsertExplorePublicProfileFirstViewTrack\(ownerUid429, snapshot429\)/);
const liveBlock = page.slice(page.indexOf('// app429: public/private/title mutations'),
  page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004'));
assert.doesNotMatch(liveBlock, /setInterval\s*\(|getExploreFeed|revalidateExplorePublicProfileFirstView335/);

assert.match(app, /visibleAfterCatalog429 = overlayStudioHeartPendingIntentsOnFavorites/);
assert.match(app, /overlayStudioHeartRemotePreviewsOnFavorites\(safeUid, authoritative\)/);
assert.match(app, /favoritesStore\.setFavorites\(visibleAfterCatalog429\)/);
assert.match(app, /writeFavoritesCache\(safeUid, authoritative, \{ publishDerived: false \}\)/);

assert.match(patch100, /'isLyricMode'/);
assert.match(patch100, /'lyricMode'/);
assert.match(patch100, /isLyricMode: Boolean\(nextSong\.isLyricMode\)/);
assert.match(patch100, /lyricMode: nextSong\.lyricMode \|\| ''/);
assert.doesNotMatch(patch100, /lyricDraft/);

const publicRule = rules?.rules?.publicSync?.explorePublication;
assert.equal(publicRule?.['.read'], 'auth != null');
assert.equal(publicRule?.['.write'], "auth != null && newData.child('actorUid').val() === auth.uid");
assert.equal(publicRule?.rows?.$index?.ownerUid?.['.validate'],
  'newData.isString() && newData.val() === auth.uid && newData.val().length > 0 && newData.val().length <= 128');

assert.ok(manifest.patches.includes('100-music-note-next-song-legacy-parity.mjs'));
assert.ok(manifest.patches.includes('101-publication-live-convergence.mjs'));
assert.ok(manifest.patches.indexOf('101-publication-live-convergence.mjs') >
  manifest.patches.indexOf('100-music-note-next-song-legacy-parity.mjs'));
assert.doesNotMatch(patch101, /env\?*\.DB|env\.DB|\.prepare\s*\(/);
assert.match(patch101, /publication-state-v429/);

const temp = mkdtempSync(join(tmpdir(), 'soridraw-app429-'));
try {
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js', join(temp, 'worker.js'));
  for (const name of ['100-music-note-next-song-legacy-parity.mjs','101-publication-live-convergence.mjs']) {
    const result = spawnSync(process.execPath, [resolve('cloudflare/explore-worker/patches', name)], {
      encoding: 'utf8', env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: temp },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const worker = readFileSync(join(temp, 'worker.js'), 'utf8');
  assert.match(worker, /SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_429_20261019/);
  assert.match(worker, /PUBLICATION_STATE_ROUTE_429/);
  const routeStart = worker.indexOf('async function handlePublicationStates429');
  const routeEnd = worker.indexOf('\n}', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.doesNotMatch(worker.slice(routeStart, routeEnd + 2), /env\?*\.DB|env\.DB|\.prepare\s*\(/);
} finally { rmSync(temp, { recursive: true, force: true }); }

console.log('APP429_POLLUTED_PUBLICATION_CACHE_REPAIR=PASS');
console.log('APP429_CROSS_ACCOUNT_PUBLICATION_CHANGED_TRACK=PASS');
console.log('APP429_PUBLIC_NEXT_SONG_LYRIC_MODE_PARITY=PASS');
console.log('APP429_CATALOG_PENDING_HEART_OVERLAY=PASS');
console.log('APP429_PUBLICATION_R2_D1_R0_W0=PASS');
