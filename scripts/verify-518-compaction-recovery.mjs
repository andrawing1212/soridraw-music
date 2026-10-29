import assert from 'node:assert/strict';
import {CatalogR2ContractError518} from '../cloudflare/media-worker/src/catalogR2Provider518.js';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {recoverCompactedOwnerIndex518}
 from '../cloudflare/media-worker/src/catalogCompactionRecovery518.js';
const uid='owner',oldGen=90,oldRevision=100;
const head={...createEmptyCatalogJournal({
 kind:'musicNote',baseKey:'compacted-base',baseRevision:109,itemCount:301,now:5000,
}),canonicalAuthority518:true};
const etag='"compacted-new"';
const ids=Array.from({length:301},(_,i)=>'song-'+i);
const snap={uid,ownerUid:uid,verifiedByServer:true,fencedWritersVerified:true,
 kind:'musicNote',complete:true,head,etag,items:ids.map(id=>({id}))};
function make(){
 const meta={generation:oldGen,indexed_revision:oldRevision,expected_count:1,
  head_etag:'"old"',status:'ready',recovery_generation:null,
  recovery_revision:null,recovery_etag:null,recovery_count:null,
  recovery_restart_count:0,recovery_checked_at_ms:null};
 const members=new Map([[oldGen,new Set(['old-song'])]]);
 let reads=0,writes=0,batches=0,failStage=false;
 const db={
  prepare(sql){return {bind(...args){return {sql,args,
   async first(){
    reads++;
    if(sql.includes('FROM music_note_catalog_index_meta_518'))return {...meta};
    if(sql.includes('COUNT(*) AS n'))return {n:members.get(args[1])?.size||0};
    throw Error('unknown read '+sql);
   },
   async run(){
    if(sql.includes('SELECT ?, ?, value FROM json_each(?)')){
     if(failStage){failStage=false;throw Error('crash');}
     const [owner,gen,serialized]=args;assert.equal(owner,uid);
     const ids=JSON.parse(serialized);
     assert.ok(ids.length>0&&ids.length<=512);
     batches++;
     let set=members.get(gen);if(!set){set=new Set();members.set(gen,set);}
     let changes=0;
     for(const id of ids)if(!set.has(id)){set.add(id);writes++;changes++;}
     return {meta:{changes}};
    }
    if(sql.startsWith('UPDATE music_note_catalog_index_meta_518 SET recovery_generation')
       &&!sql.includes('recovery_restart_count=recovery_restart_count+1')){
     const [gen,rev,targetEtag,count,now,owner,oldGeneration,oldRev,oldEtag]=args;
     if(owner!==uid||oldGeneration!==meta.generation
      ||oldRev!==meta.indexed_revision||oldEtag!==meta.head_etag
      ||meta.recovery_generation!=null)return {meta:{changes:0}};
     Object.assign(meta,{recovery_generation:gen,recovery_revision:rev,
      recovery_etag:targetEtag,recovery_count:count,
      recovery_restart_count:0,recovery_checked_at_ms:now});writes++;
     return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE music_note_catalog_index_meta_518 SET recovery_generation')
       &&sql.includes('recovery_restart_count=recovery_restart_count+1')){
     const [gen,rev,targetEtag,count,now,owner,oldGen,oldRev,oldEtag,
       curGen,curRev,curEtag,curCount,deadline]=args;
     if(owner!==uid||meta.generation!==oldGen
       ||meta.indexed_revision!==oldRev||meta.head_etag!==oldEtag
       ||meta.recovery_generation!==curGen||meta.recovery_revision!==curRev
       ||meta.recovery_etag!==curEtag||meta.recovery_count!==curCount
       ||meta.recovery_restart_count>=3||meta.recovery_checked_at_ms>deadline)
       return {meta:{changes:0}};
     Object.assign(meta,{recovery_generation:gen,recovery_revision:rev,
       recovery_etag:targetEtag,recovery_count:count,
       recovery_checked_at_ms:now,
       recovery_restart_count:meta.recovery_restart_count+1});
     writes++;return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE music_note_catalog_index_meta_518 SET generation=recovery_generation')){
     const [now,owner,gen,rev,oldEtag,newGen,newRev,newEtag,newCount]=args;
     if(owner!==uid||gen!==meta.generation||rev!==meta.indexed_revision
      ||oldEtag!==meta.head_etag||newGen!==meta.recovery_generation
      ||newRev!==meta.recovery_revision||newEtag!==meta.recovery_etag
      ||newCount!==meta.recovery_count)return {meta:{changes:0}};
     meta.generation=newGen;meta.indexed_revision=newRev;
     meta.head_etag=newEtag;meta.expected_count=newCount;
     meta.recovery_generation=meta.recovery_revision=
      meta.recovery_etag=meta.recovery_count=null;
     meta.recovery_restart_count=0;meta.recovery_checked_at_ms=null;
     writes++;return {meta:{changes:1}};
    }
    throw Error('unknown write '+sql);
   },
  };}};},
  async batch(commands){
   batches++;
   if(failStage){failStage=false;throw Error('crash');}
   assert.ok(commands.length<=128);
   const out=[];
   for(const {sql,args} of commands){
    assert.match(sql,/INSERT OR IGNORE INTO music_note_catalog_member_518/);
    const [owner,gen,id]=args;assert.equal(owner,uid);
    let set=members.get(gen);if(!set){set=new Set();members.set(gen,set);}
    const newItem=!set.has(id);set.add(id);
    if(newItem)writes++;
    out.push({success:true,meta:{changes:newItem?1:0}});
   }
   return out;
  }
 };
 const run=(more={})=>recoverCompactedOwnerIndex518({
  db,uid,verifiedPendingMutation:true,
  loadCompleteFencedOwnerR2:async()=>snap,
  readR2HeadAgain:async()=>({
   verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,head,etag,
  }),nowMs:6000,...more,
 });
 return {db,meta,members,run,counters:()=>({reads,writes,batches}),
  failOnce:()=>{failStage=true}};
}
let t=make();
let r=await t.run();
assert.equal(r.code,'RECOVERY_PROMOTED');assert.equal(r.memberCount,301);
assert.equal(r.fullReads,1);
assert.equal(t.meta.generation,head.headRevision);
assert.equal(t.meta.indexed_revision,head.headRevision);
assert.equal(t.meta.head_etag,etag);
assert.equal(t.members.get(head.headRevision).size,301);
assert.deepEqual([...t.members.get(oldGen)],['old-song'],'old generation preserved');
assert.equal(t.counters().writes,303,'N member writes + claim + promotion');
assert.equal(t.counters().batches,1);
const before=t.counters().writes;
assert.equal((await t.run()).code,'DENY_NOT_A_COMPACTION_GAP');
assert.equal(t.counters().writes,before,'repeating recovery must be W0');

// A D1 limit after the R2 compaction snapshot was read must preserve
// the quota code so delivery can defer the exact source to tomorrow UTC.
t=make();
const originalPrepare=t.db.prepare.bind(t.db);
const exceeded=Object.assign(new Error('DAILY_QUOTA'),{code:'HOLD_D1_DAILY_QUOTA'});
r=await t.run({db:{...t.db,prepare(sql){
 if(sql.includes('SELECT ?, ?, value FROM json_each(?)'))
  return {bind(){return {run:async()=>{throw exceeded;}}}};
 return originalPrepare(sql);
}}});
assert.equal(r.code,'HOLD_D1_DAILY_QUOTA');
assert.equal(t.meta.generation,oldGen,'old READY index remains untouched');
console.log('APP518_COMPACTION_RECOVERY_DAILY_QUOTA_PRESERVED=PASS');
t=make();t.failOnce();
assert.equal((await t.run()).code,'RETRYABLE_RECOVERY_IO');
assert.equal(t.meta.generation,oldGen,'old ready still visible');
assert.ok(t.meta.recovery_generation!==null);
r=await t.run();assert.equal(r.code,'RECOVERY_PROMOTED');
assert.equal(t.counters().writes,303,'crash resume only writes missing rows');

t=make();
r=await t.run({readR2HeadAgain:async()=>({
 verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
 head:{...head,headRevision:110},etag:'"moved"',
})});
assert.equal(r.code,'HOLD_RECOVERY_HEAD_MOVED');
assert.equal(t.meta.generation,oldGen);
const makeMoved=(revision)=>({
 ...snap,head:{...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:'compacted-base-v'+revision,
  baseRevision:revision,itemCount:301,now:5000+revision,
 }),canonicalAuthority518:true},
 etag:'"head-'+revision+'"',
});
const movedSnap=makeMoved(head.headRevision+1);
const movedProbe=async()=>({
 verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
 head:movedSnap.head,etag:movedSnap.etag,
});
let fullRead=0;
r=await t.run({nowMs:6010,
 readR2HeadAgain:movedProbe,
 loadCompleteFencedOwnerR2:async()=>{fullRead++;return movedSnap;}});
assert.equal(r.code,'RETRYABLE_RECOVERY_RESTART_COOLDOWN');
assert.equal(fullRead,0,'HEAD-only cooldown prevents full R2 read');
assert.equal(t.meta.generation,oldGen);
r=await t.run({nowMs:66001,
 readR2HeadAgain:movedProbe,
 loadCompleteFencedOwnerR2:async()=>movedSnap});
assert.equal(r.code,'RECOVERY_PROMOTED');
assert.equal(r.memberCount,301);
assert.equal(t.meta.generation,movedSnap.head.headRevision);
assert.equal(t.meta.recovery_generation,null);
assert.equal(t.members.get(oldGen).has('old-song'),true);
assert.equal(t.members.get(head.headRevision).size,301,
 'abandoned stage is preserved but invisible');
assert.equal(t.members.get(movedSnap.head.headRevision).size,301);

t=make();
const wrongHead={...makeMoved(head.headRevision),etag:'"tampered-same-rev"'};
assert.equal((await t.run({readR2HeadAgain:async()=>({
 verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
 head:{...head,headRevision:head.headRevision+1},etag:'"moved"',
})})).code,'HOLD_RECOVERY_HEAD_MOVED');
fullRead=0;
r=await t.run({nowMs:66001,
 readR2HeadAgain:async()=>({verifiedByServer:true,ownerUid:uid,
 fencedWritersVerified:true,head:wrongHead.head,etag:wrongHead.etag}),
 loadCompleteFencedOwnerR2:async()=>{fullRead++;return wrongHead;}});
assert.equal(r.code,'HOLD_NON_MONOTONIC_RECOVERY_HEAD');
assert.equal(fullRead,0,'untrusted same revision costs no R2 materialization');

t=make();
r=await t.run({readR2HeadAgain:async()=>({verifiedByServer:true,
 ownerUid:uid,fencedWritersVerified:true,head:{...head,headRevision:head.headRevision+1},
 etag:'"moved"'})});
assert.equal(r.code,'HOLD_RECOVERY_HEAD_MOVED');
for(let i=1;i<=3;i++){
 const next=makeMoved(head.headRevision+i);
 let checkCount=0;
 r=await t.run({nowMs:6000+60001*i,
   readR2HeadAgain:async()=>{
     checkCount++;
     return {verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
       head:checkCount===1?next.head:{...next.head,headRevision:next.head.headRevision+1},
       etag:checkCount===1?next.etag:'"moved-after-stage"'};
   },
   loadCompleteFencedOwnerR2:async()=>next});
 assert.equal(r.code,'HOLD_RECOVERY_HEAD_MOVED');
 assert.equal(t.meta.recovery_restart_count,i);
 assert.equal(t.meta.generation,oldGen,'never touch existing READY');
}
const totalWrites=t.counters().writes;
fullRead=0;
const extra=makeMoved(head.headRevision+4);
r=await t.run({nowMs:300010,
 readR2HeadAgain:async()=>({verifiedByServer:true,ownerUid:uid,
  fencedWritersVerified:true,head:extra.head,etag:extra.etag}),
 loadCompleteFencedOwnerR2:async()=>{fullRead++;return extra;}});
assert.equal(r.code,'HOLD_RECOVERY_RESTART_BUDGET_EXHAUSTED');
assert.equal(fullRead,0);
assert.equal(t.counters().writes,totalWrites);

t=make();
assert.equal((await t.run({verifiedPendingMutation:false})).code,'DENY_UNVERIFIED_OR_INVALID');
assert.equal(t.counters().reads+t.counters().writes,0);
t=make();
assert.equal((await t.run({loadCompleteFencedOwnerR2:async()=>({
 ...snap,ownerUid:'wrong-owner'
})})).code,'DENY_UNTRUSTED_OR_UNBOUNDED_SNAPSHOT');
assert.equal(t.counters().writes,0);
t=make();
assert.equal((await t.run({loadCompleteFencedOwnerR2:async()=>({
 ...snap,items:[...snap.items.slice(0,300),snap.items[0]]
})})).code,'DENY_BAD_OR_DUPLICATE_ID');
assert.equal(t.counters().writes,0);
// Work P2: a foreign-owner BASE during READY compaction is a permanent
// source contract failure, never a generic IO retry. Temporary R2 stream
// errors remain retryable without modifying visible READY membership.
t=make();
r=await t.run({loadCompleteFencedOwnerR2:async()=>{
 throw new CatalogR2ContractError518('APP518_MISSING_OR_FOREIGN_BASE');
}});
assert.equal(r.code,'DENY_RECOVERY_R2_CONTRACT');
assert.equal(r.d1Writes,0);assert.equal(t.counters().writes,0);
assert.equal(t.meta.generation,oldGen);
assert.equal(t.meta.recovery_generation,null);
t=make();
r=await t.run({loadCompleteFencedOwnerR2:async()=>{
 throw new Error('TEMP_R2_BASE_STREAM_FAILURE');
}});
assert.equal(r.code,'RETRYABLE_RECOVERY_IO');
assert.equal(r.d1Writes,0);assert.equal(t.counters().writes,0);
assert.equal(t.meta.generation,oldGen);
// Recovery at 20,001+ never trims songs or rebuilds the visible old READY
// generation; count equality and HEAD proof still gate the final swap.
for(const n of [20001,50001]){
 t=make();
 const largeItems=Array.from({length:n},(_,i)=>({id:'large-'+i}));
 const largeHead={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:'owner-large-base',baseRevision:109,
  itemCount:n,now:5000,
 }),canonicalAuthority518:true};
 const largeSnapshot={...snap,head:largeHead,etag:'"large-owner"',
  items:largeItems};
 r=await t.run({
  loadCompleteFencedOwnerR2:async()=>largeSnapshot,
  readR2HeadAgain:async()=>({
   verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
   head:largeHead,etag:largeSnapshot.etag,
  }),
 });
 assert.equal(r.code,'RECOVERY_PROMOTED');
 assert.equal(r.memberCount,n);
 assert.equal(t.members.get(largeHead.headRevision).size,n);
 assert.equal(t.members.get(oldGen).has('old-song'),true);
 assert.equal(t.counters().writes,n+2);
 assert.equal(t.counters().batches,Math.ceil(n/512));
}
console.log('APP518_RECOVERY_OVER_20K_50K_OWNER_PROTECTS_OLD_READY=PASS');
console.log('APP518_RECOVERY_FOREIGN_R2_CONTRACT_DENY_VS_TRANSIENT_IO_RETRY=PASS');
console.log('APP518_COMPACTION_MOVED_HEAD_ROTATE_WITH_COOLDOWN_AND_3_RETRY_LIMIT=PASS');
console.log('APP518_COMPACTION_OWNER_STAGE_AND_ATOMIC_GENERATION_SWAP=PASS');
console.log('APP518_COMPACTION_CRASH_RESUME_WITHOUT_REWRITING_N=PASS');
console.log('APP518_COMPACTION_R2_MOVED_HOLD_NO_PARTIAL_INDEX=PASS');
console.log('APP518_COMPACTION_OWNER_AND_DUPLICATE_VALIDATION=PASS');
console.log('APP518_COMPACTION_FIRST_RECOVERY_W_N_PLUS_TWO=PASS');
console.log('APP518_COMPACTION_NO_LIVE_R2_OR_D1_IO=PASS');
