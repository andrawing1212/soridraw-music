// APP655: Approved PREVIEW single-owner Cloudflare bridge activation only.
// Clone the exact deployed APP651 12 modules, change one existing plaintext
// binding 0 -> 1, preserve the 0% canary and all other settings. No migration,
// secret modification, D1/R2/RTDB/Functions operation or TEST/PROD deploy.
import {createHash} from 'node:crypto';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const OLD='ec426c84-381d-4aa9-ac62-316c745dea55';
const ZERO='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const APPROVED='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const HASH='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const FIELD='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607';
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const halt=(s)=>{throw Error('APP655_HOLD_'+s)};
const check=(v,k)=>{if(!v)halt(k)};
const sha=b=>createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function api(method,path,payload){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(payload)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;try{j=await response.json()}catch{halt('UNCERTAIN_'+method)}
 if(!response.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(x=>String(x.code||'')).slice(0,4).join('_');
  halt('API_'+method+'_'+response.status+'_CODES_'+codes);
 }
 return j.result;
}
async function deployment(name){
 const d=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 return d?.deployments?.[0]?.versions;
}
const exact=(vs,id)=>Array.isArray(vs)&&vs.length===1&&
 vs[0]?.version_id===id&&Number(vs[0].percentage)===100;
const selected=vs=>Array.isArray(vs)&&vs.length===2&&
 vs.some(v=>v.version_id===OLD&&Number(v.percentage)===100)&&
 vs.some(v=>v.version_id===ZERO&&Number(v.percentage)===0);
async function preflight(){
 check(selected(await deployment(EX)),'ORIGINAL_SAFE_100_CANARY_0_DRIFT');
 check(exact(await deployment(OW),OWNER),'OWNER_STANDALONE_DRIFT');
 const [e,o]=await Promise.all([
  api('GET','workers/scripts/'+EX+'/versions/'+OLD),
  api('GET','workers/scripts/'+OW+'/versions/'+OWNER)]);
 const eb=e?.resources?.bindings,ob=o?.resources?.bindings;
 check(Array.isArray(eb)&&eb.length===35&&Array.isArray(ob)&&ob.length===7,
  'BINDING_COUNTS');
 const b=new Map(eb.map(x=>[x.name,x])),owner=new Map(ob.map(x=>[x.name,x]));
 check(b.size===35&&owner.size===7,'BINDING_DUPLICATES');
 check(e.resources?.script_runtime?.compatibility_date==='2026-08-28'&&
  o.resources?.script_runtime?.compatibility_date==='2026-08-28','COMPAT_DATE');
 check(b.get(FIELD)?.type==='plain_text'&&b.get(FIELD)?.text==='0','BRIDGE_MUST_START_OFF');
 check(b.get('SORIDRAW_ENVIRONMENT')?.text==='preview','PREVIEW_ENV_ONLY');
 check(b.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.text===APPROVED,'EXACT_APPROVED_OWNER');
 check(sha(APPROVED)===HASH,'OWNER_UID_PIN');
 for(const flag of ['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',
  'SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607',
  'SORIDRAW_OWNER_FOLLOW_BIND_544','SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547']){
  check(b.get(flag)?.text==='1','PREVIEW_REQUIRED_FLAG_'+flag);
 }
 check(b.get('SORIDRAW_OWNER_FOLLOW_ENDPOINT_539')?.text===ENDPOINT,'RECEIVER_ENDPOINT');
 check(b.get('SORIDRAW_OWNER_FOLLOW_QA_ONLY_577')?.text!=='1','QA_ONLY_HOLD');
 check(b.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,'OWNER_FORWARD_SERVICE');
 check(b.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  'LIKE_DO_V1');
 check(!b.has('OWNER_FOLLOW_RECOVERY_557'),'NO_SHARED_DO_MIGRATION');
 for(const k of ['SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544',
  'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'])
  check(b.get(k)?.type==='secret_text','PREVIEW_SECRET_BINDING_'+k);
 check(owner.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  owner.get('SORIDRAW_OWNER_DO_STANDALONE_600')?.text==='1'&&
  owner.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.text===APPROVED&&
  owner.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600',
  'OWNER_SINGLE_PINNED_DO');
 const reverse=owner.get('OWNER_FOLLOW_CANONICAL_REPLAY_600');
 check(reverse?.type==='service'&&reverse.service===EX&&
  reverse.entrypoint==='OwnerFollowReplayEntrypoint607','OWNER_REVERSE_SERVICE');
 check(owner.get('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')?.type==='secret_text',
  'OWNER_BRIDGE_SECRET');
 return {e,b,eb,ownerVersion:o};
}
async function source(version){
 const data=await api('GET','workers/workers/'+EX+'/versions/'+version+'?include=modules');
 const ms=data?.modules;
 check(Array.isArray(ms)&&ms.length===12,'MODULE_COUNT');
 const map=new Map();
 for(const x of ms){
  check(typeof x.name==='string'&&typeof x.content_base64==='string'&&
   x.content_base64.length>100&&!map.has(x.name),'MODULE_ENTRY');
  map.set(x.name,sha(Buffer.from(x.content_base64,'base64')));
 }
 check(map.has('owner-follow-entry-607.mjs')&&map.has('preview-entry.mjs'),
  'ACTIVE_OWNER_WRAPPER');
 const owner=ms.find(x=>x.name==='owner-follow-entry-607.mjs');
 const wrapper=Buffer.from(owner.content_base64,'base64').toString('utf8');
 check(wrapper.includes(HASH)&&wrapper.includes('approvedCanary607')&&
  wrapper.includes('activeFor607'),'PINNED_WRAPPER_SOURCE');
 const entry=ms.find(x=>x.name==='preview-entry.mjs');
 const canonical=Buffer.from(entry.content_base64,'base64').toString('utf8');
 check(canonical.includes('RETURNING 1 AS relation_changed'),
  'APP651_PRIMARY_FOLLOW_500_FIX_PRESERVED');
 return {ms,map};
}
const keys=['type','id','database_id','bucket_name','namespace_id','service',
 'entrypoint','class_name','text'];
async function stageCheck(version,before,saved){
 const [metadata,files]=await Promise.all([
  api('GET','workers/scripts/'+EX+'/versions/'+version),
  source(version)]);
 const bs=metadata?.resources?.bindings;
 check(Array.isArray(bs)&&bs.length===35,'STAGED_BINDING_COUNT');
 const m=new Map(bs.map(x=>[x.name,x]));
 check(m.size===35&&m.get(FIELD)?.text==='1'&&m.get(FIELD)?.type==='plain_text',
  'STAGED_BRIDGE_SWITCH');
 for(const [name,value] of before.b){
  const after=m.get(name);
  check(Boolean(after),'MISSING_BINDING_'+name);
  if(name===FIELD)continue;
  for(const k of keys)if(value[k]!==undefined)
   check(after[k]===value[k],'UNEXPECTED_BINDING_DELTA_'+name+'_'+k);
 }
 for(const [name,hash] of saved.map)
  check(files.map.get(name)===hash,'STAGED_MODULE_HASH_'+name);
 check(files.map.size===saved.map.size,'EXACT_12_MODULES');
 check(metadata?.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'STAGED_RUNTIME_DATE');
}
async function restore(oldVersion){
 const current=await deployment(EX);
 const active=current?.find(v=>Number(v.percentage)===100)?.version_id;
 if(active===oldVersion)return;
 if(active!==undefined&&active!==OLD) {
  try{
   await api('POST','workers/scripts/'+EX+'/deployments',{
    strategy:'percentage',
    versions:[{version_id:OLD,percentage:100},{version_id:ZERO,percentage:0}],
    annotations:{'workers/message':'APP655 rollback if one-owner bridge postflight failed'}
   });
   console.log('APP655_PREVIEW_ROLLBACK_REQUESTED=TRUE');
  }catch{console.log('APP655_ROLLBACK_REQUIRES_MANUAL_CHECK=TRUE')}
 }
}
async function apply(){
 check(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===A&&token.length>20&&
  /^[0-9a-f]{40}$/.test(String(process.env.APP655_APPROVED_PARENT||'')),
  'APPROVED_ONE_SHOT_CONTEXT');
 const before=await preflight();
 const [files,t,p]=await Promise.all([
  source(OLD),
  deployment(TEST),
  deployment(PROD),
 ]);
 check(Array.isArray(t)&&Array.isArray(p),'TEST_PROD_BASELINE_MISSING');
 const payload={
  main_module:'owner-follow-entry-607.mjs',
  compatibility_date:'2026-08-28',
  compatibility_flags:before.e.resources.script_runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app655-approved-single-owner-bridge',
   'workers/message':'APP655 one pinned PREVIEW owner; exact APP651 core preserved'},
  bindings:before.eb.map(x=>x.name===FIELD
   ? {name:FIELD,type:'plain_text',text:'1'}
   : {name:x.name,type:'inherit',version_id:OLD}),
  modules:files.ms.map(m=>({name:m.name,content_type:m.content_type||
   'application/javascript+module',content_base64:m.content_base64})),
 };
 check(payload.bindings.length===35&&payload.modules.length===12&&
  !('migrations' in payload),'ONLY_ONE_FLAG_CHANGED');
 await preflight();
 const created=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const id=String(created?.id||'');
 check(/^[a-f0-9-]{36}$/.test(id)&&id!==OLD&&id!==ZERO,'STAGE_VERSION_ID');
 console.log('APP655_INACTIVE_STAGED='+id);
 let staged=false;
 for(let i=0;i<16;i++){
  try{await stageCheck(id,before,files);staged=true;break}
  catch(e){
   if(i===15)throw e;
   await sleep(4000);
  }
 }
 check(staged,'STAGE_NOT_VERIFIED');
 console.log('APP655_INACTIVE_12_MODULE_SHA_AND_34_UNCHANGED_BINDINGS=PASS');
 check(selected(await deployment(EX))&&
  exact(await deployment(OW),OWNER),'TRAFFIC_CHANGED_BEFORE_ACTIVATION');
 const [tn,pn]=await Promise.all([deployment(TEST),deployment(PROD)]);
 check(JSON.stringify(tn)===JSON.stringify(t)&&JSON.stringify(pn)===JSON.stringify(p),
  'TEST_PROD_PREACTIVATION_DRIFT');
 // No D1/RTDB traffic is initiated by staging or activation; only actual
 // future authenticated follow mutations for APPROVED owner can reserve.
 await api('POST','workers/scripts/'+EX+'/deployments',{
  strategy:'percentage',
  versions:[{version_id:id,percentage:100},{version_id:ZERO,percentage:0}],
  annotations:{'workers/message':'APP655 PREVIEW one approved owner only; other follows unchanged'}
 });
 try{
  const vs=await deployment(EX);
  check(vs?.length===2&&vs.some(v=>v.version_id===id&&Number(v.percentage)===100)&&
   vs.some(v=>v.version_id===ZERO&&Number(v.percentage)===0),'NEW_PREVIEW_100_ZERO_0');
  await stageCheck(id,before,files);
  check(exact(await deployment(OW),OWNER),'OWNER_POSTFLIGHT');
  const [tf,pf]=await Promise.all([deployment(TEST),deployment(PROD)]);
  check(JSON.stringify(tf)===JSON.stringify(t)&&JSON.stringify(pf)===JSON.stringify(p),
   'TEST_PROD_POSTFLIGHT');
  console.log('APP655_PREVIEW_SINGLE_OWNER_BRIDGE_ACTIVE=PASS');
  console.log('APP655_NEW_ACTIVE_VERSION='+id);
  console.log('APP655_ROLLBACK_SAFE_PREVIEW_VERSION='+OLD);
  console.log('APP655_OTHER_OWNERS_CANONICAL_UNCHANGED=PASS');
  console.log('APP655_NO_USER_MUTATION_OR_D1_R2_RTDB_FUNCTIONS_RULES_DEPLOY=PASS');
 }catch(e){
  await restore(id);throw e;
 }
}
if(process.argv[2]==='--self-test'){
 check(sha(APPROVED)===HASH&&OLD!==ZERO&&OLD!==OWNER,'PIN');
 check(FIELD==='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607'&&
  ENDPOINT.includes('soridraw-app-866a5.cloudfunctions.net'),'SCOPE');
 console.log('APP655_SINGLE_OWNER_SOURCE_PINS_AND_ZERO_CANARY=PASS');
}else if(process.argv[2]==='--apply-once')apply().catch(e=>{
 console.error(String(e?.message||e).slice(0,260));process.exitCode=2;
});
else halt('NO_OTHER_MODES');
