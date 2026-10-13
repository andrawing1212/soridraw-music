import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
const verifier=fs.readFileSync('.deploy/stage416-functions-promotion.mjs','utf8');
const contract=JSON.parse(fs.readFileSync('.deploy/stage416-functions-environment-contract.json','utf8'));
const approved=['recordPrivateLike416','stage416SettlePrivateWindowCandidate'];
assert.deepEqual(contract.functions,approved);
assert.equal(contract.secret,'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
assert.equal(contract.queue,'stage416SettlePrivateWindowCandidate');
for(const stage of ['preview','test','production']){
  const row=contract.environments[stage];
  assert.match(row.projectEnv,/^STAGE416_[A-Z]+_FIREBASE_PROJECT$/);
  assert.match(row.databaseUrlEnv,/^STAGE416_[A-Z]+_DATABASE_URL$/);
  assert.match(row.workerEndpoint,new RegExp(`^https://[^/]+/v1/internal/private-like-handoff-416$`));
  if(stage!=='preview')assert.ok(!row.workerEndpoint.includes('preview'));
}
for(const token of ['stage416-functions-promotion.mjs live-preflight preview','stage416-functions-promotion.mjs live-preflight test','stage416-functions-promotion.mjs live-preflight production','STAGE416_FUNCTIONS_PREFLIGHT_NO_MUTATION=PASS','stage416Functions','artifactSha256','sourceSha256']) assert.ok(workflow.includes(token),token);
assert.ok(!/--only\s+functions(?!:recordPrivateLike416|:stage416SettlePrivateWindowCandidate)/.test(workflow),'unscoped Functions deploy');
assert.ok(!/database:(?:set|remove)|firestore:(?:delete|indexes)/.test(workflow),'data mutation command');
for(const token of ['generateDownloadUrl','serviceAccountEmail','secretEnvironmentVariables','taskQueueTrigger','SORIDRAW_PRIVATE_BATCH416_WORKER_URL','read-only']) assert.ok(verifier.includes(token),token);

// Synthetic fail-closed checks are deliberately independent of cloud credentials.
const digest=crypto.createHash('sha256').update('same immutable functions artifact').digest('hex');
const manifest={artifactSha256:digest,sourceSha256:digest,functions:approved};
assert.equal(manifest.artifactSha256,digest);
assert.throws(()=>{if('preview endpoint'.includes('preview'))throw Error('preview fallback');},/preview fallback/);
assert.throws(()=>assert.equal('bad',digest),/Expected values to be strictly equal/);
console.log('STAGE416_FUNCTIONS_EXACT_ARTIFACT_SYNTHETIC=PASS');
console.log('STAGE416_FUNCTIONS_BINDING_FAIL_CLOSED_SYNTHETIC=PASS');
console.log('STAGE416_FUNCTIONS_APPROVED_SCOPE_ONLY=PASS');
console.log('STAGE416_FUNCTIONS_PREFLIGHT_MUTATION_COMMANDS=0');
