// app518 dormant candidate: bounded, restartable R2-only compaction staging.
// Never writes published HEAD, Firestore, D1 or an existing BASE.
// No browser/scheduler activation in this module. A complete stage is NOT
// a publishable BASE: HEAD must remain unchanged until a separately verified
// bounded assembly and conditional publish path exists.
import {advanceMultipartBase518} from './catalogR2MultipartAssembly518.js';
import {isValidCatalogJournal,shouldCompactCatalogJournal,createCompactedCatalogJournal,CATALOG_JOURNAL_MAX_BYTES} from './catalogJournal.js';

const validUid=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\\/]/.test(v);
const bytes=v=>new TextEncoder().encode(v).byteLength;
const safeEt=v=>typeof v==='string'&&/^[A-Za-z0-9"-]{8,128}$/.test(v);
const changedCount=r=>Number(r?.meta?.changes||0);
const pageLimit=8;
const maxAssemblyChunks=36; // keeps R2 reads/HEAD CAS inside 50 Free subrequests
const compactPrefix=(uid,revision,etag)=>
 'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/compaction518/'+
 revision+'-'+etag.replace(/[^A-Za-z0-9]/g,'')+'/';
const readJSON=async(object)=>{
 if(!object)return null;
 try{return JSON.parse(await object.text());}catch{return null;}
};
const sourceVersion=(head)=>head?.headRevision;
const fingerprint=(head,etag,baseEtag)=>
 [head.headRevision,head.baseRevision,head.itemCount,etag,baseEtag];
const matches=(row,v)=>Array.isArray(row?.fingerprint)&&row.fingerprint.length===v.length
 &&row.fingerprint.every((x,i)=>x===v[i]);
const finalPatchMap=(deltas)=>{
 const map=new Map();
 for(const d of deltas){
  for(const id of d.deletedIds)map.set(id,null);
  for(const item of d.upserts)map.set(item.id,item);
 }
 return map;
};

export const stagePagedCanonicalCompaction518=async({
 env,uid,expectedEtag,expectedRevision,nowMs,
 readOwnerHead,baseReader,
}={})=>{
 if(!validUid(uid)||!safeEt(expectedEtag)
  ||!Number.isSafeInteger(expectedRevision)||expectedRevision<=0
  ||!Number.isSafeInteger(nowMs)||nowMs<=0
  ||!env?.CATALOG?.get||!env?.CATALOG?.put
  ||typeof readOwnerHead!=='function'
  ||!baseReader?.inspect||!baseReader?.page)
  return {code:'DENY_PAGED_COMPACTION_DEPENDENCIES'};
 const headRead=await readOwnerHead(uid);
 if(headRead?.ownerUid!==uid||headRead.verifiedByServer!==true
  ||headRead.fencedWritersVerified!==true||headRead.etag!==expectedEtag
  ||!isValidCatalogJournal(headRead.head,'musicNote')
  ||headRead.head.canonicalAuthority518!==true
  ||sourceVersion(headRead.head)!==expectedRevision)
  return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED'};
 const head=headRead.head;
 if(!shouldCompactCatalogJournal(head))
  return {code:'COMPACTION_NOT_NEEDED'};
 if(head.itemCount<=256)
  return {code:'DENY_USE_SMALL_CANONICAL_COMPACTION'};
 // Indexed Writer applies at most one song per source delta. Avoid
 // unbounded journal change maps and 10ms CPU surprises.
 if(head.deltas.length>400||head.deltas.some(d=>
  (d.deletedIds.length+d.upserts.length)>1))
  return {code:'HOLD_PAGED_COMPACTION_DELTA_BUDGET'};
 const base=await baseReader.inspect({uid,head});
 const fp=fingerprint(head,expectedEtag,base.baseEtag);
 const dir=compactPrefix(uid,head.headRevision,expectedEtag);
 const stateKey=dir+'progress.json';
 const obj=await env.CATALOG.get(stateKey);
 const state=await readJSON(obj);
 if(obj&&!state)return {code:'HOLD_PAGED_COMPACTION_CORRUPT_PROGRESS'};
 if(state&&(!matches(state,fp)||state.uid!==uid
  ||state.baseKey!==base.baseKey||state.baseSize!==base.baseSize
  ||!Number.isSafeInteger(state.offset)||state.offset<0
  ||!Number.isSafeInteger(state.seen)||state.seen<0
  ||!Number.isSafeInteger(state.parts)||state.parts<0
  ||!Number.isSafeInteger(state.outputCount)||state.outputCount<0
  ||!Array.isArray(state.seenChanges)||state.seenChanges.length>400
  ||!['pages','staged'].includes(state.phase)))
  return {code:'HOLD_PAGED_COMPACTION_INVALID_PROGRESS'};
 if(state?.phase==='staged'){
  if(state.outputCount!==head.itemCount||state.parts>maxAssemblyChunks
    ||state.parts<1||state.seen!==head.baseItemCount)
   return {code:'HOLD_PAGED_COMPACTION_ASSEMBLY_BUDGET',published:false,d1Writes:0};
  const baseKey=dir+'base-complete.json';
  // Multipart staging already exists as immutable R2 chunks. Assemble one
  // bounded streaming PUT (<=36 R2 reads); no 50k-song JS array or D1 scan.
  let dest=await env.CATALOG.head(baseKey);
  if(!dest){
   const prefixJSON='{"schemaVersion":4,"authority":"server","kind":"musicNote","revision":'+
    expectedRevision+',"items":[';
   const suffixJSON='],"itemCount":'+head.itemCount+
    ',"complete":true,"generatedAtMs":'+head.updatedAtMs+'}';
   // R2 refuses unknown-length ReadableStreams. Bound memory and CPU:
   // owners exceeding 8 MiB remain HOLD until multipart assembly is audited.
   // A HOLD never changes BASE/HEAD or sends a false D1 ACK.
   const parts=[];
   let totalBytes=bytes(prefixJSON)+bytes(suffixJSON),oversized=false;
   for(let step=0;step<state.parts;step++){
    const partKey=dir+'chunk-'+String(step).padStart(5,'0')+'.json';
    const part=await env.CATALOG.get(partKey);
    if(!part||part.customMetadata?.uid!==uid
      ||part.customMetadata?.kind!=='musicNote'
      ||part.customMetadata?.revision!==String(expectedRevision))
     return {code:'HOLD_PAGED_ASSEMBLY_CHUNK_MISSING_OR_FOREIGN'};
    const raw=await part.text(),start=raw.indexOf('"items":[');
    if(start<0||!raw.endsWith(']}'))
     return {code:'HOLD_PAGED_ASSEMBLY_CHUNK_INVALID'};
    const list=raw.slice(start+9,-2);
    if(list){
     totalBytes+=bytes(list)+(parts.length?1:0);
     if(totalBytes>8*1024*1024){oversized=true;break;}
     parts.push(list);
    }
   }
   if(oversized){
    // R2 rejects unknown-length stream PUTs. A strict uniform 6MiB
    // multipart upload persists one part per invocation and resumes at
    // the byte cursor after a crash; publication still requires HEAD CAS.
    const next=await advanceMultipartBase518({
     env,uid,dir,revision:expectedRevision,etag:expectedEtag,
     head,progress:state,readOwnerHead,
    });
    if(next.code!=='MULTIPART_BASE_READY')return next;
    dest=next.dest;
   }else{
    const assembled=prefixJSON+parts.join(',')+suffixJSON;
    if(bytes(assembled)>8*1024*1024)
     return {code:'HOLD_PAGED_ASSEMBLY_LENGTH',d1Writes:0,published:false};
    const put=await env.CATALOG.put(baseKey,assembled,{
     onlyIf:{etagDoesNotMatch:'*'},
     httpMetadata:{contentType:'application/json; charset=utf-8',
      cacheControl:'private, no-store'},
     customMetadata:{uid,kind:'musicNote',revision:String(expectedRevision),
      itemCount:String(head.itemCount),sourceEtag:expectedEtag},
    });
    if(!put?.etag){
     dest=await env.CATALOG.head(baseKey);
     if(!dest)return {code:'RETRYABLE_PAGED_ASSEMBLY_BASE_RACE'};
    }else dest=put;
   }
  }
  if(dest.customMetadata?.uid!==uid
    ||dest.customMetadata?.kind!=='musicNote'
    ||dest.customMetadata?.sourceEtag!==expectedEtag
    ||dest.customMetadata?.itemCount!==String(head.itemCount)
    ||dest.customMetadata?.revision!==String(expectedRevision))
   return {code:'HOLD_PAGED_ASSEMBLY_BASE_CONTRACT'};
  const current=await readOwnerHead(uid);
  if(current?.etag!==expectedEtag||current.ownerUid!==uid
    ||current.head?.headRevision!==expectedRevision)
   return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED'};
  const nextHead={
   ...createCompactedCatalogJournal({head,baseKey,now:nowMs}),
   canonicalCompaction518:{
    fromEtag:expectedEtag,revision:expectedRevision,
    itemCount:head.itemCount,
   },
  };
  if(!isValidCatalogJournal(nextHead,'musicNote')
    ||nextHead.canonicalAuthority518!==true
    ||bytes(JSON.stringify(nextHead))>CATALOG_JOURNAL_MAX_BYTES)
   return {code:'DENY_PAGED_COMPACTION_HEAD_CONTRACT'};
  const saved=await env.CATALOG.put(
   'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/journal.json',
   JSON.stringify(nextHead),{
    onlyIf:{etagMatches:expectedEtag},
    httpMetadata:{contentType:'application/json; charset=utf-8',
     cacheControl:'private, no-store'},
    customMetadata:{uid,kind:'musicNote',
     baseRevision:String(nextHead.baseRevision),
     revision:String(nextHead.headRevision),
     itemCount:String(nextHead.itemCount),deltaCount:'0',
     authority:'server'},
   });
  return saved?.etag
   ?{code:'COMPACTED',itemCount:head.itemCount,published:true,d1Writes:0}
   :{code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED',published:false};
 }
 const progress=state||{
  schemaVersion:1,uid,fingerprint:fp,baseKey:base.baseKey,
  baseSize:base.baseSize,offset:0,seen:0,parts:0,
  outputCount:0,seenChanges:[],phase:'pages',
 };
 const changed=finalPatchMap(head.deltas);
 const seenChanges=new Set(progress.seenChanges);
 if(progress.seenChanges.some(id=>!changed.has(id)))
  return {code:'HOLD_PAGED_COMPACTION_CHANGED_IDS'};
 const rows=[];
 let offset=progress.offset,seen=progress.seen,finished=false,pages=0;
 while(pages<pageLimit){
  const next=await baseReader.page({
   uid,head,baseEtag:base.baseEtag,baseSize:base.baseSize,
   offset,seen,pageSize:256,includeItems:true,
  });
  if(next.offset<=offset||next.seen<seen
    ||!Array.isArray(next.items)||next.items.length!==next.ids.length)
   return {code:'HOLD_PAGED_COMPACTION_CURSOR'};
  for(const item of next.items){
   if(changed.has(item.id)){
    if(seenChanges.has(item.id))
     return {code:'HOLD_PAGED_COMPACTION_DUPLICATE_BASE'};
    seenChanges.add(item.id);
    const updated=changed.get(item.id);
    if(updated)rows.push(updated);
   }else rows.push(item);
  }
  offset=next.offset;seen=next.seen;pages++;
  if(next.done){finished=true;break;}
 }
 if(finished){
  for(const [id,item] of changed){
   if(!seenChanges.has(id)&&item)rows.push(item);
  }
 }
 const outputCount=progress.outputCount+rows.length;
 if(finished&&outputCount!==head.itemCount)
  return {code:'HOLD_PAGED_COMPACTION_COUNT_DIVERGENCE',
   expected:head.itemCount,actual:outputCount};
 const chunkKey=dir+'chunk-'+String(progress.parts).padStart(5,'0')+'.json';
 const chunk=JSON.stringify({
  schemaVersion:1,uid,revision:expectedRevision,
  inputOffset:progress.offset,inputSeen:progress.seen,
  outputCount:rows.length,items:rows,
 });
 // A bounded chunk per invocation; never hold a large account in memory.
 if(bytes(chunk)>8*131072+32768)
  return {code:'HOLD_PAGED_COMPACTION_CHUNK_BYTES'};
 const previous=await env.CATALOG.get(chunkKey);
 if(previous){
  if(previous.customMetadata?.uid!==uid
    ||(await previous.text())!==chunk)
   return {code:'HOLD_PAGED_COMPACTION_IMMUTABLE_CHUNK_COLLISION'};
 }else{
  const stored=await env.CATALOG.put(chunkKey,chunk,{
   onlyIf:{etagDoesNotMatch:'*'},
   customMetadata:{uid,kind:'musicNote',revision:String(expectedRevision),
    count:String(rows.length)},
  });
  if(!stored?.etag){
   const reread=await env.CATALOG.get(chunkKey);
   if(!reread||reread.customMetadata?.uid!==uid
     ||(await reread.text())!==chunk)
    return {code:'RETRYABLE_PAGED_COMPACTION_CHUNK_RACE'};
  }
 }
 const nextState={
  ...progress,offset,seen,parts:progress.parts+1,
  outputCount,seenChanges:[...seenChanges],
  phase:finished?'staged':'pages',
 };
 // Do not commit the progress if HEAD changed. An already stored immutable
 // orphan chunk cannot affect the published BASE, D1 or existing songs.
 const current=await readOwnerHead(uid);
 if(current?.etag!==expectedEtag||current?.ownerUid!==uid
  ||current?.head?.headRevision!==expectedRevision)
  return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED'};
 const written=await env.CATALOG.put(stateKey,JSON.stringify(nextState),{
  onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'},
  customMetadata:{uid,kind:'musicNote',revision:String(expectedRevision)},
 });
 if(!written?.etag)return {code:'RETRYABLE_PAGED_COMPACTION_CURSOR_RACE'};
 return {code:finished?'PAGED_COMPACTION_STAGED_AWAIT_ASSEMBLY':
   'PAGED_COMPACTION_IN_PROGRESS',
  inputSeen:seen,outputCount,partCount:nextState.parts,
  d1Writes:0,published:false,pages};
};
