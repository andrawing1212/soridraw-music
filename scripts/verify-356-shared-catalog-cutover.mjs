import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const cfg = JSON.parse(read('cloudflare/media-worker/wrangler.jsonc'));
const runtime = read('.deploy/release-media-worker-runtime.mjs');
const cutover = read('.github/workflows/cloudflare-media-shared-catalog-cutover.yml');
const previewDeploy = read('.github/workflows/cloudflare-media-r2-preview-deploy.yml');

const flags = [cfg.vars, cfg.env.test.vars, cfg.env.production.vars]
  .map((vars) => String(vars?.SORIDRAW_SHARED_CATALOG_V1 || ''));
assert.ok(flags.every((flag) => flag === flags[0]), 'shared Catalog flags drift across release environments');
assert.ok(['0', '1'].includes(flags[0]), 'shared Catalog flag must be 0 or 1');

for (const list of [cfg.r2_buckets, cfg.env.test.r2_buckets, cfg.env.production.r2_buckets]) {
  const catalog = list.find((item) => item?.binding === 'CATALOG');
  assert.equal(catalog?.bucket_name, 'soridraw-user-catalog');
}

assert.match(runtime, /\['preview', 'test', 'production'\]/);
assert.match(runtime, /mode === 'preview' \? SOURCE_CONFIG/);
assert.match(runtime, /worker: 'soridraw-media-preview'/);

for (const stage of ['preview', 'test', 'production']) {
  assert.ok(cutover.includes(`release-media-worker-runtime.mjs "$stage" upload`), `missing inactive upload for ${stage}`);
  assert.ok(cutover.includes(`release-media-worker-runtime.mjs "$stage" activate`), `missing activation for ${stage}`);
  assert.ok(cutover.includes(`release-media-worker-runtime.mjs "$stage" verify`), `missing verify for ${stage}`);
  assert.ok(cutover.includes(`release-media-worker-runtime.mjs "$stage" restore`), `missing rollback for ${stage}`);
}
const firstActivate = cutover.indexOf('release-media-worker-runtime.mjs "$stage" activate');
for (const stage of ['preview', 'test', 'production']) {
  const upload = cutover.indexOf('release-media-worker-runtime.mjs "$stage" upload');
  assert.ok(upload >= 0 && upload < firstActivate, `all uploads must happen before activation: ${stage}`);
}

assert.match(cutover, /CUTOVER_PREMUTATION_LIVE_PARITY=PASS/);
assert.match(cutover, /catalogAuthorityMode=="legacy-media"/);
assert.match(cutover, /SHARED_CATALOG_COORDINATED_CUTOVER=PASS/);
assert.match(cutover, /CUTOVER_GLOBAL_ROLLBACK=PASS/);
assert.match(cutover, /USER_DATA_BULK_OPERATION=false/);
assert.doesNotMatch(cutover, /wrangler\s+d1\s+(?:execute|migrations)/i);
assert.doesNotMatch(cutover, /wrangler\s+r2\s+object\s+(?:put|delete)/i);
assert.doesNotMatch(cutover, /firebase\s+(?:deploy|firestore)/i);

assert.doesNotMatch(previewDeploy, /'cloudflare\/media-worker\/\*\*'/);
assert.match(previewDeploy, /'cloudflare\/media-worker\/src\/\*\*'/);
assert.match(previewDeploy, /expected_mode='shared-catalog'/);

console.log('SHARED_CATALOG_CUTOVER_INFRASTRUCTURE_356=PASS');
console.log(`SHARED_CATALOG_SOURCE_FLAG=${flags[0]}`);
console.log('COORDINATED_UPLOAD_BEFORE_ACTIVATE=PASS');
console.log('GLOBAL_ROLLBACK_GUARD=PASS');
console.log('NO_USER_DATA_BULK_OPERATION=PASS');
