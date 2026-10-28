import assert from 'node:assert/strict';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {applyIndexedCanonicalR2Delta518}
 from '../cloudflare/media-worker/src/catalogIndexedWriter518.js';
const uid='owner',id='song-a',version='001793152800000000001';
const time='2026-10-28T02:00:00.000000001Z';
const canonical={uid,documentId:id,verifiedByServer:true,
 origin:'server-exact-read',updateTime:time,state:'saved',item:{id,uid,title:'Fixture'}};
const make=()=>{
 let head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:'fixture',baseRevision:100,itemCount:0,now:1000,
 }),canonicalAuthority518:true};
 let etag='"etag-100"';
 const meta={generation:100,indexed_revision:100,
  expected_count:0,head_etag:etag,status:'ready'};
 const members=new Set(),outbox={source_version_ns:version,desired_state:'saved'};
 let puts=0,writes=0,failBatch=false,failCas=false,staleHead=false;
 const db={
  prepare(sql){return {bind(...args){return {sql,args,async first(){
   if(sql.includes('FROM music_note_catalog_outbox_518'))return {...outbox};
   if(sql.includes('FROM music_note_catalog_index_meta_518'))return {...meta};
   if(sql.includes('FROM music_note_catalog_member_518'))
    return members.has(args[2])?{present:1}:null;
   throw Error('UNKNOWN_READ');
  }};}};},
  async batch(stmts){
   if(failBatch){failBatch=false;throw Error('D1_CRASH_AFTER_R2_CAS');}
   const output=[];
   const allow=(owner,gen,rev,headEtag,count)=>
    owner===uid&&gen===meta.generation&&rev===meta.indexed_revision
     &&headEtag===meta.head_etag&&count===meta.expected_count;
   for(const {sql,args} of stmts){
    let change=0;
    if(sql.startsWith('INSERT OR IGNORE INTO music_note_catalog_member_518')){
     if(allow(...args.slice(1))&&!members.has(args[0])){members.add(args[0]);change=1;}
    }else if(sql.startsWith('DELETE FROM music_note_catalog_member_518')){
     if(allow(args[0],args[1],...args.slice(3))&&members.delete(args[2]))change=1;
    }else if(sql.startsWith('UPDATE music_note_catalog_index_meta_518')){
     if(allow(...args.slice(4))){
      meta.indexed_revision=args[0];meta.head_etag=args[1];
      meta.expected_count=args[2];change=1;
     }
    }else throw Error('UNKNOWN_D1_BATCH');
    writes+=change;output.push({success:true,meta:{changes:change}});
   }
   return output;
  },
 };
 const readOwnerHead=async()=>({
  ownerUid:uid,verifiedByServer:true,fencedWritersVerified:true,
  head:{...head},etag:staleHead?'"etag-100"':etag,
 });
 const storeHeadIfEtag=async ({expectedEtag,nextHead})=>{
  if(failCas){failCas=false;return {casCommitted:false};}
  assert.equal(expectedEtag,etag);
  head=nextHead;etag='"etag-'+nextHead.headRevision+'"';puts++;
  return {casCommitted:true,ownerVerified:true};
 };
 const go=(over={})=>applyIndexedCanonicalR2Delta518({
  db,uid,documentId:id,sourceVersionNs:version,desiredState:'saved',
  readExactCanonical:async()=>({...canonical}),
  readOwnerHead,storeHeadIfEtag,projectItem:(x,key)=>({...x,id:key}),
  nowMs:2000,...over,
 });
 return {go,meta,members,getPuts:()=>puts,getWrites:()=>writes,
  crashIndex:()=>{failBatch=true},casConflict:()=>{failCas=true},
  setStaleRead:x=>{staleHead=x},head:()=>head};
};
let t=make();
let response=await t.go();
assert.equal(response.code,'APPLIED');
assert.equal(t.getPuts(),1);
assert.equal(t.getWrites(),2,'one D1 membership row and one index meta');
assert.equal(t.meta.indexed_revision,2000);
assert.equal(t.members.has(id),true);
assert.equal((await t.go()).code,'ALREADY_APPLIED');
assert.equal(t.getPuts(),1,'duplicate cannot re-PUT R2');
assert.equal(t.getWrites(),2,'duplicate cannot write D1');

t=make();t.crashIndex();
response=await t.go();
assert.match(response.code,/RETRYABLE_INDEX_/);
assert.equal(t.getPuts(),1);
assert.equal(t.meta.indexed_revision,100,'R2 success/D1 fail must leave old index');
response=await t.go();
assert.equal(response.code,'ALREADY_APPLIED');
assert.equal(t.getPuts(),1,'recovery must not re-PUT confirmed R2');
assert.equal(t.members.has(id),true);
assert.equal(t.getWrites(),2);

t=make();t.casConflict();
assert.equal((await t.go()).code,'APPLIED');
assert.equal(t.getPuts(),1,'R2 conflict uses bounded retry from fresh head');

t=make();
assert.equal((await t.go({readExactCanonical:async()=>({
 ...canonical,verifiedByServer:false})})).code,
 'HOLD_CANONICAL_CHANGED_OR_UNVERIFIED');
assert.equal(t.getPuts(),0);assert.equal(t.getWrites(),0);
t=make();
assert.equal((await t.go({readOwnerHead:async()=>({
 ownerUid:uid,verifiedByServer:true,fencedWritersVerified:false,
 head:t.head(),etag:'"etag-100"'})})).code,
 'DENY_UNFENCED_R2_HEAD');
assert.equal(t.getPuts(),0);
console.log('APP518_EXACT_R2_CAS_AND_D1_INDEX_BEFORE_ACK=PASS');
console.log('APP518_R2_SUCCESS_D1_CRASH_RECOVERY_NO_SECOND_PUT=PASS');
console.log('APP518_DUPLICATE_VERSION_R2_W0_D1_W0=PASS');
console.log('APP518_CAS_CONFLICT_AND_UNVERIFIED_SOURCE_FAIL_CLOSED=PASS');
console.log('APP518_INDEXED_WRITER_NO_LIVE_NETWORK_IO=PASS');
