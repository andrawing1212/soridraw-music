#!/usr/bin/env node
// APP626: pin APP613 & APP620 service binding versions and add secrets
// atomically PER WORKER to new UNUSED versions using only admin OAuth.
// Never deploy either worker, never touch storage, auth, IAM or user records.
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const PROJECT='soridraw-app-866a5';
const DATE='2026-08-28';
const W=[
 {name:'soridraw-explore-preview',candidate:'74424822-2857-4f67-aff2-d4970f71cefa',active:'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',old:24,modules:12,
  main:'owner-follow-entry-607.mjs',tag:'app626-explore-atomic-owner-secrets',
  additions:['SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','SORIDRAW_OWNER_DO_BRIDGE_SECRET_600']},
 {name:'soridraw-owner-follow-preview-candidate',candidate:'cdaceda1-c97d-4a46-8fee-a6b8ec71eedd',active:'5a2d333c-f703-4ef7-9468-0293f7699268',old:3,modules:1,
  main:null,tag:'app626-standalone-atomic-owner-secret',additions:['SORIDRAW_OWNER_DO_BRIDGE_SECRET_600']}
];
const bad=(id)=>{throw Error('APP626_HOLD_'+id)};
const ok=(v,id)=>{if(!v)bad(id)};
const hash=s=>createHash('sha256').update(s).digest('hex');
function command(name,args,max=8192){
 try{return execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:30000,maxBuffer:max}).trim()}
 catch{bad('COMMAND_'+name.toUpperCase().replace(/\W/g,'_'))}
}
function sec(name){
 let raw;
 try{raw=execFileSync('gcloud',['secrets','versions','access','latest',
  '--project='+PROJECT,'--secret='+name],{stdio:['ignore','pipe','ignore'],
  timeout:30000,maxBuffer:4096})}catch{bad('GCP_SECRET_READ_'+name)}
 ok(raw.length>=32&&raw.length<=256&&
  [...raw].every(byte=>byte>=32&&byte<=126),'GCP_SECRET_FORMAT_'+name);
 return raw.toString('utf8');
}
async function main(){
 ok(process.argv.length===3&&process.argv[2]==='--stage','MODE');
 ok(!process.env.CLOUDFLARE_API_TOKEN&&!process.env.CLOUDFLARE_API_KEY,'OVERRIDE_TOKEN_FORBIDDEN');
 ok(command('gcloud',['projects','describe',PROJECT,'--format=value(projectId)'])===PROJECT,'PROJECT');
 const identity=command('gcloud',['auth','list','--filter=status:ACTIVE','--format=value(account)']);
 ok(identity.length>3&&!identity.includes('.gserviceaccount.com'),'HUMAN_ADMIN_REQUIRED');
 const authRaw=command('npx',['--yes','wrangler@4.119.0','auth','token','--json'],16384);
 let auth;try{auth=JSON.parse(authRaw)}catch{bad('WRANGLER_OAUTH_JSON')}
 ok(auth?.type==='oauth'&&typeof auth.token==='string'&&auth.token.length>20,'WRANGLER_OAUTH_NOT_READY');
 const token=auth.token;
 const body={};
 async function api(method,path,options={}){
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
   method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
     ...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(options)}:{}),signal:AbortSignal.timeout(method==='POST'?55000:23000)
  });
  let data;try{data=await response.json()}catch{bad('API_UNCERTAIN_'+method+'_NO_RETRY')}
  if(!response.ok||data?.success!==true){
   console.log('APP626_API_CODE='+String((data?.errors||[]).map(e=>e.code).join(',')).slice(0,60));
   bad('API_'+method+'_HTTP_'+response.status+'_NO_RETRY');
  }
  return data.result;
 }
 async function deployment(w){
  const d=await api('GET','workers/scripts/'+w.name+'/deployments?per_page=1');
  const versions=d?.deployments?.[0]?.versions;
  ok(Array.isArray(versions)&&versions.length===1&&versions[0].version_id===w.active
    &&Number(versions[0].percentage)===100,'ACTIVE_VERSION_CHANGED_'+w.name);
 }
 function bindings(list,count,label){
  ok(Array.isArray(list)&&list.length===count,'BINDING_COUNT_'+label);
  const map=new Map(list.map(x=>[x.name,x]));ok(map.size===list.length,'BINDING_DUP_'+label);
  ok(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','NOT_PREVIEW_'+label);
  if(label.startsWith('soridraw-explore')){
   ok(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
    'LIKE_DO_CHANGED');
   ok(map.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.type==='service'&&
    map.get('OWNER_FOLLOW_RESERVATION_SERVICE_600').service==='soridraw-owner-follow-preview-candidate',
    'EXISTING_FORWARD_BINDING_MISSING');
  }else{
   ok(map.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600','OWNER_DO_CHANGED');
   const v=map.get('OWNER_FOLLOW_CANONICAL_REPLAY_600');
   ok(v?.type==='service'&&v.service==='soridraw-explore-preview'&&
    v.entrypoint==='OwnerFollowReplayEntrypoint607','REVERSE_BINDING_MISSING');
  }
  return map;
 }
 function comparable(a,b){
  for(const key of ['type','class_name','service','entrypoint','id','database_id','uuid','bucket_name','bucket','namespace_id','text']){
   if(key==='text'&&a.type==='secret_text')continue;
   if(a[key]!==undefined||b[key]!==undefined)ok(a[key]===b[key],'BINDING_IDENTITY_'+a.name+'_'+key);
  }
 }
 const preparations=[];
 // Finish ALL GET-only checks for both workers before any write.
 for(const w of W){
  await deployment(w);
  const root='workers/scripts/'+w.name;
  const candidate=await api('GET',root+'/versions/'+w.candidate);
  const before=bindings(candidate?.resources?.bindings,w.old,w.name);
  const runtime=candidate?.resources?.script_runtime||{};
  ok(runtime.compatibility_date===DATE,'COMPATIBILITY_CHANGED_'+w.name);
  // Cloudflare's inactive versions may omit this optional response field.
  // When missing, verify the already-active, previously audited DO migration
  // tag instead. An unexpected explicit value always remains a hard HOLD.
  const expectedMigration=w.old===24?'v1':'owner600_v1';
  if(runtime.migration_tag===undefined){
   const originalActive=await api('GET',root+'/versions/'+w.active);
   ok(originalActive?.resources?.script_runtime?.migration_tag===expectedMigration,
    'ACTIVE_MIGRATION_TAG_'+w.name);
   console.log('APP627_INACTIVE_TAG_OPTIONAL_ACTIVE_DO_PINNED_'+w.name+'=PASS');
  }else{
   ok(runtime.migration_tag===expectedMigration,'MIGRATION_TAG_DRIFT_'+w.name);
  }
  for(const name of w.additions)ok(!before.has(name),'SECRET_ALREADY_PRESENT_'+name);
  const code=await api('GET','workers/workers/'+w.name+'/versions/'+w.candidate+'?include=modules');
  const modules=code?.modules;
  ok(Array.isArray(modules)&&modules.length===w.modules,'MODULES_COUNT_'+w.name);
  const main=w.main??(modules.length===1?modules[0].name:null);
  ok(typeof main==='string'&&modules.some(x=>x.name===main),'MAIN_MODULE_UNVERIFIED_'+w.name);
  const source=modules.map(m=>{
   ok(typeof m.name==='string'&&typeof m.content_base64==='string'&&m.content_base64.length>50,
    'MODULE_BYTES_UNAVAILABLE_'+w.name);
   return {name:m.name,content_type:m.content_type||'application/javascript+module',
    content_base64:m.content_base64};
  });
  ok(new Set(source.map(x=>x.name)).size===source.length,'DUPLICATE_MODULE');
  // Fail closed if any previous attempt might already have created a version.
  const listed=await api('GET',root+'/versions?per_page=100');
  const arr=Array.isArray(listed)?listed:(listed?.versions||listed?.items||[]);
  ok(Array.isArray(arr),'VERSIONS_LIST_UNRECOGNIZED');
  ok(!arr.some(x=>x?.metadata?.tag===w.tag||x?.annotations?.['workers/tag']===w.tag),
    'PREVIOUS_ATTEMPT_MAY_EXIST_'+w.name);
  preparations.push({w,before,runtime,source,main});
  console.log('APP626_SOURCE_PINNED_'+w.name+'=PASS');
 }
 const hmac539=sec('SORIDRAW_OWNER_FOLLOW_HMAC_539');
 const hmac544=sec('SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544');
 const bridge=randomBytes(32).toString('hex');
 const secrets={SORIDRAW_OWNER_FOLLOW_HMAC_539:hmac539,
  SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:hmac544,
  SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:bridge};
 console.log('APP626_GCP_EXACT_TWO_HMAC_AND_PRIVATE_BRIDGE=PASS');
 const newVersions=[];
 for(const {w,before,runtime,source,main} of preparations){
  await Promise.all(W.map(deployment));
  const binds=[
    ...[...before.keys()].sort().map(name=>({name,type:'inherit',version_id:w.candidate})),
    ...w.additions.map(name=>({name,type:'secret_text',text:secrets[name]}))
  ];
  ok(binds.length===w.old+w.additions.length,'PAYLOAD_BINDINGS_LENGTH');
  const payload={
   main_module:main,compatibility_date:DATE,compatibility_flags:runtime.compatibility_flags||[],
   annotations:{'workers/tag':w.tag,'workers/message':'APP626 exact pinned services + atomic secrets, NOT DEPLOYED'},
   modules:source,bindings:binds
  };
  ok(!('migrations' in payload)&&!('deploy' in payload),'MIGRATION_OR_DEPLOY_IN_PAYLOAD');
  const uploaded=await api('POST','workers/workers/'+w.name+'/versions?deploy=false',payload);
  const id=String(uploaded?.id||'');
  ok(/^[0-9a-f-]{36}$/.test(id)&&id!==w.candidate,'NEW_VERSION_BAD');
  console.log('APP626_NEW_INACTIVE_VERSION_'+w.name+'='+id);
  newVersions.push({name:w.name,id});
  // Postflight: original bindings and code must not change. Secret text is
  // not read back; only confirm the three/four NAMES, types and immutability.
  const [after,afterCode]=await Promise.all([
    api('GET','workers/scripts/'+w.name+'/versions/'+id),
    api('GET','workers/workers/'+w.name+'/versions/'+id+'?include=modules')
  ]);
  const bound=bindings(after?.resources?.bindings,w.old+w.additions.length,w.name);
  for(const [name,b] of before)comparable(b,bound.get(name)||{name});
  for(const name of w.additions)ok(bound.get(name)?.type==='secret_text','SECRET_BINDING_MISSING_'+name);
  ok(after.resources.script_runtime.compatibility_date===DATE,'DATE_MISMATCH_'+w.name);
  ok([undefined,runtime.migration_tag].includes(after.resources.script_runtime.migration_tag),
    'MIGRATION_CHANGED_'+w.name);
  const hashes=new Map(source.map(m=>[m.name,hash(Buffer.from(m.content_base64,'base64'))]));
  ok(afterCode?.modules?.length===source.length,'POST_MODULE_COUNT_'+w.name);
  for(const m of afterCode.modules)ok(hashes.get(m.name)===hash(Buffer.from(m.content_base64||'','base64')),
   'POST_MODULE_CHANGED_'+m.name);
  await Promise.all(W.map(deployment));
  console.log('APP626_BINDINGS_MODULES_AND_ACTIVE_UNCHANGED_'+w.name+'=PASS');
 }
 console.log('APP626_BOTH_INACTIVE_VERSIONS_ATOMIC_HMAC_AND_BRIDGE=PASS');
 console.log('APP626_NO_TRAFFIC_CHANGE_NO_DATA_OR_RULES_CHANGE=PASS');
}
if(process.argv[2]==='--self-test'){
 if(W.length!==2||W[0].old!==24||W[1].old!==3)bad('SOURCE_CONFIG');
 console.log('APP626_SOURCE_GATES=PASS');
}else{
 try{await main()}catch(e){console.error(String(e?.message||'APP626_HOLD_UNKNOWN'));process.exitCode=2}
}
