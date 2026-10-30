// Genuine local-only 50,001 member Firebase Admin -> HMAC -> Miniflare D1
// -> paged indexed R2 writer + multipart compaction + exact save/delete ACK.
// No production Firebase, Cloudflare, data import, rollout or billing proof.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {Miniflare} from 'miniflare';
import {createApp518ServerBridge} from '../src/catalogServerBridge518.js';
import {createOwnerR2Provider518} from '../src/catalogR2Provider518.js';
import {createR2BasePageReader518} from '../src/catalogR2BasePages518.js';
import {advancePagedOwnerIndex518} from '../src/catalogOwnerPagedIndex518.js';
import {createD1BudgetGate518} from '../src/catalogD1DailyWriteBudget518.js';
import {createEmptyCatalogJournal,appendCatalogJournalDelta}
 from '../src/catalogJournal.js';
import {INDEX_META_READ_518,INDEX_MEMBER_LOOKUP_518}
 from '../src/catalogFirstChangeIndex518.js';
const require=createRequire(import.meta.url);
const admin=require('../../../functions/node_modules/firebase-admin');
const {commitApp518AtomicFavoriteCandidate:commit,app518CandidateDocumentId:idFor}
 =require('../../../functions/lib/app518AtomicFavoriteWriteCandidate.js');
const {relayExactAtomicOutbox518,readExactAtomicOutboxSource518}
 =require('../../../functions/lib/app518AtomicOutboxRelayCandidate.js');
const {signApp518ServiceRequest}
 =require('../../../functions/lib/app518ServerTransport.js');
if(!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')
 ||process.env.GOOGLE_CLOUD_PROJECT!=='demo-app518-atomic'
 ||process.env.GCLOUD_PROJECT!=='demo-app518-atomic')
 throw Error('REFUSE_NONLOCAL_FIRESTORE');
const app=admin.initializeApp({projectId:'demo-app518-atomic'},'app518-large-local');
const fs=admin.firestore(app);
const dir=mkdtempSync(join(tmpdir(),'app518-50k-local-'));
const accountCount=Number(process.env.APP518_E2E_OWNER_COUNT||50001);
if(![49152,50001].includes(accountCount))throw Error('INVALID_E2E_LOCAL_COUNT');
const uid='large-local-'+accountCount,createId='large-create-1',removeId='large-remove-2';
const id=idFor(uid,createId),now=Date.now(),secret='local-only-large-secret-long-enough';
const pre='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
const options={modules:true,name:'app518-50k-local',
 script:"export default {fetch(){return new Response('local only')}}",
 d1Persist:join(dir,'d1'),r2Persist:join(dir,'r2'),
 d1Databases:{CATALOG_OUTBOX_518:'00000000-0000-4000-8000-000000000519'},
 r2Buckets:{CATALOG:'local-50k-r2'},resourcePersistencePath:dir};
let mf,db,bucket,bridge,clockNow=now;
const TEST_TICK_MS=60*60000; // Local-only virtual UTC rollover; no real Cloudflare time or writes.
const source=async(owner,doc)=>{
 const hash=createHash('sha256').update(JSON.stringify(['owner',doc])).digest('hex');
 const snap=await fs.collection('server_music_note_owners_518').doc(hash).get();
 if(!snap.exists)return null;
 const exact=await readExactAtomicOutboxSource518({
  db:fs,uid:owner,documentId:doc,mutationId:snap.data().latestMutationId,
 });
 return exact.source||null;
};
const open=async()=>{
 mf=new Miniflare(options);
 db=await mf.getD1Database('CATALOG_OUTBOX_518');
 bucket=await mf.getR2Bucket('CATALOG');
 // These are LOCAL test-only attestations of one owned D1 database.
 // They are NOT evidence for live account-wide or legacy writer coverage.
 const env={CATALOG:bucket,CATALOG_OUTBOX_518:db,ACCOUNT_D1_BUDGET_518:db,
  CATALOG_SERVER_HMAC_518:secret,
  SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
  SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
  SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED'};
 bridge=createApp518ServerBridge({env,sharedReleaseFencesVerified:true,
  budgetClock:()=>clockNow,
  readExactCanonical:source,projectItem:x=>x,sortItems:x=>x});
 assert.equal(bridge.enabled,true);
};
const headRead=async()=>JSON.parse(await (await bucket.get(pre+'journal.json')).text());
const meta=async()=>db.prepare(INDEX_META_READ_518).bind(uid).first();
const member=async()=>{
 const m=await meta();
 if(!m||m.status!=='ready')return null;
 return !!(await db.prepare(INDEX_MEMBER_LOOKUP_518)
  .bind(uid,m.generation,id).first());
};
const queued=async()=>db.prepare(
 'SELECT source_version_ns,desired_state,ack_version_ns FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?'
).bind(uid,id).first();
const relay=async(mid)=>{
 return relayExactAtomicOutbox518({
  db:fs,uid,documentId:id,mutationId:mid,secret,
  workerUrl:'https://unit.local/v1/server/catalog518',expectedHostname:'unit.local',
  nowMs:now,releaseApproved:true,
  post:async(url,init)=>{
   const result=await bridge.ingestSignedRequest({
    request:new Request(url,init),nowMs:now});
   return new Response(JSON.stringify(result),{
    status:200,headers:{'content-type':'application/json'}});
  },
 });
};
const mutate=(intent,mutationId,prev)=>commit({
 db:fs,authenticatedUid:uid,uid,intent,mutationId,
 ...(prev?{documentId:id,expectedLastMutationId:prev}:{}),
 ...(!prev?{favorite:{title:'Large owner exact source',saved:true,
   lyrics:{korean:'기존 데이터 보존'}}}:{}),
 serverTimestamp:()=>admin.firestore.FieldValue.serverTimestamp(),
 releaseApproved:true,
});
const run=async()=>{
 await open();
 const ddl=[
  'cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql',
  'cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql',
  'cloudflare/media-worker/migrations/518_music_note_catalog_daily_write_budget.sql',
 ].map(p=>readFileSync(p,'utf8')).join('\n')
  .split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 for(const stmt of ddl.split(';').map(s=>s.trim()).filter(Boolean))
  await db.prepare(stmt).run();
 const rows=Array.from({length:accountCount},(_,i)=>({
  id:'original-'+i,uid,title:'Retain '+i,description:'한글-'.repeat(30),
 }));
 const base=JSON.stringify({
  schemaVersion:4,authority:'server',kind:'musicNote',revision:1,
  items:rows,itemCount:rows.length,complete:true,generatedAtMs:1000,
 });
 assert.ok(new TextEncoder().encode(base).length>8*1024*1024);
 assert.ok(new TextEncoder().encode(base).length<24*1024*1024);
 const baseKey=pre+'base-1.json';
 await bucket.put(baseKey,base,{customMetadata:{uid,kind:'musicNote'}});
 let head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey,baseRevision:1,itemCount:accountCount,now:1000,
 }),canonicalAuthority518:true};
 for(let n=0;n<200;n++){
  const patched=appendCatalogJournalDelta({
   head,delta:{
    mutationId:'canonical518:original-0:'+String(n+1).padStart(21,'0'),
    baseRevision:head.headRevision,baseItemCount:accountCount,nextItemCount:accountCount,
    upserts:[{id:'original-0',uid,title:'Updated '+n}],deletedIds:[],
   },serverRevision:head.headRevision+1,now:1000+n,
  });
  assert.equal(patched.ok,true);
  head={...patched.head,canonicalAuthority518:true};
 }
 await bucket.put(pre+'journal.json',JSON.stringify(head),{
  customMetadata:{uid,kind:'musicNote',
   baseRevision:String(head.baseRevision),revision:String(head.headRevision),
   itemCount:String(accountCount),deltaCount:String(head.deltas.length),authority:'server'},
 });
 const created=await mutate('create',createId);
 assert.equal(created.code,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await relay(createId)).code,'ENQUEUED_NOT_R2_ACK');
 let acked=false,progressTicks=0,stageObserved=false;
 for(let tick=0;tick<240;tick++){
  clockNow=now+tick*TEST_TICK_MS;
  const out=await bridge.drainServerPending({nowMs:clockNow,limit:1});
  const row=await queued();
  if(row?.ack_version_ns===row?.source_version_ns){
   assert.equal(out.acked,1);acked=true;break;
  }
  if(out.retry||out.attempted)progressTicks++;
  if((await meta())?.status==='building')stageObserved=true;
  if(out.held){
   const m=await meta();
   const b=await db.prepare('SELECT reserved_rows FROM music_note_catalog_daily_budget_518').first();
   const probeEnv={CATALOG:bucket,
    SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'};
   const provider=createOwnerR2Provider518({env:probeEnv,sharedReleaseFencesVerified:true});
   const baseReader=createR2BasePageReader518({env:probeEnv,
    readOwnerHead:provider.readOwnerHead,sharedReleaseFencesVerified:true,
    projectItem:x=>x});
   const probe=await advancePagedOwnerIndex518({
    db,uid,mode:'first',verifiedPendingMutation:true,nowMs:clockNow,
    readOwnerHead:provider.readOwnerHead,baseReader,projectItem:x=>x,
    reserveWriteBudget:createD1BudgetGate518({
     db,allAccountWritersVerified:true,sharedAccountLedgerVerified:true}),
   });
   console.error('APP518_LARGE_PAGED_PROBE',JSON.stringify(probe));
   console.error('APP518_LARGE_DIAGNOSTIC',JSON.stringify({
    tick,metaStatus:m?.status,headRevision:m?.indexed_revision,
    dayReserved:b?.reserved_rows,code:out.code,
   }));
  }
  assert.equal(out.held,0,'valid local large owner must not permanent-HOLD: '+JSON.stringify(out));
  if(tick===4){await mf.dispose();await open();}
 }
 assert.equal(acked,true,'50k save must reach verified R2 + D1 ACK');
 assert.equal(stageObserved,true,'true D1 first-index staging required');
 assert.ok(progressTicks>10,'multiple bounded invocations required');
 assert.equal(await member(),true);
 let after=await headRead();
 assert.equal(after.itemCount,accountCount+1);
 assert.equal(after.deltas.length<200,true,'pinned paged compaction actually ran');
 const gone=await mutate('delete',removeId,createId);
 assert.equal(gone.code,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await relay(createId)).code,'STALE_ATOMIC_OUTBOX_NOT_CURRENT');
 assert.equal((await relay(removeId)).code,'ENQUEUED_NOT_R2_ACK');
 const stale=signApp518ServiceRequest({secret,body:{
  action:'enqueue',uid,documentId:id,
  sourceVersionNs:(await queued()).ack_version_ns,desiredState:'saved',
 },nowMs:now});
 const staleResult=await bridge.ingestSignedRequest({
  request:new Request('https://unit.local/v1/server/catalog518',{
   method:'POST',headers:stale.headers,body:stale.body}),nowMs:now});
 assert.equal(staleResult.code,'STALE_SIGNED_EVENT_NO_WRITE');
 clockNow=now+250*TEST_TICK_MS;
 const removed=await bridge.drainServerPending({nowMs:clockNow,limit:1});
 assert.equal(removed.acked,1,'50k final delete must reach R2/D1 ACK');
 assert.equal(await member(),false);
 after=await headRead();
 assert.equal(after.itemCount,accountCount);
 assert.equal((await fs.collection('favorites').doc(id).get()).exists,false);
 const d1row=await queued();
 assert.equal(d1row.ack_version_ns,d1row.source_version_ns);
 assert.equal(d1row.desired_state,'removed');
 const quotas=(await db.prepare(
  'SELECT day_utc,reserved_rows FROM music_note_catalog_daily_budget_518 ORDER BY day_utc'
 ).all()).results;
 // A 50k owner with a membership secondary index MUST span UTC days:
 // one-day W80k would be exceeded by the >=100k minimum row+index cost.
 assert.ok(quotas.length>=2,'secondary-index cost requires a UTC-day pause');
 assert.ok(quotas.every(q=>q.reserved_rows<=80000),
  'each UTC day must stay under D1 Free safety cap');
 assert.ok(quotas.reduce((n,q)=>n+q.reserved_rows,0)>=accountCount*2);
 console.log('APP518_LOCAL_UTC_ROLLOVER_SECONDARY_INDEX_BUDGET=PASS');
 console.log('APP518_LOCAL_REAL_FIRESTORE_D1_R2_'+accountCount+'_SAVE_DELETE_ACK=PASS');
 console.log('APP518_LOCAL_'+accountCount+'_PAGED_IMPORT_MULTIPART_COMPACT=PASS');
 console.log('APP518_LOCAL_'+accountCount+'_CRASH_RESTART_STALE_SAVE_TOMBSTONE=PASS');
 console.log('APP518_LOCAL_D1_DAILY_RESERVATION_BELOW_FREE_LIMIT=PASS');
};
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose()}catch{}
 try{await app.delete()}catch{}
 rmSync(dir,{recursive:true,force:true});
});
