// APP776 disposable isolated QA-only HTTP integration runner.
// Only one existing QA D1 (exact synthetic row) and existing QA R2 (two exact
// synthetic keys). Never production, TEST, PREVIEW or user-owned follows.
// Based on proven APP768 disposable Worker upload/cleanup path.
import {randomBytes,webcrypto} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const DB='soridraw-qa-app768-d1',R2='soridraw-qa-app768-r2';
const OLD='soridraw-owner-qa-583',OLD_VERSION='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const RUN=process.env.GITHUB_RUN_ID||'',DIR=process.env.RUNNER_TEMP||'';
const STATE=join(DIR||'/tmp','app776-single-run-state.json');
const NAME='soridraw-qa-app776-'+RUN;
const ROW=/^qa776_[a-f0-9]{16}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const issue=x=>{throw Error('APP776_ISOLATED_QA_HOLD_'+x)};
const secret=x=>typeof x==='string'&&x.length>=20;
const delay=n=>new Promise(done=>setTimeout(done,n));
function guard(){
 if(QA===PROD||!DIR||!/^[0-9]{8,20}$/.test(RUN)||
  process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
  process.env.GITHUB_EVENT_NAME!=='issue_comment'||
  process.env.APP783_QA_APPROVAL!=='APP783_ISOLATED_ONLY'||
  process.env.GITHUB_REF!=='refs/heads/main'||
  process.env.CLOUDFLARE_ACCOUNT_ID!==QA)issue('QA_IDENTITY');
 for(const name of ['CLOUDFLARE_QA_API_TOKEN','CLOUDFLARE_QA_DATA_TOKEN',
   'CLOUDFLARE_QA_DEPLOY_TOKEN'])
  if(!secret(process.env[name]))issue('MISSING_EXISTING_QA_TOKEN_'+name);
}
async function api(path,token,method='GET',body){
 if(!path.startsWith(BASE+'/')||!secret(token))issue('OUT_OF_QA_ACCOUNT');
 const r=await fetch(path,{method,redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json',
   'Cache-Control':'no-store',...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(18000)});
 const data=await r.json().catch(()=>null);
 return {http:r.status,ok:r.ok&&data?.success===true,data:data?.result,
  errors:(data?.errors||[]).map(e=>Number(e.code)).filter(Number.isInteger)};
}
function result(r,n){if(r.http!==200||!r.ok)issue(n+'_HTTP_'+r.http);return r.data}
async function baseline(){
 const a=process.env.CLOUDFLARE_QA_API_TOKEN,d=process.env.CLOUDFLARE_QA_DATA_TOKEN;
 const dep=result(await api(BASE+'/workers/scripts/'+OLD+'/deployments',a),'APP583');
 const versions=dep?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
  versions[0]?.version_id!==OLD_VERSION||Number(versions[0]?.percentage)<99.99)
  issue('APP583_ACTIVE_DRIFT');
 const dbs=result(await api(BASE+'/d1/database',d),'D1_LIST');
 const bs=result(await api(BASE+'/r2/buckets',d),'R2_LIST');
 const databases=Array.isArray(dbs)?dbs:dbs?.databases;
 const buckets=Array.isArray(bs)?bs:bs?.buckets;
 if(!Array.isArray(databases)||databases.length!==1||
  databases[0]?.name!==DB||!UUID.test(databases[0].uuid||'')||
  !Array.isArray(buckets)||buckets.length!==1||buckets[0]?.name!==R2)
  issue('ORIGINAL_QA_RESOURCE_DRIFT');
 console.log('APP776_EXISTING_APP583_ACTIVE_100_QA_D1_R2=PASS');
 return databases[0].uuid;
}
function state(){
 if(!existsSync(STATE))return null;
 const s=JSON.parse(readFileSync(STATE,'utf8'));
 if(s.name!==NAME||s.run!==RUN||!UUID.test(s.uuid||'')||
  !ROW.test(s.row||'')||!/^qa776_cutover_[a-f0-9]{32}$/.test(s.cutover||'')||
  !/^[a-f0-9]{64}$/.test(s.access||'')||!/^[a-f0-9]{32}$/.test(s.epoch||''))
  issue('INVALID_EXACT_STATE');
 return s;
}
async function d1(s,sql){
 if(!sql.includes('app768_qa_synthetic_follow')||!sql.includes(s.row)||
  !/^(SELECT|INSERT|DELETE)\b/.test(sql)||sql.length>210||
  /follows|profile_stats|explore_|DROP|ALTER|CREATE/i.test(sql))
  issue('D1_SQL_OUT_OF_SCOPE');
 const data=result(await api(BASE+'/d1/database/'+s.uuid+'/query',
  process.env.CLOUDFLARE_QA_DATA_TOKEN,'POST',{sql}),'EXACT_D1_QUERY');
 const q=Array.isArray(data)&&data.length===1?data[0]:null;
 if(q?.success!==true||!Number.isSafeInteger(q?.meta?.rows_written))
  issue('D1_PHYSICAL_META_UNVERIFIED');
 return q;
}
async function count(s){
 const q=await d1(s,"SELECT COUNT(*) AS n FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
 if(!Number.isSafeInteger(q.results?.[0]?.n)||q.results[0].n>1)
  issue('EXACT_ROW_COUNT_INVALID');
 return q.results[0].n;
}
async function preflight(){
 guard();if(state())issue('RUNNER_STATE_ALREADY_EXISTS');
 const uuid=await baseline();
 const existing=await api(BASE+'/workers/scripts/'+NAME,
  process.env.CLOUDFLARE_QA_API_TOKEN);
 if(existing.http!==404)issue('DISPOSABLE_NAME_ALREADY_PRESENT_'+existing.http);
 const s={name:NAME,run:RUN,uuid,row:'qa776_'+randomBytes(8).toString('hex'),
  access:randomBytes(32).toString('hex'),epoch:randomBytes(16).toString('hex'),
  cutover:'qa776_cutover_'+randomBytes(16).toString('hex')};
 writeFileSync(STATE,JSON.stringify(s),{mode:0o600});
 if(await count(s)!==0)issue('SYNTHETIC_ROW_COLLISION');
 const add=await d1(s,"INSERT INTO app768_qa_synthetic_follow (k,following) VALUES ('"+s.row+"',0)");
 if(add.meta.rows_written<1||add.meta.rows_written>2)
  issue('QA_INSERT_ABOVE_W2');
 console.log('APP776_EXISTING_QA_D1_ONE_ROW_INITIALIZED_W1_W2=PASS');
}
async function upload(){
 guard();const s=state();if(!s)issue('PREPARE_NOT_RUN');
 const file=resolve('app776-qa-integration-worker.bundle.mjs');
 if(!existsSync(file))issue('MISSING_BUNDLED_CODE');
 const content=readFileSync(file,'utf8');
 if(content.length<3500||content.length>170000||
  !content.includes('APP775_OFFLINE_SYNTHETIC_ONLY')||
  !content.includes('app768_qa_synthetic_follow'))
  issue('WORKER_CODE_SCOPE_INVALID');
 const metadata={main_module:'app776-qa-worker.mjs',
  compatibility_date:'2026-11-19',bindings:[
   {type:'d1',name:'QA_APP776_D1',id:s.uuid},
   {type:'r2_bucket',name:'QA_APP776_R2',bucket_name:R2},
   {type:'plain_text',name:'SORIDRAW_ENVIRONMENT',text:'isolated-qa'},
   {type:'plain_text',name:'APP776_ACCESS',text:s.access},
   {type:'plain_text',name:'APP776_EPOCH',text:s.epoch},
   {type:'plain_text',name:'APP776_CUTOVER',text:s.cutover},
   {type:'plain_text',name:'APP776_ROW',text:s.row},
  ]};
 const form=new FormData();
 form.append('metadata',new Blob([JSON.stringify(metadata)],
  {type:'application/json'}),'metadata.json');
 form.append('app776-qa-worker.mjs',new Blob([content],
  {type:'application/javascript+module'}),'app776-qa-worker.mjs');
 const u=await fetch(BASE+'/workers/scripts/'+NAME,{
  method:'PUT',headers:{Authorization:'Bearer '+
   process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,Accept:'application/json'},
  body:form,redirect:'error',signal:AbortSignal.timeout(20000)});
 const result=await u.json().catch(()=>null);
 if(u.status!==200||result?.success!==true)
  issue('QA_D1_R2_BINDING_UPLOAD_REJECTED_'+u.status+'_ERROR_CODES_'+
   (result?.errors||[]).map(e=>Number(e.code)).join('_'));
 const sub=await api(BASE+'/workers/scripts/'+NAME+'/subdomain',
   process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,'POST',
   {enabled:true,previews_enabled:false});
 resultCheck(sub,'QA_SUBDOMAIN');
 let seen=false;
 for(let i=0;i<12;i++){
  const x=await api(BASE+'/workers/scripts/'+NAME,
   process.env.CLOUDFLARE_QA_API_TOKEN);
  if(x.http===200){seen=true;break}
  if(x.http!==404)issue('QA_WORKER_READBACK_'+x.http);
  await delay(1300);
 }
 if(!seen)issue('QA_WORKER_NOT_VISIBLE');
 console.log('APP776_DISPOSABLE_QA_WORKER_WITH_D1_R2=PASS');
}
function resultCheck(x,n){if(x.http!==200||!x.ok)issue(n+'_HTTP_'+x.http)}
async function wfetch(s,method,path,body,access=true){
 const res=await fetch('https://'+NAME+'.soridraw-qa.workers.dev'+path,{
  method,redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{'Cache-Control':'no-store',...(access?{'X-APP776-QA-Access':s.access}:{}),
   ...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body}),
 });
 return {code:res.status,value:await res.json().catch(()=>null)};
}
async function opId(s,revision,desired){
 const data=JSON.stringify([s.cutover,'qa776ActorSynthetic','qa776OwnerSynthetic',revision,desired]);
 const bytes=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(data)));
 return 'owner_follow_579_'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
}
async function r2keys(s){
 const output=[];
 for(const [rev,desired] of [[1,true],[2,false]]){
  const id=await opId(s,rev,desired);
  const data=JSON.stringify([s.cutover,'qa776OwnerSynthetic','qa776ActorSynthetic',s.epoch,id]);
  const bytes=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
   new TextEncoder().encode(data)));
  output.push('internal/qa776/synthetic-follow/'+s.row+'/' +
    Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join(''));
 }
 // APP783 admission + settled objects, using exactly the current run's operation.
 const id=await opId(s,1,true);
 const raw=JSON.stringify([s.cutover,'qa776OwnerSynthetic',
  'qa776ActorSynthetic',s.epoch,id]);
 const bytes=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
  new TextEncoder().encode(raw)));
 const hash=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
 output.push('internal/qa767/owner-follow-admissions/'+hash,
  'internal/qa783/owner-follow-settled/'+hash);
 return output;
}
async function test(){
 guard();const s=state();if(!s)issue('NO_EXACT_STATE');
 let ready=false;
 for(let i=0;i<14;i++){
  try{const x=await wfetch(s,'GET','/health');
   if(x.code===200&&x.value?.status==='QA_READY'&&
     x.value.present===true&&x.value.following===false){ready=true;break}
  }catch{}
  await delay(1300);
 }
 if(!ready)issue('WORKER_HEALTH_OR_QA_ROW_UNAVAILABLE');
 const endpoint='/v1/profiles/qa776OwnerSynthetic/follow';
 const forbidden=await wfetch(s,'PUT',endpoint,'{}',false);
 if(forbidden.code!==403||forbidden.value?.status!=='DENIED')
  issue('PUBLIC_UNAUTHENTICATED_REQUEST_NOT_BLOCKED');
 const oldRequests=await Promise.all([
  wfetch(s,'PUT',endpoint,'{}'),
  wfetch(s,'PUT',endpoint,'{}'),
 ]);
 const first=oldRequests.filter(x=>x.code===201&&
  x.value?.status==='QA_SYNTHETIC_COMMITTED'&&
  x.value?.envelopeKind==='legacy'&&x.value.d1RowsWritten===1).length;
 const others=oldRequests.filter(x=>x.code===200&&
  x.value?.status==='QA_NO_CHANGE'&&x.value.d1RowsWritten===0||
  x.code===409&&['QA_DUPLICATE_ADMISSION','QA_ENTRY_HOLD'].includes(x.value?.status)).length;
 if(first!==1||others!==1)
  issue('TWO_LEGACY_FOLLOW_REQUESTS_NOT_SINGLE_WINNER_'+first+'_'+others);
 let health=await wfetch(s,'GET','/health');
 if(health.code!==200||health.value?.following!==true)
  issue('FOLLOW_STATE_NOT_CONFIRMED');
 console.log('APP776_REAL_HTTP_LEGACY_FOLLOW_CONCURRENT_SINGLE_D1_W1=PASS');
 const operation=await opId(s,2,false);
 const ordered=JSON.stringify({followOperationId:operation,followExpectedRevision:2});
 const newer=await Promise.all([
  wfetch(s,'DELETE',endpoint,ordered),
  wfetch(s,'DELETE',endpoint,ordered),
 ]);
 const one=newer.filter(x=>x.code===201&&
  x.value?.status==='QA_SYNTHETIC_COMMITTED'&&
  x.value.envelopeKind==='ordered'&&x.value.d1RowsWritten===1).length;
 const blocked=newer.filter(x=>x.code===409&&
  ['QA_DUPLICATE_ADMISSION','QA_ENTRY_HOLD'].includes(x.value?.status)||
  x.code===200&&x.value?.status==='QA_NO_CHANGE'&&x.value.d1RowsWritten===0).length;
 if(one!==1||blocked!==1)
  issue('TWO_ORDERED_UNFOLLOW_REQUESTS_NOT_SINGLE_WINNER_'+one+'_'+blocked);
 health=await wfetch(s,'GET','/health');
 if(health.code!==200||health.value?.following!==false)
  issue('UNFOLLOW_FINAL_STATE_NOT_CONFIRMED');
 const replay=await wfetch(s,'PUT',endpoint,'{}');
 if(replay.code!==409||replay.value?.status!=='QA_DUPLICATE_ADMISSION')
  issue('OLD_LEGACY_OPERATION_ABA_REPLAY_NOT_BLOCKED');
 const deniedPath=await wfetch(s,'PUT','/v1/profiles/otherOwner/follow','{}');
 if(deniedPath.code!==404)issue('OUTSIDE_QA_OWNER_PATH_ALLOWED');
 const row=await d1(s,"SELECT following FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
 if(row.results?.length!==1||Number(row.results[0].following)!==0)
  issue('PHYSICAL_D1_QA_FINAL_NOT_ZERO');
 console.log('APP776_REAL_HTTP_ORDERED_UNFOLLOW_CONCURRENT_SINGLE_D1_W1=PASS');
 console.log('APP776_REAL_QA_R2_ABA_OLD_OPERATION_BLOCKED=PASS');
 console.log('APP776_REAL_QA_WRONG_PRINCIPAL_DENIED=PASS');
 console.log('APP776_LIVE_FIREBASE_AUTH_AND_REAL_CANONICAL_WRITER=NOT_TESTED_HOLD');
}
async function test783(){
 guard();const s=state();if(!s)issue('NO_EXACT_QA_STATE');
 let ready=false;
 for(let i=0;i<14;i++){
  try{const h=await wfetch(s,'GET','/app783/health');
   if(h.code===200&&h.value?.status==='QA783_READY'&&h.value.rowPresent===true&&
    h.value.following===false&&!h.value.admissionPresent&&
    !h.value.settledPresent){ready=true;break;}
  }catch{}
  if(i<13)await delay(1500);
 }
 if(!ready)issue('APP783_QA_EMPTY_BASELINE_NOT_READY');
 const denied=await wfetch(s,'POST','/app783/claim',undefined,false);
 if(denied.code!==403||denied.value?.status!=='DENIED')issue('QA_UNAUTHENTICATED_WRITE_ALLOWED');
 const early=await wfetch(s,'POST','/app783/settle');
 if(early.code!==409||early.value?.reason!=='IMMUTABLE_ADMISSION_NOT_FOUND_OR_MISMATCH')
  issue('QA_SETTLED_WITHOUT_ADMISSION');
 const claim=await wfetch(s,'POST','/app783/claim');
 if(claim.code!==201||claim.value?.status!=='ADMISSION_ONLY_NOT_D1_COMMIT')
  issue('QA_R2_ADMISSION_NOT_CREATED');
 const repeat=await wfetch(s,'POST','/app783/claim');
 if(repeat.code!==409||repeat.value?.reason!=='PRIOR_OR_CONCURRENT_CLAIM_REQUIRES_RECONCILIATION')
  issue('QA_R2_DUPLICATE_NOT_BLOCKED');
 const fault=await wfetch(s,'POST','/app783/fault');
 if(fault.code!==409||fault.value?.reason!=='CANONICAL_PROOF_UNAVAILABLE')
  issue('QA_INJECTED_503_NOT_HELD');
 const noSettled=await wfetch(s,'GET','/app783/health');
 if(noSettled.code!==200||noSettled.value?.settledPresent!==false||
    noSettled.value?.admissionPresent!==true)issue('QA_FAULT_PRODUCED_UNVERIFIED_SETTLED');
 const d=await wfetch(s,'POST','/app783/commit');
 if(d.code!==201||d.value?.status!=='QA783_SYNTHETIC_D1_COMMIT'||d.value.rowsWritten!==1)
  issue('QA_SYNTHETIC_D1_W1_NOT_COMMITTED');
 const duplicateD1=await wfetch(s,'POST','/app783/commit');
 const safeStatus=/^QA783_[A-Z_]{1,60}$/.test(duplicateD1.value?.status||'')
  ? duplicateD1.value.status:'UNRECOGNIZED';
 console.log('APP783_DUPLICATE_QA_D1_HTTP='+duplicateD1.code+'_STATUS='+safeStatus);
 if(duplicateD1.code!==409||duplicateD1.value?.status!=='QA783_D1_NO_NEW_CHANGE')
  issue('QA_D1_DUPLICATE_NOT_HELD');
 const first=await wfetch(s,'POST','/app783/settle');
 if(first.code!==201||first.value?.status!=='QA_IMMUTABLE_SETTLED_ONLY'||
    first.value.productionDeployAuthorized!==false)issue('QA_SETTLED_NOT_CREATED');
 const head1=await wfetch(s,'GET','/app783/health');
 if(head1.code!==200||!head1.value?.settledPresent||!head1.value.settledEtag)
  issue('QA_R2_SETTLED_NOT_READABLE');
 const replay=await wfetch(s,'POST','/app783/settle');
 if(replay.code!==200||replay.value?.status!=='EXACT_QA_SETTLED_REPLAY_READ_ONLY')
  issue('QA_REPLAY_NOT_READ_ONLY');
 const stale=await wfetch(s,'POST','/app783/stale');
 if(stale.code!==409||stale.value?.reason!=='REPLAY_EXACT_CANONICAL_REVISION_MISMATCH')
  issue('QA_STALE_REVISION_NOT_REJECTED');
 const head2=await wfetch(s,'GET','/app783/health');
 if(head2.code!==200||head2.value?.settledEtag!==head1.value.settledEtag)
  issue('QA_DUPLICATE_CHANGED_R2_ETAG');
 const final=await d1(s,"SELECT following FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
 if(Number(final.results?.[0]?.following)!==1)issue('QA_D1_FINAL_STATE_WRONG');
 console.log('APP783_REAL_QA_R2_ADMISSION_SETTLED_CREATE_ONCE=PASS');
 console.log('APP783_REAL_QA_D1_SYNTHETIC_COMMIT_W1=PASS');
 console.log('APP783_R2_REPLAY_SAME_ETAG_NO_SECOND_WRITE=PASS');
 console.log('APP783_INJECTED_503_HOLD_SAME_ID_RECOVERY=PASS');
 console.log('APP783_STALE_REVISION_REJECTED=PASS');
 console.log('APP783_REAL_CANONICAL_GLOBAL_WRITERS_AUTO_RECOVERY=NOT_TESTED_HOLD');
}

async function cleanup(){
 guard();const s=state();if(!s){console.log('APP776_NO_STATE_TO_CLEAN');return;}
 const errors=[];
 let cleaned=false;
 try{const x=await wfetch(s,'POST','/cleanup');
  cleaned=x.code===200&&x.value?.status==='QA_CLEANED';
 }catch{}
 const keys=await r2keys(s);
 if(!cleaned){
  // Scoped fallback: only the exact two run-key objects and exact D1 row.
  for(const key of keys){
   try{
    const path=BASE+'/r2/buckets/'+R2+'/objects/'+encodeURIComponent(key);
    const d=await api(path,process.env.CLOUDFLARE_QA_DATA_TOKEN,'DELETE');
    if(!(d.http===200&&d.ok)&&!d.errors.includes(10007))
     issue('EXACT_R2_DELETE_FAILED_'+d.http);
   }catch(e){errors.push('R2_'+String(e?.message||e));}
  }
  try{await d1(s,"DELETE FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'")}
  catch(e){errors.push('D1_'+String(e?.message||e))}
 }
 try{if(await count(s)!==0)issue('QA_EXACT_ROW_REMAINS')}
 catch(e){errors.push('COUNT_'+String(e?.message||e))}
 const scriptPath=BASE+'/workers/scripts/'+NAME;
 try{
  const d=await api(scriptPath,process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,'DELETE');
  if(d.http!==200&&d.http!==404)issue('QA_WORKER_REMOVE_HTTP_'+d.http);
  let gone=false;
  for(let i=0;i<8;i++){
   const q=await api(scriptPath,process.env.CLOUDFLARE_QA_API_TOKEN);
   if(q.http===404){gone=true;break}
   await delay(1200);
  }
  if(!gone)issue('QA_TEMP_WORKER_NOT_REMOVED');
  console.log('APP776_QA_TEMPORARY_WORKER_DELETED=PASS');
 }catch(e){errors.push('WORKER_'+String(e?.message||e))}
 try{await baseline()}catch(e){errors.push('BASELINE_'+String(e?.message||e))}
 if(errors.length)issue('CLEANUP_INCOMPLETE_'+errors.join('|'));
 console.log('APP776_EXACT_QA_D1_ROW_AND_R2_OBJECTS_CLEANED=PASS');
 console.log('APP776_ORIGINAL_APP583_QA_RESOURCES_UNCHANGED=PASS');
}
const phases={preflight,upload,test,test783,cleanup};
const p=process.argv[2];if(!Object.hasOwn(phases,p))issue('BAD_PHASE');
phases[p]().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
