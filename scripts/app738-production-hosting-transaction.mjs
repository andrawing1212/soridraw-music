// APP738: exact pinned PREVIEW Hosting -> production transaction.
// Server mutations only after independently reviewed APP737 feature/back-end
// parity, director approval, exact source/dest snapshot and rollback readiness.
import {assessApp737DirectPromotion} from './app737-direct-promotion-contract.mjs';
import {SITES,compareHostingArtifacts,reviewHostingCacheDifference} from './app738-firebase-hosting-runtime.mjs';
const SHA=/^[0-9a-f]{40}$/;
const fail=(reason)=>{throw Error('APP738_PROMOTION_HOLD_'+reason)};
const id=(name)=>String(name||'').split('/').pop();
const ESSENTIAL_FEATURES=Object.freeze([
 'studio-prompt','lyrics','suno-integration','music-note','library',
 'recent-songs','explore-feed','likes','following','public-sharing',
 'profile','login','media-playback','admin','pc-mobile-sync',
]);

const ok=x=>x===true;
export function verifyApp738ReleaseGate({
 evidence,previewSha,approval,mode='preflight',
}={}){
 if(!['preflight','deploy'].includes(mode))fail('INVALID_MODE');
 if(!SHA.test(String(previewSha||'')))fail('INVALID_PREVIEW_SHA');
 const verdict=assessApp737DirectPromotion(evidence);
 // APP737 "executable:false" is deliberate for its read-only endpoint; only
 // the separate owner-approved APP738 transaction can execute.
 if(verdict.status!=='READY_FOR_DIRECTOR_APPROVAL'||verdict.unproven.length)
   fail('APP737_FUNCTION_PARITY_NOT_VERIFIED');
 if(evidence.previewSha!==previewSha||evidence.currentPreviewHead!==previewSha||
    evidence.source?.previewSha!==previewSha)
   fail('PREVIEW_SOURCE_DRIFT');
 const matrix=new Map((evidence.featureMatrix||[]).map(x=>[x?.id,x]));
 for(const featureId of ESSENTIAL_FEATURES){
  const proof=matrix.get(featureId);
  if(proof?.previewPass!==true||proof?.productionEquivalentVerified!==true)
   fail('ESSENTIAL_USER_FEATURE_NOT_PROVEN_'+featureId);
 }
 if(mode==='deploy'&&approval!=='DEPLOY_PRODUCTION')
   fail('DIRECTOR_PRODUCTION_APPROVAL_REQUIRED');
 if(!ok(evidence.verification?.rollbackSnapshotAndRehearsalPass)||
    !ok(evidence.verification?.allPreviewUserFeaturesInventoryComplete)||
    !ok(evidence.verification?.previewPcRealUsePass)||
    !ok(evidence.verification?.previewMobileRealUsePass)||
    !ok(evidence.verification?.functionsReceiverParity))
   fail('RELEASE_EVIDENCE_INCOMPLETE');
 return {verdict,previewSha,mode};
}
export async function inspectApp738Live({
 api,previewSha,evidence,readCurrentPreviewSha,
}={}){
 verifyApp738ReleaseGate({evidence,previewSha});
 if(typeof readCurrentPreviewSha!=='function')fail('SOURCE_BRANCH_INSPECTOR_MISSING');
 if(await readCurrentPreviewSha()!==previewSha)fail('SOURCE_BRANCH_MOVED');
 const [source,before]=await Promise.all([
   api.snapshotLive(SITES.preview),api.snapshotLive(SITES.production),
 ]);
 if(source.version!==evidence.hosting.preview.version||
    before.version!==evidence.hosting.production.version)
   fail('PINNED_HOSTING_VERSION_CHANGED');
 if(!source.assetCount||!source.filesSha256||!source.configSha256||
    !before.assetCount||!before.filesSha256||!before.configSha256)
   fail('HOSTING_ASSET_OR_ROLLBACK_UNVERIFIED');
 const pinned=evidence.hosting;
 for(const [actual,expected] of [[source,pinned.preview],[before,pinned.production]]){
  if(!/^[0-9a-f]{64}$/.test(String(expected.filesSha256||''))||
     !/^[0-9a-f]{64}$/.test(String(expected.configSha256||''))||
     actual.filesSha256!==expected.filesSha256||actual.configSha256!==expected.configSha256)
    fail('REVIEWED_HOSTING_DIGEST_DRIFT_OR_MISSING');
 }
 const configReview=reviewHostingCacheDifference(source.config,before.config);
 if(!configReview.compatible)fail('HOSTING_NON_CACHE_CONFIG_DRIFT_OR_VERSION_POLICY');
 return {source,before,configReview};
}
async function postVerify(api,expected){
 for(let i=0;i<4;i++){
  const current=await api.live(SITES.production);
  if(current.version===expected)return current;
 }
 fail('PRODUCTION_RELEASE_NOT_OBSERVED');
}
export async function runApp738HostingPromotion({
 api,previewSha,evidence,approval,readCurrentPreviewSha,smokeProduction,
}={}){
 verifyApp738ReleaseGate({evidence,previewSha,approval,mode:'deploy'});
 if(!api||typeof api.clone!=='function'||typeof api.release!=='function'||
    typeof api.snapshotVersion!=='function'||typeof api.live!=='function')
   fail('HOSTING_API_NOT_VERIFIED');
 if(typeof smokeProduction!=='function')fail('REAL_PRODUCTION_SMOKE_REQUIRED');
 const {source,before,configReview}=await inspectApp738Live({
   api,previewSha,evidence,readCurrentPreviewSha,
 });
 let cloned=null,releaseAttempted=false;
 try{
  if(await readCurrentPreviewSha()!==previewSha)fail('SOURCE_CHANGED_BEFORE_CLONE');
  cloned=await api.clone(source.version,configReview.sameConfig?undefined:{
    productionConfig:before.config,rollbackVersion:before.version,
  });
  if(cloned===before.version)fail('CLONE_RETURNED_EXISTING_ROLLBACK_VERSION');
  const candidate=await api.snapshotVersion(cloned);
  const parity=compareHostingArtifacts(source,candidate);
  if(!parity.assetsMatch||candidate.configSha256!==before.configSha256)
    fail('CLONED_ASSET_OR_HOSTING_CONFIG_MISMATCH');
  // Do not let someone else's concurrent release get rolled back.
  const currentProd=await api.live(SITES.production);
  const currentPreview=await api.live(SITES.preview);
  if(currentProd.version!==before.version||currentProd.release!==before.release)
    fail('PRODUCTION_CONCURRENT_RELEASE_DETECTED');
  if(currentPreview.version!==source.version||currentPreview.release!==source.release||
     await readCurrentPreviewSha()!==previewSha)
    fail('PREVIEW_SOURCE_CHANGED_AFTER_CLONE');
  releaseAttempted=true;
  await api.release(cloned,'APP738 direct PREVIEW '+previewSha+' rollback='+id(before.version));
  await postVerify(api,cloned);
  const observed=await api.snapshotLive(SITES.production);
  if(observed.version!==cloned||
     observed.filesSha256!==source.filesSha256||
     observed.configSha256!==before.configSha256)
    fail('POST_RELEASE_ASSET_PARITY');
  if(await smokeProduction({targetVersion:cloned,previewSha})!==true)
    fail('PRODUCTION_LIVE_SMOKE_FAILED');
  return {status:'HOSTING_PROMOTION_PASS',sourcePreviewVersion:source.version,
    releasedProductionVersion:cloned,rollbackProductionVersion:before.version,
    assetsMatched:true,settingsMatched:true,productionConfigPreserved:true,
    backendWasModified:false,testWasTouched:false};
 }catch(error){
  if(!releaseAttempted)throw error; // only an INACTIVE version may exist.
  let live=null;
  try{live=await api.live(SITES.production)}catch{}
  if(live?.version===before.version)
    throw Error('APP738_RELEASE_FAILED_OR_NOT_APPLIED; ORIGINAL_PRODUCTION_STILL_ACTIVE');
  if(!cloned||live?.version!==cloned)
    throw Error('APP738_PRODUCTION_STATE_UNKNOWN_OR_CONCURRENT_RELEASE_MANUAL_HOLD');
  try{
   await api.release(before.version,'APP738 rollback to '+id(before.version));
   await postVerify(api,before.version);
   const restored=await api.snapshotLive(SITES.production);
   if(restored.filesSha256!==before.filesSha256||
      restored.configSha256!==before.configSha256)
     fail('ROLLBACK_CONTENT_IDENTITY_MISMATCH');
  }catch{
   throw Error('APP738_ROLLBACK_FAILED_MANUAL_HOLD');
  }
  throw Error('APP738_HOSTING_AUTOMATIC_ROLLBACK_PASS_AFTER_'+String(error?.message||'FAIL').replace(/[^A-Za-z0-9_]/g,'_').slice(0,90));
 }
}
