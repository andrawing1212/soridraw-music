// APP749 QA-only Hosting add-on. Clones the exact current QA584 release,
// preserves ALL existing files/config, and appends ONLY /qa749.html.
// No Firebase Auth/App Check/RTDB/Worker/IAM/rules changes. No secret output.
// Cloud Shell: node app749-qa-hosting-add-page.mjs --check|--deploy
import {readFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {gzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE='soridraw-qa-owner-584',PROJECT='soridraw-app',NUMBER='1083981050742';
const API='https://firebasehosting.googleapis.com/v1beta1';
const HOST='https://soridraw-qa-owner-584.web.app';
const FILE='/qa749.html',PURPOSE='SORIDRAW · 독립 QA 팔로우 실검증';
const isVersion=s=>typeof s==='string'&&
  new RegExp('^sites/'+SITE+'/versions/[A-Za-z0-9_-]+$').test(s);
function hold(code){throw Error('APP749_QA_HOSTING_HOLD_'+code)}
function check(ok,code){if(!ok)hold(code)}
function gcloud(args){
 try{return execFileSync('gcloud',args,{
  stdio:['ignore','pipe','ignore'],encoding:'utf8',timeout:15000}).trim()}
 catch{hold('GCLOUD_AUTH_OR_PROJECT_UNAVAILABLE')}
}
async function run({mode,html,send=fetch,token,projectId,projectNumber,notify=()=>{},
  timeout=15000}={}){
 check(['--check','--deploy'].includes(mode),'USE_CHECK_OR_DEPLOY');
 check(projectId===PROJECT&&projectNumber===NUMBER,'WRONG_QA_PROJECT');
 check(typeof token==='string'&&token.length>30,'OAUTH_MISSING');
 check(typeof html==='string'&&html.includes(PURPOSE)&&
   html.includes("soridraw-app749-receiver")&&
   html.includes("soridraw-qa-owner-584.web.app")&&
   !html.includes('<script src="http:'),
   'WRONG_BROWSER_TEST_PAGE');
 const payload=Buffer.from(html,'utf8');
 check(payload.length>5000&&payload.length<100000,'PAGE_SIZE_DRIFT');
 const gz=gzipSync(payload,{level:9,mtime:0});
 const hash=createHash('sha256').update(gz).digest('hex');
 const headers={Authorization:'Bearer '+token,Accept:'application/json'};
 const json=async(method,path,body,code)=>{
  check(path.startsWith(API+'/sites/'+SITE+'/')||
    path===API+'/sites/'+SITE+'/versions:clone',
    'UNPINNED_URL');
  let r;
  try{r=await send(path,{method,redirect:'error',
    headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(timeout)})}catch{hold(code+'_NETWORK')}
  check(r.status>=200&&r.status<300,code+'_HTTP_'+r.status);
  let data;try{data=await r.json()}catch{hold(code+'_NOT_JSON')}
  check(data&&typeof data==='object'&&!data.error,code+'_API_ERROR');
  return data;
 };
 const list=async path=>{
  const all=[];let token='';
  for(let i=0;i<5;i++){
   const join=token?(path.includes('?')?'&':'?')+'pageToken='+encodeURIComponent(token):'';
   const result=await json('GET',API+path+join,undefined,'LIST');
   all.push(...(result.files??[]));
   token=result.nextPageToken||'';
   if(!token)break;
  }
  check(!token,'TOO_MANY_FILES');
  return all;
 };
 const latest=async()=>{
  const r=await json('GET',API+'/sites/'+SITE+'/releases?pageSize=1',
    undefined,'RELEASES');
  const rel=r.releases?.[0];
  check(rel?.version&&isVersion(rel.version.name),'LATEST_RELEASE_UNVERIFIED');
  return rel;
 };
 const old=await latest();
 const oldVer=old.version.name;
 const oldDetails=await json('GET',API+'/'+oldVer,undefined,'ORIGINAL_VERSION');
 check(isVersion(oldDetails.name)&&oldDetails.name===oldVer,'ORIGINAL_VERSION_MISMATCH');
 check(oldDetails.status==='FINALIZED','ORIGINAL_NOT_FINALIZED');
 const files=await list('/sites/'+SITE+'/versions/'+oldVer.split('/').pop()+'/files?pageSize=1000');
 const filesMap=new Map(files.map(f=>[f.path,f.hash]));
 check(filesMap.size===files.length&&filesMap.has('/index.html')&&
   !filesMap.has(FILE)&&files.length<=1000,'OLD_FILES_CONFLICT_OR_MISSING');
 for(const [name,h]of filesMap){
  check(typeof name==='string'&&name.startsWith('/')&&
    typeof h==='string'&&/^[0-9a-f]{64}$/i.test(h),'OLD_FILES_INVALID');
 }
 const originalReq=async(path)=>{
  const url=HOST+path;
  let r;try{r=await send(url,{method:'GET',redirect:'error',
    headers:{Accept:'text/html','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(timeout)})}catch{hold('QA_SITE_NOT_REACHABLE')}
  check(r.status===200,'QA_SITE_HTTP_'+r.status);
  return r.text();
 };
 const oldRoot=await originalReq('/');
 check(oldRoot.includes('SORIDRAW')&&oldRoot.includes('QA')&&
   oldRoot.includes('onValue'),'ORIGINAL_RECEIVER_NOT_FOUND');
 const rootSha=createHash('sha256').update(oldRoot).digest('hex');
 notify('APP749_QA_SITE_EXISTING_RECEIVER=PASS');
 notify('APP749_QA_ORIGINAL_RELEASE_AND_FILES_PINNED=PASS');
 if(mode==='--check'){
  notify('APP749_QA_NO_HOSTING_CHANGES=PASS');
  return{status:'READY',oldVersion:oldVer,originalFileCount:files.length};
 }
 // Clone exact live version. All existing files, rules, and rewrites retained.
 const operation=await json('POST',API+'/sites/'+SITE+'/versions:clone',
   {sourceVersion:oldVer,finalize:false},'CLONE');
 let op=operation;
 // Firebase Hosting clone uses projects/{QA_PROJECT}/operations/{OP_ID},
 // NOT the short "operations/{ID}" path used by the old mock.
 const operationName=op?.name;
 check(typeof operationName==='string'&&
   /^projects\/(?:soridraw-app|1083981050742)\/operations\/[A-Za-z0-9_-]{1,256}$/.test(operationName),
   'CLONE_OPERATION_INVALID');
 for(let i=0;i<30&&!op.done;i++){
  await new Promise(r=>setTimeout(r,1000));
  const endpoint=API+'/'+operationName;
  // Poll only the exact QA project operation returned by the clone response.
  let response;try{response=await send(endpoint,{
   method:'GET',redirect:'error',headers,signal:AbortSignal.timeout(timeout)})}
   catch{hold('CLONE_POLL_NETWORK')}
  check(response.status===200,'CLONE_POLL_HTTP_'+response.status);
  op=await response.json().catch(()=>null);
  check(op?.name===operationName,'CLONE_OPERATION_DRIFT');
 }
 check(op.done===true&&!op.error,'CLONE_NOT_DONE');
 const version=op.response?.name??op.response?.version?.name;
 check(isVersion(version)&&version!==oldVer,'NEW_VERSION_INVALID');
 const before=await json('GET',API+'/'+version,undefined,'CLONED_VERSION');
 check(before.name===version&&before.status==='CREATED','CLONED_VERSION_NOT_EDITABLE');
 // Firebase Hosting versions:clone copies content; do not assume that its
 // serving rules were copied too. Restore ONLY the original QA live version's
 // exact serving config onto this NEW, un-released clone (never the old version).
 // compare object values independent of response key ordering, then re-GET.
 const originalConfig=oldDetails.config??{};
 check(originalConfig&&typeof originalConfig==='object'&&
   !Array.isArray(originalConfig),'ORIGINAL_SERVING_CONFIG_INVALID');
 if(!isDeepStrictEqual(before.config??{},originalConfig)){
   await json('PATCH',API+'/'+version+'?updateMask=config',
     {name:version,config:originalConfig},'RESTORE_CLONE_CONFIG');
 }
 const copied=await json('GET',API+'/'+version,undefined,'CLONED_CONFIG_RECHECK');
 check(copied.name===version&&copied.status==='CREATED'&&
   isDeepStrictEqual(copied.config??{},originalConfig),
   'CLONE_SERVING_CONFIG_NOT_IDENTICAL_HOLD');
 notify('APP749_QA_CLONE_CONFIG_EXACT_ORIGINAL=PASS');
 const filesOld=filesMap;
 const cloneFiles=await list('/sites/'+SITE+'/versions/'+version.split('/').pop()+'/files?pageSize=1000');
 check(cloneFiles.length===filesOld.size&&cloneFiles.every(f=>filesOld.get(f.path)===f.hash),
   'CLONE_DID_NOT_PRESERVE_FILES');
 const upload=await json('POST',API+'/'+version+':populateFiles',
   {files:{[FILE]:hash}},'APPEND_PAGE');
 const required=upload.uploadRequiredHashes??[];
 check(Array.isArray(required)&&required.every(h=>h===hash)&&required.length<=1,
   'UPLOAD_SCOPE_DRIFT');
 if(required.length){
  check(typeof upload.uploadUrl==='string'&&
    upload.uploadUrl.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/'+SITE+'/versions/'),
    'UPLOAD_URL_NOT_QA');
  let u;try{u=await send(upload.uploadUrl+'/'+hash,{
    method:'POST',redirect:'error',headers:{...headers,
      'Content-Type':'application/octet-stream'},body:gz,
    signal:AbortSignal.timeout(timeout)})}catch{hold('UPLOAD_NETWORK')}
  check(u.status>=200&&u.status<300,'UPLOAD_HTTP_'+u.status);
 }
 const appended=await list('/sites/'+SITE+'/versions/'+version.split('/').pop()+'/files?pageSize=1000');
 check(appended.length===filesOld.size+1&&
   appended.every(f=>f.path===FILE?f.hash===hash:filesOld.get(f.path)===f.hash),
   'APPENDED_VERSION_FILE_MISMATCH');
 await json('PATCH',API+'/'+version+'?updateMask=status',
   {status:'FINALIZED'},'FINALIZE');
 // Check nobody modified QA Hosting since our original read.
 const current=await latest();
 check(current.name===old.name&&current.version.name===oldVer,
   'CONCURRENT_QA_HOSTING_RELEASE_HOLD');
 const deployed=await json('POST',API+'/sites/'+SITE+'/releases?versionName='+
   encodeURIComponent(version),undefined,'RELEASE');
 check(deployed.version?.name===version,'DEPLOYED_VERSION_NOT_CONFIRMED');
 notify('APP749_QA_APPEND_RELEASE_CREATED=PASS');
 let smoke=false;
 for(let attempt=0;attempt<6&&!smoke;attempt++){
  try{
   const page=await originalReq(FILE);
   const index=await originalReq('/');
   smoke=page.includes(PURPOSE)&&
     createHash('sha256').update(index).digest('hex')===rootSha;
  }catch{/* allow bounded Hosting edge propagation */}
  if(!smoke&&attempt<5)await new Promise(r=>setTimeout(r,2000));
 }
 if(!smoke){
  const active=await latest();
  if(active.version.name===version){
    const rollback=await json('POST',API+'/sites/'+SITE+'/releases?versionName='+
      encodeURIComponent(oldVer),undefined,'ROLLBACK');
    check(rollback.version?.name===oldVer,'ROLLBACK_NOT_CONFIRMED');
    notify('APP749_QA_OLD_HOSTING_ROLLBACK_COMMAND=PASS');
  }
  hold('QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE');
 }
 notify('APP749_QA_NEW_PAGE_AND_OLD_RECEIVER_HTTP=PASS');
 notify('APP749_QA_FIREBASE_AUTH_APPCHECK_AND_PC_MOBILE=NOT_TESTED');
 return{status:'PASS',url:HOST+FILE,oldVersion:oldVer,newVersion:version};
}
export {run as runApp749QaHosting};
async function main(){
 const mode=process.argv[2];
 check(['--check','--deploy'].includes(mode)&&process.argv.length<=4,
   'USE_CHECK_OR_DEPLOY');
 const path=resolve(process.argv[3]??resolve(dirname(fileURLToPath(import.meta.url)),'qa749.html'));
 let bytes;try{check(statSync(path).size<100000,'WRONG_PAGE_SIZE');
  bytes=readFileSync(path,'utf8')}catch{hold('QA_BROWSER_HTML_MISSING')}
 const project=gcloud(['config','get-value','project']);
 const number=gcloud(['projects','describe',PROJECT,'--format=value(projectNumber)']);
 const token=gcloud(['auth','print-access-token']);
 const out=await run({mode,html:bytes,token,projectId:project,projectNumber:number,
   notify:console.log});
 if(out.url)console.log('APP749_QA_BROWSER_URL='+out.url);
 console.log('APP749_QA_HOSTING_'+mode.replace('--','').toUpperCase()+'='+out.status);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{
  const m=String(e?.message||'APP749_QA_HOSTING_HOLD_UNEXPECTED');
  console.error(m.startsWith('APP749_QA_HOSTING_HOLD_')?m:'APP749_QA_HOSTING_HOLD_UNEXPECTED');
  process.exitCode=2;
 });
}
