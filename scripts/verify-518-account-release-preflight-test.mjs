// app518 isolated trust/rollback tests: no Cloudflare, GitHub or data writes.
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyTrustedReleaseProof518,verifyRestoredExact518,observeLiveAccount518,
 normalizeLiveD1Bindings518}
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
assert.match(release,/HOLD_518_PROTECTED_RESTORE_ATOMIC_DEPLOY_FENCE_UNVERIFIED/);
assert.doesNotMatch(release,/--pre-restore',target.worker,approvedVersion/);
assert.doesNotMatch(release,/--post-compensate',target.worker/);
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
// P1 regression: old binding parser treated d1_database as NO D1 binding.
// The signed account cutover must never accept migration-inspect SOURCE_DB.
const realDb='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const withD1=type=>normalizeLiveD1Bindings518([
 {type,name:'SOURCE_DB',database_id:realDb},
]);
assert.deepEqual(withD1('d1').d1,withD1('d1_database').d1);
assert.equal(withD1('d1_database').d1[0].binding,'SOURCE_DB');
assert.throws(()=>normalizeLiveD1Bindings518([
 {type:'d1_database',name:'SOURCE_DB',database_id:'NOT_A_UUID'},
]),/HOLD_518_BAD_D1_ID/);
assert.throws(()=>normalizeLiveD1Bindings518([
 {type:'d1_worker_unknown',name:'SOURCE_DB',database_id:realDb},
]),/HOLD_518_UNKNOWN_D1_BINDING_TYPE/);
// Exercise the authenticated live-version reader through every API endpoint,
// not merely the normalization helper. Version-specific bindings and script
// settings both contain the same active SOURCE_DB type='d1_database'.
const seven=['soridraw-explore-api','soridraw-explore-preview',
 'soridraw-explore-test','soridraw-explore-migration-inspect',
 'soridraw-media','soridraw-media-preview','soridraw-media-test'];
const version='aaaabbbb-2222-4222-8222-123456789abc';
const mockRead=async(url,opts)=>{
 assert.equal(opts.method,'GET','read-only account probe');
 const path=new URL(url).pathname;
 const query=new URL(url).search;
 const target=seven.find(x=>path.includes('/'+x+'/'));
 const dbBinding=(path.includes('migration-inspect'))
  ?[{name:'SOURCE_DB',type:'d1_database',database_id:realDb}]:[];
 let result;
 if(path.endsWith('/workers/scripts'))result=seven.map(id=>({id}));
 else if(path.endsWith('/d1/database'))result=[
  {uuid:realDb},{uuid:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'},
  {uuid:'31817dbd-d06e-415e-9bc0-5553b0f5dc43'}];
 else if(path.endsWith('/deployments'))result={deployments:[{
  versions:[{version_id:version,percentage:100}],
 }]};
 else if(path.endsWith('/settings'))result={bindings:dbBinding};
 else if(path.endsWith('/versions/'+version)&&!query)result={
  resources:{bindings:dbBinding}};
 else if(path.endsWith('/versions/'+version)&&query.includes('include=modules'))
  result={id:version,modules:[{name:'index.js',content_type:'application/javascript',
   content_base64:Buffer.from('export default {fetch(){}}').toString('base64')}]};
 else throw Error('UNKNOWN_READONLY_ENDPOINT:'+path);
 return {ok:true,async json(){return {success:true,result}}};
};
const observedSnapshot=await observeLiveAccount518({
 request:mockRead,token:'isolated-readonly-test-token',
 rollbackVersionIds:seven.map(name=>({name,versionId:version})),
});
const migration=observedSnapshot.workers.find(x=>x.name.endsWith('migration-inspect'));
assert.deepEqual(migration.d1Bindings,[{binding:'SOURCE_DB',databaseId:realDb}]);
assert.deepEqual(observedSnapshot.rollbackVersions.find(x=>x.name===migration.name).d1Bindings,
 migration.d1Bindings);
// Even an independently valid signature must HOLD while the live inspector
// has SOURCE_DB. A properly signed report cannot redefine live D1 bindings.
const signedAccount={
 purpose:'APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER',releaseSha:sha,
 checkedAtMs:nowMs-1000,
 externalD1Access:{
  source:'INDEPENDENT_CLOUDFLARE_ACCOUNT_AND_USER_TOKEN_AUDIT',
  accountTokensEnumerated:true,userTokensEnumerated:true,
  serviceAccountsEnumerated:true,allDirectD1EditGrantsDisabled:true,
  unmanagedExternalWriters:0,checkedAtMs:nowMs-1000,
  evidenceRef:'independent-token-evidence-001',
 },
 ledger:{dbId:realDb,table:'music_note_catalog_daily_budget_518',
  atomicReservationVerified:true,schemaEvidenceRef:'independent-ledger-proof-001'},
 workers:observedSnapshot.workers.map(w=>({
  name:w.name,activeVersionId:w.active[0].versionId,bundleSha256:w.codeSha256,
  rollbackVersionId:version,rollbackBudgetAware:true,
  rollbackCodeSha256:w.codeSha256,
  rollbackSourceAuditRef:'independent-rollback-digest-001',
  rollbackDrainProofRef:'independent-rollback-drain-001',
  rollbackD1Bindings:[],budgetAware:w.name!==migration.name,
  state:w.name===migration.name?'RETIRED_NO_D1_BINDING':'BUDGET_AWARE',
  accountLedgerDbId:realDb,sourceApprovedAfterIndependentAudit:true,
  sourceAuditRef:'independent-source-digest-001',
  drainedOldFlightsRef:'independent-old-flights-001',
  d1Bindings:[],
 })),
};
const p1Payload=JSON.stringify(signedAccount);
const signedP1={payload:p1Payload,signature:sign(null,Buffer.from(p1Payload),privateKey).toString('base64')};
const p1=verifyTrustedReleaseProof518({signed:signedP1,publicKeyPem:pem,
 trustedHash:trusted,releaseSha:sha,live:observedSnapshot,
 nowMs,restoreWorker:worker,restoreVersion:version});
assert.equal(p1.code,'HOLD_518_MIGRATION_INSPECT_SOURCE_DB_STILL_BOUND');
console.log('APP518_P1_D1_DATABASE_MIGRATION_SOURCE_DB_LIVE_READER_HOLD=PASS');
console.log('APP518_RELEASE_CONTROLLER_PIN_FROM_GITHUB_SECRET=PASS');
console.log('APP518_PROTECTED_ROLLBACK_EXACT_CODE_BINDINGS_AND_SIGNATURE=PASS');
console.log('APP518_UNKNOWN_EXTERNAL_WORKER_AND_MISSING_TRUST_HOLD=PASS');
