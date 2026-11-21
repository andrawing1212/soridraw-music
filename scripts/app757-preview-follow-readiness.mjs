// APP757: canary PREVIEW follow backend live metadata ONLY.
// Source-only metadata check, not a rollout. Never requests user data, RTDB
// values, migrations, secrets, or Worker/Functions/Rules mutations.
import {createHash} from 'node:crypto';
import {readWorker} from './app728-direct-preflight.mjs';
const PROJECT='soridraw-app-866a5';
const PREVIEW='soridraw-explore-preview';
const REGION='asia-northeast3';
const RTDB_RULES_URL='https://soridraw-app-866a5-default-rtdb.firebaseio.com/.settings/rules.json';
const FUNCTIONS=['enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate',
 'publishExploreOwnerFollower542'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const need=(key)=>{
 const value=String(process.env[key]||'').trim();
 if(value.length<30)throw Error('APP757_REQUIRED_CREDENTIAL_UNAVAILABLE_'+key);
 return value;
};
// The exact shared RTDB instance is pinned in src/firebase.js, functions/src/index.ts
// and the existing PREVIEW hosting RTDB rules workflow. No instance enumeration.
const okBinding=(worker,name,type)=>worker?.bindings?.some(x=>x.name===name&&x.type===type);
const names=worker=>(worker?.bindings||[]).map(x=>x.name);
export function assessApp757CanaryReadiness({worker,functions,rtDb,gitRulesNode,
  sourceHeadPinned}={}){
 const blockers=[];
 const add=x=>blockers.push(x);
 if(!sourceHeadPinned)add('PREVIEW_SOURCE_NOT_PINNED');
 if(worker?.name!==PREVIEW||!worker?.activeVersion||worker.trafficPercent!==100)
   add('PREVIEW_ACTIVE_WORKER_NOT_PROVEN');
 if(!worker?.pinnedBindingsVerified)add('PREVIEW_ACTIVE_BINDINGS_NOT_PINNED');
 if(!worker?.schedulesVerified)add('PREVIEW_SCHEDULES_NOT_PROVEN');
 const env=worker?.bindings?.find(x=>x.name==='SORIDRAW_ENVIRONMENT');
 if(env?.type!=='plain_text'||env.plainHash!==sha('preview'))
   add('PREVIEW_ENVIRONMENT_IDENTITY_UNVERIFIED');
 for(const [name,type] of [
  ['DB','d1'],['PROFILE_MEDIA','r2_bucket'],
  ['OWNER_FOLLOW_RESERVATION_SERVICE_600','service'],
  ['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_HMAC_539','secret_text'],
  ['SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','secret_text'],
 ]){
  if(!okBinding(worker,name,type))add('PREVIEW_BINDING_MISSING_'+name);
 }
 const ownerDoDirect=okBinding(worker,'OWNER_FOLLOW_RECOVERY_557',
   'durable_object_namespace');
 const ownerDoService=okBinding(worker,'OWNER_FOLLOW_RESERVATION_SERVICE_600',
   'service');
 if(!ownerDoDirect&&!ownerDoService)add('OWNER_DO_ROUTE_NOT_BOUND');
 // A service binding may replace the direct DO binding, but it does not prove
 // that the target Worker has a deployed DO class or correct alarms.
 if(ownerDoService)add('OWNER_DO_SERVICE_TARGET_AND_ALARM_UNVERIFIED');
 const fnSummary=FUNCTIONS.map(name=>{
  const item=functions?.[name];
  if(item?.status!=='ACTIVE')
    add('FUNCTION_NOT_ACTIVE_OR_UNVERIFIED_'+name);
  // ACTIVE proves deployment, not actual canary invocation.
  if(item?.canaryScopeConfigured!==true)
    add('FUNCTION_CANARY_GATE_UNVERIFIED_'+name);
  return {name,status:item?.status||'UNKNOWN',
    canaryScopeConfigured:item?.canaryScopeConfigured===true,
    generalPreviewDisabled:item?.generalPreviewDisabled===true};
 });
 if(rtDb?.status!=='READ'||rtDb?.singleInstance!==true)
  add('SHARED_RTDB_ACTIVE_RULES_NOT_READ');
 if(rtDb?.rulesNodePresent!==true)add('RTDB_OWNER_FOLLOW_PATH_NOT_PROVEN');
 if(rtDb?.ownerReadOnly!==true)add('RTDB_OWNER_ONLY_READ_NOT_PROVEN');
 if(rtDb?.clientWriteBlocked!==true)add('RTDB_CROSS_ACCOUNT_CLIENT_WRITE_NOT_BLOCKED');
 // The checked-in Rules snapshot may lag behind already-published live rules.
 // Never replace live shared Rules with that snapshot or treat drift alone as
 // proof that the live owner-only path is absent.
 if(gitRulesNode!==true&&rtDb?.rulesNodePresent!==true)
   add('PREVIEW_GIT_AND_LIVE_RULES_PATH_NOT_PRESENT');
 // Environment isolation cannot be inferred from metadata or a source flag;
 // active function code, real DO exact receipt, rollback and scoped usage
 // require independent proof before any shared-backend mutation.
 add('CANARY_REAL_PROOF_AND_ROLLBACK_NOT_COMPLETE');
 const previewFollowBindings=names(worker).filter(x=>
   /OWNER_FOLLOW|PUBLIC_FOLLOW/.test(x)).sort();
 return {
  code:'APP757_PREVIEW_CANARY_METADATA_GET_ONLY',
  status:'HOLD',sourceOnly:true,
  previewWorker:{activeVersion:worker?.activeVersion||null,
    bindingCount:worker?.bindings?.length||0,
    pinnedBindingsVerified:worker?.pinnedBindingsVerified===true,
    followRelatedBindingCount:previewFollowBindings.length,
    knownRequiredNamesVerified:!blockers.some(x=>x.startsWith('PREVIEW_BINDING_MISSING_')),
    ownerDoDirectBound:ownerDoDirect,ownerDoServiceBound:ownerDoService},
  functions:fnSummary,
  rtDb:{status:rtDb?.status||'UNKNOWN',singleInstance:rtDb?.singleInstance===true,
    ownerReadOnly:rtDb?.ownerReadOnly===true,
    clientWriteBlocked:rtDb?.clientWriteBlocked===true,
    rulesNodePresent:rtDb?.rulesNodePresent===true},
  sourceRulesNodePresent:gitRulesNode===true,
  sourceRulesSnapshotDrift:gitRulesNode!==true&&rtDb?.rulesNodePresent===true,
  blockers:[...new Set(blockers)],
  readOnly:true,externalWrites:0,
  sharedUserDataReads:0,previewBackendMutationAllowed:false,
  productionTouched:false,testTouched:false,
 };
}
async function get(url,token,{allowMissing=false}={}){
 const res=await fetch(url,{method:'GET',redirect:'manual',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000)});
 if(allowMissing&&res.status===404)return {missing:true};
 if(res.status!==200)throw Error('APP757_METADATA_READ_HOLD_HTTP_'+res.status);
 try{return await res.json()}catch{throw Error('APP757_INVALID_METADATA_JSON')}
}
async function probeFunction(name,access){
 const path=encodeURIComponent(name);
 const url='https://cloudfunctions.googleapis.com/v2/projects/'+PROJECT+
   '/locations/'+REGION+'/functions/'+path;
 try{
  const d=await get(url,access,{allowMissing:true});
  if(d.missing)return {status:'NOT_DEPLOYED'};
  if(d.name!=='projects/'+PROJECT+'/locations/'+REGION+'/functions/'+name)
    return {status:'UNVERIFIED_NAME'};
  const vars=d.serviceConfig?.environmentVariables||{};
  const uid=String(vars.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'');
  const canaryScopeConfigured=d.state==='ACTIVE'&&
    vars.SORIDRAW_OWNER_FOLLOW_READY_608==='1'&&
    /^[A-Za-z0-9_-]{1,128}$/.test(uid)&&
    vars.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1';
  return {status:d.state==='ACTIVE'?'ACTIVE':(d.state||'UNVERIFIED_STATE'),
    canaryScopeConfigured,generalPreviewDisabled:
      vars.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1'};
 }catch{return {status:'UNREADABLE'}}
}
export function summarizeOwnerRules(rules){
 const item=rules?.rules?.ownerFollowerSync532?.$uid;
 if(!item||typeof item!=='object')
  return {rulesNodePresent:false,ownerReadOnly:false,clientWriteBlocked:false};
 const read=String(item['.read']||'').replace(/\s+/g,'');
 // Allow the exact live owner-only rule with strict enrolled Auth epoch.
 // Do not accept extra OR clauses, root-wide reads, or missing Auth checks.
 const epoch="auth.token.soridrawFollowEpoch532!=null&&(!data.exists()||auth.token.soridrawFollowEpoch532===data.child('authEpoch').val())";
 const ownerReadOnly=read==="auth!=null&&auth.uid===$uid&&"+epoch||
   read==="auth!==null&&auth.uid===$uid&&"+epoch;
 const ruleKeys=Object.keys(rules.rules);
 const rootRead=rules.rules['.read'];
 const rootWrite=rules.rules['.write'];
 const clientWriteBlocked=item['.write']===false&&rootWrite===false&&
   rootRead===false&&ruleKeys.every(x=>x!=='.validate'||rules.rules[x]===false);
 return {rulesNodePresent:true,ownerReadOnly,clientWriteBlocked};
}
async function probeRtDb(access){
 try{
  // The existing approved PREVIEW Rules workflow uses this exact OAuth query
  // against one pinned shared instance. Never include the credential in logs.
  const res=await fetch(RTDB_RULES_URL+'?access_token='+encodeURIComponent(access),{
    method:'GET',redirect:'manual',headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(15000)});
  if(res.status!==200)throw Error('RTDB_RULES_HTTP_HOLD');
  const rules=await res.json();
  return {status:'READ',singleInstance:true,...summarizeOwnerRules(rules)};
 }catch{return {status:'UNREADABLE',singleInstance:false,
   ...summarizeOwnerRules(null)}}
}
async function main(){
 if(process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_REF!=='refs/heads/main')
   throw Error('APP757_REQUIRE_MAIN_CONTROLLER');
 const preview=String(process.env.APP757_PREVIEW_SHA||'');
 if(!/^[0-9a-f]{40}$/.test(preview))throw Error('APP757_INVALID_PREVIEW_SHA');
 const cf=need('CLOUDFLARE_API_TOKEN'),google=need('FIREBASE_ACCESS_TOKEN');
 const [worker,functionsArr,rtDb]=await Promise.all([
   readWorker(PREVIEW,cf),
   Promise.all(FUNCTIONS.map(async name=>[name,await probeFunction(name,google)])),
   probeRtDb(google),
 ]);
 const functions=Object.fromEntries(functionsArr);
 // Existing checked-in RTDB rules are not automatically actual active rules.
 const {readFileSync}=await import('node:fs');
 let gitRulesNode=false;
 try{
   const rules=JSON.parse(readFileSync(process.env.APP757_SOURCE_RULES,'utf8'));
   gitRulesNode=Boolean(rules?.rules?.ownerFollowerSync532?.$uid);
 }catch{}
 const report=assessApp757CanaryReadiness({
   worker,functions,rtDb,gitRulesNode,sourceHeadPinned:true});
 console.log(JSON.stringify(report,null,2));
 console.log('APP757_LIVE_METADATA_ONLY=PASS; SHARED_CHANGES=0; ROLLOUT=HOLD');
}
if(process.argv[1]?.endsWith('/app757-preview-follow-readiness.mjs')){
 main().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
}
