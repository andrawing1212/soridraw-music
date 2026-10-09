import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
const stage=entry.slice(entry.indexOf('// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE_20261009'));
assert.match(entry,/import \{ createCandidateLikeBatch422 \} from '\.\.\/runtime\/like-batch-composition-422\.mjs';/);
assert.match(stage,/const STAGE426_COMPILED_OPEN = false;/);
assert.equal(Object.prototype.hasOwnProperty.call(config.vars||{},'SORIDRAW_LIKE_171_READY'),false,
 'preview release config must not accidentally activate like 171');
assert.match(stage,/if \(!STAGE426_COMPILED_OPEN\|\|env\?\.SORIDRAW_LIKE_171_READY!=='1'\)/);
assert.match(stage,/env\?\.SORIDRAW_LIKE_171_READY==='1'\)/);
assert.match(stage,/await proveLikeBatchCutover426\(env\);/);
assert.match(stage,/await validateExploreAuth307\(request,env,ctx\);/);
assert.match(stage,/authenticatedUid:actor\.uid,firebaseIdToken:actor\.idToken/);
assert.match(stage,/firebaseTokenVerified:true/);
assert.match(stage,/SELECT phase FROM explore_like_writer_phase_419 WHERE id=1/);
assert.match(stage,/SELECT phase,approved_worker_sha256,drain_token_hash FROM explore_like_cutover_control_174 WHERE id=1/);
assert.match(stage,/allEnvironmentReadersReady!==true/);
assert.match(stage,/allEnvironmentWritersReady!==true/);
const repair=entry.slice(entry.indexOf('async function repairSharedPublicLikeCounts191('),
  entry.indexOf('const PUBLIC_LIKE_REPAIR_MARKER_191')>0?undefined:undefined);
assert.match(repair,/if\(STAGE426_COMPILED_OPEN&&env\?\.SORIDRAW_LIKE_171_READY==='1'\)/);
assert.match(repair,/skippedForCanonical171:true/);
assert.match(entry,/return ensureQueuedLikeBatchScheduled103\(request, env, response, ctx\)|await ensureQueuedLikeBatchScheduled103\(request, env, response, ctx\)/);
for (const path of [
  'cloudflare/explore-worker/runtime/like-batch-composition-422.mjs',
  'cloudflare/explore-worker/runtime/like-d1only-batch-adapter-420.mjs',
  'cloudflare/explore-worker/runtime/like-public-r2-publisher-421.mjs',
  'cloudflare/explore-worker/runtime/like-personal-r2-publisher-423.mjs',
  'cloudflare/explore-worker/runtime/like-rtdb-user-signal-424.mjs',
]){
 assert.ok(readFileSync(path,'utf8').length>100);
}
console.log('426_PREVIEW_ENTRY_ROUTE_COMPILETIME_OFF=PASS');
console.log('426_VERIFIED_USER_TOKEN_AND_SHARED_D1_FENCE_REQUIRED=PASS');
console.log('426_191_LEGACY_REPAIR_CANNOT_REVERT_ACTIVE_171_COUNT=PASS');
console.log('426_OLD_USER_BATCH_ROUTE_PRESERVED=PASS');
console.log('426_REAL_WORKER_BUNDLE=SEPARATE_WRANGLER_DRY_RUN_REQUIRED');
