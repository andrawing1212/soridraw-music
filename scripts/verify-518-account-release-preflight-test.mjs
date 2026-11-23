// app518 isolated trust/rollback tests: no Cloudflare, GitHub or data writes.
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyTrustedReleaseProof518,verifyRestoredExact518,observeLiveAccount518,
 normalizeLiveD1Bindings518}
 from './verify-518-account-release-preflight.mjs';
import {observeGitHubD1Sources518,exactGitHubD1SourceProof518,
 GITHUB_D1_SOURCE_PATHS_518}
 from './app518-external-d1-github-proof.mjs';
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
 codeSha256:'b'.repeat(64),d1Bindings:core.workers[0].rollbackD1Bindings,
 indirectBindings:[]};
core.workers[0].rollbackIndirectBindings=[];
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
const nine=['soridraw-explore-api','soridraw-explore-preview',
 'soridraw-explore-test','soridraw-explore-migration-inspect',
 'soridraw-media','soridraw-media-preview','soridraw-media-test',
 'soridraw-owner-follow-preview-candidate',
 'soridraw-owner558-proof-42959936171-1'];
const version='aaaabbbb-2222-4222-8222-123456789abc';
const mockRead=async(url,opts)=>{
 assert.equal(opts.method,'GET','read-only account probe');
 const path=new URL(url).pathname;
 const query=new URL(url).search;
 const target=nine.find(x=>path.includes('/'+x+'/'));
 const dbBinding=(path.includes('migration-inspect'))
  ?[{name:'SOURCE_DB',type:'d1_database',database_id:realDb}]:[];
 const indirect=target==='soridraw-owner-follow-preview-candidate'?
  [{name:'OWNER_FOLLOW_CANONICAL_REPLAY_600',type:'service',
    service:'soridraw-explore-preview'},
   {name:'OWNER_FOLLOW_DO_600',type:'durable_object_namespace'}]:
  target==='soridraw-owner558-proof-42959936171-1'?
   [{name:'OWNER558_DO',type:'durable_object_namespace'}]:[];
 let result;
 if(path.endsWith('/workers/scripts'))result=nine.map(id=>({id}));
 else if(path.endsWith('/d1/database'))result=[
  {uuid:realDb},{uuid:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'},
  {uuid:'31817dbd-d06e-415e-9bc0-5553b0f5dc43'}];
 else if(path.endsWith('/deployments'))result={deployments:[{
  versions:[{version_id:version,percentage:100}],
 }]};
 else if(path.endsWith('/settings'))result={bindings:[...dbBinding,...indirect]};
 else if(path.endsWith('/versions/'+version)&&!query)result={
  resources:{bindings:[...dbBinding,...indirect]}};
 else if(path.endsWith('/versions/'+version)&&query.includes('include=modules'))
  result={id:version,modules:[{name:'index.js',content_type:'application/javascript',
   content_base64:Buffer.from('export default {fetch(){}}').toString('base64')}]};
 else throw Error('UNKNOWN_READONLY_ENDPOINT:'+path);
 return {ok:true,async json(){return {success:true,result}}};
};
const observedSnapshot=await observeLiveAccount518({
 request:mockRead,token:'isolated-readonly-test-token',
 rollbackVersionIds:nine.map(name=>({name,versionId:version})),
});
const migration=observedSnapshot.workers.find(x=>x.name.endsWith('migration-inspect'));
assert.deepEqual(migration.d1Bindings,[{binding:'SOURCE_DB',databaseId:realDb}]);
assert.deepEqual(observedSnapshot.rollbackVersions.find(x=>x.name===migration.name).d1Bindings,
 migration.d1Bindings);
assert.equal(observedSnapshot.workers.length,9);
const follow=observedSnapshot.workers.find(x=>
 x.name==='soridraw-owner-follow-preview-candidate');
assert.equal(follow.d1Bindings.length,0);
assert.deepEqual(follow.indirectBindings,[
 {name:'OWNER_FOLLOW_CANONICAL_REPLAY_600',type:'service',
  service:'soridraw-explore-preview'},
 {name:'OWNER_FOLLOW_DO_600',type:'durable_object_namespace'},
]);
// Even an independently valid signature must HOLD while the live inspector
// has SOURCE_DB. A properly signed report cannot redefine live D1 bindings.
// The independent report and live GitHub observation are distinct objects.
const syntheticGithub=Object.fromEntries(['main','preview'].map((ref,i)=>[
 ref,{commitSha:String(i+1).repeat(40),sourceScopeSha256:'d'.repeat(64),
  knownD1Paths:GITHUB_D1_SOURCE_PATHS_518.map(path=>({
   path,blobSha:'e'.repeat(40)}))},
]));
observedSnapshot.gitHubD1Sources518=JSON.parse(JSON.stringify(syntheticGithub));
const signedAccount={
 purpose:'APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER',releaseSha:sha,
 checkedAtMs:nowMs-1000,
 externalD1Access:{
  source:'INDEPENDENT_CLOUDFLARE_ACCOUNT_AND_USER_TOKEN_AUDIT',
  accountTokensEnumerated:true,userTokensEnumerated:true,
  serviceAccountsEnumerated:true,allDirectD1EditGrantsDisabled:true,
  unmanagedExternalWriters:0,checkedAtMs:nowMs-1000,
  evidenceRef:'independent-token-evidence-001',
  gitHubDirectD1WorkflowsEnumerated:true,
  gitHubDirectD1PathsDisabledOrMetered:true,
  gitHubD1ExecutionAuditRef:'independent-github-d1-audit-001',
  gitHubD1Sources518:syntheticGithub,
 },
 ledger:{dbId:realDb,table:'music_note_catalog_daily_budget_518',
  atomicReservationVerified:true,schemaEvidenceRef:'independent-ledger-proof-001'},
 workers:observedSnapshot.workers.map(w=>({
  name:w.name,activeVersionId:w.active[0].versionId,bundleSha256:w.codeSha256,
  rollbackVersionId:version,rollbackBudgetAware:true,
  rollbackCodeSha256:w.codeSha256,
  rollbackSourceAuditRef:'independent-rollback-digest-001',
  rollbackDrainProofRef:'independent-rollback-drain-001',
  rollbackD1Bindings:[],rollbackIndirectBindings:w.indirectBindings,
  budgetAware:w.name!==migration.name&&!w.name.startsWith('soridraw-owner'),
  state:w.name===migration.name?'RETIRED_NO_D1_BINDING':
   w.name.startsWith('soridraw-owner')?'INDIRECT_ONLY_NO_D1':'BUDGET_AWARE',
  indirectPathsVerified:w.name.startsWith('soridraw-owner'),
  downstreamD1WritersMeteredVerified:w.name.startsWith('soridraw-owner'),
  indirectAuditRef:'independent-indirect-service-path-001',
  indirectBindings:w.indirectBindings,
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
// A fake repo transport tests strict GET-only source pinning and ref drift.
// These are synthetic 40-hex IDs; no actual GitHub writes or network.
const branchHeads={main:'a'.repeat(40),preview:'b'.repeat(40)};
const githubReads=[];
const githubReq=async(url,opts)=>{
 assert.equal(opts.method,'GET');
 const path=new URL(url).pathname,query=new URL(url).search;
 githubReads.push(path);
 let result;
 if(path.endsWith('/branches/main'))
  result={commit:{sha:branchHeads.main}};
 else if(path.endsWith('/branches/preview'))
  result={commit:{sha:branchHeads.preview}};
 else if(path.includes('/git/trees/')&&query==='?recursive=1')
  result={truncated:false,tree:[
   ...GITHUB_D1_SOURCE_PATHS_518.map((p,i)=>({
    path:p,type:'blob',sha:String(i+1).repeat(40)})),
   {path:'scripts/new-external-d1-handler.mjs',type:'blob',sha:'5'.repeat(40)},
  ]};
 else throw Error('UNEXPECTED_GITHUB_SOURCE_READ');
 return {ok:true,async json(){return result}};
};
const githubSources=await observeGitHubD1Sources518({
 request:githubReq,token:'isolated-mock-github-token'});
assert.equal(exactGitHubD1SourceProof518(githubSources,githubSources),true);
assert.equal(githubSources.main.knownD1Paths.length,4);
assert.equal(githubReads.length,6,'two heads, two trees and two drift checks');
assert.equal(exactGitHubD1SourceProof518({...githubSources,
 main:{...githubSources.main,commitSha:'c'.repeat(40)}},githubSources),false);
branchHeads.main='c'.repeat(40);
let moveReads=0;
await assert.rejects(observeGitHubD1Sources518({
 request:async(url,opts)=>{
  moveReads++;
  const r=await githubReq(url,opts);
  if(moveReads===1)branchHeads.main='d'.repeat(40);
  return r;
 },token:'isolated-mock-github-token',
}),/HOLD_518_GITHUB_CONTROLLER_REF_MOVED_main/);
console.log('APP518_ACCOUNT_NINE_WORKER_INDIRECT_LIVE_PROBE=PASS');
console.log('APP518_GITHUB_DIRECT_D1_BRANCH_AND_FILE_READONLY_PIN=PASS');
