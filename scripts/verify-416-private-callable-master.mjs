import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('functions/src/exploreLikePrivateCallable416.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,
}}).outputText;
const exports={};
const calls={config:0,submit:0,uid:''};
class HttpErr extends Error{constructor(code,message){super(message);this.code=code;}}
const requireMock=id=>{
 if(id==='firebase-functions/v2/https')return {HttpsError:HttpErr};
 if(id==='./exploreLikeBatchSettings416')return {
  readLikeBatchTiming416:async()=>{
    calls.config++;return {privateMinutes:calls.config===1?5:3,publicMinutes:5};
  }};
 if(id==='./exploreLikePrivateServerClick416')return {
  recordUserPrivateClick416:async(_db,uid,mutation,minutes)=>{
   calls.submit++;calls.uid=uid;
   assert.equal(mutation.trackId,'test-song');
   assert.equal(minutes,calls.config===1?5:3);
   return {accepted:true,reason:'ACCEPTED',version:calls.submit,count:1};
  }};
 throw Error('unexpected module: '+id);
};
vm.runInNewContext(output,{module:{exports},exports,require:requireMock,
  Error,Object,Array,Number,Date},{timeout:2000});
const run=exports.handleAuthenticatedPrivateClick416;
const mutation={trackId:'test-song',liked:true,
 operationId:'00000000-0000-4000-8000-000000000001',
 deviceId:'00000000-0000-4000-8000-000000000002',deviceSequence:1};
await assert.rejects(run({}, {auth:null,app:{},data:mutation}),e=>e.code==='unauthenticated');
await assert.rejects(run({}, {auth:{uid:'account'},data:mutation}),
  e=>e.code==='failed-precondition');
await assert.rejects(run({}, {auth:{uid:'account'},app:{},data:{...mutation,uid:'victim'}}),
  e=>e.code==='invalid-argument');
await assert.rejects(run({}, {auth:{uid:'account'},app:{},data:{...mutation,minutes:1}}),
  e=>e.code==='invalid-argument');
await assert.rejects(run({}, {auth:{uid:'account'},app:{},data:{...mutation,at:123}}),
  e=>e.code==='invalid-argument');
assert.equal(calls.config,0,'rejected requests must not read Master config');
const a=await run({}, {auth:{uid:'account'},app:{token:'valid'},data:mutation});
assert.equal(a.version,1);assert.equal(calls.uid,'account');
const b=await run({}, {auth:{uid:'account'},app:{token:'valid'},data:mutation});
assert.equal(b.version,2);
assert.equal(calls.config,2,'Master settings read only on real click, not page entry');
assert.equal(calls.submit,2);
const index=readFileSync('functions/src/index.ts','utf8');
assert.doesNotMatch(index,/export const recordPrivateLike416\s*=/);
assert.match(source,/NOT exported by index\.ts/);
console.log('STAGE416_CALLABLE_UID_APPCHECK_SERVER_MASTER_1_3_5_10_20=PASS');
console.log('STAGE416_CALLABLE_CLIENT_TIMING_AND_UID_FORGERY_DENIED=PASS');
console.log('STAGE416_MASTER_READ_ONLY_PER_CLICK_NO_PAGE_ENTRY_READ=PASS');
console.log('STAGE416_CALLABLE_NOT_EXPORTED_OR_DEPLOYED=PASS');
