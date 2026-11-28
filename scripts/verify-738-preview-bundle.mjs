import assert from 'node:assert/strict';
import {inspectPendingHostingOutcome,reconcileHostingJournalCandidate} from './app738-hosting-writer-candidate.mjs';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {makePreviewBundle,inspectPreviewBundle,stagePreviewVersion,runPreviewBundleCandidate} from './app738-preview-bundle.mjs';
import {createApp738HostingApi} from './app738-firebase-hosting-runtime.mjs';
const sha='a'.repeat(40),configRaw='{}',config={headers:[]};
const triggerRaw='deploy_hosting=true\ndeploy_shared_rtdb_rules=false\nfunctions_deploy=false\nworker_deploy=false\nrelease_shared_d1_migration=false\nrelease_shared_user_data_change=false\nmain_test_change=false\nproduction_change=false';
const dir=mkdtempSync(join(tmpdir(),'app738-bundle-'));
let raw;
try{writeFileSync(join(dir,'index.html'),'hello');writeFileSync(join(dir,'app-version.json'),'{"version":"1"}');raw=makePreviewBundle({dir,sourceSha:sha,configRaw,triggerRaw});}finally{rmSync(dir,{recursive:true,force:true});}
const inputs={raw,sourceSha:sha,configRaw,triggerRaw},bundle=inspectPreviewBundle(inputs);
assert.equal(bundle.files.length,2);
assert.throws(()=>inspectPreviewBundle({...inputs,sourceSha:'b'.repeat(40)}),/PROVENANCE/);
assert.throws(()=>inspectPreviewBundle({...inputs,triggerRaw:triggerRaw.replace('functions_deploy=false','functions_deploy=true')}),/NOT_HOSTING_ONLY/);
const bad=JSON.parse(raw);bad.files[0].path='/../evil';assert.throws(()=>inspectPreviewBundle({...inputs,raw:JSON.stringify(bad)}),/FILE_IDENTITY/);
bad.files[0].path='/ok';bad.files[0].data='YWJj';assert.throws(()=>inspectPreviewBundle({...inputs,raw:JSON.stringify(bad)}),/FILE_BYTES/);
const version='sites/soridraw-preview/versions/newv';
let writes=[];
const request=async(method,path,body)=>{
 writes.push([method,path]);
 if(path==='sites/soridraw-preview/versions')return {name:version,status:'CREATED'};
 if(path===version+':populateFiles')return {uploadRequiredHashes:Object.values(body.files),uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/'+version+'/files'};
 return {name:version,status:'FINALIZED',config};
};
const uploads=[];
assert.equal(await stagePreviewVersion({bundle,config,request,upload:async(url,bytes)=>{uploads.push(url);assert.ok(gunzipSync(bytes).length);}}),version);
assert.equal(writes.length,3);assert.equal(uploads.length,2);
await assert.rejects(()=>stagePreviewVersion({bundle,config,request:async(m,p,b)=>p.endsWith(':populateFiles')?{uploadRequiredHashes:['c'.repeat(64)],uploadUrl:'https://evil.invalid'}:request(m,p,b),upload:async()=>{throw Error('must not upload')}}),/UPLOAD_HASH_SCOPE/);
const block=createApp738HostingApi('fake',{send:async()=>{throw Error('must not reach network')}});
await assert.rejects(()=>block.stagePreview(bundle,config),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
await assert.rejects(()=>block.releasePreview(version,'APP738 preview '+sha),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
const cfgHash=createHash('sha256').update(JSON.stringify(config)).digest('hex');
let state={schema:1,phase:'idle'},id='0'.repeat(40),n=0;
const journal={read:()=>({sha:id,state}),compareAppend:(expected,next)=>{assert.equal(expected,id);state=structuredClone(next);id=(++n).toString(16).padStart(40,'0');return id;}};
let live={site:'soridraw-preview',version:'sites/soridraw-preview/versions/oldv',release:'sites/soridraw-preview/releases/old',config,filesSha256:'c'.repeat(64),configSha256:cfgHash};
const api={assertExclusiveReleaseAuthority:async()=>true,snapshotLive:async()=>live,live:async()=>live,
 stagePreview:async()=>{assert.equal(state.phase,'pending');return version;},
 snapshotVersion:async()=>({site:'soridraw-preview',version,filesSha256:bundle.filesSha256,configSha256:cfgHash}),
 releasePreview:async()=>{assert.equal(state.phase,'pending');live={...live,version,release:'sites/soridraw-preview/releases/new',filesSha256:bundle.filesSha256};return {name:live.release,version:{name:version}};}};
const opts={journal,api,bundle,sourceSha:sha,readCurrentPreviewSha:async()=>sha,smoke:async()=>true};
// Independent audit regression 1: source changes after acquiring the
// lock but before any Hosting mutation. Only an exact, reviewed no-write
// outcome can release the pending journal (not an automatic timeout).
let stageCalls=0,releaseCalls=0;
const original=structuredClone(live);
const noWriteApi={...api,stagePreview:async()=>{stageCalls++;throw Error('unexpected staging');},
 releasePreview:async()=>{releaseCalls++;throw Error('unexpected release');}};
await assert.rejects(()=>runPreviewBundleCandidate({...opts,api:noWriteApi,readCurrentPreviewSha:async()=>'b'.repeat(40)}),/SOURCE_OR_BASELINE_CHANGED/);
assert.equal(stageCalls+releaseCalls,0);assert.equal(state.phase,'pending');
const record=journal.read(),report=inspectPendingHostingOutcome({record,observed:live});
assert.equal(report.outcome,'NO_HOSTING_WRITE_BASELINE_OBSERVED');
assert.equal(report.canAutoUnlock,false);
assert.equal(inspectPendingHostingOutcome({record:{...record,state:{...record.state,checkpointProtocol:1}},observed:live}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
assert.equal(inspectPendingHostingOutcome({record,observed:{...live,release:'sites/soridraw-preview/releases/foreign'}}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
const reviewRaw=JSON.stringify({kind:'APP738_JOURNAL_RECONCILIATION_V1',journalSha:record.sha,attempt:report.attempt,requestDigest:report.requestDigest,outcome:report.outcome,observed:report.observed});
const reconcile={journal,api:noWriteApi,reviewRaw,reviewSha256:createHash('sha256').update(reviewRaw).digest('hex'),approval:'RECONCILE_HOSTING_JOURNAL',verifyIndependentReview:async()=>true};
await assert.rejects(()=>reconcileHostingJournalCandidate({...reconcile,verifyIndependentReview:async()=>false}),/INDEPENDENT_TERMINAL_REVIEW_REQUIRED/);
assert.equal(state.phase,'pending');
assert.equal((await reconcileHostingJournalCandidate(reconcile)).hostingWrites,0);
assert.equal(state.phase,'idle');assert.equal(stageCalls+releaseCalls,0);
// Independent audit regression 2: a foreign release becomes active
// during the smoke test. No success and no automatic overwrite/unlock.
await assert.rejects(()=>runPreviewBundleCandidate({...opts,smoke:async()=>{
 live={...live,release:'sites/soridraw-preview/releases/foreign'};return true;
}}),/FINAL_LIVE_OUTCOME_DRIFT/);
assert.equal(state.phase,'pending');
assert.equal(inspectPendingHostingOutcome({record:journal.read(),observed:live}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
// Independent fixture reset only; no live journal reset path.
state={schema:1,phase:'idle'};live=structuredClone(original);
await runPreviewBundleCandidate(opts);assert.equal(state.phase,'idle');
await assert.rejects(()=>runPreviewBundleCandidate({...opts,api:{...api,stagePreview:async()=>{throw Error('unknown staging ACK')}}}),/unknown staging ACK/);
assert.equal(state.phase,'pending');
assert.equal(state.checkpoints.at(-1).kind,'stage-intent');
assert.equal(inspectPendingHostingOutcome({record:journal.read(),observed:live}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
let ran=0;await assert.rejects(()=>runPreviewBundleCandidate({...opts,api:{...api,stagePreview:async()=>{ran++}}}),/PENDING_OR_UNKNOWN_ATTEMPT/);assert.equal(ran,0);
const wf=readFileSync('.github/workflows/app738-hosting-writer.yml','utf8'),producer=readFileSync('.github/workflows/app738-preview-artifact.yml','utf8');
assert.ok(wf.indexOf('assertApp738ProductionWriteAuthority()')<wf.indexOf('google-github-actions/auth@'));
assert.ok(!producer.includes('id-token: write')&&!producer.includes('secrets.')&&!producer.includes('firebase deploy'));
assert.match(wf,/head_repository.id == 1188157610/);assert.match(wf,/github.event.workflow_run.path == '.github\/workflows\/app738-preview-artifact.yml'/);
console.log('APP738_PREVIEW_BUNDLE_UPLOAD_SCOPE_JOURNAL_AND_AUTH_HOLD=PASS_SYNTHETIC');

console.log('APP738_PREWRITE_REVIEWED_RECOVERY_AND_FINAL_RELEASE_DRIFT=PASS_SYNTHETIC');

assert.ok(wf.indexOf('assertApp738ProductionWriteAuthority()')<wf.indexOf('actions/create-github-app-token@'));
assert.ok(!wf.includes('contents: write'));
assert.match(wf,/app-id: '5968461'/);
assert.match(wf,/permission-contents: write/);
const proofJob=wf.slice(wf.indexOf('  journal-proof:'));
assert.ok(!proofJob.includes('google-github-actions/auth@')&&!proofJob.includes('id-token: write')&&!proofJob.includes('FIREBASE_ACCESS_TOKEN'));
assert.match(proofJob,/inputs.mode == 'journal-proof'/);
assert.match(proofJob,/node scripts\/app738-journal-app-proof.mjs/);
console.log('APP738_JOURNAL_APP_SCOPE_AND_PROOF_ISOLATION=PASS_SOURCE');
