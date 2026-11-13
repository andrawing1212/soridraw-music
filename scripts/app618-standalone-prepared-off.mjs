// APP618: Cloudflare GET-only pre/postflight for isolated owner Worker.
import {readFileSync} from 'node:fs';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const owner='soridraw-owner-follow-preview-candidate',old='e274388f-8075-473d-b3a0-6e78eb67f353';
const explore='soridraw-explore-preview',exploreOld='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const fail=(v,k)=>{if(!v)throw Error('APP618_HOLD_'+k)};
const config=JSON.parse(readFileSync('cloudflare/owner-follow-worker/wrangler.candidate.jsonc','utf8'));
const src=readFileSync('cloudflare/owner-follow-worker/worker.mjs','utf8');
fail(config.name===owner && config.workers_dev===false && config.compatibility_date==='2026-08-28','TARGET');
fail(config.main==='./worker.mjs' && JSON.stringify(config.triggers?.crons)==='[]','NO_PUBLIC_CRON');
fail(config.routes===undefined && config.services===undefined && config.route===undefined,'NO_PUBLIC_ROUTE');
fail(JSON.stringify(config.vars)==='{"SORIDRAW_ENVIRONMENT":"preview"}','NO_EXTRA_VARS');
fail(JSON.stringify(config.migrations)==='[{"tag":"owner600_v1","new_sqlite_classes":["OwnerFollowerStandalone600"]}]','EXISTING_DO_V1');
fail(config.durable_objects?.bindings?.length===1&&config.durable_objects.bindings[0].name==='OWNER_FOLLOW_DO_600','OWNER_DO');
fail(src.includes('export const APP600_OWNER_WORKER_COMPILED_OPEN = true;'),'COMPILED_READY');
fail(src.includes("env?.SORIDRAW_OWNER_DO_STANDALONE_600 === '1'"),'RUNTIME_OFF');
fail(src.includes('APPROVED_CANARY_SHA256_600'),'APPROVED_ONLY');
async function get(path){
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');fail(token.length>15,'API_TOKEN');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/'+path,{
 method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
 signal:AbortSignal.timeout(20000)});
 fail(response.ok,'GET_HTTP_'+response.status);
 const json=await response.json();fail(json?.success===true,'GET_REJECTED');return json.result;
}
async function active(name){
 const r=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const versions=r?.deployments?.[0]?.versions;
 fail(versions?.length===1&&Number(versions[0].percentage)===100,'ACTIVE_TRAFFIC_'+name);
 return versions[0].version_id;
}
function bindings(list){
 fail(Array.isArray(list)&&list.length===2,'BINDING_COUNT');
 const map=new Map(list.map(b=>[b.name,b]));
 fail(map.size===2&&map.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600'&&
  map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','OWNER_BINDINGS');
 fail(!map.has('SORIDRAW_OWNER_DO_STANDALONE_600')&&!map.has('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')&&
  !map.has('OWNER_FOLLOW_CANONICAL_REPLAY_600'),'RUNTIME_MUST_STAY_OFF');
}
async function version(id){
 const v=await get('workers/scripts/'+owner+'/versions/'+id);
 fail(v?.resources?.script_runtime?.migration_tag==='owner600_v1','DO_MIGRATION_DRIFT');
 fail(v.resources.script_runtime.compatibility_date==='2026-08-28','DATE_DRIFT');
 bindings(v.resources.bindings);
}
const mode=process.argv[2];
if(mode==='--source-only'){
 console.log('APP618_SOURCE_AND_RUNTIME_OFF=PASS');
}else{
 fail(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated','BRANCH');
 fail(process.env.CLOUDFLARE_ACCOUNT_ID===account,'ACCOUNT');
 fail((await active(explore))===exploreOld,'EXPLORE_CHANGED');
 if(mode==='--preflight'){
  fail((await active(owner))===old,'OWNER_OLD_DRIFT');
  await version(old);
  bindings((await get('workers/scripts/'+owner+'/settings')).bindings);
  console.log('APP618_PINNED_OWNER_OLD_VERSION_AND_2_BINDINGS=PASS');
 }else if(mode==='--postflight'){
  const current=await active(owner);
  fail(current!==old && /^[0-9a-f-]{36}$/.test(current),'NEW_OWNER_NOT_ACTIVE');
  await version(current);await version(old);
  bindings((await get('workers/scripts/'+owner+'/settings')).bindings);
  console.log('APP618_NEW_OWNER_PREPARED_OFF_VERSION='+current);
  console.log('APP618_ROLLBACK_OLD_VERSION_AVAILABLE=PASS');
  console.log('APP618_OWNER_RUNTIME_ENV_BRIDGE_SECRET_REPLAY_ABSENT=PASS');
  console.log('APP618_EXPLORE_100_PERCENT_ORIGINAL=PASS');
  console.log('APP618_NO_SHARED_DATA_OR_ROUTING_CHANGE=PASS');
 }else throw Error('APP618_UNKNOWN_MODE');
}