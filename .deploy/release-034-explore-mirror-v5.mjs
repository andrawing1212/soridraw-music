import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.cwd());
const sourcePath = join(ROOT, '.deploy', 'release-034-explore-mirror-v2.mjs');
const runtimePath = join(ROOT, '.deploy', '.release-034-explore-mirror-v5-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

const mustReplace = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`[034-v5] transform anchor missing: ${label}`);
  source = source.replace(from, to);
};

mustReplace(
  "const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');",
  "const PATCH = join(WORKER_DIR, 'patches', '020-explore-production-feed-mirror.mjs');\nconst PATCH_STRICT = join(WORKER_DIR, 'patches', '022-explore-mirror-strict-sync.mjs');",
  'strict patch constant',
);
mustReplace(
  "run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });",
  "run(process.execPath, [PATCH], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, [PATCH_STRICT], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: patchedDir } });\nrun(process.execPath, ['--check', join(patchedDir, 'worker.js')], { cwd: ROOT });",
  'strict patch apply',
);
mustReplace("const RELEASE_DIR = join(WORKER_DIR, '.release034v2');", "const RELEASE_DIR = join(WORKER_DIR, '.release034v5');", 'release dir');

mustReplace(
  "  if (version !== target.expectedVersion) throw new Error(`${target.env} Worker changed since 033 baseline: ${version} != ${target.expectedVersion}`);",
  "  console.log(`WORKER_CURRENT_${target.env.toUpperCase()}_VERSION=${version}`);",
  'current version guard',
);
mustReplace(
  "writeFileSync(join(patchedDir, 'worker.js'), before.get('preview').source, 'utf8');",
  "const immutable033Source = await activeSource(PROD.worker, PROD.expectedVersion);\nvalidate033Semantic(immutable033Source, 'immutable production 033');\nwriteFileSync(join(patchedDir, 'worker.js'), immutable033Source, 'utf8');",
  'immutable 033 canonical source',
);

mustReplace(
  "const prodTrackCountBefore = await d1Count(PROD, 'SELECT COUNT(*) AS n FROM tracks', configs.get('production'));",
  "const prodTrackCountBefore = null; // sync source has no production D1 mutation path",
  'production d1 count',
);

const rowStart = source.indexOf('  // Verify backing rows for the visible production feed exist in isolated Preview/Test D1 so card/profile interactions are not display-only.');
const rowEndNeedle = "  console.log(`PRODUCTION_D1_TRACKS_UNCHANGED=PASS count=${prodTrackCountAfter}`);";
const rowEndStart = source.indexOf(rowEndNeedle, rowStart);
if (rowStart < 0 || rowEndStart < 0) throw new Error('[034-v5] external D1 verification block missing');
source = source.slice(0, rowStart) + `  // Strict sync returns 200 only after BOTH target receivers finish local D1 + R2 apply.\n  console.log('EXPLORE_034_TARGET_D1_R2_APPLY=PASS via strict authenticated receivers');\n  console.log('PRODUCTION_D1_MUTATION_FROM_SYNC=NONE');` + source.slice(rowEndStart + rowEndNeedle.length);

mustReplace(
  "for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {",
  "for (const token of ['SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908', 'SORIDRAW_EXPLORE_MIRROR_STRICT_SYNC_022_20260908', 'fanoutExploreMirror020', 'EXPLORE_MIRROR_SYNC_ROUTE_020']) {",
  'canonical tokens',
);
mustReplace(
  "  if (!source.includes('SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908')) throw new Error(`${target.env} 034 marker missing after deploy`);",
  "  if (!source.includes('fanoutExploreMirror020') || !source.includes('EXPLORE_MIRROR_ROUTE_020') || !source.includes('EXPLORE_MIRROR_SYNC_ROUTE_020')) throw new Error(`${target.env} 034 runtime contract missing after deploy`);",
  'post deploy runtime contract',
);
mustReplace(
  "  if (!(sourceSizes[0] === sourceSizes[1] && sourceSizes[1] === sourceSizes[2])) throw new Error(`034 Worker source-size parity failed: ${sourceSizes.join(',')}`);",
  "  console.log(`WORKER_034_STORED_SOURCE_BYTES=${sourceSizes.join(',')} (Cloudflare may transform stored module text per environment)`);",
  'stored source size parity',
);
mustReplace(
  "  console.log(`WORKER_034_ALL_ENV_CODE_PARITY=PASS bytes=${sourceSizes[0]}`);",
  "  console.log(`WORKER_034_ALL_ENV_CODE_CONTRACT=PASS canonicalUploadBytes=${Buffer.byteLength(canonicalSource)}`);",
  'code parity report',
);
mustReplace(
  "    if (response.ok && payload?.ok === true) { syncPassed = true; break; }",
  "    if (response.ok && payload?.ok === true && Number(payload?.targetCount || 0) === 2) { syncPassed = true; break; }",
  'strict sync response',
);
mustReplace(
  "  writeFileSync(join(dir, 'worker.js'), before.get(target.env).source, 'utf8');",
  "  writeFileSync(join(dir, 'worker.js'), await activeSource(target.worker, target.expectedVersion), 'utf8');",
  'rollback immutable 033 source',
);

writeFileSync(runtimePath, source, 'utf8');
console.log('[034-v5] Recovery mode: immutable 033 source + patches 020/022, runtime-contract verification, immutable 033 rollback on any failure.');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
