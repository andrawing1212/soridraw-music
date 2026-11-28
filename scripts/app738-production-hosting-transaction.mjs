// APP738: exact pinned PREVIEW Hosting -> production transaction.
// Server mutations only after independently reviewed APP737 feature/back-end
// parity, director approval, exact source/dest snapshot and rollback readiness.
import {assessApp737DirectPromotion,app737SourcePinValid} from './app737-direct-promotion-contract.mjs';
import {execFileSync} from 'node:child_process';
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
// Check the actual Git tree, not a boolean supplied by an evidence file.
// The exact deployed source remains immutable; only approved non-runtime
// policy documents may differ from the separately pinned current head.
export function verifyApp738GitSourcePin({head,source,cwd}={}){
 if(!app737SourcePinValid(head,source))fail('INVALID_SOURCE_PROVENANCE');
 if(source.previewSha===head)return {deployedPreviewSha:head,pinnedPreviewHead:head};
 const git=(args)=>execFileSync('git',args,{cwd,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']});
 try{
  git(['merge-base','--is-ancestor',source.previewSha,head]);
  const changes=git(['diff','--name-status','--no-renames','--no-ext-diff','--no-textconv','-z',source.previewSha,head,'--']).split('\0');
  if(changes.pop()!==''||changes.length%2!==0)fail('DOC_HISTORY_DIFF_INVALID');
  const actual=[];
  for(let i=0;i<changes.length;i+=2){
   const [status,path]=changes.slice(i,i+2);
   if(!['A','M'].includes(status))fail('DOC_HISTORY_STATUS_UNSAFE');
   actual.push(path);
   const entry=git(['ls-tree','-z',head,'--',path]);
   if(!/^100644 blob [0-9a-f]{40}\t/.test(entry)||!entry.endsWith('\0')||entry.split('\0').length!==2)
    fail('DOC_HISTORY_NOT_REGULAR_FILE');
  }
  const declared=[...source.documentationOnlyAdvance.paths].sort();
  if(JSON.stringify(actual.sort())!==JSON.stringify(declared))fail('DOC_HISTORY_PATH_MISMATCH');
 }catch(error){
  if(String(error?.message).startsWith('APP738_PROMOTION_HOLD_'))throw error;
  fail('DOC_HISTORY_GIT_PROOF_UNAVAILABLE');
 }
 return {deployedPreviewSha:source.previewSha,pinnedPreviewHead:head,documentationOnlyAdvance:true};
}
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
    !app737SourcePinValid(previewSha,evidence.source))
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
async function postVerify(api,expected,expectedRelease,prior){
 for(let i=0;i<4;i++){
  const current=await api.live(SITES.production);
  if(current.version===expected&&current.release===expectedRelease)return current;
  if(current.version!==prior.version||current.release!==prior.release)
   fail('PRODUCTION_CONCURRENT_RELEASE_DETECTED');
 }
 fail('PRODUCTION_RELEASE_NOT_OBSERVED');
}
function releaseIdentity(ack,version){
 if(ack?.version?.name!==version||typeof ack?.name!=='string'||
    !ack.name.startsWith('sites/soridraw/releases/'))fail('RELEASE_ACK_UNVERIFIED');
 return ack.name;
}
export async function runApp738HostingPromotion({
 api,previewSha,evidence,approval,readCurrentPreviewSha,smokeProduction,
}={}){
 verifyApp738ReleaseGate({evidence,previewSha,approval,mode:'deploy'});
 if(!api||typeof api.clone!=='function'||typeof api.release!=='function'||
    typeof api.snapshotVersion!=='function'||typeof api.live!=='function')
   fail('HOSTING_API_NOT_VERIFIED');
 if(typeof smokeProduction!=='function')fail('REAL_PRODUCTION_SMOKE_REQUIRED');
 // A last-moment GET is not atomic with a Hosting release POST.
 // The real adapter holds until exclusive writer authority is proven.
 // Offline fixtures model isolated execution, not live exclusivity.
 if(typeof api.assertExclusiveReleaseAuthority!=='function'||
    await api.assertExclusiveReleaseAuthority()!==true)
   fail('PRODUCTION_EXCLUSIVE_WRITER_UNVERIFIED');
 const {source,before,configReview}=await inspectApp738Live({
   api,previewSha,evidence,readCurrentPreviewSha,
 });
 let cloned=null,releaseAttempted=false,ownedRelease=null;
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
  const ack=await api.release(cloned,'APP738 direct PREVIEW '+evidence.source.previewSha+' rollback='+id(before.version));
  ownedRelease=releaseIdentity(ack,cloned);
  if(ownedRelease===before.release){ownedRelease=null;fail('RELEASE_ACK_REUSED');}
  await postVerify(api,cloned,ownedRelease,before);
  const observed=await api.snapshotLive(SITES.production);
  if(observed.version!==cloned||observed.release!==ownedRelease||
     observed.filesSha256!==source.filesSha256||
     observed.configSha256!==before.configSha256)
    fail('POST_RELEASE_ASSET_PARITY');
  if(await smokeProduction({targetVersion:cloned,previewSha:evidence.source.previewSha,pinnedPreviewHead:previewSha})!==true)
    fail('PRODUCTION_LIVE_SMOKE_FAILED');
  const final=await api.live(SITES.production);
  if(final.version!==cloned||final.release!==ownedRelease)
    fail('PRODUCTION_CONCURRENT_RELEASE_DETECTED');
  return {status:'HOSTING_PROMOTION_PASS',sourcePreviewVersion:source.version,
    deployedPreviewSha:evidence.source.previewSha,pinnedPreviewHead:previewSha,
    releasedProductionVersion:cloned,rollbackProductionVersion:before.version,
    assetsMatched:true,settingsMatched:true,productionConfigPreserved:true,
    backendWasModified:false,testWasTouched:false};
 }catch(error){
  if(!releaseAttempted)throw error; // only an INACTIVE version may exist.
  let live=null;
  try{live=await api.live(SITES.production)}catch{}
  if(live?.version===before.version&&live?.release===before.release)
    throw Error('APP738_RELEASE_FAILED_OR_NOT_APPLIED; ORIGINAL_PRODUCTION_STILL_ACTIVE');
  // A version is not a release identity. If POST acknowledgement was lost,
  // or another release reused the same version, never overwrite it.
  if(!cloned||!ownedRelease||live?.version!==cloned||live?.release!==ownedRelease)
    throw Error('APP738_PRODUCTION_STATE_UNKNOWN_OR_CONCURRENT_RELEASE_MANUAL_HOLD');
  try{
   const rollbackAck=await api.release(before.version,'APP738 rollback to '+id(before.version));
   const restoredRelease=releaseIdentity(rollbackAck,before.version);
   if(restoredRelease===ownedRelease||restoredRelease===before.release)fail('ROLLBACK_ACK_REUSED');
   await postVerify(api,before.version,restoredRelease,{version:cloned,release:ownedRelease});
   const restored=await api.snapshotLive(SITES.production);
   if(restored.version!==before.version||restored.release!==restoredRelease||
      restored.filesSha256!==before.filesSha256||
      restored.configSha256!==before.configSha256)
     fail('ROLLBACK_CONTENT_IDENTITY_MISMATCH');
  }catch{
   throw Error('APP738_ROLLBACK_FAILED_MANUAL_HOLD');
  }
  throw Error('APP738_HOSTING_AUTOMATIC_ROLLBACK_PASS_AFTER_'+String(error?.message||'FAIL').replace(/[^A-Za-z0-9_]/g,'_').slice(0,90));
 }
}
