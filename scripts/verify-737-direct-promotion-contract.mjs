import assert from 'node:assert/strict';
import {assessApp737DirectPromotion} from './app737-direct-promotion-contract.mjs';
const s='f'.repeat(40),sha='a'.repeat(64);
const v=id=>id.repeat(8)+'-1111-2222-3333-444444444444';
const base=(name,bindings)=>({
 name,activeVersion:v(name==='P'? 'a': 'b'),trafficPercent:100,
 pinnedBindingsVerified:true,schedulesVerified:true,schedules:[],
 compatibilityDate:'2026-08-28',bindings,hasUnexpectedMigration:false,
});
const shared=[
 {name:'DB',type:'d1',id:'qa-shared-canonical'},
 {name:'PROFILE_MEDIA',type:'r2_bucket',bucket:'qa-shared-media'},
 {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',plainHash:'x'},
];
const prodShared=shared.map(x=>x.name==='SORIDRAW_ENVIRONMENT'?{...x,plainHash:'y'}:{...x});
const worker=(value,b)=>({...base('P',b),activeVersion:v(value)});
const checks=[
'exactFrontendSourceAndRoutes','exploreWorkerCodeAndFeatureFlags',
'mediaWorkerCodeAndRoutes','functionsReceiverParity',
'firebaseRulesAndAuthAppCheck','allPreviewUserFeaturesInventoryComplete',
'previewPcRealUsePass','previewMobileRealUsePass',
'productionExistingUserUpgradeCompatible',
'productionEnvironmentAndLegacyBindingsCompatible',
'rollbackSnapshotAndRehearsalPass','costAndNoPassiveWritesVerified',
];
const make=()=>({
 previewSha:s,currentPreviewHead:s,
 source:{previewSha:s,distSha256:sha,previewLiveDistSha256:sha,
  noBuildTimeEnvironmentDrift:true},
 hosting:{
  preview:{site:'soridraw-preview',version:'sites/soridraw-preview/versions/abcde'},
  production:{site:'soridraw',version:'sites/soridraw/versions/qwert'},
  sourceLiveMatchesPinnedBuild:true,cloneHeadersAndCacheReviewed:true,
 },
 workers:{
  previewExplore:worker('a',[...shared,{name:'PREVIEW_QA_METRIC',type:'plain_text',plainHash:'z'}]),
  productionExplore:worker('b',[...prodShared,{name:'LEGACY_MIRROR',type:'service',service:'old'}]),
  previewMedia:worker('c',[]),productionMedia:worker('d',[]),
 },
 verification:Object.fromEntries(checks.map(x=>[x,true])),
 bindingDisposition:{PREVIEW_QA_METRIC:{classification:'QA_ONLY',evidenceVerified:true}},
 featureMatrix:[
  {id:'studio-prompt',previewPass:true,productionEquivalentVerified:true},
  {id:'music-note',previewPass:true,productionEquivalentVerified:true},
 ],
 testEnvironmentTouched:false,sharedUserDataMutationRequested:false,
 productionBackendChangeRequired:false,
});
const valid=assessApp737DirectPromotion(make());
assert.equal(valid.status,'READY_FOR_DIRECTOR_APPROVAL');
assert.equal(valid.executable,false);
assert.equal(valid.productionDeploymentExecuted,false);
assert.equal(valid.testEnvironmentTouched,false);
assert.equal(valid.unproven.length,0);
assert.equal(valid.bindingInventory.previewOnly.length,1);
assert.equal(valid.bindingInventory.productionOnly.length,1);
assert.deepEqual(valid.bindingInventory.sharedCanonical.map(x=>x.sameTarget),[true,true]);
assert.match(valid.manifestSha256,/^[0-9a-f]{64}$/);
const invalidCases=[
 [x=>{x.bindingDisposition={}},'PREVIEW_BINDING_NOT_ACCOUNTED_FOR_PREVIEW_QA_METRIC'],
 [x=>{x.workers.productionExplore.bindings[0].id='different'},'SHARED_CANONICAL_BACKEND_DRIFT_DB'],
 [x=>{x.workers.previewExplore.activeVersion='unknown'},'ACTIVE_WORKER_VERSION_OR_BINDINGS_UNPROVEN_previewExplore'],
 [x=>{x.currentPreviewHead='0'.repeat(40)},'EXACT_PREVIEW_SOURCE_NOT_PINNED'],
 [x=>{x.source.previewLiveDistSha256='b'.repeat(64)},'EXACT_PREVIEW_HOSTING_ASSET_NOT_PROVEN'],
 [x=>{x.featureMatrix[0].productionEquivalentVerified=false},'FEATURE_PARITY_NOT_PROVEN_studio-prompt'],
 [x=>{x.verification.previewMobileRealUsePass=false},'PROMOTION_EVIDENCE_REQUIRED_previewMobileRealUsePass'],
 [x=>{x.verification.functionsReceiverParity=false},'PROMOTION_EVIDENCE_REQUIRED_functionsReceiverParity'],
 [x=>{x.verification.rollbackSnapshotAndRehearsalPass=false},'PROMOTION_EVIDENCE_REQUIRED_rollbackSnapshotAndRehearsalPass'],
 [x=>{x.hosting.cloneHeadersAndCacheReviewed=false},'HOSTING_CLONE_COMPATIBILITY_NOT_PROVEN'],
 [x=>{x.workers.productionExplore.hasUnexpectedMigration=true},'WORKER_MIGRATION_UNSAFE_productionExplore'],
 [x=>{x.testEnvironmentTouched=true},'TEST_ENVIRONMENT_MODIFICATION_FORBIDDEN'],
 [x=>{x.sharedUserDataMutationRequested=true},'SHARED_USER_DATA_MUTATION_FORBIDDEN'],
 [x=>{x.productionBackendChangeRequired=true},'SHARED_BACKEND_CHANGE_REQUIRES_SEPARATE_APPROVAL'],
 [x=>{x.featureMatrix=[]},'COMPLETE_FEATURE_MATRIX_NOT_PROVIDED'],
];
for(const [mutate,reason] of invalidCases){
 const sample=make();mutate(sample);
 const result=assessApp737DirectPromotion(sample);
 assert.equal(result.status,'HOLD',reason);
 assert.equal(result.executable,false);
 assert(result.unproven.includes(reason),reason);
}
const unproven=assessApp737DirectPromotion({
 previewSha:s,currentPreviewHead:s,
 workers:make().workers,hosting:make().hosting,bindingDisposition:{},
});
assert.equal(unproven.status,'HOLD');
assert(unproven.unproven.some(x=>x.startsWith('PROMOTION_EVIDENCE_REQUIRED_')));
console.log('APP737_DIRECT_PREVIEW_PRODUCTION_RELEASE_CONTRACT=PASS; TEST_UNUSED; PROD_MUTATIONS=0');
