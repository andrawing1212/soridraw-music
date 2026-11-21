// APP758: read-only PRODUCTION owner-follow compatibility and rollback checkpoint.
// This does not upload, deploy, switch flags, create resources, access users
// or turn APP755/756 OFF candidates into a live production release.
import {createHash} from 'node:crypto';
import {readWorker} from './app728-direct-preflight.mjs';
const PROJECT='soridraw-app-866a5';
const REGION='asia-northeast3';
const PROD='soridraw-explore-api';
const OWNER='soridraw-owner-follow-preview-candidate';
const FUNCS=[
 'enrollOwnerFollow544Candidate',
 'verifyOwnerFollowEpoch547Candidate',
 'publishExploreOwnerFollower542',
];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x||''));
const has=(w,n,t)=>w?.bindings?.some(b=>b.name===n&&b.type===t)===true;
export function assessApp758ProductionFollow({production,previewOwner,functions={},productionSourceSha,previewSourceSha}={}){
 const blockers=[];
 const block=x=>blockers.push(x);
 if(production?.name!==PROD||!uuid(production?.activeVersion)||
    production?.trafficPercent!==100)
  block('PRODUCTION_ACTIVE_EXPLORE_NOT_PINNED');
 if(production?.pinnedBindingsVerified!==true)
  block('PRODUCTION_ACTIVE_BINDING_IDENTITY_NOT_PROVEN');
 if(production?.schedulesVerified!==true)block('PRODUCTION_CRON_SNAPSHOT_NOT_PROVEN');
 // A production rollback is the previous exact ACTIVE version, not the
 // preview candidate, an inactive latest upload or a shared-data reset.
 const legacy=['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'];
 if(legacy.some(n=>!has(production,n,'service')))
  block('PRODUCTION_LEGACY_SERVICE_BINDING_NOT_PRESERVED');
 if(!has(production,'DB','d1')||!has(production,'PROFILE_MEDIA','r2_bucket'))
  block('PRODUCTION_SHARED_CANONICAL_BINDINGS_NOT_PROVEN');
 const ownerService=production?.bindings?.find(b=>b.name==='OWNER_FOLLOW_RESERVATION_SERVICE_600');
 if(!ownerService||ownerService.type!=='service')
  block('PRODUCTION_OWNER_SERVICE_ROUTE_NOT_PRESENT');
 // The known preview owner service must not be silently reused as a
 // production DO. Pinned DO class alone never proves alarm/replay success.
 if(previewOwner?.name!==OWNER||!uuid(previewOwner?.activeVersion)||
    previewOwner?.trafficPercent!==100||
    !has(previewOwner,'OWNER_FOLLOW_DO_600','durable_object_namespace')||
    !previewOwner.bindings.some(x=>x.name==='OWNER_FOLLOW_DO_600'&&
      x.class_name==='OwnerFollowerStandalone600'))
  block('PREVIEW_OWNER_REFERENCE_IDENTITY_UNPROVEN');
 const functionPins=FUNCS.map(name=>{
  const f=functions?.[name];
  if(f?.state!=='ACTIVE'||!f?.updatedAt||!f?.sourceIdentityHash)
    block('SHARED_FUNCTION_BUILD_PIN_MISSING_'+name);
  if(f?.previewOnly!==true||f?.generalPreviewEnabled!==true)
    block('SHARED_FUNCTION_EXISTING_PREVIEW_SCOPE_UNVERIFIED_'+name);
  return {name,state:f?.state||'UNKNOWN',updatedAt:f?.updatedAt||null,
    sourceIdentityHash:f?.sourceIdentityHash||null,
    previewOnly:f?.previewOnly===true,
    generalPreviewEnabled:f?.generalPreviewEnabled===true};
 });
 if(!/^[0-9a-f]{40}$/.test(productionSourceSha||'')||
    !/^[0-9a-f]{40}$/.test(previewSourceSha||''))
  block('GITHUB_BRANCH_SOURCE_SHA_NOT_PINNED');
 // Production has no approved owner DO/Functions release proof. Never treat
 // matching source filenames, Auth project, or a preview all-owner flag as
 // evidence of live PROD compatibility.
 block('PRODUCTION_OWNER_DO_ALARM_AND_REPLAY_NOT_VERIFIED');
 block('PRODUCTION_AUTH_APPCHECK_FUNCTION_RECEIVER_NOT_VERIFIED');
 block('PRODUCTION_FUNCTIONS_SHARED_PREVIEW_BOUNDARY_REQUIRES_SAFE_PARITY_PLAN');
 block('PRODUCTION_ROLLBACK_REHEARSAL_AND_PC_MOBILE_NOT_VERIFIED');
 return {
  code:'APP758_PRODUCTION_OWNER_FOLLOW_CHECKPOINT_GET_ONLY',
  status:'HOLD',deployAuthorized:false,readOnly:true,
  productionSourceSha:productionSourceSha||null,
  previewSourceSha:previewSourceSha||null,
  productionExplore:{
   activeVersion:uuid(production?.activeVersion)?production.activeVersion:null,
   activeTraffic100:production?.trafficPercent===100,
   bindingCount:production?.bindings?.length||0,
   legacyServiceBindingsPreserved:legacy.every(n=>has(production,n,'service')),
   activeBindingsPinned:production?.pinnedBindingsVerified===true,
   schedulesVerified:production?.schedulesVerified===true,
  },
  previewOwnerReference:{
   activeVersion:uuid(previewOwner?.activeVersion)?previewOwner.activeVersion:null,
   activeTraffic100:previewOwner?.trafficPercent===100,
   exactDoClassPresent:previewOwner?.bindings?.some(x=>
     x.name==='OWNER_FOLLOW_DO_600'&&
     x.type==='durable_object_namespace'&&
     x.class_name==='OwnerFollowerStandalone600')===true,
   // APP757 confirmed two extra APP713 settings-only keys. This drift is
   // NOT permission to delete/add them or alter the active owner Worker.
   settingsAndVersionDiffer:previewOwner?.pinnedBindingsVerified!==true,
   pinningMismatchPaths:previewOwner?.pinnedBindingMismatchPaths||[],
  },
  sharedFunctions:functionPins,
  immutableBefore:{
   productionExploreVersion:uuid(production?.activeVersion)?production.activeVersion:null,
   productionExploreBindingLabelsSha256:sha((production?.bindings||[]).
     map(x=>x.name+':'+x.type).sort()),
   productionExploreScheduleSha256:production?.schedulesVerified?sha(production.schedules||[]):null,
   functionRevisions:functionPins.map(x=>({name:x.name,updatedAt:x.updatedAt,
     sourceIdentityHash:x.sourceIdentityHash})),
   separateAuthenticatedRollbackSnapshotRequired:true,
   physicalRollbackRehearsalCompleted:false,
  },
  nextSafeWork:[
   'PIN_PRODUCTION_ACTIVE_CODE_AND_EXACT_RETURN_VERSION',
   'VERIFY_ALL_18_OWNER_FOLLOW_BINDINGS_AS_CAPABILITIES_NOT_COPY',
   'DESIGN_PRODUCTION_SEPARATE_OWNER_DO_AND_FUNCTION_SCOPE_WITHOUT_PREVIEW_REGRESSION',
   'PROVE_DURABLE_ALARM_SIGNED_OWNER_RTDB_AND_BOUNDED_COST',
   'VERIFY_PROD_ROLLBACK_WITHOUT_SHARED_DATA_RESET',
   'VERIFY_PRODUCTION_PC_MOBILE_BEFORE_RELEASE_APPROVAL',
  ],
  blockers:[...new Set(blockers)],userDataReads:0,externalWrites:0,
  sharedBackendMutations:0,testTouched:false,productionTouched:false,
 };
}
async function getFunction(name,token){
 const url='https://cloudfunctions.googleapis.com/v2/projects/'+PROJECT+
   '/locations/'+REGION+'/functions/'+encodeURIComponent(name);
 try{
  const res=await fetch(url,{method:'GET',redirect:'manual',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(15000)});
  if(res.status!==200)return {state:'UNREADABLE'};
  const f=await res.json();
  if(f.name!=='projects/'+PROJECT+'/locations/'+REGION+'/functions/'+name)
   return {state:'WRONG_RESOURCE'};
  const vars=f.serviceConfig?.environmentVariables||{};
  const source=f.buildConfig?.source?.storageSource;
  // No names/locations of source objects, user IDs, environmental values or
  // secret bindings are printed. A digest is a pin, not a backup artifact.
  const sourceIdentityHash=source?.bucket&&source?.object&&source?.generation?
   sha([source.bucket,source.object,String(source.generation)]):null;
  return {state:f.state,updatedAt:f.updateTime||null,sourceIdentityHash,
    previewOnly:vars.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only',
    generalPreviewEnabled:vars.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'};
 }catch{return {state:'UNREADABLE'}}
}
async function main(){
 if(process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_REF!=='refs/heads/main')
  throw Error('APP758_REQUIRES_MAIN_READONLY_CONTEXT');
 const prodSha=String(process.env.APP758_PROD_SHA||'');
 const prevSha=String(process.env.APP758_PREVIEW_SHA||'');
 if(!/^[0-9a-f]{40}$/.test(prodSha)||!/^[0-9a-f]{40}$/.test(prevSha))
  throw Error('APP758_PINNED_BRANCH_SHA_REQUIRED');
 const cf=String(process.env.CLOUDFLARE_API_TOKEN||'');
 const token=String(process.env.FIREBASE_ACCESS_TOKEN||'');
 if(cf.length<30||token.length<30)throw Error('APP758_AUTH_UNAVAILABLE');
 const [production,previewOwner,functions]=await Promise.all([
   readWorker(PROD,cf),
   readWorker(OWNER,cf),
   Promise.all(FUNCS.map(async name=>[name,await getFunction(name,token)])),
 ]);
 const report=assessApp758ProductionFollow({production,previewOwner,
  functions:Object.fromEntries(functions),productionSourceSha:prodSha,
  previewSourceSha:prevSha});
 console.log(JSON.stringify(report,null,2));
 console.log('APP758_PRODUCTION_OWNER_FOLLOW_READ_ONLY=PASS; RELEASE=HOLD; WRITES=0');
}
if(process.argv[1]?.endsWith('/app758-production-owner-follow-readonly.mjs')){
 main().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
}
