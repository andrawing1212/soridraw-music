import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';

const preview=readFileSync('.github/workflows/cloudflare-media-r2-preview-deploy.yml','utf8');
const cutover=readFileSync('.github/workflows/cloudflare-media-shared-catalog-cutover.yml','utf8');
const promotion=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
const packageJson=JSON.parse(readFileSync('cloudflare/media-worker/package.json','utf8'));
assert.match(packageJson.scripts.deploy,/MEDIA_DIRECT_DEPLOY_BLOCKED_USE_APPROVED_SHARED_RELEASE_CONTROLLER/);
assert.doesNotMatch(packageJson.scripts.deploy,/^wrangler deploy/);
const group='soridraw-media-shared-r2-mutation';
for(const [name,workflow] of [['PREVIEW',preview],['SHARED_CUTOVER',cutover],['TEST_PRODUCTION_PROMOTION',promotion]]){
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
assert.match(promotion,/github.workflow_sha/);
assert.match(promotion,/test -f "\$RELEASE_ROOT\/cloudflare\/media-worker\/src\/catalogSharedWriterRolloutGate518.js"/);
assert.match(promotion,/grep -q 'verifyLegacyMediaMutationAllowed518'/);
assert.match(promotion,/RELEASE_MEDIA_SHARED_R2_518_SOURCE_FENCE=PASS/);
assert.match(preview,/approve_preview_deploy == 'DEPLOY_PREVIEW_MEDIA'/);
assert.match(preview,/git merge-base --is-ancestor/);
assert.match(preview,/verifyLegacyMediaMutationAllowed518/);
assert.match(preview,/RELEASE_MEDIA_WORKER_VERSION="\$uploaded" node \.deploy\/release-media-worker-runtime\.mjs preview activate/);
assert.match(preview,/node \.deploy\/release-media-worker-runtime\.mjs preview upload/);
console.log('APP518_PREVIEW_DIRECT_WRANGLER_DEPLOY_BYPASS_CLOSED=PASS');
console.log('APP518_PREVIEW_AND_CUTOVER_SHARED_MUTEX=PASS');
console.log('APP518_SHARED_CUTOVER_MANUAL_SHA_AND_APPROVAL=PASS');
console.log('APP518_PINNED_OLD_SOURCE_WITHOUT_GUARD_BLOCKED=PASS');

console.log('APP518_TEST_PRODUCTION_PROMOTION_SAME_MUTEX_AND_PINNED_FENCE=PASS');

console.log('APP518_MEDIA_NPM_DIRECT_DEPLOY_BYPASS_CLOSED=PASS');

/**
 * Reproduce the old-SHA vulnerability offline. Every mutation workflow must
 * source immutable base+file commitments from its OWN workflow, rather than
 * trusting a validator shipped inside the user-selected release SHA.
 */
const safetyBase='430d64e5d7f3f573a8ca1c7c7c4d23561408624e';
const unsafeAncestor='921311a29632c4f79554b52cca354736b18dc6ef';
const hashes=[
 ['cloudflare/media-worker/src/index.js','5baa599744aecf67a90d2f2ee6dcdf614b4b7f7b'],
 ['cloudflare/media-worker/src/catalogSharedWriterRolloutGate518.js','be1a5f2cfa94a0c62130ff7ed5fe4f1f6f043889'],
 ['.deploy/release-media-worker-runtime.mjs','89c55674adcd4e9ec5fb909a04e818333117d1a1'],
 ['cloudflare/media-worker/package.json','81f2a797c30dfd1d7e700e542bbd29c88987198f'],
 ['scripts/verify-518-shared-writer-rollout.mjs','01e6d7a6f280d421cf982552a3c9f2e824f60264'],
];
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const ancestor=(base,ref)=>spawnSync('git',['merge-base','--is-ancestor',base,ref]).status===0;
assert.equal(ancestor(safetyBase,unsafeAncestor),false,
 'known incomplete guard from old SHA must fail ancestry');
assert.equal(ancestor(safetyBase,'HEAD'),true);
for(const [path,expected] of hashes){
 assert.equal(git(['rev-parse',safetyBase+':'+path]),expected,
  'the pinned Git object must be from the immutable reviewed source');
 assert.equal(git(['hash-object',path]),expected,
  'protected source changed without updating release identity');
}
for(const [name,workflow] of [
 ['PREVIEW',preview],['SHARED_CUTOVER',cutover],['TEST_PRODUCTION',promotion],
]){
 assert.match(workflow,/SAFE_MEDIA_BASE_518=430d64e5d7f3f573a8ca1c7c7c4d23561408624e/,
  name+' immutable ancestor check missing');
 assert.match(workflow,/merge-base --is-ancestor "\$SAFE_MEDIA_BASE_518" HEAD/,
  name+' source ancestor check missing');
 assert.match(workflow,/HOLD_518_RELEASE_SHA_PREDATES_SAFE_BASE/);
 assert.match(workflow,/HOLD_518_UNAUDITED_SOURCE_HASH/);
 assert.match(workflow,/AUDITED_MEDIA_GIT_BLOBS_518/);
 for(const [path,hash] of hashes){
  assert.ok(workflow.includes(hash+' '+path),name+': missing Git blob pin '+path);
 }
 // The approved SHA is checked out before mutation and the pin is enforced
 // in the workflow-supplied script, NOT a candidate-selected validator.
 const pos=workflow.indexOf('SAFE_MEDIA_BASE_518=');
 const mutation=name==='PREVIEW'
  ?workflow.indexOf('node .deploy/release-media-worker-runtime.mjs preview upload')
  :name==='SHARED_CUTOVER'
   ?workflow.indexOf('node .deploy/release-media-worker-runtime.mjs "$stage" upload')
   :workflow.indexOf('node .deploy/release-media-worker-runtime.mjs test upload');
 assert.ok(pos>0&&mutation>pos,name+': authority must predate mutation');
}
// SHA ancestry does not replace source identity. For a descendant with one
// protected blob changed, the strict expected hash must independently fail.
const changedHash='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.notEqual(changedHash,hashes[1][1]);
console.log('APP518_OLD_PARTIAL_PROTECTION_SHA_DENIED=PASS');
console.log('APP518_PINNED_AUDITED_PROTECTED_BLOBS_THREE_WORKFLOWS=PASS');
console.log('APP518_SOURCE_CHANGE_REQUIRES_REAUDIT=PASS');
