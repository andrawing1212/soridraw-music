// GET-only assemble from actual active versions pinned in APP793.
// No upload, no token values in logs, no deploy, no D1/R2 data requests.
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyActiveOwnerConnection797} from './verify-797-active-owner-connection.mjs';
import {stageInactiveProductionConnection797} from './app797-stage-inactive-connection.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!token)throw Error('APP797_SCOPE');
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const pins={preview:['soridraw-explore-preview','cfd40718-6ab5-4133-bdb2-fa69332d6810'],production:['soridraw-explore-api','af81502a-298d-4ec6-bc2a-0c529d6dc29e'],owner:['soridraw-owner-follow-preview-candidate','1e987bc3-36d3-4bb0-861f-4df17f536592']};
const get=async p=>{const r=await fetch(base+p,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('APP797_GET_'+r.status);return j.result};
async function active([name,id]){
 const d=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)throw Error('APP797_VERSION_DRIFT_'+name);
}
const read=async ([name,id])=>get('workers/workers/'+name+'/versions/'+id+'?include=modules');
const hash=s=>createHash('sha256').update(s).digest('hex');
const source=(v,name,expected)=>{const s=Buffer.from(v.modules.find(x=>x.name===name)?.content_base64||'','base64').toString('utf8');if(hash(s)!==expected)throw Error('APP797_SOURCE_DRIFT_'+name);return s};
const one=(s,a,b)=>{if(s.split(a).length!==2)throw Error('APP797_ANCHOR_'+a);return s.replace(a,()=>b)};
await Promise.all(Object.values(pins).map(active));
const [pv,prod,owner]=await Promise.all(Object.values(pins).map(read));
const bindings=v=>v.bindings||v.resources?.bindings||[];
const bind=(v,n)=>bindings(v).find(x=>x.name===n);
for(const [n,k] of [['DB','id'],['PROFILE_MEDIA','bucket_name']]){
 const a=bind(pv,n),b=bind(prod,n);
 const av=a?.[k]||a?.database_id||a?.bucket_name,bv=b?.[k]||b?.database_id||b?.bucket_name;
 if(!av||av!==bv||a.type!==b.type)throw Error('APP797_CANONICAL_BINDING_DRIFT_'+n);
}
const forward=bind(pv,'OWNER_FOLLOW_RESERVATION_SERVICE_600'),reverse=bind(owner,'OWNER_FOLLOW_CANONICAL_REPLAY_600');
if(forward?.service!==pins.owner[0]||reverse?.service!==pins.preview[0]||reverse.entrypoint!=='OwnerFollowReplayEntrypoint607')throw Error('APP797_OWNER_ROUTE_DRIFT');
const prodSource=source(prod,'worker.js','f95ccb6225a668b8d26ea2d5e126d8269f63fca98be08b54ea092061be14de78');
const pre=source(pv,'app607/owner-follow-precommit-557.mjs','e74be14adae93b20d33c1022d0799a6b84821b4561e77e4c6f2fa396c773574d');
const srv=source(pv,'app605/owner-follow-service-601.mjs','ab7b7e0a741bb4a4dce4e34b644f8d56a9130e9726b9807f206897631a8db2c5');
// Keep production canonical bytes exactly as deployed; export only its own
// existing authenticated validator. No canonical writer replacement.
if(!/\b(?:async )?function validateExploreAuth307\s*\(/.test(prodSource))throw Error('APP797_PROD_AUTH_EXPORT_ANCHOR');
if(!/\bfunction (?:handleFollowOverlay354|orchestrateFollowOverlay354)\s*\(/.test(prodSource))throw Error('APP797_CANONICAL_CONTRACT');
const folder=mkdtempSync(join(tmpdir(),'app797-'));
const save=(n,s)=>{const p=join(folder,n);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,s);execFileSync(process.execPath,['--check',p],{stdio:'pipe'})};
try{
 const exported=/export\s*\{[^}]*\bvalidateExploreAuth307\b[^}]*\}/.test(prodSource);
 save('production-main.mjs',prodSource+(exported?'':'\nexport {validateExploreAuth307};\n'));
 save('production-follow-797.mjs',readFileSync('scripts/app797-production-follow-existing-writer.mjs','utf8'));
 const guard="env?.SORIDRAW_ENVIRONMENT==='production'&&env?.SORIDRAW_OWNER_FOLLOW_PRODUCTION_797==='1'";
 let preProd=one(pre,"env?.SORIDRAW_ENVIRONMENT!=='preview'","!("+guard+")");
 preProd=one(preProd,"env?.SORIDRAW_ENVIRONMENT==='preview'",guard);
 save('app607/owner-follow-precommit-557.mjs',preProd);
 // Reuse only the exact reserve function + private capability checks.
 // The existing PREVIEW named entrypoint still owns replay/relay and
 // no PROD reverse entrypoint is added. Preserve the module dependencies
 // in the temporary package, with no route/export from public Worker.
 save('app605/owner-follow-service-601.mjs',one(srv,"\n env?.SORIDRAW_ENVIRONMENT==='preview'&&",'\n '+guard+'&&'));
 for(const m of pv.modules.filter(m=>m.name.startsWith('app605/')&&m.name!=='app605/owner-follow-service-601.mjs')){
  if(!/^app605\/[A-Za-z0-9_.-]+\.mjs$/.test(m.name))throw Error('APP797_MODULE_NAME');
  save(m.name,Buffer.from(m.content_base64,'base64').toString('utf8'));
 }
 save('entry.mjs',[
 "import canonical,{validateExploreAuth307} from './production-main.mjs';",
 "export * from './production-main.mjs';",
 "import {composeProductionFollow797} from './production-follow-797.mjs';",
 "import {runOwnerFollowPrecommit557} from './app607/owner-follow-precommit-557.mjs';",
 "import {reserveOwnerFollowViaService601} from './app605/owner-follow-service-601.mjs';",
 "export default composeProductionFollow797(canonical,{authenticate:validateExploreAuth307,precommit:runOwnerFollowPrecommit557,reserve:reserveOwnerFollowViaService601});"
 ].join('\n'));
 // The live-owner module is loaded ONLY into the isolated synthetic harness,
 // never into the production upload or an active Worker.
 const ownerSource=source(owner,'worker.js','76c9d6df31bac01ceeaac1d171d0701621fac751a5017df19c6f8280e4c5c4d9');
 save('owner-live.mjs',ownerSource);
 await verifyActiveOwnerConnection797(folder);
 // Metadata confirms the active PROD worker lacks this capability. Existing
 // secret values are never fetched or copied across workers. Only check if
 // the exact named, already-configured Actions secret is available.
 const supplied=process.env.APP797_EXISTING_BRIDGE_SECRET||'';
 const canProvision=/^[A-Za-z0-9_-]{32,256}$/.test(supplied);
 console.log(JSON.stringify({status:'APP797_SERVER_CONNECTION_PREFLIGHT',productionOwnerServicePresent:!!bind(prod,'OWNER_FOLLOW_RESERVATION_SERVICE_600'),productionBridgeSecretPresent:bind(prod,'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')?.type==='secret_text',existingActionsBridgeSecretAvailable:canProvision,secretValueReadFromCloudflare:false,previewOwnerRoutePinned:true,productionTrafficUnchanged:true,liveReservationTest:false,uploadPerformed:false}));
 if(!canProvision)console.log('APP797_HOLD_EXISTING_BRIDGE_CAPABILITY_SOURCE_UNAVAILABLE');
 else console.log('APP797_HOLD_EXISTING_BRIDGE_CAPABILITY_MATCH_NOT_YET_PROVEN');
 console.log('APP797_EXACT_ACTIVE_SOURCE_AND_ISOLATED_RUNTIME=PASS;DEPLOY=0;CLOUD_WRITE=0');
 if(process.env.APP797_STAGE_INACTIVE_CONNECTION==='1'){
  await stageInactiveProductionConnection797({folder,ownerSource,pins,get,active,base,token});
 }
}finally{rmSync(folder,{recursive:true,force:true})}
await Promise.all(Object.values(pins).map(active));
