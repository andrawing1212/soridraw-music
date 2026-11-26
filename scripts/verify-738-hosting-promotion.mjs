import assert from 'node:assert/strict';
import {createApp738HostingApi,compareHostingArtifacts,reviewHostingCacheDifference} from './app738-firebase-hosting-runtime.mjs';
import {runApp738HostingPromotion,verifyApp738ReleaseGate} from './app738-production-hosting-transaction.mjs';
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
 unknownAfterFail=false,sourceMoved=false}={}){
 let current=OLD,releaseCount=0,cloneCount=0;
 const source=snap('soridraw-preview',SOURCE);
 const before=snap('soridraw',OLD,OF,OC,prodConfig);
 const candidate=snap('soridraw',NEW,filesMismatch?'wrong':source.filesSha256,before.configSha256,prodConfig);
 const events=[];
 const api={
 async snapshotLive(site){
  events.push('snapshot:'+site);
  if(site==='soridraw-preview')return source;
  if(current===NEW)return {...candidate,release:'sites/soridraw/releases/new'};
  return before;
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
  return {version:current,release:current===NEW?'sites/soridraw/releases/new':before.release};
 },
 async release(v,msg){
  assert.match(msg,/^APP738 /);releaseCount++;events.push('release:'+v);
  if(brokenRollback&&releaseCount===2)throw Error('rollback backend error');
  current=v;
  return {name:'sites/soridraw/releases/new',version:{name:v}};
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

// Actual API adapter: clone inactive, patch only the new CREATED version,
// preserve exact production config, then no release in this test.
assert.equal(reviewHostingCacheDifference(previewConfig,prodConfig).compatible,true);
assert.equal(reviewHostingCacheDifference({...previewConfig,rewrites:[]},prodConfig).compatible,false);
assert.equal(reviewHostingCacheDifference(previewConfig,{...prodConfig,headers:[security]}).compatible,false);
assert.equal(reviewHostingCacheDifference(previewConfig,{...prodConfig,headers:[{...security,headers:{'X-Content-Type-Options':'wrong'}},versionRule]}).compatible,false);
const drift=mock(), driftEvidence=evidence();
driftEvidence.hosting.preview.filesSha256='9'.repeat(64);
await assert.rejects(()=>runApp738HostingPromotion({...args,evidence:driftEvidence,api:drift.api}),/REVIEWED_HOSTING_DIGEST_DRIFT_OR_MISSING/);
assert.equal(drift.metrics().cloneCount,0);
const patchCalls=[];
const patchSend=async(uri,opts)=>{
 const p=new URL(uri); const body=opts.body?JSON.parse(opts.body):null;
 patchCalls.push({path:p.pathname,method:opts.method,body});
 let response;
 if(opts.method==='POST'&&p.pathname.endsWith('/versions:clone')){
  assert.deepEqual(body,{sourceVersion:SOURCE,finalize:false});
  response={name:'projects/soridraw/operations/clone1',done:true,response:{name:NEW}};
 }else if(opts.method==='GET'&&p.pathname.endsWith('/channels/live/releases')){
  response={releases:[{name:'sites/soridraw/releases/old',version:{name:OLD}}]};
 }else if(opts.method==='GET'&&p.pathname.endsWith('/newrelease')){
  response={name:NEW,status:'CREATED'};
 }else if(opts.method==='PATCH'&&p.pathname.endsWith('/newrelease')){
  assert.equal(p.searchParams.get('updateMask'),'config,status');
  assert.deepEqual(body,{config:prodConfig,status:'FINALIZED'});
  response={name:NEW,status:'FINALIZED',config:prodConfig};
 }else throw Error('unexpected call');
 return {ok:true,json:async()=>response};
};
const cacheApi=createApp738HostingApi('synthetic-test',{send:patchSend});
assert.equal(await cacheApi.clone(SOURCE,{productionConfig:prodConfig,rollbackVersion:OLD}),NEW);
assert.equal(patchCalls.filter(x=>x.method==='PATCH').length,1);
assert.equal(patchCalls.some(x=>x.method==='POST'&&x.path.endsWith('/releases')),false);
console.log('APP738_PRODUCTION_CACHE_POLICY_PRESERVED_AND_NON_CACHE_DRIFT_DENIED=PASS');
