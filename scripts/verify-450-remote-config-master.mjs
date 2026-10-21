import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const src=readFileSync('functions/src/masterSplitFrameMode450.ts','utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let published={etag:'1',parameters:{soridraw_preview_version_signal_v1:{defaultValue:{value:'{"genres":5}'}}},conditions:[]};
let attempts=0,success=0,readProfiles=0;
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const clone=x=>JSON.parse(JSON.stringify(x));
const admin={
  firestore:()=>({collection:name=>({doc:uid=>({get:async()=>{readProfiles++;return{data:()=>({staffRole:uid.startsWith('master')?'master':'admin'})};}})})}),
  remoteConfig:()=>({
    getTemplate:async()=>clone(published),
    publishTemplate:async t=>{
      attempts++;
      await Promise.resolve();
      if(t.etag!==published.etag)throw new Error('ETag conflict');
      if(!t.parameters.soridraw_preview_version_signal_v1)throw Error('unrelated parameter dropped');
      published={...clone(t),etag:String(Number(published.etag)+1)};
      success++;
      return clone(published);
    },
  }),
  database:()=>{throw Error('SHARED_RTDB_NEVER_CALLED');},
};
const exported={};
vm.runInNewContext(compiled,{exports:exported,require:k=>{
  if(k==='firebase-admin')return admin;
  if(k==='firebase-functions/v2/https')return{HttpsError,onCall:(_opts,handler)=>handler};
  throw Error('Unexpected import '+k);
},process:{env:{} }});
const fn=exported.masterSetSplitFrameMode;
const req=(uid,mode,rev=0,env='preview',origin='https://preview.soridraw.com')=>
  ({auth:uid?{uid}:null,rawRequest:{headers:{origin}},data:{environment:env,mode,expectedRevision:rev}});
await assert.rejects(fn(req(null,'pure-pane')),e=>e.code==='unauthenticated');
await assert.rejects(fn(req('admin','pure-pane')),e=>e.code==='permission-denied');
await assert.rejects(fn(req('master1','pure-pane',0,'production','https://soridraw.com')),e=>e.code==='failed-precondition');
const readReq=(uid,env='preview',origin='https://preview.soridraw.com')=>({
 auth:uid?{uid}:null,rawRequest:{headers:{origin}},data:{environment:env,action:'read'}
});
await assert.rejects(fn(readReq(null)),e=>e.code==='unauthenticated');
await assert.rejects(fn(readReq('admin')),e=>e.code==='permission-denied');
const initial=await fn(readReq('master1'));
assert.equal(initial.mode,'pure-pane-hybrid');
assert.equal(initial.revision,0);
assert.equal(attempts,0,'read must never publish config');

assert.equal(attempts,0);
const a=fn(req('master1','pure-pane'));
const b=fn(req('master2','local-responsive'));
const results=await Promise.allSettled([a,b]);
assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='aborted').length,1);
assert.equal(success,1);
assert.equal(published.parameters.soridraw_preview_version_signal_v1.defaultValue.value,'{"genres":5}');
const record=JSON.parse(published.parameters.soridraw_split_frame_preview_v1.defaultValue.value);
assert.equal(record.revision,1);
const persistedRead=await fn(readReq('master1'));
assert.equal(persistedRead.mode,record.mode,'route reentry must show server saved mode');
assert.equal(persistedRead.revision,1,'route reentry must show server saved revision');
assert.equal(success,1,'Master read must not publish or write any data');
await assert.rejects(fn(req('master1','pure-pane-hybrid',0)),e=>e.code==='aborted');
const newer=await fn(req('master1','pure-pane-hybrid',1));
assert.equal(newer.revision,2);
const next=await fn(req('master2','pure-pane',2));
assert.equal(next.revision,3);
const lastRead=await fn(readReq('master1'));
assert.equal(lastRead.mode,'pure-pane');
assert.equal(lastRead.revision,3,'server version remains stable across repeated Master page visits');
await assert.rejects(fn(req('master1','local-responsive',1)),e=>e.code==='aborted',
  'ABA changes must NOT reauthorize stale revision after modes cycle');
assert.ok(readProfiles>=5);
assert.doesNotMatch(src,/force\s*:\s*true|\.database\(\)|\.set\(/);
console.log('450_REMOTE_CONFIG_MASTER_AUTH_AND_ORIGIN=PASS');
console.log('450_REMOTE_CONFIG_ETAG_RACE_AND_REVISION_ABA=PASS');
console.log('450_MASTER_REENTRY_READS_AUTHORITATIVE_SAVED_MODE_NO_WRITE=PASS');
console.log('450_SHARED_RTDB_RULES_WRITE_0_AND_UNRELATED_REMOTE_PARAMS_PRESERVED=PASS');
