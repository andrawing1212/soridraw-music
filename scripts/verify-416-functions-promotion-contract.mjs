import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const contract=JSON.parse(readFileSync('.deploy/stage416-functions-environment-contract.json','utf8'));
const workflow=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
const canonical=JSON.stringify(contract,Object.keys(contract).sort());
assert.equal(contract.schema,1);
assert.deepEqual(contract.approvedFunctions.sort(),[
 'recordPrivateLike416','stage416SettlePrivateWindowCandidate'].sort());
assert.equal(contract.secret,'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET');
assert.equal(contract.queue,'stage416SettlePrivateWindowCandidate');
for(const [stage,row] of Object.entries(contract.environments)){
 assert.match(row.firebaseProject,/^[a-z][a-z0-9-]+$/);
 assert.match(row.databaseUrl,/^https:\/\/[a-z0-9-]+(?:-default-rtdb)?\.firebaseio\.com$/);
 const endpoint=new URL(row.workerEndpoint);
 assert.equal(endpoint.protocol,'https:');
 assert.equal(endpoint.pathname,'/v1/internal/private-like-handoff-416');
 if(stage!=='preview')assert.doesNotMatch(endpoint.hostname,/preview/i,
  `${stage} must not inherit the PREVIEW Worker`);
}
for(const token of [
 'Stage416 Functions read-only environment preflight',
 'STAGE416_FUNCTIONS_PREFLIGHT_ONLY=PASS',
 'STAGE416_FUNCTIONS_SOURCE_SHA256',
 'stage416Functions',
 'EXPECTED_STAGE416_FUNCTIONS_SOURCE_SHA256',
 'recordPrivateLike416,functions:stage416SettlePrivateWindowCandidate',
])assert.ok(workflow.includes(token),`promotion workflow missing ${token}`);
assert.doesNotMatch(workflow,/--only\s+["']?functions(?!:recordPrivateLike416)/,
 'unscoped Functions deploy is forbidden');
assert.match(workflow,/if: steps\.request\.outputs\.mode == 'test'/,
 'Functions mutation must be excluded from preflight_only');
console.log(`STAGE416_FUNCTIONS_CONTRACT_SHA256=${createHash('sha256').update(canonical).digest('hex')}`);
console.log('STAGE416_FUNCTIONS_EXACT_SCOPE=PASS');
console.log('STAGE416_NON_PREVIEW_ENDPOINTS=PASS');
console.log('STAGE416_PREFLIGHT_MUTATION_ZERO_STATIC=PASS');
