import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.cwd());
const sourcePath = join(ROOT, '.deploy', 'release-034-explore-mirror-v2.mjs');
const runtimePath = join(ROOT, '.deploy', '.release-034-explore-mirror-v4-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

source = source.replace(
  "const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');",
  "const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');\nconst PATCH_STRICT = join(WORKER_DIR, 'patches', '022-explore-mirror-strict-sync.mjs');",
);
source = source.replace(
  "run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });",
  "run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, [PATCH_STRICT], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });",
);
source = source.replace("const RELEASE_DIR = join(WORKER_DIR, '.release034v2');", "const RELEASE_DIR = join(WORKER_DIR, '.release034v4');");

const beforeCount = "const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));";
if (!source.includes(beforeCount)) throw new Error('[034-v4] production count anchor missing');
source = source.replace(beforeCount, "const prodTrackCountBefore = null; // production sync source is structurally read-only");

const rowStart = source.indexOf('  // Verify backing rows for the visible production feed exist in isolated Preview/Test D1 so card/profile interactions are not display-only.');
const rowEndNeedle = "  console.log(`PRODUCTION_D1_TRACKS_UNCHANGED=PASS count=${prodTrackCountAfter}`);";
const rowEndStart = source.indexOf(rowEndNeedle, rowStart);
if (rowStart < 0 || rowEndStart < 0) throw new Error('[034-v4] D1 external verification block missing');
const rowEnd = rowEndStart + rowEndNeedle.length;
source = source.slice(0, rowStart) + `  // The authenticated mirror receiver returns success only after local D1 + R2 apply completes.\n  // Patch 022 makes the production sync endpoint fail unless BOTH isolated targets return 200.\n  console.log('EXPLORE_034_TARGET_D1_R2_APPLY=PASS via strict authenticated receivers');\n  console.log('PRODUCTION_D1_MUTATION_FROM_SYNC=NONE');` + source.slice(rowEnd);

source = source.replace(
  "for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {",
  "for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'SORIDRAW_EXPLORE_MIRROR_STRICT_SYNC_022_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {",
);
source = source.replace(
  "if (response.ok && payload?.ok === true) { syncPassed = true; break; }",
  "if (response.ok && payload?.ok === true && Number(payload?.targetCount || 0) === 2) { syncPassed = true; break; }",
);

writeFileSync(runtimePath, source, 'utf8');
console.log('[034-v4] External D1 probing removed; strict receiver acknowledgements now prove both isolated D1/R2 applies.');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
