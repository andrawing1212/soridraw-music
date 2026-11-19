// APP737: actual PREVIEW/PRODUCTION runtime inventory; GET only, ALWAYS HOLD
// until real browser/feature/Functions evidence and immutable artifacts exist.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {assessApp737DirectPromotion} from './app737-direct-promotion-contract.mjs';
import {readWorker} from './app728-direct-preflight.mjs';
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
  blockers:readiness.unproven,
  action:'HOLD_NO_PRODUCTION_MUTATION',
 };
 console.log(JSON.stringify(publicResult,null,2));
 if(readiness.status!=='HOLD'||readiness.executable!==false)
  throw Error('APP737_READ_ONLY_RELEASE_NEVER_EXECUTABLE');
}
main().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
