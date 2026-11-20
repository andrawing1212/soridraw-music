import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {runApp749QaHosting} from './app749-qa-hosting-add-page.mjs';
const html=readFileSync('scripts/__fixtures__/qa749-inline-original.html','utf8').split('\n').slice(1).join('\n');
const embedded=html.split('<script type="module">')[1]?.split('</script>')[0];
assert(embedded,'QA browser module missing');
const temp=mkdtempSync(join(tmpdir(),'app749-qa-client-'));
try{
 const filename=join(temp,'qa749.mjs');
 writeFileSync(filename,embedded);
 execFileSync(process.execPath,['--check',filename],{stdio:'pipe'});
}finally{rmSync(temp,{recursive:true,force:true})}
assert(html.includes("initializeAppCheck"));
assert(html.includes("signInWithEmailAndPassword"));
assert(html.includes("onValue"));
assert(html.includes("soridraw-qa-owner-584.web.app"));
assert(html.includes("inMemoryPersistence"));
const site='https://firebasehosting.googleapis.com/v1beta1/sites/soridraw-qa-owner-584';
const host='https://soridraw-qa-owner-584.web.app';
const old='sites/soridraw-qa-owner-584/versions/9737bd-old';
const fresh='sites/soridraw-qa-owner-584/versions/new-749';
const expectedHash=createHash('sha256').update(gzipSync(Buffer.from(html),{level:9,mtime:0})).digest('hex');
const priorText='<html>SORIDRAW · 독립 QA 팔로워 실시간 수신 onValue</html>';
const expectedConfig={headers:[{glob:'/**',headers:{'Cache-Control':'max-age=60'}}],
  cleanUrls:false,rewrites:[{glob:'/qa-existing',path:'/index.html'}]};
function fake({missingIndex=false,wrongOperation=false,changedRelease=false,smokeFail=false,configPatchIgnored=false,configPatchDenied=false,cloneAlreadyMatching=false}={}){
 const calls=[];let current=old,clone=false,appended=false,done=false,final=false;
 let candidateConfig=cloneAlreadyMatching?structuredClone(expectedConfig):{};
 const make=(value,code=200)=>new Response(
  JSON.stringify(value),{status:code,headers:{'Content-Type':'application/json'}});
 const send=async(url,opts)=>{
  calls.push({url,method:opts.method});
  const prefix=site.replace('/sites/','/');
  const path=url.split('?')[0];
  if(path===host+'/')return new Response(priorText,{status:200});
  if(path===host+'/qa749.html')return new Response(smokeFail?'not ready':html,{status:200});
  if(path===site+'/releases'&&opts.method==='GET'){
   return make({releases:[{name:'sites/soridraw-qa-owner-584/releases/old',
     version:{name:changedRelease&&clone?'sites/soridraw-qa-owner-584/versions/external':current}}]});
  }
  if(path===site+'/versions:clone'&&opts.method==='POST'){
   const j=JSON.parse(opts.body);
   assert.deepEqual(j,{sourceVersion:old,finalize:false});
   clone=true;
   return make({name:wrongOperation?'projects/soridraw-app-866a5/operations/qa749':
     'projects/soridraw-app/operations/qa749',done:false});
  }
  if(path==='https://firebasehosting.googleapis.com/v1beta1/projects/soridraw-app/operations/qa749'){
   return make({name:'projects/soridraw-app/operations/qa749',done:true,response:{name:fresh}});
  }
  if(path===site+'/versions/9737bd-old'&&opts.method==='GET')
   return make({name:old,status:'FINALIZED',config:expectedConfig});
  if(path===site+'/versions/new-749'&&opts.method==='GET')
   return make({name:fresh,status:'CREATED',config:candidateConfig});
  if(path===site+'/versions/9737bd-old/files'&&opts.method==='GET')
   return make({files:missingIndex?[]:[{path:'/index.html',hash:'a'.repeat(64)}]});
  if(path===site+'/versions/new-749/files'&&opts.method==='GET')
   return make({files:[{path:'/index.html',hash:'a'.repeat(64)},
     ...(appended?[{path:'/qa749.html',hash:expectedHash}]:[])]});
  if(path===site+'/versions/new-749:populateFiles'&&opts.method==='POST'){
   assert(clone);
   assert.deepEqual(JSON.parse(opts.body),{files:{'/qa749.html':expectedHash}});
   appended=true;
   return make({uploadRequiredHashes:[expectedHash],
     uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/sites/soridraw-qa-owner-584/versions/new-749/files'});
  }
  if(path.endsWith('/files/'+expectedHash)&&opts.method==='POST'){
   assert.equal(opts.headers['Content-Type'],'application/octet-stream');
   assert.equal(createHash('sha256').update(opts.body).digest('hex'),expectedHash);
   return make({});
  }
  if(path===site+'/versions/new-749'&&opts.method==='PATCH'){
   const mask=new URL(url).searchParams.get('updateMask');
   if(mask==='config'){
     assert.deepEqual(JSON.parse(opts.body),{name:fresh,config:expectedConfig});
     if(configPatchDenied)return make({error:{message:'PERMISSION_DENIED'}},403);
     if(!configPatchIgnored)candidateConfig=structuredClone(expectedConfig);
     return make({name:fresh,status:'CREATED',config:candidateConfig});
   }
   assert.equal(mask,'status');
   assert.deepEqual(JSON.parse(opts.body),{status:'FINALIZED'});
   assert.deepEqual(candidateConfig,expectedConfig,'never publish with altered rules');
   final=true;return make({});
  }
  if(path===site+'/releases'&&opts.method==='POST'){
   // Firebase Hosting Release.type is output-only for normal DEPLOY;
   // supplying {"type":"DEPLOY"} is rejected with HTTP 400.
   assert.equal(opts.body,undefined,'normal release and rollback must omit body');
   assert.equal(opts.headers['Content-Type'],undefined,'no JSON release body');
   const requested=new URL(url).searchParams.get('versionName');
   assert(final);
   current=requested;
   return make({name:'sites/soridraw-qa-owner-584/releases/new',
     version:{name:requested}});
  }
  throw Error('UNEXPECTED_NETWORK_'+opts.method+'_'+path);
 };
 return{send,calls,getCurrent:()=>current};
}
const opts={mode:'--check',html,token:'oauth_'+'x'.repeat(60),
 projectId:'soridraw-app',projectNumber:'1083981050742'};
const a=fake();
assert.equal((await runApp749QaHosting({...opts,send:a.send})).status,'READY');
assert.equal(a.calls.some(x=>x.method!=='GET'),false,'--check should only read');
const b=fake();
const result=await runApp749QaHosting({...opts,mode:'--deploy',send:b.send});
assert.equal(result.status,'PASS');
assert.equal(b.getCurrent(),fresh);
const patchCalls=b.calls.filter(x=>x.method==='PATCH'&&x.url.includes('updateMask=config'));
assert.equal(patchCalls.length,1,'clone that drops serving config must repair clone only');
const ignore=fake({configPatchIgnored:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:ignore.send}),
 /CLONE_SERVING_CONFIG_NOT_IDENTICAL_HOLD/);
assert.equal(ignore.getCurrent(),old,'mismatched rules must never be released');
const denied=fake({configPatchDenied:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:denied.send}),
 /RESTORE_CLONE_CONFIG_HTTP_403/);
assert.equal(denied.getCurrent(),old,'failed config patch must keep old release');
const equal=fake({cloneAlreadyMatching:true});
assert.equal((await runApp749QaHosting({...opts,mode:'--deploy',send:equal.send})).status,'PASS');
assert.equal(equal.calls.filter(x=>x.method==='PATCH'&&x.url.includes('updateMask=config')).length,0);

assert.equal(b.calls.filter(x=>x.method==='POST').length,4,'clone, populate, upload, release exactly');
assert(!b.calls.some(x=>x.url.includes('/soridraw-app-866a5/')));
const wrong=fake({wrongOperation:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:wrong.send}),
 /CLONE_OPERATION_INVALID/);
assert.equal(wrong.calls.filter(x=>x.method==='POST').length,1,
 'invalid project operation never triggers upload or release');
assert.equal(wrong.getCurrent(),old,'original release must remain active');
const operationPolls=b.calls.filter(x=>
 x.url.endsWith('/projects/soridraw-app/operations/qa749'));
assert.equal(operationPolls.length,1,'poll only the exact QA Firebase project operation');
const c=fake({changedRelease:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:c.send}),
 /CONCURRENT_QA_HOSTING_RELEASE_HOLD/);
assert.equal(c.calls.some(x=>x.url.startsWith(site+'/releases?versionName=')),false,
 'never release over concurrent QA Hosting update');
const d=fake({missingIndex:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:d.send}),
 /OLD_FILES_CONFLICT_OR_MISSING/);
assert.equal(d.calls.some(x=>x.method==='POST'),false,'no writes without original index');
const e=fake({smokeFail:true});
await assert.rejects(()=>runApp749QaHosting({...opts,mode:'--deploy',send:e.send}),
 /QA_PAGE_OR_EXISTING_RECEIVER_HTTP_FAILURE/);
assert.equal(e.getCurrent(),old,'failed smoke must restore existing original version');
console.log('APP749_QA_HOSTING_READ_ONLY_PREFLIGHT=PASS');
console.log('APP749_QA_CLONE_PRESERVES_OLD_RECEIVER_AND_APPEND_ONLY=PASS');
console.log('APP749_QA_HOSTING_CONCURRENT_CHANGE_FAIL_CLOSED=PASS');
console.log('APP749_QA_HOSTING_BOUNDED_ROLLBACK=PASS');
console.log('APP749_QA_CLONED_SERVING_CONFIG_RESTORED_FROM_EXACT_LIVE=PASS');
console.log('APP749_QA_CLONED_CONFIG_DRIFT_OR_PATCH_FAILURE_NO_RELEASE=PASS');
console.log('APP749_QA_REAL_HOSTING_DEPLOY=NOT_RUN');
