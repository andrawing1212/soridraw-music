import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{gzipSync}from'node:zlib';
import{createHash}from'node:crypto';
import{qaPublicConfig,runApp749QaHostingUiFix}from'./app749-qa-hosting-fix-ui-init.mjs';
const html=readFileSync('qa/app749/qa749.html','utf8');
const js=readFileSync('qa/app749/qa749.js','utf8');
const css=readFileSync('qa/app749/qa749.css','utf8');
const style=html.match(/<style>\s*([\s\S]*?)\s*<\/style>/)?.[1];
assert.equal(style?.trim(),css.trim(),'Restore exact previously working dark style');
assert(!html.includes('<script type="module">'),'QA JS must remain an external module');
assert(html.includes('src="/qa749.js"'));
assert(!html.includes('id="manual"'),'QA should never ask for JSON copy/paste');
assert(js.includes("'/qa749-config.json'"));
assert(!js.includes("$('manual')"));
const dir=mkdtempSync(join(tmpdir(),'qa749-ui-init-'));
try{
 const local=join(dir,'qa749.mjs');writeFileSync(local,js);
 execFileSync(process.execPath,['--check',local],{stdio:'pipe'});
}finally{rmSync(dir,{recursive:true,force:true})}
const appId='1:1083981050742:web:aabbccddeeff';
const firebaseConfig={
 apiKey:'AIza'+'b'.repeat(35),appId,projectId:'soridraw-app',
 authDomain:'soridraw-app.firebaseapp.com',
 messagingSenderId:'1083981050742',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app',
};
const token='qa_fake_oauth_'+'x'.repeat(50);
function firebaseMock({wrongApp=false,duplicate=false,wrongConfig=false,
  numericName=false}={}){
 const calls=[];
 const send=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(opts.method,'GET','Firebase config introspection is read-only');
  assert(url.startsWith('https://firebase.googleapis.com/v1beta1/projects/soridraw-app/webApps'),
    'QA Firebase project only');
  const make=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
  if(url.includes('/config')){
   return make({...firebaseConfig,...(wrongConfig?{projectId:'soridraw-app-866a5'}:{})});
  }
  const base={name:'projects/'+(numericName?'1083981050742':'soridraw-app')+'/webApps/'+appId,
    appId,displayName:wrongApp?'OTHER':'SORIDRAW-QA',state:'ACTIVE'};
  return make({apps:[base,...(duplicate?[base]:[])]});
 };
 return{send,calls};
}
const ok=firebaseMock({numericName:true});
const c=await qaPublicConfig({token,send:ok.send});
assert.deepEqual(c,firebaseConfig);
assert.equal(ok.calls.length,2);
const unknown=firebaseMock({wrongApp:true});
await assert.rejects(()=>qaPublicConfig({token,send:unknown.send}),
 /QA_WEB_APP_NOT_UNIQUE/);
const duplic=firebaseMock({duplicate:true});
await assert.rejects(()=>qaPublicConfig({token,send:duplic.send}),
 /QA_WEB_APP_NOT_UNIQUE/);
const wrong=firebaseMock({wrongConfig:true});
await assert.rejects(()=>qaPublicConfig({token,send:wrong.send}),
 /QA_WEB_APP_CONFIG_MISMATCH/);
const gz=s=>gzipSync(Buffer.from(s,'utf8'),{level:9,mtime:0});
const sha=s=>createHash('sha256').update(gz(s)).digest('hex');
const oldHtml='<!doctype html><h1>SORIDRAW · 독립 QA 팔로우 실검증</h1><link rel="stylesheet" href="/qa749.css"><script type="module" src="/qa749.js"></script>';
const oldJs='// QA749 old loader\nconst original="/__/firebase/init.json";$("manual").hidden=false;\n';
const oldCss=css;
const oldRoot='<h1>SORIDRAW 독립 QA onValue</h1>';
const oldFiles={'/index.html':sha(oldRoot),'/qa749.html':sha(oldHtml),
 '/qa749.js':sha(oldJs),'/qa749.css':sha(oldCss)};
const newFileBytes={'/qa749.html':html,'/qa749.js':js,
 '/qa749-config.json':JSON.stringify(c)+'\n'};
const newHashes=Object.fromEntries(Object.entries(newFileBytes).map(([p,t])=>[p,sha(t)]));
const site='https://firebasehosting.googleapis.com/v1beta1/sites/soridraw-qa-owner-584';
const host='https://soridraw-qa-owner-584.web.app';
const old='sites/soridraw-qa-owner-584/versions/live-before-fix';
const next='sites/soridraw-qa-owner-584/versions/new-autoconfig';
const serving={headers:[{glob:'/existing',headers:{'Content-Security-Policy':"script-src 'self'"}}],
 rewrites:[{glob:'/old',path:'/index.html'}]};
function hostingMock({badOriginal=false,wrongCloneConfig=false,smokeBad=false,changeLive=false}={}){
 const calls=[];let current=old,final=false,populated=false;
 let patch=wrongCloneConfig?false:true;
 const result=(x,s=200)=>new Response(JSON.stringify(x),{status:s,
  headers:{'Content-Type':'application/json'}});
 const content=(text)=>new Response(text,{status:200});
 const send=async(url,opts)=>{
  calls.push({url,method:opts.method});
  const path=url.split('?')[0];
  if(path===host+'/')return content(oldRoot);
  if(path===host+'/qa749.html')
   return content(current===old?(badOriginal?'unexpected':oldHtml):html);
  if(path===host+'/qa749.js')
   return content(current===old?oldJs:js);
  if(path===host+'/qa749.css')return content(css);
  if(path===host+'/qa749-config.json')
   return content(smokeBad?'not JSON':JSON.stringify(c));
  if(path===site+'/releases'&&opts.method==='GET')return result({releases:[
   {name:'sites/soridraw-qa-owner-584/releases/original',
    version:{name:changeLive&&populated?'sites/soridraw-qa-owner-584/versions/other':current}}
  ]});
  if(path===site+'/versions/live-before-fix'&&opts.method==='GET')
   return result({name:old,status:'FINALIZED',config:serving});
  if(path===site+'/versions/new-autoconfig'&&opts.method==='GET')
   return result({name:next,status:'CREATED',config:patch?serving:{}});
  if(path===site+'/versions/live-before-fix/files'&&opts.method==='GET')
   return result({files:Object.entries(oldFiles).map(([path,hash])=>({path,hash}))});
  if(path===site+'/versions/new-autoconfig/files'&&opts.method==='GET'){
   const m=populated?{...oldFiles,...newHashes}:oldFiles;
   return result({files:Object.entries(m).map(([path,hash])=>({path,hash}))});
  }
  if(path===site+'/versions:clone'&&opts.method==='POST'){
   assert.deepEqual(JSON.parse(opts.body),{sourceVersion:old,finalize:false});
   return result({name:'projects/soridraw-app/operations/qa749-autoconfig',done:false});
  }
  if(path==='https://firebasehosting.googleapis.com/v1beta1/projects/soridraw-app/operations/qa749-autoconfig')
   return result({name:'projects/soridraw-app/operations/qa749-autoconfig',
    done:true,response:{name:next}});
  if(path===site+'/versions/new-autoconfig'&&opts.method==='PATCH'){
   const mask=new URL(url).searchParams.get('updateMask');
   if(mask==='config'){assert.deepEqual(JSON.parse(opts.body),{name:next,config:serving});
    patch=true;return result({name:next,status:'CREATED',config:serving});}
   assert.equal(mask,'status');
   assert.deepEqual(JSON.parse(opts.body),{status:'FINALIZED'});
   assert(populated);final=true;return result({});
  }
  if(path===site+'/versions/new-autoconfig:populateFiles'&&opts.method==='POST'){
   assert.deepEqual(JSON.parse(opts.body),{files:newHashes});
   populated=true;
   return result({uploadRequiredHashes:Object.values(newHashes),
    uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/new-autoconfig/files'});
  }
  if(path.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/new-autoconfig/files/')&&opts.method==='POST'){
   const hash=path.split('/').at(-1);
   assert(Object.values(newHashes).includes(hash));
   assert.equal(createHash('sha256').update(opts.body).digest('hex'),hash);
   return result({});
  }
  if(path===site+'/releases'&&opts.method==='POST'){
   assert(final,'only finalized version released');
   assert.equal(opts.body,undefined,'no output-only DEPLOY type');
   const v=new URL(url).searchParams.get('versionName');
   assert([old,next].includes(v));
   current=v;return result({version:{name:v}});
  }
  throw Error('UNEXPECTED_'+opts.method+'_'+path);
 };
 return{send,calls,getCurrent:()=>current};
}
const opts={html,css,js,config:c,mode:'--check',token,projectId:'soridraw-app',
 projectNumber:'1083981050742'};
const read=hostingMock();
assert.equal((await runApp749QaHostingUiFix({...opts,send:read.send})).status,'READY');
assert(read.calls.every(v=>v.method==='GET'),'preflight read only');
const good=hostingMock();
const deployed=await runApp749QaHostingUiFix({...opts,mode:'--deploy',send:good.send});
assert.equal(deployed.status,'PASS');
assert.equal(good.getCurrent(),next);
assert.equal(good.calls.filter(v=>v.method==='POST'&&v.url.startsWith('https://upload-firebasehosting.googleapis.com')).length,3);
const changed=hostingMock({changeLive:true});
await assert.rejects(()=>runApp749QaHostingUiFix({...opts,mode:'--deploy',send:changed.send}),
 /CONCURRENT_QA_HOSTING_RELEASE_HOLD/);
assert.equal(changed.getCurrent(),old);
const badOld=hostingMock({badOriginal:true});
await assert.rejects(()=>runApp749QaHostingUiFix({...opts,mode:'--deploy',send:badOld.send}),
 /ORIGINAL_QA_PAGE_UNEXPECTED/);
assert.equal(badOld.calls.filter(v=>v.method==='POST').length,0);
const badPage=hostingMock({smokeBad:true});
await assert.rejects(()=>runApp749QaHostingUiFix({...opts,mode:'--deploy',send:badPage.send}),
 /QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE/);
assert.equal(badPage.getCurrent(),old,'rollback old QA live version');
console.log('APP749_QA_DARK_INLINE_STYLE_FALLBACK=PASS');
console.log('APP749_QA_AUTO_FIREBASE_CONFIG_FROM_EXACT_QA_WEB_APP=PASS');
console.log('APP749_QA_OLD_RECEIVER_CSP_CONFIG_UNCHANGED=PASS');
console.log('APP749_QA_ORIGINAL_FILES_LOCKED_AND_ROLLBACK=PASS');
console.log('APP749_QA_REAL_PC_MOBILE_AUTH=NOT_RUN');
