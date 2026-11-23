// One operator-approved Cloudflare Worker VERSION upload only (deploy=false).
// No worker deployment, new binding, DO migration, data access or traffic switch.
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {APP728_QUARANTINED_SOURCE_FILES,readPinnedProductionCode728,
 createApp728PreservedSourceCandidate,writeApp728CandidateToTemp}
 from './app728-production-source-candidate.mjs';
import {assessApp786InactiveOwnerConnections}
 from './app786-production-owner-connections.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-api';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{40}$/;
const fail=message=>{throw Error('APP737_INACTIVE_STAGE_HOLD_'+message)};
export const digest=buf=>createHash('sha256').update(buf).digest('hex');
const canonical=arr=>arr.map(b=>b.name+':'+b.type).sort().join('|');
export function makeInactiveVersionBody({oldVersion,oldSettings,candidateDir,pinnedVersion}={}){
 if(!UUID.test(oldVersion)||pinnedVersion?.id!==oldVersion)fail('EXACT_ACTIVE_VERSION_REQUIRED');
 const live=oldSettings?.bindings||[];
 const pinned=pinnedVersion?.bindings||[];
 if(live.length!==12||pinned.length!==12||new Set(live.map(b=>b.name)).size!==12||
    canonical(live)!==canonical(pinned))fail('ACTIVE_BINDING_LIST_DRIFT');
 const allowed=['DB:d1','PROFILE_MEDIA:r2_bucket',
  'EXPLORE_MIRROR_PREVIEW:service','EXPLORE_MIRROR_TEST:service',
  'EXPLORE_LIKE_BATCH_SCHEDULER:durable_object_namespace',
  'EXPLORE_MIRROR_TOKEN:secret_text'];
 for(const item of allowed)if(!canonical(pinned).split('|').includes(item))
  fail('ORIGINAL_BINDING_MISSING');
 const date=pinnedVersion.compatibility_date||oldSettings?.compatibility_date;
 const flags=pinnedVersion.compatibility_flags??oldSettings?.compatibility_flags??[];
 if(!/^20\d\d-\d\d-\d\d$/.test(date)||!Array.isArray(flags)||
   (pinnedVersion.compatibility_date&&oldSettings?.compatibility_date&&
     pinnedVersion.compatibility_date!==oldSettings.compatibility_date)||
   (pinnedVersion.compatibility_flags&&oldSettings?.compatibility_flags&&
     JSON.stringify(pinnedVersion.compatibility_flags)!==
       JSON.stringify(oldSettings.compatibility_flags)))
   fail('ACTIVE_RUNTIME_FLAGS_NOT_PINNED');
 const files=['production-main.mjs','production-follow-entry.mjs',
  ...readdirSync(join(candidateDir,'integration')).map(n=>'integration/'+n)];
 if(files.some(n=>n.includes('..')||!n.endsWith('.mjs')))fail('MODULE_LIST_INVALID');
 const modules=files.map(name=>{
  const content=readFileSync(join(candidateDir,name));
  if(!content.length||content.length>5_000_000)fail('MODULE_INVALID_'+name);
  return {name,content_type:'application/javascript+module',
   content_base64:content.toString('base64')};
 });
 const source=readFileSync(join(candidateDir,'production-follow-entry.mjs'),'utf8');
 const reportPath=join(candidateDir,'integration','app786-production-owner-connections.mjs');
 if(!files.includes('integration/app786-production-owner-connections.mjs')||
    !readFileSync(reportPath,'utf8').includes('APP786_PRODUCTION_OWNER_CONNECTIONS_COMPILED_OPEN=false'))
   fail('REVIEWED_18_CONNECTION_CANDIDATE_OFF_MODULE_MISSING');
 if(!source.includes("export * from './production-main.mjs'")||
    !source.includes('APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN')||
    !readFileSync(join(candidateDir,'integration/app729-production-follow-adapter.mjs'),'utf8')
     .includes('APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN = false'))
    fail('OFF_MODE_OR_DO_EXPORT_UNVERIFIED');
 return {main_module:'production-follow-entry.mjs',
  compatibility_date:date,
  compatibility_flags:flags,
  bindings:pinned.map(b=>({name:b.name,type:'inherit',version_id:oldVersion})),
  modules,annotations:{'workers/message':'APP737 approved inactive follow candidate - no traffic',
   'workers/tag':'app737-inactive-follow'}};
}
async function get(path,token){
 const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(20000)});
 if(!res.ok)fail('CLOUDFLARE_GET_HTTP_'+res.status);
 const body=await res.json();
 if(!body.success||!body.result)fail('CLOUDFLARE_GET_RESULT_INVALID');
 return body.result;
}
const versionPath=(id)=>'/workers/workers/'+WORKER+'/versions/'+id;
const deployPath='/workers/scripts/'+WORKER+'/deployments';
const activeId=(x)=>{
 const versions=x?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
    Number(versions[0]?.percentage)!==100||!UUID.test(versions[0].version_id))
  fail('ACTIVE_PRODUCTION_NOT_100_PERCENT');
 return versions[0].version_id;
};
async function main(){
 if(process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_ACTOR!==process.env.GITHUB_REPOSITORY_OWNER||
    process.env.APP737_STAGING_APPROVAL!=='STAGE_INACTIVE_ONLY')
   fail('OWNER_INACTIVE_APPROVAL_REQUIRED');
 const source=process.env.APP728_SOURCE_SHA||'';
 if(!SHA.test(source)||source!==process.env.APP728_LOCKED_PREVIEW_SHA)
  fail('PREVIEW_SOURCE_NOT_PINNED');
 const token=process.env.CLOUDFLARE_API_TOKEN||'';
 if(token.length<25)fail('CLOUDFLARE_TOKEN_MISSING');
 const baseline=await readPinnedProductionCode728(token);
 const pinned=await get(versionPath(baseline.activeVersion),token);
 // GET the exact active PREVIEW worker rather than trusting .toml, source
 // branch or a stale setting. No secret VALUE is read by the binding audit.
 const previewScript='soridraw-explore-preview';
 const previewDeploy='/workers/scripts/'+previewScript+'/deployments';
 const previewVersion=activeId(await get(previewDeploy,token));
 const [previewSettings,previewPinned]=await Promise.all([
  get('/workers/scripts/'+previewScript+'/settings',token),
  get('/workers/workers/'+previewScript+'/versions/'+previewVersion,token),
 ]);
 const previewBindings=previewPinned?.bindings||previewPinned?.resources?.bindings||[];
 if(previewBindings.length!==41||
    canonical(previewBindings)!==canonical(previewSettings?.bindings||[]))
   fail('PREVIEW_ACTIVE_41_BINDING_NAMES_TYPES_DRIFT');
 const coverage=assessApp786InactiveOwnerConnections({
  previewBindings,productionBindings:pinned.bindings,candidateBindings:pinned.bindings,
 });
 if(coverage.missingFollowConnections!==18||
    coverage.missingOtherConnections!==13||
    coverage.zeroTrafficCandidateAllowed!==true||
    coverage.productionReleaseAuthorized!==false)
   fail('OWNER_FOLLOW_18_RUNTIME_COVERAGE_UNVERIFIED');
 if(activeId(await get(deployPath,token))!==baseline.activeVersion)
   fail('ACTIVE_VERSION_MOVED_BEFORE_STAGE');
 const fileSource=resolve(process.env.APP728_SOURCE_DIR||'');
 const features=Object.fromEntries(APP728_QUARANTINED_SOURCE_FILES.map(name=>
  [name,readFileSync(join(fileSource,'cloudflare/explore-worker/runtime',name),'utf8')]));
 const candidate=createApp728PreservedSourceCandidate({
   baseline,featureSources:features,sourceSha:source,lockedPreviewSha:source});
 if(candidate.manifest.productionFollowSignalCompiledOpen!==false||
    candidate.manifest.unchangedProductionMain!==true)
   fail('CANDIDATE_SOURCE_UNSAFE');
 const root=join(resolve(process.env.RUNNER_TEMP||''),'app737-stage');
 mkdirSync(root,{recursive:true});
 const rendered=writeApp728CandidateToTemp(candidate,root);
 const body=makeInactiveVersionBody({
  oldVersion:baseline.activeVersion,oldSettings:baseline.settings,
  pinnedVersion:pinned,candidateDir:rendered.outputDirectory});
 if(activeId(await get(deployPath,token))!==baseline.activeVersion)
   fail('ACTIVE_VERSION_MOVED_BEFORE_UPLOAD');
 // Official beta version API: deploy=false, inherit EXACT active version bindings.
 const uri='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/workers/'+WORKER+'/versions?deploy=false';
 const response=await fetch(uri,{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok){
  const failed=await response.json().catch(()=>null);
  const codes=(failed?.errors||[]).map(e=>Number(e?.code)).filter(Number.isSafeInteger).slice(0,3);
  fail('VERSION_UPLOAD_HTTP_'+response.status+'_CODE_'+(codes.join('_')||'UNKNOWN'));
 }
 const result=await response.json();
 const candidateVersion=result?.result?.id;
 if(result.success!==true||!UUID.test(candidateVersion))
  fail('VERSION_UPLOAD_RESPONSE_INVALID');
 const after=await get(versionPath(candidateVersion),token);
 const rows=after.bindings||after.resources?.bindings||[];
 const expected=canonical(pinned.bindings);
 if(after.id!==candidateVersion||rows.length!==12||canonical(rows)!==expected)
  fail('INACTIVE_VERSION_BINDINGS_MISMATCH');
 if(activeId(await get(deployPath,token))!==baseline.activeVersion)
  fail('PRODUCTION_TRAFFIC_CHANGED_HOLD');
 console.log(JSON.stringify({status:'APP737_INACTIVE_VERSION_STAGED',
  productionTrafficPercentOnOldVersion:100,activeVersion:baseline.activeVersion,
  uploadedCandidateVersion:candidateVersion,bindingCount:rows.length,
  inheritedFromExactActive:true,sourceSha:source,
  liveDeploy:false,sharedUserDataWrites:0,testTouched:false,
  originalCodeSha256:digest(baseline.code),
  ownerFollowMissingInProd:coverage.missingFollowConnections,
  otherPreviewOnlyMissingInProd:coverage.missingOtherConnections,
  ownerFollowRequiredProofGroups:Object.keys(coverage.evidenceGroups),
  all18OwnerConnectionsRemainUnbound:true,
  actualNewServerResourcesCreated:0,
  prodFollowEnableAuthorized:false},null,2));
}
if(process.argv[1]?.endsWith('/app737-stage-inactive-production-follow.mjs'))
 main().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
