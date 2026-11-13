// APP628: one-owner activation-capable immutable Cloudflare candidates.
// Creates ONLY unused versions; never deploys traffic or touches D1/R2/RTDB.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const UID='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const PIN='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const DATE='2026-08-28';
const RECEIVER='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const EX='soridraw-explore-preview', OW='soridraw-owner-follow-preview-candidate';
const jobs=[
 {name:OW,base:'b170812f-9477-40b7-b5c1-1ba0a546a1db',active:'5a2d333c-f703-4ef7-9468-0293f7699268',count:4,modules:1,
   tag:'app628-owner-candidate-not-deployed',
   vars:{SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:UID,SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1'}},
 {name:EX,base:'d5d14cf8-c65a-4aa2-b58f-ed08bcdc92fd',active:'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',count:27,modules:12,
   tag:'app628-explore-candidate-not-deployed',
   vars:{SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:UID,SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
     SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:'1',
     SORIDRAW_OWNER_FOLLOW_BIND_544:'1',SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547:'1',
     SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:'1',SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:RECEIVER}}
];
const hold=x=>{throw Error('APP628_HOLD_'+x)};
const need=(ok,x)=>{if(!ok)hold(x)};
const digest=s=>createHash('sha256').update(s).digest('hex');
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
async function api(method,path,payload){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
   method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
     ...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(payload)}:{}),
   signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let json;try{json=await response.json()}catch{hold('UNCERTAIN_'+method+'_NO_RETRY')}
 if(!response.ok||json?.success!==true){
  console.log('APP628_ERROR_CODES='+String((json?.errors||[]).map(e=>e.code).join(',')).slice(0,40));
  hold('API_'+method+'_'+response.status+'_NO_RETRY');
 }
 return json.result;
}
async function active(w){
 const r=await api('GET','workers/scripts/'+w.name+'/deployments?per_page=1');
 const v=r?.deployments?.[0]?.versions;
 need(v?.length===1&&v[0].version_id===w.active&&Number(v[0].percentage)===100,'ACTIVE_DRIFT_'+w.name);
}
async function prepare(w){
 await active(w);
 const root='workers/scripts/'+w.name;
 const [v,code]=await Promise.all([
  api('GET',root+'/versions/'+w.base),
  api('GET','workers/workers/'+w.name+'/versions/'+w.base+'?include=modules')
 ]);
 const bs=v?.resources?.bindings;
 need(Array.isArray(bs)&&bs.length===w.count,'BASE_BINDING_COUNT_'+w.name);
 const map=new Map(bs.map(x=>[x.name,x]));
 need(map.size===bs.length&&map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','BINDINGS_ENV_'+w.name);
 need(v.resources.script_runtime.compatibility_date===DATE,'RUNTIME_DATE_'+w.name);
 const additions=Object.entries(w.vars);
 for(const [key] of additions)need(!map.has(key),'EXISTING_VAR_CONFLICT_'+key);
 if(w.name===EX){
  need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','LIKE_DO');
  need(map.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,'FORWARD_BINDING');
  for(const key of ['SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'])
   need(map.get(key)?.type==='secret_text','SECRET_MISSING_'+key);
 }else{
  need(map.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600','OWNER_DO');
  need(map.get('OWNER_FOLLOW_CANONICAL_REPLAY_600')?.service===EX&&
    map.get('OWNER_FOLLOW_CANONICAL_REPLAY_600')?.entrypoint==='OwnerFollowReplayEntrypoint607','REVERSE_BINDING');
  need(map.get('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')?.type==='secret_text','OWNER_SECRET_MISSING');
 }
 const modules=code?.modules;
 need(Array.isArray(modules)&&modules.length===w.modules,'MODULE_COUNT_'+w.name);
 const main=w.name===EX?'owner-follow-entry-607.mjs':modules[0].name;
 need(modules.some(x=>x.name===main),'MAIN_MODULE_'+w.name);
 const prepared=modules.map(m=>{
  need(typeof m.name==='string'&&typeof m.content_base64==='string'&&m.content_base64.length>50,'MODULE_BYTES');
  return {name:m.name,content_type:m.content_type||'application/javascript+module',content_base64:m.content_base64};
 });
 console.log('APP628_EXACT_SECRET_BEARING_SOURCE_'+w.name+'=PASS');
 return {w,bs,map,prepared,main,runtime:v.resources.script_runtime};
}
async function run(){
 need(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated','BRANCH');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'ACCOUNT_OR_TOKEN');
 need(/^[a-f0-9]{40}$/.test(process.env.APP628_APPROVED_PARENT||''),'SINGLE_USE_TRIGGER');
 need(digest(UID)===PIN,'UID_PIN');
 const prepared=await Promise.all(jobs.map(prepare));
 console.log('APP628_BOTH_SOURCES_PREFLIGHT=PASS');
 for(const data of prepared){
  const {w,bs,prepared:modules,main,runtime}=data;
  await Promise.all(jobs.map(active));
  const payload={
   main_module:main,compatibility_date:DATE,compatibility_flags:runtime.compatibility_flags||[],
   annotations:{'workers/tag':w.tag,'workers/message':'APP628 approved one-owner config, INACTIVE, never auto deploy'},
   bindings:[...bs.map(b=>({name:b.name,type:'inherit',version_id:w.base})),
     ...Object.entries(w.vars).map(([name,text])=>({name,type:'plain_text',text}))],
   modules
  };
  need(payload.bindings.length===w.count+Object.keys(w.vars).length,'EXACT_BINDING_SET');
  need(!('migrations' in payload),'MIGRATION_FORBIDDEN');
  const result=await api('POST','workers/workers/'+w.name+'/versions?deploy=false',payload);
  const next=String(result?.id||'');
  need(/^[0-9a-f-]{36}$/.test(next)&&next!==w.base,'NEW_VERSION');
  console.log('APP628_NEW_INACTIVE_'+w.name+'='+next);
  const [version,code]=await Promise.all([
   api('GET','workers/scripts/'+w.name+'/versions/'+next),
   api('GET','workers/workers/'+w.name+'/versions/'+next+'?include=modules')
  ]);
  const n=version?.resources?.bindings||[],map=new Map(n.map(x=>[x.name,x]));
  need(n.length===payload.bindings.length&&map.size===n.length,'POST_COUNT');
  for(const original of bs){
   const cur=map.get(original.name);
   need(cur?.type===original.type,'POST_ORIGINAL_CHANGED_'+original.name);
   for(const key of ['service','entrypoint','class_name','database_id','id','bucket_name','namespace_id','text']){
    if(key==='text'&&original.type==='secret_text')continue;
    if(original[key]!==undefined)need(cur[key]===original[key],'POST_METADATA_DRIFT_'+original.name);
   }
  }
  for(const [name,text] of Object.entries(w.vars))
   need(map.get(name)?.type==='plain_text'&&map.get(name)?.text===text,'POST_VAR_'+name);
  const hashes=new Map(modules.map(x=>[x.name,digest(Buffer.from(x.content_base64,'base64'))]));
  need(code.modules?.length===modules.length,'POST_MODULE_COUNT');
  for(const item of code.modules)
   need(hashes.get(item.name)===digest(Buffer.from(item.content_base64||'','base64')),'POST_CODE_CHANGE');
  await Promise.all(jobs.map(active));
  console.log('APP628_BINDINGS_CODE_AND_ACTIVE_UNCHANGED_'+w.name+'=PASS');
 }
 console.log('APP628_BOTH_ONE_OWNER_VERSIONS_INACTIVE=PASS');
 console.log('APP628_NO_TRAFFIC_OR_DATA_MUTATION=PASS');
}
if(process.argv[2]==='--source-only'){
 need(jobs.length===2&&jobs[0].name===OW&&jobs[1].name===EX&&digest(UID)===PIN,'SOURCE');
 console.log('APP628_SOURCE_AND_PIN=PASS');
}else if(process.argv[2]==='--stage-once')await run();
else hold('MODE');
