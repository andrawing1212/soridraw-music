const assert=require('node:assert/strict');
const pure=require('../lib/colorCatalogEventPure.js');
const t={seconds:1793680000,nanoseconds:123456789};
assert.match(pure.firestoreTimestampNano(t),/\.123456789Z$/);
assert.equal(pure.firestoreTimestampNano(null),'');
const old={uid:'owner',saved:true,favoriteColorTag:'red'};
const reset={uid:'owner',saved:true,favoriteColorTag:null};
assert.equal(pure.colorEventNeeded('musicNote',old,reset),true);
assert.equal(pure.colorEventNeeded('musicNote',old,{...old,title:'edited'}),false);
assert.equal(pure.colorEventNeeded('musicNote',old,{...reset,saved:false}),false);
assert.equal(pure.colorEventNeeded('musicNote',null,old),true);
assert.equal(pure.colorEventNeeded('library',{colorTags:{'0':'red'}},{colorTags:{'0':null}}),true);
assert.equal(pure.colorEventNeeded('library',{colorTags:{'0':'red'}},{colorTags:{'0':'red'},title:'new'}),false);
const plan=pure.buildCanonicalColorDelivery({
 kind:'musicNote',uid:'owner',documentId:'id-1',eventId:'firebase-event-1',
 data:reset,sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
});
assert.equal(plan.canonical.favoriteColorTag,null);
assert.equal(plan.canonical.title,undefined);
assert.equal(pure.buildCanonicalColorDelivery({
 kind:'musicNote',uid:'owner',documentId:'id-1',eventId:'firebase-event-2',
 data:{...old,uid:'foreign'},sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
}),null);
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('functions/src/colorCatalogPublisher.ts','utf8');
const outbox=fs.readFileSync('functions/src/colorCatalogOutbox.ts','utf8');
const entry=fs.readFileSync('functions/src/index.ts','utf8');
const fav=fs.readFileSync('src/pages/FavoritesPage.tsx','utf8');
const lib=fs.readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const client=fs.readFileSync('src/services/colorCatalogOutboxService.ts','utf8');
assert.doesNotMatch(source,/onDocumentWritten\s*\(/,'no all-write Firestore triggers');
assert.doesNotMatch(entry,/syncMusicNoteCanonicalColors|syncLibraryCanonicalColors/,
  'broad color triggers must not be registered');
assert.match(entry,/commitCanonicalColorWithOutbox, retryPendingCanonicalColors/);
assert.match(source,/latest = await ref\.get\(\)/);
assert.match(source,/const signature = createHmac\('sha256',secret\)\.update/);
assert.match(source,/response\.json\(\)/);
assert.match(source,/COLOR_CATALOG_DELIVERY_UNCONFIRMED/,
  'HTTP 200 without an actual Worker ACK must not clear the queue');
assert.doesNotMatch(source,/(?:\b(?:ref|userRef|docRef|transaction|firestore)\.(?:set|update|delete)\(|runTransaction\()/,
  'publisher must not mutate Firestore');
assert.match(outbox,/enforceAppCheck:true/);
assert.match(outbox,/request\.auth\?\.uid/);
assert.match(outbox,/tx\.update\(song,/);
assert.match(outbox,/tx\.set\(rowRef,/);
assert.match(outbox,/tryDeliverPendingCanonicalColor\(rowRef,generation\)/);
assert.match(outbox,/if \(current\?\.generation === row\.generation\) tx\.delete\(ref\)/,
  'a stale ACK may never remove a newer task');
assert.match(outbox,/const snapshot = await tx\.get\(ref\)/);
assert.match(outbox,/if \(!current \|\| current\.generation !== generation\) return/);
assert.match(outbox,/onSchedule\(\{/);
assert.match(outbox,/\.where\('nextAttemptAt','<=',admin\.firestore\.Timestamp\.now\(\)\)/);
assert.match(outbox,/\.limit\(COLOR_REPLAY_LIMIT\)\.get\(\)/);
assert.match(outbox,/COLOR_REPLAY_LIMIT = 300/);
assert.match(outbox,/COLOR_REPLAY_PARALLELISM = 15/);
assert.match(outbox,/schedule:'every 5 minutes'/);
assert.match(outbox,/Promise\.allSettled\(due\.docs\.slice/);
assert.doesNotMatch(outbox,/onDocumentWritten|collectionGroup\(|\.listDocuments\(/);
const bridge=fs.readFileSync('functions/src/colorCatalogLegacyBridge.ts','utf8');
assert.match(entry,/captureLegacyMusicNoteColor, captureLegacyLibraryColor/);
assert.match(bridge,/retry:true,maxInstances:3/g);
assert.match(bridge,/document:'favorites\/\{documentId\}'/);
assert.match(bridge,/document:'suno_tracks\/\{uid\}\/tracks\/\{documentId\}'/);
assert.match(bridge,/legacyColorBridgeWindowOpen\(\) \|\| !colorEventNeeded\(kind,before,after\)/);
assert.match(bridge,/await stageLegacyCanonicalColorChange\(kind,uid,id\)/);
assert.match(bridge,/SORIDRAW_COLOR_CATALOG_LEGACY_BRIDGE_V1/);
assert.match(bridge,/SORIDRAW_COLOR_CATALOG_LEGACY_BRIDGE_UNTIL/);
assert.match(outbox,/if \(pending\.exists\) \{ state='EXISTING'; return; \}/,
  'capture must preserve the latest pending generation');
assert.match(outbox,/await tx\.get\(song\)/);
assert.match(outbox,/await tx\.get\(rowRef\)/);
assert.doesNotMatch(bridge,/(?:\.update\(|\.set\(|\.delete\(|runTransaction\()/,
  'legacy observer itself must never modify a canonical source');
assert.equal(pure.colorEventNeeded('musicNote',
 {uid:'owner',saved:true,favoriteColorTag:'purple'},
 {uid:'owner',saved:true}),true,'legacy deleting a color field must mean gray/reset');
assert.equal(pure.colorEventNeeded('library',
 {colorTags:{'0':'purple'}},{title:'other',status:'ready'}),true);
assert.equal(pure.colorEventNeeded('musicNote',
 {uid:'owner',saved:true},{uid:'owner',saved:true,title:'untouched color'}),false);
const absentColor=pure.buildCanonicalColorDelivery({
 kind:'musicNote',uid:'owner',documentId:'id-1',eventId:'firebase-event-3',
 data:{uid:'owner',saved:true},sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
});
assert.equal(absentColor.canonical.favoriteColorTag,null);
const absentMaps=pure.buildCanonicalColorDelivery({
 kind:'library',uid:'owner',documentId:'id-1',eventId:'firebase-event-4',
 data:{status:'ready'},sourceUpdateTime:'2026-11-03T03:00:00.123456789Z',
});
assert.deepEqual(absentMaps.canonical.colorTags,{});
assert.deepEqual(absentMaps.canonical.favoriteColorTags,{});

// Execute the actual legacy gate in a VM: when disabled, invalid or expired
// it must never let observers enqueue anything. No network or Firebase.
const openStart=bridge.indexOf('export const legacyColorBridgeWindowOpen = (');
const openEnd=bridge.indexOf('\nconst captureLegacy = async',openStart);
const gated=ts.transpileModule(bridge.slice(openStart,openEnd).replace('export const ','const '),
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const open=vm.runInNewContext(gated+'\nlegacyColorBridgeWindowOpen;', {Date});
const now=Date.parse('2026-11-03T00:00:00Z');
assert.equal(open(now,'0','2026-11-13T00:00:00Z'),false);
assert.equal(open(now,'1','2026-10-30T00:00:00Z'),false);
assert.equal(open(now,'1','2027-03-01T00:00:00Z'),false);
assert.equal(open(now,'1','2026-11-20T00:00:00Z'),true);

const legacyStart=outbox.indexOf('export const stageLegacyCanonicalColorChange = async (');
const legacyEnd=outbox.indexOf('\nexport const commitCanonicalColorWithOutbox = onCall(',legacyStart);
assert.ok(legacyStart>=0 && legacyEnd>legacyStart,'legacy staging is missing');
const staging=ts.transpileModule(outbox.slice(legacyStart,legacyEnd).replace('export const ','const '),
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const makeLegacy=({pending=false,active=true,owner='owner',missing=false}={})=>{
 let writes=0,sourceReads=0,pendingReads=0;
 const song={type:'source'},queued={type:'pending'};
 const ctx={
   validId:()=>true,sourceRef:()=>song,queue:()=>({doc:()=>queued}),keyFor:()=> 'key',
   randomUUID:()=> 'generation-1',isActive:(_kind,data)=>active&&data.saved!==false,
   admin:{firestore:Object.assign(()=>({runTransaction:async task=>{
     return task({
       get:async ref=>{
         if(ref.type==='source'){sourceReads++;return {exists:!missing,data:()=>({saved:true,uid:owner})};}
         pendingReads++;return {exists:pending};
       },
       set:()=>{writes++},
     })
   }}),{Timestamp:{now:()=>({seconds:3})}})},
 };
 const run=vm.runInNewContext(staging+'\nstageLegacyCanonicalColorChange;',ctx);
 return {run:()=>run('musicNote','owner','note-1'),counts:()=>({writes,sourceReads,pendingReads})};
};

assert.match(client,/import\.meta\.env\.VITE_COLOR_CATALOG_OUTBOX_V1 === '1'/);
assert.match(client,/commitCanonicalColorWithOutbox/);
assert.match(fav,/persistFavoriteColorOnly\(id, color\)/);
assert.match(lib,/persistWorkspaceColorOnly\(currentUser\.uid, trackId, colorField, idx, color\)/);
assert.match(lib,/persistWorkspaceColorOnly\(user\.uid, trackId, colorField, idx, color\)/);

// Execute the production tryDeliverPendingCanonicalColor function itself with
// in-memory ref/transaction/send stubs. No Firebase project, Cloudflare or
// network connection is used by this test.
const start=outbox.indexOf('export const tryDeliverPendingCanonicalColor = async (');
const end=outbox.indexOf('\nexport const commitCanonicalColorWithOutbox = onCall(',start);
assert.ok(start>=0&&end>start,'actual durable deliver code must exist');
const compiled=ts.transpileModule(
  outbox.slice(start,end).replace('export const ','const ')+'\n',
  {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}},
).outputText;
const make=({fail=false,switchGeneration=false,absent=false}={})=>{
  let row=absent?null:{
    schemaVersion:1,uid:'owner',kind:'musicNote',documentId:'n1',
    generation:'gen-original',attempts:0,
  };
  let sends=0,deletes=0,retries=0;
  const ref={get:async()=>({data:()=>row})};
  const context={
    validId:()=>true,
    deliverLatestCanonicalColor:async()=>{
      sends++;
      if(fail)throw Error('CLOUDFLARE_DOWN');
      return 'DELIVERED';
    },
    scheduleRetry:async()=>{retries++;},
    admin:{firestore:()=>({runTransaction:async task=>task({
      get:async()=>({data:()=>switchGeneration?{...row,generation:'gen-new'}:row}),
      delete:()=>{deletes++;},
    })})},
  };
  const run=vm.runInNewContext(compiled+'\ntryDeliverPendingCanonicalColor;',context);
  return {run:()=>run(ref,'gen-original'),counts:()=>({sends,deletes,retries})};
};
(async()=>{
 const good=make();assert.equal(await good.run(),'DELIVERED');
 assert.deepEqual(good.counts(),{sends:1,deletes:1,retries:0});
 const offline=make({fail:true});assert.equal(await offline.run(),'RETRY');
 assert.deepEqual(offline.counts(),{sends:1,deletes:0,retries:1});
 const interleaved=make({switchGeneration:true});assert.equal(await interleaved.run(),'DELIVERED');
 assert.deepEqual(interleaved.counts(),{sends:1,deletes:0,retries:0});
 const absent=make({absent:true});assert.equal(await absent.run(),'SUPERSEDED');
 assert.deepEqual(absent.counts(),{sends:0,deletes:0,retries:0});
 const legacyOk=makeLegacy();assert.equal(await legacyOk.run(),'QUEUED');
 assert.deepEqual(legacyOk.counts(),{writes:1,sourceReads:1,pendingReads:1});
 const legacyPending=makeLegacy({pending:true});assert.equal(await legacyPending.run(),'EXISTING');
 assert.equal(legacyPending.counts().writes,0);
 const legacyOther=makeLegacy({owner:'foreign'});assert.equal(await legacyOther.run(),'INACTIVE');
 assert.equal(legacyOther.counts().writes,0);
 const legacyGone=makeLegacy({missing:true});assert.equal(await legacyGone.run(),'INACTIVE');
 assert.equal(legacyGone.counts().writes,0);
 assert.equal(300*24*60/5,86400,'backlog best-case throughput per day');
 assert.ok(100000/(300*24*60/5) < 1.2,'100k backlog best case under 1.2 days');
 console.log('COLOR_LEGACY_DIRECT_WRITE_BRIDGE_EXACT_ROW_FAIL_CLOSED=PASS');
 console.log('COLOR_REPLAY_300_PER_5MIN_LIMITED_CONCURRENCY=PASS');
 console.log('COLOR_DURABLE_OUTBOX_ACK_GENERATION_RETRY_AND_OFFLINE=PASS');
 console.log('COLOR_OUTBOX_MODERN_WRITES_NO_BROAD_TRIGGER=PASS (legacy bridge separately gated)');
 console.log('COLOR_OUTBOX_EXACT_USER_CLICK_ONLY_AND_BOUNDED_REPLAY=PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});

