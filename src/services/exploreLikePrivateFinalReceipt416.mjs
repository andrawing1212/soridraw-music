// Stage416 final canonical acknowledgement: fail closed unless an Admin-only
// RTDB receipt proves BOTH the canonical D1 commit and exact personal R2.
// Normal 127 signals (client-writable) are never valid for this protocol.
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanId=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
export function parsePrivateFinalReceipt416(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !Number.isSafeInteger(raw.version)||raw.version<=0||
    raw.canonicalD1!=='settled'||
    raw.personalLikeSnapshot!=='changed-track-r2'||
    !Array.isArray(raw.rows)||raw.rows.length<1||raw.rows.length>256)
   return null;
 const seen=new Set(),rows=[];
 for(const v of raw.rows){
   if(!v||!cleanId(v.trackId,512)||!UUID416.test(v.operationId)||
      !cleanId(v.ownerUid,128)&&v.ownerUid!==''||
      typeof v.liked!=='boolean'||!Number.isSafeInteger(v.likeCount)||
      v.likeCount<0||v.likeCount>1000000000||
      seen.has(v.trackId))return null;
   seen.add(v.trackId);
   rows.push({trackId:v.trackId,operationId:v.operationId,ownerUid:v.ownerUid,
     liked:v.liked,likeCount:v.likeCount});
 }
 return {version:raw.version,rows};
}
// No speculative clears: only the specific current durable local operation
// can leave the outbox. A later opposite click always wins.
export function selectExactFinalizedPrivateLikes416(outbox,receipt){
 if(!receipt||!outbox||typeof outbox!=='object')return [];
 return receipt.rows.filter(x=>{
   const row=outbox[x.trackId];
   return row&&row.operationId===x.operationId&&
     row.desiredLiked===x.liked;
 });
}
