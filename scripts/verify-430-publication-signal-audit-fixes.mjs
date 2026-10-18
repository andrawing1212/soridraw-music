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
assert.match(publishFn, /publicProofAt429/);
assert.match(publishFn, /proofAt429 = Math\.floor\(Number\(publicProofAt429 \|\| 0\)\)/);
assert.match(publishFn, /if \(!Number\.isSafeInteger\(proofAt429\) \|\| proofAt429 <= 0\) return/);
assert.match(publishFn, /at: proofAt429/);
assert.doesNotMatch(publishFn.slice(publishFn.indexOf('const proofAt429')), /at: Date\.now\(\)/);
assert.equal((publication.match(/publicationStateUpdatedAt429/g) || []).length >= 3, true);

assert.match(sync, /previous\?\.actorUid === uid/);
assert.match(sync, /row\.ownerUid === uid/);
assert.match(sync, /isExplorePublicPublicationSignalRelevant429/);
assert.match(sync, /visibleOwnerUid === ownerUid \|\| activeProfileUid === ownerUid/);
assert.match(sync, /isExplorePublicPublicationStateFresh429/);
assert.match(sync, /Number\(state\.updatedAt\) === Number\(row\.at\)/);
assert.match(sync, /Authorization: `Bearer \$\{idToken\}`/);
assert.match(sync, /'X-Firebase-AppCheck': appCheckToken/);

const liveStart = page.indexOf('// app430: cross-account public changes');
const liveEnd = page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004', liveStart);
assert.ok(liveStart >= 0 && liveEnd > liveStart);
const live = page.slice(liveStart, liveEnd);
assert.match(live, /publicLikeVisibleTracksRef192\.current/);
assert.match(live, /visibleOwnerUids430/);
assert.match(live, /MIN_PUBLICATION_REFRESH_MS_430 = 30_000/);
assert.match(live, /visibleTrackOwner430 && visibleTrackOwner430 !== row430\.ownerUid/);
assert.match(live, /feedRevisionRequestedUrlRef\.current = requestUrl/);
assert.match(live, /isExplorePublicPublicationStateFresh429\(row430, state430\)/);
assert.match(live, /rememberSettledExplorePublicPublicationSignal429/);
assert.doesNotMatch(live, /setFeedRevisionSignal\(/);
assert.doesNotMatch(live, /setInterval\s*\(/);

const rule = rules?.rules?.publicSync?.explorePublication;
assert.equal(rule?.['.write'], "auth != null && newData.child('actorUid').val() === auth.uid");
assert.equal(rule?.rows?.$index?.ownerUid?.['.validate'],
  'newData.isString() && newData.val() === auth.uid && newData.val().length > 0 && newData.val().length <= 128');
assert.match(String(rule?.rows?.$index?.at?.['.validate'] || ''), /newData\.val\(\) <= now/);
assert.match(String(rule?.rows?.$index?.at?.['.validate'] || ''), /now - 300000/);

assert.match(patch101, /return updatedAt/);
assert.match(patch101, /publicationStateUpdatedAt429 = await writePublicationState429/);
assert.match(patch101, /publicationStateUpdatedAt429 > 0/);
assert.match(patch101, /await requireExploreAuth\(request\.clone\(\)\)/);
assert.match(patch101, /X-SORIDRAW-D1-Read', '0'/);
assert.match(patch101, /X-SORIDRAW-D1-Write', '0'/);

// Frozen unrelated P0 corrections must remain exactly present.
assert.match(app, /visibleAfterCatalog429 = overlayStudioHeartPendingIntentsOnFavorites/);
assert.match(patch100, /'isLyricMode'/);
assert.match(patch100, /'lyricMode'/);
assert.doesNotMatch(patch100, /lyricDraft/);

const temp = mkdtempSync(join(tmpdir(), 'soridraw-app430-'));
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
  assert.match(worker, /SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_430_20261019/);
  assert.match(worker, /publicationStateUpdatedAt429/);
  assert.match(worker, /await requireExploreAuth\(request\.clone\(\)\)/);
  const routeStart = worker.indexOf('async function handlePublicationStates429');
  const routeEnd = worker.indexOf('\n}', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.doesNotMatch(worker.slice(routeStart, routeEnd + 2), /env\?*\.DB|env\.DB|\.prepare\s*\(/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('APP430_UNRELATED_VIEWER_R2_FANOUT_BLOCKED=PASS');
console.log('APP430_WRITER_OWNER_SCOPE_AND_FRESH_PROOF=PASS');
console.log('APP430_STALE_R2_COMPLETION_BLOCKED=PASS');
console.log('APP430_PUBLICATION_ROUTE_AUTH_D1_R0_W0=PASS');
console.log('APP430_229_237_FROZEN_CORRECTIONS=PASS');
