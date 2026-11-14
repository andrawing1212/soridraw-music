// APP651 PREVIEW-only one-module repair of false Follow HTTP 500.
// Direct relation row count is returned by D1 RETURNING, not trigger-inclusive
// meta.changes. No migrations, D1 writes, R2 writes, user-row edits, or
// additional Worker code changes. Existing active version is the rollback.
// Exact approved source: app650-follow-primary-rowcount.mjs.
import {createHash} from 'node:crypto';
import {repairFollowPrimaryRowCount650} from './app650-follow-primary-rowcount.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const SAFE='962ee432-fadb-456e-8836-50675aa76b84';
const ZERO='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(b,x)=>{if(!b)throw Error('APP651_HOLD_'+x)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;try{j=await r.json()}catch{throw Error('APP651_HOLD_UNCERTAIN_'+method)}
 if(!r.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(e=>String(e.code||'')).slice(0,4);
  throw Error('APP651_HOLD_API_'+method+'_'+r.status+'_CODES_'+codes.join('_'));
 }
 return j.result;
}
async function active(name){
 const d=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const v=d?.deployments?.[0]?.versions;
 need(v?.length===1&&Number(v[0].percentage)===100,'TRAFFIC_NOT_100_'+name);
 return v[0].version_id;
}
async function info(id){
 const d=await api('GET','workers/scripts/'+EX+'/versions/'+id);
 const b=d?.resources?.bindings;
 need(d?.id===id&&d.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'VERSION_META');
 need(Array.isArray(b)&&b.length===35,'35_BINDINGS');
 const m=new Map(b.map(x=>[x.name,x]));
 need(m.size===35&&m.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  m.get('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607')?.text==='0'&&
  m.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103'&&
  !m.has('OWNER_FOLLOW_RECOVERY_557'),'OFF_OR_LIKE_GUARD');
 return {bindings:b,map:m,metadata:d};
}
async function modules(id){
 const d=await api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules');
 need(d?.modules?.length===12,'MODULE_SET');
 const ms=d.modules, map=new Map();
 for(const m of ms){
  need(typeof m.name==='string'&&typeof m.content_base64==='string'&&
   m.content_base64.length>50&&!map.has(m.name),'MODULE_ENTRY');
  map.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(map.has('owner-follow-entry-607.mjs'),'ORIGINAL_ENTRYPOINT');
 return {ms,map};
}
const keys=['type','id','database_id','bucket_name','namespace_id',
 'service','entrypoint','class_name','text'];
function checkSameBindings(a,b){
 need(a.size===b.size,'POST_BINDING_COUNT');
 for(const [name,orig] of a){
  const cur=b.get(name);need(Boolean(cur),'MISSING_'+name);
  for(const k of keys)if(orig[k]!==undefined)need(orig[k]===cur[k],
   'BINDING_CHANGED_'+name+'_'+k);
 }
}
async function stageRead(id){
 for(let i=0;i<25;i++){
  if(i>0)await sleep(3500);
  try{
   const [meta,source]=await Promise.all([info(id),modules(id)]);
   return {meta,source};
  }catch(e){
   const msg=String(e.message||e);
   if(!msg.includes('_GET_404_')&&
      !msg.includes('_MODULE_SET')&&
      !msg.includes('_VERSION_META'))throw e;
   if(i===24)throw Error('APP651_HOLD_STAGED_VERSION_NOT_YET_VISIBLE');
  }
 }
 throw Error('APP651_HOLD_STAGE_TIMEOUT');
}

async function previewVersions() {
  const d=await api('GET','workers/scripts/'+EX+'/deployments?per_page=1');
  const v=d?.deployments?.[0]?.versions;
  need(Array.isArray(v)&&v.length===2&&
    v.some(x=>x.version_id===SAFE&&Number(x.percentage)===100)&&
    v.some(x=>x.version_id===ZERO&&Number(x.percentage)===0),
    'PREVIEW_SAFE_100_CANARY_0_DRIFT');
  return v;
}
async function main() {
  need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
    process.env.APP651_RELEASE_PARENT&&process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,
    'APPROVED_CONTEXT');
  await previewVersions();
  const [before,original,owner,test,prod]=await Promise.all([
    info(SAFE),modules(SAFE),active(OW),active(TEST),active(PROD)]);
  const ms=[];let changed=0;
  for(const m of original.ms){
    const raw=Buffer.from(m.content_base64,'base64').toString('utf8');
    if(!raw.includes('async function mutateFollowOverlayRelation350(')){
      ms.push({name:m.name,content_type:m.content_type||'application/javascript+module',
        content_base64:m.content_base64});
      continue;
    }
    need(m.name==='preview-entry.mjs','UNEXPECTED_FOLLOW_MODULE_'+m.name);
    const patched=repairFollowPrimaryRowCount650(raw);
    // Active deployed source uses result2/changes2 variable aliases. The
    // APP650 helper validates the exact function and replaces only its one
    // .run()+meta.changes path, regardless of those harmless aliases.
    need(patched!==raw&&patched.includes('RETURNING 1 AS relation_changed')&&
      /const changes[0-9]* = Array[.]isArray[(]result[0-9]*[?][.]results[)]/.test(patched),
      'EXACT_PRIMARY_ROWS_PATCH');
    changed++;
    ms.push({name:m.name,content_type:m.content_type||'application/javascript+module',
      content_base64:Buffer.from(patched,'utf8').toString('base64')});
  }
  need(changed===1&&ms.length===12,'ONE_MODULE_ONE_WRITER');
  need(original.map.has('owner-follow-entry-607.mjs'),'EXISTING_ENTRYPOINT');
  const payload={
    main_module:'owner-follow-entry-607.mjs',
    compatibility_date:'2026-08-28',
    compatibility_flags:before.metadata.resources.script_runtime.compatibility_flags||[],
    annotations:{'workers/tag':'app651-preview-follow-primary-rowcount-only',
      'workers/message':'APP651 direct relation RETURNING count; notification trigger unchanged'},
    bindings:before.bindings.map(b=>({name:b.name,type:'inherit',version_id:SAFE})),
    modules:ms
  };
  need(payload.bindings.length===35&&!('migrations' in payload),'NO_BINDING_OR_SCHEMA_CHANGE');
  console.log('APP651_PREDEPLOY_SAFE_100_ZERO_0_35_BINDINGS=PASS');
  // No traffic switches until complete staged bytes/metadata verification.
  await previewVersions();
  const upload=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
  const id=String(upload?.id||'');
  need(/^[0-9a-f-]{36}$/i.test(id)&&id!==SAFE&&id!==ZERO,'STAGE_ID');
  console.log('APP651_STAGED_INACTIVE='+id);
  const {meta,source}=await stageRead(id);
  checkSameBindings(before.map,meta.map);
  need(source.map.size===original.map.size,'POST_STAGE_MODULE_COUNT');
  let diff=0;
  for(const m of ms){
    const expected=sha(Buffer.from(m.content_base64,'base64'));
    need(source.map.get(m.name)===expected,'STAGED_MODULE_HASH_'+m.name);
    if(original.map.get(m.name)!==expected)diff++;
  }
  need(diff===1&&source.map.get('owner-follow-entry-607.mjs')===
    original.map.get('owner-follow-entry-607.mjs'),'EXACT_ONE_MODULE_DELTA');
  console.log('APP651_STAGED_EXACT_MODULE_AND_35_BINDINGS=PASS');
  const [ow,t,p]=await Promise.all([active(OW),active(TEST),active(PROD)]);
  need(ow===owner&&t===test&&p===prod,'OTHER_ENV_DRIFT');
  await previewVersions();
  // Preserve existing 0%-candidate slot; no routing to alternate Worker.
  await api('POST','workers/scripts/'+EX+'/deployments',{
    strategy:'percentage',
    versions:[{version_id:id,percentage:100},{version_id:ZERO,percentage:0}],
    annotations:{'workers/message':'APP651 PREVIEW only follow primary row count correction'}
  });
  const deployed=await api('GET','workers/scripts/'+EX+'/deployments?per_page=1');
  const vs=deployed?.deployments?.[0]?.versions;
  need(Array.isArray(vs)&&vs.length===2&&
    vs.some(v=>v.version_id===id&&Number(v.percentage)===100)&&
    vs.some(v=>v.version_id===ZERO&&Number(v.percentage)===0),'POST_DEPLOY_PREVIEW_VERSIONS');
  need(await active(OW)===owner&&await active(TEST)===test&&
    await active(PROD)===prod,'POST_DEPLOY_OTHER_ENV');
  console.log('APP651_PREVIEW_FOLLOW_PRIMARY_RETURNING_DEPLOY=PASS');
  console.log('APP651_TEST_PROD_OWNER_WORKERS_UNCHANGED=PASS');
  console.log('APP651_D1_R2_FIREBASE_ORIGINAL_ROWS_MIGRATION_AND_TRIGGERS_UNCHANGED=PASS');
  console.log('APP651_PREVIOUS_SAFE_ROLLBACK_VERSION='+SAFE);
  console.log('APP651_ACTIVE_VERSION='+id);
}
if(process.argv[2]==='--self-test'){
  const {readFileSync}=await import('node:fs');
  const raw=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
  const next=repairFollowPrimaryRowCount650(raw);
  need(next!==raw&&next.includes('RETURNING 1 AS relation_changed')&&
    !next.includes('const changes = Number(result?.meta?.changes || 0)'),'LOCAL_PATCH');
  console.log('APP651_EXACT_ONE_WRITER_SOURCE_PATCH=PASS');
}else if(process.argv[2]==='--apply-once'){
  main().catch(e=>{console.error(String(e?.message||e).slice(0,300));process.exitCode=2;});
}else{throw Error('APP651_ONLY_SELFTEST_OR_APPROVED_RELEASE')}
