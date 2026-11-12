// APP584 targeted offline browser proof, no actual Firebase/Cloudflare calls.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../..');
const out=join(dir,'dist-qa584');
const hosting=JSON.parse(readFileSync(join(root,'firebase.qa584.json'),'utf8')).hosting;
assert.equal(hosting.site,'soridraw-qa-owner-584');
assert.equal(hosting.public,'qa/owner-follow-582/dist-qa584');
assert(hosting.headers[0].headers.some(x=>x.key==='Content-Security-Policy'));
const files=['index.html','qa/owner-follow-582/owner-browser-proof-584.mjs',
 'qa/owner-follow-582/owner-client.mjs',
 'cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs'];
for(const f of files)assert(existsSync(join(out,f)),f+' missing');
const html=readFileSync(join(out,'index.html'),'utf8');
const js=readFileSync(join(out,files[1]),'utf8');
const clientSource=readFileSync(join(out,files[2]),'utf8');
assert(html.includes('src="/qa/owner-follow-582/owner-browser-proof-584.mjs"'));
assert(!/['"]firebase\/(app|auth|database)['"]/.test(js+clientSource));
assert(js.includes('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'));
for(const s of [html,js,clientSource])assert(
 !/soridraw-app-866a5|91309780603|OWNER583_QA_CONFIG|SORIDRAW_QA_OWNER_FOLLOW_HMAC_578/.test(s));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length);
for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(id));
const existing=await import(pathToFileURL(join(dir,'owner-client.mjs')).href);
const uid='qaSyntheticOwnerA',epoch='a'.repeat(32);
const config={
 apiKey:'AIza'+'k'.repeat(36),appId:'1:1083981050742:web:abc123',
 projectId:'soridraw-app',authDomain:'soridraw-app.firebaseapp.com',
 messagingSenderId:'1083981050742',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'
};
assert.doesNotThrow(()=>existing.assertQaOwnerClient582(config,uid));
for(const bad of [
 {...config,projectId:'soridraw-app-866a5'},
 {...config,appId:'1:91309780603:web:abc123'},
 {...config,databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'},
 {...config,authDomain:'soridraw-app-866a5.firebaseapp.com'}
])assert.throws(()=>existing.assertQaOwnerClient582(bad,uid));
const listeners=[];let persistence=0;
function device(host='soridraw-qa-owner-584.web.app'){
 const elements=new Map(ids.map(id=>[id,{
 value:'',disabled:false,textContent:'',events:new Map(),
 addEventListener(type,fn){this.events.set(type,fn)}
 }]));
 const $=id=>elements.get(id);
 $('config').value=JSON.stringify(config);
 $('ownerUid').value=uid;
 $('password').value='mock-secret-not-real';
 const auth={currentUser:null};
 const app={name:'soridraw-isolated-owner-qa582'};
 const sdk={
  initializeApp:()=>app,getAuth:()=>auth,getDatabase:()=>({}),
  async signInWithEmailAndPassword(_auth,email,password){
   assert.equal(email,'testa@example.com');
   assert.equal(password,'mock-secret-not-real');
   auth.currentUser={uid};return {user:auth.currentUser};
  },
  getIdTokenResult:async()=>({claims:{soridrawFollowEpoch532:epoch}}),
  signOut:async()=>{auth.currentUser=null},
  ref:(_db,path)=>{assert.equal(path,'ownerFollowerSync532/'+uid);return path;},
  onValue:(_ref,cb,onError)=>{const rec={cb,onError,live:true};listeners.push(rec);return ()=>{rec.live=false}}
 };
 const imports={
  'firebase/app':{getApp:()=>app},
  'firebase/auth':{getAuth:()=>auth,getIdTokenResult:sdk.getIdTokenResult,
   inMemoryPersistence:'memory',setPersistence:async(_auth,value)=>{
    assert.equal(value,'memory');persistence++;
   }}
 };
 let code=readFileSync(join(dir,'owner-browser-proof-584.mjs'),'utf8');
 code=code.replace(
  /import \{createQaOwnerClient582,assertQaOwnerClient582\} from '\.\/owner-client\.mjs';/,
  'const {createQaOwnerClient582,assertQaOwnerClient582}=qaFixture;')
 .replaceAll("import('firebase/app')","fakeImport('firebase/app')")
 .replaceAll("import('firebase/auth')","fakeImport('firebase/auth')");
 const ctx={
  qaFixture:{createQaOwnerClient582:p=>existing.createQaOwnerClient582({...p,sdk}),
    assertQaOwnerClient582:existing.assertQaOwnerClient582},
  fakeImport:async name=>imports[name],document:{getElementById:$},
  location:{hostname:host,protocol:'https:'},Date,console,
  window:{addEventListener(){}},
  setTimeout:(_fn,ms)=>{assert.equal(ms,12000);return Symbol('fake-timer');},
  clearTimeout:()=>{}
 };
 runInNewContext(code,ctx,{timeout:3000});
 return {$,submit:()=>$('connectForm').events.get('submit')({preventDefault(){}}),
  arm:()=>$('arm').events.get('click')()};
}
const pc=device(),mobile=device();
await Promise.all([pc.submit(),mobile.submit()]);
assert.equal(persistence,2);
for(const d of [pc,mobile]){
 assert(d.$('state').textContent.includes('QA Auth 성공'));
 assert.equal(d.$('password').value,'');
}
const emit=(v,c)=>{
 const marker={ownerUid:uid,authEpoch:epoch,version:v,followerCount:c};
 for(const item of listeners)if(item.live)item.cb({val:()=>marker});
};
emit(2,0);
for(const d of [pc,mobile]){
 assert.equal(d.$('arm').disabled,false);
 assert(!d.$('proof').textContent.includes('PASS'));
 d.arm();
}
emit(3,1);
for(const d of [pc,mobile])assert.equal(d.$('proof').textContent,'1/2 단계');
emit(3,1);
for(const d of [pc,mobile])assert.equal(d.$('proof').textContent,'1/2 단계');
emit(4,0);
for(const d of [pc,mobile]){
 assert(d.$('proof').textContent.includes('PASS'));
 assert.equal(d.$('version').textContent,'4');
 assert.equal(d.$('count').textContent,'0');
}
// APP584 real-screen diagnostic regression: an invalid QA config must
// identify the exact stage without echoing credentials or account identifiers.
const invalidConfig=device();
invalidConfig.$('config').value=JSON.stringify({...config,authDomain:'wrong.invalid'});
await invalidConfig.submit();
assert(invalidConfig.$('detail').textContent.includes('CONFIG_IDENTITY'));
assert(invalidConfig.$('detail').textContent.includes('QA_PROJECT_OR_AUTH_DOMAIN_MISMATCH'));
assert(!invalidConfig.$('detail').textContent.includes('mock-secret-not-real'));
const missingPassword=device();
missingPassword.$('password').value='';
await missingPassword.submit();
assert(missingPassword.$('detail').textContent.includes('AUTH_SIGN_IN'));
assert(missingPassword.$('detail').textContent.includes('QA_PASSWORD_MISSING'));
const malformed=device();
malformed.$('config').value='{not-valid-json';
await malformed.submit();
assert(malformed.$('detail').textContent.includes('QA_JSON_SYNTAX'));
const outside=device('preview.soridraw.com');
assert.equal(outside.$('connect').disabled,true);
assert(!outside.$('connectForm').events.has('submit'));
const skipped=device();
await skipped.submit();
emit(5,0);skipped.arm();emit(7,0);
assert(skipped.$('proof').textContent.includes('FAIL'));
// App584 follow-up: silently swallowed Firebase onValue failures must now
// produce fixed privacy-safe receipt diagnostics, not UI idle forever.
const qaErrors=[];
const diagAuth={currentUser:{uid}};
let onError, onSnapshot;
const diagnosticSdk={
 initializeApp:()=>({}),getAuth:()=>diagAuth,getDatabase:()=>({}),
 getIdTokenResult:async(_principal,forceRefresh)=>{
  assert.notEqual(forceRefresh,true,'subscribeOwner must reuse the UI verified token');
  return {claims:{soridrawFollowEpoch532:epoch}};
 },
 ref:()=>({}),onValue:(_ref,update,fail)=>{
  onSnapshot=update;onError=fail;return ()=>{};
 }
};
const diagnosticClient=await existing.createQaOwnerClient582({
 config,ownerUid:uid,sdk:diagnosticSdk
});
await diagnosticClient.subscribeOwner(()=>{},code=>qaErrors.push(code));
onError({code:'PERMISSION_DENIED'});
onSnapshot({val:()=>null});
onSnapshot({val:()=>({ownerUid:uid,authEpoch:epoch,version:4,
 followerCount:-1})});
assert.deepEqual(qaErrors,[
 'QA_RTDB_PERMISSION_DENIED','QA_RTDB_MARKER_ABSENT',
 'QA_RTDB_MARKER_INVALID'
]);
assert(!JSON.stringify(qaErrors).includes(uid));
assert(!readFileSync(join(dir,'owner-client.mjs'),'utf8').includes(
 'getIdTokenResult(principal,true)'),'No duplicate forced refresh at subscribe');
console.log('APP584_QA_NO_DUPLICATE_TOKEN_REFRESH=PASS');
console.log('APP584_QA_RTDB_FAILURE_DIAGNOSTICS=PASS');
console.log('APP584_QA_DEPLOY_ARTIFACT_ISOLATION=PASS');
console.log('APP584_QA_OWNER_CONFIG_DENIALS=PASS');
console.log('APP584_TWO_MOCK_BROWSERS_FOLLOW_UNFOLLOW_ORDER=PASS');
console.log('APP584_QA_NO_SHARED_BACKEND_OR_WRITES=PASS');
console.log('APP584_REAL_BROWSER_AND_HOSTING_NOT_TESTED');
