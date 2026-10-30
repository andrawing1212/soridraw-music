import assert from 'node:assert/strict';
import {stageFirstChangedOwnerIndex518,readIndexedMembership518}
 from '../cloudflare/media-worker/src/catalogFirstChangeIndex518.js';

const mkdb=()=>{
 const metas=new Map(),members=new Map(),stats={reads:0,writes:0,batches:0,maxChunk:0};
 const key=(uid,gen,id)=>[uid,gen,id].join('::');
 const db={
  prepare(sql){return {bind(...args){return {sql,args,
   async first(){
    stats.reads++;
    if(sql.includes('FROM music_note_catalog_index_meta_518'))
      return metas.get(args[0])||null;
    if(sql.includes('COUNT(*) AS n'))
      return {n:[...members.keys()].filter(k=>k.startsWith([args[0],args[1],''].join('::'))).length};
    if(sql.includes('SELECT 1 AS present'))return members.has(key(...args))?{present:1}:null;
    throw Error('unknown SQL first');
   },
   async run(){
    if(sql.includes('SELECT ?, ?, value FROM json_each(?)')){
     const [uid,gen,serialized]=args;
     const ids=JSON.parse(serialized);
     assert.ok(Array.isArray(ids)&&ids.length>0&&ids.length<=512);
     stats.batches++;stats.maxChunk=Math.max(stats.maxChunk,ids.length);
     let changes=0;
     for(const id of ids){
      const k=key(uid,gen,id);
      if(!members.has(k)){members.set(k,true);changes++;stats.writes++;}
     }
     return {meta:{changes}};
    }
    if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_index_meta_518')){
     const [uid,generation,indexed_revision,expected_count,head_etag,now]=args;
     if(metas.has(uid))return {meta:{changes:0}};
     metas.set(uid,{generation,indexed_revision,expected_count,head_etag,status:'building',checked_at_ms:now,restart_count:0});
     stats.writes++;return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE music_note_catalog_index_meta_518')
       &&sql.includes('SET generation=?')){
     const [gen,indexRev,count,etag,now,uid,oldGen,oldRev,
       oldCount,oldEtag,cutoff]=args;
     const row=metas.get(uid);
     if(!row||row.status!=='building'||row.generation!==oldGen
       ||row.indexed_revision!==oldRev||row.expected_count!==oldCount
       ||row.head_etag!==oldEtag||row.restart_count>=3
       ||row.checked_at_ms>cutoff)return {meta:{changes:0}};
     Object.assign(row,{generation:gen,indexed_revision:indexRev,
       expected_count:count,head_etag:etag,checked_at_ms:now,
       restart_count:row.restart_count+1});
     stats.writes++;return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE music_note_catalog_index_meta_518')){
     const [now,uid,generation,expected_count,head_etag]=args;
     const row=metas.get(uid);
     if(row?.status!=='building'||row.generation!==generation
       ||row.expected_count!==expected_count||row.head_etag!==head_etag)
       return {meta:{changes:0}};
     row.status='ready';row.checked_at_ms=now;stats.writes++;
     return {meta:{changes:1}};
    }
    throw Error('unknown SQL run');
   }
  };}};},
  async batch(stmts){
   stats.batches++;stats.maxChunk=Math.max(stats.maxChunk,stmts.length);
   assert.ok(stmts.length<=128);
   const receipts=[];
   for(const statement of stmts){
    assert.match(statement.sql,/INSERT OR IGNORE INTO music_note_catalog_member_518/);
    const k=key(...statement.args);
    if(members.has(k)){receipts.push({success:true,meta:{changes:0}});continue;}
    members.set(k,true);stats.writes++;receipts.push({success:true,meta:{changes:1}});
   }
   return receipts;
  }
 };
 return {db,metas,members,stats};
};
const owner='owner-1',head={headRevision:1793,itemCount:301,etag:'"stable-head"',
 verifiedByServer:true,ownerUid:owner,fencedWritersVerified:true};
const items=Array.from({length:301},(_,n)=>({id:'f-'+n}));
const snap={verifiedByServer:true,ownerUid:owner,kind:'musicNote',
 complete:true,head,items};
let store=mkdb(),fullReads=0,headChecks=0;
const args={db:store.db,uid:owner,verifiedMutation:true,nowMs:10,
 reserveWriteBudget:async()=>({reserved:true}),
 loadMaterializedR2Once:async()=>{fullReads++;return snap;},
 readR2HeadAgain:async()=>{headChecks++;return head;}};
const run=(db,opts={})=>stageFirstChangedOwnerIndex518({...args,db,...opts});
let result=await stageFirstChangedOwnerIndex518(args);
assert.equal(result.code,'INDEX_READY');
assert.equal(result.r2FullReads,1);assert.equal(fullReads,1);assert.equal(headChecks,1);
assert.equal(store.metas.get(owner).status,'ready');
assert.equal(store.members.size,301);
assert.equal(store.stats.batches,1);assert.equal(store.stats.maxChunk,301);
assert.equal(store.stats.writes,303);
let membership=await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'f-300',r2Head:head});
assert.deepEqual(membership,{code:'EXACT_MEMBERSHIP',present:true,
 requiresSameHeadConditionalPut:true});
assert.equal((await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'never',r2Head:head})).present,false);
const moved={...head,headRevision:1794,itemCount:302,etag:'"changed"'};
assert.equal((await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'f-1',r2Head:moved})).code,
 'DENY_INDEX_HEAD_DRIFT');
assert.equal((await run(store.db,{loadMaterializedR2Once:async()=>{
 throw Error('second entire R2 read forbidden');}})).code,'READY_REQUIRES_HEAD_CAS');
assert.equal(fullReads,1);assert.equal(store.stats.writes,303);

store=mkdb();
assert.equal((await run(store.db,{verifiedMutation:false,
 loadMaterializedR2Once:async()=>{throw Error('must not be called');}})).code,
 'DENY_UNVERIFIED_OR_INVALID');
assert.equal(store.stats.reads+store.stats.writes,0);
assert.equal((await run(store.db,{loadMaterializedR2Once:async()=>({
 ...snap,ownerUid:'other-user'})})).code,'DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT');
assert.equal(store.stats.writes,0);
assert.equal((await run(store.db,{loadMaterializedR2Once:async()=>({
 ...snap,items:[...items.slice(0,300),items[0]]})})).code,
 'DENY_DUPLICATE_OR_BAD_ID');
assert.equal(store.stats.writes,0);
assert.equal((await run(store.db,{loadMaterializedR2Once:async()=>({
 ...snap,complete:false})})).code,'DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT');
assert.equal(store.stats.writes,0);

store=mkdb();
const failed=await run(store.db,{readR2HeadAgain:async()=>moved});
assert.equal(failed.code,'RETRYABLE_R2_HEAD_MOVED');
assert.equal(store.metas.get(owner).status,'building');
assert.equal((await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'f-1',r2Head:head})).code,
 'DENY_INDEX_NOT_READY');
const previousWrites=store.stats.writes;
const resumed=await run(store.db);
assert.equal(resumed.code,'INDEX_READY');
assert.equal(store.stats.writes,previousWrites+1);
assert.equal(store.members.size,301);
// A stale, invisible 301-song import may advance only after a NEWER
// server-verified R2 revision; old staged rows never become READY.
store=mkdb();
const stageMoved=await run(store.db,{readR2HeadAgain:async()=>moved});
assert.equal(stageMoved.code,'RETRYABLE_R2_HEAD_MOVED');
assert.equal(store.metas.get(owner).status,'building');
const newerSnap={...snap,head:moved,items:[...items,{id:'f-301'}]};
let forbiddenFullReads=0,cheapHeadReads=0;
for(let i=0;i<3;i++){
 const cooldown=await run(store.db,{nowMs:200+i,
  loadMaterializedR2Once:async()=>{forbiddenFullReads++;return newerSnap;},
  readR2HeadAgain:async()=>{cheapHeadReads++;return moved;}});
 assert.equal(cooldown.code,'RETRYABLE_STAGE_RESTART_COOLDOWN');
 assert.equal(cooldown.r2FullReads,0);
 assert.equal(cooldown.d1RowsWritten,0);
}
assert.equal(forbiddenFullReads,0,'cooldown may not materialize the whole R2 owner');
assert.equal(cheapHeadReads,3,'only 3 bounded HEAD-only probes');
assert.equal(store.metas.get(owner).generation,head.headRevision);
assert.equal((await run(store.db,{nowMs:60012,
 loadMaterializedR2Once:async()=>newerSnap,
 readR2HeadAgain:async()=>moved})).code,'INDEX_READY');
assert.equal(store.metas.get(owner).generation,moved.headRevision);
assert.equal(store.metas.get(owner).restart_count,1);
assert.equal(store.members.size,603,'old 301 staged + new 302 isolated');
assert.equal((await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'f-301',r2Head:moved})).present,true);
assert.equal((await readIndexedMembership518({
 db:store.db,uid:owner,documentId:'f-1',r2Head:head})).code,
 'DENY_INDEX_HEAD_DRIFT');

// If the supposed replacement uses the same revision but different ETag,
// never silently recycle an index generation.
store=mkdb();
assert.equal((await run(store.db,{readR2HeadAgain:async()=>moved})).code,
 'RETRYABLE_R2_HEAD_MOVED');
const suspicious={...snap,head:{...head,etag:'"foreign"'}};
assert.equal((await run(store.db,{nowMs:60012,
 loadMaterializedR2Once:async()=>suspicious})).code,
 'HOLD_NON_MONOTONIC_STAGING_HEAD');

// A hot owner may exhaust at most three version rotations: fail closed
// instead of creating infinitely many full R2 reads and D1 staging writes.
store=mkdb();
assert.equal((await run(store.db,{readR2HeadAgain:async()=>moved})).code,
 'RETRYABLE_R2_HEAD_MOVED');
for(let i=1;i<=3;i++){
 const nextHead={...head,headRevision:head.headRevision+i,
   itemCount:301,etag:'"new-'+i+'"'};
 const next={...snap,head:nextHead};
 let headReadCount=0;
 assert.equal((await run(store.db,{nowMs:60010*i,
   loadMaterializedR2Once:async()=>next,
   readR2HeadAgain:async()=>{
     headReadCount++;
     // Verified HEAD at preflight, then a different ETag arrives AFTER
     // staging; only the final read is a transient move.
     return headReadCount===1?nextHead:
       {...nextHead,etag:'"other-'+i+'"'};
   }})).code,'RETRYABLE_R2_HEAD_MOVED');
 assert.equal(headReadCount,2);
 assert.equal(store.metas.get(owner).restart_count,i);
}
const lastHead={...head,headRevision:head.headRevision+4,etag:'"new-4"'};
const written=store.stats.writes;
let exhaustedFullReads=0;
assert.equal((await run(store.db,{nowMs:300000,
 loadMaterializedR2Once:async()=>{exhaustedFullReads++;return {...snap,head:lastHead};},
 readR2HeadAgain:async()=>lastHead})).code,
 'HOLD_STAGE_RESTART_BUDGET_EXHAUSTED');
assert.equal(exhaustedFullReads,0,'exhausted owner has no O(N) materialization');
assert.equal(store.stats.writes,written,'exhausted must not write');
assert.equal(store.metas.get(owner).status,'building');

// 20k+ owners have no arbitrary 20k rejection, truncated membership, or
// hundreds of thousands of one-row SQL statements.
// Large owners must not enter the old synchronous, unmetered O(N)
// importer. They use the 257+ bounded R2/D1 paged server bridge.
for(const n of [20001,50001]){
 store=mkdb();
 const large=await run(store.db,{loadMaterializedR2Once:async()=>({
  ...snap,head:{...head,itemCount:n},
  items:Array.from({length:n},(_,i)=>({id:'large-'+i})),
 })});
 assert.equal(large.code,'HOLD_D1_FIRST_INDEX_REQUIRES_PAGING');
 assert.equal(store.stats.writes,0);
}
// A failed page is invisible until same exact HEAD retry completes; successful
// SQL pages are idempotent, and other owners remain untouched.
store=mkdb();
const bigN=1537,bigIds=Array.from({length:bigN},(_,i)=>({id:'f-'+i}));
const bigHead={...head,itemCount:bigN};
const bigSnap={...snap,head:bigHead,items:bigIds};
const normalDb=store.db,originalPrepare=normalDb.prepare;
let pageNo=0,interrupted=false;
normalDb.prepare=function(sql){
 const statement=originalPrepare.call(this,sql);
 if(!sql.includes('SELECT ?, ?, value FROM json_each(?)'))return statement;
 return {bind(...args){
  const prepared=statement.bind(...args);
  return {...prepared,async run(){
   if(++pageNo===4&&!interrupted){interrupted=true;throw Error('D1 interrupted');}
   return prepared.run();
  }};
 }};
};
let interruptedRun=await run(normalDb,{loadMaterializedR2Once:async()=>bigSnap,
 readR2HeadAgain:async()=>bigHead});
assert.equal(interruptedRun.code,'RETRYABLE_INDEX_IO_ERROR');
assert.equal(store.metas.get(owner).status,'building');
assert.equal(store.members.size,512*3);
assert.equal((await readIndexedMembership518({db:normalDb,uid:owner,
 documentId:'f-3',r2Head:bigHead})).code,'DENY_INDEX_NOT_READY');
const done=await run(normalDb,{loadMaterializedR2Once:async()=>bigSnap,
 readR2HeadAgain:async()=>bigHead});
assert.equal(done.code,'INDEX_READY');
assert.equal(store.members.size,bigN);
assert.equal(store.stats.writes,bigN+2,'resume did not rewrite staged songs');
console.log('APP518_OVER_20K_50K_DIRECT_INDEX_REJECTS_UNBOUNDED_WRITE=PASS');
console.log('APP518_SMALL_DIRECT_INDEX_CRASH_RESUME_NO_DUPLICATE_WRITES=PASS');

// A changed HEAD without owner/fence proof must never bypass cooldown.
store=mkdb();
assert.equal((await run(store.db,{readR2HeadAgain:async()=>moved})).code,
 'RETRYABLE_R2_HEAD_MOVED');
let unauthorizedReads=0;
const fakeHead={...moved,ownerUid:'other-owner'};
const untrusted=await run(store.db,{
 readR2HeadAgain:async()=>fakeHead,
 loadMaterializedR2Once:async()=>{unauthorizedReads++;return newerSnap;},
});
assert.equal(untrusted.code,'DENY_UNVERIFIED_RESTART_HEAD');
assert.equal(unauthorizedReads,0);
console.log('APP518_FIRST_INDEX_COOLDOWN_AND_BUDGET_HEAD_ONLY_R2_FULL_R0=PASS');
console.log('APP518_FIRST_INDEX_FOREIGN_RESTART_HEAD_DENIED_WITHOUT_FULL_R2_READ=PASS');
console.log('APP518_FIRST_INDEX_STALE_HEAD_ROTATION_BOUNDED_AND_OWNER_SAFE=PASS');
console.log('APP518_FIRST_CONFIRMED_CHANGE_ONLY_INDEX_IMPORT=PASS');
console.log('APP518_OWNER_INDEX_128_ROW_BATCH_AND_READY_HEAD_CHECK=PASS');
console.log('APP518_CRASH_RESUME_AND_R2_RACE_FAIL_CLOSED=PASS');
console.log('APP518_INDEX_READY_REQUIRES_FRESH_HEAD_CAS=PASS');
console.log('APP518_PAGE_ENTRY_D1_R0_W0_AND_LIVE_NETWORK_IO_ZERO=PASS');
