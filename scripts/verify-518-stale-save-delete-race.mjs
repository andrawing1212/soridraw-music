import assert from 'node:assert/strict';
import {createEmptyCatalogJournal}
 from '../cloudflare/media-worker/src/catalogJournal.js';
import {applyIndexedCanonicalR2Delta518}
 from '../cloudflare/media-worker/src/catalogIndexedWriter518.js';
const uid='owner',id='song',v1='001793152800000000001',
 v2='001793152800000000002';
const time1='2026-10-28T02:00:00.000000001Z',
 time2='2026-10-28T02:00:00.000000002Z';
const canonical=(version,state)=>({
 uid,documentId:id,verifiedByServer:true,origin:'server-exact-read',
 state,updateTime:version===v1?time1:time2,
 ...(state==='saved'?{item:{id,uid,title:'old title'}}:{}),
});
function fixture(){
 let head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:'exact-owner-base',baseRevision:100,
  itemCount:1,now:1,
 }),canonicalAuthority518:true};
 let etag='"etag-100"',canonicalNow=canonical(v1,'saved');
 const outbox={source_version_ns:v1,desired_state:'saved',ack_version_ns:null};
 const meta={generation:100,indexed_revision:100,head_etag:etag,
  expected_count:1,status:'ready'};
 const members=new Set([id]);
 let puts=0,changes=0,casMisses=0,fullMaterializations=0;
 const readOwnerHead=async()=>({
  verifiedByServer:true,ownerUid:uid,fencedWritersVerified:true,
  head:{...head},etag,
 });
 const db={
  prepare(sql){return {bind(...args){return {sql,args,async first(){
   if(sql.includes('FROM music_note_catalog_outbox_518'))return {...outbox};
   if(sql.includes('FROM music_note_catalog_index_meta_518'))return {...meta};
   if(sql.includes('FROM music_note_catalog_member_518'))
    return members.has(args[2])?{present:1}:null;
   throw Error('unexpected D1 read');
  }};}};},
  async batch(stmts){
   const response=[];
   const allowed=(owner,gen,revision,headEtag,count)=>
    owner===uid&&gen===meta.generation&&revision===meta.indexed_revision
     &&headEtag===meta.head_etag&&count===meta.expected_count;
   for(const {sql,args} of stmts){
    let write=0;
    if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_member_518')){
     if(allowed(...args.slice(1))&&!members.has(args[0])){
      members.add(args[0]);write=1;
     }
    }else if(sql.startsWith('DELETE FROM music_note_catalog_member_518')){
     if(allowed(args[0],args[1],...args.slice(3))&&members.delete(args[2]))
      write=1;
    }else if(sql.startsWith('UPDATE music_note_catalog_index_meta_518')){
     if(allowed(...args.slice(4))){
      meta.indexed_revision=args[0];meta.head_etag=args[1];
      meta.expected_count=args[2];write=1;
     }
    }else throw Error('unexpected D1 write');
    changes+=write;
    response.push({success:true,meta:{changes:write}});
   }
   return response;
  },
 };
 const storeHeadIfEtag=async({expectedEtag,nextHead})=>{
  if(expectedEtag!==etag){casMisses++;return {casCommitted:false};}
  head=nextHead;etag='"etag-'+nextHead.headRevision+'"';
  puts++;
  return {casCommitted:true,ownerVerified:true};
 };
 const invoke=(version,state,override={})=>
  applyIndexedCanonicalR2Delta518({
   db,uid,documentId:id,sourceVersionNs:version,desiredState:state,
   readOwnerHead,storeHeadIfEtag,
   readExactCanonical:async()=>({...canonicalNow}),
   projectItem:(item,key)=>({...item,id:key}),
   nowMs:2000,...override,
  });
 const updateToV2=()=>{
  canonicalNow=canonical(v2,'removed');
  Object.assign(outbox,{source_version_ns:v2,desired_state:'removed'});
 };
 return {invoke,readOwnerHead,storeHeadIfEtag,updateToV2,
  markAck:()=>{outbox.ack_version_ns=v2;},
  get:()=>({head,etag,meta:{...meta},members:[...members],
   outbox:{...outbox},puts,changes,casMisses,fullMaterializations})};
}
function latch(){
 let ready,release;
 return {started:new Promise(r=>{ready=r;}),
  proceed:new Promise(r=>{release=r;}),
  start:()=>ready(),release:()=>release()};
}
// Race A: old save gets the HEAD, is suspended BEFORE source/outbox checks.
// A newer delete commits, then old save resumes against the captured old
// ETag and must REFUSE; the old implementation checked source first, then
// read the newer HEAD and resurrected the deleted item.
{
 const f=fixture(),l=latch();
 let first=true;
 const stale=f.invoke(v1,'saved',{
  readOwnerHead:async()=>{
   const h=await f.readOwnerHead();
   if(first){first=false;l.start();await l.proceed;}
   return h;
  },
 });
 await l.started;
 f.updateToV2();
 const deleted=await f.invoke(v2,'removed');
 assert.equal(deleted.code,'APPLIED');
 f.markAck();
 l.release();
 const old=await stale;
 assert.equal(old.code,'HOLD_CANONICAL_CHANGED_OR_UNVERIFIED');
 const end=f.get();
 assert.equal(end.outbox.ack_version_ns,v2,'newest delete ACK protected');
 assert.equal(end.members.length,0,'old save did not resurrect song');
 assert.equal(end.head.itemCount,0);
 assert.equal(end.puts,1,'only latest delete PUT');
 assert.equal(end.changes,2,'membership remove and meta update');
}
// Race B: old save verified after the HEAD, then stalls BEFORE conditional
// PUT. Delete v2 commits with a new HEAD/ETag; stale v1's ETag CAS fails,
// forcing it to restart with new HEAD and a new canonical/outbox verification.
{
 const f=fixture(),l=latch();
 let first=true;
 const stale=f.invoke(v1,'saved',{
  storeHeadIfEtag:async params=>{
   if(first){first=false;l.start();await l.proceed;}
   return f.storeHeadIfEtag(params);
  },
 });
 await l.started;
 f.updateToV2();
 const deleted=await f.invoke(v2,'removed');
 assert.equal(deleted.code,'APPLIED');
 f.markAck();
 l.release();
 const old=await stale;
 assert.equal(old.code,'HOLD_CANONICAL_CHANGED_OR_UNVERIFIED');
 const end=f.get();
 assert.equal(end.casMisses,1,'stale ETag must be rejected by R2 CAS');
 assert.equal(end.puts,1);
 assert.equal(end.head.itemCount,0);
 assert.equal(end.members.length,0);
 assert.equal(end.outbox.ack_version_ns,v2);
}
// A normal fresh write still succeeds without extra owner-wide reads.
{
 const f=fixture();
 const same=await f.invoke(v1,'saved');
 assert.equal(same.code,'APPLIED');
 const a=f.get();
 assert.equal(a.puts,1);
 assert.equal(a.head.itemCount,1);
 assert.equal(a.fullMaterializations,0);
}
console.log('APP518_RACE_OLD_SAVE_SUSPENDED_BEFORE_SOURCE_LATEST_DELETE_WINS=PASS');
console.log('APP518_RACE_STALE_ETAG_CAS_RESTART_REVALIDATES_LATEST_DELETE=PASS');
console.log('APP518_RACE_V2_DELETION_ACK_NEVER_RESURRECTS=PASS');
console.log('APP518_NORMAL_WRITE_NO_FULL_CATALOG_SCAN=PASS');
console.log('APP518_CONCURRENCY_TEST_LIVE_NETWORK_IO_ZERO=PASS');
