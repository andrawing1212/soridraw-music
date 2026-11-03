// Real cutover outbox + CAS + replay verification: NO network, no user data.
import assert from 'node:assert/strict';
import {persistCatalogCutoverPending,replayCatalogCutoverPending,catalogCutoverHoldEnabled,
  CUTOVER_PENDING_LIMIT,cutoverOutboxKey} from '../cloudflare/media-worker/src/catalogCutoverOutbox.js';
import {readFileSync} from 'node:fs';
import {appendCatalogJournalDelta,createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
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
await assert.rejects(persistCatalogCutoverPending(r2,uid,kind,{...delta('fail-io'),upserts:[{id:'failure-test',createdAtMs:1}]}),/R2_UNAVAILABLE/);
r2.forceFail=false;
assert.deepEqual(r2.rows(uid,kind).map(x=>x.mutationId),snapshot,'failed write preserves queue');
const key=cutoverOutboxKey(uid,kind);
const kept=r2.objects.get(key);
r2.objects.set(key,{etag:'bad',body:'{bad'});
await assert.rejects(persistCatalogCutoverPending(r2,uid,kind,delta('third')),/OUTBOX_CORRUPT/);
r2.objects.set(key,kept);
const untrusted={bucket:r2,uid,kind,barrier:{},readReceipt:async()=>null,
  readJournalHead:async()=>null,commit:async()=>{throw Error('must never commit');}};
await assert.rejects(replayCatalogCutoverPending(untrusted),/REPLAY_NOT_AUTHORIZED/);
const barrier={allWritersFenced:true,exactVersionsVerified:true,rollbackVersionsPinned:true,
  authorizedReplay:true,exclusiveReplayLeaseVerified:true,allPendingDiscoverableVerified:true};
await assert.rejects(replayCatalogCutoverPending({...untrusted,barrier,readJournalHead:undefined}),/REPLAY_HANDLERS_MISSING/);
const emptyHead=count=>createEmptyCatalogJournal({kind,baseKey:'fixture',baseRevision:100,itemCount:count,now:100});
let head=emptyHead(1);const receipts=new Map();let commits=0;
const commit=async next=>{
  const applied=appendCatalogJournalDelta({head,delta:next,serverRevision:head.headRevision+1,now:101});
  if(!applied.ok)return {ok:false,conflict:applied.reason==='CONFLICT'};
  head=applied.head;commits++;
  receipts.set(next.mutationId,{confirmed:true,mutationId:next.mutationId,revision:applied.revision});
  return {ok:true};
};
const callbacks={bucket:r2,uid,kind,barrier,
  readJournalHead:async()=>head,readReceipt:async d=>receipts.get(d.mutationId)||null,commit};
const overlapping=await replayCatalogCutoverPending(callbacks);
assert.equal(overlapping.status,'HOLD');
assert.equal(overlapping.reason,'OVERLAPPING_ITEM_CONFLICT');
assert.equal(commits,1);
assert.equal(r2.rows(uid,kind)[0].status,'committed');
assert.equal(r2.rows(uid,kind)[1].status,'pending');
await replayCatalogCutoverPending(callbacks);
assert.equal(commits,1,'retry never duplicates a committed Catalog write');
console.log('CATALOG_CUTOVER_SAME_ID_STALE_UPSERT_HOLD=PASS');

// Different IDs can be safely replayed from the same old revision. The
// journal proves no intervening mutation has touched the second item.
const disjointR2=new FakeR2();
const itemDelta=(mutationId,id,swatch)=>({kind,mutationId,baseRevision:100,revision:101,
  baseItemCount:2,nextItemCount:2,upserts:[{id,createdAtMs:1,colorTags:{'0':swatch}}],deletedIds:[]});
await persistCatalogCutoverPending(disjointR2,uid,kind,itemDelta('A','song-a','purple'));
await persistCatalogCutoverPending(disjointR2,uid,kind,itemDelta('B','song-b',null));
let disjointHead=emptyHead(2);const confirmations=new Map(),sent=[];
const disjointCallbacks={bucket:disjointR2,uid,kind,barrier,
  readJournalHead:async()=>disjointHead,
  readReceipt:async d=>confirmations.get(d.mutationId)||null,
  commit:async next=>{
    const appended=appendCatalogJournalDelta({head:disjointHead,delta:next,serverRevision:disjointHead.headRevision+1,now:101});
    if(!appended.ok)return {ok:false,conflict:appended.reason==='CONFLICT'};
    disjointHead=appended.head;sent.push(next);
    confirmations.set(next.mutationId,{confirmed:true,mutationId:next.mutationId,revision:appended.revision});
    return {ok:true};
  }};
const result=await replayCatalogCutoverPending(disjointCallbacks);
assert.equal(result.status,'RETAINED_RECEIPTS');
assert.equal(result.confirmed,2);
assert.equal(sent[1].baseRevision,101);
assert.equal(sent[1].baseItemCount,2);
assert.equal(sent[1].upserts[0].colorTags['0'],null);
assert.equal(disjointR2.rows(uid,kind).every(e=>e.status==='committed'),true);
await replayCatalogCutoverPending(disjointCallbacks);
assert.equal(sent.length,2,'idempotent receipts');
const receiptOnly=new FakeR2();
await persistCatalogCutoverPending(receiptOnly,uid,kind,itemDelta('recovered','song-r','green'));
let unexpectedWrites=0;
const recovered=await replayCatalogCutoverPending({...disjointCallbacks,bucket:receiptOnly,
  readReceipt:async d=>({confirmed:true,mutationId:d.mutationId,revision:200}),
  commit:async()=>{unexpectedWrites++;return {ok:false};}});
assert.equal(recovered.status,'RETAINED_RECEIPTS');
assert.equal(unexpectedWrites,0);
const noProof=new FakeR2();
await persistCatalogCutoverPending(noProof,uid,kind,itemDelta('unconfirmed','song-x',null));
const uncertain=await replayCatalogCutoverPending({...disjointCallbacks,bucket:noProof,
  readReceipt:async()=>null,commit:async()=>({ok:true})});
assert.equal(uncertain.status,'HOLD');
assert.equal(noProof.rows(uid,kind)[0].status,'pending');
const retries=new FakeR2();
await persistCatalogCutoverPending(retries,uid,kind,itemDelta('http-1','song-x','blue'));
const w=retries.writes;
assert.equal((await persistCatalogCutoverPending(retries,uid,kind,itemDelta('http-2','song-x','blue'))).duplicate,true);
assert.equal(retries.writes,w);
await persistCatalogCutoverPending(retries,uid,kind,itemDelta('gray-click','song-x',null));
assert.equal(retries.rows(uid,kind).length,2);
console.log('CATALOG_CUTOVER_DISJOINT_PENDING_SAFE_REBASE=PASS');
console.log('CATALOG_CUTOVER_RECEIPT_RETRY_DEDUP_NO_LOSS=PASS');
// Capacity saturation is a retryable hold, never a silent overwrite.
const r6=new FakeR2();
for(let i=0;i<CUTOVER_PENDING_LIMIT;i++)await persistCatalogCutoverPending(r6,uid,kind,{...delta('cap-'+i),upserts:[{id:'cap-'+i,createdAtMs:1}]});
await assert.rejects(persistCatalogCutoverPending(r6,uid,kind,{...delta('overflow'),upserts:[{id:'overflow',createdAtMs:1}]}),/OUTBOX_FULL/);
assert.equal(r6.rows(uid,kind).length,CUTOVER_PENDING_LIMIT);
// Real Catalog Journal proof: 2 pending deltas with one old base revision
// cannot be replayed blindly. The second MUST remain pending (NO-GO).
// The same-ID overlap is already tested against the actual journal above.
// A new Worker local flag cannot isolate old live Worker ingress paths.
// All three explicit runtime configurations currently leave hold disabled.
const wrangler=JSON.parse(readFileSync('cloudflare/media-worker/wrangler.jsonc','utf8'));
for(const vars of [wrangler.vars,wrangler.env?.test?.vars,wrangler.env?.production?.vars]){
  assert.equal(vars?.SORIDRAW_CATALOG_CUTOVER_HOLD_V1,undefined);
}
console.log('CATALOG_CUTOVER_ALL_ENV_FLAGS_OFF_AND_NO_GLOBAL_INGRESS_FENCE=PASS');

// Hold GET must avoid legacy seeding: only an exact shared R2 read is allowed.
assert.match(readFileSync('cloudflare/media-worker/src/index.js','utf8'),
  /holding[\s\S]*readStrictCatalogStateForInspection\(env\.CATALOG, identity\.uid, route\.kind\)/);
console.log('CATALOG_CUTOVER_HOLD_GET_STRICT_SHARED_READ_NO_SEED=PASS');
// Runtime integration is opt-in, with successful outbox persistence -> HTTP 503.
// No read-only GET/bootstrap should sneak in a canonical Catalog write during hold.
const worker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
assert.match(worker,/catalogCutoverHoldEnabled\(env\)[\s\S]*route\.action !== 'inspect-exact'/);
assert.match(worker,/await persistCatalogCutoverPending\(env\?\.CATALOG,identity\.uid,route\.kind,delta\);[\s\S]*code:'CATALOG_CUTOVER_PENDING_DURABLE'[\s\S]*503/);
assert.doesNotMatch(worker,/replayCatalogCutoverPending\(/);
console.log('CATALOG_CUTOVER_DURABLE_PENDING_CAS_IDEMPOTENCY_GRAY=PASS');
console.log('CATALOG_CUTOVER_FAIL_CLOSED_IO_CONFLICT_LIMIT_AND_RECEIPT=PASS');
console.log('CATALOG_CUTOVER_DEFAULT_OFF_503_NO_AUTO_REPLAY=PASS');
