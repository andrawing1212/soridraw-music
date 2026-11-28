import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {classifySharedRelease,verifyRulesOnlyApproval} from './app738-shared-release-route.mjs';
import {verifyHostingOnlyTrigger} from './app738-preview-bundle.mjs';
const flags='functions_deploy=false\nworker_deploy=false\nrelease_shared_d1_migration=false\nrelease_shared_user_data_change=false\nmain_test_change=false\nproduction_change=false';
const input=(h,r)=>'deploy_hosting='+h+'\ndeploy_shared_rtdb_rules='+r+'\n'+flags;
const hosting=input(true,false),rules=input(false,true);
assert.equal(classifySharedRelease(hosting),'hosting');assert.doesNotThrow(()=>verifyHostingOnlyTrigger(hosting));
assert.equal(classifySharedRelease(rules),'rules');assert.throws(()=>verifyHostingOnlyTrigger(rules),/NOT_HOSTING_ONLY/);
for(const raw of [input(true,true),input(false,false),hosting+'\ndeploy_hosting=false',rules.replace('functions_deploy=false','functions_deploy=true'),rules.replace('worker_deploy=false',''),rules.replace('production_change=false','production_change=true'),rules.replace('deploy_hosting=false','deploy_hosting=maybe')]){
 assert.throws(()=>classifySharedRelease(raw),/APP738_RELEASE_ROUTE_HOLD/);
}
const approval='APPLY_SHARED_RTDB_RULES_ONLY',triggerSha256=createHash('sha256').update(rules).digest('hex');
assert.equal(verifyRulesOnlyApproval({raw:rules,approval,triggerSha256}),true);
for(const opts of [{raw:hosting,approval,triggerSha256},{raw:rules,approval:'',triggerSha256},{raw:rules,approval,triggerSha256:'0'.repeat(64)},{raw:rules+'\n',approval,triggerSha256}]){
 assert.throws(()=>verifyRulesOnlyApproval(opts),/APP738_RELEASE_ROUTE_HOLD/);
}
const candidate=readFileSync('.deploy/app738-shared-rtdb-rules.candidate.yml','utf8');
const producer=readFileSync('.github/workflows/app738-preview-artifact.yml','utf8');
assert.match(candidate,/if: \$\{\{ false \}\}/);
assert.ok(candidate.indexOf('exit 2')<candidate.indexOf('google-github-actions/auth@'));
assert.ok(candidate.indexOf('node scripts/app738-shared-release-route.mjs rules')<candidate.indexOf('google-github-actions/auth@'));
assert.match(candidate,/GITHUB_RUN_ATTEMPT" = '1'/);
assert.match(candidate,/GITHUB_ACTOR_ID" = '268937716'/);
assert.match(candidate,/GITHUB_WORKFLOW_SHA" = "\$APPROVED_SHA"/);
assert.doesNotMatch(candidate,/--only hosting|hosting:clone|firebase deploy|FIREBASE_ACCESS_TOKEN|HOSTING_JOURNAL_APP_PRIVATE_KEY/);
for(const marker of ['verify-studio-heart-handoff-live-additive.mjs','verify-418-rtdb-rules-delta.mjs','verify-434-publication-rtdb-additive.mjs','STUDIO_HEART_SHARED_RTDB_POST_DEPLOY_DRIFT_STOP','SHARED_RTDB_RULES_EXACT_MATCH=PASS','NO_USER_DATA_MIGRATION=true'])assert.ok(candidate.includes(marker));
assert.doesNotMatch(producer,/secrets\.|google-github-actions\/auth|firebase deploy|--only hosting/);
console.log('APP738_RELEASE_ROUTE_HOSTING_RULES_MIXED_APPROVAL_AND_HARD_HOLD=PASS_SYNTHETIC');

// Preserve the former manual exact-current-SHA Hosting-only request, without
// adding a credential or bypassing the trusted main receiver's HOLD.
const writer=readFileSync('.github/workflows/app738-hosting-writer.yml','utf8');
const writerJob=writer.slice(writer.indexOf('  writer:'),writer.indexOf('  journal-proof:'));
assert.match(producer,/workflow_dispatch:\n    inputs:\n      target_sha:/);
assert.match(producer,/github\.ref == 'refs\/heads\/preview' && github\.run_attempt == 1/);
assert.match(producer,/github\.actor_id == '268937716' && inputs\.target_sha == github\.sha/);
assert.match(producer,/test "\$APPROVED_SHA" = "\$GITHUB_SHA"/);
assert.ok(producer.indexOf('verifyHostingOnlyTrigger')<producer.indexOf('npm ci'));
assert.match(writerJob,/github\.ref == 'refs\/heads\/main' && github\.run_attempt == 1/);
assert.match(writerJob,/github\.event\.workflow_run\.event == 'workflow_dispatch' &&\s+github\.event\.workflow_run\.actor\.id == 268937716/);
assert.match(writerJob,/github\.event\.workflow_run\.run_attempt == 1/);
assert.ok(writerJob.indexOf('assertApp738ProductionWriteAuthority()')<writerJob.indexOf('google-github-actions/auth@'));
assert.ok(writerJob.indexOf('assertApp738ProductionWriteAuthority()')<writerJob.indexOf('actions/create-github-app-token@'));
console.log('APP738_PINNED_MANUAL_HOSTING_AND_RECEIVER_HOLD=PASS_SOURCE');
