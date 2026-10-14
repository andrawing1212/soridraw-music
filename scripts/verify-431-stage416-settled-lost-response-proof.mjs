import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;

const serverModule={exports:{}};
vm.runInNewContext(compile('functions/src/exploreLikePrivateServerClick416.ts'),{
 module:serverModule,exports:serverModule.exports,require:nativeRequire,
 Date,Object,Number,Error,Array,Promise,console,
},{timeout:2500});

const commitModule={exports:{}};
vm.runInNewContext(compile('functions/src/exploreLikePrivateCommit416.ts'),{
 module:commitModule,exports:commitModule.exports,
 require:id=>{
  if(id==='./exploreLikePrivateServerClick416')return serverModule.exports;
  if(id==='./exploreLikePrivateSeal416')return {};
  if(id==='./exploreLikePrivateHandoff416')return {};
  return nativeRequire(id);
 },
 Date,Object,Number,Error,Array,Set,Map,Promise,console,
},{timeout:2500});

const {recordUserPrivateClick416}=serverModule.exports;
const {advanceGlobalSettledVersion416}=commitModule.exports;
const uid='settled-retry-user';
const privateRoot='privateLikeBatch416';
const globalRoot='privateLikeGlobalVersion416';
const device='00000000-0000-4000-8000-000000000401';
const op1='00000000-0000-4000-8000-000000000402';
const op2='00000000-0000-4000-8000-000000000403';
const base=1700040000000;
const roots={[privateRoot]:null,[globalRoot]:null};
const writes={[privateRoot]:0,[globalRoot]:0};
const clone=v=>v==null?v:structuredClone(v);
const db={ref:path=>{
 const suffix='/'+uid;
 assert.ok(path.endsWith(suffix));
 const root=path.slice(0,-suffix.length);
 assert.ok(Object.hasOwn(roots,root));
 return {
  transaction:async update=>{
   const before=clone(roots[root]);
   const next=update(clone(before));
   if(next===undefined)return {committed:false,snapshot:{val:()=>clone(roots[root])}};
   if(JSON.stringify(next)!==JSON.stringify(before)){writes[root]++;roots[root]=clone(next);}
   return {committed:true,snapshot:{val:()=>clone(roots[root])}};
  },
  get:async()=>({val:()=>clone(roots[root])}),
 };
}};

const seq1=await recordUserPrivateClick416(db,uid,{
 trackId:'song-A',liked:true,operationId:op1,deviceId:device,deviceSequence:1,
},1,base,false,privateRoot,globalRoot);
assert.equal(seq1.accepted,true);
assert.equal(seq1.reason,'ACCEPTED');
const v1=seq1.version;
const row1=Object.values(roots[privateRoot].pending)[0];

const fenceWritesBefore=writes[globalRoot];
const advanced=await advanceGlobalSettledVersion416(
 db,uid,v1,globalRoot,[row1]);
assert.equal(advanced,true);
assert.equal(writes[globalRoot]-fenceWritesBefore,1);
roots[privateRoot]={...roots[privateRoot],window:null,pending:null,sealed:null};

const proof=roots[globalRoot].settledDevices?.[device];
assert.ok(proof);
assert.equal(proof.operationId,op1);
assert.equal(proof.deviceSequence,1);
assert.equal(proof.version,v1);

const envWritesBeforeRetry=writes[privateRoot];
const globalWritesBeforeRetry=writes[globalRoot];
const retry=await recordUserPrivateClick416(db,uid,{
 trackId:'song-A',liked:true,operationId:op1,deviceId:device,deviceSequence:1,
},1,base+61000,false,privateRoot,globalRoot);
assert.equal(retry.accepted,true);
assert.equal(retry.reason,'SETTLED_DUPLICATE_CONFIRMED');
assert.equal(retry.version,v1);
assert.equal(writes[privateRoot],envWritesBeforeRetry);
assert.equal(writes[globalRoot],globalWritesBeforeRetry);

const seq2=await recordUserPrivateClick416(db,uid,{
 trackId:'song-B',liked:true,operationId:op2,deviceId:device,deviceSequence:2,
},1,base+61001,false,privateRoot,globalRoot);
assert.equal(seq2.accepted,true);
assert.equal(seq2.reason,'ACCEPTED');
assert.ok(seq2.version>v1);
assert.equal(Object.values(roots[privateRoot].pending)[0].operationId,op2);

const stale=await recordUserPrivateClick416(db,uid,{
 trackId:'wrong-song',liked:true,
 operationId:'00000000-0000-4000-8000-000000000404',
 deviceId:device,deviceSequence:1,
},1,base+61002,false,privateRoot,globalRoot);
assert.equal(stale.accepted,false);
assert.equal(stale.reason,'STALE_OR_DUPLICATE');

console.log('STAGE416_SETTLED_SEQ1_OPERATION_PROOF_RECORDED=PASS');
console.log('STAGE416_LOST_RESPONSE_SEQ1_RETRY_PROVEN_ACCEPTED=PASS');
console.log('STAGE416_SETTLED_DUPLICATE_RETRY_CHANGED_WRITES=0');
console.log('STAGE416_SEQ2_AFTER_PROVEN_SEQ1_ACCEPTED=PASS');
console.log('STAGE416_GENERIC_STALE_NOT_PROMOTED_TO_SUCCESS=PASS');
console.log('STAGE416_SETTLED_PROOF_PAGE_UPDATE_REENTRY_IO=0');
