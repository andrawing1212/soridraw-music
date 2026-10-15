import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wf=readFileSync('.github/workflows/stage416-preview-settle-one-function.yml','utf8');
const inv=readFileSync('scripts/verify-416-public-function-inventory.mjs','utf8');

assert.match(wf,/AUDITED_ACTIVATION_PRODUCT_SHA: 2d2ac47970a0f1099ff53bb7b041097b3a3fe91a/);
for(const target of [
  'recordPrivateLike416',
  'privateLikeFinalReceipt416Candidate',
  'stage416ReleasePublicWindowCandidate',
  'publicLikeRelease416Candidate',
]) {
  assert.match(wf,new RegExp(target+':preview_audited_stage416_activation_single_function'));
}
assert.match(wf,/test "\$target" = "\$AUDITED_ACTIVATION_PRODUCT_SHA"/);
assert.match(wf,/audit_result=\(PENDING\|PASS\)/);
assert.match(wf,/if \[ "\$preflight_only" = false \]; then[\s\S]*?grep -Fxq 'audit_result=PASS'/);
assert.match(wf,/require_external_guard416/);
assert.match(wf,/TRUSTED_PUBLIC_GUARD_SHA/);
assert.match(wf,/416_PUBLIC_UNAUDITED_DEPLOY_GUARD_REFUSED/);
assert.match(wf,/public_gate_activation=true/);
assert.match(wf,/export ACTIVATION_RELEASE="\$activation_release"/);
assert.match(wf,/test "\$mode" = audited_update_only/);
assert.match(wf,/416_ACTIVATION_EXPECTED_39_FUNCTIONS_BEFORE/);
assert.match(wf,/416_AUDITED_EXACT_ONE_EXISTING_FUNCTION_UPDATE=PASS/);
assert.match(wf,/firebase-tools@15\.30\.1 deploy[\s\S]*?--only "functions:\$PATCH_FUNCTION"[\s\S]*?--non-interactive/);
const deployStep=wf.slice(wf.indexOf('- name: Deploy only'),wf.indexOf('- name: Verify patched Function'));
const activationStart=deployStep.indexOf('if [ "$ACTIVATION_RELEASE" = true ]; then');
const activationElse=deployStep.indexOf('else',activationStart);
assert.ok(activationStart>=0&&activationElse>activationStart);
assert.doesNotMatch(deployStep.slice(activationStart,activationElse),/--force/,
  'audited activation must never use --force');
assert.match(wf,/privateLikeFinalReceipt416Candidate[\s\S]*?exploreLikePrivateFinalEndpoint416/);
assert.match(wf,/requirePreviewMaster416/);
assert.match(wf,/await requirePreviewMaster416\(request\)/);
assert.match(wf,/STAGE416_ENV_INDEPENDENT_SINGLE_FUNCTION_EXPORT=PASS/);
assert.match(wf,/node scripts\/verify-444-stage416-master-public-e2e\.mjs/);
assert.match(wf,/416_ACTIVATION_EXACT_PRODUCT_SOURCE=PASS/);

assert.match(inv,/audited_update_only/);
assert.match(inv,/AUDITED_UPDATE_TARGETS_416/);
assert.match(inv,/416_AUDITED_UPDATE_FUNCTION_COUNT_DRIFT/);
assert.match(inv,/416_UNRELATED_FUNCTION_CHANGED/);
assert.match(inv,/stableTargetPolicy416/);
assert.match(inv,/416_AUDITED_UPDATE_TARGET_RUNTIME_POLICY_DRIFT/);
assert.match(inv,/416_AUDITED_EXISTING_UPDATE_ONLY_SELFTEST=PASS/);
assert.match(inv,/validateAdopt416[\s\S]*?416_RECOVERY_SOURCE_NOT_ATTESTED_STOP/);

console.log('STAGE416_AUDITED_ACTIVATION_EXACT_PRODUCT_AND_GUARD=PASS');
console.log('STAGE416_AUDITED_ACTIVATION_ALLOWLIST_4_FUNCTIONS=PASS');
console.log('STAGE416_AUDITED_ACTIVATION_NO_FORCE_ONE_FUNCTION_ONLY=PASS');
console.log('STAGE416_AUDITED_ACTIVATION_38_OTHER_FUNCTIONS_PROTECTED=PASS');
console.log('STAGE416_AUDITED_ACTIVATION_TARGET_RUNTIME_POLICY_PROTECTED=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
