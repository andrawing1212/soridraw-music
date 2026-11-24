// One bounded QA Worker on the director-confirmed Free account. No live production bindings.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const QA='b60fcd62c679c64db19f0b0e0c2f3429',BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const OLD='soridraw-owner-qa-583',OLD_VERSION='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const RUN=process.env.GITHUB_RUN_ID,NAME='soridraw-qa-like-handoff-'+RUN;
const DIR=process.env.RUNNER_TEMP,read=process.env.CLOUDFLARE_QA_API_TOKEN,deploy=process.env.CLOUDFLARE_QA_DEPLOY_TOKEN;
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_ACTOR===process.env.GITHUB_REPOSITORY_OWNER&&process.env.GITHUB_REF==='refs/heads/qa/full-release-handoff-safety'&&process.env.GITHUB_RUN_ATTEMPT==='1'&&/^\d{8,20}$/.test(RUN)&&DIR&&read&&deploy,'QA_SCOPE');
const path='/workers/scripts/'+NAME, state=join(DIR,'like-handoff-qa-state.json'),delay=n=>new Promise(r=>setTimeout(r,n));
async function api(p,method='GET',body,token=read){
 assert(p.startsWith('/workers/scripts/'+OLD+'/deployments')||p===path||p===path+'/subdomain','QA_PATH_SCOPE');
 const form=body instanceof FormData;
 const r=await fetch(BASE+p,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const j=await r.json().catch(()=>null);
 return {status:r.status,ok:r.ok&&j?.success===true,result:j?.result,errors:(j?.errors||[]).map(e=>Number(e.code)).filter(Number.isSafeInteger)};
}
const checked=(r,label)=>assert(r.ok,label+'_HTTP_'+r.status+'_CODES_'+r.errors.join('_'));
async function baseline(){
 const d=await api('/workers/scripts/'+OLD+'/deployments');checked(d,'ORIGINAL_QA');
 const v=d.result?.deployments?.[0]?.versions;
 assert(v?.length===1&&v[0].version_id===OLD_VERSION&&Number(v[0].percentage)===100,'ORIGINAL_QA_DRIFT');
}
const origin='https://'+NAME+'.soridraw-qa.workers.dev';
async function request(access,p,body){
 const r=await fetch(origin+'/qa',{method:'POST',redirect:'error',headers:{'X-QA-Access':access,'X-QA-Command':p.slice(1),'Content-Type':'application/json'},body:JSON.stringify(typeof body==='string'?{mode:body}:body??{}),signal:AbortSignal.timeout(10000)});
 const data=await r.json().catch(()=>null);
 if(r.status===404)console.log('QA_HTTP_404 '+JSON.stringify({command:p,marked:r.headers.has('X-SORIDRAW-QA-Route'),contentType:r.headers.get('content-type'),server:r.headers.get('server')}));
 return {status:r.status,data,route:r.headers.get('X-SORIDRAW-QA-Route')||'provider-or-unmarked',code:typeof data?.code==='string'?data.code:'none'};
}
async function run(){
 await baseline();
 assert.equal((await api(path)).status,404,'TEMP_NAME_COLLISION');
 const access=randomBytes(32).toString('hex');
 writeFileSync(state,JSON.stringify({name:NAME,access}),{mode:0o600});
 const worker=readFileSync('scripts/full-release-handoff-qa-worker.mjs','utf8');
 const adapter=readFileSync('scripts/full-release-shared-like-scheduler.mjs','utf8');
 const metadata={main_module:'worker.mjs',compatibility_date:'2026-06-17',bindings:[
 {type:'durable_object_namespace',name:'EXPLORE_LIKE_BATCH_SCHEDULER',class_name:'Legacy'},
 {type:'durable_object_namespace',name:'RELEASE_SHARED_LIKE_SCHEDULER',class_name:'Shared'},
 {type:'plain_text',name:'SORIDRAW_ENVIRONMENT',text:'production'},
 {type:'secret_text',name:'QA_ACCESS',text:access}
 ],migrations:{new_tag:'v1',new_sqlite_classes:['Legacy','Shared']}};
 const form=new FormData();
 form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}),'metadata.json');
 for(const [name,code] of [['worker.mjs',worker],['adapter.mjs',adapter]])form.append(name,new Blob([code],{type:'application/javascript+module'}),name);
 checked(await api(path,'PUT',form,deploy),'UPLOAD_SQLITE_QA_ONLY');
 checked(await api(path+'/subdomain','POST',{enabled:true,previews_enabled:false},deploy),'QA_ROUTE');
 let ready=false;
 for(let i=0;i<12;i++){try{const denied=await request('invalid','/legacy/state'),legacy=await request(access,'/legacy/state'),shared=await request(access,'/shared/state');if(denied.status===403&&denied.route==='entry'&&legacy.status===200&&legacy.route==='legacy'&&shared.status===200&&shared.route==='shared'){ready=true;break}}catch{}await delay(1500)}
 assert(ready,'QA_HTTP_NOT_READY');
 console.log('PHYSICAL_QA_SQLITE_WORKER_AND_ACCESS=PASS');
 const call=async(p,b)=>{const x=await request(access,p,b);assert.equal(x.status,200,p+' route='+x.route+' code='+x.code);return x.data};
 const until=async(fn)=>{for(let i=0;i<25;i++){if(await fn())return;await delay(1500)}throw Error('BOUNDED_ALARM_TIMEOUT')};
 await call('/shared/mode','fail');await call('/legacy/seed',{marker:100,alarm:true});
 await until(async()=> (await call('/shared/state')).attempts>=1);
 assert.equal((await call('/legacy/state')).marker,100,'FAILED_ALARM_LOST_MARKER');
 assert.equal((await call('/shared/state')).writes,0);
 await call('/shared/mode','settled');
 await until(async()=> (await call('/legacy/state')).marker===null);
 assert.deepEqual(await call('/legacy/state'),{marker:null,unrelated:'preserve'});
 assert.equal((await call('/shared/state')).writes,1);
 console.log('PHYSICAL_QA_REAL_ALARM_503_AUTOMATIC_RETRY=PASS');
 await call('/legacy/invoke');assert.equal((await call('/shared/state')).writes,1);
 await call('/legacy/seed',{marker:200,alarm:false});await call('/shared/mode','ambiguous');await call('/legacy/invoke');
 assert.equal((await call('/legacy/state')).marker,200);
 await call('/shared/mode','fail');assert.equal((await request(access,'/legacy/invoke')).status,503);assert.equal((await call('/legacy/state')).marker,200);
 await call('/shared/mode','settled');await call('/legacy/invoke');
 assert.deepEqual(await call('/legacy/state'),{marker:null,unrelated:'preserve'});
 assert.equal((await call('/shared/state')).writes,1);
 console.log('PHYSICAL_QA_ADAPTER_MARKER_AND_SYNTHETIC_DUPLICATE=PASS; CANONICAL_E2E_NOT_RUN');
}
async function cleanup(){
 if(!existsSync(state)){console.log('PHYSICAL_QA_NOT_CREATED');return}
 const s=JSON.parse(readFileSync(state,'utf8'));assert.equal(s.name,NAME);
 for(const p of ['/legacy/clean','/shared/clean'])try{await request(s.access,p)}catch{}
 const d=await api(path,'DELETE',undefined,deploy);
 assert(d.ok||d.status===404,'TEMP_DELETE_HTTP_'+d.status+'_CODES_'+d.errors.join('_'));
 let gone=false;
 for(let i=0;i<8;i++){if((await api(path)).status===404){gone=true;break}await delay(1000)}
 assert(gone,'TEMP_WORKER_STILL_PRESENT');await baseline();
 console.log('PHYSICAL_QA_TEMP_WORKER_REMOVED_ORIGINAL_QA583_UNCHANGED=PASS');
}
if(process.argv[2]==='run')await run();else if(process.argv[2]==='cleanup')await cleanup();else throw Error('BAD_PHASE');
