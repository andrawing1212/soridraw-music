import assert from 'node:assert/strict';
import {inspectApp748QaVersion}
 from './app748-qa-version-guard.mjs';
const token='read_only_test_token_test123',id='b'.repeat(8)+'-aaaa-bbbb-cccc-'+'d'.repeat(12);
const old='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const tag='app748-qa503-'+'a'.repeat(12)+'-44740123456-1';
const arr=[
 {name:'OWNER558_DO',type:'durable_object_namespace'},
 {name:'OWNER583_QA_CONFIG',type:'secret_text'},
 {name:'SORIDRAW_ENVIRONMENT',type:'plain_text'},
 {name:'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',type:'plain_text'},
 {name:'SORIDRAW_QA747_INJECT503',type:'plain_text'},
];
let active=old,broken=false,extra=false;
const send=async(url,opt)=>{
 assert.equal(opt.method,'GET');
 assert(url.includes('/workers/'));
 const body=url.includes('/deployments')?
 {deployments:[{versions:[{version_id:active,percentage:100}]}]}:
 url.includes('/versions?')?
 {items:[{id,annotations:{'workers/tag':tag}}]}:
 {id,bindings:extra?[...arr,{name:'DB',type:'d1'}]:broken?arr.slice(0,4):arr};
 return new Response(JSON.stringify({success:true,result:body}),{
  status:200,headers:{'Content-Type':'application/json'}});
};
const params={token,tag,versionId:id,send,mode:'stage'};
const a=await inspectApp748QaVersion(params);
assert.equal(a.status,'PASS');
assert.equal(a.candidateBindingCount,5);
active=id;
const b=await inspectApp748QaVersion({...params,mode:'active'});
assert.equal(b.qaTrafficVersion,id);
await assert.rejects(()=>inspectApp748QaVersion(params),/ORIGINAL_NOT_100/);
active=old;broken=true;
await assert.rejects(()=>inspectApp748QaVersion(params),/NEW_QA_BINDING_COUNT/);
broken=false;extra=true;
await assert.rejects(()=>inspectApp748QaVersion(params),/NEW_QA_BINDING_COUNT/);
extra=false;
await assert.rejects(()=>inspectApp748QaVersion({...params,tag:'bad'}),/TAG_UNPINNED/);
await assert.rejects(()=>inspectApp748QaVersion({...params,versionId:old}),
 /UPLOAD_VERSION_ID_NOT_PINNED/);
await assert.rejects(()=>inspectApp748QaVersion({...params,versionId:null}),
 /UPLOAD_VERSION_ID_NOT_PINNED/);
console.log('APP748_QA_VERSION_FENCE_MOCK=PASS; REAL_QA=NOT_RUN');
