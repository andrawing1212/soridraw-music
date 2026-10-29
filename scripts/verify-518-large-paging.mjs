import assert from 'node:assert/strict';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {createR2BasePageReader518} from '../cloudflare/media-worker/src/catalogR2BasePages518.js';
import {advancePagedOwnerIndex518} from '../cloudflare/media-worker/src/catalogOwnerPagedIndex518.js';
import {deferPagedFavorite518} from '../cloudflare/media-worker/src/catalogD1Outbox518.js';

const uid='large-owner',baseKey='catalog/v5/large-owner/musicNote/bases/100.json';
const headEtag='"owner-head"';
const mkFixture=(count,{baseRevision=100,delta=false}={})=>{
 const items=Array.from({length:count},(_,i)=>({
  id:'song-'+i,createdAtMs:count-i+1,
  title:i===17?'quote } ] \\" and a 한글 symbol':'song',
  tags:i===18?{nested:[{v:'X ] } " \\ end'}]}:null,
 }));
 const base={schemaVersion:4,authority:'server',kind:'musicNote',
  revision:baseRevision,items,itemCount:count,complete:true,generatedAtMs:1000};
 const root={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey,baseRevision,itemCount:count,now:1000,
 }),canonicalAuthority518:true};
 if(delta){
  const d={mutationId:'canonical518:added:001793152800000000001',
   baseRevision,revision:baseRevision+1,baseItemCount:count,
   nextItemCount:count,upserts:[{id:'added',createdAtMs:1}],deletedIds:['song-0']};
  root.deltas=[d];root.headRevision=baseRevision+1;
  root.recentMutations=[{id:d.mutationId,revision:d.revision,itemCount:count}];
 }
 const body=new TextEncoder().encode(JSON.stringify(base));
 let puts=0,rangeReads=0,fullReads=0,etag='"BASE-1"';
 const catalog={
  async head(k){
   assert.equal(k,baseKey);
   return {etag,size:body.length,customMetadata:{uid,kind:'musicNote'}};
  },
  async get(k,opts){
   assert.equal(k,baseKey);
   if(!opts?.range)fullReads++;
   const {offset,length}=opts.range;
   rangeReads++;
   assert.equal(opts.onlyIf.etagMatches,etag);
   const slice=body.slice(offset,offset+length);
   return {etag,customMetadata:{uid,kind:'musicNote'},
    async arrayBuffer(){return slice.buffer.slice(slice.byteOffset,slice.byteOffset+slice.byteLength);},
    async text(){throw Error('whole BASE read forbidden');},
   };
  },
  async put(){puts++;throw Error('R2 PUT forbidden');},
 };
 const env={CATALOG:catalog,
  SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'};
 const state=()=>({ownerUid:uid,verifiedByServer:true,
  fencedWritersVerified:true,head:root,etag:headEtag});
 const reader=createR2BasePageReader518({env,readOwnerHead:state,
  sharedReleaseFencesVerified:true,projectItem:item=>item});
 return {root,reader,state,counters:()=>({puts,rangeReads,fullReads}),
  swapBase:()=>{etag='"BASE-2"';}};
};
const mockDb=({recovery=false}={})=>{
 const members=new Map(),cursors=new Map();
 let meta=recovery?{generation:90,indexed_revision:100,expected_count:1,
  head_etag:'"old"',status:'ready',recovery_generation:null,
  recovery_etag:null,recovery_revision:null,recovery_count:null,
  recovery_restart_count:0}:null;
 let calls=0,maxCalls=0,failBatch=false;
 const key=(u,g,m)=>u+'|'+g+'|'+m;
 const set=(u,g)=>{const k=u+'|'+g;if(!members.has(k))members.set(k,new Set());return members.get(k);};
 const changes=n=>({success:true,meta:{changes:n}});
 const read=(sql,a)=>{
  if(sql.includes('FROM music_note_catalog_index_meta_518'))return meta?{...meta}:null;
  if(sql.includes('FROM music_note_catalog_paged_stage_518'))
   return {...(cursors.get(key(a[0],a[1],a[2]))||{})};
  if(sql.includes('COUNT(*) AS n FROM music_note_catalog_member_518'))
   return {n:set(a[0],a[1]).size};
  throw Error('bad SELECT '+sql);
 };
 const write=(sql,a)=>{
  if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_index_meta_518')){
   if(meta)return changes(0);
   meta={generation:a[1],indexed_revision:a[2],expected_count:a[3],
    head_etag:a[4],checked_at_ms:a[5],status:'building',restart_count:0};
   return changes(1);
  }
  if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_paged_stage_518')){
   const k=key(a[0],a[1],a[2]);
   if(cursors.has(k))return changes(0);
   cursors.set(k,{owner_uid:a[0],generation:a[1],mode:a[2],
    head_revision:a[3],head_etag:a[4],head_count:a[5],base_key:a[6],
    base_etag:a[7],base_size:a[8],base_offset:0,base_seen:0,
    phase:'base',delta_index:0,updated_at_ms:a[9]});
   return changes(1);
  }
  if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_member_518')){
   assert.match(sql,/json_each/);let count=0;
   for(const id of JSON.parse(a[2])){
    const s=set(a[0],a[1]);if(!s.has(id)){s.add(id);count++;}
   }
   return changes(count);
  }
  if(sql.startsWith('DELETE FROM music_note_catalog_member_518')){
   let count=0;const s=set(a[0],a[1]);
   for(const id of JSON.parse(a[2]))if(s.delete(id))count++;
   return changes(count);
  }
  if(sql.startsWith('UPDATE music_note_catalog_paged_stage_518 SET base_offset')){
   const [off,seen,phase,now,u,gen,m,wasOff,wasSeen,etag,baseEtag]=a;
   const row=cursors.get(key(u,gen,m));
   if(!row||row.phase!=='base'||row.base_offset!==wasOff
     ||row.base_seen!==wasSeen||row.head_etag!==etag||row.base_etag!==baseEtag)
    return changes(0);
   Object.assign(row,{base_offset:off,base_seen:seen,phase,updated_at_ms:now});
   return changes(1);
  }
  if(sql.startsWith('UPDATE music_note_catalog_paged_stage_518 SET delta_index')){
   const [i,phase,now,u,gen,m,prev,etag]=a;
   const row=cursors.get(key(u,gen,m));
   if(!row||row.phase!=='delta'||row.delta_index!==prev||row.head_etag!==etag)
    return changes(0);
   Object.assign(row,{delta_index:i,phase,updated_at_ms:now});return changes(1);
  }
  if(sql.includes("SET status='ready',checked_at_ms=?")){
   const [now,u,gen,count,etag]=a;
   if(u!==uid||meta.status!=='building'||meta.generation!==gen
     ||meta.expected_count!==count||meta.head_etag!==etag)return changes(0);
   Object.assign(meta,{status:'ready',checked_at_ms:now});return changes(1);
  }
  if(sql.includes('SET recovery_generation=?')&&!sql.includes('recovery_restart_count=recovery_restart_count+1')){
   const [gen,rev,etag,count,now,u,oldGen,oldRev,oldEtag]=a;
   if(u!==uid||meta.status!=='ready'||meta.generation!==oldGen
     ||meta.indexed_revision!==oldRev||meta.head_etag!==oldEtag
     ||meta.recovery_generation!=null)return changes(0);
   Object.assign(meta,{recovery_generation:gen,recovery_revision:rev,
    recovery_etag:etag,recovery_count:count,recovery_checked_at_ms:now,
    recovery_restart_count:0});return changes(1);
  }
  if(sql.includes('SET generation=recovery_generation')){
   const [now,u,oldGen,oldRev,oldEtag,newGen,newRev,newEtag,count]=a;
   if(u!==uid||meta.generation!==oldGen||meta.indexed_revision!==oldRev
    ||meta.head_etag!==oldEtag||meta.recovery_generation!==newGen
    ||meta.recovery_revision!==newRev||meta.recovery_etag!==newEtag
    ||meta.recovery_count!==count)return changes(0);
   Object.assign(meta,{generation:newGen,indexed_revision:newRev,
    head_etag:newEtag,expected_count:count,recovery_generation:null,
    recovery_revision:null,recovery_etag:null,recovery_count:null,
    status:'ready',checked_at_ms:now});return changes(1);
  }
  throw Error('bad UPDATE '+sql);
 };
 const db={
  prepare(sql){return {bind(...args){return {sql,args,
   async run(){calls++;return write(sql,args);},
   async first(){calls++;return read(sql,args);},
  };}};},
  async batch(items){
   calls++;
   if(failBatch){failBatch=false;throw Error('injected D1 outage');}
   return items.map(item=>write(item.sql,item.args));
  },
 };
 return {db,members,cursors,get meta(){return meta;},
  markOutage(){failBatch=true;},resetCalls(){maxCalls=Math.max(maxCalls,calls);calls=0;},
  calls:()=>calls,maxCalls:()=>Math.max(maxCalls,calls),set};
};
// Local-only budget attestation; the production bridge is OFF without a
// verified shared account ledger and a complete old/new writer inventory.
const mockBudget=async({requestedRows})=>{
 assert.equal(requestedRows,1040);
 return {code:'RESERVED',reserved:true,guaranteedRows:requestedRows};
};
async function runComplete(count,config={}){
 const f=mkFixture(count,config),store=mockDb({recovery:config.recovery});
 let rounds=0,paged=0;
 do{
  store.resetCalls();
  const r=await advancePagedOwnerIndex518({
   db:store.db,uid,mode:config.recovery?'recovery':'first',
   verifiedPendingMutation:true,nowMs:100000+rounds*10000,
   readOwnerHead:f.state,baseReader:f.reader,projectItem:item=>item,
   reserveWriteBudget:mockBudget,
  });
  assert.ok(store.calls()<=50,'Free D1 invocation budget');
  assert.ok(!r.code.startsWith('DENY_')&&!r.code.startsWith('HOLD_'),r.code);
  if(r.code==='PAGING_IN_PROGRESS')paged++;
  if(r.complete){assert.equal(r.code,config.recovery?'RECOVERY_PROMOTED':'INDEX_READY');break;}
  assert.ok(++rounds<100,'no endless progress');
 }while(true);
 if(count>1024)assert.ok(paged>0,'large owner needs multiple invocations');
 assert.equal(store.meta.status,'ready');
 assert.equal(store.meta.expected_count,count);
 assert.equal(store.set(uid,f.root.headRevision).size,count);
 if(config.delta){
  assert.ok(!store.set(uid,f.root.headRevision).has('song-0'));
  assert.ok(store.set(uid,f.root.headRevision).has('added'));
 }
 if(config.recovery){
  assert.ok(store.set(uid,90).has('song-0')===false,'old READY fake does not get overwritten');
  assert.equal(store.meta.recovery_generation,null);
 }
 assert.equal(f.counters().fullReads,0);
 assert.equal(f.counters().puts,0);
 assert.ok(f.counters().rangeReads>0);
 const repeat=await advancePagedOwnerIndex518({
  db:store.db,uid,mode:config.recovery?'first':'first',
  verifiedPendingMutation:true,nowMs:900000,
  readOwnerHead:f.state,baseReader:f.reader,projectItem:item=>item,
   reserveWriteBudget:mockBudget,
 });
 assert.equal(repeat.code,'READY_REQUIRES_HEAD_CAS');
 return {rounds,store,f};
}
const small=await runComplete(301,{delta:true});
assert.ok(small.store.maxCalls()<=50);
const large=await runComplete(20001);
assert.ok(large.store.maxCalls()<=50);
const huge=await runComplete(50001,{baseRevision:120,recovery:true});
assert.ok(huge.store.maxCalls()<=50);
// A failed D1 page remains invisible. Rerun must continue at the stored
// exact cursor, preserving inserts and avoiding duplicate row changes.
const interrupted=mkFixture(20001),db=mockDb();
let first=await advancePagedOwnerIndex518({
 db:db.db,uid,mode:'first',verifiedPendingMutation:true,nowMs:100,
 readOwnerHead:interrupted.state,baseReader:interrupted.reader,projectItem:x=>x,
 reserveWriteBudget:mockBudget,
});
assert.equal(first.code,'PAGING_IN_PROGRESS');
db.markOutage();
let fail=await advancePagedOwnerIndex518({
 db:db.db,uid,mode:'first',verifiedPendingMutation:true,nowMs:200,
 readOwnerHead:interrupted.state,baseReader:interrupted.reader,projectItem:x=>x,
 reserveWriteBudget:mockBudget,
});
assert.equal(fail.code,'RETRYABLE_PAGED_IO');
assert.equal(db.meta.status,'building');
const countBefore=db.set(uid,100).size;
first=await advancePagedOwnerIndex518({
 db:db.db,uid,mode:'first',verifiedPendingMutation:true,nowMs:300,
 readOwnerHead:interrupted.state,baseReader:interrupted.reader,projectItem:x=>x,
 reserveWriteBudget:mockBudget,
});
assert.equal(first.code,'PAGING_IN_PROGRESS');
assert.ok(db.set(uid,100).size>countBefore);
interrupted.swapBase();
const altered=await advancePagedOwnerIndex518({
 db:db.db,uid,mode:'first',verifiedPendingMutation:true,nowMs:400,
 readOwnerHead:interrupted.state,baseReader:interrupted.reader,projectItem:x=>x,
 reserveWriteBudget:mockBudget,
});
assert.equal(altered.code,'HOLD_PAGED_PROGRESS_CONTRACT');
assert.equal(db.meta.status,'building');
// Only a durable cursor continuation can schedule the next outbox tick;
// it never increments ordinary network failure attempt_count.
let deferralSQL='';
const deferred=await deferPagedFavorite518({
 db:{prepare(sql){deferralSQL=sql;return {bind(...args){return {
  async run(){assert.equal(args.length,6);return {meta:{changes:1}};}
 };}};}},
 uid,documentId:'song-0',sourceVersionNs:'001793152800000000001',nowMs:5000,
});
assert.equal(deferred.code,'PAGE_CONTINUATION_SCHEDULED');
assert.ok(!deferralSQL.includes('attempt_count=attempt_count+1'));
console.log('APP518_20001_50001_R2_BYTE_RANGE_MEMORY_BOUNDED=PASS');
console.log('APP518_FREE_D1_LE50_CALLS_PER_INVOCATION=PASS');
console.log('APP518_DURABLE_CURSOR_20K_PLUS_MULTIPLE_INVOCATIONS=PASS');
console.log('APP518_LARGE_RECOVERY_OLD_READY_REMAINS_PROTECTED=PASS');
console.log('APP518_JOURNAL_DELTA_DELETED_SONG_DOES_NOT_RESURRECT=PASS');
console.log('APP518_CRASH_RESUME_AND_BASE_ETAG_CHANGE_FAIL_CLOSED=PASS');
console.log('APP518_PAGING_DOES_NOT_EXHAUST_FAILURE_RETRY_BUDGET=PASS');
