// app518 inactive bounded R2 BASE reader. Never loads a whole 24MB BASE.
// Uses only owner-pinned conditional byte ranges and JSON item boundaries.
// Supports the existing schema-4 object with items embedded before metadata.
import {CatalogR2ContractError518} from './catalogR2Provider518.js';

const text=x=>typeof x==='string'?x.trim():'';
const validId=x=>text(x).length>0&&text(x).length<=240&&
 !/[\\/]/.test(text(x))&&text(x)!=='.'&&text(x)!=='..';
// Stop after 128KiB of source bytes per page as well as 256 IDs; otherwise
// 256 unusually large entries could exceed Workers Free subrequest/CPU limits.
const RANGE_BYTES=65536,MAX_ITEM_BYTES=131072,MAX_META_BYTES=8192;
const MAX_PAGE_SOURCE_BYTES=131072;
class PageByteBudget518 extends Error {}
const contract=code=>{throw new CatalogR2ContractError518(code);};
const prefix=uid=>'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
const decoder=new TextDecoder('utf-8',{fatal:true});

export const createR2BasePageReader518=({
 env,readOwnerHead,sharedReleaseFencesVerified=false,projectItem,
}={})=>{
 const enabled=sharedReleaseFencesVerified===true
  &&env?.SORIDRAW_CANONICAL_CATALOG_518==='ENABLED_AFTER_SHARED_ROLLOUT'
  &&typeof env?.CATALOG?.get==='function'
  &&typeof env?.CATALOG?.head==='function'
  &&typeof readOwnerHead==='function'
  &&typeof projectItem==='function';
 const inspect=async({uid,head})=>{
  if(!enabled||!text(uid)||!head||head.canonicalAuthority518!==true)
   contract('APP518_PAGED_RELEASE_DENIED');
  const baseKey=head.baseKey;
  if(!text(baseKey).startsWith(prefix(uid))||!text(baseKey).endsWith('.json'))
   contract('APP518_PAGED_FOREIGN_BASE_KEY');
  const obj=await env.CATALOG.head(baseKey);
  if(!obj||obj.customMetadata?.uid!==uid||
   obj.customMetadata?.kind!=='musicNote'||!text(obj.etag)||
   !Number.isSafeInteger(obj.size)||obj.size<1||obj.size>24*1024*1024)
   contract('APP518_PAGED_BASE_HEADER_INVALID');
  return {baseKey,baseEtag:obj.etag,baseSize:obj.size};
 };
 const page=async({uid,head,baseEtag,baseSize,offset=0,seen=0,pageSize=256}={})=>{
  if(!enabled||!Number.isSafeInteger(offset)||offset<0
    ||!Number.isSafeInteger(seen)||seen<0||seen>head?.baseItemCount
    ||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>256)
   contract('APP518_PAGED_ARGUMENTS');
  const meta=await inspect({uid,head});
  if(meta.baseEtag!==baseEtag||meta.baseSize!==baseSize||
    offset>=baseSize||!Number.isSafeInteger(head.baseItemCount))
   contract('APP518_PAGED_BASE_CHANGED');
  let at=offset,buffer=new Uint8Array(),start=-1;
  const byte=async()=>{
   if(at-offset>=MAX_PAGE_SOURCE_BYTES)throw new PageByteBudget518();
   if(at>=baseSize)return -1;
   if(at<start||at>=start+buffer.length){
    const length=Math.min(RANGE_BYTES,baseSize-at,
      MAX_PAGE_SOURCE_BYTES-(at-offset));
    const obj=await env.CATALOG.get(meta.baseKey,{
     range:{offset:at,length},onlyIf:{etagMatches:baseEtag},
    });
    if(!obj||obj.etag!==baseEtag||obj.customMetadata?.uid!==uid
      ||obj.customMetadata?.kind!=='musicNote'
      ||typeof obj.arrayBuffer!=='function')contract('APP518_PAGED_RANGE_UNTRUSTED');
    const data=new Uint8Array(await obj.arrayBuffer());
    if(!data.length||data.length>length)contract('APP518_PAGED_BAD_RANGE');
    start=at;buffer=data;
   }
   return buffer[at++-start];
  };
  const bytesToText=bytes=>{
   try{return decoder.decode(Uint8Array.from(bytes));}
   catch{contract('APP518_PAGED_INVALID_UTF8');}
  };
  const white=b=>b===32||b===10||b===13||b===9;
  // On the initial request, validate the JSON object prefix. The historical
  // BASE payload places "items" before itemCount/complete/generatedAtMs.
  if(offset===0){
   const prefixBytes=[];
   while(prefixBytes.length<MAX_META_BYTES){
    const b=await byte();
    if(b<0)contract('APP518_PAGED_MISSING_ITEMS');
    prefixBytes.push(b);
    const s=bytesToText(prefixBytes);
    if(/"items"\s*:\s*\[$/.test(s)){
     let before;
     try{before=JSON.parse(s.replace(/,?\s*"items"\s*:\s*\[$/,'')+'}');}
     catch{contract('APP518_PAGED_PREFIX_INVALID');}
     if(before?.schemaVersion!==4||before.authority!=='server'
       ||before.kind!=='musicNote'||before.revision!==head.baseRevision)
       contract('APP518_PAGED_PREFIX_CONTRACT');
     break;
    }
   }
   if(prefixBytes.length>=MAX_META_BYTES)
    contract('APP518_PAGED_PREFIX_TOO_LARGE');
  }
  const ids=[];
  // A byte budget can be exhausted halfway through the next item. Discard
  // the unfinished item and persist ONLY the last complete JSON boundary.
  // The next invocation re-reads that item from the pinned BASE version.
  let lastCompleteOffset=at;
  try{
  while(ids.length<pageSize){
   let b=await byte();
   while(white(b))b=await byte();
   if(seen>0){
    if(b===44){
     b=await byte();while(white(b))b=await byte();
     // A comma immediately before closing ] is invalid JSON and must
     // remain invalid even when the item list is replaced for footer check.
     if(b===93)contract('APP518_PAGED_TRAILING_COMMA');
    }
    else if(b!==93)contract('APP518_PAGED_MISSING_COMMA');
   }
   if(b===93){
    // Inspect the entire suffix, then reconstruct the complete metadata JSON
    // without ever retaining the original item list in Worker memory.
    const suffix=[93];
    while(at<baseSize){
     if(suffix.length>MAX_META_BYTES)contract('APP518_PAGED_SUFFIX_TOO_LARGE');
     suffix.push(await byte());
    }
    // The owner-pinned BASE prefix was validated when offset=0. Rebuild
    // only a tiny known-good prefix in memory for strict suffix JSON parsing.
    // Re-fetching 8KiB of R2 here exceeds the per-page 128KiB GET budget.
    // Any trailing duplicate contract field must still match the pinned HEAD.
    const verifiedPrefix=JSON.stringify({
     schemaVersion:4,authority:'server',kind:'musicNote',
     revision:head.baseRevision,items:[],
    }).slice(0,-2);
    let whole;
    try{whole=JSON.parse(verifiedPrefix+bytesToText(suffix));}
    catch{contract('APP518_PAGED_FOOTER_INVALID');}
    if(whole?.schemaVersion!==4||whole.authority!=='server'
      ||whole.kind!=='musicNote'||whole.revision!==head.baseRevision
      ||whole.itemCount!==head.baseItemCount||whole.complete!==true
      ||!Number.isSafeInteger(whole.generatedAtMs)||whole.generatedAtMs<=0
      ||!Array.isArray(whole.items)||whole.items.length!==0)
     contract('APP518_PAGED_FOOTER_CONTRACT');
    if(seen!==head.baseItemCount)
     contract('APP518_PAGED_COUNT_MISMATCH');
    return {ids,offset:at,seen,done:true,baseEtag,baseSize};
   }
   if(b!==123)contract('APP518_PAGED_EXPECT_OBJECT');
   const bytes=[b];
   let depth=1,inString=false,escape=false;
   while(depth){
    const n=await byte();
    if(n<0)contract('APP518_PAGED_TRUNCATED_ITEM');
    bytes.push(n);
    if(bytes.length>MAX_ITEM_BYTES)contract('APP518_PAGED_ITEM_TOO_LARGE');
    if(inString){if(escape)escape=false;else if(n===92)escape=true;
      else if(n===34)inString=false;continue;}
    if(n===34)inString=true;
    else if(n===123||n===91)depth++;
    else if(n===125||n===93)depth--;
    if(depth<0)contract('APP518_PAGED_BAD_NESTING');
   }
   let item;
   try{item=JSON.parse(bytesToText(bytes));}
   catch{contract('APP518_PAGED_ITEM_INVALID_JSON');}
   if(!item||Array.isArray(item)||typeof item!=='object'
     ||!validId(item.id))contract('APP518_PAGED_BAD_ID');
   // Existing materializeCatalogJournal imports BASE membership directly;
   // projectItem is only applied to later HEAD delta upserts. Do not drop
   // valid legacy BASE rows based on a second projection.
   ids.push(text(item.id));
   seen++;
   if(seen>head.baseItemCount)contract('APP518_PAGED_TOO_MANY_ITEMS');
   lastCompleteOffset=at;
  }
  }catch(error){
   if(!(error instanceof PageByteBudget518))throw error;
   // First page may advance just past the verified JSON prefix with zero
   // IDs. Later calls must either complete at least one item, or HOLD
   // a single item that cannot fit in the strict 128KiB page budget.
   if(lastCompleteOffset<=offset)
    contract('APP518_PAGED_ITEM_EXCEEDS_PAGE_LIMIT');
   return {ids,offset:lastCompleteOffset,seen,done:false,
     baseEtag,baseSize,readBytes:MAX_PAGE_SOURCE_BYTES};
  }
  return {ids,offset:at,seen,done:false,baseEtag,baseSize,
    readBytes:at-offset};
 };
 return {enabled,inspect,page};
};
