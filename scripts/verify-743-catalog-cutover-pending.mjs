// Real cutover outbox + CAS + replay verification: NO network, no user data.
import assert from 'node:assert/strict';
import {persistCatalogCutoverPending,replayCatalogCutoverPending,catalogCutoverHoldEnabled,
  CUTOVER_PENDING_LIMIT,cutoverOutboxKey} from '../cloudflare/media-worker/src/catalogCutoverOutbox.js';
import {readFileSync} from 'node:fs';
class FakeR2 {
  objects=new Map(); writes=0; reads=0; forceFail=false; loseCasOnce=false;
  async get(key) {
    this.reads++;
    const found=this.objects.get(key);
    return found?{etag:found.etag,text:async()=>found.body}:null;
  }
  async put(key,body,options) {
    if(this.forceFail)throw new Error('R2_UNAVAILABLE');
    const existing=this.objects.get(key);
    if(this.loseCasOnce){this.loseCasOnce=false;return null;}
    if(options?.onlyIf?.etagDoesNotMatch==='*' && existing)return null;
    if(options?.onlyIf?.etagMatches && existing?.etag!==options.onlyIf.etagMatches)return null;
    const etag='etag-'+(++this.writes);
    this.objects.set(key,{body,etag});
    return {etag};
  }
  rows(uid,kind){return JSON.parse(this.objects.get(cutoverOutboxKey(uid,kind)).body).entries;}
}
const uid='test-owner',kind='library';
const delta=(mutationId,fields={})=>({kind,mutationId,baseRevision:100,revision:101,
  baseItemCount:1,nextItemCount:1,upserts:[{id:'song-1',createdAtMs:1,...fields}],deletedIds:[]});
const r2=new FakeR2();
assert.equal(catalogCutoverHoldEnabled({}),false);
assert.equal(catalogCutoverHoldEnabled({SORIDRAW_CATALOG_CUTOVER_HOLD_V1:'0'}),false);
assert.equal(catalogCutoverHoldEnabled({SORIDRAW_CATALOG_CUTOVER_HOLD_V1:'1'}),true);
const gray=delta('id-gray',{colorTags:{'0':null},favoriteColorTags:null});
const first=await persistCatalogCutoverPending(r2,uid,kind,gray);
assert.equal(first.held,true);
assert.equal(first.duplicate,false);
assert.equal(r2.rows(uid,kind)[0].delta.upserts[0].colorTags['0'],null);
assert.equal(r2.rows(uid,kind)[0].delta.upserts[0].favoriteColorTags,null);
const priorWrites=r2.writes;
assert.equal((await persistCatalogCutoverPending(r2,uid,kind,gray)).duplicate,true);
assert.equal(r2.writes,priorWrites,'no repeat put on retry');
await assert.rejects(persistCatalogCutoverPending(r2,uid,kind,delta('id-gray',{colorTags:{'0':'purple'}})),/MUTATION_ID_REUSED/);
r2.loseCasOnce=true;
assert.equal((await persistCatalogCutoverPending(r2,uid,kind,delta('id-two'))).held,true);
assert.equal(r2.rows(uid,kind).length,2,'R2 CAS retry may not erase previous mutation');
const snapshot=r2.rows(uid,kind).map(x=>x.mutationId);
r2.forceFail=true;
await assert.rejects(persistCatalogCutoverPending(r2,uid,kind,delta('fail-io')),/R2_UNAVAILABLE/);
r2.forceFail=false;
assert.deepEqual(r2.rows(uid,kind).map(x=>x.mutationId),snapshot,'failed write preserves queue');
const key=cutoverOutboxKey(uid,kind);
const kept=r2.objects.get(key);
r2.objects.set(key,{etag:'bad',body:'{bad'});
await assert.rejects(persistCatalogCutoverPending(r2,uid,kind,delta('third')),/OUTBOX_CORRUPT/);
r2.objects.set(key,kept);
const untrusted={bucket:r2,uid,kind,barrier:{},readReceipt:async()=>null,commit:async()=>{throw Error('must not commit');}};
await assert.rejects(replayCatalogCutoverPending(untrusted),/REPLAY_NOT_AUTHORIZED/);
assert.equal(r2.rows(uid,kind)[0].status,'pending');
const barrier={allWritersFenced:true,exactVersionsVerified:true,rollbackVersionsPinned:true,authorizedReplay:true};
let applyCalls=0;const durable=new Map();
const replayArgs={bucket:r2,uid,kind,barrier,
  readReceipt:async(d)=>durable.get(d.mutationId)||null,
  commit:async(d)=>{applyCalls++;durable.set(d.mutationId,{confirmed:true,mutationId:d.mutationId,revision:200+applyCalls});return {ok:true};}};
const replayed=await replayCatalogCutoverPending(replayArgs);
assert.equal(replayed.status,'RETAINED_RECEIPTS');
assert.equal(replayed.confirmed,2);
assert.equal(r2.rows(uid,kind).every(x=>x.status==='committed'),true);
const calls=applyCalls;
await replayCatalogCutoverPending(replayArgs);
assert.equal(applyCalls,calls,'never apply confirmed mutations twice');
const r3=new FakeR2();
await persistCatalogCutoverPending(r3,uid,kind,delta('conflict'));
let conflictCalls=0;
const conflict=await replayCatalogCutoverPending({...replayArgs,bucket:r3,
  readReceipt:async()=>null,commit:async()=>{conflictCalls++;return {ok:false,conflict:true};}});
assert.equal(conflict.status,'HOLD');
assert.equal(conflictCalls,1);
assert.equal(r3.rows(uid,kind)[0].status,'pending');
const r4=new FakeR2();
await persistCatalogCutoverPending(r4,uid,kind,delta('ack-lost'));
let hadCommitted=false;let count=0;
const uncertain=await replayCatalogCutoverPending({...replayArgs,bucket:r4,
  readReceipt:async()=>hadCommitted?{confirmed:true,mutationId:'ack-lost',revision:220}:null,
  commit:async()=>{count++;hadCommitted=true;return {ok:true};}});
assert.equal(uncertain.status,'RETAINED_RECEIPTS');
const before=count;
await replayCatalogCutoverPending({...replayArgs,bucket:r4,
  readReceipt:async()=>({confirmed:true,mutationId:'ack-lost',revision:220}),
  commit:async()=>{throw Error('duplicate forbidden');}});
assert.equal(count,before);
// Refuse unproven receipt after a claimed successful commit.
const r5=new FakeR2();
await persistCatalogCutoverPending(r5,uid,kind,delta('no-receipt'));
const noReceipt=await replayCatalogCutoverPending({...replayArgs,bucket:r5,
  readReceipt:async()=>null,commit:async()=>({ok:true})});
assert.equal(noReceipt.status,'HOLD');
assert.equal(r5.rows(uid,kind)[0].status,'pending');
// Capacity saturation is a retryable hold, never a silent overwrite.
const r6=new FakeR2();
for(let i=0;i<CUTOVER_PENDING_LIMIT;i++)await persistCatalogCutoverPending(r6,uid,kind,delta('cap-'+i));
await assert.rejects(persistCatalogCutoverPending(r6,uid,kind,delta('overflow')),/OUTBOX_FULL/);
assert.equal(r6.rows(uid,kind).length,CUTOVER_PENDING_LIMIT);
// Runtime integration is opt-in, with successful outbox persistence -> HTTP 503.
// No read-only GET/bootstrap should sneak in a canonical Catalog write during hold.
const worker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
assert.match(worker,/catalogCutoverHoldEnabled\(env\)[\s\S]*route\.action !== 'inspect-exact'/);
assert.match(worker,/await persistCatalogCutoverPending\(env\?\.CATALOG,identity\.uid,route\.kind,delta\);[\s\S]*code:'CATALOG_CUTOVER_PENDING_DURABLE'[\s\S]*503/);
assert.doesNotMatch(worker,/replayCatalogCutoverPending\(/);
console.log('CATALOG_CUTOVER_DURABLE_PENDING_CAS_IDEMPOTENCY_GRAY=PASS');
console.log('CATALOG_CUTOVER_FAIL_CLOSED_IO_CONFLICT_LIMIT_AND_RECEIPT=PASS');
console.log('CATALOG_CUTOVER_DEFAULT_OFF_503_NO_AUTO_REPLAY=PASS');
