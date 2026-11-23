// APP793: GET-only active module and binding inventory. No data queries,
// secret values, API mutation, source artifacts, or runtime enable.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKERS=['soridraw-explore-preview','soridraw-explore-test','soridraw-explore-api','soridraw-owner-follow-preview-candidate'];
const sha=s=>createHash('sha256').update(s).digest('hex');
const names=['handleFollowOverlay354','orchestrateFollowOverlay354','completeFollowIntent354','mutateFollowOverlayRelation350','readFollowStateSnapshot354','repairFollowProfile354','runOwnerFollowPrecommit557','handleOwnerFollowReplayService601','routeTrustedFollowCanonical713','validateExploreAuth307','OwnerFollowReplayEntrypoint607','OwnerFollowerStandalone600','reserveOwnerFollowViaService601'];
const allowedBindings=['DB','PROFILE_MEDIA','OWNER_FOLLOW_RESERVATION_SERVICE_600','OWNER_FOLLOW_DO_600','OWNER_FOLLOW_CANONICAL_REPLAY_600','SORIDRAW_OWNER_DO_BRIDGE_SECRET_600','SORIDRAW_OWNER_FOLLOW_ENDPOINT_539','SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_FOLLOW_SERVER_CLICK_713','SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378'];
const flags=new Set(['SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_FOLLOW_SERVER_CLICK_713','SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378']);
const need=(v,code)=>{if(!v)throw Error('APP793_'+code)};
const uuid=/^[a-f0-9-]{36}$/;
const token=process.env.CLOUDFLARE_API_TOKEN;
need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&typeof token==='string'&&token.length>=24,'READONLY_CONTEXT');
async function get(path){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,
  {method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-store'},signal:AbortSignal.timeout(45000)});
 const j=await r.json().catch(()=>null);need(r.ok&&j?.success===true,'GET_'+r.status);return j.result;
}
async function active(name){
 const x=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const versions=x?.deployments?.[0]?.versions;
 need(Array.isArray(versions)&&versions.filter(x=>Number(x.percentage)>0).length===1,'TRAFFIC_'+name);
 const v=versions.find(x=>Number(x.percentage)>0);
 need(Number(v.percentage)===100&&uuid.test(v.version_id),'ACTIVE_'+name);return v.version_id;
}
function scan(m){
 const bytes=Buffer.from(m.content_base64,'base64'),s=bytes.toString('utf8');
 const counts=Object.fromEntries(names.map(n=>[n,(s.match(new RegExp('\\b'+n+'\\b','g'))||[]).length]).filter(([,n])=>n));
 // Report known relation-write/repair anchors only, never raw module bytes.
 return {module:m.name,sha256:sha(bytes),symbols:counts,
  canonicalOverlayD1Write:/INSERT\s+INTO\s+explore_follow_overrides_348/i.test(s),
  legacyRelationWrite:/(?:INSERT\s+(?:OR IGNORE\s+)?INTO|DELETE\s+FROM)\s+follows\b/i.test(s),
  generation792:s.includes('ownerFollowGeneration792'),
  precommit557:s.includes('OWNER_FOLLOW_RESERVATION_REQUIRED_557'),
  authAppCheck:s.includes('X-Firebase-AppCheck')||s.includes('x-firebase-appcheck')};
}
const rows=[];
for(const name of WORKERS){
 const id=await active(name);
 const [meta,bundle]=await Promise.all([
  get('workers/scripts/'+name+'/versions/'+id),
  get('workers/workers/'+name+'/versions/'+id+'?include=modules')]);
 need(meta?.id===id&&Array.isArray(meta.resources?.bindings)&&Array.isArray(bundle?.modules)&&bundle.modules.every(m=>typeof m.content_base64==='string'),'MODULES_'+name);
 const bindings=meta.resources.bindings.filter(b=>allowedBindings.includes(b.name)).map(b=>{
  const x={name:b.name,type:b.type};
  if(b.type==='service'){x.service=b.service;x.entrypoint=b.entrypoint||null}
  if(b.type==='durable_object_namespace')x.className=b.class_name;
  if(flags.has(b.name)&&b.type==='plain_text')x.flag=['0','1','preview-only'].includes(b.text)?b.text:'other';
  // No resource identifiers, secrets or endpoint values in output.
  return x;
 });
 const db=meta.resources.bindings.find(b=>b.name==='DB'),r2=meta.resources.bindings.find(b=>b.name==='PROFILE_MEDIA');
 rows.push({name,id,bindings,moduleCount:bundle.modules.length,modules:bundle.modules.map(scan),
  dbFingerprint:db?sha(String(db.id||db.database_id||'')):null,r2Fingerprint:r2?sha(String(r2.bucket_name||'')):null});
}
for(const row of rows)need(await active(row.name)===row.id,'ACTIVE_DRIFT_'+row.name);
const explore=rows.slice(0,3),shared=explore.every(x=>x.dbFingerprint===explore[0].dbFingerprint&&x.r2Fingerprint===explore[0].r2Fingerprint)&&!!explore[0].dbFingerprint&&!!explore[0].r2Fingerprint;
for(const row of rows){delete row.dbFingerprint;delete row.r2Fingerprint;console.log('APP793_WRITER_MAP '+JSON.stringify(row))}
console.log('APP793_READONLY_RESULT '+JSON.stringify({sharedCanonicalResources:shared,
 actualActiveModulesInspected:rows.reduce((n,x)=>n+x.moduleCount,0),workerTrafficChanged:false,sharedDataAccess:false,writeCount:0,
 allWriterCutoverProven:false,activationAuthorized:false}));
