// Real cutover outbox + CAS + replay verification: NO network, no user data.
import assert from 'node:assert/strict';
import {persistCatalogCutoverPending,replayCatalogCutoverPending,catalogCutoverHoldEnabled,
  CUTOVER_PENDING_LIMIT,cutoverOutboxKey,listCatalogCutoverPendingScopes} from '../cloudflare/media-worker/src/catalogCutoverOutbox.js';
import {readFileSync} from 'node:fs';
import {appendCatalogJournalDelta,createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
class FakeR2 {
  objects=new Map(); writes=0; reads=0; lists=0; forceFail=false; loseCasOnce=false;
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
  async list({prefix,limit=1000,cursor}) {
    this.lists++;
    const entries=[...this.objects.keys()].filter(k=>k.startsWith(prefix)).sort();
    const start=cursor?Number(cursor):0;
    const pageSize=Math.min(limit,this.pageSize||limit);
    const keys=entries.slice(start,start+pageSize);
    const truncated=start+keys.length<entries.length;
    return {objects:keys.map(key=>({key})),truncated,cursor:truncated?String(start+keys.length):undefined};
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
assert.equal((await persistCatalogCutoverPending(r2,uid,kind,delta('id-two',{colorTags:{'0':'blue'}}))).held,true);
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

const aba=new FakeR2();
const choice=(mutationId,color)=>itemDelta(mutationId,'same-song',color);
await persistCatalogCutoverPending(aba,uid,kind,choice('purple-1','purple'));
await persistCatalogCutoverPending(aba,uid,kind,choice('gray-reset',null));
await persistCatalogCutoverPending(aba,uid,kind,choice('purple-2','purple'));
assert.deepEqual(aba.rows(uid,kind).map(e=>e.mutationId),
  ['purple-1','gray-reset','purple-2'],'last user choice must not be lost');
const abaBefore=aba.writes;
assert.equal((await persistCatalogCutoverPending(aba,uid,kind,choice('purple-retry','purple'))).duplicate,true);
assert.equal(aba.writes,abaBefore,'adjacent identical retry has zero new writes');
console.log('CATALOG_CUTOVER_ABA_LAST_CLICK_PRESERVED=PASS');

// Operator-only bounded R2-prefix inventory (never a page/API side effect).
const invR2=new FakeR2();
invR2.pageSize=1;
await persistCatalogCutoverPending(invR2,'uid-a','library',itemDelta('l-1','song-a','blue'));
await persistCatalogCutoverPending(invR2,'uid-b','musicNote',
  {...itemDelta('n-1','note-a',null),kind:'musicNote'});
invR2.objects.set('catalog/v5/uid-a/library/journal.json',{body:'fixture',etag:'not-read'});
const invBarrier={allWritersFenced:true,inFlightWritesDrained:true,authorizedInventory:true};
const invPrior={reads:invR2.reads,writes:invR2.writes};
const inventory=await listCatalogCutoverPendingScopes(invR2,{
  barrier:invBarrier,limit:2,maxPages:5});
assert.equal(inventory.status,'R2_OUTBOX_SCOPES_STABLE_NOT_GLOBAL_QUIESCENCE');
assert.equal(inventory.scopeCount,2);
assert.deepEqual(inventory.scopes,[{uid:'uid-a',kind:'library'},{uid:'uid-b',kind:'musicNote'}]);
assert.deepEqual({reads:invR2.reads,writes:invR2.writes},invPrior,
  'inventory cannot read or modify user Catalog');
assert.equal(invR2.lists,4,'two pages twice with exact cutover prefix');
await assert.rejects(listCatalogCutoverPendingScopes(invR2,{barrier:{}}),/INVENTORY_NOT_AUTHORIZED/);
await assert.rejects(listCatalogCutoverPendingScopes(invR2,{
  barrier:invBarrier,limit:1,maxPages:1}),/INVENTORY_PAGINATION_INCOMPLETE/);
const failList=new FakeR2();
failList.objects.set('catalog/cutover/v1/uid-a/library/pending.json',{etag:'fixture',body:'{}'});
failList.objects.set('catalog/cutover/v1/uid-b/library/unexpected.json',{etag:'fixture',body:'{}'});
await assert.rejects(listCatalogCutoverPendingScopes(failList,{barrier:invBarrier}),
  /INVENTORY_UNEXPECTED_KEY/);
const driftList=new FakeR2();
driftList.objects.set('catalog/cutover/v1/uid-a/library/pending.json',{etag:'fixture',body:'{}'});
const realList=driftList.list.bind(driftList);
driftList.list=async params=>{
  if(driftList.lists===1){
    driftList.objects.set('catalog/cutover/v1/uid-new/library/pending.json',
      {etag:'fixture',body:'{}'});
  }
  return realList(params);
};
await assert.rejects(listCatalogCutoverPendingScopes(driftList,{barrier:invBarrier}),
  /INVENTORY_DRIFT/);
console.log('CATALOG_CUTOVER_BOUNDED_R2_OUTBOX_ONLY_INVENTORY=PASS');
console.log('CATALOG_CUTOVER_DRIFT_INCOMPLETE_UNAUTHORIZED_FAIL_CLOSED=PASS');

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

// Release candidate Worker must NOT import the cutover queue or activate its
// 503 paths. The outbox/replay library is reserved for offline analysis.
const releaseWorker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
assert.doesNotMatch(releaseWorker,/catalogCutoverHoldEnabled|persistCatalogCutoverPending|CATALOG_CUTOVER_PENDING_DURABLE/);
assert.match(releaseWorker,/await getCatalogState\(identity, route\.kind, catalogRequiredRevision\(request\), env\)/);
assert.match(releaseWorker,/const next = await applyCatalogDelta\(identity, route\.kind, delta, env, executionCtx\)/);
console.log('CATALOG_COLOR_RELEASE_CANDIDATE_NORMAL_GET_DELTA_NO_HOLD=PASS');

// Stage-only operator outbox helper stays independently testable. A regular
// page load can never reach it unless a future separately reviewed change
// explicitly wires it back into the Worker.
assert.equal(catalogCutoverHoldEnabled({}),false);
console.log('CATALOG_CUTOVER_STAGED_ONLY_NO_RUNTIME_IO=PASS');


// A push-only Workflow is usable on preview even though repo default=main.
// It requires a SINGLE separately committed director-authorized trigger.
// No trigger file is created by this PR, so merge alone cannot deploy Workers.
const releaseWorkflow = readFileSync('.github/workflows/cloudflare-media-color-compat-rollout.yml','utf8');
assert.match(releaseWorkflow,/paths:[\s\S]*'\.deploy\/media-color-compat-release\.trigger'/);
assert.match(releaseWorkflow,/git diff-tree --no-commit-id --name-only -r HEAD/);
assert.match(releaseWorkflow,/approved_candidate_sha=/);
assert.match(releaseWorkflow,/DEPLOY_ALL_SHARED_MEDIA_WORKERS/);
assert.match(releaseWorkflow,/release-media-worker-runtime\.mjs "\$stage" upload/);
assert.match(releaseWorkflow,/release-media-worker-runtime\.mjs "\$stage" activate/);
assert.match(releaseWorkflow,/RELEASE_MEDIA_WORKER_VERSION="\$old" node .* restore/);
assert.match(releaseWorkflow,/ACTIVE_WORKER_VERSION_CHANGED_SINCE_DIRECTOR_EVIDENCE/);
assert.match(releaseWorkflow,/THREE_SHARED_COLOR_COMPAT_WORKERS_ACTIVE=PASS/);
assert.doesNotMatch(releaseWorkflow,/workflow_dispatch:|wrangler r2 object put|wrangler r2 object delete/);
assert.doesNotMatch(readFileSync('.github/workflows/cloudflare-media-r2-preview-deploy.yml','utf8'),
  /deploy-shared-color:/);
console.log('COLOR_SHARED_WORKERS_PINNED_SINGLE_TRIGGER_MANUAL_APPROVAL_GATE=PASS');

// During the explicit coordinated release, old version URLs must be
// disabled while the normal workers.dev URLs remain available to the app.
const versionRelease=readFileSync('.github/workflows/cloudflare-media-color-compat-rollout.yml','utf8');
const compatHelper=readFileSync('.deploy/release-media-worker-runtime.mjs','utf8');
assert.match(versionRelease,/ALL_LEGACY_VERSION_URLS_DISABLED_MAIN_WORKER_URLS_PRESERVED=PASS/);
assert.ok(versionRelease.indexOf('Disable old version-specific URLs') <
  versionRelease.indexOf('Activate all three in sequence'));
assert.match(compatHelper,/RELEASE_MEDIA_DISABLE_VERSION_URLS/);
assert.match(compatHelper,/preview_urls: false/);
console.log('COLOR_RELEASE_RETIRE_OLD_VERSION_URLS_KEEP_MAIN_WORKERS_DEV=PASS');
