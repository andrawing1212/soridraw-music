/**
 * ISOLATED LOCAL ONLY: real Firestore Emulator + firebase-admin HTTPS exact
 * source handler + HMAC -> QA Worker entry -> Miniflare D1/R2 CAS/ACK.
 * Deliberately no real network, Firebase project, Cloudflare account or deploy.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {Miniflare} from 'miniflare';
import qaDefault,{createApp518IsolatedQaHandler518}
 from '../src/app518IsolatedQaWorker518.js';
import {createEmptyCatalogJournal} from '../src/catalogJournal.js';
const require=createRequire(import.meta.url);
const admin=require('../../../functions/node_modules/firebase-admin');
const {readExactApp518Source}=require('../../../functions/lib/app518CanonicalSourceProvider.js');
const {handleVerifiedApp518ExactSource,dispatchApp518VerifiedEnqueue,
 signApp518ServiceRequest}=require('../../../functions/lib/app518ServerTransport.js');

if(!/^(localhost|127\.0\.0\.1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')
 ||process.env.GOOGLE_CLOUD_PROJECT!=='demo-app518-atomic'
 ||process.env.GCLOUD_PROJECT!=='demo-app518-atomic')
 throw Error('REFUSE_NONLOCAL_OR_NONDEMO_FIRESTORE');
const app=admin.initializeApp({projectId:'demo-app518-atomic'},'app518-qa-exact-link');
const firestore=admin.firestore(app);
const tmp=mkdtempSync(join(tmpdir(),'app518-qa-link-'));
const uid='qa-exact-owner',id='qa-exact-song',secret='local-qa-hmac-32-or-more-characters-only';
const workerUrl='https://qa-worker.example.dev/v1/server/catalog518';
const sourceUrl='https://qa-firebase.example.dev/exact';
let time=Date.now(),failNextR2=false,writeCount=0,sourceReads=0;
const journalKey='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/journal.json';
const baseKey='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/base-1.json';
const options={modules:true,name:'app518-qa-local',
 script:"export default {fetch(){return new Response('local')}}",
 d1Databases:{CATALOG_OUTBOX_518:'00000000-0000-4000-8000-000000000518'},
 r2Buckets:{CATALOG:'app518-qa-isolated-local'},
 d1Persist:join(tmp,'d1'),r2Persist:join(tmp,'r2'),
 resourcePersistencePath:tmp};
let mf;
const run=async()=>{
 mf=new Miniflare(options);
 const d1=await mf.getD1Database('CATALOG_OUTBOX_518');
 const r2=await mf.getR2Bucket('CATALOG');
 const files=[
  'cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql',
  'cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql',
  'cloudflare/media-worker/migrations/518_music_note_catalog_daily_write_budget.sql'];
 const sql=files.map(x=>readFileSync(x,'utf8')).join('\n').split('\n')
  .filter(x=>!x.trimStart().startsWith('--')).join('\n');
 for(const query of sql.split(';').map(x=>x.trim()).filter(Boolean))
  await d1.prepare(query).run();
 await r2.put(baseKey,JSON.stringify({schemaVersion:4,authority:'server',
  kind:'musicNote',complete:true,ownerUid:uid,revision:1,itemCount:0,items:[]}),
  {customMetadata:{uid,kind:'musicNote'}});
 const head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey,baseRevision:1,itemCount:0,now:time}),
  canonicalAuthority518:true};
 await r2.put(journalKey,JSON.stringify(head),{
  customMetadata:{uid,kind:'musicNote',baseRevision:'1',revision:'1',
   itemCount:'0',deltaCount:'0',authority:'server'}});
 const protectedR2={
  get:(...args)=>r2.get(...args),
  put:async(...args)=>{
   const [key,,opts]=args;
   if(key===journalKey&&opts?.onlyIf&&failNextR2){
    failNextR2=false;
    throw Error('LOCAL_R2_IO_INTERRUPTED');
   }
   const result=await r2.put(...args);
   if(key===journalKey&&opts?.onlyIf&&result?.etag)writeCount++;
   return result;
  },
 };
 const env={
  FIREBASE_PROJECT_ID:'demo-app518-atomic',
  FIREBASE_PROJECT_NUMBER:'777777777777',
  SORIDRAW_APP518_QA_ACCOUNT_ID_518:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  SORIDRAW_APP518_PILOT_UID:uid,
  SORIDRAW_APP518_PILOT_FAVORITE_ID:id,
  SORIDRAW_APP518_QA_RELEASE_518:'APPROVED_ISOLATED_ONE_SONG',
  SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
  SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
  SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED',
  CATALOG_FIREBASE_SOURCE_518_URL:sourceUrl,
  CATALOG_FIREBASE_SOURCE_518_HOST:'qa-firebase.example.dev',
  CATALOG_SERVER_HMAC_518:secret,
  CATALOG_OUTBOX_518:d1,ACCOUNT_D1_BUDGET_518:d1,CATALOG:protectedR2,
 };
 const firestoreSource=async (_url,req)=>{
  sourceReads++;
  assert.equal(_url,sourceUrl);
  const result=await handleVerifiedApp518ExactSource({
   request:{method:req.method,headers:req.headers,
    rawBody:Buffer.from(req.body)},
   db:firestore,secret,nowMs:time,pilotUid:uid,pilotDocumentId:id,
  });
  return Response.json(result,{status:result.status});
 };
 const frozenClock=()=>time;
 const qa=createApp518IsolatedQaHandler518({
  env,trustedIsolatedQaProof:true,sourceFetcher:firestoreSource,
  clock:frozenClock,
 });
 assert.equal(qa.enabled,true);
 assert.equal(createApp518IsolatedQaHandler518({env}).enabled,false,
  'env strings alone must never attest isolation');
 const wrongProject=createApp518IsolatedQaHandler518({
  env:{...env,FIREBASE_PROJECT_ID:'soridraw-app-866a5'},
  trustedIsolatedQaProof:true,sourceFetcher:firestoreSource,clock:frozenClock});
 assert.equal(wrongProject.enabled,false);
 const blocked=await qaDefault.fetch(new Request(workerUrl,{method:'POST',
  headers:{'content-type':'application/json'},body:'{}'}),env);
 assert.equal(blocked.status,503,'standalone deploy entry stays OFF before approval');
 const invalid=await qa.fetch(new Request(workerUrl,{method:'POST',
  headers:{'content-type':'application/json'},body:'{}'}));
 assert.equal(invalid.status,409,'unsigned browser request is rejected');
 assert.equal(sourceReads,0,'authentication must precede Firestore reads');
 const doc=firestore.collection('favorites').doc(id);
 const read=async()=>{
  const result=await readExactApp518Source(firestore,uid,id);
  assert.equal(result.code,'SOURCE_VERIFIED');return result.source;
 };
 const pending=async()=>d1.prepare(
  'SELECT source_version_ns,desired_state,ack_version_ns,attempt_count,next_attempt_ms FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?'
 ).bind(uid,id).first();
 const r2Head=async()=>JSON.parse(await (await r2.get(journalKey)).text());
 const send=async()=>{
  const source=await read();
  return dispatchApp518VerifiedEnqueue({
   source,secret,workerUrl,expectedHostname:'qa-worker.example.dev',
   nowMs:time,
   post:(url,init)=>qa.fetch(new Request(url,init)),
  });
 };
 await doc.set({uid,title:'QA song',saved:true,createdAtMs:time});
 assert.equal((await send()).code,'ENQUEUED');
 let row=await pending();
 assert.equal(row.ack_version_ns,row.source_version_ns);
 assert.equal((await r2Head()).itemCount,1);
 assert.equal(writeCount,1);
 // Duplicate HTTP event never writes R2 again.
 assert.equal((await send()).code,'STALE_OR_DUPLICATE');
 assert.equal(writeCount,1);
 await doc.update({saved:false});
 assert.equal((await send()).code,'ENQUEUED');
 row=await pending();assert.equal(row.desired_state,'removed');
 assert.equal(row.ack_version_ns,row.source_version_ns);
 assert.equal((await r2Head()).itemCount,0);
 assert.equal(writeCount,2);
 // Real Firestore restore is queued and one R2 conditional PUT fails.
 await doc.update({saved:true,title:'Restored QA song'});
 failNextR2=true;
 assert.equal((await send()).code,'ENQUEUED',
  'D1 enqueue is durable even if exact R2 attempt loses connectivity');
 row=await pending();
 assert.notEqual(row.ack_version_ns,row.source_version_ns);
 assert.equal(row.attempt_count,1);
 assert.ok(row.next_attempt_ms>time);
 assert.equal((await r2Head()).itemCount,0);
 const wait=await qa.scheduled();
 assert.equal(wait.attempted,0,'cron must respect persisted retry deadline');
 time+=60000;
 const resumed=await qa.scheduled();
 assert.equal(resumed.acked,1);
 row=await pending();
 assert.equal(row.ack_version_ns,row.source_version_ns);
 assert.equal((await r2Head()).itemCount,1);
 assert.equal(writeCount,3);
 assert.equal((await qa.scheduled()).attempted,0);
 const oldVersion='000000000000000000001';
 const signed=signApp518ServiceRequest({secret,nowMs:time,body:{
  action:'enqueue',uid,documentId:id,sourceVersionNs:oldVersion,
  desiredState:'removed'}});
 const stale=await qa.fetch(new Request(workerUrl,{
  method:'POST',headers:signed.headers,body:signed.body}));
 assert.equal((await stale.json()).code,'STALE_SIGNED_EVENT_NO_WRITE');
 const foreign=signApp518ServiceRequest({secret,nowMs:time,body:{
  action:'enqueue',uid:'foreign-owner',documentId:id,sourceVersionNs:oldVersion,
  desiredState:'removed'}});
 const denied=await qa.fetch(new Request(workerUrl,{
  method:'POST',headers:foreign.headers,body:foreign.body}));
 assert.equal(denied.status,409);
 assert.equal(writeCount,3,'old and foreign events must be R2 W0');
 assert.equal((await r2Head()).itemCount,1,'latest song must not vanish');
 console.log('APP518_QA_REAL_FIRESTORE_HMAC_HTTP_D1_R2_SAVE_REMOVE_RESAVE=PASS');
 console.log('APP518_QA_REAL_MINIFLARE_RETRY_CRON_ACK_AND_NO_RESURRECTION=PASS');
 console.log('APP518_QA_WRONG_PROJECT_UNTRUSTED_PROOF_AND_BROWSER_OFF=PASS');
 console.log('APP518_QA_NO_LIVE_FIREBASE_CLOUDFLARE_OR_DEPLOY=PASS');
};
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose();}catch{}
 try{await app.delete();}catch{}
 rmSync(tmp,{recursive:true,force:true});
});
