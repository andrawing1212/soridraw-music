/**
 * LOCAL ONLY: real Firebase Admin SDK + Firestore emulator + Miniflare D1/R2.
 * Uses actual app518 HMAC ingest, D1 index/recovery and Indexed Writer.
 * Never substitutes a custom R2 writer for the production candidate.
 * No network, no Cloudflare account, no real Firebase project.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {Miniflare} from 'miniflare';
import {createApp518ServerBridge} from '../src/catalogServerBridge518.js';
import {createEmptyCatalogJournal,createCompactedCatalogJournal,isValidCatalogJournal,materializeCatalogJournal} from '../src/catalogJournal.js';
import {applyIndexedCanonicalR2Delta518} from '../src/catalogIndexedWriter518.js';
import {INDEX_META_READ_518,INDEX_MEMBER_LOOKUP_518} from '../src/catalogFirstChangeIndex518.js';
const require=createRequire(import.meta.url);
const admin=require('../../../functions/node_modules/firebase-admin');
const {commitApp518AtomicFavoriteCandidate:commit,app518CandidateDocumentId:idFor}
 =require('../../../functions/lib/app518AtomicFavoriteWriteCandidate.js');
const {relayExactAtomicOutbox518,readExactAtomicOutboxSource518}
 =require('../../../functions/lib/app518AtomicOutboxRelayCandidate.js');
const {signApp518ServiceRequest}=require('../../../functions/lib/app518ServerTransport.js');

const host=String(process.env.FIRESTORE_EMULATOR_HOST||'');
if(!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(host)||
 process.env.GOOGLE_CLOUD_PROJECT!=='demo-app518-atomic'||
 process.env.GCLOUD_PROJECT!=='demo-app518-atomic')
 throw Error('REFUSE_NONLOCAL_FIRESTORE_OR_NONDEMO_PROJECT');
const app=admin.initializeApp({projectId:'demo-app518-atomic'},'app518-atomic-d1r2-e2e');
const fs=admin.firestore(app);
const folder=mkdtempSync(join(tmpdir(),'app518-local-e2e-'));
const secret='app518-local-only-signature-key-long-enough-for-hmac';
const uid='local-e2e-owner',mutation='e2e-create-1',id=idFor(uid,mutation);
const now=Date.now();
const journalKey='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/journal.json';
const baseKey='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/base-1.json';
const options={
 modules:true,name:'app518-atomic-local-worker',
 script:"export default {fetch(){return new Response('local only')}}",
 d1Persist:join(folder,'d1'),r2Persist:join(folder,'r2'),
 d1Databases:{CATALOG_OUTBOX_518:'00000000-0000-4000-8000-000000000518'},
 r2Buckets:{CATALOG:'app518-local-r2'},
 resourcePersistencePath:folder,
};
let mf,d1,r2,bridge,readCurrent;
let loseAfterR2=false,casPuts=0;
assert.equal(typeof applyIndexedCanonicalR2Delta518,'function');
const init=async()=>{
 mf=new Miniflare(options);
 d1=await mf.getD1Database('CATALOG_OUTBOX_518');
 r2=await mf.getR2Bucket('CATALOG');
 readCurrent=async(owner,doc)=>{
  const snap=await fs.collection('server_music_note_owners_518')
   .doc(require('node:crypto').createHash('sha256')
    .update(JSON.stringify(['owner',doc])).digest('hex')).get();
  if(!snap.exists)return null;
  const change=snap.data().latestMutationId;
  const exact=await readExactAtomicOutboxSource518({
   db:fs,uid:owner,documentId:doc,mutationId:change,
  });
  return exact.source||null;
 };
 // Fault injection is AFTER a real Miniflare R2 conditional PUT.
 // The real R2 provider/Indexed Writer remain unchanged.
 const instrumentedR2={
  get:(...a)=>r2.get(...a),
  put:async(...a)=>{
   const out=await r2.put(...a);
   if(a[0]===journalKey&&a[2]?.onlyIf){
    if(out?.etag)casPuts++;
    if(out?.etag&&loseAfterR2){
     loseAfterR2=false;
     throw Error('R2_COMMITTED_RESPONSE_LOST');
    }
   }
   return out;
  },
 };
 const env={CATALOG_OUTBOX_518:d1,CATALOG:instrumentedR2,
  CATALOG_SERVER_HMAC_518:secret,
  SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'};
 bridge=createApp518ServerBridge({env,
  sharedReleaseFencesVerified:true,readExactCanonical:readCurrent,
  projectItem:item=>item,sortItems:items=>items,
 });
 assert.equal(bridge.enabled,true);
};
const signedPost=async(url,init,fail=false)=>{
 if(fail)throw Error('NETWORK_OFFLINE');
 const req=new Request(url,init);
 const response=await bridge.ingestSignedRequest({request:req,nowMs:now});
 return new Response(JSON.stringify(response),{status:200,
  headers:{'content-type':'application/json'}});
};
const producer=async(mutate,overrides={})=>relayExactAtomicOutbox518({
 db:fs,uid,documentId:id,mutationId:mutate,secret,
 workerUrl:'https://unit.local/v1/server/catalog518',
 expectedHostname:'unit.local',nowMs:now,releaseApproved:true,
 post:(url,init)=>signedPost(url,init,overrides.networkFail===true),
});
const sourceFields=(intent,mutationId,expectedLastMutationId,favorite)=>
 ({db:fs,authenticatedUid:uid,uid,intent,mutationId,
  ...(expectedLastMutationId?{documentId:id,expectedLastMutationId}:{}),
  ...(favorite?{favorite}:{}),serverTimestamp:()=>admin.firestore.FieldValue.serverTimestamp(),
  releaseApproved:true});
const refOutbox=async()=>d1.prepare('SELECT source_version_ns,desired_state,ack_version_ns,attempt_count,next_attempt_ms FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?').bind(uid,id).first();
// Full candidate pipeline: first owner staging, real indexed R2 CAS,
 // D1 journal replay, compaction-gap recovery and exact ACK.
const drain=async(t=now)=>bridge.drainServerPending({nowMs:t,limit:1});
const indexMeta=()=>d1.prepare(INDEX_META_READ_518).bind(uid).first();
const indexedPresent=async()=>{
 const m=await indexMeta();
 if(!m||m.status!=='ready')return null;
 return !!(await d1.prepare(INDEX_MEMBER_LOOKUP_518)
  .bind(uid,m.generation,id).first());
};
const compactUnreconciledHead=async()=>{
 // Simulate trusted R2 compaction BETWEEN R2 CAS and delayed D1 replay.
 // The recovery is NOT simulated: bridge calls actual catalogCompactionRecovery518.
 const oldObj=await r2.get(journalKey);
 const oldHead=JSON.parse(await oldObj.text());
 assert.equal(isValidCatalogJournal(oldHead,'musicNote'),true);
 assert.ok(oldHead.deltas.length>=1);
 const base=JSON.parse(await (await r2.get(baseKey)).text());
 const materialized=materializeCatalogJournal({
  baseSnapshot:base,head:oldHead,projectItem:item=>item,sortItems:items=>items});
 assert.ok(materialized);
 const newKey='catalog/v5/'+encodeURIComponent(uid)+
  '/musicNote/base-compacted-'+oldHead.headRevision+'.json';
 await r2.put(newKey,JSON.stringify({
  schemaVersion:4,authority:'server',kind:'musicNote',complete:true,
  ownerUid:uid,revision:oldHead.headRevision,
  itemCount:materialized.itemCount,items:materialized.items,
 }),{customMetadata:{uid,kind:'musicNote'}});
 const compressed=createCompactedCatalogJournal({head:oldHead,baseKey:newKey,now:now+11});
 assert.equal(compressed.baseRevision,oldHead.headRevision);
 assert.equal(compressed.deltas.length,0);
 const updated=await r2.put(journalKey,JSON.stringify(compressed),{
  onlyIf:{etagMatches:oldObj.etag},
  customMetadata:{
   uid,kind:'musicNote',baseRevision:String(compressed.baseRevision),
   revision:String(compressed.headRevision),
   itemCount:String(compressed.itemCount),
   deltaCount:'0',authority:'server',
  },
 });
 assert.ok(updated?.etag);
 return compressed;
};
const signedStale=async(staleVersion)=>{
 const body={action:'enqueue',uid,documentId:id,sourceVersionNs:staleVersion,desiredState:'saved'};
 const signed=signApp518ServiceRequest({secret,body,nowMs:now});
 return bridge.ingestSignedRequest({request:new Request('https://unit.local/v1/server/catalog518',{
  method:'POST',headers:signed.headers,body:signed.body}),nowMs:now});
};
const run=async()=>{
 await init();
 const sql=[
  'cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql',
  'cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql',
 ].map(p=>readFileSync(p,'utf8')).join('\n');
 // Miniflare D1 exec treats standalone SQL comments as statements.
 // Remove only comment lines; execute every actual DDL statement unchanged.
 const ddl=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 for(const stmt of ddl.split(';').map(s=>s.trim()).filter(Boolean))
  await d1.prepare(stmt).run();
 await r2.put(baseKey,JSON.stringify({
  schemaVersion:4,authority:'server',kind:'musicNote',complete:true,
  ownerUid:uid,revision:1,itemCount:0,items:[],
 }),{customMetadata:{uid,kind:'musicNote'}});
 const head={...createEmptyCatalogJournal({kind:'musicNote',baseKey,baseRevision:1,itemCount:0,now}),
  canonicalAuthority518:true};
 await r2.put(journalKey,JSON.stringify(head),{
  customMetadata:{uid,kind:'musicNote',baseRevision:'1',revision:'1',
   itemCount:'0',deltaCount:'0',authority:'server'},
 });
 const create=await commit(sourceFields('create',mutation,undefined,
  {title:'Local song',saved:true,lyrics:{korean:'원본'}}));
 assert.equal(create.code,'SOURCE_AND_OUTBOX_COMMITTED');
 let response=await relayExactAtomicOutbox518({
  db:fs,uid,documentId:id,mutationId:mutation,secret,
  workerUrl:'https://unit.local/v1/server/catalog518',expectedHostname:'unit.local',
  nowMs:now,releaseApproved:false});
 assert.equal(response.code,'HOLD_ATOMIC_RELAY_UNWIRED');
 assert.equal(await refOutbox(),null);
 await assert.rejects(producer(mutation,{networkFail:true}),/NETWORK_OFFLINE/);
 assert.equal(await refOutbox(),null);
 response=await producer(mutation);
 assert.equal(response.code,'ENQUEUED_NOT_R2_ACK');
 let queued=await refOutbox();
 assert.ok(queued?.source_version_ns&&queued.ack_version_ns===null);
 assert.equal((await producer(mutation)).code,'DUPLICATE_NOT_R2_ACK');
 loseAfterR2=true;
 const result=await drain();
 assert.equal(result.retry,1);assert.equal(result.acked,0);
 assert.equal((await refOutbox()).ack_version_ns,null);
 assert.equal(casPuts,1);
 const headAfterLost=JSON.parse(await (await r2.get(journalKey)).text());
 assert.equal(headAfterLost.itemCount,1);
 // A full Miniflare shutdown/restart must retain D1 and R2 data.
 await mf.dispose();await init();
 queued=await refOutbox();
 assert.equal(queued.ack_version_ns,null);
 const replay=await drain(now+60000);
 assert.equal(replay.acked,1);assert.equal(casPuts,1);
 assert.equal(await indexedPresent(),true);
 queued=await refOutbox();
 assert.equal(queued.ack_version_ns,queued.source_version_ns);
 const savedVersion=queued.source_version_ns;
 const del=await commit(sourceFields('delete','e2e-delete-2',mutation));
 assert.equal(del.code,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await producer(mutation)).code,'STALE_ATOMIC_OUTBOX_NOT_CURRENT');
 assert.equal((await producer('e2e-delete-2')).code,'ENQUEUED_NOT_R2_ACK');
 const stale=await signedStale(savedVersion);
 assert.equal(stale.code,'STALE_SIGNED_EVENT_NO_WRITE');
 queued=await refOutbox();assert.equal(queued.desired_state,'removed');
 const beforeDeleteIndex=await indexMeta();
 assert.equal(beforeDeleteIndex.status,'ready');
 // Force a committed R2 delete while D1 is still indexed at the old save.
 loseAfterR2=true;
 const lostDelete=await drain();
 assert.equal(lostDelete.acked,0);assert.equal(lostDelete.retry,1);
 assert.equal(casPuts,2);
 assert.equal(await indexedPresent(),true,
  'ACK loss must leave old D1 membership until recovery');
 const compressed=await compactUnreconciledHead();
 assert.equal(compressed.itemCount,0);
 assert.ok(compressed.baseRevision>beforeDeleteIndex.indexed_revision);
 await mf.dispose();await init();
 queued=await refOutbox();
 assert.notEqual(queued.ack_version_ns,queued.source_version_ns,
  'new delete must remain pending even with old saved-version ACK');
 const removed=await drain(now+120000);
 assert.equal(removed.acked,1);
 assert.equal(casPuts,2,'compaction+replay must not repeat the R2 mutation');
 assert.equal(await indexedPresent(),false);
 const afterRecoveryIndex=await indexMeta();
 assert.equal(afterRecoveryIndex.indexed_revision,compressed.headRevision);
 assert.equal(afterRecoveryIndex.generation,compressed.headRevision);
 const lastHead=JSON.parse(await (await r2.get(journalKey)).text());
 assert.equal(lastHead.itemCount,0);
 assert.equal(lastHead.deltas.length,0);
 assert.equal((await fs.collection('favorites').doc(id).get()).exists,false);
 const already=await drain();
 assert.equal(already.attempted,0);
 // 403 real Firebase Admin transactions + actual HMAC/D1/R2 Indexed Writer
 // changes. No test-created compaction here: the writer must trigger it.
 let prevMutation='e2e-delete-2',compactions=0;
 for(let n=0;n<403;n++){
  const mutationId='e2e-auto-'+n;
  const intent=n===0?'restore':'save';
  const saved=await commit(sourceFields(intent,mutationId,prevMutation,
    {title:'Auto compaction '+n,saved:true}));
  assert.equal(saved.code,'SOURCE_AND_OUTBOX_COMMITTED','atomic stress source '+n);
  const queued=await producer(mutationId);
  assert.equal(queued.code,'ENQUEUED_NOT_R2_ACK','stress relay '+n);
  const result=await drain(now+120000+n);
  assert.equal(result.acked,1,'stress write '+n+' '+JSON.stringify(result));
  const pending=await refOutbox();
  assert.equal(pending.ack_version_ns,pending.source_version_ns);
  prevMutation=mutationId;
 }
 const autoHead=JSON.parse(await (await r2.get(journalKey)).text());
 assert.ok(autoHead.baseRevision>compressed.headRevision,
  'real Indexed Writer must compact automatically, no manual compression');
 assert.ok(autoHead.deltas.length<200,'journal has not stalled at 400');
 assert.equal(autoHead.itemCount,1);
 assert.equal(await indexedPresent(),true);
 const finalMutation='e2e-auto-delete-404';
 const finalDelete=await commit(sourceFields('delete',finalMutation,prevMutation));
 assert.equal(finalDelete.code,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await producer(finalMutation)).code,'ENQUEUED_NOT_R2_ACK');
 const last=await drain(now+140000);
 assert.equal(last.acked,1,'final hard delete after 403 mutations');
 assert.equal(await indexedPresent(),false);
 const finalHead=JSON.parse(await (await r2.get(journalKey)).text());
 assert.equal(finalHead.itemCount,0);
 assert.equal((await fs.collection('favorites').doc(id).get()).exists,false);
 console.log('APP518_LOCAL_E2E_AUTOMATIC_COMPACTION_403_CHANGES_AND_FINAL_DELETE=PASS');
 console.log('APP518_LOCAL_E2E_REAL_FIRESTORE_ADMIN_ATOMIC_SOURCE=PASS');
 console.log('APP518_LOCAL_E2E_REAL_MINIFLARE_D1_HMAC_INGEST=PASS');
 console.log('APP518_LOCAL_E2E_ACTUAL_INDEXED_WRITER_R2_ETAG_CAS=PASS');
 console.log('APP518_LOCAL_E2E_NETWORK_FAILURE_WITHOUT_LOSS=PASS');
 console.log('APP518_LOCAL_E2E_ACK_LOSS_R2_IDEMPOTENT_RESTART=PASS');
 console.log('APP518_LOCAL_E2E_STALE_REVERSED_AND_DELETE_TOMBSTONE=PASS');
 console.log('APP518_LOCAL_E2E_REAL_INDEXED_WRITER_AND_D1_REPLAY=PASS');
 console.log('APP518_LOCAL_E2E_REAL_COMPACTION_GAP_RECOVERY=PASS');
 console.log('APP518_LOCAL_E2E_NO_EXTERNAL_CLOUDFLARE_OR_FIREBASE=PASS');
};
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose()}catch{}
 try{await app.delete()}catch{}
 rmSync(folder,{recursive:true,force:true});
});
