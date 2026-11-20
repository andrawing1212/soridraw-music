import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{join}from'node:path';import{tmpdir}from'node:os';
import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{qa749ScopedCsp,runApp749QaScopedCsp}from'./app749-qa-hosting-scoped-csp.mjs';
const html=readFileSync('qa/app749/qa749.html','utf8');
const css=readFileSync('qa/app749/qa749.css','utf8');
const js=readFileSync('qa/app749/qa749.js','utf8');
const temporary=mkdtempSync(join(tmpdir(),'qa749-csp-live-'));
try{
 const file=join(temporary,'qa749.mjs');
 writeFileSync(file,js);execFileSync(process.execPath,['--check',file]);
}finally{rmSync(temporary,{recursive:true,force:true})}
assert(html.includes('<style>')&&html.includes('src="/qa749.js"'));
assert(!html.includes('<script type="module">'));
assert(js.includes("fetch('/qa749-config.json'"));
assert(!js.includes("for(const url of ['/__/firebase/init.json'"));
const policy="default-src 'none'; script-src 'self' https://www.gstatic.com https://*.asia-southeast1.firebasedatabase.app; style-src 'unsafe-inline'; connect-src https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app wss://soridraw-qa-sg.asia-southeast1.firebasedatabase.app https://*.asia-southeast1.firebasedatabase.app wss://*.asia-southeast1.firebasedatabase.app";
const scoped=qa749ScopedCsp(policy);
assert(scoped.includes("default-src 'none'"));
assert(scoped.includes("style-src 'unsafe-inline'"));
assert(scoped.includes("connect-src https://identitytoolkit.googleapis.com"));
assert(scoped.includes(" 'self' https://firebaseappcheck.googleapis.com"));
assert(scoped.includes('https://soridraw-owner-qa-583.soridraw-qa.workers.dev'));
assert(scoped.includes('frame-src https://www.google.com/recaptcha/'));
assert(scoped.includes('script-src'));
assert(!scoped.includes("'unsafe-eval'"));
assert(!scoped.includes("https://soridraw.com"));
await assert.rejects(async()=>qa749ScopedCsp("default-src *; connect-src *; script-src *; style-src *"),/QA_CSP_DEFAULT_DRIFT/);
const c={apiKey:'AIza'+'b'.repeat(35),appId:'1:1083981050742:web:aabbcc',
 projectId:'soridraw-app',authDomain:'soridraw-app.firebaseapp.com',
 messagingSenderId:'1083981050742',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'};
const sha=s=>createHash('sha256').update(gzipSync(Buffer.from(s),{level:9,mtime:0})).digest('hex');
const oldJs="// Existing QA client\nfor(const url of ['/__/firebase/init.json','/qa749-config.json']){}\nconst receiver='soridraw-app749-receiver';\n";
const oldConfig=JSON.stringify(c)+'\n';
const oldRoot='<h1>SORIDRAW QA onValue</h1>';
const files={'/index.html':sha(oldRoot),'/qa749.html':sha(html),
 '/qa749.js':sha(oldJs),'/qa749.css':sha(css),'/qa749-config.json':sha(oldConfig)};
const desiredFiles={...files,'/qa749.js':sha(js)};
const site='https://firebasehosting.googleapis.com/v1beta1/sites/soridraw-qa-owner-584';
const host='https://soridraw-qa-owner-584.web.app';
const old='sites/soridraw-qa-owner-584/versions/original';
const next='sites/soridraw-qa-owner-584/versions/scoped-csp';
const serving={headers:[{glob:'/**',headers:{'Content-Security-Policy':policy}}],
 rewrites:[{glob:'/only-old',path:'/index.html'}],cleanUrls:false};
const servingScoped={...serving,headers:[...serving.headers,
 {glob:'/qa749.html',headers:{'Content-Security-Policy':scoped}}]};
function fake({oldDrift=false,cspBad=false,jsBad=false,concurrent=false}={}){
 let current=old,configured=false,populated=false,final=false;
 const calls=[];
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
 const page=(body,csp)=>new Response(body,{status:200,headers:{
  'Content-Security-Policy':csp}});
 const send=async(url,opts)=>{
  const path=url.split('?')[0];calls.push({url,method:opts.method,body:opts.body});
  if(path===host+'/')return page(oldRoot,policy);
  if(path===host+'/qa749.html')return page(oldDrift?'changed':html,
    current===old||cspBad?policy:scoped);
  if(path===host+'/qa749.js')return page(current===old||jsBad?oldJs:js,policy);
  if(path===host+'/qa749.css')return page(css,policy);
  if(path===host+'/qa749-config.json')return page(oldConfig,policy);
  if(path===site+'/releases'&&opts.method==='GET')
   return json({releases:[{name:'sites/soridraw-qa-owner-584/releases/old',
    version:{name:concurrent&&configured?'sites/soridraw-qa-owner-584/versions/external':current}}]});
  if(path===site+'/versions/original'&&opts.method==='GET')
   return json({name:old,status:'FINALIZED',config:serving});
  if(path===site+'/versions/scoped-csp'&&opts.method==='GET')
   return json({name:next,status:'CREATED',
    config:configured?servingScoped:{}});
  if(path===site+'/versions/original/files'&&opts.method==='GET')
   return json({files:Object.entries(files).map(([path,hash])=>({path,hash}))});
  if(path===site+'/versions/scoped-csp/files'&&opts.method==='GET')
   return json({files:Object.entries(populated?desiredFiles:files)
    .map(([path,hash])=>({path,hash}))});
  if(path===site+'/versions:clone'&&opts.method==='POST'){
   assert.deepEqual(JSON.parse(opts.body),{sourceVersion:old,finalize:false});
   return json({name:'projects/soridraw-app/operations/scoped749',done:false});
  }
  if(path==='https://firebasehosting.googleapis.com/v1beta1/projects/soridraw-app/operations/scoped749')
   return json({name:'projects/soridraw-app/operations/scoped749',
    done:true,response:{name:next}});
  if(path===site+'/versions/scoped-csp'&&opts.method==='PATCH'){
   const mask=new URL(url).searchParams.get('updateMask');
   if(mask==='config'){
    assert.deepEqual(JSON.parse(opts.body),{name:next,config:servingScoped});
    configured=true;
    return json({name:next,status:'CREATED',config:servingScoped});
   }
   assert.equal(mask,'status');
   assert.deepEqual(JSON.parse(opts.body),{status:'FINALIZED'});
   assert(configured&&populated);
   final=true;return json({});
  }
  if(path===site+'/versions/scoped-csp:populateFiles'&&opts.method==='POST'){
   assert.deepEqual(JSON.parse(opts.body),{files:{'/qa749.js':sha(js)}});
   populated=true;return json({uploadRequiredHashes:[sha(js)],
    uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/scoped-csp/files'});
  }
  if(path.endsWith('/files/'+sha(js))&&opts.method==='POST'){
   assert.equal(createHash('sha256').update(opts.body).digest('hex'),sha(js));
   return json({});
  }
  if(path===site+'/releases'&&opts.method==='POST'){
   assert(final&&opts.body===undefined,'only finalized no-body Hosting release');
   const version=new URL(url).searchParams.get('versionName');
   assert([old,next].includes(version));
   current=version;return json({version:{name:version}});
  }
  throw Error('UNEXPECTED_QA_HTTP_'+opts.method+'_'+path);
 };
 return{send,calls,getCurrent:()=>current};
}
const args={html,css,js,config:c,token:'testOauth'+'a'.repeat(60),
 smokeAttempts:1,smokeDelayMs:0,
 projectId:'soridraw-app',projectNumber:'1083981050742'};
const check=fake();
assert.equal((await runApp749QaScopedCsp({...args,mode:'--check',send:check.send})).status,'READY');
assert(check.calls.every(x=>x.method==='GET'),'--check must do zero writes');
const yes=fake();
const result=await runApp749QaScopedCsp({...args,mode:'--deploy',send:yes.send});
assert.equal(result.status,'PASS');
assert.equal(yes.getCurrent(),next);
assert.equal(yes.calls.filter(x=>x.method==='POST'&&x.url.startsWith('https://upload-firebasehosting')).length,1);
assert.equal(yes.calls.filter(x=>x.method==='PATCH'&&x.url.includes('updateMask=config')).length,1);
const drift=fake({oldDrift:true});
await assert.rejects(()=>runApp749QaScopedCsp({...args,mode:'--deploy',send:drift.send}),
 /ORIGINAL_QA_PAGE_UNEXPECTED/);
assert(drift.calls.every(x=>x.method==='GET'));
const conflict=fake({concurrent:true});
await assert.rejects(()=>runApp749QaScopedCsp({...args,mode:'--deploy',send:conflict.send}),
 /CONCURRENT_QA_HOSTING_RELEASE_HOLD/);
assert.equal(conflict.getCurrent(),old);
const problems=[];
const broken=fake({cspBad:true});
await assert.rejects(()=>runApp749QaScopedCsp({...args,mode:'--deploy',send:broken.send,
 notify:x=>problems.push(x)}),
 /QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE/);
assert.equal(broken.getCurrent(),old,'revert on unchanged QA749 CSP after release');
const report=problems.find(x=>x.startsWith('APP749_QA_POST_RELEASE_DIAGNOSTIC='));
assert(report,'QA smoke must disclose safe per-check result before rollback');
const failed=JSON.parse(report.split('=')[1]);
assert.equal(failed.qaPageCspExact,false);
assert.equal(failed.receiverCspUnchanged,true);
assert.equal(failed.stylesheetUnchanged,true);
assert.equal(failed.publicConfigUnchanged,true);
assert.equal(failed.configValid,true);
const jsProblems=[];
const wrongJs=fake({jsBad:true});
await assert.rejects(()=>runApp749QaScopedCsp({...args,mode:'--deploy',send:wrongJs.send,
 notify:x=>jsProblems.push(x)}),
 /QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE/);
assert.equal(wrongJs.getCurrent(),old,'revert when QA JavaScript body is stale');
const jsReport=JSON.parse(jsProblems.find(x=>x.startsWith('APP749_QA_POST_RELEASE_DIAGNOSTIC=')).split('=')[1]);
assert.equal(jsReport.scriptExactlyUpdated,false);
assert.equal(jsReport.qaPageCspExact,true);
console.log('APP749_QA_LIVE_CSP_ROOT_CAUSE_SELF_GOOGLE_WORKER_BLOCKED=PASS');
console.log('APP749_QA_ONLY_QA749_HTML_CONNECT_FRAME_SCRIPT_SCOPED=PASS');
console.log('APP749_QA_ORIGINAL_RECEIVER_CSP_ALL_FILES_UNCHANGED=PASS');
console.log('APP749_QA_CONFIG_SINGLE_VERIFIED_QA_SOURCE=PASS');
console.log('APP749_QA_SCOPED_CSP_SMOKE_ROLLBACK=PASS');
console.log('APP749_QA_POST_RELEASE_FAILURE_REASON_ISOLATED=PASS');
console.log('APP749_QA_LIVE_AUTH_PC_MOBILE=NOT_RUN');
