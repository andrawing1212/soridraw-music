import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
// APP797 may account for known legacy PREVIEW flags only with complete,
// version-pinned independent proof. No production evidence is asserted here.
const with797=()=>{
 const x=make(),one='6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
 const sharedService={name:'OWNER_FOLLOW_RESERVATION_SERVICE_600',type:'service',
   service:'soridraw-owner-follow-preview-candidate'};
 x.workers.previewExplore.bindings.push(sharedService,
   {name:'SORIDRAW_OWNER_FOLLOW_HMAC_539',type:'secret_text'});
 x.workers.productionExplore.bindings.push({...sharedService},
   {name:'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600',type:'secret_text'});
 for(const name of ['SORIDRAW_OWNER_FOLLOW_PRODUCTION_797','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',
 'SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607',
 'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680']){
   const row={name,type:'plain_text',plainHash:one};
   x.workers.productionExplore.bindings.push(row);
   if(name!=='SORIDRAW_OWNER_FOLLOW_PRODUCTION_797')x.workers.previewExplore.bindings.push({...row});
 }
 x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539={
   classification:'APP797_PRODUCTION_INGRESS',evidenceVerified:true,evidenceSha256:sha,
   sourceAndActiveRuntimeVerified:true,previewActiveVersion:x.workers.previewExplore.activeVersion,
   productionActiveVersion:x.workers.productionExplore.activeVersion,productionFeatureParityVerified:true,
   independentAuthenticatedFollowAndRtdbVerified:true,allUserScopeVerified:true,
   oldClientAndRecoveryVerified:true,dataAndCostSafetyVerified:true};
 return x;
};
const sample797=with797();
assert.equal(assessApp737DirectPromotion(sample797).status,'READY_FOR_DIRECTOR_APPROVAL');
for(const mutate of [
 x=>{x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539.independentAuthenticatedFollowAndRtdbVerified=false},
 x=>{x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539.productionActiveVersion=v('f')},
 x=>{x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539.allUserScopeVerified=false},
 x=>{x.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539.oldClientAndRecoveryVerified=false},
 x=>{x.workers.productionExplore.bindings.find(b=>b.name==='SORIDRAW_OWNER_FOLLOW_PRODUCTION_797').plainHash='off'},
 x=>{x.workers.productionExplore.bindings.find(b=>b.name==='OWNER_FOLLOW_RESERVATION_SERVICE_600').service='wrong'},
 x=>{x.workers.productionExplore.bindings=x.workers.productionExplore.bindings.filter(b=>b.name!=='SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')},
 x=>{x.verification.costAndNoPassiveWritesVerified=false},
]){
 const x=with797();mutate(x);
 const result=assessApp737DirectPromotion(x);
 assert.equal(result.status,'HOLD');
 assert(result.unproven.includes('APP797_PRODUCTION_INGRESS_UNVERIFIED_SORIDRAW_OWNER_FOLLOW_HMAC_539'));
}
const unknown797=with797();
unknown797.workers.previewExplore.bindings.push({name:'UNKNOWN_FUNCTIONAL_FLAG',type:'plain_text'});
unknown797.bindingDisposition.UNKNOWN_FUNCTIONAL_FLAG={...unknown797.bindingDisposition.SORIDRAW_OWNER_FOLLOW_HMAC_539};
assert(assessApp737DirectPromotion(unknown797).unproven.includes('APP797_PRODUCTION_INGRESS_UNVERIFIED_UNKNOWN_FUNCTIONAL_FLAG'));
console.log('APP797_PINNED_PRODUCTION_INGRESS_CONTRACT=PASS_SYNTHETIC; LIVE_PROOF_REQUIRED');
// Single shared notification retention schedule is a functional maintenance
// alternative, not a QA exclusion. All live evidence remains mandatory.
const retentionName='SORIDRAW_NOTIFICATION_RETENTION_013';
const retentionCron='37 * * * *';
const withRetention=()=>{
 const x=make(),hash=value=>createHash('sha256').update(value).digest('hex');
 const p=x.workers.previewExplore,d=x.workers.productionExplore;
 p.bindings.find(b=>b.name==='SORIDRAW_ENVIRONMENT').plainHash=hash('preview');
 d.bindings.find(b=>b.name==='SORIDRAW_ENVIRONMENT').plainHash=hash('production');
 for(const name of ['SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019']){
  p.bindings.push({name,type:'plain_text',plainHash:hash('1')});
  d.bindings.push({name,type:'plain_text',plainHash:hash('1')});
 }
 p.bindings.push({name:retentionName,type:'plain_text',plainHash:hash('1')});
 p.schedules=[{cron:retentionCron}];
 x.bindingDisposition[retentionName]={
  classification:'SHARED_NOTIFICATION_RETENTION',evidenceVerified:true,evidenceSha256:sha,
  sourceAndActiveRuntimeVerified:true,previewActiveVersion:p.activeVersion,
  productionActiveVersion:d.activeVersion,sharedRetentionOwnerVerified:true,
  authenticatedInboxParityVerified:true,retentionPolicyAndCostVerified:true};
 return x;
};
const retained=assessApp737DirectPromotion(withRetention());
assert.equal(retained.status,'READY_FOR_DIRECTOR_APPROVAL',retained.unproven.join(','));
assert(retained.bindingInventory.reviewedExclusions.some(x=>x.name===retentionName&&x.maintenanceOwner==='preview'));
for(const mutate of [
 x=>{x.bindingDisposition[retentionName].authenticatedInboxParityVerified=false},
 x=>{x.bindingDisposition[retentionName].retentionPolicyAndCostVerified=false},
 x=>{x.bindingDisposition[retentionName].previewActiveVersion=v('f')},
 x=>{x.workers.previewExplore.schedules=[]},
 x=>{x.workers.productionExplore.schedules=[{cron:retentionCron}]},
 x=>{x.workers.previewExplore.bindings.find(b=>b.name===retentionName).plainHash='off'},
 x=>{x.workers.productionExplore.bindings.find(b=>b.name==='SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019').plainHash='off'},
 x=>{x.workers.productionExplore.bindings.find(b=>b.name==='DB').id='different'},
 x=>{x.verification.costAndNoPassiveWritesVerified=false},
]){
 const x=withRetention();mutate(x);
 const result=assessApp737DirectPromotion(x);
 assert.equal(result.status,'HOLD');
 assert(result.unproven.includes('SHARED_NOTIFICATION_RETENTION_UNVERIFIED_'+retentionName));
}
console.log('SHARED_NOTIFICATION_RETENTION_CONTRACT=PASS_SYNTHETIC; LIVE_PROOF_REQUIRED');
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
// APP751: convert 31 missing config entries into five review/evidence batches,
// while preserving every single binding's source/live proof and PROD HOLD.
const plan=triage.releaseBlockerPlan;
assert.equal(plan.status,'HOLD_NO_RELEASE_AUTHORITY');
assert.equal(plan.readOnly,true);
assert.equal(plan.totalMissingBindings,31);
assert.equal(plan.functionalBindingCount,25);
assert.equal(plan.environmentReviewCount,6);
assert.equal(plan.independentEvidenceBatches,5);
assert.deepEqual(plan.workstreams.map(x=>[x.key,x.count]),[
 ['follow',18],['release-endpoint',4],['notification',3],
 ['cache-cost',2],['environment-identity',4],
]);
assert.equal(plan.nextWorkstream,'follow');
assert.equal(plan.unknownBindingsOrEntries,0);
assert.equal(plan.legacyBindingsPreserved,true);
assert.equal(plan.workstreams[0].coverage,'APP749_ISOLATED_QA_AB_PC_MOBILE_PARTIAL_REUSE');
assert(plan.workstreams.every(x=>x.proofState==='HOLD_UNTIL_PRODUCTION_EVIDENCE'));
assert(plan.workstreams.every(x=>x.review==='REVIEW_ALL_BINDING_NAMES_AND_ACTIVE_CODE'));
assert.equal(plan.perBindingSourceAndActiveRuntimeProofStillRequired,true);
assert.equal(plan.allProductionFunctionAndRollbackProofStillRequired,true);
assert.equal(plan.noAutomaticExclusionOrActivation,true);
assert.equal(plan.productionDeployAuthorized,false);
const unknownTriage=summarizeApp737ProductionGaps({previewOnly:[
 'SORIDRAW_NEW_USER_FEATURE_FLAG:plain_text',
 'SORIDRAW_NEW_USER_FEATURE_FLAG:plain_text',
 '???:invalid',
]},prodLegacy);
assert.equal(unknownTriage.unknownCount,3);
assert.equal(unknownTriage.releaseBlockerPlan.unknownBindingsOrEntries,3);
assert.equal(unknownTriage.releaseBlockerPlan.independentEvidenceBatches,1);
assert.equal(unknownTriage.releaseBlockerPlan.nextWorkstream,'unclassified');
assert.equal(unknownTriage.productionDeploymentAllowed,false);
const removedMirror=summarizeApp737ProductionGaps({previewOnly:realPreviewOnly31},
 {productionExplore:{bindings:prodLegacy.productionExplore.bindings.slice(0,1)}});
assert.equal(removedMirror.productionLegacyServicesPreserved,false);
assert.equal(removedMirror.releaseBlockerPlan.legacyBindingsPreserved,false);
const noInventory=summarizeApp737ProductionGaps();
assert.equal(noInventory.productionDeploymentAllowed,false);
assert.equal(noInventory.productionLegacyServicesPreserved,false);
assert.equal(noInventory.releaseBlockerPlan.independentEvidenceBatches,0);
assert.equal(noInventory.releaseBlockerPlan.nextWorkstream,null);
console.log('APP742_ACTUAL_31_BINDING_WORKSTREAM_TRIAGE=PASS; NO_RELEASE_ELIGIBILITY_IMPLIED');
console.log('APP751_FIVE_EVIDENCE_BATCHES_25_FUNCTIONAL_6_ENVIRONMENTAL=PASS; PROD_HOLD');
