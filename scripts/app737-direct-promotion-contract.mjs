// APP737: PREVIEW -> PRODUCTION direct promotion contract (TEST is untouched).
// Pure gate. No deployment, auth, network, data mutations or authorization bypass.
import {createHash} from 'node:crypto';
import {compareApp728Bindings} from './app728-binding-diff.mjs';

const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_ID=/^sites\/(soridraw-preview|soridraw)\/versions\/[A-Za-z0-9_-]{4,128}$/;
const isTrue=x=>x===true;
// No PREVIEW-only binding may be dropped by classification alone.
// These two derived resources have named, existing PRODUCTION alternatives.
const ENVIRONMENT_LOCAL_BINDINGS=Object.freeze({
 RATE_DB:{type:'d1',fallback:'LIKE_RATE_LIMITER',fallbackType:'ratelimit'},
 EXPLORE_CACHE:{type:'r2_bucket',fallback:'PROFILE_MEDIA',fallbackType:'r2_bucket'},
});
const ENVIRONMENT_IDENTITY_BINDINGS=Object.freeze({
 BOOTSTRAP_TOKEN:'plain_text',ENV_NAME:'plain_text',
 PROD_BASE:'plain_text',TARGET_BASE:'plain_text',
});
const reviewedBindingEvidence=p=>p?.evidenceVerified===true&&
 SHA64.test(String(p?.evidenceSha256||''))&&
 p?.sourceAndActiveRuntimeVerified===true;
// APP797 uses a production-specific authenticated ingress to the same owner
// service. A different binding name is not by itself evidence of equivalence.
// Accept only the known replaced bindings, pinned actual runtime and reviewed
// proof of the complete authenticated follow/RTDB/rollback behavior.
const APP797_REPLACED_BINDINGS=Object.freeze({
 SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547:'plain_text',
 SORIDRAW_OWNER_FOLLOW_BIND_544:'plain_text',
 SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:'plain_text',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'plain_text',
 SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:'secret_text',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'plain_text',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'secret_text',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'plain_text',
 SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669:'plain_text',
 SORIDRAW_PUBLIC_FOLLOW_READY_669:'plain_text',
 SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:'plain_text',
});
const app797OnHash=createHash('sha256').update('1').digest('hex');
function verifiedApp797Replacement({name,type,disposition,workers,gate}){
 if(APP797_REPLACED_BINDINGS[name]!==type||
    !reviewedBindingEvidence(disposition)||
    disposition.previewActiveVersion!==workers.previewExplore.activeVersion||
    disposition.productionActiveVersion!==workers.productionExplore.activeVersion||
    disposition.productionFeatureParityVerified!==true||
    disposition.independentAuthenticatedFollowAndRtdbVerified!==true||
    disposition.allUserScopeVerified!==true||
    disposition.oldClientAndRecoveryVerified!==true||
    disposition.dataAndCostSafetyVerified!==true||
    gate.exploreWorkerCodeAndFeatureFlags!==true||
    gate.functionsReceiverParity!==true||
    gate.firebaseRulesAndAuthAppCheck!==true||
    gate.productionEnvironmentAndLegacyBindingsCompatible!==true||
    gate.rollbackSnapshotAndRehearsalPass!==true||
    gate.costAndNoPassiveWritesVerified!==true)return false;
 const p=new Map(workers.previewExplore.bindings.map(b=>[b.name,b]));
 const d=new Map(workers.productionExplore.bindings.map(b=>[b.name,b]));
 const required=['SORIDRAW_OWNER_FOLLOW_PRODUCTION_797','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',
 'SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607',
 'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680'];
 if(!required.every(k=>d.get(k)?.type==='plain_text'&&d.get(k)?.plainHash===app797OnHash))return false;
 const a=p.get('OWNER_FOLLOW_RESERVATION_SERVICE_600'),b=d.get('OWNER_FOLLOW_RESERVATION_SERVICE_600');
 return a?.type==='service'&&b?.type==='service'&&
    a.service==='soridraw-owner-follow-preview-candidate'&&b.service===a.service&&
    a.serviceEnvironment===b.serviceEnvironment&&
    d.get('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')?.type==='secret_text';
}
// The shared notification store has exactly one authorized retention owner.
// PROD must not duplicate the PREVIEW maintenance cron or lose inbox access.
function verifiedSharedNotificationRetention({name,type,disposition,workers,gate}){
 if(name!=='SORIDRAW_NOTIFICATION_RETENTION_013'||type!=='plain_text'||
    !reviewedBindingEvidence(disposition)||
    disposition.previewActiveVersion!==workers.previewExplore.activeVersion||
    disposition.productionActiveVersion!==workers.productionExplore.activeVersion||
    disposition.sharedRetentionOwnerVerified!==true||
    disposition.authenticatedInboxParityVerified!==true||
    disposition.retentionPolicyAndCostVerified!==true||
    gate.exploreWorkerCodeAndFeatureFlags!==true||
    gate.firebaseRulesAndAuthAppCheck!==true||
    gate.productionEnvironmentAndLegacyBindingsCompatible!==true||
    gate.costAndNoPassiveWritesVerified!==true)return false;
 const p=workers.previewExplore,d=workers.productionExplore;
 const pm=new Map(p.bindings.map(b=>[b.name,b])),dm=new Map(d.bindings.map(b=>[b.name,b]));
 const on=(m,k)=>m.get(k)?.type==='plain_text'&&m.get(k)?.plainHash===app797OnHash;
 const identity=(m,value)=>m.get('SORIDRAW_ENVIRONMENT')?.type==='plain_text'&&
  m.get('SORIDRAW_ENVIRONMENT')?.plainHash===createHash('sha256').update(value).digest('hex');
 const cron='37 * * * *';
 const scheduleCount=w=>Array.isArray(w.schedules)?w.schedules.filter(x=>x.cron===cron).length:-1;
 return p.schedulesVerified===true&&d.schedulesVerified===true&&
  identity(pm,'preview')&&identity(dm,'production')&&
  on(pm,name)&&!dm.has(name)&&
  ['SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019']
   .every(k=>on(pm,k)&&on(dm,k))&&
  scheduleCount(p)===1&&scheduleCount(d)===0&&
  pm.get('DB')?.type==='d1'&&!!pm.get('DB')?.id&&pm.get('DB').id===dm.get('DB')?.id&&
  pm.get('PROFILE_MEDIA')?.type==='r2_bucket'&&!!pm.get('PROFILE_MEDIA')?.bucket&&
  pm.get('PROFILE_MEDIA').bucket===dm.get('PROFILE_MEDIA')?.bucket;
}
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function different(a,b){return a!==b}
function formatBindings(report){
  return {previewOnly:report.onlyPreview,productionOnly:report.onlyProduction,
    sharedCanonical:report.shared,changedTypes:report.changedTypes,
    changedTargets:report.changedTargets,anomalies:report.anomalies};
}
export function assessApp737DirectPromotion(input={}){
  const blockers=[];
  const hold=x=>blockers.push(x);
  const sha=input.previewSha;
  const source=input.source||{}, h=input.hosting||{}, w=input.workers||{};
  const gate=input.verification||{};
  const policies=input.bindingDisposition||{};
  const must=['previewExplore','productionExplore','previewMedia','productionMedia'];
  const workers=Object.fromEntries(must.map(k=>[k,w[k]||{}]));
  const prodBefore={};
  if(!SHA40.test(sha||'')||sha!==input.currentPreviewHead||
     source.previewSha!==sha)hold('EXACT_PREVIEW_SOURCE_NOT_PINNED');
  if(!SHA64.test(source.distSha256||'')||
     source.distSha256!==source.previewLiveDistSha256||
     !isTrue(source.noBuildTimeEnvironmentDrift))
    hold('EXACT_PREVIEW_HOSTING_ASSET_NOT_PROVEN');
  if(h.preview?.site!=='soridraw-preview'||h.production?.site!=='soridraw'||
     !VERSION_ID.test(String(h.preview?.version||''))||
     !VERSION_ID.test(String(h.production?.version||''))||
     !String(h.preview.version).startsWith('sites/soridraw-preview/versions/')||
     !String(h.production.version).startsWith('sites/soridraw/versions/'))
    hold('LIVE_HOSTING_ROLLBACK_VERSION_NOT_PINNED');
  if(!isTrue(h.sourceLiveMatchesPinnedBuild)||!isTrue(h.cloneHeadersAndCacheReviewed))
    hold('HOSTING_CLONE_COMPATIBILITY_NOT_PROVEN');
  for(const key of must){
    const value=workers[key];
    if(!UUID.test(value.activeVersion||'')||Number(value.trafficPercent)<99.99||
       !isTrue(value.pinnedBindingsVerified)||!isTrue(value.schedulesVerified))
       hold('ACTIVE_WORKER_VERSION_OR_BINDINGS_UNPROVEN_'+key);
    if(value.hasUnexpectedMigration)hold('WORKER_MIGRATION_UNSAFE_'+key);
    if(key.startsWith('production'))prodBefore[key]={
      version:value.activeVersion||null,
      bindingNamesAndTypes:fingerprint((value.bindings||[])
        .map(x=>x.name+':'+x.type).sort()),
      schedules:fingerprint(value.schedules||[]),
    };
  }
  let bindingDiff=null;
  if(must.every(key=>Array.isArray(workers[key].bindings))){
    const diff=compareApp728Bindings(workers.previewExplore,workers.productionExplore);
    bindingDiff=formatBindings(diff);
    for(const x of diff.anomalies)hold(x);
    if(diff.changedTypes.length)hold('BINDING_TYPE_CONFLICT');
    const productionBindings=new Map(workers.productionExplore.bindings.map(x=>[x.name,x]));
    const reviewedExclusions=[];
    for(const b of diff.onlyPreview){
      const [name,type]=b.split(':');
      const disposition=policies[name];
      const reviewed=reviewedBindingEvidence(disposition);
      if(disposition?.classification==='QA_ONLY'||disposition?.classification==='DIAGNOSTIC_ONLY'){
        // Never label a user-facing capability as "QA" to bypass a release gate.
        if(!reviewed||disposition.noUserFeatureDependencyVerified!==true)
          hold('NONPRODUCTION_BINDING_EXCLUSION_UNVERIFIED_'+name);
        else reviewedExclusions.push({name,classification:disposition.classification});
      }else if(disposition?.classification==='ENVIRONMENT_LOCAL'&&
          ENVIRONMENT_LOCAL_BINDINGS[name]?.type===type){
        const expected=ENVIRONMENT_LOCAL_BINDINGS[name];
        const replacement=productionBindings.get(expected.fallback);
        if(!reviewed||
           disposition.productionFallbackBinding!==expected.fallback||
           replacement?.type!==expected.fallbackType||
           disposition.productionFeatureParityVerified!==true||
           disposition.dataAndCostSafetyVerified!==true||
           gate.exploreWorkerCodeAndFeatureFlags!==true||
           gate.productionEnvironmentAndLegacyBindingsCompatible!==true||
           gate.costAndNoPassiveWritesVerified!==true)
          hold('ENVIRONMENT_LOCAL_BINDING_UNVERIFIED_'+name);
        else reviewedExclusions.push({name,classification:'ENVIRONMENT_LOCAL',
          productionFallback:expected.fallback});
      }else if(disposition?.classification==='ENVIRONMENT_IDENTITY'&&
          ENVIRONMENT_IDENTITY_BINDINGS[name]===type){
        if(!reviewed||
           disposition.noUserFeatureDependencyVerified!==true||
           disposition.productionConfigurationEquivalentVerified!==true||
           gate.exploreWorkerCodeAndFeatureFlags!==true||
           gate.productionEnvironmentAndLegacyBindingsCompatible!==true)
          hold('ENVIRONMENT_IDENTITY_BINDING_UNVERIFIED_'+name);
        else reviewedExclusions.push({name,classification:'ENVIRONMENT_IDENTITY'});
      }else if(disposition?.classification==='SHARED_NOTIFICATION_RETENTION'){
        if(!verifiedSharedNotificationRetention({name,type,disposition,workers,gate}))
          hold('SHARED_NOTIFICATION_RETENTION_UNVERIFIED_'+name);
        else reviewedExclusions.push({name,classification:'SHARED_NOTIFICATION_RETENTION',
          maintenanceOwner:'preview'});
      }else if(disposition?.classification==='APP797_PRODUCTION_INGRESS'){
        if(!verifiedApp797Replacement({name,type,disposition,workers,gate}))
          hold('APP797_PRODUCTION_INGRESS_UNVERIFIED_'+name);
        else reviewedExclusions.push({name,classification:'APP797_PRODUCTION_INGRESS',
          productionFallback:'SORIDRAW_OWNER_FOLLOW_PRODUCTION_797'});
      }else{
        // Functional bindings (follow, notifications, release) remain blocked
        // until their actual PROD behavior and receiver are independently proven.
        hold('PREVIEW_BINDING_NOT_ACCOUNTED_FOR_'+name);
      }
    }
    bindingDiff.reviewedExclusions=reviewedExclusions;
    for(const row of diff.changedTargets){
      if(row.name!=='SORIDRAW_ENVIRONMENT')hold('BINDING_TARGET_DRIFT_'+row.name);
    }
    for(const shared of diff.shared)
      if(!shared.presentInBoth||!shared.sameTarget)hold('SHARED_CANONICAL_BACKEND_DRIFT_'+shared.name);
  }else hold('WORKER_BINDING_INVENTORY_MISSING');
  const requiredChecks=[
    'exactFrontendSourceAndRoutes',
    'exploreWorkerCodeAndFeatureFlags',
    'mediaWorkerCodeAndRoutes',
    'functionsReceiverParity',
    'firebaseRulesAndAuthAppCheck',
    'allPreviewUserFeaturesInventoryComplete',
    'previewPcRealUsePass',
    'previewMobileRealUsePass',
    'productionExistingUserUpgradeCompatible',
    'productionEnvironmentAndLegacyBindingsCompatible',
    'rollbackSnapshotAndRehearsalPass',
    'costAndNoPassiveWritesVerified',
  ];
  for(const key of requiredChecks)if(gate[key]!==true)
    hold('PROMOTION_EVIDENCE_REQUIRED_'+key);
  const features=Array.isArray(input.featureMatrix)?input.featureMatrix:[];
  if(features.length===0||new Set(features.map(x=>x?.id)).size!==features.length||
     features.some(x=>!/^[a-z][a-z0-9_-]{1,60}$/.test(String(x?.id||''))))
    hold('COMPLETE_FEATURE_MATRIX_NOT_PROVIDED');
  for(const feature of features){
    if(feature?.previewPass!==true||feature?.productionEquivalentVerified!==true)
      hold('FEATURE_PARITY_NOT_PROVEN_'+String(feature?.id||'unknown'));
  }
  if(input.testEnvironmentTouched===true)hold('TEST_ENVIRONMENT_MODIFICATION_FORBIDDEN');
  if(input.sharedUserDataMutationRequested===true)hold('SHARED_USER_DATA_MUTATION_FORBIDDEN');
  if(input.productionBackendChangeApproved!==true&&input.productionBackendChangeRequired===true)
    hold('SHARED_BACKEND_CHANGE_REQUIRES_SEPARATE_APPROVAL');
  const result={
    kind:'APP737_PREVIEW_TO_PRODUCTION_DIRECT_PROMOTION',
    status:blockers.length?'HOLD':'READY_FOR_DIRECTOR_APPROVAL',
    productionDeploymentExecuted:false,
    executable:false,
    testEnvironmentTouched:false,
    exactPreviewSource:SHA40.test(sha||'')?sha:null,
    proposedOrder:[
      'freeze exact live PREVIEW artifact and all user feature proofs',
      'verify production canonical resources and preserve legacy bindings',
      'stage migration-safe Explore and Media Workers with immutable rollback targets',
      'verify candidate code, bindings, Functions, Rules, Auth/AppCheck and PC/mobile parity',
      'activate only separately approved backend changes after real QA and rollback rehearsal',
      'clone exact PREVIEW Hosting live version to PRODUCTION live with source drift gate',
      'verify PRODUCTION routes, PC/mobile upgrade and stored rollback versions',
    ],
    rollback:{
      hostingVersion:h.production?.version||null,
      workerVersions:prodBefore,
    },
    bindingInventory:bindingDiff,
    unproven:[...new Set(blockers)].sort(),
  };
  result.manifestSha256=fingerprint({
    previewSha:result.exactPreviewSource,
    source:source.distSha256,
    hosting:h,
    workers:prodBefore,
    previewWorkerVersions:Object.fromEntries(
      must.filter(x=>x.startsWith('preview')).map(x=>[x,workers[x].activeVersion||null])),
    bindingDisposition:Object.fromEntries(
      Object.keys(policies).sort().map(name=>[name,policies[name]])),
    verification:gate,
    features:features.map(x=>({
      id:x.id,previewPass:x.previewPass,productionEquivalentVerified:x.productionEquivalentVerified,
    })).sort((a,b)=>a.id.localeCompare(b.id)),
    blockers:result.unproven,
  });
  return result;
}
