import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runApp749QaHostingCspRepair} from './app749-qa-hosting-repair-csp.mjs';
const html=readFileSync('qa/app749/qa749.html','utf8');
const css=readFileSync('qa/app749/qa749.css','utf8');
const js=readFileSync('qa/app749/qa749.js','utf8');
const oldQa=readFileSync('scripts/__fixtures__/qa749-inline-original.html','utf8')
 .split('\n').slice(1).join('\n');
assert(!html.includes('<script type="module">'),'No inline JS on QA Hosting CSP');
assert(!html.includes('<style>'),'No inline CSS on QA Hosting CSP');
assert(html.includes('src="/qa749.js"'));
assert(html.includes('href="/qa749.css"'));
assert(js.includes('Firebase SDK 불러오기 실패'),'SDK fetch failure visible to user');
const temp=mkdtempSync(join(tmpdir(),'qa749-csp-'));
try{
 const file=join(temp,'qa749.mjs');writeFileSync(file,js);
 execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}finally{rmSync(temp,{recursive:true,force:true})}
const enc=s=>createHash('sha256').update(gzipSync(Buffer.from(s),{level:9,mtime:0})).digest('hex');
const targetHashes={'/qa749.html':enc(html),'/qa749.js':enc(js),'/qa749.css':enc(css)};
const originalHashes={'/index.html':'a'.repeat(64),'/qa749.html':enc(oldQa)};
const site='https://firebasehosting.googleapis.com/v1beta1/sites/soridraw-qa-owner-584';
const host='https://soridraw-qa-owner-584.web.app';
const old='sites/soridraw-qa-owner-584/versions/old';
const next='sites/soridraw-qa-owner-584/versions/qa749-repaired';
const config={headers:[{glob:'/qa749.html',headers:{'Cache-Control':'no-store'}}],
  cleanUrls:false,rewrites:[{glob:'/old-path',path:'/index.html'}]};
const oldIndex='<html>SORIDRAW · 독립 QA 팔로워 실시간 수신 onValue</html>';
function fake({denyPatch=false,dropPatch=false,changeRelease=false,invalidOldHtml=false,
              badJsSmoke=false}={}){
 let current=old,clone=false,patched=false,appended=false,final=false;
 const calls=[];
 const out=(value,status=200)=>new Response(JSON.stringify(value),
  {status,headers:{'Content-Type':'application/json'}});
 const send=async(url,opts)=>{
   const path=url.split('?')[0];calls.push({url,method:opts.method,body:opts.body});
   if(path===host+'/')return new Response(oldIndex,{status:200});
   if(path===host+'/qa749.html')
     return new Response(current===old?(invalidOldHtml?'unexpected':oldQa):html,{status:200});
   if(path===host+'/qa749.js')
     return new Response(badJsSmoke?'unexpected':js,{status:200});
   if(path===host+'/qa749.css')return new Response(css,{status:200});
   if(path===site+'/releases'&&opts.method==='GET'){
     return out({releases:[{name:'sites/soridraw-qa-owner-584/releases/original',
       version:{name:changeRelease&&clone?'sites/soridraw-qa-owner-584/versions/external':current}}]});
   }
   if(path===site+'/versions/old'&&opts.method==='GET')
     return out({name:old,status:'FINALIZED',config});
   if(path===site+'/versions/qa749-repaired'&&opts.method==='GET')
     return out({name:next,status:'CREATED',config:patched?config:{}});
   if(path===site+'/versions/old/files'&&opts.method==='GET')
     return out({files:Object.entries(originalHashes).map(([path,hash])=>({path,hash}))});
   if(path===site+'/versions/qa749-repaired/files'&&opts.method==='GET'){
     const files=appended?{...originalHashes,...targetHashes}:originalHashes;
     return out({files:Object.entries(files).map(([path,hash])=>({path,hash}))});
   }
   if(path===site+'/versions:clone'&&opts.method==='POST'){
     assert.deepEqual(JSON.parse(opts.body),{sourceVersion:old,finalize:false});
     clone=true;return out({name:'projects/soridraw-app/operations/qa749-csp',done:false});
   }
   if(path==='https://firebasehosting.googleapis.com/v1beta1/projects/soridraw-app/operations/qa749-csp')
     return out({name:'projects/soridraw-app/operations/qa749-csp',done:true,response:{name:next}});
   if(path===site+'/versions/qa749-repaired'&&opts.method==='PATCH'){
     const mask=new URL(url).searchParams.get('updateMask');
     if(mask==='config'){
       assert.deepEqual(JSON.parse(opts.body),{name:next,config});
       if(denyPatch)return out({error:'denied'},403);
       if(!dropPatch)patched=true;
       return out({name:next,status:'CREATED',config:patched?config:{}});
     }
     assert.equal(mask,'status');assert.deepEqual(JSON.parse(opts.body),{status:'FINALIZED'});
     assert(patched);assert(appended);final=true;return out({});
   }
   if(path===site+'/versions/qa749-repaired:populateFiles'&&opts.method==='POST'){
     assert.deepEqual(JSON.parse(opts.body),{files:targetHashes});
     appended=true;
     return out({uploadRequiredHashes:Object.values(targetHashes),
       uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/qa749-repaired/files'});
   }
   if(path.startsWith('https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/qa749-repaired/files/')
      &&opts.method==='POST'){
     const hash=path.split('/').pop();
     assert(Object.values(targetHashes).includes(hash));
     assert.equal(createHash('sha256').update(opts.body).digest('hex'),hash);
     return out({});
   }
   if(path===site+'/releases'&&opts.method==='POST'){
     assert(final,'only finalized version may release');
     assert.equal(opts.body,undefined,'release type must be omitted');
     const version=new URL(url).searchParams.get('versionName');
     assert([old,next].includes(version));
     current=version;return out({version:{name:version}});
   }
   throw Error('UNEXPECTED_'+opts.method+'_'+path);
 };
 return{send,calls,getCurrent:()=>current};
}
const opts={mode:'--check',html,css,js,token:'oauth_'+'a'.repeat(60),
 projectId:'soridraw-app',projectNumber:'1083981050742'};
const check=fake();
assert.equal((await runApp749QaHostingCspRepair({...opts,send:check.send})).status,'READY');
assert(check.calls.every(x=>x.method==='GET'),'check must be read-only');
const good=fake();
assert.equal((await runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:good.send})).status,'PASS');
assert.equal(good.getCurrent(),next);
assert.equal(good.calls.filter(x=>x.method==='POST'&&x.url.startsWith('https://upload-firebasehosting')).length,3);
assert.equal(good.calls.filter(x=>x.method==='PATCH'&&x.url.includes('updateMask=config')).length,1);
const denied=fake({denyPatch:true});
await assert.rejects(()=>runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:denied.send}),
 /RESTORE_CLONE_CONFIG_HTTP_403/);
assert.equal(denied.getCurrent(),old,'do not publish with config patch rejected');
const ignored=fake({dropPatch:true});
await assert.rejects(()=>runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:ignored.send}),
 /CLONE_SERVING_CONFIG_NOT_IDENTICAL_HOLD/);
assert.equal(ignored.getCurrent(),old);
const badOld=fake({invalidOldHtml:true});
await assert.rejects(()=>runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:badOld.send}),
 /ORIGINAL_QA_INLINE_PAGE_UNEXPECTED/);
assert.equal(badOld.calls.some(x=>x.method==='POST'),false,'no writes on wrong live page');
const concurrent=fake({changeRelease:true});
await assert.rejects(()=>runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:concurrent.send}),
 /CONCURRENT_QA_HOSTING_RELEASE_HOLD/);
assert.equal(concurrent.getCurrent(),old);
const smoke=fake({badJsSmoke:true});
await assert.rejects(()=>runApp749QaHostingCspRepair({...opts,mode:'--deploy',send:smoke.send}),
 /QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE/);
assert.equal(smoke.getCurrent(),old,'must restore old QA Hosting on missing JS');
console.log('APP749_QA_BROWSER_CSP_NO_INLINE_JS_CSS=PASS');
console.log('APP749_QA_BROWSER_SDK_ERROR_VISIBLE=PASS');
console.log('APP749_QA_CSP_REPAIR_CLONE_OLD_SITE_UNCHANGED=PASS');
console.log('APP749_QA_CSP_REPAIR_BAD_CONFIG_OR_DEPLOY_ROLLBACK=PASS');
console.log('APP749_QA_BROWSER_LIVE_AUTH_DEVICE=NOT_RUN');
