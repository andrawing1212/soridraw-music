/**
 * Local-only real Miniflare R2 compaction conflict, crash-resume,
 * and Workers Free no-unbounded-full-base guard.
 * No account/Cloudflare/Firebase connection or production modifications.
 */
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEmptyCatalogJournal,appendCatalogJournalDelta,
 isValidCatalogJournal} from '../src/catalogJournal.js';
import {createOwnerR2Provider518} from '../src/catalogR2Provider518.js';

const folder=mkdtempSync(join(tmpdir(),'app518-compact-'));
const options={
 modules:true,name:'app518-only-local-compaction',
 script:"export default {fetch(){return new Response('local only')}}",
 r2Buckets:{CATALOG:'app518-local-fenced-compaction'},
 r2Persist:join(folder,'r2'),resourcePersistencePath:folder,
};
const prefix=uid=>'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
const headKey=uid=>prefix(uid)+'journal.json';
let mf,bucket,provider,conflict=false,guardedPuts=0,baseReads=0;
const init=async()=>{
 mf=new Miniflare(options);bucket=await mf.getR2Bucket('CATALOG');
 const guarded={
  get:async(key,...args)=>{
   if(key.includes('base-canonical518'))baseReads++;
   return bucket.get(key,...args);
  },
  put:async(key,body,opts)=>{
   if(key.endsWith('/journal.json')&&opts?.onlyIf
     &&body.includes('"canonicalCompaction518"')&&conflict){
    conflict=false;return null; // Cloudflare conditional PUT conflict
   }
   const saved=await bucket.put(key,body,opts);
   if(key.endsWith('/journal.json')&&opts?.onlyIf&&saved?.etag)
    guardedPuts++;
   return saved;
  },
 };
 provider=createOwnerR2Provider518({
  env:{CATALOG:guarded,
   SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'},
  sharedReleaseFencesVerified:true,
 });
 assert.equal(provider.enabled,true);
};
const makeHead=({uid,count})=>{
 const baseKey=prefix(uid)+'base-fixture.json';
 let head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey,baseRevision:1,itemCount:count,now:5000,
 }),canonicalAuthority518:true};
 for(let n=0;n<200;n++){
  const delta={mutationId:'canonical518:song-'+n+':'+String(n+1).padStart(21,'0'),
   baseRevision:head.headRevision,baseItemCount:count,
   nextItemCount:count,upserts:[],deletedIds:[]};
  const next=appendCatalogJournalDelta({
   head,delta,serverRevision:head.headRevision+1,now:5000+n,
  });
  assert.equal(next.ok,true);
  head={...next.head,canonicalAuthority518:true};
 }
 assert.ok(isValidCatalogJournal(head,'musicNote'));
 return head;
};
const putHead=async(uid,head)=>{
 const o=await bucket.put(headKey(uid),JSON.stringify(head),{
  customMetadata:{uid,kind:'musicNote',authority:'server',
   baseRevision:String(head.baseRevision),
   revision:String(head.headRevision),itemCount:String(head.itemCount),
   deltaCount:String(head.deltas.length)},
 });
 assert.ok(o.etag);return o.etag;
};
const run=async()=>{
 await init();
 const uid='bounded-owner';
 const head=makeHead({uid,count:1});
 await bucket.put(head.baseKey,JSON.stringify({
  schemaVersion:4,authority:'server',kind:'musicNote',complete:true,
  ownerUid:uid,revision:1,itemCount:1,items:[{id:'song-A',title:'A'}],
 }),{customMetadata:{uid,kind:'musicNote'}});
 const etag=await putHead(uid,head);
 const args={uid,expectedEtag:etag,expectedRevision:head.headRevision,
  projectItem:item=>item,sortItems:items=>items,nowMs:1000000};
 // Fault after base creation, before HEAD CAS. No mutation may be ACKed.
 conflict=true;
 let outcome=await provider.compactVerifiedOwnerHead(args);
 assert.equal(outcome.code,'RETRYABLE_COMPACTION_HEAD_MOVED');
 let stored=await provider.readOwnerHead(uid);
 assert.equal(stored.etag,etag,'failed CAS must leave previous HEAD');
 assert.equal(stored.head.deltas.length,200);
 assert.equal(guardedPuts,0);
 await mf.dispose();
 await init();
 outcome=await provider.compactVerifiedOwnerHead(args);
 assert.equal(outcome.code,'COMPACTED','restart must reuse immutable base');
 stored=await provider.readOwnerHead(uid);
 assert.equal(stored.head.baseRevision,head.headRevision);
 assert.equal(stored.head.headRevision,head.headRevision);
 assert.equal(stored.head.deltas.length,0);
 assert.equal(stored.head.canonicalCompaction518.fromEtag,etag);
 assert.equal(guardedPuts,1);
 const loaded=await provider.loadCompleteFencedOwnerR2({
  uid,projectItem:item=>item,sortItems:items=>items,
 });
 assert.equal(loaded.items.length,1);
 assert.equal(loaded.items[0].id,'song-A');
 // A large owner must HOLD before any full BASE read or R2 CAS.
 const hugeUid='oversized-owner';
 const huge=makeHead({uid:hugeUid,count:257});
 const hugeEtag=await putHead(hugeUid,huge);
 const readsBefore=baseReads,putsBefore=guardedPuts;
 outcome=await provider.compactVerifiedOwnerHead({
  uid:hugeUid,expectedEtag:hugeEtag,
  expectedRevision:huge.headRevision,
  projectItem:item=>item,sortItems:items=>items,
  nowMs:1000100,
 });
 assert.equal(outcome.code,'DENY_PAGED_COMPACTION_DEPENDENCIES');
 assert.equal(baseReads,readsBefore,'oversized owner must avoid BASE read');
 assert.equal(guardedPuts,putsBefore,'oversized owner must not write HEAD');
 console.log('APP518_REAL_MINIFLARE_COMPACTION_ETAG_CAS_CONFLICT_W0=PASS');
 console.log('APP518_REAL_MINIFLARE_IMMUTABLE_BASE_CRASH_RESUME=PASS');
 console.log('APP518_REAL_MINIFLARE_257_OWNER_NO_FULL_SCAN_NO_CAS=PASS');
 console.log('APP518_NO_LIVE_CLOUDFLARE_BINDINGS=PASS');
};
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose()}catch{}
 rmSync(folder,{recursive:true,force:true});
});
