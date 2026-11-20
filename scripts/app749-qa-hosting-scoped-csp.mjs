// APP749 QA-only browser fix. Clone exact QA584 release and only replace
// broken QA749 HTML/JS, adding exact QA Web App public config. Preserve all
// original receiver files, external CSS, security rules and serving config.
// No Firebase Auth/App Check/RTDB/Worker/IAM/rules changes. No secret output.
// Cloud Shell: node app749-qa-hosting-scoped-csp.mjs --check|--deploy
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
const FILE='/qa749.html',JSFILE='/qa749.js',CSSFILE='/qa749.css';
const CONFIGFILE='/qa749-config.json';
const FIREBASE_API='https://firebase.googleapis.com/v1beta1';
const PURPOSE='SORIDRAW · 독립 QA 팔로우 실검증';
const isVersion=s=>typeof s==='string'&&
  new RegExp('^sites/'+SITE+'/versions/[A-Za-z0-9_-]+$').test(s);
function hold(code){throw Error('APP749_QA_HOSTING_HOLD_'+code)}
function check(ok,code){if(!ok)hold(code)}
function gcloud(args){
 try{return execFileSync('gcloud',args,{
  stdio:['ignore','pipe','ignore'],encoding:'utf8',timeout:15000}).trim()}
 catch{hold('GCLOUD_AUTH_OR_PROJECT_UNAVAILABLE')}
}
function validateConfig(c){
 return c&&typeof c==='object'&&!Array.isArray(c)&&
   c.projectId===PROJECT&&String(c.messagingSenderId)===NUMBER&&
   /^1:1083981050742:web:[A-Za-z0-9_-]+$/.test(c.appId||'')&&
   typeof c.apiKey==='string'&&/^AIza[A-Za-z0-9_-]{25,80}$/.test(c.apiKey)&&
   c.authDomain==='soridraw-app.firebaseapp.com';
}
async function qaPublicConfig({token,send=fetch,timeout=15000}={}){
 check(typeof token==='string'&&token.length>30,'QA_CONFIG_AUTH_MISSING');
 const get=async(url,label)=>{
   check(url.startsWith(FIREBASE_API+'/projects/'+PROJECT+'/webApps'),
     'QA_CONFIG_CROSS_PROJECT_HOLD');
   let response;try{response=await send(url,{method:'GET',redirect:'error',
     headers:{Authorization:'Bearer '+token,Accept:'application/json',
       'Cache-Control':'no-store'},signal:AbortSignal.timeout(timeout)})}
   catch{hold(label+'_NETWORK')}
   check(response.status===200,label+'_HTTP_'+response.status);
   const body=await response.json().catch(()=>null);
   check(body&&typeof body==='object'&&!body.error,label+'_INVALID_RESPONSE');
   return body;
 };
 const found=await get(FIREBASE_API+'/projects/'+PROJECT+'/webApps?pageSize=100',
   'FIREBASE_WEB_APPS_LIST');
 check(Array.isArray(found.apps)&&!found.nextPageToken,
   'QA_WEB_APPS_AMBIGUOUS');
 const match=found.apps.filter(a=>a.displayName==='SORIDRAW-QA'&&
   a.state!=='DELETED'&&
   /^1:1083981050742:web:[A-Za-z0-9_-]+$/.test(a.appId||'')&&
   (a.name==='projects/'+PROJECT+'/webApps/'+a.appId||
     a.name==='projects/'+NUMBER+'/webApps/'+a.appId));
 check(match.length===1,'QA_WEB_APP_NOT_UNIQUE');
 const config=await get(FIREBASE_API+'/projects/'+PROJECT+
   '/webApps/'+encodeURIComponent(match[0].appId)+'/config',
   'QA_WEB_APP_CONFIG');
 check(validateConfig(config)&&config.appId===match[0].appId,
   'QA_WEB_APP_CONFIG_MISMATCH');
 // Firebase Web App config is public client configuration, not server tokens.
 // Never log it, include QA web app only and force the isolated QA RTDB.
 return Object.freeze({
   apiKey:config.apiKey,appId:config.appId,
   projectId:PROJECT,authDomain:config.authDomain,
   messagingSenderId:NUMBER,
   databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app',
 });
}
function qa749ScopedCsp(original){
 check(typeof original==='string'&&original.length>50&&original.length<8000,'QA_CSP_BASE_INVALID');
 const rs=original.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
  const parts=x.split(/\s+/);return{name:parts[0],sources:parts.slice(1)}});
 const idx=new Map(rs.map((r,i)=>[r.name,i]));
 check(idx.size===rs.length,'QA_CSP_DUPLICATE_DIRECTIVES');
 check(rs[idx.get('default-src')]?.sources.join(' ')==="'none'",'QA_CSP_DEFAULT_DRIFT');
 check(idx.has('script-src')&&idx.has('connect-src')&&idx.has('style-src'),
  'QA_CSP_REQUIRED_DIRECTIVES_MISSING');
 const adds={
  'script-src':['https://www.google.com/recaptcha/'],
  'connect-src':["'self'",'https://firebaseappcheck.googleapis.com',
   'https://recaptchaenterprise.googleapis.com','https://www.google.com/recaptcha/',
   'https://soridraw-owner-qa-583.soridraw-qa.workers.dev'],
  'frame-src':['https://www.google.com/recaptcha/','https://recaptcha.google.com/recaptcha/']
 };
 for(const [name,srcs]of Object.entries(adds)){
  if(!idx.has(name)){idx.set(name,rs.length);rs.push({name,sources:[]})}
  const r=rs[idx.get(name)];
  if(r.sources.includes("'none'"))r.sources=[];
  for(const src of srcs)if(!r.sources.includes(src))r.sources.push(src);
 }
 return rs.map(r=>r.name+' '+r.sources.join(' ')).join('; ');
}
async function run({mode,html,css,js,config,send=fetch,token,projectId,projectNumber,
   notify=()=>{},timeout=15000}={}){
 check(['--check','--deploy'].includes(mode),'USE_CHECK_OR_DEPLOY');
 check(projectId===PROJECT&&projectNumber===NUMBER,'WRONG_QA_PROJECT');
 check(typeof token==='string'&&token.length>30,'OAUTH_MISSING');
 check(typeof html==='string'&&html.includes(PURPOSE)&&
   html.includes('src="/qa749.js"')&&html.includes('href="/qa749.css"')&&
   !html.includes('<script type="module">')&&
   html.includes('<style>')&&html.includes('</style>')&&
   !html.includes('id="manual"'),
   'QA_FIXED_HTML_INVALID');
 check(typeof js==='string'&&js.includes('initializeAppCheck')&&
  js.includes("fetch('/qa749-config.json'")&&
  !js.includes("for(const url of ['/__/firebase/init.json'"),'QA_JS_INVALID');
 check(typeof css==='string'&&css.includes('.status')&&css.includes('background')&&
   html.match(/<style>\s*([\s\S]*?)\s*<\/style>/)?.[1]?.trim()===css.trim(),
   'QA_INLINE_CSS_MATCH_INVALID');
 check(validateConfig(config),'QA_PUBLIC_CONFIG_INVALID');
 const bytes=Object.freeze({[JSFILE]:Buffer.from(js,'utf8')});
 const entries=Object.entries(bytes);
 check(entries.length===1&&entries[0][0]===JSFILE&&
  entries[0][1].length>5000&&entries[0][1].length<100000,'QA_ASSET_SIZE_INVALID');
 const gzip=new Map(entries.map(([p,b])=>[p,gzipSync(b,{level:9,mtime:0})]));
 const hashes=new Map([...gzip].map(([p,b])=>[p,createHash('sha256').update(b).digest('hex')]));
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
   filesMap.has(FILE)&&filesMap.has(JSFILE)&&filesMap.has(CSSFILE)&&
   filesMap.has(CONFIGFILE)&&files.length<=1000,
   'OLD_FILES_CONFLICT_OR_MISSING');
 for(const [name,h]of filesMap){
  check(typeof name==='string'&&name.startsWith('/')&&
    typeof h==='string'&&/^[0-9a-f]{64}$/i.test(h),'OLD_FILES_INVALID');
 }
 const seenCsp=new Map();
 const originalReq=async(path)=>{
  const url=HOST+path;
  let r;try{r=await send(url,{method:'GET',redirect:'error',
    headers:{Accept:'text/html','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(timeout)})}catch{hold('QA_SITE_NOT_REACHABLE')}
  check(r.status===200,'QA_SITE_HTTP_'+r.status);
  if(path==='/'||path===FILE)seenCsp.set(path,r.headers.get('content-security-policy')||'');
  return r.text();
 };
 const oldRoot=await originalReq('/');
 check(oldRoot.includes('SORIDRAW')&&oldRoot.includes('QA')&&
   oldRoot.includes('onValue'),'ORIGINAL_RECEIVER_NOT_FOUND');
 const oldQaHtml=await originalReq(FILE);
 const oldQaJs=await originalReq(JSFILE);
 const oldQaCss=await originalReq(CSSFILE);
 const oldQaConfig=await originalReq(CONFIGFILE);
 check(oldQaHtml===html&&oldQaCss===css&&
  oldQaJs.includes("for(const url of ['/__/firebase/init.json','/qa749-config.json'])"),
  'ORIGINAL_QA_PAGE_UNEXPECTED');
 let c;try{c=JSON.parse(oldQaConfig)}catch{hold('QA_OLD_CONFIG_NOT_JSON')}
 check(validateConfig(c)&&c.appId===config.appId&&
  c.apiKey===config.apiKey&&c.databaseURL===config.databaseURL,
  'ORIGINAL_QA_CONFIG_MISMATCH');
 const qaCsp=qa749ScopedCsp(seenCsp.get(FILE));
 const rootCsp=seenCsp.get('/');
 check(rootCsp?.includes("default-src 'none'"),'ORIGINAL_RECEIVER_CSP_MISSING');
 const existing={[FILE]:oldQaHtml,[JSFILE]:oldQaJs,[CSSFILE]:oldQaCss,
  [CONFIGFILE]:oldQaConfig};
 for(const [path,source]of Object.entries(existing)){
   check(createHash('sha256').update(gzipSync(Buffer.from(source,'utf8'),{
     level:9,mtime:0})).digest('hex')===filesMap.get(path),
     'ORIGINAL_QA_FILE_HASH_MISMATCH');
 }
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
 check(Array.isArray(originalConfig.headers)&&originalConfig.headers.length<50,
  'ORIGINAL_SERVING_CONFIG_INVALID');
 check(!originalConfig.headers.some(h=>h.glob===FILE),'QA749_CSP_OVERRIDE_ALREADY_EXISTS_HOLD');
 const nextConfig={...originalConfig,headers:[...originalConfig.headers,
  {glob:FILE,headers:{'Content-Security-Policy':qaCsp}}]};
 await json('PATCH',API+'/'+version+'?updateMask=config',
  {name:version,config:nextConfig},'QA749_CSP_CONFIG_PATCH');
 const copied=await json('GET',API+'/'+version,undefined,'CLONED_CONFIG_RECHECK');
 check(copied.name===version&&copied.status==='CREATED'&&
  isDeepStrictEqual(copied.config??{},nextConfig),'QA749_CSP_RECHECK_HOLD');
 notify('APP749_QA_SCOPED_CSP_CONFIG_PINNED=PASS');
 const filesOld=filesMap;
 const cloneFiles=await list('/sites/'+SITE+'/versions/'+version.split('/').pop()+'/files?pageSize=1000');
 check(cloneFiles.length===filesOld.size&&cloneFiles.every(f=>filesOld.get(f.path)===f.hash),
   'CLONE_DID_NOT_PRESERVE_FILES');
 const upload=await json('POST',API+'/'+version+':populateFiles',
   {files:Object.fromEntries(hashes)},'REPAIR_QA_ASSETS');
 const required=upload.uploadRequiredHashes??[];
 const byHash=new Map([...hashes].map(([p,h])=>[h,p]));
 check(Array.isArray(required)&&new Set(required).size===required.length&&
   required.length<=1&&required.every(h=>byHash.has(h)),
   'UPLOAD_SCOPE_DRIFT');
 if(required.length)check(typeof upload.uploadUrl==='string'&&
   upload.uploadUrl.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/'+SITE+'/versions/'),
   'UPLOAD_URL_NOT_QA');
 for(const h of required){
   let u;try{u=await send(upload.uploadUrl+'/'+h,{
     method:'POST',redirect:'error',headers:{...headers,
       'Content-Type':'application/octet-stream'},body:gzip.get(byHash.get(h)),
     signal:AbortSignal.timeout(timeout)})}catch{hold('UPLOAD_NETWORK')}
   check(u.status>=200&&u.status<300,'UPLOAD_HTTP_'+u.status);
 }
 const appended=await list('/sites/'+SITE+'/versions/'+version.split('/').pop()+'/files?pageSize=1000');
 check(appended.length===filesOld.size&&
   appended.every(f=>hashes.has(f.path)?f.hash===hashes.get(f.path):
     filesOld.get(f.path)===f.hash),
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
   const [page,script,style,publicConfig,index]=await Promise.all([
     originalReq(FILE),originalReq(JSFILE),originalReq(CSSFILE),
     originalReq(CONFIGFILE),originalReq('/')]);
   const serverConfig=JSON.parse(publicConfig);
   smoke=page.includes(PURPOSE)&&page.includes('<style>')&&
     page.includes('src="/qa749.js"')&&
     !page.includes('<script type="module">')&&
     script.includes('/qa749-config.json')&&
     style===oldQaCss&&seenCsp.get(FILE)===qaCsp&&
      seenCsp.get('/')===rootCsp&&
     validateConfig(serverConfig)&&serverConfig.appId===config.appId&&
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
 notify('APP749_QA_AUTH_CONFIG_AND_SCOPED_CSP_HTTP=PASS');
 notify('APP749_QA_NEW_PAGE_AND_OLD_RECEIVER_HTTP=PASS');
 notify('APP749_QA_FIREBASE_AUTH_APPCHECK_AND_PC_MOBILE=NOT_TESTED');
 return{status:'PASS',url:HOST+FILE,oldVersion:oldVer,newVersion:version};
}
export {run as runApp749QaScopedCsp,qa749ScopedCsp,qaPublicConfig};
async function main(){
 const mode=process.argv[2];
 check(['--check','--deploy'].includes(mode)&&process.argv.length<=4,
   'USE_CHECK_OR_DEPLOY');
 const path=resolve(process.argv[3]??resolve(dirname(fileURLToPath(import.meta.url)),'qa749.html'));
 let html,css,js;try{
   const dir=dirname(path);
   const readAsset=name=>{
     const full=resolve(dir,name);
     check(statSync(full).size<100000,'WRONG_ASSET_SIZE');
     return readFileSync(full,'utf8');
   };
   html=readAsset('qa749.html');
   css=readAsset('qa749.css');
   js=readAsset('qa749.js');
 }catch{hold('QA_BROWSER_ASSETS_MISSING')}
 const project=gcloud(['config','get-value','project']);
 const number=gcloud(['projects','describe',PROJECT,'--format=value(projectNumber)']);
 const token=gcloud(['auth','print-access-token']);
 const config=await qaPublicConfig({token});
 const out=await run({mode,html,css,js,config,token,
   projectId:project,projectNumber:number,notify:console.log});
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
