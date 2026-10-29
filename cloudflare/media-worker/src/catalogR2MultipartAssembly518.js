// app518 DORMANT: 6 MiB uniform R2 multipart BASE upload, one part per call.
// Only a complete immutable BASE may be published by a separate journal HEAD CAS.
// Progress is an owner/source-ETag keyed conditional R2 object. No D1 ACK.
const enc=new TextEncoder();
const PART_BYTES=6*1024*1024;
const MAX_PARTS=5; // 24 MiB source BASE limit plus bounded metadata
const b=x=>enc.encode(x);
const own=(o,uid,revision,sourceEtag)=>o?.customMetadata?.uid===uid
 &&o.customMetadata.kind==='musicNote'
 &&o.customMetadata.revision===String(revision)
 &&o.customMetadata.sourceEtag===sourceEtag;
const current=async(readOwnerHead,uid,etag,revision)=>{
 const value=await readOwnerHead(uid);
 return value?.verifiedByServer===true&&value.ownerUid===uid
  &&value.fencedWritersVerified===true&&value.etag===etag
  &&value.head?.headRevision===revision;
};
const inspectChunk=async({bucket,dir,uid,revision,number,comma})=>{
 const key=dir+'chunk-'+String(number).padStart(5,'0')+'.json';
 const obj=await bucket.get(key);
 if(!obj||obj.customMetadata?.uid!==uid
   ||obj.customMetadata?.kind!=='musicNote'
   ||obj.customMetadata?.revision!==String(revision))
  return null;
 const raw=await obj.text(),start=raw.indexOf('"items":[');
 if(start<0||!raw.endsWith(']}'))return null;
 const list=raw.slice(start+9,-2);
 // Stage creates nonempty ordered chunks. Empty or malformed chunks must
 // not silently shift JSON boundaries or manufacture an item.
 if(!list||list[0]!=='{'||list[list.length-1]!=='}')return null;
 return b((comma?',':'')+list);
};
// Segment 0 is JSON prefix; segments 1..N are staged chunk bodies;
// segment N+1 is the footer. A byte cursor supports UTF-8 splits exactly.
const nextPart=async({bucket,dir,uid,revision,head,progress,cursor})=>{
 const prefix='{"schemaVersion":4,"authority":"server","kind":"musicNote","revision":'+
  revision+',"items":[';
 const suffix='],"itemCount":'+head.itemCount+
  ',"complete":true,"generatedAtMs":'+head.updatedAtMs+'}';
 const limit=progress.parts+2;
 let segment=cursor.segment,offset=cursor.offset;
 if(!Number.isSafeInteger(segment)||segment<0||segment>limit
  ||!Number.isSafeInteger(offset)||offset<0)
  return {code:'HOLD_MULTIPART_CURSOR'};
 const output=new Uint8Array(PART_BYTES);
 let filled=0,reads=0;
 while(segment<limit&&filled<PART_BYTES){
  let value;
  if(segment===0)value=b(prefix);
  else if(segment===limit-1)value=b(suffix);
  else{
   if(++reads>36)return {code:'HOLD_MULTIPART_READ_BUDGET'};
   value=await inspectChunk({
    bucket,dir,uid,revision,number:segment-1,comma:segment>1,
   });
   if(!value)return {code:'HOLD_MULTIPART_CHUNK_CONTRACT'};
  }
  if(offset>value.length)return {code:'HOLD_MULTIPART_OFFSET'};
  const n=Math.min(value.length-offset,PART_BYTES-filled);
  output.set(value.subarray(offset,offset+n),filled);
  filled+=n;offset+=n;
  if(offset===value.length){segment++;offset=0;}
 }
 const done=segment===limit;
 if(!done&&filled!==PART_BYTES)return {code:'HOLD_MULTIPART_SHORT_NONFINAL'};
 if(filled===0||(!done&&filled<5*1024*1024))
  return {code:'HOLD_MULTIPART_TOO_SMALL'};
 return {code:'PART',body:output.subarray(0,filled),done,
  cursor:{segment,offset},bytes:filled,reads};
};
const validState=(s,{uid,revision,etag,progress})=>
 s?.schemaVersion===1&&s.uid===uid&&s.revision===revision
 &&s.sourceEtag===etag&&s.partsExpected===progress.parts
 &&typeof s.uploadId==='string'&&s.uploadId.length>0
 &&Array.isArray(s.uploaded)&&s.uploaded.length<=MAX_PARTS
 &&['upload','complete'].includes(s.phase)
 &&s.uploaded.every((p,i)=>p.partNumber===i+1
  &&typeof p.etag==='string'&&p.etag.length>0)
 &&Number.isSafeInteger(s.cursor?.segment)
 &&Number.isSafeInteger(s.cursor?.offset)
 &&s.cursor.segment>=0&&s.cursor.offset>=0
 &&s.cursor.segment<=progress.parts+2
 &&(s.phase!=='complete'||s.cursor.segment===progress.parts+2);
export const advanceMultipartBase518=async({
 env,uid,dir,revision,etag,head,progress,readOwnerHead,
}={})=>{
 const bucket=env?.CATALOG;
 if(!bucket?.get||!bucket?.head||!bucket?.put
  ||!bucket?.createMultipartUpload||!bucket?.resumeMultipartUpload
  ||!Number.isSafeInteger(revision)||revision<=0
  ||!Number.isSafeInteger(progress?.parts)||progress.parts<1
  ||progress.parts>36||progress.outputCount!==head?.itemCount
  ||!dir?.startsWith('catalog/v5/'+encodeURIComponent(uid)+'/musicNote/compaction518/')
  ||typeof readOwnerHead!=='function')
  return {code:'HOLD_MULTIPART_DEPENDENCIES',published:false,d1Writes:0};
 if(!await current(readOwnerHead,uid,etag,revision))
  return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED',published:false};
 const baseKey=dir+'base-complete.json',stateKey=dir+'multipart.json';
 const existing=await bucket.head(baseKey);
 if(existing){
  return own(existing,uid,revision,etag)&&existing.customMetadata.itemCount===String(head.itemCount)
   ?{code:'MULTIPART_BASE_READY',baseKey,dest:existing}
   :{code:'HOLD_MULTIPART_BASE_COLLISION',published:false};
 }
 const obj=await bucket.get(stateKey);
 let state=null;
 if(obj){
  try{state=JSON.parse(await obj.text());}
  catch{return {code:'HOLD_MULTIPART_STATE_CORRUPT',published:false};}
  if(!validState(state,{uid,revision,etag,progress}))
   return {code:'HOLD_MULTIPART_STATE_CONTRACT',published:false};
 }
 if(!state){
  // Validate first source slice before creating an upload. A competing
  // creator's unused multipart is aborted; published BASE remains intact.
  const first=await nextPart({bucket,dir,uid,revision,head,progress,
   cursor:{segment:0,offset:0}});
  if(first.code!=='PART'||first.done)
   return {code:first.code==='PART'?'HOLD_MULTIPART_NOT_REQUIRED':first.code,
    published:false,d1Writes:0};
  const created=await bucket.createMultipartUpload(baseKey,{
   httpMetadata:{contentType:'application/json; charset=utf-8',
    cacheControl:'private, no-store'},
   customMetadata:{uid,kind:'musicNote',revision:String(revision),
    itemCount:String(head.itemCount),sourceEtag:etag},
  });
  const candidate={schemaVersion:1,uid,revision,sourceEtag:etag,
   partsExpected:progress.parts,uploadId:created.uploadId,
   cursor:{segment:0,offset:0},uploaded:[],phase:'upload'};
  const saved=await bucket.put(stateKey,JSON.stringify(candidate),{
   onlyIf:{etagDoesNotMatch:'*'},
   customMetadata:{uid,kind:'musicNote',revision:String(revision)},
  });
  if(!saved?.etag){
   await created.abort();
   return {code:'PAGED_COMPACTION_IN_PROGRESS',published:false,d1Writes:0};
  }
  state=candidate;
  // The next invocation uploads the first piece; never spend unbounded
  // reads, create, upload and complete in a single Workers Free request.
  return {code:'PAGED_COMPACTION_IN_PROGRESS',published:false,d1Writes:0};
 }
 const upload=bucket.resumeMultipartUpload(baseKey,state.uploadId);
 if(state.phase==='upload'){
  const piece=await nextPart({bucket,dir,uid,revision,head,progress,cursor:state.cursor});
  if(piece.code!=='PART')return {code:piece.code,published:false,d1Writes:0};
  if(state.uploaded.length>=MAX_PARTS)
   return {code:'HOLD_MULTIPART_PART_LIMIT',published:false,d1Writes:0};
  const part=await upload.uploadPart(state.uploaded.length+1,piece.body);
  if(!part?.etag||part.partNumber!==state.uploaded.length+1)
   return {code:'RETRYABLE_MULTIPART_UPLOAD_PART',published:false,d1Writes:0};
  if(!await current(readOwnerHead,uid,etag,revision))
   return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED',published:false};
  const updated={...state,cursor:piece.cursor,
   uploaded:[...state.uploaded,{etag:part.etag,partNumber:part.partNumber}],
   phase:piece.done?'complete':'upload'};
  const saved=await bucket.put(stateKey,JSON.stringify(updated),{
   onlyIf:{etagMatches:obj.etag},
   customMetadata:{uid,kind:'musicNote',revision:String(revision)},
  });
  return {code:saved?.etag?'PAGED_COMPACTION_IN_PROGRESS':
   'RETRYABLE_MULTIPART_PROGRESS_RACE',published:false,d1Writes:0,
   partCount:updated.uploaded.length};
 }
 // The last part may be <5MiB. R2 requires uniform preceding 6MiB
 // parts. Complete may succeed before its response is lost: retry checks
 // for the immutable completed object before trying to complete again.
 if(!await current(readOwnerHead,uid,etag,revision))
  return {code:'RETRYABLE_PAGED_COMPACTION_HEAD_MOVED',published:false};
 try{await upload.complete(state.uploaded);}
 catch(error){
  const recovered=await bucket.head(baseKey);
  if(!own(recovered,uid,revision,etag)
    ||recovered.customMetadata.itemCount!==String(head.itemCount))
   return {code:'RETRYABLE_MULTIPART_COMPLETE',published:false,d1Writes:0};
 }
 const complete=await bucket.head(baseKey);
 return own(complete,uid,revision,etag)
  &&complete.customMetadata.itemCount===String(head.itemCount)
  ?{code:'MULTIPART_BASE_READY',dest:complete,baseKey}
  :{code:'HOLD_MULTIPART_FINAL_CONTRACT',published:false,d1Writes:0};
};
