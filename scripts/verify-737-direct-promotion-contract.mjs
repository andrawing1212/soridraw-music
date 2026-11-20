import assert from 'node:assert/strict';
import {assessApp737DirectPromotion} from './app737-direct-promotion-contract.mjs';
import {summarizeApp737ProductionGaps} from './app737-live-readiness.mjs';
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
const worker=(value,b)=>({...base('P',b.map(x=>({...x}))),activeVersion:v(value)});
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
 bindingDisposition:{PREVIEW_QA_METRIC:{classification:'QA_ONLY',evidenceVerified:true,
  evidenceSha256:sha,sourceAndActiveRuntimeVerified:true,
  noUserFeatureDependencyVerified:true}},
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
// Genuine environment-local differences are allowed only with pinned proof,
// known PRODUCTION fallback, cost/data safety and full runtime equivalence.
const withEnv=()=>{
 const x=make();
 x.workers.previewExplore.bindings.push(
  {name:'RATE_DB',type:'d1',id:'preview-only-cost'},
  {name:'EXPLORE_CACHE',type:'r2_bucket',bucket:'preview-only-derived'},
  {name:'ENV_NAME',type:'plain_text',plainHash:'preview-name'});
 x.workers.productionExplore.bindings.push(
  {name:'LIKE_RATE_LIMITER',type:'ratelimit',namespace_id:'production-limiter'});
 const review={evidenceVerified:true,evidenceSha256:sha,
  sourceAndActiveRuntimeVerified:true};
 x.bindingDisposition.RATE_DB={...review,classification:'ENVIRONMENT_LOCAL',
  productionFallbackBinding:'LIKE_RATE_LIMITER',productionFeatureParityVerified:true,
  dataAndCostSafetyVerified:true};
 x.bindingDisposition.EXPLORE_CACHE={...review,classification:'ENVIRONMENT_LOCAL',
  productionFallbackBinding:'PROFILE_MEDIA',productionFeatureParityVerified:true,
  dataAndCostSafetyVerified:true};
 x.bindingDisposition.ENV_NAME={...review,classification:'ENVIRONMENT_IDENTITY',
  noUserFeatureDependencyVerified:true,productionConfigurationEquivalentVerified:true};
 return x;
};
const provenEnv=assessApp737DirectPromotion(withEnv());
assert.equal(provenEnv.status,'READY_FOR_DIRECTOR_APPROVAL',provenEnv.unproven.join(','));
assert.deepEqual(provenEnv.bindingInventory.reviewedExclusions.map(x=>x.name),
 ['ENV_NAME','EXPLORE_CACHE','PREVIEW_QA_METRIC','RATE_DB']);
const envFailures=[
 [x=>{x.bindingDisposition.RATE_DB.evidenceVerified=false;},'ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_RATE_DB'],
 [x=>{x.bindingDisposition.RATE_DB.productionFallbackBinding='DB';},'ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_RATE_DB'],
 [x=>{x.workers.productionExplore.bindings=x.workers.productionExplore.bindings.filter(b=>b.name!=='LIKE_RATE_LIMITER');},'ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_RATE_DB'],
 [x=>{x.bindingDisposition.EXPLORE_CACHE.dataAndCostSafetyVerified=false;},'ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_EXPLORE_CACHE'],
 [x=>{x.bindingDisposition.ENV_NAME.noUserFeatureDependencyVerified=false;},'ENVIRONMENT_IDENTITY_BINDING_UNVERIFIED_ENV_NAME'],
 [x=>{x.bindingDisposition.PREVIEW_QA_METRIC.noUserFeatureDependencyVerified=false;},'NONPRODUCTION_BINDING_EXCLUSION_UNVERIFIED_PREVIEW_QA_METRIC'],
 [x=>{x.workers.previewExplore.bindings.push({name:'SORIDRAW_OWNER_FOLLOW_HMAC_539',type:'secret_text'});x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539={classification:'ENVIRONMENT_LOCAL',evidenceVerified:true};},'PREVIEW_BINDING_NOT_ACCOUNTED_FOR_SORIDRAW_OWNER_FOLLOW_HMAC_539'],
 [x=>{x.verification.costAndNoPassiveWritesVerified=false;},'ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_RATE_DB'],
];
for(const [mutate,reason] of envFailures){
 const x=withEnv();mutate(x);
 const r=assessApp737DirectPromotion(x);
 assert.equal(r.status,'HOLD',reason);
 assert(r.unproven.includes(reason),reason);
}
const alteredEvidence=withEnv();
alteredEvidence.bindingDisposition.RATE_DB.evidenceSha256='b'.repeat(64);
assert.notEqual(assessApp737DirectPromotion(alteredEvidence).manifestSha256,
 provenEnv.manifestSha256,'digest must cover the reviewed binding proof');
const unproven=assessApp737DirectPromotion({
 previewSha:s,currentPreviewHead:s,
 workers:make().workers,hosting:make().hosting,bindingDisposition:{},
});
assert.equal(unproven.status,'HOLD');
assert(unproven.unproven.some(x=>x.startsWith('PROMOTION_EVIDENCE_REQUIRED_')));
console.log('APP737_DIRECT_PREVIEW_PRODUCTION_RELEASE_CONTRACT=PASS; TEST_UNUSED; PROD_MUTATIONS=0');

const realPreviewOnly31=[
  'BOOTSTRAP_TOKEN:plain_text','ENV_NAME:plain_text','EXPLORE_CACHE:r2_bucket',
  'OWNER_FOLLOW_RESERVATION_SERVICE_600:service','PROD_BASE:plain_text',
  'RATE_DB:d1','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019:plain_text',
  'SORIDRAW_NOTIFICATION_RETENTION_013:plain_text',
  'SORIDRAW_NOTIFICATION_SCHEMA_READY_013:plain_text',
  'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:secret_text',
  'SORIDRAW_OWNER_DO_STANDALONE_600:plain_text',
  'SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547:plain_text',
  'SORIDRAW_OWNER_FOLLOW_BIND_544:plain_text',
  'SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:plain_text',
  'SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:plain_text',
  'SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:plain_text',
  'SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:secret_text',
  'SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:plain_text',
  'SORIDRAW_OWNER_FOLLOW_HMAC_539:secret_text',
  'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:plain_text',
  'SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:plain_text',
  'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:plain_text',
  'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET:secret_text',
  'SORIDRAW_PRIVATE_FINAL416_ENDPOINT:plain_text',
  'SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT:plain_text',
  'SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669:plain_text',
  'SORIDRAW_PUBLIC_FOLLOW_READY_669:plain_text',
  'SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:plain_text',
  'SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680:plain_text',
  'SORIDRAW_PUBLIC_RELEASE416_ENDPOINT:plain_text',
  'TARGET_BASE:plain_text',
];
const prodLegacy={productionExplore:{bindings:[
 {name:'EXPLORE_MIRROR_PREVIEW',type:'service'},
 {name:'EXPLORE_MIRROR_TEST',type:'service'},
]}};
const triage=summarizeApp737ProductionGaps({previewOnly:realPreviewOnly31},prodLegacy);
assert.equal(triage.status,'HOLD_NO_PRODUCTION_MUTATION');
assert.equal(triage.productionDeploymentAllowed,false);
assert.equal(triage.productionLegacyServicesPreserved,true);
assert.equal(triage.previewOnlyCount,31);
assert.equal(triage.classifiedCount,31);
assert.equal(triage.potentiallyUserFacingCount,25);
assert.equal(triage.productionLocalAndIdentityCount,6);
assert.equal(triage.unknownCount,0);
assert.deepEqual(Object.fromEntries(triage.evidencePriority.map(x=>[x.key,x.count])),{
 follow:18,notification:3,'release-endpoint':4,'cache-cost':2,'environment-identity':4,
});
assert(triage.evidencePriority.every(x=>x.independentProofRequired&&
 !x.canAutoExclude&&!x.canAutoInheritFromPreview));
const unknownTriage=summarizeApp737ProductionGaps({previewOnly:[
 'SORIDRAW_NEW_USER_FEATURE_FLAG:plain_text',
 'SORIDRAW_NEW_USER_FEATURE_FLAG:plain_text',
 '???:invalid',
]},prodLegacy);
assert.equal(unknownTriage.unknownCount,3);
assert.equal(unknownTriage.productionDeploymentAllowed,false);
const removedMirror=summarizeApp737ProductionGaps({previewOnly:realPreviewOnly31},
 {productionExplore:{bindings:prodLegacy.productionExplore.bindings.slice(0,1)}});
assert.equal(removedMirror.productionLegacyServicesPreserved,false);
const noInventory=summarizeApp737ProductionGaps();
assert.equal(noInventory.productionDeploymentAllowed,false);
assert.equal(noInventory.productionLegacyServicesPreserved,false);
console.log('APP742_ACTUAL_31_BINDING_WORKSTREAM_TRIAGE=PASS; NO_RELEASE_ELIGIBILITY_IMPLIED');
