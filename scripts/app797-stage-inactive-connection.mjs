// One-time director-approved PRE-activation connection staging. Only
// POST /versions?deploy=false. No deployment endpoint, active secret edit,
// D1/R2 reads or writes, new Worker, namespace, IAM/Rules, or Functions call.
// New production-only capability is generated in memory, never logged,
// exported, stored in a file, or substituted for the existing PREVIEW secret.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const hold=m=>{throw Error('APP797_INACTIVE_HOLD_'+m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const ownerKey='SORIDRAW_OWNER_DO_PRODUCTION_BRIDGE_797';
const ownerFlag='SORIDRAW_OWNER_FOLLOW_PRODUCTION_RESERVE_797';
const oldKey='SORIDRAW_OWNER_DO_BRIDGE_SECRET_600';
const uuid=x=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(String(x||''));
const legacyCheck='if (!capabilityValid(request, env)) return reply(403, { ok: false });';
const newCheck='if (!capabilityValid(request, env) && !productionReserveCapability797(request, env)) return reply(403, { ok: false });';
const helper=`function productionReserveCapability797(request,env){
 if(env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653!=='preview-only'||
    env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_PRODUCTION_RESERVE_797!=='1'||
    request.method!=='POST'||new URL(request.url).pathname!=='/internal/owner-follow/reserve600')return false;
 const expected=env?.SORIDRAW_OWNER_DO_PRODUCTION_BRIDGE_797;
 const actual=request.headers.get('X-Soridraw-Owner-Bridge-600');
 if(typeof expected!=='string'||!/^([A-Za-z0-9_-]{32,256})$/.test(expected)||
    typeof actual!=='string')return false;
 let difference=expected.length^actual.length;
 for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
 return difference===0;
}
`;
export function patchOwnerProductionCapability797(source){
 if(sha(source)!=='76c9d6df31bac01ceeaac1d171d0701621fac751a5017df19c6f8280e4c5c4d9')hold('OWNER_SOURCE_DRIFT');
 const begin=source.indexOf('async function handleOwnerWorker600('),end=source.indexOf('__name(handleOwnerWorker600,',begin);
 if(begin<0||end<begin||source.indexOf('async function handleOwnerWorker600(',begin+1)>=0)hold('OWNER_HANDLER_ANCHOR');
 const handler=source.slice(begin,end);
 if(handler.split(legacyCheck).length!==2)hold('OWNER_CAPABILITY_ANCHOR');
 const replaced=handler.replace(legacyCheck,newCheck);
 if(replaced.replace(newCheck,legacyCheck)!==handler)hold('UNRELATED_OWNER_CHANGE');
 // Only Worker->DO forwarding is widened. DO class, old secret, alarm,
 // replay entrypoint, canonical writer and all storage bytes stay unchanged.
 return source.slice(0,begin)+helper+replaced+source.slice(end);
}
async function verifyOwnerCapability(folder,source){
 const p=join(folder,'owner-candidate.mjs');writeFileSync(p,source);
 execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
 const w=(await import(pathToFileURL(p).href)).default;
 const legacy='synthetic_old_credential_797'.repeat(2),newKey='synthetic_prod_credential_797'.repeat(2);
 let forwarded=0;
 const ticket={ownerUid:'SyntheticOwner797',actorUid:'SyntheticActor797',operationId:'operation_797_123456789',cutoverToken:'synthetic-cutover797',authEpoch:'a'.repeat(32),desired:true,beforeFollowing:false,expectedRevision:0,priorR2Revision:1};
 const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',[oldKey]:legacy,[ownerKey]:newKey,[ownerFlag]:'0',
  OWNER_FOLLOW_DO_600:{idFromName:u=>u,get:u=>({fetch:async r=>{assert.equal(u,ticket.ownerUid);assert.equal(r.headers.get('X-Soridraw-Owner-Bridge-600'),legacy);assert.deepEqual(await r.json(),ticket);forwarded++;return Response.json({ok:true,status:'reserved',generation:1})}})}};
 const req=(key,method='POST',path='/internal/owner-follow/reserve600')=>new Request('https://owner-follow.internal'+path,{method,headers:{'X-Soridraw-Owner-Bridge-600':key},...(method==='POST'?{body:JSON.stringify(ticket)}:{})});
 assert.equal((await w.fetch(req(legacy),env)).status,200);
 assert.equal((await w.fetch(req(newKey),env)).status,403);
 assert.equal((await w.fetch(req(newKey),{...env,[ownerFlag]:'1'})).status,200);
 assert.equal((await w.fetch(req(legacy),{...env,[ownerFlag]:'1'})).status,200);
 assert.equal((await w.fetch(req('wrong'),{...env,[ownerFlag]:'1'})).status,403);
 assert.equal((await w.fetch(req(newKey,'GET'),{...env,[ownerFlag]:'1'})).status,404);
 assert.equal((await w.fetch(req(newKey,'POST','/owner-follow/replay557-internal'),{...env,[ownerFlag]:'1'})).status,404);
 assert.equal(forwarded,3);
 console.log('APP797_NEW_PRODUCTION_CAPABILITY_LEGACY_PRESERVED_PRIVATE_RESERVE_ONLY=PASS');
}
const module=(name,buf)=>({name,content_type:'application/javascript+module',content_base64:buf.toString('base64')});
const plain=(name,text)=>({name,type:'plain_text',text});
export async function stageInactiveProductionConnection797({folder,ownerSource,pins,get,active,base,token}){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_ACTOR!==process.env.GITHUB_REPOSITORY_OWNER||
    process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_REF!=='refs/heads/prep/production-follow-existing-writer'||
    process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.APP797_STAGE_INACTIVE_CONNECTION!=='1'||
    execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim()!=='a803db0f1b0e46c4a72851ffe4a2f878b033f208')hold('ONE_TIME_SCOPE');
 // The first live preflight found the old key absent in approved Actions
 // secrets. Do not try to retrieve/export the current PREVIEW key.
 if(process.env.APP797_EXISTING_BRIDGE_SECRET)hold('EXISTING_KEY_SOURCE_REVIEW_FIRST');
 const protectedPins=[...Object.values(pins),['soridraw-explore-test','ddd2255a-75cc-4db9-8905-b47338558cb0']];
 const protect=()=>Promise.all(protectedPins.map(active));
 await protect();
 const source=patchOwnerProductionCapability797(ownerSource);
 await verifyOwnerCapability(folder,source);
 const [ow,pr]=await Promise.all([pins.owner,pins.production].map(async ([name,id])=>{
  const meta=await get('workers/scripts/'+name+'/versions/'+id);
  const bindings=meta.resources?.bindings,runtime=meta.resources?.script_runtime;
  if(!Array.isArray(bindings)||!runtime||new Set(bindings.map(x=>x.name)).size!==bindings.length||
     !/^20\d\d-\d\d-\d\d$/.test(runtime.compatibility_date))hold('ACTIVE_METADATA_'+name);
  return {name,id,bindings,runtime};
 }));
 const lookup=(x,n)=>x.bindings.find(b=>b.name===n);
 if(lookup(ow,oldKey)?.type!=='secret_text'||lookup(ow,'OWNER_FOLLOW_CANONICAL_REPLAY_600')?.entrypoint!=='OwnerFollowReplayEntrypoint607'||
    lookup(ow,'OWNER_FOLLOW_DO_600')?.class_name!=='OwnerFollowerStandalone600'||
    lookup(ow,'SORIDRAW_ENVIRONMENT')?.text!=='preview')hold('OWNER_ACTIVE_BINDINGS');
 if(pr.bindings.length!==12||lookup(pr,'SORIDRAW_ENVIRONMENT')?.text!=='production'||
    !['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'].every(n=>lookup(pr,n)?.type==='service')||
    lookup(pr,'DB')?.type!=='d1'||lookup(pr,'PROFILE_MEDIA')?.type!=='r2_bucket')hold('PRODUCTION_ACTIVE_BINDINGS');
 const newSecret=randomBytes(48).toString('base64url');
 const ownerAdds=[{name:ownerKey,type:'secret_text',text:newSecret},plain(ownerFlag,'0')];
 const prodAdds=[
  {name:oldKey,type:'secret_text',text:newSecret},
  {name:'OWNER_FOLLOW_RESERVATION_SERVICE_600',type:'service',service:ow.name},
  plain('SORIDRAW_OWNER_FOLLOW_PRODUCTION_797','0'),
  ...['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607','SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680'].map(n=>plain(n,'1'))
 ];
 const prodFiles=['production-main.mjs','production-follow-797.mjs','entry.mjs','app607/owner-follow-precommit-557.mjs',...readdirSync(join(folder,'app605')).map(n=>'app605/'+n)];
 const targets=[
  {...ow,adds:ownerAdds,main:'worker.js',modules:[module('worker.js',Buffer.from(source))]},
  {...pr,adds:prodAdds,main:'entry.mjs',modules:prodFiles.map(n=>module(n,readFileSync(join(folder,n))))}
 ];
 for(const t of targets){
  if(t.adds.some(b=>lookup(t,b.name))||new Set(t.adds.map(x=>x.name)).size!==t.adds.length)hold('EXISTING_BINDING_COLLISION_'+t.name);
  if(!t.modules.some(m=>m.name===t.main))hold('MISSING_MAIN_'+t.name);
 }
 const staged=[];
 for(const t of targets){
  await protect();
  const payload={main_module:t.main,compatibility_date:t.runtime.compatibility_date,compatibility_flags:t.runtime.compatibility_flags||[],
   annotations:{'workers/tag':'app797-production-connection-off','workers/message':'APP797 director-approved inactive connection only; no traffic'},
   bindings:[...t.bindings.map(b=>({name:b.name,type:'inherit',version_id:t.id})),...t.adds],modules:t.modules};
  // This is the SAME beta inactive version API already used by APP737/660.
  // Never print API messages or request body (they can contain secret data).
  const response=await fetch(base+'workers/workers/'+t.name+'/versions?deploy=false',{method:'POST',redirect:'error',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.success!==true||!uuid(result?.result?.id)){
   const codes=(result?.errors||[]).map(e=>Number(e?.code)).filter(Number.isSafeInteger).slice(0,4);
   hold('UPLOAD_'+t.name+'_HTTP_'+response.status+'_CODE_'+codes.join('_'));
  }
  const id=result.result.id;
  console.log('APP797_INACTIVE_VERSION_CREATED='+t.name+';version='+id);
  const [meta,code]=await Promise.all([get('workers/scripts/'+t.name+'/versions/'+id),get('workers/workers/'+t.name+'/versions/'+id+'?include=modules')]);
  const rows=meta.resources?.bindings;
  if(!Array.isArray(rows)||rows.length!==t.bindings.length+t.adds.length)hold('BINDING_COUNT_'+t.name);
  const map=new Map(rows.map(x=>[x.name,x]));
  for(const old of t.bindings)if(!isDeepStrictEqual(old,map.get(old.name)))hold('EXISTING_BINDING_DRIFT_'+t.name+'_'+old.name);
  for(const add of t.adds){
   const a=map.get(add.name);
   if(a?.type!==add.type||(add.type==='plain_text'&&a.text!==add.text)||(add.type==='service'&&a.service!==add.service))hold('ADDED_BINDING_MISMATCH_'+t.name+'_'+add.name);
  }
  if(!sameStagedWorkerRuntime660(t.runtime,meta.resources?.script_runtime))hold('RUNTIME_DRIFT_'+t.name);
  if(code.modules?.length!==t.modules.length)hold('MODULE_COUNT_'+t.name);
  for(const m of t.modules){
   const after=code.modules.find(a=>a.name===m.name);
   if(!after||sha(Buffer.from(after.content_base64,'base64'))!==sha(Buffer.from(m.content_base64,'base64')))hold('MODULE_DRIFT_'+t.name+'_'+m.name);
  }
  staged.push({worker:t.name,old:t.id,inactive:id,bindingCount:rows.length});
  await protect();
 }
 console.log(JSON.stringify({status:'APP797_INACTIVE_CONNECTION_STAGED',workers:staged,activeTrafficUnchanged:true,productionFeatureOff:true,ownerProductionCapabilityOff:true,existingPreviewCredentialPreserved:true,secretValuesLogged:false,liveReservationTest:false,sharedUserDataWrites:0,functionsDeploy:false,testChanged:false,hostingDeploy:false}));
}
