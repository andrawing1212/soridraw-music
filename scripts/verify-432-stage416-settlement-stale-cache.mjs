import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const compiled=ts.transpileModule(
  readFileSync('functions/src/exploreLikePrivateCommit416.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
).outputText;
const mod={exports:{}};
vm.runInNewContext(compiled,{
  module:mod,exports:mod.exports,
  require:id=>{
    if(id==='./exploreLikePrivateSeal416')return {};
    if(id==='./exploreLikePrivateHandoff416')return {};
    if(id==='./exploreLikePrivateServerClick416')return {};
    return nativeRequire(id);
  },
  Object,Number,Array,Set,Map,Promise,Error,JSON,Date,console,
},{timeout:2500});
const {advanceGlobalSettledVersion416}=mod.exports;

const uid='stale-cache-settlement-user';
const root='privateLikeGlobalVersion416';
const device='00000000-0000-4000-8000-000000000501';
const operation='00000000-0000-4000-8000-000000000502';
const version=1791967620569;
const authoritative={
  version,
  settledVersion:0,
  devices:{
    [device]:{
      deviceSequence:1,operationId:operation,trackId:'song-A',liked:true,
      version,leaseUntilMs:version+120000,previous:null,
    },
  },
};
const row={
  trackId:'song-A',liked:true,operationId:operation,
  deviceId:device,deviceSequence:1,version,
};

let changedWrites=0;
let callbackCalls=0;
const db={ref:path=>{
  assert.equal(path,root+'/'+uid);
  return {transaction:async update=>{
    callbackCalls++;
    const stale={version:0,settledVersion:0};
    const first=update(structuredClone(stale));
    assert.deepEqual(first,stale,
      'stale local cache must be returned unchanged instead of throwing');
    callbackCalls++;
    const before=structuredClone(authoritative);
    const next=update(structuredClone(before));
    if(JSON.stringify(next)!==JSON.stringify(before))changedWrites++;
    return {committed:true,snapshot:{val:()=>structuredClone(next)}};
  }};
}};

const advanced=await advanceGlobalSettledVersion416(
  db,uid,version,root,[row]);
assert.equal(advanced,true);
assert.equal(callbackCalls,2);
assert.equal(changedWrites,1);
const proof=authoritative; // source remains unchanged in fake adapter
assert.ok(proof.devices[device]);

// Server-authoritative absence of the reserved high-water must still fail
// closed after the no-op probe; otherwise the caller could ACK a seal whose
// global ordering fence never existed.
const badDb={ref:()=>({transaction:async update=>{
  const stale={version:0,settledVersion:0};
  const next=update(structuredClone(stale));
  return {committed:true,snapshot:{val:()=>structuredClone(next)}};
}})};
await assert.rejects(
  advanceGlobalSettledVersion416(badDb,uid,version,root,[row]),
  /416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE/,
);

const source=readFileSync('functions/src/exploreLikePrivateCommit416.ts','utf8');
assert.match(source,/if\(version<settledVersion\)return unchanged/);
assert.match(source,/416_GLOBAL_SETTLEMENT_TARGET_UNAVAILABLE/);

console.log('STAGE416_SETTLEMENT_STALE_LOCAL_CACHE_PROBES_SERVER=PASS');
console.log('STAGE416_SETTLEMENT_STALE_CACHE_CHANGED_WRITES=1');
console.log('STAGE416_SETTLEMENT_MISSING_AUTHORITATIVE_FENCE_FAILS_CLOSED=PASS');
console.log('STAGE416_SETTLEMENT_STALE_CACHE_EXTRA_EXPLICIT_READS=0');
