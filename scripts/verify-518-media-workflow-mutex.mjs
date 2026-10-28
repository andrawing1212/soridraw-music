import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const preview=readFileSync('.github/workflows/cloudflare-media-r2-preview-deploy.yml','utf8');
const cutover=readFileSync('.github/workflows/cloudflare-media-shared-catalog-cutover.yml','utf8');
const group='soridraw-media-shared-r2-mutation';
for(const [name,workflow] of [['PREVIEW',preview],['SHARED_CUTOVER',cutover]]){
 assert.match(workflow,new RegExp('group: '+group));
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s*run:\s*npm run deploy\s*$/m,
  name+' must not bypass guard');
 assert.doesNotMatch(workflow,/^\s*run:\s*npx wrangler (?:deploy|versions deploy)/m);
 assert.match(workflow,/\.deploy\/release-media-worker-runtime\.mjs/);
}
assert.doesNotMatch(cutover,/^  push:/m,
 'shared bucket cutover must require an explicit director approval');
assert.match(cutover,/approve_shared_media_cutover/);
assert.match(cutover,/if: \$\{\{ inputs\.approve_shared_media_cutover == 'CUTOVER_SHARED_MEDIA' \}\}/);
assert.match(cutover,/inputs\.commit_sha/);
assert.match(cutover,/git merge-base --is-ancestor/);
assert.match(cutover,/verifyLegacyMediaMutationAllowed518/);
assert.match(preview,/approve_preview_deploy == 'DEPLOY_PREVIEW_MEDIA'/);
assert.match(preview,/git merge-base --is-ancestor/);
assert.match(preview,/verifyLegacyMediaMutationAllowed518/);
assert.match(preview,/RELEASE_MEDIA_WORKER_VERSION="\$uploaded" node \.deploy\/release-media-worker-runtime\.mjs preview activate/);
assert.match(preview,/node \.deploy\/release-media-worker-runtime\.mjs preview upload/);
console.log('APP518_PREVIEW_DIRECT_WRANGLER_DEPLOY_BYPASS_CLOSED=PASS');
console.log('APP518_PREVIEW_AND_CUTOVER_SHARED_MUTEX=PASS');
console.log('APP518_SHARED_CUTOVER_MANUAL_SHA_AND_APPROVAL=PASS');
console.log('APP518_PINNED_OLD_SOURCE_WITHOUT_GUARD_BLOCKED=PASS');
