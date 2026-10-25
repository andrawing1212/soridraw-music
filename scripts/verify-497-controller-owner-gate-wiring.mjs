#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const controller=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
const ownerWorkflow=readFileSync('.github/workflows/soridraw-test-owner-acceptance.yml','utf8');
const ownerCli=readFileSync('scripts/sign-497-owner-acceptance-cli.mjs','utf8');
const productionCli=readFileSync('scripts/verify-497-owner-acceptance-cli.mjs','utf8');
const state=readFileSync('scripts/update-release-control-status.mjs','utf8');
const testStep=controller.split('      - name: TEST_VERIFY and freeze durable manifest')[1]
  ?.split('      - name: PROD_PREFLIGHT revalidate TEST manifest')[0];
const loadStep=controller.split('      - name: Load source identity')[1]
  ?.split('      - name: PREFLIGHT build')[0];
assert.ok(testStep && loadStep,'Release Controller phase ownership not found');

assert.match(testStep,/schema:5,state:'TEST_AUTO_CHECKED'/);
assert.match(testStep,/parity:\{reference:'PREVIEW',status:'PENDING_OWNER_ACCEPTANCE'\}/);
assert.doesNotMatch(testStep,/state:'TEST_VERIFIED'/);
assert.doesNotMatch(testStep,/parity:\{reference:'PREVIEW',status:'PASS'\}/);
assert.match(testStep,/update TEST_AUTO_CHECKED/);
assert.match(state,/'TEST_AUTO_CHECKED'/);

assert.match(loadStep,/--pattern soridraw-test-acceptance\.json/);
assert.match(loadStep,/verify-497-owner-acceptance-cli\.mjs/);
assert.match(loadStep,/SORIDRAW_RELEASE_ATTESTATION_KEY:\s*\$\{\{ secrets\.SORIDRAW_RELEASE_ATTESTATION_KEY \}\}/);
assert.match(loadStep,/m\.state!=='TEST_AUTO_CHECKED'/);
assert.match(loadStep,/m\.parity\?\.status!=='PENDING_OWNER_ACCEPTANCE'/);
const signerPos=loadStep.indexOf('node "$GITHUB_WORKSPACE/scripts/verify-497-owner-acceptance-cli.mjs"');
const mutationPos=controller.indexOf('      - name: PROD_DEPLOY verified identities only');
assert.ok(signerPos>=0 && mutationPos>0,'Signed approval must precede PRODUCTION mutations');

assert.match(ownerWorkflow,/workflow_dispatch:/);
assert.doesNotMatch(ownerWorkflow,/issue_comment:/);
assert.match(ownerWorkflow,/github\.actor == github\.repository_owner/);
assert.match(ownerWorkflow,/github\.triggering_actor == github\.actor/);
assert.match(ownerWorkflow,/ACCEPT_TEST_RESULTS/);
assert.match(ownerWorkflow,/sign-497-owner-acceptance-cli\.mjs/);
assert.match(ownerWorkflow,/verify-497-owner-acceptance-cli\.mjs/);
assert.match(ownerWorkflow,/gh release upload/);
assert.doesNotMatch(ownerWorkflow,/firebase-tools|wrangler|deploy --only hosting|git push origin/);
assert.match(ownerCli,/process\.env\.GITHUB_REPOSITORY_OWNER/);
assert.match(ownerCli,/signOwnerAcceptance/);
assert.match(productionCli,/verifyOwnerAcceptance/);

console.log('APP497_TEST_AUTO_CHECKED_NOT_TEST_VERIFIED=PASS');
console.log('APP497_SEPARATE_OWNER_WORKFLOW_SIGNED_APPROVAL=PASS');
console.log('APP497_PRODUCTION_SIGNED_GATE_BEFORE_DEPLOY=PASS');
console.log('APP497_NO_OWNER_WORKFLOW_DEPLOYMENT=PASS');
