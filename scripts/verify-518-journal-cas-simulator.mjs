import assert from 'node:assert/strict';
import {
  createEmptyCatalogJournal,createCompactedCatalogJournal,
  materializeCatalogJournal,
} from '../cloudflare/media-worker/src/catalogJournal.js';
import {reconcileExactCanonicalWithJournal518} from '../cloudflare/media-worker/src/catalogJournalReconcile518.js';
const uid='test-owner',id='saved-1';
const ts=n=>'2026-10-28T02:00:00.'+String(n).padStart(9,'0')+'Z';
const canonical=(n,state='saved',isPublic=false)=>({
  uid,documentId:id,verifiedByServer:true,origin:'server-exact-read',
  updateTime:ts(n),state,item:{id,uid,title:'song',isPublic,createdAtMs:1730000000}
});
const project=(row,key)=>row?{...row,id:key}:null;
const sort=items=>items.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
const base={schemaVersion:4,kind:'musicNote',revision:100,authority:'server',
  complete:true,itemCount:0,items:[],generatedAtMs:100};
const initial=createEmptyCatalogJournal({kind:'musicNote',baseKey:'fixture',
  baseRevision:base.revision,itemCount:0,now:100});
let head=initial,etag='1',source=canonical(1),reads=0,puts=0,race=false;
const loadState=async()=>({head:structuredClone(head),base,etag});
const readExactCanonical=async()=>{reads++;return structuredClone(source);};
const storeIfEtag=async x=>{
  puts++;
  if(race){race=false;return false;}
  if(etag!==x.etag)return false;
  head=structuredClone(x.head);etag=String(Number(etag)+1);
  return true;
};
const go=()=>reconcileExactCanonicalWithJournal518({
 uid,id,loadState,readExactCanonical,storeIfEtag,
 projectItem:project,sortItems:sort,now:()=>200+puts,
});
let r=await go();
assert.equal(r.code,'APPLIED');
assert.equal(r.puts,1);assert.equal(r.reads,1);
let snapshot=materializeCatalogJournal({baseSnapshot:base,head,projectItem:project,sortItems:sort});
assert.equal(snapshot.items.length,1);assert.equal(head.sourceLedger518[id].state,'saved');
source=canonical(2,'removed');
r=await go();assert.equal(r.code,'APPLIED');
snapshot=materializeCatalogJournal({baseSnapshot:base,head,projectItem:project,sortItems:sort});
assert.equal(snapshot.items.length,0);
assert.equal(head.sourceLedger518[id].state,'removed');
const durable=head.sourceLedger518[id];
assert.equal(createCompactedCatalogJournal({head,baseKey:'new-base'}).sourceLedger518[id].sourceVersionNs,
 durable.sourceVersionNs,'compaction must preserve tombstone order');
const beforePuts=puts;
source=canonical(1);
r=await go();assert.equal(r.code,'SKIP_STALE');
assert.equal(puts,beforePuts,'stale source cannot write');
source=canonical(2,'removed');
r=await go();assert.equal(r.code,'SKIP_DUPLICATE');
assert.equal(puts,beforePuts,'duplicate cannot write');
source=canonical(3,'saved',true);
r=await go();assert.equal(r.code,'APPLIED');
snapshot=materializeCatalogJournal({baseSnapshot:base,head,projectItem:project,sortItems:sort});
assert.equal(snapshot.items[0].isPublic,true,'public/private detail must survive journal');
race=true; source=canonical(4,'saved',false);
const readsBefore=reads;
r=await go();assert.equal(r.code,'APPLIED');
assert.equal(reads-readsBefore,2,'CAS conflict must fresh-read canonical, not retry event.after');
assert.equal(r.puts,2,'CAS conflict bounded to two attempts');
snapshot=materializeCatalogJournal({baseSnapshot:base,head,projectItem:project,sortItems:sort});
assert.equal(snapshot.items[0].isPublic,false);
source={...canonical(5),verifiedByServer:false};
r=await go();assert.equal(r.code,'DENY_UNVERIFIED_SOURCE');
source=canonical(5);source.uid='attacker';
r=await go();assert.equal(r.code,'DENY_UNVERIFIED_SOURCE');
console.log('APP518_R2_SAME_ETAG_ATOMIC_LEDGER_AND_DELTA=PASS');
console.log('APP518_DELETED_TOMBSTONE_SURVIVES_COMPACTION=PASS');
console.log('APP518_STALE_SAVE_DUPLICATE_R2_W0=PASS');
console.log('APP518_PUBLIC_PRIVATE_AND_CAS_REREAD=PASS');
console.log('APP518_OWNER_AND_VERIFIED_CANONICAL_PROTECT=PASS');
console.log('APP518_NO_REAL_R2_OR_FIRESTORE_CALLS=PASS');
