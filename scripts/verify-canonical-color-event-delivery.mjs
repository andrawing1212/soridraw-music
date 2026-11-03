import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  appendCatalogJournalDelta, createEmptyCatalogJournal, materializeCatalogJournal,
} from '../cloudflare/media-worker/src/catalogJournal.js';
import { planTrustedCanonicalColorEvent } from '../cloudflare/media-worker/src/colorRestoration.js';

const worker = readFileSync('cloudflare/media-worker/src/index.js','utf8');
const block = (start,end) => {
  const a = worker.indexOf(start);
  const b = worker.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a, 'missing real worker block '+start);
  return worker.slice(a,b);
};
const source=block('const applyServerColorEvent = async','\nconst handleServerColorEvent = async');
assert.doesNotMatch(source,/getCatalogState\(|seedSharedCatalog|buildCanonicalCatalog|firestoreCatalogQuery/);
assert.match(worker,/SORIDRAW_COLOR_CATALOG_EVENTS_V1/);
assert.match(worker,/SORIDRAW_COLOR_CATALOG_HMAC_SECRET/);
assert.match(worker,/signValue\(secret, issued \+ '\.' \+ raw\)/);
assert.match(worker,/constantTimeEqual\(expected, signed\)/);
assert.match(worker,/url\.pathname === '\/v1\/internal\/catalog-color-event'/);
assert.match(worker,/trustedR2 && typeof source.__colorSourceUpdateTime/);

const at0='2026-11-03T03:00:00.000000001Z';
const at1='2026-11-03T03:00:00.000000002Z';
const at2='2026-11-03T03:00:00.000000003Z';
const base={
  id:'note-1', createdAtMs:100, saved:true, title:'keep',
  favoriteColorTag:'blue', __colorSourceUpdateTime:at0,
};
const make=(start=base, {casFailOnce=false, initialAbsent=false}={})=>{
  const baseSnapshot={
    schemaVersion:4,authority:'server',kind:'musicNote',
    revision:100,itemCount:start?1:0,complete:true,generatedAtMs:100,
    items:start?[start]:[],
  };
  let current=createEmptyCatalogJournal({
    kind:'musicNote',baseKey:'base',baseRevision:100,itemCount:start?1:0,now:100,
  });
  let writes=0, reads=0,compactions=0;
  const ctx={
    readStrictCatalogStateForInspection: async ()=>{
      reads++;
      if(initialAbsent) return null;
      return {base:baseSnapshot,head:current,journalObject:{etag:'etag'}};
    },
    materializeCatalogState: (s,k)=>materializeCatalogJournal({
      baseSnapshot:s.base,head:s.head,
      projectItem:(item,id)=>({...item,id}),sortItems:items=>items,
    }),
    planTrustedCanonicalColorEvent,
    appendCatalogJournalDelta,
    putCatalogJournalHead:async (_env,_uid,_kind,next)=>{
      writes++;
      if(casFailOnce && writes===1) return null;
      current=next;
      return {etag:'stored'};
    },
    compactCatalogJournal:async()=>{compactions++;return false;},
    shouldCompactCatalogJournal:()=>false,
    Math,Date,Set,Map,Object,crypto:{randomUUID:()=> 'id'},
    text:v=>typeof v==='string'?v.trim():'',
  };
  const run=vm.runInNewContext(source+'\napplyServerColorEvent;',ctx);
  return {
    run:(event)=>run(event,{CATALOG:{}},null),
    count:()=>({reads,writes,compactions}),
    latest:()=>materializeCatalogJournal({
      baseSnapshot,head:current,projectItem:(item,id)=>({...item,id}),sortItems:xs=>xs,
    })?.items?.[0],
  };
};
const ev=(sourceUpdateTime,color, id='canonical-event-123')=>({
  schemaVersion:1,kind:'musicNote',uid:'owner',documentId:'note-1',
  eventId:id,sourceUpdateTime,
  canonical:{uid:'owner',saved:true,favoriteColorTag:color},
});
const normal=make();
const first=await normal.run(ev(at1,null));
assert.equal(first.code,'APPLIED');
assert.equal(normal.latest().favoriteColorTag,null);
assert.equal(normal.latest().__colorSourceUpdateTime,at1);
assert.equal(normal.latest().title,'keep');
assert.equal(normal.count().writes,1);
const repeat=await normal.run(ev(at1,null));
assert.equal(repeat.code,'DUPLICATE');
assert.equal(normal.count().writes,1);
const old=await normal.run(ev(at0,'red','canonical-event-old'));
assert.equal(old.code,'STALE');
assert.equal(normal.latest().favoriteColorTag,null);
const newer=await normal.run(ev(at2,'purple','canonical-event-new'));
assert.equal(newer.code,'APPLIED');
assert.equal(normal.latest().favoriteColorTag,'purple');
const failOnce=make(base,{casFailOnce:true});
assert.equal((await failOnce.run(ev(at1,null))).code,'APPLIED');
assert.equal(failOnce.count().writes,2);
const missing=make(null);
assert.equal((await missing.run(ev(at1,'red'))).code,'CATALOG_ROW_NOT_MATERIALIZED');
assert.equal(missing.count().writes,0);

const libraryOriginal={
 id:'track-1', createdAtMs:200,colorTags:{'0':'red','1':null},
 favoriteColorTags:{'0':'green'},__colorSourceUpdateTime:at0,
};
const updated=planTrustedCanonicalColorEvent({
 kind:'library',catalogRow:libraryOriginal,sourceUpdateTime:at1,
 canonical:{colorTags:{'0':null},favoriteColorTags:{}},
});
assert.equal(updated.code,'APPLY');
assert.equal(updated.row.colorTags['0'],null);
assert.equal(updated.row.colorTags['1'],undefined);
assert.deepEqual(updated.row.favoriteColorTags,{});
assert.equal(planTrustedCanonicalColorEvent({
 kind:'library',catalogRow:updated.row,sourceUpdateTime:at0,
 canonical:{colorTags:{'0':'red'}},
}).code,'STALE');
assert.equal(planTrustedCanonicalColorEvent({
 kind:'musicNote',catalogRow:{...base,deletedAt:10},
 sourceUpdateTime:at1,canonical:{uid:'owner',saved:true,favoriteColorTag:'purple'},
}).row,null);
assert.equal(planTrustedCanonicalColorEvent({
 kind:'musicNote',catalogRow:{...base,__colorSourceUpdateTime:'bad'},
 sourceUpdateTime:at1,canonical:{uid:'owner',favoriteColorTag:'red'},
}).code,'BAD_SOURCE_VERSION');
console.log('SIGNED_CANONICAL_COLOR_DELIVERY_CAS_RETRY_DEDUP_REORDER_GRAY=PASS');
console.log('COLOR_DELIVERY_MISSING_ROW_NO_WRITE_AND_NO_FIRESTORE_SCAN=PASS');
