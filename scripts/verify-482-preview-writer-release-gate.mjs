// #203 app482: fail-closed, GET-only Worker release authorization barrier.
// Executes BEFORE Wrangler deploy. Does not change Flags, Worker, DB, R2 or cron.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const AUDITED_APP481_SHA='5bf84dee4c9db7f0ce8296a57781be9161d8e59f';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const FLAGS=[
  'SORIDRAW_CURATED_WRITER_SHADOW471',
  'SORIDRAW_CURATED_SHARED_V466',
  'SORIDRAW_CURATED_ALL_WRITERS_READY466',
];
const STAGES=[
  {name:'PREVIEW',worker:'soridraw-explore-preview'},
  {name:'TEST',worker:'soridraw-explore-test'},
  {name:'PRODUCTION',worker:'soridraw-explore-api'},
];
const err=(id)=>{throw Error('APP482_'+id+'_HOLD');};
const demand=(ok,id)=>{if(!ok)err(id);};
const unwrap=(value)=>value?.result;
const uniqueLines=(input,key)=>{
  const found=input.split(/\r?\n/).map(x=>x.trim()).filter(x=>x.startsWith(key+'='));
  demand(found.length===1,'TRIGGER_'+key.toUpperCase()+'_MISSING_OR_DUPLICATE');
  return found[0].slice(key.length+1);
};
export function trigger482(content,selectedSha) {
  demand(typeof content==='string' && content.length<12000,'TRIGGER_UNREADABLE');
  demand(/^[a-f0-9]{40}$/.test(selectedSha||''),'TARGET_SHA_INVALID');
  demand(selectedSha===AUDITED_APP481_SHA,'TARGET_SHA_NOT_AUDITED_APP481');
  const required={
    product_code_target:AUDITED_APP481_SHA,
    curated_writer_only_481:'true',
    app481_source_audit_sha:AUDITED_APP481_SHA,
    preview_only:'true',
    test_production_unchanged_required:'true',
    D1_migration:'false',
    D1_schema_write:'false',
    user_data_backfill:'false',
    hosting_deploy:'false',
    functions_deploy:'false',
    shared_rtdb_rules_deploy:'false',
    repair_shared_like_snapshot_156:'false',
    repair_shared_like_snapshot_191:'false',
  };
  for(const [key,value] of Object.entries(required))
    demand(uniqueLines(content,key)===value,'TRIGGER_'+key.toUpperCase()+'_UNSAFE');
  return selectedSha;
}
const bindingMap482=(payload,stage)=>{
  const rows=unwrap(payload)?.bindings;
  demand(Array.isArray(rows),stage+'_SETTINGS_MISSING');
  const by=new Map();
  for(const x of rows){
    demand(x && typeof x.name==='string' && x.name.length>0
      && !by.has(x.name),stage+'_DUPLICATE_BINDING');
    by.set(x.name,x);
  }
  return by;
};
const idOf=x=>x?.id??x?.database_id??x?.uuid;
export function settings482(payload,stage) {
  const by=bindingMap482(payload,stage.name);
  for(const flag of FLAGS){
    const b=by.get(flag);
    demand(!b || (b.type==='plain_text' && String(b.text??b.value??'')==='0'),
      stage.name+'_'+flag+'_NOT_OFF');
  }
  if(stage.name==='PREVIEW'){
    const exact=[
      ['DB','d1', '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b'],
      ['RATE_DB','d1','aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'],
      ['PROFILE_MEDIA','r2_bucket','soridraw-profile-media'],
      ['EXPLORE_CACHE','r2_bucket','soridraw-profile-media-preview'],
    ];
    for(const [name,type,identity] of exact){
      const b=by.get(name);
      demand(b?.type===type && (type==='d1'?idOf(b):b?.bucket_name)===identity,
        'PREVIEW_'+name+'_BINDING_MISMATCH');
    }
    demand(by.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.type==='durable_object_namespace',
      'PREVIEW_REPAIR_DO_UNAVAILABLE');
  }
  return true;
}
export function deployment482(payload,stage) {
  const deployments=unwrap(payload)?.deployments;
  demand(Array.isArray(deployments)&&deployments.length>0,stage.name+'_DEPLOYMENT_UNKNOWN');
  const v=deployments[0]?.versions;
  demand(Array.isArray(v)&&v.length===1
    && typeof v[0].version_id==='string'&&v[0].version_id.length>20
    && Number(v[0].percentage)===100,stage.name+'_SPLIT_OR_UNVERIFIED_VERSION');
  return v[0].version_id;
}
export function pending482(payload){
  demand(Array.isArray(payload),'LIKE069_RESPONSE_INVALID');
  const rows=payload.flatMap(p=>Array.isArray(p?.results)?p.results:[]);
  demand(rows.length===1 && Object.prototype.hasOwnProperty.call(rows[0],'pending069'),
    'LIKE069_COUNT_MISSING_OR_AMBIGUOUS');
  const v=rows[0].pending069;
  demand((typeof v==='number'||typeof v==='string') && String(v).trim()!==''
    && Number.isSafeInteger(Number(v)) && Number(v)>=0,'LIKE069_COUNT_INVALID');
  demand(Number(v)===0,'LIKE069_PENDING_NOT_ZERO');
  return 0;
}
export function cron482(value) {
  demand(Array.isArray(value)&&value.length===0,'PREVIEW_CRON_NOT_EMPTY');
  return true;
}
// Unlike a stored cron snapshot, this checks the actual schedule again
// immediately before uploading the Worker. Unknown API shape is HOLD.
export function remoteCronResult482(payload) {
  demand(payload?.success===true && Array.isArray(payload?.result?.schedules),
    'REMOTE_CRON_RESPONSE_UNVERIFIED');
  cron482(payload.result.schedules);
  return true;
}
async function liveCron482() {
  const token=process.env.CLOUDFLARE_API_TOKEN;
  demand(typeof token==='string'&&token.length>10,'CLOUDFLARE_TOKEN_UNAVAILABLE');
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'
    +ACCOUNT+'/workers/scripts/soridraw-explore-preview/schedules',{
    method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    signal:AbortSignal.timeout(15000),
  });
  demand(response.ok,'REMOTE_CRON_HTTP_'+response.status);
  remoteCronResult482(await response.json());
  console.log('APP482_PREVIEW_LIVE_CRON_EMPTY=PASS');
}
async function cloudflare482({flagsOnly=false}={}){
  const token=process.env.CLOUDFLARE_API_TOKEN;
  demand(typeof token==='string'&&token.length>10,'CLOUDFLARE_TOKEN_UNAVAILABLE');
  demand(!process.env.CLOUDFLARE_ACCOUNT_ID
    ||process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_UNEXPECTED');
  const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
  const load=async path=>{
    const response=await fetch(root+path,{method:'GET',headers:{
      Authorization:'Bearer '+token,Accept:'application/json',
    },signal:AbortSignal.timeout(15000)});
    demand(response.ok,'REMOTE_HTTP_'+response.status);
    const data=await response.json();
    demand(data?.success===true&&data.result!=null,'REMOTE_RESPONSE_INVALID');
    return data;
  };
  for(const stage of STAGES){
    settings482(await load('/workers/scripts/'+stage.worker+'/settings'),stage);
    if(!flagsOnly)
      deployment482(await load('/workers/scripts/'+stage.worker+'/deployments'),stage);
    console.log('APP482_'+stage.name+'_REMOTE_FLAGS_OFF_AND_BINDINGS=PASS');
  }
  console.log('APP482_REMOTE_GET_ONLY=PASS');
}
function selfTest482() {
  const mock=Object.fromEntries(Object.entries({
    product_code_target:AUDITED_APP481_SHA,
    curated_writer_only_481:'true',
    app481_source_audit_sha:AUDITED_APP481_SHA,
    preview_only:'true',
    test_production_unchanged_required:'true',
    D1_migration:'false',D1_schema_write:'false',user_data_backfill:'false',
    hosting_deploy:'false',functions_deploy:'false',shared_rtdb_rules_deploy:'false',
    repair_shared_like_snapshot_156:'false',repair_shared_like_snapshot_191:'false',
  }).map(([k,v])=>[k,v]));
  const trigger=Object.entries(mock).map(([k,v])=>k+'='+v).join('\n')+'\n';
  assert.equal(trigger482(trigger,AUDITED_APP481_SHA),AUDITED_APP481_SHA);
  for(const [k,v] of Object.entries(mock)) {
    assert.throws(()=>trigger482(trigger.replace(k+'='+v,k+'=1'),AUDITED_APP481_SHA),/APP482_/);
    assert.throws(()=>trigger482(trigger+k+'='+v+'\n',AUDITED_APP481_SHA),/APP482_/);
  }
  assert.throws(()=>trigger482(trigger,'1'.repeat(40)),/APP482_TARGET_SHA_NOT_AUDITED_APP481_HOLD/);
  assert.throws(()=>trigger482(trigger.replace('curated_writer_only_481=true',''),AUDITED_APP481_SHA),/APP482_/);
  const preview={bindings:[
    {name:'DB',type:'d1',id:'217ef5b1-5d80-4f7c-afc7-9e07eb05c06b'},
    {name:'RATE_DB',type:'d1',id:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'},
    {name:'PROFILE_MEDIA',type:'r2_bucket',bucket_name:'soridraw-profile-media'},
    {name:'EXPLORE_CACHE',type:'r2_bucket',bucket_name:'soridraw-profile-media-preview'},
    {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace'},
  ]};
  const v={result:preview};
  assert.equal(settings482(v,STAGES[0]),true);
  for(const flag of FLAGS){
    assert.throws(()=>settings482({result:{bindings:[
      ...preview.bindings,{name:flag,type:'plain_text',text:'1'},
    ]}},STAGES[0]),/NOT_OFF/);
    assert.throws(()=>settings482({result:{bindings:[
      ...preview.bindings,{name:flag,type:'secret_text'},
    ]}},STAGES[0]),/NOT_OFF/);
    assert.equal(settings482({result:{bindings:[
      ...preview.bindings,{name:flag,type:'plain_text',text:'0'},
    ]}},STAGES[0]),true);
  }
  assert.throws(()=>settings482({result:{bindings:preview.bindings.filter(x=>x.name!=='EXPLORE_CACHE')}},STAGES[0]),/BINDING_MISMATCH/);
  assert.throws(()=>settings482({result:{bindings:preview.bindings.concat(preview.bindings[0])}},STAGES[0]),/DUPLICATE_BINDING/);
  for(const stage of STAGES.slice(1)){
    assert.equal(settings482({result:{bindings:[]}},stage),true);
    assert.throws(()=>settings482({result:{bindings:[{name:FLAGS[1],type:'plain_text',text:'1'}]}},stage),/NOT_OFF/);
  }
  const dep={result:{deployments:[{versions:[{version_id:'a'.repeat(30),percentage:100}]}]}};
  assert.equal(deployment482(dep,STAGES[0]),'a'.repeat(30));
  assert.throws(()=>deployment482({result:{deployments:[{versions:[
    {version_id:'a'.repeat(30),percentage:90},{version_id:'b'.repeat(30),percentage:10},
  ]}]}},STAGES[0]),/SPLIT_OR_UNVERIFIED_VERSION/);
  assert.throws(()=>deployment482({result:{deployments:[]}},STAGES[0]),/DEPLOYMENT_UNKNOWN/);
  assert.equal(pending482([{results:[{pending069:0}]}]),0);
  for(const bad of [[],[{results:[]}],[{results:[{pending069:1}]}],
    [{results:[{pending069:-1}]}],[{results:[{pending069:null}]}],
    [{results:[{pending069:'abc'}]}],[{results:[{pending069:0},{pending069:0}]}]])
    assert.throws(()=>pending482(bad),/APP482_/);
  assert.equal(cron482([]),true);
  assert.equal(remoteCronResult482({success:true,result:{schedules:[]}}),true);
  assert.throws(()=>remoteCronResult482({success:false,result:{schedules:[]}}),/APP482_REMOTE_CRON_RESPONSE_UNVERIFIED_HOLD/);
  assert.throws(()=>remoteCronResult482({success:true,result:{}}),/APP482_REMOTE_CRON_RESPONSE_UNVERIFIED_HOLD/);
  assert.throws(()=>remoteCronResult482({success:true,result:{schedules:[{cron:'* * * * *'}]}}),/APP482_PREVIEW_CRON_NOT_EMPTY_HOLD/);
  assert.throws(()=>cron482([{cron:'* * * * *'}]),/APP482_PREVIEW_CRON_NOT_EMPTY_HOLD/);
  // Verify the actual release wiring too, not only unit-sized mock inputs.
  const flow=readFileSync('.github/workflows/cloudflare-explore-preview-release.yml','utf8');
  const currentTrigger=readFileSync('.deploy/preview-worker-release.trigger','utf8');
  assert.throws(()=>trigger482(currentTrigger,AUDITED_APP481_SHA),/APP482_/,
    'obsolete app434 trigger must never release app481');
  assert.match(flow,/ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(flow,/--trigger "\$RUNNER_TEMP\/app482-release-request\.txt" "\$target"/);
  assert.match(flow,/--pending-file "\$RUNNER_TEMP\/like069-before-deploy\.json"/);
  assert.match(flow,/--cron-file "\$RUNNER_TEMP\/preview-crons-before\.json"/);
  assert.match(flow,/node "\$RUNNER_TEMP\/app482-writer-gate\.mjs" --remote-cron/);
  assert.match(flow,/node "\$RUNNER_TEMP\/app482-writer-gate\.mjs" --remote-flags/);
  assert.doesNotMatch(flow,/POST_DEPLOY_PENDING_069_TEMP_CRON=ENABLED/);
  assert.doesNotMatch(flow,/needs_pending_drain/);
  assert.doesNotMatch(flow,/PREVIEW_FIXED_CRON_CLEAR=PASS/);
  console.log('APP482_EXACT_APP481_RELEASE_TRIGGER_AND_NO_REPAIR=PASS');
  console.log('APP482_3_ENV_OFF_BINDINGS_AND_VERSION_FIXTURES=PASS');
  console.log('APP482_LIKE069_ZERO_ONLY_AND_EMPTY_CRON_FIXTURES=PASS');
  console.log('APP482_REMOTE_AND_DEPLOYMENT=NOT_RUN');
}
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--self-test')selfTest482();
else if(args.length===3&&args[0]==='--trigger'){
  const file=readFileSync(args[1],'utf8');
  trigger482(file,args[2]);
  console.log('APP482_EXACT_AUDITED_TRIGGER_WITHOUT_REPAIR=PASS');
}else if(args.length===1&&args[0]==='--remote')await cloudflare482();
else if(args.length===1&&args[0]==='--remote-flags')await cloudflare482({flagsOnly:true});
else if(args.length===1&&args[0]==='--remote-cron')await liveCron482();
else if(args.length===2&&args[0]==='--pending-file'){
  pending482(JSON.parse(readFileSync(args[1],'utf8')));
  console.log('APP482_PENDING069_ZERO=PASS');
}else if(args.length===2&&args[0]==='--cron-file'){
  cron482(JSON.parse(readFileSync(args[1],'utf8')));
  console.log('APP482_CRON_EMPTY=PASS');
}else err('CLI_USAGE');
