// APP737: actual PREVIEW/PRODUCTION runtime inventory; GET only, ALWAYS HOLD
// until real browser/feature/Functions evidence and immutable artifacts exist.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessApp737DirectPromotion} from './app737-direct-promotion-contract.mjs';
import {readWorker} from './app728-direct-preflight.mjs';
import {classifyMissingBinding} from './app728-production-binding-candidate.mjs';
const QA_WORKERS={
 previewExplore:'soridraw-explore-preview',
 productionExplore:'soridraw-explore-api',
 previewMedia:'soridraw-media-preview',
 productionMedia:'soridraw-media',
};
const need=(name)=>{const v=String(process.env[name]||'').trim();if(!v)throw Error('APP737_MISSING_'+name);return v};
async function hosting(site,token){
 const uri='https://firebasehosting.googleapis.com/v1beta1/sites/'+site+'/channels/live/releases?pageSize=1';
 const r=await fetch(uri,{method:'GET',headers:{
  Authorization:'Bearer '+token,'Cache-Control':'no-store',
 }});
 if(!r.ok)throw Error('APP737_HOSTING_GET_FAILED_'+site+'_'+r.status);
 const payload=await r.json(),value=payload.releases?.[0];
 if(!value?.version?.name||!value?.name)throw Error('APP737_HOSTING_LIVE_VERSION_UNPROVEN_'+site);
 return {site,version:value.version.name,release:value.name};
}
async function versionAtPreview(){
 const r=await fetch('https://soridraw-preview.web.app/app-version.json',{
   method:'GET',headers:{'Cache-Control':'no-cache'},redirect:'error',
 });
 if(!r.ok)throw Error('APP737_PREVIEW_LIVE_VERSION_GET_FAILED');
 return String((await r.json()).version||'');
}
// APP742: group existing APP728 binding categories into actionable runtime
// parity workstreams. No decision to drop or copy a binding is made here.
// A deployed-name/type match, a source string, or a synthetic PASS alone
// never establishes that PREVIEW and PRODUCTION user features are equivalent.
const APP742_GROUPS=Object.freeze([
  ['follow','Owner follow/public follower sync',
   'Production canonical follow commit, durable receipt+retry, Firebase Auth/AppCheck, RTDB ordering, PC/mobile and cost proof'],
  ['notification','Notification inbox',
   'Owner-only authenticated inbox, exact user-visible activation and production origin/receiver proof'],
  ['release-endpoint','Likes and publication release',
   'Private/public likes and publication endpoints, signed Functions, receipt convergence and old-client compatibility proof'],
  ['cache-cost','Derived cache and rate limit',
   'Exact production-local replacement target, no passive writes, R2/D1 billing and data safety proof'],
  ['environment-identity','Environment identity/config',
   'Exact pinned runtime values and proof of unchanged user-facing feature behavior'],
  ['unclassified','Unclassified binding',
   'Explicit source+active runtime investigation; never auto-exclude or auto-copy'],
]);
export function summarizeApp737ProductionGaps(inventory={},workers={}){
  const rows=Array.isArray(inventory.previewOnly)?inventory.previewOnly:[];
  const groups=new Map(APP742_GROUPS.map(([key,title,evidence])=>
    [key,{key,title,evidenceRequired:evidence,bindings:[]}]));
  const invalid=[];
  const seen=new Set();
  for(const row of rows){
    const match=/^([A-Z][A-Z0-9_]{1,127}):(plain_text|secret_text|d1|r2_bucket|service|ratelimit|durable_object_namespace)$/.exec(String(row));
    if(!match||seen.has(match[1])){
      invalid.push('INVALID_OR_DUPLICATE_BINDING_NAME_TYPE');
      continue;
    }
    seen.add(match[1]);
    const group=classifyMissingBinding(match[1]);
    groups.get(group||'unclassified').bindings.push(row);
  }
  const prodRows=workers?.productionExplore?.bindings;
  const legacy=['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'];
  const prodLegacyPreserved=Array.isArray(prodRows)&&legacy.every(name=>
    prodRows.some(x=>x.name===name&&x.type==='service'));
  const workstreams=[...groups.values()].map(x=>({
    ...x,bindings:x.bindings.sort(),count:x.bindings.length,
    independentProofRequired:x.bindings.length>0,
    canAutoExclude:false,canAutoInheritFromPreview:false,
  }));
  // APP751: a short *evidence plan* instead of one manual test per binding.
  // Grouping does not waive proof that every source/live binding is handled.
  // Reuse APP749 only for isolated-QA A/B delivery; never promote that PASS
  // to production Auth/Functions/RTDB or all-user feature activation.
  const order=['follow','release-endpoint','notification','cache-cost',
    'environment-identity','unclassified'];
  const proofPlan=order.map((key,rank)=>{
    const item=workstreams.find(x=>x.key===key);
    return {priority:rank+1,key,count:item.count,
      review:'REVIEW_ALL_BINDING_NAMES_AND_ACTIVE_CODE',
      proof:item.evidenceRequired,
      coverage:key==='follow'?'APP749_ISOLATED_QA_AB_PC_MOBILE_PARTIAL_REUSE':
        'NO_LIVE_PRODUCTION_FEATURE_PROOF_RECORDED',
      proofState:'HOLD_UNTIL_PRODUCTION_EVIDENCE',
      separateBackendApprovalRequired:key==='follow'||key==='release-endpoint'||
        key==='notification',
    };
  }).filter(x=>x.count>0);
  const functional=['follow','release-endpoint','notification'];
  const environment=['cache-cost','environment-identity'];
  const releaseBlockerPlan={
    status:'HOLD_NO_RELEASE_AUTHORITY',readOnly:true,
    totalMissingBindings:rows.length,
    functionalBindingCount:proofPlan.filter(x=>functional.includes(x.key))
      .reduce((total,x)=>total+x.count,0),
    environmentReviewCount:proofPlan.filter(x=>environment.includes(x.key))
      .reduce((total,x)=>total+x.count,0),
    independentEvidenceBatches:proofPlan.length,
    nextWorkstream:proofPlan[0]?.key||null,
    workstreams:proofPlan,
    legacyBindingsPreserved:prodLegacyPreserved,
    unknownBindingsOrEntries:groups.get('unclassified').bindings.length+invalid.length,
    perBindingSourceAndActiveRuntimeProofStillRequired:true,
    allProductionFunctionAndRollbackProofStillRequired:true,
    noIndividualLiveJourneyPerFlagImplied:true,
    noAutomaticExclusionOrActivation:true,
    productionDeployAuthorized:false,
  };
  return {
    kind:'APP742_SOURCE_AND_ACTIVE_RUNTIME_PARITY_GAP_TRIAGE',
    status:'HOLD_NO_PRODUCTION_MUTATION',
    readOnly:true,productionDeploymentAllowed:false,
    previewOnlyCount:rows.length,
    classifiedCount:seen.size,
    potentiallyUserFacingCount:
      ['follow','notification','release-endpoint'].reduce((n,k)=>n+groups.get(k).bindings.length,0),
    productionLocalAndIdentityCount:
      ['cache-cost','environment-identity'].reduce((n,k)=>n+groups.get(k).bindings.length,0),
    unknownCount:groups.get('unclassified').bindings.length+invalid.length,
    productionLegacyServicesPreserved:prodLegacyPreserved,
    classificationIsNotActivationProof:true,
    noAutomaticReleaseExclusions:true,
    evidencePriority:workstreams.filter(x=>x.count>0),
    releaseBlockerPlan,
    invalid:invalid.length?[...new Set(invalid)]:[],
  };
}

async function main(){
 const sha=need('APP737_PREVIEW_SHA');
 const current=need('APP737_CURRENT_PREVIEW_SHA');
 if(sha!==current||!/^[0-9a-f]{40}$/.test(sha))
   throw Error('APP737_PREVIEW_HEAD_CHANGED');
 const token=need('CLOUDFLARE_API_TOKEN'),firebase=need('FIREBASE_ACCESS_TOKEN');
 const dist=need('APP737_DIST_SHA256');
 const [details,prev,prod,liveVersion]=await Promise.all([
  Promise.all(Object.entries(QA_WORKERS).map(async([key,name])=>[key,await readWorker(name,token)])),
  hosting('soridraw-preview',firebase),
  hosting('soridraw',firebase),
  versionAtPreview(),
 ]);
 const workers=Object.fromEntries(details);
 const appVersion=String(JSON.parse(readFileSync(join(need('APP737_SOURCE_ROOT'),'public/app-version.json'),'utf8')).version||'');
 const readiness=assessApp737DirectPromotion({
  previewSha:sha,currentPreviewHead:current,
  source:{previewSha:sha,distSha256:dist,
    // We cannot infer an entire deployed dist digest from index.html alone.
    previewLiveDistSha256:null,noBuildTimeEnvironmentDrift:false},
  hosting:{preview:prev,production:prod,
    sourceLiveMatchesPinnedBuild:false,cloneHeadersAndCacheReviewed:false},
  workers,bindingDisposition:{},featureMatrix:[],
  verification:{},testEnvironmentTouched:false,
  sharedUserDataMutationRequested:false,productionBackendChangeRequired:false,
 });
 const publicResult={
  scope:'APP737_LIVE_READ_ONLY_DIRECT_PREVIEW_TO_PRODUCTION_READINESS',
  status:readiness.status,notTestFlow:true,neverDeploy:true,
  currentSourceSha:sha,appVersion,livePreviewAppVersion:liveVersion,
  sourceVersionMatchesPreview:appVersion===liveVersion,
  previewHosting:{version:prev.version},
  productionHosting:{rollbackVersion:prod.version},
  workerVersions:Object.fromEntries(Object.entries(workers).map(([k,x])=>[
    k,{activeVersion:x.activeVersion,bindingCount:x.bindings?.length||0,
      pinnedBindingsVerified:x.pinnedBindingsVerified,
      schedulesVerified:x.schedulesVerified},
  ])),
  bindingInventory:readiness.bindingInventory,
  // Workstream counts refer to missing connections, NOT active features.
  // The original release gate remains the sole HOLD decision.
  productionGapTriage:summarizeApp737ProductionGaps(readiness.bindingInventory,workers),
  blockers:readiness.unproven,
  action:'HOLD_NO_PRODUCTION_MUTATION',
 };
 console.log(JSON.stringify(publicResult,null,2));
 if(readiness.status!=='HOLD'||readiness.executable!==false)
  throw Error('APP737_READ_ONLY_RELEASE_NEVER_EXECUTABLE');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
}
