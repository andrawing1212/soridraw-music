/**
 * LOCAL ONLY: real Firebase Admin SDK + Firestore emulator + Miniflare D1/R2.
 * Uses the actual app518 HMAC ingest + D1 delivery queue and R2 journal CAS.
 * The test's small R2 adapter is NOT the production indexed R2 writer.
 * No network, no Cloudflare account, no real Firebase project.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {Miniflare} from 'miniflare';
import {createApp518ServerBridge} from '../src/catalogServerBridge518.js';
import {deliverDueCanonicalFavorites518} from '../src/catalogDelivery518.js';
import {parseFirestoreUpdateTimeNs518} from '../src/catalogCanonicalFence518.js';
import {createEmptyCatalogJournal,appendCatalogJournalDelta,isValidCatalogJournal,materializeCatalogJournal} from '../src/catalogJournal.js';
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
 modules:true,script:"export default {fetch(){return new Response('local only')}}",
 d1Databases:{CATALOG_OUTBOX_518:'00000000-0000-4000-8000-000000000518'},
 r2Buckets:{CATALOG:'app518-local-r2'},
 resourcePersistencePath:folder,
};
let mf,d1,r2,bridge,readCurrent;
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
 const env={CATALOG_OUTBOX_518:d1,CATALOG:r2,
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
let loseAfterR2=false,casPuts=0;
const casProvider=async({uid:owner,documentId,sourceVersionNs,desiredState,canonical})=>{
 const obj=await r2.get(journalKey);
 assert.ok(obj);
 const head=JSON.parse(await obj.text());
 assert.equal(isValidCatalogJournal(head,'musicNote'),true);
 assert.equal(head.canonicalAuthority518,true);
 const marker='canonical518:'+documentId+':'+sourceVersionNs;
 if(head.recentMutations.some(x=>x.id===marker)){
  return {code:'ALREADY_APPLIED',ownerVerified:true,versionVerified:true,
   casVerified:true,sourceVersionNs};
 }
 const exact=await readCurrent(owner,documentId);
 if(!exact||exact.state!==desiredState||
  parseFirestoreUpdateTimeNs518(exact.updateTime)!==sourceVersionNs)
  return {code:'HOLD_STALE_SOURCE_BEFORE_R2_CAS'};
 const snapshot={schemaVersion:4,authority:'server',kind:'musicNote',
  revision:head.baseRevision,itemCount:0,items:[]};
 const current=materializeCatalogJournal({
  baseSnapshot:snapshot,head,projectItem:item=>item,sortItems:items=>items});
 assert.ok(current);
 const old=current.items.some(x=>x.id===documentId);
 const nextCount=current.itemCount+(desiredState==='saved'&&!old?1:0)
  -(desiredState==='removed'&&old?1:0);
 const applied=appendCatalogJournalDelta({
  head,delta:{mutationId:marker,baseRevision:head.headRevision,
   baseItemCount:head.itemCount,nextItemCount:nextCount,
   upserts:desiredState==='saved'?[{...canonical.item,id:documentId}]:[],
   deletedIds:desiredState==='removed'?[documentId]:[]},
  serverRevision:head.headRevision+1,now,
 });
 assert.equal(applied.ok,true);
 const stored=await r2.put(journalKey,JSON.stringify(applied.head),{
  onlyIf:{etagMatches:obj.etag},
  customMetadata:{uid:owner,kind:'musicNote',
   baseRevision:String(applied.head.baseRevision),
   revision:String(applied.head.headRevision),
   itemCount:String(applied.head.itemCount),
   deltaCount:String(applied.head.deltas.length),authority:'server'},
 });
 if(!stored?.etag)throw Error('CAS_CONFLICT_NO_ACK');
 casPuts++;
 if(loseAfterR2){loseAfterR2=false;throw Error('R2_SUCCEEDED_ACK_NETWORK_LOST');}
 return {code:'APPLIED',ownerVerified:true,versionVerified:true,
  casVerified:true,sourceVersionNs};
};
const drain=async(t=now)=>deliverDueCanonicalFavorites518({
 db:d1,nowMs:t,maxItems:1,readExactCanonical:readCurrent,
 applyVersionedR2:casProvider,
});
const signedStale=async(staleVersion)=>{
 const body={action:'enqueue',uid,documentId:id,sourceVersionNs:staleVersion,desiredState:'saved'};
 const signed=signApp518ServiceRequest({secret,body,nowMs:now});
 return bridge.ingestSignedRequest({request:new Request('https://unit.local/v1/server/catalog518',{
  method:'POST',headers:signed.headers,body:signed.body}),nowMs:now});
};
const run=async()=>{
 await init();
 const sql=readFileSync('cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql','utf8');
 await d1.exec(sql); // Execute the real migration as a whole; comments contain semicolons.
 await r2.put(baseKey,JSON.stringify({schemaVersion:4,authority:'server',kind:'musicNote',revision:1,
  itemCount:0,items:[]}));
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
 const removed=await drain();
 assert.equal(removed.acked,1);
 assert.equal(casPuts,2);
 const lastHead=JSON.parse(await (await r2.get(journalKey)).text());
 assert.equal(lastHead.itemCount,0);
 assert.equal(lastHead.deltas.length,2);
 assert.equal((await fs.collection('favorites').doc(id).get()).exists,false);
 const already=await drain();
 assert.equal(already.attempted,0);
 console.log('APP518_LOCAL_E2E_REAL_FIRESTORE_ADMIN_ATOMIC_SOURCE=PASS');
 console.log('APP518_LOCAL_E2E_REAL_MINIFLARE_D1_HMAC_INGEST=PASS');
 console.log('APP518_LOCAL_E2E_REAL_MINIFLARE_R2_JOURNAL_ETAG_CAS=PASS');
 console.log('APP518_LOCAL_E2E_NETWORK_FAILURE_WITHOUT_LOSS=PASS');
 console.log('APP518_LOCAL_E2E_ACK_LOSS_R2_IDEMPOTENT_RESTART=PASS');
 console.log('APP518_LOCAL_E2E_STALE_REVERSED_AND_DELETE_TOMBSTONE=PASS');
 console.log('APP518_LOCAL_E2E_NO_EXTERNAL_CLOUDFLARE_OR_FIREBASE=PASS');
};
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose()}catch{}
 try{await app.delete()}catch{}
 rmSync(folder,{recursive:true,force:true});
});
