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
assert.match(outbox,/\.limit\(80\)\.get\(\)/);
assert.doesNotMatch(outbox,/onDocumentWritten|collectionGroup\(|\.listDocuments\(/);
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
 console.log('COLOR_DURABLE_OUTBOX_ACK_GENERATION_RETRY_AND_OFFLINE=PASS');
 console.log('COLOR_OUTBOX_IDLE_DOCUMENT_CHANGES_NO_TRIGGER=PASS');
 console.log('COLOR_OUTBOX_EXACT_USER_CLICK_ONLY_AND_BOUNDED_REPLAY=PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});

