// Genuine Miniflare R2 range IO; 20,001 / 50,001 original songs.
// Tests only non-publishing paged stage, NOT full BASE assembly or live CPU.
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEmptyCatalogJournal,appendCatalogJournalDelta} from '../src/catalogJournal.js';
import {createR2BasePageReader518} from '../src/catalogR2BasePages518.js';
import {createOwnerR2Provider518} from '../src/catalogR2Provider518.js';
import {stagePagedCanonicalCompaction518} from '../src/catalogR2PagedCompaction518.js';

const folder=mkdtempSync(join(tmpdir(),'app518-paged-compaction-'));
const opts={
 modules:true,name:'app518-catalog-stage-local',
 script:"export default {fetch(){return new Response('localhost only')}}",
 r2Buckets:{CATALOG:'app518-r2-local-only'},
 r2Persist:join(folder,'r2'),resourcePersistencePath:folder,
};
let mf,bucket,provider,baseReader;
const setup=async()=>{
 mf=new Miniflare(opts);bucket=await mf.getR2Bucket('CATALOG');
 const env={CATALOG:bucket,
  SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'};
 provider=createOwnerR2Provider518({env,sharedReleaseFencesVerified:true});
 baseReader=createR2BasePageReader518({
  env,sharedReleaseFencesVerified:true,readOwnerHead:provider.readOwnerHead,
  projectItem:item=>item,
 });
 return env;
};
const path=uid=>'catalog/v5/'+uid+'/musicNote/';
const runOwner=async(count)=>{
 let env=await setup();
 const uid='local-'+count,pre=path(uid),baseKey=pre+'base-1.json';
 const rows=Array.from({length:count},(_,i)=>({
  id:'song-'+i,uid,title:'Preserve '+i,
 }));
 const original=JSON.stringify({
  schemaVersion:4,authority:'server',kind:'musicNote',
  revision:1,items:rows,itemCount:count,complete:true,generatedAtMs:1000,
 });
 assert.ok(new TextEncoder().encode(original).byteLength<24*1024*1024);
 await bucket.put(baseKey,original,{customMetadata:{uid,kind:'musicNote'}});
 let head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey,baseRevision:1,itemCount:count,now:1000,
 }),canonicalAuthority518:true};
 for(let i=0;i<200;i++){
  const added=appendCatalogJournalDelta({
   head,delta:{
    mutationId:'canonical518:song-0:'+String(i+1).padStart(21,'0'),
    baseRevision:head.headRevision,baseItemCount:count,
    nextItemCount:count,
    upserts:[{id:'song-0',uid,title:'Edited '+i}],deletedIds:[],
   },serverRevision:head.headRevision+1,now:1000+i,
  });
  assert.equal(added.ok,true);
  head={...added.head,canonicalAuthority518:true};
 }
 const obj=await bucket.put(pre+'journal.json',JSON.stringify(head),{
  customMetadata:{
   uid,kind:'musicNote',revision:String(head.headRevision),
   baseRevision:String(head.baseRevision),itemCount:String(head.itemCount),
  },
 });
 const input={uid,expectedEtag:obj.etag,expectedRevision:head.headRevision,
  nowMs:20000,readOwnerHead:provider.readOwnerHead,baseReader,env};
 let runs=0,r;
 do{
  r=await stagePagedCanonicalCompaction518(input);
  assert.ok(['PAGED_COMPACTION_IN_PROGRESS','PAGED_COMPACTION_STAGED_AWAIT_ASSEMBLY'].includes(r.code),
   count+':'+JSON.stringify(r));
  runs++;
  assert.ok(runs<110,'bounded checkpoint must advance');
  if(runs===2){
   await mf.dispose();
   env=await setup();
   input.env=env;input.readOwnerHead=provider.readOwnerHead;input.baseReader=baseReader;
  }
 }while(r.code!=='PAGED_COMPACTION_STAGED_AWAIT_ASSEMBLY');
 assert.equal(r.itemCount,count);
 assert.ok(r.partCount>=Math.floor(count/1024));
 const manifestKey=pre+'compaction518/'+head.headRevision+'-'+
  obj.etag.replace(/[^A-Za-z0-9]/g,'')+'/progress.json';
 const manifest=JSON.parse(await (await bucket.get(manifestKey)).text());
 assert.equal(manifest.outputCount,count);
 assert.equal(manifest.seen,count);
 assert.equal(manifest.phase,'staged');
 const found=new Set();
 for(let i=0;i<manifest.parts;i++){
  const key=manifestKey.replace('progress.json','chunk-'+String(i).padStart(5,'0')+'.json');
  const chunk=JSON.parse(await (await bucket.get(key)).text());
  for(const item of chunk.items){
   assert.equal(found.has(item.id),false,'no duplicate in staged snapshot');
   found.add(item.id);
   if(item.id==='song-0')assert.equal(item.title,'Edited 199');
   else assert.equal(item.title,'Preserve '+item.id.slice(5));
  }
 }
 assert.equal(found.size,count);
 const pub=await provider.readOwnerHead(uid);
 assert.equal(pub.etag,obj.etag,'stage never publishes HEAD');
 assert.equal(pub.head.baseKey,baseKey,'original BASE remains current');
 assert.equal((await stagePagedCanonicalCompaction518(input)).code,
  'PAGED_COMPACTION_STAGED_AWAIT_ASSEMBLY');
 console.log('APP518_PAGED_R2_'+count+'_ALL_IDS_PRESERVED_NO_DUPLICATES=PASS');
 console.log('APP518_PAGED_R2_'+count+'_RESTART_AND_IMMUTABLE_STAGE=PASS');
 await mf.dispose();mf=null;
};
(async()=>{
 for(const count of [20001,50001])await runOwner(count);
 console.log('APP518_PAGED_R2_20001_50001_NO_D1_WRITES_NO_HEAD_CHANGE=PASS');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 try{await mf?.dispose()}catch{}
 rmSync(folder,{recursive:true,force:true});
});
