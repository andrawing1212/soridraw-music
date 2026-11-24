
// Stage exactly the already-tested combined source into the existing PROD
// Worker only. There is no deployment/schedule/secret-rotation endpoint here.
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const account='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const PRE='soridraw-explore-preview',PRO='soridraw-explore-api';
const PIN={
 [PRE]:'cfd40718-6ab5-4133-bdb2-fa69332d6810',
 [PRO]:'5313d378-351b-412c-b1d9-a7e6e9eb23fa',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869'
};
const guard=(x,msg)=>{if(!x)throw Error('FULL_RELEASE_STAGE_HOLD_'+msg)};
const token=process.env.CLOUDFLARE_API_TOKEN,ft=process.env.FIREBASE_ACCESS_TOKEN;
const api=async path=>{
 const r=await fetch(account+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
 const j=await r.json().catch(()=>null);
 guard(r.ok&&j?.success===true,'GET_'+r.status);
 return j.result;
};
const sha=s=>createHash('sha256').update(s).digest('hex');
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
async function protectedPins(){
 for(const [name,id] of Object.entries(PIN)){
  const d=await api('workers/scripts/'+name+'/deployments?per_page=1');
  const v=d.deployments?.[0]?.versions;
  guard(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'ACTIVE_DRIFT_'+name);
 }
}
export async function stageFullRelease({a,b,mods}){
 guard(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_ACTOR===process.env.GITHUB_REPOSITORY_OWNER&&process.env.GITHUB_REF==='refs/heads/prep/full-preview-production-parity'&&process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.FULL_RELEASE_STAGE_INACTIVE==='1'&&execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim()==='99998565aa46cd53e80025701ced1aaa2950e6fc','SCOPE');
 guard(token&&ft,'EXISTING_AUTH');
 await protectedPins();
 const [pa,pb]=await Promise.all([api('workers/scripts/'+PRE+'/schedules'),api('workers/scripts/'+PRO+'/schedules')]);
 guard(isDeepStrictEqual(pa.schedules?.map(x=>x.cron),['37 * * * *'])&&pb.schedules?.length===0,'EXACT_SCHEDULES');
 const bind=(w,n)=>w.rows.find(x=>x.name===n);
 guard(b.name===PRO&&a.name===PRE&&b.id===PIN[PRO]&&a.id===PIN[PRE],'SOURCE_PINS');
 guard(b.rows.length===20&&bind(b,'SORIDRAW_ENVIRONMENT')?.text==='production'&&bind(b,'SORIDRAW_OWNER_FOLLOW_PRODUCTION_797')?.text==='1','PRODUCTION_BASELINE');
 for(const n of ['DB','PROFILE_MEDIA'])guard(isDeepStrictEqual(bind(a,n),bind(b,n)),'CANONICAL_'+n);
 const shared=bind(a,'EXPLORE_LIKE_BATCH_SCHEDULER'),legacy=bind(b,'EXPLORE_LIKE_BATCH_SCHEDULER');
 guard(shared?.namespace_id==='186f808d1e4c4dffb2320ff2ad737388'&&legacy?.namespace_id==='730132f063f44332afc10d940a5f3118'&&shared.class_name==='ExploreLikeBatchScheduler103'&&legacy.class_name===shared.class_name,'QUEUE_NAMESPACE');
 guard(sha(mods.get('production-main.mjs'))==='fb6cf9218097e731fa6a4a26216c0fc68ce8e803c1478dd32c909bb3e70665e3','PASSED_CORE');
 const names=['privateLikeFinalReceipt416Candidate','publicLikeRelease416Candidate','publicationRelease431Candidate','publicLikeWindowConfig448Candidate'];
 const base='https://cloudfunctions.googleapis.com/v2/projects/soridraw-app-866a5/locations/asia-northeast3/functions/';
 for(const name of names){
  const res=await fetch(base+name,{method:'GET',headers:{Authorization:'Bearer '+ft},signal:AbortSignal.timeout(20000)});
  const j=await res.json().catch(()=>null);
  guard(res.ok&&j?.state==='ACTIVE','RECEIVER_'+name);
  if(!name.includes('Config'))guard(j.serviceConfig?.secretEnvironmentVariables?.some(x=>x.key==='SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'&&x.version==='1'),'RECEIVER_SECRET_VERSION_'+name);
 }
 // Existing project secret version 1 was proven against the actual receiver
 // in run 45394208337. Access in memory only; no logging or new secret.
 const res=await fetch('https://secretmanager.googleapis.com/v1/projects/soridraw-app-866a5/secrets/SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET/versions/1:access',{method:'GET',headers:{Authorization:'Bearer '+ft},signal:AbortSignal.timeout(20000)});
 const j=await res.json().catch(()=>null);
 const key=Buffer.from(j?.payload?.data||'','base64');
 guard(res.ok&&key.length>=32&&Buffer.from(key.toString('utf8')).equals(key),'EXISTING_SECRET');
 const plain=(name,text)=>({name,type:'plain_text',text});
 const adds=[
  {name:'RELEASE_SHARED_LIKE_SCHEDULER',type:'durable_object_namespace',class_name:shared.class_name,script_name:PRE,namespace_id:shared.namespace_id},
  {name:'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET',type:'secret_text',text:key.toString('utf8')},
  plain('SORIDRAW_PRIVATE_FINAL416_ENDPOINT','https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/privateLikeFinalReceipt416Candidate'),
  plain('SORIDRAW_PUBLIC_RELEASE416_ENDPOINT','https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicLikeRelease416Candidate'),
  plain('SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT','https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicationRelease431Candidate'),
  plain('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019','1'),
  plain('SORIDRAW_NOTIFICATION_SCHEMA_READY_013','1')
 ];
 // Retention stays on its ONE existing PREVIEW cron; no additional timer.
 // Never copy preview-local cache or rate DB or change legacy resources.
 guard(adds.every(x=>!bind(b,x.name)),'NO_BINDING_COLLISION');
 const modules=[...mods].map(([name,content])=>({name,content_type:'application/javascript+module',content_base64:Buffer.from(content).toString('base64')}));
 const payload={main_module:'entry.mjs',compatibility_date:b.runtime.compatibility_date,compatibility_flags:b.runtime.compatibility_flags||[],bindings:[...b.rows.map(x=>({name:x.name,type:'inherit',version_id:b.id})),...adds],modules,annotations:{'workers/tag':'full-preview-release-candidate','workers/message':'Full preview Explore candidate, inactive only; keep legacy storage and one existing shared scheduler'}};
 await protectedPins();
 const upload=await fetch(account+'workers/workers/'+PRO+'/versions?deploy=false',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
 key.fill(0);adds[1].text='';
 const result=await upload.json().catch(()=>null);
 if(!upload.ok||result?.success!==true||!/^([0-9a-f]{8}-){1}([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(result?.result?.id||'')){
  throw Error('FULL_RELEASE_INACTIVE_UPLOAD_HTTP_'+upload.status+'_CODE_'+(result?.errors||[]).map(x=>Number(x.code)).filter(Number.isSafeInteger).join('_'));
 }
 const id=result.result.id;
 console.log('FULL_RELEASE_INACTIVE_VERSION_CREATED='+id);
 const [m,code]=await Promise.all([api('workers/scripts/'+PRO+'/versions/'+id),api('workers/workers/'+PRO+'/versions/'+id+'?include=modules')]);
 const rows=m.resources?.bindings;
 guard(rows?.length===b.rows.length+adds.length,'BINDING_COUNT');
 const map=new Map(rows.map(x=>[x.name,x]));
 for(const x of b.rows)guard(isDeepStrictEqual(x,map.get(x.name)),'ORIGINAL_BINDING_'+x.name);
 for(const x of adds){
  const y=map.get(x.name);
  guard(y?.type===x.type,'ADDED_TYPE_'+x.name);
  if(x.type==='plain_text')guard(y.text===x.text,'ADDED_VALUE_'+x.name);
 }
 guard(map.get('RELEASE_SHARED_LIKE_SCHEDULER')?.namespace_id===shared.namespace_id,'EXACT_EXISTING_SHARED_NAMESPACE');
 guard(sameStagedWorkerRuntime660(b.runtime,m.resources?.script_runtime),'RUNTIME');
 guard(code.modules?.length===modules.length,'MODULE_COUNT');
 for(const x of modules){const y=code.modules.find(v=>v.name===x.name);guard(y&&sha(Buffer.from(y.content_base64,'base64'))===sha(Buffer.from(x.content_base64,'base64')),'MODULE_'+x.name)}
 await protectedPins();
 console.log(JSON.stringify({status:'FULL_RELEASE_INACTIVE_EXACT_CANDIDATE_READY',version:id,rollback:b.id,bindings:rows.length,legacyNamespacePreserved:true,sharedExistingNamespaceVerified:true,oldLiveTrafficUnchanged:true,previewTestMediaOwnerUnchanged:true,newNamespace:false,secretRotation:false,hostingChanged:false,userWrites:0,activationAuthorized:false}));
}
