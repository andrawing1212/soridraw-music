// app518 isolated trust/rollback tests: no Cloudflare, GitHub or data writes.
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyTrustedReleaseProof518,verifyRestoredExact518,observeLiveAccount518}
 from './verify-518-account-release-preflight.mjs';
const fingerprint=source=>createHash('sha256').update(source).digest('hex');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({type:'spki',format:'pem'}).toString();
const trusted=fingerprint(pem),sha='a'.repeat(40),nowMs=1793354400000;
const worker='soridraw-explore-test';
const rollback='deadbeef-1111-4111-8111-123456789abc';
const old='aaaabbbb-2222-4222-8222-123456789abc';
const core={purpose:'APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER',releaseSha:sha,
 checkedAtMs:nowMs-1000,workers:[{
  name:worker,rollbackVersionId:rollback,rollbackBudgetAware:true,
  rollbackCodeSha256:'b'.repeat(64),
  rollbackD1Bindings:[{binding:'DB',databaseId:'217ef5b1-5d80-4f7c-afc7-9e07eb05c06b'}],
 }]};
const signed=()=>{const payload=JSON.stringify(core);
 return {payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64')}};
const observed={activeVersionId:rollback,trafficPercent:100,
 codeSha256:'b'.repeat(64),d1Bindings:core.workers[0].rollbackD1Bindings};
const input=()=>({signed:signed(),publicKeyPem:pem,trustedHash:trusted,
 releaseSha:sha,nowMs,restoreWorker:worker,restoreVersion:rollback,observed});
assert.equal(verifyRestoredExact518(input()).pass,true);
assert.equal(verifyRestoredExact518({...input(),trustedHash:'c'.repeat(64)}).pass,false);
assert.equal(verifyRestoredExact518({...input(),observed:{...observed,codeSha256:'c'.repeat(64)}}).pass,false);
assert.equal(verifyRestoredExact518({...input(),observed:{...observed,activeVersionId:old}}).pass,false);
assert.equal(verifyRestoredExact518({...input(),nowMs:nowMs+180000}).pass,false);
const wrong={...input(),signed:{...signed(),signature:'ZmFrZQ=='}};
assert.equal(verifyRestoredExact518(wrong).pass,false);
// Even perfect self-signed paper evidence cannot bypass an externally pinned
// GitHub trust hash that the report author does not control.
assert.equal(verifyTrustedReleaseProof518({...input(),live:null,
 trustedHash:'0'.repeat(64)}).code,
 'HOLD_518_AUDITOR_TRUST_SECRET_NOT_PINNED');
assert.equal(verifyTrustedReleaseProof518({...input(),live:null,
 trustedHash:undefined}).code,
 'HOLD_518_AUDITOR_TRUST_SECRET_NOT_PINNED');
assert.equal(verifyTrustedReleaseProof518({...input(),live:null}).pass,false,
 'a legitimate signing key still requires independently verified live account');
const release=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const controller=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
for(const secret of ['APP518_TRUSTED_AUDITOR_KEY_SHA256_518',
 'APP518_AUDITOR_PUBLIC_KEY_PEM_518','APP518_SIGNED_ACCOUNT_PROOF_518'])
 assert.ok(controller.includes(secret+': ${{ secrets.'+secret+' }}'),
  'release controller must source trust ONLY from GitHub secret');
assert.match(release,/--pre-restore',target.worker,approvedVersion/);
assert.match(release,/--post-restore',target.worker,version/);
let attempted=0;
await assert.rejects(observeLiveAccount518({request:async()=>{attempted++},
 token:'short'}),/HOLD_518_READONLY_CREDENTIALS_MISSING/);
assert.equal(attempted,0);
// Mock just the account inventory endpoint: unknown external Worker must
// fail before any credentials or data are modified.
const fake=async(url,options)=>{attempted++;assert.equal(options.method,'GET');
 assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'));
 return {ok:true,async json(){return {success:true,result:[
  {id:'soridraw-explore-api'},{id:'unknown-migration-writer'},
 ]}}};
};
await assert.rejects(observeLiveAccount518({request:fake,
 token:'local-test-token-not-real'}),/HOLD_518_ACCOUNT_SCRIPT_INVENTORY_MISMATCH/);
assert.equal(attempted,1);
console.log('APP518_RELEASE_CONTROLLER_PIN_FROM_GITHUB_SECRET=PASS');
console.log('APP518_PROTECTED_ROLLBACK_EXACT_CODE_BINDINGS_AND_SIGNATURE=PASS');
console.log('APP518_UNKNOWN_EXTERNAL_WORKER_AND_MISSING_TRUST_HOLD=PASS');
