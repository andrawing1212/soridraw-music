import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// App380 may change follow intake timing/abuse limits only. The app381 Recent
// hotfix remains preserved in its separate commit and must not enter this build.
const baseline = 'aa1bac7636651fdf94598f0d5ef502955a60bc0f';
for (const file of [
  'src/components/explore/ExploreShell.tsx',
  'src/components/studio/StudioSplitEngineWorkspace.tsx',
]) {
  const frozen = execFileSync('git', ['show', baseline + ':' + file],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  assert.equal(readFileSync(file, 'utf8'), frozen,
    'unapproved app381 UI leaked into app380 follow-only release: ' + file);
}
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
assert.equal(version.version, 380, 'follow-only app must build as app380, not app381');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
assert.match(page, /queueExploreFollowFinalState380\(/);
assert.match(page, /readPendingExploreFollowIntents380\(/);
const patchList = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8')).patches;
assert.ok(patchList.includes('097-follow-abuse-guard.mjs'), 'follow guard absent');
assert.ok(!patchList.includes('098-like-abuse-guard.mjs'), 'app390 like guard must not deploy');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
assert.match(worker, /SORIDRAW_FOLLOW_ABUSE_GUARD_380_20261007/);
assert.doesNotMatch(worker, /SORIDRAW_LIKE_ABUSE_GUARD_390_20261008|acceptLikeReceipt390|readLegacyLikeReplay379/);
const config = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));
assert.equal(config.vars.SORIDRAW_ENVIRONMENT, 'preview');
assert.equal(config.d1_databases.find(x => x.binding === 'DB')?.database_name, 'soridraw-explore-db');
assert.equal(config.r2_buckets.find(x => x.binding === 'PROFILE_MEDIA')?.bucket_name, 'soridraw-profile-media');
const preflight = readFileSync('.github/workflows/cloudflare-explore-preview-release.yml', 'utf8');
assert.match(preflight, /if grep -q 'SORIDRAW_LIKE_ABUSE_GUARD_390_20261008' canonical\/preview-worker\.js; then/);
assert.match(preflight, /node scripts\/receipt390-release\.mjs preflight canonical\/wrangler\.preview\.jsonc preview/);
assert.match(preflight, /FOLLOW_ONLY_380_NO_RECEIPT_SCHEMA_PREFLIGHT=PASS/);
assert.match(preflight, /verifySocialConfig380/);
const hostRelease = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml', 'utf8');
assert.match(hostRelease, /\.deploy\/preview-app-release\.trigger/);
assert.match(hostRelease, /--only hosting/);
const workerRelease = readFileSync('.github/workflows/cloudflare-explore-preview-release.yml', 'utf8');
assert.match(workerRelease, /\.deploy\/preview-worker-release\.trigger/);
console.log('APP380_UI_MATCHES_DEPLOYED_APP379_EXACT=PASS');
console.log('APP380_FOLLOW_ONLY_VERSION=380_PASS');
console.log('APP380_FOLLOW_WORKER_NO_RECEIPT390=PASS');
console.log('APP380_PREVIEW_RELEASE_GATES_READONLY=PASS');
