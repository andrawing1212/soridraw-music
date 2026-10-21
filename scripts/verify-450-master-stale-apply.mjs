import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const path='functions/src/masterSplitFrameMode450.ts';
const src=readFileSync(path,'utf8');
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let current=null, commits=0, transactions=0, roleReads=0;
const errors=[];
class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
const admin = {
  firestore:()=>({collection:name=>{assert.equal(name,'users');return{doc:uid=>({
    get:async()=>{roleReads++;return{data:()=>({staffRole:uid.startsWith('master')?'master':'admin'})};}
  })};}}),
  database:()=>({ref:path=>{assert.equal(path,'publicSync/splitFrameModes/preview');return{
    transaction:async(mutator,callback,applyLocally)=>{
      assert.equal(callback,undefined);assert.equal(applyLocally,false);
      transactions++;
      const proposed=mutator(current);
      if(proposed===undefined)return{committed:false};
      current=proposed;commits++;return{committed:true};
    },
  };}}),
};
const exports={};
vm.runInNewContext(code,{
  exports,require:name=>{
    if(name==='firebase-admin')return admin;
    if(name==='firebase-functions/v2/https')return{HttpsError,onCall:(_opts,fn)=>fn};
    throw Error('unrelated import '+name);
  },
  process:{env:{SORIDRAW_SPLIT_FRAME_ENABLED_ENVIRONMENTS:'preview,test,production'}},
},{filename:path});
const fn=exports.masterSetSplitFrameMode;
assert.equal(typeof fn,'function');
const req=(uid,mode,expectedMode,environment='preview',origin='https://preview.soridraw.com')=>({
 auth:uid?{uid}:null,rawRequest:{headers:{origin}},data:{mode,expectedMode,environment}
});
await assert.rejects(fn(req(null,'pure-pane','pure-pane-hybrid')),e=>e.code==='unauthenticated');
assert.equal(roleReads,0);
await assert.rejects(fn(req('admin','pure-pane','pure-pane-hybrid')),e=>e.code==='permission-denied');
await assert.rejects(fn(req('masterA','pure-pane','bogus')),e=>e.code==='invalid-argument');
await assert.rejects(fn(req('masterA','pure-pane',null)),e=>e.code==='invalid-argument');
await assert.rejects(fn(req('masterA','pure-pane','pure-pane-hybrid','test','https://test.soridraw.com')),
 e=>e.code==='failed-precondition');
await assert.rejects(fn(req('masterA','pure-pane','pure-pane-hybrid','production','https://soridraw.com')),
 e=>e.code==='failed-precondition');
assert.equal(transactions,0);
const a=fn(req('masterA','pure-pane','pure-pane-hybrid'));
const b=fn(req('masterB','local-responsive','pure-pane-hybrid'));
const outcomes=await Promise.allSettled([a,b]);
assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1,'same old mode cannot win twice');
assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason.code==='aborted').length,1);
assert.equal(commits,1);
assert.ok(['pure-pane','local-responsive'].includes(current));
const freshMode=current==='pure-pane'?'local-responsive':'pure-pane';
const final=await fn(req('masterA',freshMode,current));
assert.equal(final.ok,true);
assert.equal(current,freshMode);
assert.equal(commits,2);
assert.equal(transactions,3);
assert.doesNotMatch(src,/\.set\(/,'Master callable cannot use unconditional mode writes');
console.log('450_MASTER_GUEST_ADMIN_ENVIRONMENT_WRITE_DENIAL_MOCK=PASS');
console.log('450_CONCURRENT_MASTERS_STALE_EXPECTED_MODE_ABORTS_ATOMIC_TRANSACTION_MOCK=PASS');
console.log('450_ONLY_ONE_RTDB_SCALAR_TRANSACTION_PER_AUTHORIZED_APPLY=PASS');
