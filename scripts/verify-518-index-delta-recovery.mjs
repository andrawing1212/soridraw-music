import assert from 'node:assert/strict';
import {createEmptyCatalogJournal,appendCatalogJournalDelta}
 from '../cloudflare/media-worker/src/catalogJournal.js';
import {reconcileIndexedHead518}
 from '../cloudflare/media-worker/src/catalogIndexAdvance518.js';

const uid='owner',gen=100,version1='001793152800000000001',version2='001793152800000000002';
const initial=()=>({...createEmptyCatalogJournal({
 kind:'musicNote',baseKey:'one-owner-base',baseRevision:100,itemCount:1,now:1000,
}),canonicalAuthority518:true});
let head=initial(),etag='"before"';
const addDelta=({id,version,state})=>{
 const before=head;
 const previousCount=before.itemCount;
 const present=id==='a'||id==='b'&&state==='saved';
 const nextCount=state==='saved'?previousCount+1:previousCount-1;
 const delta={mutationId:'canonical518:'+id+':'+version,
 baseRevision:before.headRevision,baseItemCount:previousCount,
 nextItemCount:nextCount,upserts:state==='saved'?[{id,uid}]:[],
 deletedIds:state==='removed'?[id]:[],revision:before.headRevision+1};
 const x=appendCatalogJournalDelta({
  head:before,delta,serverRevision:delta.revision,now:2000});
 assert.equal(x.ok,true);
 head={...x.head,canonicalAuthority518:true};
 etag='"etag-'+head.headRevision+'"';
};
addDelta({id:'b',version:version1,state:'saved'});
addDelta({id:'a',version:version2,state:'removed'});
assert.equal(head.headRevision,102);
assert.equal(head.itemCount,1);

function makeDb(){
 const meta={owner_uid:uid,generation:gen,indexed_revision:100,
 expected_count:1,head_etag:'"before"',status:'ready'};
 const members=new Set(['a']);
 const outbox=new Map([['b',{source_version_ns:version1,desired_state:'saved'}],
 ['a',{source_version_ns:version2,desired_state:'removed'}]]);
 const calls={reads:0,writes:0,batches:0};
 let failBatch=false, concurrent=false;
 const row={};
 function allowed(owner,generation,revision,headEtag,count){
  return owner===uid&&generation===meta.generation
   &&revision===meta.indexed_revision&&headEtag===meta.head_etag
   &&count===meta.expected_count&&meta.status==='ready';
 }
 const db={
  prepare(sql){return {bind(...args){return {
   sql,args,async first(){
    calls.reads++;
    if(sql.includes('FROM music_note_catalog_index_meta_518'))return {...meta};
    if(sql.includes('FROM music_note_catalog_outbox_518'))
      return outbox.get(args[1])||null;
    if(sql.includes('FROM music_note_catalog_member_518'))
      return members.has(args[2])?{present:1}:null;
    throw Error('Unexpected SELECT: '+sql);
   },
  };}};},
  async batch(stmts){
   calls.batches++;
   if(failBatch){failBatch=false;throw Error('D1_BATCH_INTERRUPTED');}
   if(concurrent){concurrent=false;meta.indexed_revision=101;meta.head_etag='"conflict"';}
   const result=[];
   for(const {sql,args} of stmts){
    let changed=0;
    if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_member_518')){
     if(allowed(...args.slice(1))&&!members.has(args[0])){members.add(args[0]);changed=1;}
    }else if(sql.startsWith('DELETE FROM music_note_catalog_member_518')){
     if(allowed(args[0],args[1],...args.slice(3))&&members.delete(args[2]))changed=1;
    }else if(sql.startsWith('UPDATE music_note_catalog_index_meta_518')){
     if(allowed(...args.slice(4))){
      const [rev,newEtag,nextCount]=args;
      meta.indexed_revision=rev;meta.head_etag=newEtag;
      meta.expected_count=nextCount;changed=1;
     }
    }else throw Error('Unexpected D1 write');
    calls.writes+=changed;
    result.push({success:true,meta:{changes:changed}});
   }
   return result;
  },
 };
 return {db,meta,members,calls,setFailure:()=>{failBatch=true},
  setConcurrent:()=>{concurrent=true},outbox};
}

const go=(ctx,opts={})=>reconcileIndexedHead518({
 db:ctx.db,uid,nowMs:4000,
 loadVerifiedHead:async()=>({
  verifiedByServer:true,ownerUid:uid,
  fencedWritersVerified:true,head,etag,
 }),...opts,
});
// R2 committed two exact changes but D1 batch/ACK was lost: bounded replay
// reaches final state without ever reading the full R2 base/song list.
let ctx=makeDb();
let result=await go(ctx);
assert.equal(result.code,'INDEX_ADVANCED');
assert.equal(result.deltaCount,2);
assert.equal(result.changedMembershipRows,2);
assert.equal(result.d1Writes,3);
assert.equal(ctx.meta.indexed_revision,102);
assert.equal(ctx.meta.head_etag,etag);
assert.equal(ctx.members.has('b'),true);
assert.equal(ctx.members.has('a'),false);
const before=ctx.calls.writes;
assert.equal((await go(ctx)).code,'ALREADY_INDEXED');
assert.equal(ctx.calls.writes,before,'duplicate recovery must D1 W0');
assert.equal(ctx.calls.batches,1);
ctx=makeDb();ctx.setFailure();
result=await go(ctx);
assert.equal(result.code,'RETRYABLE_INDEX_RECOVERY_IO');
assert.equal(ctx.meta.indexed_revision,100);
assert.equal(ctx.calls.writes,0);
result=await go(ctx);assert.equal(result.code,'INDEX_ADVANCED');
// Independent R2 tail exists, but D1's metered batch rejects the day.
// Preserve the exact quota code instead of retrying R2 on every drain.
ctx=makeDb();
const quotaError=Object.assign(new Error('DAILY_QUOTA'),{code:'HOLD_D1_DAILY_QUOTA'});
result=await go(ctx,{db:{...ctx.db,batch:async()=>{throw quotaError;}}});
assert.equal(result.code,'HOLD_D1_DAILY_QUOTA');
assert.equal(ctx.meta.indexed_revision,100);
assert.equal(ctx.calls.writes,0);
console.log('APP518_INDEX_REPLAY_DAILY_QUOTA_PRESERVED_NO_FALSE_ACK=PASS');
ctx=makeDb();ctx.setConcurrent();
result=await go(ctx);
assert.equal(result.code,'RETRYABLE_CONCURRENT_INDEX_ADVANCE');
assert.equal(ctx.calls.writes,0,'stale D1 write must not commit');
ctx=makeDb();
assert.equal((await go(ctx,{loadVerifiedHead:async()=>({
 verifiedByServer:true,ownerUid:uid,
 fencedWritersVerified:false,head,etag})})).code,
 'DENY_UNTRUSTED_OR_UNFENCED_HEAD');
assert.equal(ctx.calls.writes,0);
// P1: R2 saved v1, D1 index write crashed, latest Firestore/D1 now
// removed v2. Replay the server-committed v1 journal into the D1 index;
// v2 remains pending and can then be published without permanent HOLD.
ctx=makeDb();
ctx.outbox.get('b').source_version_ns=version2;
ctx.outbox.get('b').desired_state='removed';
assert.equal((await go(ctx)).code,'INDEX_ADVANCED');
assert.equal(ctx.meta.indexed_revision,102);
assert.equal(ctx.members.has('b'),true,'historical v1 matches current R2, not final Firestore');
assert.equal(ctx.outbox.get('b').source_version_ns,version2);
assert.equal(ctx.outbox.get('b').desired_state,'removed');
assert.equal((await go(ctx)).code,'ALREADY_INDEXED');
// Current D1 outbox older than a verified R2 change is untrusted.
ctx=makeDb();ctx.outbox.get('b').source_version_ns='001793152800000000000';
assert.equal((await go(ctx)).code,'HOLD_OUTBOX_VERSION_DRIFT');
assert.equal(ctx.calls.writes,0);
// Same song saved v1 -> removed v2, both R2-confirmed before a D1 replay:
// final index has no 'b', preserving its final state without N-row rebuild.
addDelta({id:'b',version:version2,state:'removed'});
ctx=makeDb();ctx.outbox.get('b').source_version_ns=version2;
ctx.outbox.get('b').desired_state='removed';
assert.equal((await go(ctx)).code,'INDEX_ADVANCED');
assert.equal(ctx.meta.indexed_revision,103);
assert.equal(ctx.members.has('b'),false);
assert.equal(ctx.members.has('a'),false);
// Historical server journal itself must be monotonic per document.
addDelta({id:'b',version:'001793152800000000000',state:'saved'});
ctx=makeDb();ctx.outbox.get('b').source_version_ns=version2;
ctx.outbox.get('b').desired_state='removed';
assert.equal((await go(ctx)).code,'DENY_NON_MONOTONIC_SOURCE_HISTORY');
assert.equal(ctx.calls.writes,0);
// Journal compacted before D1 caught up: recovery cannot guess missing IDs.
ctx=makeDb();
const compacted={...head,baseRevision:head.headRevision,baseItemCount:head.itemCount,deltas:[]};
assert.equal((await go(ctx,{loadVerifiedHead:async()=>({
 verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
 head:compacted,etag:'"compacted"'})})).code,
 'HOLD_COMPACTED_OR_DIVERGENT_HEAD');
console.log('APP518_BOUNDED_JOURNAL_TAIL_TO_D1_INDEX=PASS');
console.log('APP518_R2_V1_D1_LATEST_V2_CRASH_REPLAY_AND_FINAL_DELETE=PASS');
console.log('APP518_OLDER_AND_NON_MONOTONIC_R2_EVENT_NO_D1_WRITE=PASS');
console.log('APP518_R2_SUCCESS_D1_CRASH_EXACT_REPLAY=PASS');
console.log('APP518_D1_CONCURRENT_INDEX_STALE_BATCH_W0=PASS');
console.log('APP518_REPLAY_DUPLICATE_D1_W0=PASS');
console.log('APP518_COMPACTION_AND_OLD_WRITER_FAIL_CLOSED=PASS');
console.log('APP518_NO_FULL_R2_BASE_OR_LIVE_NETWORK_IO=PASS');
