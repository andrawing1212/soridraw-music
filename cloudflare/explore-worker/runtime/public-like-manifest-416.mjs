// Stage416 high-volume public-like release manifest.
// Source-only / HARD OFF until exact-SHA audit and coordinated PREVIEW release.
// More than 256 changed tracks are kept exact in one bounded rolling R2 manifest;
// RTDB keeps the legacy-compatible inline rows plus manifest metadata.
export const PUBLIC_LIKE_INLINE_MAX_416=256;
export const PUBLIC_LIKE_MANIFEST_RING_416=8;
export const PUBLIC_LIKE_MANIFEST_ROUTE_416='/v1/public-like-release-manifest-416';
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST416=/^[0-9a-f]{64}$/i;
const encoder416=new TextEncoder();
const hex416=bytes=>[...new Uint8Array(bytes)]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const digest416=async text=>hex416(
 await crypto.subtle.digest('SHA-256',encoder416.encode(text)));

const cleanRows416=rows=>{
 if(!Array.isArray(rows)||!rows.length)throw Error('416_PUBLIC_MANIFEST_NO_ROWS');
 const seen=new Set(),out=[];
 for(const raw of rows){
   const trackId=String(raw?.trackId||'').trim();
   const ownerUid=String(raw?.ownerUid||'').trim();
   if(!trackId||trackId.length>512||!ownerUid||ownerUid.length>128||
      seen.has(trackId))throw Error('416_PUBLIC_MANIFEST_BAD_ROW');
   seen.add(trackId);out.push({trackId,ownerUid});
 }
 return out.sort((a,b)=>a.trackId.localeCompare(b.trackId));
};
export const publicLikeManifestSlot416=deadlineAtMs=>{
 if(!Number.isSafeInteger(deadlineAtMs)||deadlineAtMs<=0)
   throw Error('416_PUBLIC_MANIFEST_BAD_DEADLINE');
 return Math.floor(deadlineAtMs/60_000)%PUBLIC_LIKE_MANIFEST_RING_416;
};
export const publicLikeManifestKey416=slot=>{
 if(!Number.isSafeInteger(slot)||slot<0||slot>=PUBLIC_LIKE_MANIFEST_RING_416)
   throw Error('416_PUBLIC_MANIFEST_BAD_SLOT');
 return `internal/explore/public-like-release-v416/slot-${slot}.json`;
};

export async function preparePublicLikeManifest416(
 r2,rows,windowId,deadlineAtMs,
){
 if(!UUID416.test(String(windowId||'')))
   throw Error('416_PUBLIC_MANIFEST_BINDING_INVALID');
 const normalized=cleanRows416(rows);
 const inlineRows=normalized.slice(0,PUBLIC_LIKE_INLINE_MAX_416);
 if(normalized.length<=PUBLIC_LIKE_INLINE_MAX_416)
   return {inlineRows,manifest416:null,r2Reads:0,r2Writes:0};
 if(!r2?.get||!r2?.put)throw Error('416_PUBLIC_MANIFEST_R2_UNAVAILABLE');

 const digest=await digest416(JSON.stringify(normalized));
 const slot=publicLikeManifestSlot416(deadlineAtMs);
 const key=publicLikeManifestKey416(slot);
 const payload={schemaVersion:1,windowId:String(windowId),deadlineAtMs,
   digest,count:normalized.length,rows:normalized};
 let reads=0;
 for(let attempt=0;attempt<8;attempt++){
   const object=await r2.get(key);reads++;
   if(object){
     let prior=null;
     try{prior=JSON.parse(await object.text());}catch{}
     if(prior?.schemaVersion===1&&prior?.windowId===windowId&&
        prior?.deadlineAtMs===deadlineAtMs&&prior?.digest===digest&&
        prior?.count===normalized.length)
       return {inlineRows,manifest416:{schemaVersion:1,windowId:String(windowId),
         deadlineAtMs,digest,count:normalized.length,slot},r2Reads:reads,r2Writes:0};
   }
   const saved=await r2.put(key,JSON.stringify(payload),{
     onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},
     httpMetadata:{contentType:'application/json; charset=utf-8',
       cacheControl:'public, max-age=240'},
     customMetadata:{stage416PublicManifest:'1',windowId:String(windowId),
       deadlineAtMs:String(deadlineAtMs),digest,count:String(normalized.length)},
   });
   if(saved)return {inlineRows,manifest416:{schemaVersion:1,windowId:String(windowId),
     deadlineAtMs,digest,count:normalized.length,slot},r2Reads:reads,r2Writes:1};
 }
 throw Error('416_PUBLIC_MANIFEST_CAS_EXHAUSTED');
}

export function validatePublicLikeManifestMetadata416(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Number(raw.schemaVersion)!==1||!UUID416.test(String(raw.windowId||''))||
    !Number.isSafeInteger(raw.deadlineAtMs)||raw.deadlineAtMs<=0||
    !DIGEST416.test(String(raw.digest||''))||
    !Number.isSafeInteger(raw.count)||raw.count<=PUBLIC_LIKE_INLINE_MAX_416||
    !Number.isSafeInteger(raw.slot)||raw.slot<0||
    raw.slot>=PUBLIC_LIKE_MANIFEST_RING_416||
    publicLikeManifestSlot416(raw.deadlineAtMs)!==raw.slot)
   throw Error('416_PUBLIC_MANIFEST_METADATA_INVALID');
 return {schemaVersion:1,windowId:String(raw.windowId),
   deadlineAtMs:Number(raw.deadlineAtMs),digest:String(raw.digest).toLowerCase(),
   count:Number(raw.count),slot:Number(raw.slot)};
}

export async function readPublicLikeManifest416(r2,rawMeta){
 if(!r2?.get)throw Error('416_PUBLIC_MANIFEST_R2_UNAVAILABLE');
 const meta=validatePublicLikeManifestMetadata416(rawMeta);
 const object=await r2.get(publicLikeManifestKey416(meta.slot));
 if(!object)return {meta,rows:null,r2Reads:1};
 let payload=null;
 try{payload=JSON.parse(await object.text());}catch{}
 if(payload?.schemaVersion!==1||payload?.windowId!==meta.windowId||
    Number(payload?.deadlineAtMs)!==meta.deadlineAtMs||
    String(payload?.digest||'').toLowerCase()!==meta.digest||
    Number(payload?.count)!==meta.count||!Array.isArray(payload?.rows)||
    payload.rows.length!==meta.count)
   return {meta,rows:null,r2Reads:1};
 const rows=cleanRows416(payload.rows);
 if(rows.length!==meta.count||
    await digest416(JSON.stringify(rows))!==meta.digest)
   throw Error('416_PUBLIC_MANIFEST_DIGEST_MISMATCH');
 return {meta,rows,r2Reads:1};
}

export function intersectPublicLikeManifest416(rows,requestedIds){
 if(!Array.isArray(rows)||!Array.isArray(requestedIds)||
    requestedIds.length<1||requestedIds.length>200)
   throw Error('416_PUBLIC_MANIFEST_INTERSECT_INVALID');
 const wanted=new Set();
 for(const raw of requestedIds){
   const id=String(raw||'').trim();
   if(!id||id.length>512)throw Error('416_PUBLIC_MANIFEST_INTERSECT_BAD_TRACK');
   wanted.add(id);
 }
 const found=[];
 for(const row of rows){
   if(wanted.has(row.trackId))found.push(row);
 }
 return found;
}
