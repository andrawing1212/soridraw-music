import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runCommonHostingCandidate} from './app738-hosting-writer-candidate.mjs';
import {createApp738HostingApi,compareHostingArtifacts,reviewHostingCacheDifference} from './app738-firebase-hosting-runtime.mjs';
import {runApp738HostingPromotion,verifyApp738ReleaseGate,verifyApp738GitSourcePin} from './app738-production-hosting-transaction.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const SHA='f'.repeat(40),SUM='a'.repeat(64);
const PF='1'.repeat(64),PC='2'.repeat(64),OF='3'.repeat(64),OC='4'.repeat(64);
const security={glob:'**',headers:{'X-Content-Type-Options':'nosniff'}};
const versionRule={glob:'/app-version.json',headers:{'Cache-Control':'no-store, must-revalidate'}};
const prodConfig={headers:[security,versionRule],rewrites:[{glob:'**',path:'/index.html'}]};
const previewConfig={...prodConfig,headers:[{glob:'**',headers:{...security.headers,'Cache-Control':'no-store'}},versionRule]};
const SOURCE='sites/soridraw-preview/versions/preview507';
const OLD='sites/soridraw/versions/oldprod';
const NEW='sites/soridraw/versions/newrelease';
const worker=(id,bindings=[])=>({activeVersion:id,trafficPercent:100,
 pinnedBindingsVerified:true,schedulesVerified:true,schedules:[],bindings,hasUnexpectedMigration:false});
const shared=[{name:'DB',type:'d1',id:'shared'},{
 name:'PROFILE_MEDIA',type:'r2_bucket',bucket:'shared'}];
const srcEnv={name:'SORIDRAW_ENVIRONMENT',type:'plain_text',plainHash:'a'};
const prodEnv={...srcEnv,plainHash:'b'};
const checks=[
'exactFrontendSourceAndRoutes','exploreWorkerCodeAndFeatureFlags',
'mediaWorkerCodeAndRoutes','functionsReceiverParity',
'firebaseRulesAndAuthAppCheck','allPreviewUserFeaturesInventoryComplete',
'previewPcRealUsePass','previewMobileRealUsePass',
'productionExistingUserUpgradeCompatible','productionEnvironmentAndLegacyBindingsCompatible',
'rollbackSnapshotAndRehearsalPass','costAndNoPassiveWritesVerified',
];
const evidence=()=>({
 previewSha:SHA,currentPreviewHead:SHA,
 source:{previewSha:SHA,distSha256:SUM,previewLiveDistSha256:SUM,noBuildTimeEnvironmentDrift:true},
 hosting:{
 preview:{site:'soridraw-preview',version:SOURCE,filesSha256:PF,configSha256:PC},
 production:{site:'soridraw',version:OLD,filesSha256:OF,configSha256:OC},
 sourceLiveMatchesPinnedBuild:true,cloneHeadersAndCacheReviewed:true,
 },
 workers:{
 previewExplore:worker('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',[...shared,srcEnv]),
 productionExplore:worker('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',[...shared,prodEnv]),
 previewMedia:worker('cccccccc-cccc-cccc-cccc-cccccccccccc',[]),
 productionMedia:worker('dddddddd-dddd-dddd-dddd-dddddddddddd',[]),
 },
 verification:Object.fromEntries(checks.map(k=>[k,true])),
 featureMatrix:[
 ...[
 'studio-prompt','lyrics','suno-integration','music-note','library',
 'recent-songs','explore-feed','likes','following','public-sharing',
 'profile','login','media-playback','admin','pc-mobile-sync',
 ].map(id=>({id,previewPass:true,productionEquivalentVerified:true})),
 ],
 bindingDisposition:{},testEnvironmentTouched:false,sharedUserDataMutationRequested:false,
 productionBackendChangeRequired:false,
});
assert.equal(verifyApp738ReleaseGate({evidence:evidence(),previewSha:SHA}).verdict.status,
 'READY_FOR_DIRECTOR_APPROVAL');
await assert.throws(()=>verifyApp738ReleaseGate({
 evidence:evidence(),previewSha:SHA,mode:'deploy',approval:'NO',
}),/DIRECTOR_PRODUCTION_APPROVAL_REQUIRED/);
const uncovered=evidence();
uncovered.featureMatrix=uncovered.featureMatrix.filter(x=>x.id!=='lyrics');
assert.throws(()=>verifyApp738ReleaseGate({
 evidence:uncovered,previewSha:SHA,mode:'deploy',approval:'DEPLOY_PRODUCTION'
}),/ESSENTIAL_USER_FEATURE_NOT_PROVEN_lyrics/);
let bad=evidence();bad.verification.functionsReceiverParity=false;
assert.throws(()=>verifyApp738ReleaseGate({
 evidence:bad,previewSha:SHA,mode:'deploy',approval:'DEPLOY_PRODUCTION',
}),/APP737_FUNCTION_PARITY_NOT_VERIFIED/);

const snap=(site,version,files=PF,config=PC,serving=previewConfig)=>({
 site,version,assetCount:20,filesSha256:files,configSha256:config,config:serving,
 release:site==='soridraw'?'sites/soridraw/releases/old':'sites/soridraw-preview/releases/latest',
});
function mock({failSmoke=false,filesMismatch=false,concurrent=false,brokenRollback=false,
 unknownAfterFail=false,sourceMoved=false,ackLost=false,sameVersionConcurrent=false,exclusiveWriter=true}={}){
 let current=OLD,releaseCount=0,cloneCount=0,currentRelease='sites/soridraw/releases/old';
 const source=snap('soridraw-preview',SOURCE);
 const before=snap('soridraw',OLD,OF,OC,prodConfig);
 const candidate=snap('soridraw',NEW,filesMismatch?'wrong':source.filesSha256,before.configSha256,prodConfig);
 const events=[];
 const api={
 async assertExclusiveReleaseAuthority(){return exclusiveWriter;},
 async snapshotLive(site){
  events.push('snapshot:'+site);
  if(site==='soridraw-preview')return source;
  if(current===NEW)return {...candidate,release:currentRelease};
  return {...before,release:currentRelease};
 },
 async clone(v,options){assert.equal(v,SOURCE);assert.deepEqual(options,{productionConfig:prodConfig,rollbackVersion:OLD});cloneCount++;events.push('clone');return NEW;},
 async snapshotVersion(v){events.push('version:'+v);return v===NEW?candidate:before;},
 async live(site){
  events.push('live:'+site);
  if(site==='soridraw-preview')return {version:SOURCE,release:source.release};
  if(concurrent&&cloneCount>0&&releaseCount===0)
   return {version:'sites/soridraw/versions/outsider',release:'sites/soridraw/releases/out'};
  if(unknownAfterFail&&releaseCount===1&&current===NEW)
   return {version:'sites/soridraw/versions/outsider',release:'sites/soridraw/releases/out'};
  if(sameVersionConcurrent&&releaseCount===1&&current===NEW&&events.filter(e=>e==='live:soridraw').length>=3)
   return {version:NEW,release:'sites/soridraw/releases/foreign-same-version'};
  return {version:current,release:currentRelease};
 },
 async release(v,msg){
  assert.match(msg,/^APP738 /);releaseCount++;events.push('release:'+v);
  if(brokenRollback&&releaseCount===2)throw Error('rollback backend error');
  current=v;
  currentRelease=releaseCount===1?'sites/soridraw/releases/new':'sites/soridraw/releases/restored';
  if(ackLost&&releaseCount===1)throw Error('response lost after applied');
  return {name:currentRelease,version:{name:v}};
 },
 };
 return {api,events,metrics:()=>({releaseCount,cloneCount,current})};
}
const args={evidence:evidence(),previewSha:SHA,approval:'DEPLOY_PRODUCTION',
 readCurrentPreviewSha:async()=>SHA,smokeProduction:async()=>true};
const happy=mock();
const output=await runApp738HostingPromotion({api:happy.api,...args});
assert.equal(output.status,'HOSTING_PROMOTION_PASS');
assert.deepEqual(happy.metrics(),{releaseCount:1,cloneCount:1,current:NEW});
assert.equal(output.backendWasModified,false);
assert.equal(output.testWasTouched,false);
const noApproval=mock();
await assert.rejects(()=>runApp738HostingPromotion({...args,api:noApproval.api,approval:'not-approved'}),
 /DIRECTOR_PRODUCTION_APPROVAL_REQUIRED/);
assert.equal(noApproval.events.length,0);
const noSource=mock();
await assert.rejects(()=>runApp738HostingPromotion({...args,api:noSource.api,readCurrentPreviewSha:async()=>SHA.replace('f','e')}),
 /SOURCE_BRANCH_MOVED/);
assert.equal(noSource.events.includes('clone'),false);
const files=mock({filesMismatch:true});
await assert.rejects(()=>runApp738HostingPromotion({...args,api:files.api}),
 /CLONED_ASSET_OR_HOSTING_CONFIG_MISMATCH/);
assert.equal(files.metrics().releaseCount,0);
const conflict=mock({concurrent:true});
await assert.rejects(()=>runApp738HostingPromotion({...args,api:conflict.api}),
 /PRODUCTION_CONCURRENT_RELEASE_DETECTED/);
assert.equal(conflict.metrics().releaseCount,0);
const restored=mock({failSmoke:true});
await assert.rejects(()=>runApp738HostingPromotion({
 ...args,api:restored.api,smokeProduction:async()=>false,
}),/AUTOMATIC_ROLLBACK_PASS/);
assert.equal(restored.metrics().current,OLD);
assert.equal(restored.metrics().releaseCount,2);
const failRestore=mock({brokenRollback:true});
await assert.rejects(()=>runApp738HostingPromotion({
 ...args,api:failRestore.api,smokeProduction:async()=>false,
}),/ROLLBACK_FAILED_MANUAL_HOLD/);
const outOfBand=mock({unknownAfterFail:true});
await assert.rejects(()=>runApp738HostingPromotion({
 ...args,api:outOfBand.api,smokeProduction:async()=>false,
}),/STATE_UNKNOWN_OR_CONCURRENT_RELEASE/);
assert.equal(outOfBand.metrics().releaseCount,1,'never overwrite concurrent release');
const lost=mock({ackLost:true});
await assert.rejects(()=>runApp738HostingPromotion({...args,api:lost.api}),/STATE_UNKNOWN_OR_CONCURRENT_RELEASE/);
assert.equal(lost.metrics().releaseCount,1,'lost acknowledgement cannot authorize rollback');
const sameVersion=mock({sameVersionConcurrent:true});
await assert.rejects(()=>runApp738HostingPromotion({...args,api:sameVersion.api,smokeProduction:async()=>false}),/STATE_UNKNOWN_OR_CONCURRENT_RELEASE/);
assert.equal(sameVersion.metrics().releaseCount,1,'never rollback foreign release of same version');
console.log('APP738_RELEASE_ACK_AND_SAME_VERSION_CONCURRENT_ROLLBACK_FENCE=PASS');
// Without proof of exclusive execution the transaction cannot start.
const unproven=mock({exclusiveWriter:false});
await assert.rejects(()=>runApp738HostingPromotion({...args,api:unproven.api}),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
assert.deepEqual(unproven.events,[]);
assert.equal(unproven.metrics().releaseCount,0);
const missingGuard=mock();
delete missingGuard.api.assertExclusiveReleaseAuthority;
await assert.rejects(()=>runApp738HostingPromotion({...args,api:missingGuard.api}),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
assert.deepEqual(missingGuard.events,[]);

// Fake exact Hosting REST shows fileCount and config matching after pagination.
const calls=[];
const fakeSend=async(uri,opts)=>{
 calls.push({uri,method:opts.method});
 assert(uri.startsWith('https://firebasehosting.googleapis.com/v1beta1/'));
 assert.equal(opts.method,'GET','GET-only artifact inspection must never POST');
 const path=new URL(uri).pathname;
 const result=path.endsWith('/channels/live/releases')?
  {releases:[{name:'sites/soridraw-preview/channels/live/releases/abc',
   version:{name:SOURCE}}]}:
 path.endsWith('/files')?
  {files:[{path:'/index.html',hash:'A'.repeat(64),status:'ACTIVE'}]}:
  {name:SOURCE,status:'FINALIZED',config:{headers:[{glob:'**',headers:{'Cache-Control':'no-store'}}]},fileCount:'1'};
 return {ok:true,status:200,json:async()=>result};
};
const rest=createApp738HostingApi('synthetic-test',{send:fakeSend,sleep:async()=>{}});
const l=await rest.snapshotLive('soridraw-preview');
assert.equal(l.assetCount,1);
assert.match(l.filesSha256,/^[0-9a-f]{64}$/);
assert.equal(calls.length,4);
assert.throws(()=>compareHostingArtifacts(l,l),/ARTIFACT_SITE_WRONG/);
const brokenApi=createApp738HostingApi('synthetic-test',{send:async()=>({
 ok:false,status:403,json:async()=>({}),
})});
await assert.rejects(()=>brokenApi.snapshotLive('soridraw'),/API_GET_HTTP_403/);
console.log('APP738_HOSTING_PROD_APPROVAL_FENCE=PASS');
console.log('APP738_CLONE_FILE_CONFIG_PARITY_AND_CONCURRENCY=PASS');
console.log('APP738_HOSTING_ROLLBACK_REHEARSAL=PASS_SYNTHETIC');
console.log('APP738_TEST_PROD_SHARED_BACKEND_MUTATIONS=0; LIVE_DEPLOY=NOT_RUN');

// Prior clone/config fixture PASS is retained. Real transport is now
// read-only even with an injected sender; no credentials or option bypass.
assert.equal(reviewHostingCacheDifference(previewConfig,prodConfig).compatible,true);
assert.equal(reviewHostingCacheDifference({...previewConfig,rewrites:[]},prodConfig).compatible,false);
assert.equal(reviewHostingCacheDifference(previewConfig,{...prodConfig,headers:[security]}).compatible,false);
assert.equal(reviewHostingCacheDifference(previewConfig,{...prodConfig,headers:[{...security,headers:{'X-Content-Type-Options':'wrong'}},versionRule]}).compatible,false);
const drift=mock(), driftEvidence=evidence();
driftEvidence.hosting.preview.filesSha256='9'.repeat(64);
await assert.rejects(()=>runApp738HostingPromotion({...args,evidence:driftEvidence,api:drift.api}),/REVIEWED_HOSTING_DIGEST_DRIFT_OR_MISSING/);
assert.equal(drift.metrics().cloneCount,0);
const blockedCalls=[];
const blockedApi=createApp738HostingApi('synthetic-test',{send:async(uri,opts)=>{
 blockedCalls.push({uri,method:opts.method});
 throw Error('network must never be reached');
}});
await assert.rejects(()=>blockedApi.clone(SOURCE,{productionConfig:prodConfig,rollbackVersion:OLD}),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
await assert.rejects(()=>blockedApi.clone(SOURCE),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
await assert.rejects(()=>blockedApi.release(NEW,'APP738 direct PREVIEW '+SHA+' rollback=oldprod'),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
await assert.rejects(()=>blockedApi.release(OLD,'APP738 rollback to oldprod'),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
assert.deepEqual(blockedCalls,[],'no live activation, clone or rollback request');
await assert.rejects(()=>runApp738HostingPromotion({...args,api:blockedApi}),/PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
assert.deepEqual(blockedCalls,[]);
const directWorkflow=readFileSync('.github/workflows/app738-direct-hosting-promotion.yml','utf8');
const legacyWorkflow=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
for(const workflow of [directWorkflow,legacyWorkflow]){
 assert.match(workflow,/concurrency:\s*\n  group: soridraw-release-controller\n  cancel-in-progress: false/);
}
const directHold=directWorkflow.indexOf('APP738_PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED_HOLD');
assert.ok(directHold>=0&&directHold<directWorkflow.indexOf('Authenticate existing Firebase Hosting only'));
assert.ok(legacyWorkflow.indexOf('LEGACY_TEST_DISABLED_NO_TEST_POLICY')<legacyWorkflow.indexOf('node scripts/update-release-control-status.mjs create REQUESTED'));
const legacyHold=legacyWorkflow.indexOf('LEGACY_PRODUCTION_DISABLED_USE_APP738');
assert.ok(legacyHold>=0&&legacyHold<legacyWorkflow.indexOf('node scripts/update-release-control-status.mjs create REQUESTED'));
assert.match(legacyWorkflow,/if: failure\(\) && steps\.request\.outputs\.mode == 'test'/);
console.log('APP738_REAL_TRANSPORT_CLONE_ACTIVATION_ROLLBACK_BLOCKED_WITHOUT_EXCLUSIVE_WRITER=PASS');
console.log('APP738_SHARED_GITHUB_QUEUE_AND_LEGACY_PRODUCTION_FENCE=PASS_SOURCE');
console.log('APP738_PRODUCTION_CACHE_POLICY_PRESERVED_AND_NON_CACHE_DRIFT_DENIED=PASS');

// Actual local Git history: exact deployment identity survives only the
// explicitly reviewed policy-doc change, never code/config or hidden paths.
const repo=mkdtempSync(join(tmpdir(),'app738-source-pin-'));
try{
 const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-q');git('config','user.email','qa@example.invalid');git('config','user.name','QA');
 mkdirSync(join(repo,'DOCS'));mkdirSync(join(repo,'src'));
 writeFileSync(join(repo,'AGENTS.md'),'original\n');writeFileSync(join(repo,'src','app.js'),'original\n');
 git('add','.');git('commit','-qm','deployed source');const deployed=git('rev-parse','HEAD');
 writeFileSync(join(repo,'AGENTS.md'),'director policy\n');
 writeFileSync(join(repo,'DOCS','APP750_BIDIRECTIONAL_RELEASE_FLOW.md'),'release policy\n');
 git('add','.');git('commit','-qm','policy only');const docHead=git('rev-parse','HEAD');
 const source={previewSha:deployed,documentationOnlyAdvance:{fromSha:deployed,toSha:docHead,reviewed:true,paths:['AGENTS.md','DOCS/APP750_BIDIRECTIONAL_RELEASE_FLOW.md']}};
 assert.deepEqual(verifyApp738GitSourcePin({head:docHead,source,cwd:repo}),{deployedPreviewSha:deployed,pinnedPreviewHead:docHead,documentationOnlyAdvance:true});
 assert.throws(()=>verifyApp738GitSourcePin({head:docHead,source:{previewSha:deployed},cwd:repo}),/INVALID_SOURCE_PROVENANCE/);
 assert.throws(()=>verifyApp738GitSourcePin({head:docHead,source:{...source,documentationOnlyAdvance:{...source.documentationOnlyAdvance,paths:['AGENTS.md']}},cwd:repo}),/DOC_HISTORY_PATH_MISMATCH/);
 const e=evidence();e.previewSha=docHead;e.currentPreviewHead=docHead;Object.assign(e.source,source);
 assert.equal(verifyApp738ReleaseGate({evidence:e,previewSha:docHead}).verdict.exactPreviewSource,deployed);
 assert.equal(verifyApp738ReleaseGate({evidence:e,previewSha:docHead}).verdict.pinnedPreviewHead,docHead);
 const validDoc=mock();
 const result=await runApp738HostingPromotion({...args,api:validDoc.api,evidence:e,previewSha:docHead,readCurrentPreviewSha:async()=>docHead});
 assert.equal(result.deployedPreviewSha,deployed);assert.equal(result.pinnedPreviewHead,docHead);
 const wrong=evidence();wrong.source.previewSha=deployed;
 assert.throws(()=>verifyApp738ReleaseGate({evidence:wrong,previewSha:SHA}),/APP737_FUNCTION_PARITY_NOT_VERIFIED/);
 writeFileSync(join(repo,'src','app.js'),'changed app\n');git('add','.');git('commit','-qm','app change');
 const changed=git('rev-parse','HEAD');
 assert.throws(()=>verifyApp738GitSourcePin({head:changed,source:{...source,documentationOnlyAdvance:{...source.documentationOnlyAdvance,toSha:changed}},cwd:repo}),/DOC_HISTORY_PATH_MISMATCH/);
 git('checkout','--detach',deployed);writeFileSync(join(repo,'AGENTS.md'),'other branch\n');git('add','.');git('commit','-qm','not ancestor');
 const unrelated=git('rev-parse','HEAD');
 assert.throws(()=>verifyApp738GitSourcePin({head:docHead,source:{previewSha:unrelated,documentationOnlyAdvance:{fromSha:unrelated,toSha:docHead,reviewed:true,paths:['AGENTS.md']}},cwd:repo}),/DOC_HISTORY_GIT_PROOF_UNAVAILABLE/);
 assert.deepEqual(verifyApp738GitSourcePin({head:deployed,source:{previewSha:deployed},cwd:repo}),{deployedPreviewSha:deployed,pinnedPreviewHead:deployed});
}finally{rmSync(repo,{recursive:true,force:true})}
console.log('APP738_EXACT_DEPLOYED_SOURCE_AND_POLICY_ONLY_HEAD_ADVANCE=PASS');


// Common writer integration exercises real existing APP738 logic with
// isolated mocks only. Both modes share one durable journal contract.
const sum=x=>createHash('sha256').update(x).digest('hex');
function memoryJournal(){
 let state={schema:1,phase:'idle'},sha='0'.repeat(40),n=0;
 return {read:()=>({sha,state}),compareAppend(expected,next){
  assert.equal(expected,sha);state=structuredClone(next);sha=(++n).toString(16).padStart(40,'0');return sha;
 }};
}
const prodRaw=JSON.stringify({kind:'APP738_DIRECT_RELEASE_EVIDENCE_V1',reviewedForActualProductionDeployment:true,
 verifiedByIndependentQa:true,approvedPreviewSha:SHA,app737Evidence:evidence()});
const prodReq={mode:'production',site:'soridraw',sourceSha:SHA,filesSha256:PF,configSha256:OC,
 evidenceSha256:sum(prodRaw),approval:'DEPLOY_PRODUCTION',before:{version:OLD,release:'sites/soridraw/releases/old'}};
const cp=mock(),journal=memoryJournal();
const prodOptions={journal,api:cp.api,request:prodReq,evidenceRaw:prodRaw,
 readCurrentPreviewSha:async()=>SHA,smokeProduction:async()=>true};
const integrated=await runCommonHostingCandidate(prodOptions);
assert.equal(integrated.release,'sites/soridraw/releases/new');
assert.equal(journal.read().state.phase,'idle');
assert.deepEqual(journal.read().state.checkpoints.map(x=>x.kind),['baseline','release-intent','release-ack']);
assert.deepEqual(cp.metrics(),{releaseCount:1,cloneCount:1,current:NEW});
const rejected=mock(),rejectedJournal=memoryJournal();
await assert.rejects(()=>runCommonHostingCandidate({...prodOptions,journal:rejectedJournal,api:rejected.api,
 request:{...prodReq,evidenceSha256:'9'.repeat(64)}}),/EVIDENCE_DIGEST_MISMATCH/);
assert.equal(rejectedJournal.read().state.phase,'idle');
assert.equal(rejected.events.length,0);
await assert.rejects(()=>runCommonHostingCandidate({...prodOptions,journal:rejectedJournal,api:blockedApi}),
 /PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED/);
assert.equal(rejectedJournal.read().state.phase,'idle');
const badBaseline=mock(),badJournal=memoryJournal();
await assert.rejects(()=>runCommonHostingCandidate({...prodOptions,journal:badJournal,api:badBaseline.api,
 request:{...prodReq,before:{...prodReq.before,release:'sites/soridraw/releases/foreign'}}}),/BASELINE_DRIFT/);
assert.equal(badBaseline.metrics().releaseCount,0);
assert.equal(badJournal.read().state.phase,'pending');
const loss=mock({ackLost:true}),lostJournal=memoryJournal();
await assert.rejects(()=>runCommonHostingCandidate({...prodOptions,journal:lostJournal,api:loss.api}),/MANUAL_HOLD/);
assert.equal(lostJournal.read().state.phase,'pending');
assert.equal(lostJournal.read().state.checkpoints.at(-1).kind,'release-intent');
assert.equal(loss.metrics().releaseCount,1);
const previewTarget='sites/soridraw-preview/versions/newpreview';
const previewBefore={version:SOURCE,release:'sites/soridraw-preview/releases/latest'};
const previewRaw=JSON.stringify({kind:'APP738_FINALIZED_ARTIFACT_CANDIDATE_V1',mode:'preview',site:'soridraw-preview',
 sourceSha:SHA,version:previewTarget,filesSha256:PF,configSha256:PC,before:previewBefore});
const previewReq={mode:'preview',site:'soridraw-preview',sourceSha:SHA,targetVersion:previewTarget,
 filesSha256:PF,configSha256:PC,evidenceSha256:sum(previewRaw),before:previewBefore};
let pv=previewBefore,previewWrites=0;
const previewApi={
 assertExclusiveReleaseAuthority:async()=>true,
 snapshotLive:async()=>({...snap('soridraw-preview',pv.version),...pv}),
 snapshotVersion:async(v)=>snap('soridraw-preview',v),
 live:async()=>pv,
 releasePreview:async(v)=>{previewWrites++;pv={version:v,release:'sites/soridraw-preview/releases/next'};
  return {name:pv.release,version:{name:v}};},
 release:async()=>{throw Error('wrong production adapter');}
};
const previewOptions={journal:lostJournal,api:previewApi,request:previewReq,evidenceRaw:previewRaw,readCurrentPreviewSha:async()=>SHA};
await assert.rejects(()=>runCommonHostingCandidate(previewOptions),/PENDING_OR_UNKNOWN_ATTEMPT/);
assert.equal(previewWrites,0);
const previewJournal=memoryJournal();
await runCommonHostingCandidate({...previewOptions,journal:previewJournal});
assert.equal(previewWrites,1);assert.equal(previewJournal.read().state.phase,'idle');
const rollbackMock=mock(),rollbackJournal=memoryJournal();
const rollbackBefore={version:OLD,release:'sites/soridraw/releases/old'};
const rbRaw=JSON.stringify({kind:'APP738_FINALIZED_ARTIFACT_CANDIDATE_V1',mode:'rollback',site:'soridraw',
 sourceSha:SHA,version:NEW,filesSha256:PF,configSha256:OC,before:rollbackBefore});
await runCommonHostingCandidate({journal:rollbackJournal,api:rollbackMock.api,evidenceRaw:rbRaw,
 request:{mode:'rollback',site:'soridraw',sourceSha:SHA,targetVersion:NEW,filesSha256:PF,configSha256:OC,
 evidenceSha256:sum(rbRaw),approval:'ROLLBACK_PRODUCTION',before:rollbackBefore}});
assert.equal(rollbackMock.metrics().releaseCount,1);
assert.equal(rollbackJournal.read().state.phase,'idle');
console.log('APP738_COMMON_WRITER_EXISTING_PROD_TRANSACTION_AND_SCOPED_PREVIEW_ROLLBACK=PASS_SYNTHETIC');
console.log('APP738_COMMON_WRITER_EVIDENCE_BASELINE_AND_CROSS_SITE_UNKNOWN_HOLD=PASS_SYNTHETIC');
