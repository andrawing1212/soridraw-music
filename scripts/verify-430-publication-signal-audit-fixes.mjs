import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const publication = readFileSync('src/services/explorePublicationService.ts', 'utf8');
const sync = readFileSync('src/services/explorePublicPublicationSyncService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const patch101 = readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const patch100 = readFileSync('cloudflare/explore-worker/patches/100-music-note-next-song-legacy-parity.mjs', 'utf8');

const publishFn = publication.slice(
  publication.indexOf('const publishPublicationSyncBestEffort = async ('),
  publication.indexOf('\n\nexport const clearExplorePublicationSessionCache'),
);
assert.doesNotMatch(publishFn, /publicProofAt429|publicationStateUpdatedAt429|publishExplorePublicPublicationInvalidation429/);
assert.match(publishFn, /publishExplorePublicationSyncSignal/);

// app431 authority remains server-only; app432 additionally stops the normal
// live convergence path from re-reading exact R2 per viewer.
assert.doesNotMatch(sync, /runTransaction|mergeExplorePublicPublicationSignal429|publishExplorePublicPublicationInvalidation429/);
assert.match(sync, /fetchExplorePublicPublicationLiveCard432/);
assert.match(sync, /subscribeExplorePublicProfilePublication432/);
assert.match(sync, /PUBLIC_PUBLICATION_SIGNAL_ROWS_432 = 1/);
assert.ok(sync.includes("const PUBLIC_PUBLICATION_LIVE_CARD_ROUTE_432 = '/v1/publication-live-card';"));
assert.match(sync, /Authorization: `Bearer \$\{idToken\}`/);
assert.match(sync, /'X-Firebase-AppCheck': appCheckToken/);

const liveStart = page.indexOf('// app432: server-issued one-event live delta.');
const liveEnd = page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004', liveStart);
assert.ok(liveStart >= 0 && liveEnd > liveStart);
const live = page.slice(liveStart, liveEnd);
assert.match(live, /fetchExplorePublicPublicationLiveCard432/);
assert.match(live, /subscribeExplorePublicProfilePublication432/);
assert.match(live, /document\.visibilityState !== 'visible'/);
assert.match(live, /!submittedQuery\.trim\(\)/);
assert.match(live, /rememberSettledExplorePublicPublicationSignal429/);
assert.doesNotMatch(live, /fetchExplorePublicPublicationStates429|setInterval\s*\(|MIN_PUBLICATION_REFRESH_MS_430/);
assert.doesNotMatch(live, /setFeedRevisionSignal\(/);

const rule = rules?.rules?.publicSync?.explorePublication;
assert.equal(rule?.['.write'], false);
assert.equal(rule?.actorUid?.['.validate'],
  "newData.isString() && newData.val() === 'publication-server-431'");
assert.equal(rule?.rows?.$index?.['.validate'],
  "$index === '0' && newData.hasChildren(['trackId','ownerUid','at','status'])");
assert.equal(rule?.rows?.$index?.cardJson, undefined);
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.write'], false);

assert.match(patch101, /return updatedAt/);
assert.match(patch101, /writeAndPublishPublicationState431/);
assert.match(patch101, /publishPublicationInvalidation431/);
assert.match(patch101, /publicationLiveCard432/);
assert.match(patch101, /handlePublicationLiveCard432/);
assert.match(patch101, /X-Soridraw-431-Publication-Signature/);
assert.doesNotMatch(patch101, /publicationStateUpdatedAt429/);
assert.match(patch101, /await requireExploreAuth\(request\.clone\(\)\)/);
assert.match(patch101, /X-SORIDRAW-D1-Read', '0'/);
assert.match(patch101, /X-SORIDRAW-D1-Write', '0'/);

// Frozen unrelated P0 corrections must remain exactly present.
assert.match(app, /visibleAfterCatalog429 = overlayStudioHeartPendingIntentsOnFavorites/);
assert.match(patch100, /'isLyricMode'/);
assert.match(patch100, /'lyricMode'/);
assert.doesNotMatch(patch100, /lyricDraft/);

const temp = mkdtempSync(join(tmpdir(), 'soridraw-app432-history-'));
try {
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js', join(temp, 'worker.js'));
  for (const name of ['100-music-note-next-song-legacy-parity.mjs','101-publication-live-convergence.mjs']) {
    const result = spawnSync(process.execPath, [resolve('cloudflare/explore-worker/patches', name)], {
      encoding: 'utf8',
      env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: temp },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const worker = readFileSync(join(temp, 'worker.js'), 'utf8');
  assert.match(worker, /SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_432_20261019/);
  assert.match(worker, /writeAndPublishPublicationState431/);
  assert.match(worker, /publicationLiveCard432/);
  assert.match(worker, /handlePublicationLiveCard432/);
  assert.match(worker, /X-Soridraw-431-Publication-Signature/);
  assert.match(worker, /await requireExploreAuth\(request\.clone\(\)\)/);
  const routeStart = worker.indexOf('async function handlePublicationStates429');
  const routeEnd = worker.indexOf('\n}', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.doesNotMatch(worker.slice(routeStart, routeEnd + 2), /env\?*\.DB|env\.DB|\.prepare\s*\(/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('APP430_UNRELATED_VIEWER_R2_FANOUT_BLOCKED=PASS');
console.log('APP431_BROWSER_PUBLIC_SIGNAL_WRITE_REMOVED=PASS');
console.log('APP430_STALE_R2_COMPLETION_BLOCKED=PASS');
console.log('APP430_PUBLICATION_ROUTE_AUTH_D1_R0_W0=PASS');
console.log('APP430_229_237_FROZEN_CORRECTIONS=PASS');
console.log('APP432_DIRECT_LIVE_DELTA_NO_PER_VIEWER_R2=PASS');
