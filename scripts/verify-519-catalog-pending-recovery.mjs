import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const src=readFileSync('src/lib/userDataEngine.ts','utf8');
const output=ts.transpileModule(src,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const store=new Map();
let storageWrites=0,requests=0,failNetwork=false,hangResponse=null;
const localStorage={
 getItem:key=>store.get(key)||null,
 setItem:(key,value)=>{storageWrites++;store.set(key,String(value));},
 removeItem:key=>store.delete(key),
};
const authUser={uid:'owner-A',getIdToken:async()=> 'fixture-id-token'};
function load(dirty=0){
 let dirtyRevision=dirty;
 const exports={};
 const context={
  exports,console,TextEncoder,localStorage,Date,Math,JSON,Set,Map,
  setTimeout,clearTimeout,window:{location:{hostname:'preview.soridraw.com'}},
  require:name=>{
   if(name==='../firebase')return {
    auth:{get currentUser(){return authUser;}},
    getFirebaseAppCheckToken:async()=> 'fixture-app-check',
   };
   if(name==='./musicNoteSavedState')return {isMusicNoteItemRemoved:()=>false};
   if(name==='./firestoreMeasured')return {
    readAdaptiveListIndexDirtyRevision:()=>dirtyRevision,
    clearAdaptiveListIndexDirtyRevision:(_kind,ver)=>{
     if(dirtyRevision===ver)dirtyRevision=0;
    },
   };
   if(name==='./userProfileCache')return {readUserProfileCache:()=>null};
   if(name==='./catalogWarmCachePolicy')return {
    readCatalogProfileRevision:()=>0,canUseWarmCatalogWithoutRemote:()=>false,
   };
   if(name==='./catalogRuntimeDiagnostics')return {markCatalogRuntimeDiagnostic:()=>{}};
   return {};
  },
  fetch:async (url,init)=>{
   requests++;
   assert.match(url,/\/v1\/catalog\/musicNote\/delta$/);
   if(failNetwork)throw Error('NETWORK_DOWN');
   const delta=JSON.parse(init.body);
   if(hangResponse)await new Promise(resolve=>{hangResponse.resolve=resolve;});
   return {status:200,ok:true,json:async()=>({
    revision:delta.revision,itemCount:delta.nextItemCount,
   })};
  },
 };
 vm.runInNewContext(output,context,{filename:'userDataEngine.ts',timeout:3000});
 return {api:exports,setDirty:n=>{dirtyRevision=n;}};
}
const song=id=>({id,uid:'owner-A',title:'Saved '+id,createdAtMs:1000});
const pendingKey='soridraw_catalog_pending_v1:owner-A:musicNote';
let instance=load(1);
const api=instance.api;
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('a')]);
instance.setDirty(2);
api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('b')]);
assert.equal(requests,0,'mutation stage must not make remote calls');
assert.equal(api.getPendingCatalogPublishCount('owner-A'),1);
let durable=JSON.parse(store.get(pendingKey));
assert.deepEqual(durable.sourceItems.map(x=>x.id).sort(),['a','b'],
 'second partial Music Note item must never replace first unflushed song');
assert.equal(durable.dirtyRevision,2);
assert.ok(storageWrites>=2);

instance=load(0); // hard browser refresh, volatile dirty counter reset
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),1,
 'startup must see previously committed Catalog intent even with dirty counter 0');
assert.equal(requests,0,'healthy startup without changes must not fetch');
const empty={schemaVersion:4,authority:'server',kind:'musicNote',
 revision:1,complete:true,items:[],itemCount:0,generatedAtMs:1000};
await instance.api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',empty);
await instance.api.flushPendingCatalogPublishes('owner-A');
assert.equal(requests,1,'two adjacent mutations should publish in one delta');
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),0);
assert.equal(store.has(pendingKey),false,'ACK clears durable pending marker');
assert.equal(load(0).api.getPendingCatalogPublishCount('owner-A'),0);
console.log('APP519_PARTIAL_A_B_MERGE_RELOAD_RECOVERY_ACK=PASS');

instance=load(1);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('c')]);
failNetwork=true;
await instance.api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',empty);
await assert.rejects(instance.api.flushPendingCatalogPublishes('owner-A'));
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),1);
failNetwork=false;
instance=load(0);
await instance.api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',empty);
await instance.api.flushPendingCatalogPublishes('owner-A');
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),0);
console.log('APP519_OFFLINE_PENDING_RETAINED_AFTER_REFRESH=PASS');

instance=load(1);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('d')]);
instance.setDirty(2);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[],{deletedIds:['d']});
durable=JSON.parse(store.get(pendingKey));
assert.deepEqual(durable.sourceItems.map(x=>x.id),[]);
assert.deepEqual(durable.options.deletedIds,['d']);
assert.equal(instance.api.getPendingCatalogPublishCount('other-owner'),0);
console.log('APP519_EXPLICIT_DELETE_WINS_UID_SCOPED=PASS');

store.delete(pendingKey);
instance=load(1);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('x')]);
await instance.api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',empty);
hangResponse={resolve:null};
const oldFlush=instance.api.flushPendingCatalogPublishes('owner-A');
// Allow the awaited authentication and request work to reach the delayed fetch.
for(let i=0;i<20&&!hangResponse.resolve;i++)await Promise.resolve();
assert.equal(typeof hangResponse.resolve,'function');
instance.setDirty(2);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('y')]);
hangResponse.resolve();
await oldFlush;
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),1,
 'old ACK must not erase a newer local pending intent');
durable=JSON.parse(store.get(pendingKey));
assert.deepEqual(durable.sourceItems.map(x=>x.id).sort(),['x','y']);
console.log('APP519_INFLIGHT_OLD_ACK_CANNOT_ERASE_NEW_PENDING=PASS');

// A Firestore write may finish while an older Catalog flush is already
// running, before the caller stages the next Catalog item. Clearing the
// latest dirty counter with an older ACK would silently drop that song.
store.delete(pendingKey);
instance=load(1);
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('old')]);
await instance.api.writeCatalogSnapshotToLocalCache('musicNote','owner-A',empty);
instance.setDirty(2);
hangResponse=null;
await instance.api.flushPendingCatalogPublishes('owner-A');
instance.api.scheduleCatalogSnapshotPublishIfDirty('musicNote','owner-A',[song('new')]);
assert.equal(instance.api.getPendingCatalogPublishCount('owner-A'),1,
 'older ACK must preserve a newer unqueued Firestore dirty revision');
assert.deepEqual(JSON.parse(store.get(pendingKey)).sourceItems.map(x=>x.id),['new']);
console.log('APP519_UNSCHEDULED_NEW_FIRESTORE_DIRTY_NOT_ERASED=PASS');
console.log('APP519_NO_CHANGE_PAGE_OPEN_REMOTE_R0_W0=PASS');
