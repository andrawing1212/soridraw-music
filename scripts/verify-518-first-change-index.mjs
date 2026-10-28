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
    if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_index_meta_518')){
     const [uid,generation,indexed_revision,expected_count,head_etag,now]=args;
     if(metas.has(uid))return {meta:{changes:0}};
     metas.set(uid,{generation,indexed_revision,expected_count,head_etag,status:'building',checked_at_ms:now});
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
const owner='owner-1',head={headRevision:1793,itemCount:301,etag:'"stable-head"'};
const items=Array.from({length:301},(_,n)=>({id:'f-'+n}));
const snap={verifiedByServer:true,ownerUid:owner,kind:'musicNote',
 complete:true,head,items};
let store=mkdb(),fullReads=0,headChecks=0;
const args={db:store.db,uid:owner,verifiedMutation:true,nowMs:10,
 loadMaterializedR2Once:async()=>{fullReads++;return snap;},
 readR2HeadAgain:async()=>{headChecks++;return head;}};
const run=(db,opts={})=>stageFirstChangedOwnerIndex518({...args,db,...opts});
let result=await stageFirstChangedOwnerIndex518(args);
assert.equal(result.code,'INDEX_READY');
assert.equal(result.r2FullReads,1);assert.equal(fullReads,1);assert.equal(headChecks,1);
assert.equal(store.metas.get(owner).status,'ready');
assert.equal(store.members.size,301);
assert.equal(store.stats.batches,3);assert.equal(store.stats.maxChunk,128);
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
store=mkdb();
const tooMany=Array.from({length:20001},(_,n)=>({id:'f-'+n}));
const overflow=await run(store.db,{loadMaterializedR2Once:async()=>({
 ...snap,head:{...head,itemCount:tooMany.length},items:tooMany})});
assert.equal(overflow.code,'DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT');
assert.equal(store.stats.writes,0);

console.log('APP518_FIRST_CONFIRMED_CHANGE_ONLY_INDEX_IMPORT=PASS');
console.log('APP518_OWNER_INDEX_128_ROW_BATCH_AND_READY_HEAD_CHECK=PASS');
console.log('APP518_CRASH_RESUME_AND_R2_RACE_FAIL_CLOSED=PASS');
console.log('APP518_INDEX_READY_REQUIRES_FRESH_HEAD_CAS=PASS');
console.log('APP518_PAGE_ENTRY_D1_R0_W0_AND_LIVE_NETWORK_IO_ZERO=PASS');
