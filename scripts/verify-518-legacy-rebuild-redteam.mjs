// Inactive policy/red-team tests — no real Worker import, R2, Firebase or data.
import assert from 'node:assert/strict';
import {
  classifyCatalogAuthority518,decideCatalogWriterAuthority518,
  requiresFinalFencedCas518
} from '../cloudflare/media-worker/src/catalogAuthorityPolicy518.js';
const head={kind:'musicNote',headRevision:250,sourceLedger518:{
 'track-deleted':{uid:'owner',documentId:'track-deleted',durable:true,
   state:'removed',sourceVersionNs:'1793152800000000000'}},canonicalAuthority518:true};
const gate=(operation,h=head,extra={})=>decideCatalogWriterAuthority518({
 kind:'musicNote',head:h,operation,...extra
});
assert.equal(classifyCatalogAuthority518(head,'musicNote').code,'CANONICAL_FENCED');
for (const operation of ['legacy-delta','bootstrap','seed-legacy','rebuild']) {
 const decision=gate(operation);
 assert.ok(decision.code.startsWith('DENY_'),operation+' must never erase/override tombstones');
 assert.equal(requiresFinalFencedCas518(decision),false);
}
assert.equal(gate('canonical-delta',head,{hasServerVerifiedExactCanonical:true,
 baseRevision:249,expectedHeadRevision:249}).code,'DENY_STALE_HEAD');
assert.equal(gate('canonical-delta',head,{hasServerVerifiedExactCanonical:false,
 baseRevision:250,expectedHeadRevision:250}).code,'DENY_UNVERIFIED_WRITER');
const ok=gate('canonical-delta',head,{hasServerVerifiedExactCanonical:true,
 baseRevision:250,expectedHeadRevision:250});
assert.equal(ok.code,'CANONICAL_CAS_ONLY');
assert.equal(requiresFinalFencedCas518(ok),true);
assert.equal(gate('legacy-delta',{...head,sourceLedger518:undefined}).code,'DENY_DAMAGED_LEDGER');
assert.equal(gate('legacy-delta',{...head,canonicalAuthority518:false}).code,'DENY_PARTIAL_MIGRATION');
assert.equal(gate('rebuild',{...head,sourceLedger518:undefined}).code,'DENY_DAMAGED_LEDGER');
const unprotected={kind:'musicNote',headRevision:250};
assert.equal(gate('legacy-delta',unprotected).code,'LEGACY_ALLOWED_WHILE_NOT_MIGRATED');
assert.equal(gate('bootstrap',unprotected).code,'LEGACY_ALLOWED_WHILE_NOT_MIGRATED');
assert.equal(gate('legacy-delta',{...head,kind:'library'}).code,'DENY_UNKNOWN_HEAD');
console.log('APP518_ALL_FENCED_LEGACY_DELTA_DENIED=PASS');
console.log('APP518_SEED_REBUILD_TOMBSTONE_ERASURE_DENIED=PASS');
console.log('APP518_CAS_SOURCE_AND_HEAD_REVISION_REQUIRED=PASS');
console.log('APP518_UNMIGRATED_EXISTING_CATALOG_UNMODIFIED=PASS');
console.log('APP518_INACTIVE_POLICY_NETWORK_IO=ZERO');


// Execute the actual Worker bootstrap function against an interleaved HEAD.
// No real user records, network, cloud bindings or deploy.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createEmptyCatalogJournal,createCompactedCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
const worker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
const start=worker.indexOf('const bootstrapSharedCatalogFromCanonical = async');
const end=worker.indexOf('const getOrBuildCatalog = async',start);
assert.ok(start>=0&&end>start);
const actualBootstrap=worker.slice(start,end);
const legacyHead=createEmptyCatalogJournal({kind:'musicNote',baseKey:'old-base.json',baseRevision:10,itemCount:1,now:10});
const protectedHead={...createEmptyCatalogJournal({kind:'musicNote',baseKey:'winning-base.json',baseRevision:20,itemCount:0,now:20}),canonicalAuthority518:true};
const canonical={kind:'musicNote',revision:30,itemCount:1,items:[{id:'old-song'}]};
for(const mode of ['normal','fence-during-scan','legacy-during-scan','fence-during-put','corrupt-head','missing-head']){
 let head=mode==='missing-head'?null:legacyHead;
 let etag=head?'E1':null;
 const baseWrites=[],headWrites=[];
 const record=()=>head?{payload:head,object:{etag}}:null;
 const state=()=>head?{head,journalObject:{etag}}:null;
 const env={CATALOG:{}};
 const context={
  isSharedCatalogEnabled:()=>true,isCanonicalCatalogAuthority518:()=>false,
  classifyCatalogAuthority518,readStrictCatalogStateForInspection:async()=>state(),
  readCatalogStateFromBucket:async()=>state(),
  buildCanonicalCatalog:async()=>{
   if(mode==='fence-during-scan'){head=protectedHead;etag='E2'}
   if(mode==='legacy-during-scan'){head={...legacyHead,headRevision:20};etag='E2'}
   return canonical;
  },
  readStrictCatalogObjectForInspection:async()=>{
   if(mode==='corrupt-head')throw Error('CATALOG_INSPECT_READ_INVALID');
   return record();
  },
  readCatalogJournalObjectFromBucket:async()=>record(),
  catalogJournalKey:()=> 'journal.json',
  catalogCompactedBaseKey:()=> 'bases/30.json',
  crypto:{randomUUID:()=> 'synthetic-unique-key'},
  putCatalogObjectAtKey:async(_env,key,uid,body,condition)=>{
   baseWrites.push({key,uid,condition});
   if(mode==='fence-during-put'){head=protectedHead;etag='E2'}
   return {etag:'base-new'};
  },
  createEmptyCatalogJournal,
  putCatalogJournalHead:async(_env,uid,kind,value,object)=>{
   headWrites.push({uid,kind,value,expected:object?.etag||null});
   if((object?.etag||null)!==etag)return null;
   head=value;etag='E3';return {etag};
  },
  materializeCatalogState:x=>x,
 };
 const run=vm.runInNewContext(actualBootstrap+'\nbootstrapSharedCatalogFromCanonical',context);
 const result=run({uid:'owner'},'musicNote',30,env);
 if(mode==='normal'||mode==='missing-head'){
  assert.equal(await result,canonical);
  assert.equal(baseWrites.length,1);
  assert.equal(baseWrites[0].key,'bases/30-bootstrap-synthetic-unique-key.json');
  assert.equal(baseWrites[0].condition.etagDoesNotMatch,'*');
  assert.equal(headWrites[0].expected,mode==='normal'?'E1':null);
  assert.equal(head.baseKey,baseWrites[0].key);
 }else{
  await assert.rejects(result,/CATALOG_(518_FENCED_REBUILD_DENIED|BOOTSTRAP_CONFLICT|INSPECT_READ_INVALID)/);
  if(mode==='fence-during-put'){
   assert.equal(baseWrites.length,1);
   assert.equal(headWrites.length,1);
   assert.equal(headWrites[0].expected,'E1');
   assert.equal(baseWrites[0].key==='winning-base.json',false);
   assert.equal(head,protectedHead);
  }else{
   assert.equal(baseWrites.length,0);
   assert.equal(headWrites.length,0);
   if(mode==='fence-during-scan')assert.equal(head,protectedHead);
  }
 }
}
console.log('APP518_ACTUAL_BOOTSTRAP_NO_STALE_REBASE_OR_PROTECTED_BASE_OVERWRITE=PASS');


// Exercise real legacy seed/compaction functions with a simulated late writer.
const seedStart=worker.indexOf('const seedSharedCatalogFromCurrentLegacy = async');
const seedEnd=worker.indexOf('const getCatalogState = async',seedStart);
const compactStart=worker.indexOf('const compactCatalogJournal = async');
const compactEnd=worker.indexOf('const applyCatalogDelta = async',compactStart);
assert.ok(seedStart>=0&&seedEnd>seedStart&&compactStart>=0&&compactEnd>compactStart);
const seedSource=worker.slice(seedStart,seedEnd);
const compactSource=worker.slice(compactStart,compactEnd);
for(const mode of ['seed-race','compact-race','compact-fenced','seed-normal','seed-create-conflict','seed-corrupt','compact-normal','compact-flag','compact-create-conflict','compact-missing-etag','library-seed','library-compact']){
 const kind=mode.startsWith('library')?'library':'musicNote';
 const seeding=mode.startsWith('seed')||mode==='library-seed';
 const stale={kind,revision:30,itemCount:1,items:[{id:'deleted-song'}]};
 const winning={kind,revision:30,itemCount:0,items:[]};
 const oldHead={...createEmptyCatalogJournal({kind,baseKey:'old.json',baseRevision:10,itemCount:1}),headRevision:30,deltas:[{}]};
 const winner={...createEmptyCatalogJournal({kind,baseKey:'bases/30.json',baseRevision:30,itemCount:0}),canonicalAuthority518:true,sourceLedger518:{}};
 let head=seeding?null:mode==='compact-fenced'?{...winner,deltas:[{}]}:oldHead;
 let etag=seeding||mode==='compact-missing-etag'?null:'E1';
 let headWrites=0,baseReads=0,baseWrites=0;
 const objects=new Map([['bases/30.json',winning],['old.json',stale]]);
 const winnerState=()=>head?{head,base:objects.get(head.baseKey),journalObject:{etag}}:null;
 const win=()=>{head=winner;etag='E2'};
 const shared={},media={};
 const state=async bucket=>{
  if(bucket===shared)return winnerState();
  if(mode==='seed-race')win();
  return {base:stale,head:oldHead,journalObject:{etag:'legacy'}};
 };
 const ctx={
  isSharedCatalogEnabled:()=>true,isCanonicalCatalogAuthority518:()=>mode==='compact-flag',
  readCatalogStateFromBucket:state,
  readStrictCatalogStateForInspection:async()=>{if(mode==='seed-corrupt')throw Error('CATALOG_INSPECT_READ_INVALID');return winnerState()},
  materializeCatalogState:()=>stale,classifyCatalogAuthority518,
  readCatalogJournalObject:async()=>({payload:head,object:{etag}}),
  readCatalogObjectAtKey:async()=>{baseReads++;return stale},
  catalogCompactedBaseKey:()=> 'bases/30.json',
  crypto:{randomUUID:()=> 'synthetic-unique-key'},
  putCatalogObjectAtKey:async(_env,key,_uid,payload,onlyIf)=>{
   baseWrites++;
   if(mode==='compact-race')win();
   if(mode.endsWith('create-conflict'))return null;
   if(onlyIf?.etagDoesNotMatch==='*'&&objects.has(key))return null;
   objects.set(key,payload);return {etag:'new-base'};
  },
  putCatalogJournalHead:async(_env,_uid,_kind,value,previous)=>{
   headWrites++;
   if((previous?.etag||null)!==etag)return null;
   head=value;etag='E3';return {etag};
  },
  createEmptyCatalogJournal,
  createCompactedCatalogJournal,
 };
 const fn=vm.runInNewContext((seeding?seedSource:compactSource)+'\n'+(seeding?'seedSharedCatalogFromCurrentLegacy':'compactCatalogJournal'),ctx);
 const env={CATALOG:shared,MEDIA:media};
 const pending=seeding?fn({uid:'owner'},kind,30,env):fn(env,'owner',kind);
 if(mode==='seed-corrupt'){
  await assert.rejects(pending,/CATALOG_INSPECT_READ_INVALID/);
  assert.equal(baseWrites,0);assert.equal(headWrites,0);continue;
 }
 const result=await pending;
 if(['compact-fenced','compact-flag','compact-missing-etag'].includes(mode)){
  assert.equal(result,false);assert.equal(baseReads,0);assert.equal(baseWrites,0);assert.equal(headWrites,0);
 }else if(mode.endsWith('create-conflict')){
  assert.equal(headWrites,0);
 }else if(mode.endsWith('race')){
  assert.equal(head,winner);
  assert.equal(objects.get('bases/30.json'),winning,mode+' replaced the winning base');
  assert.equal(headWrites,1);
 }else{
  assert.equal(baseWrites,1);assert.equal(headWrites,1);
  assert.equal(head.baseKey,kind==='library'?'bases/30.json':seeding?'bases/30-seed-synthetic-unique-key.json':'bases/30-compact-synthetic-unique-key.json');
 }
}
console.log('APP518_ACTUAL_LEGACY_SEED_COMPACTION_RACE_AND_FENCED_OWNER_PROTECTION=PASS');
