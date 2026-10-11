// Stage416 source-only signed Function -> Worker RTDB-sealed handoff.
// Account-version cursor plus 069 queue inserts share ONE D1 transaction.
// No direct browser/token claims or per-click D1 writes are permitted.
const UUID_416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder416=new TextEncoder();
const toHex416=(bytes)=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha416=async txt=>toHex416(await crypto.subtle.digest('SHA-256',encoder416.encode(txt)));
const QUEUE_416='explore_like_batches_069';
const RECEIPTS_416='explore_like_private_acceptance_416';
const BATCH_SIZE_416=50;
const MAX_416=256;
export async function verifyPrivateHmac416(raw,sig,secret){
 if(typeof raw!=='string'||!raw||raw.length>131072||
    typeof secret!=='string'||secret.length<32||
    typeof sig!=='string'||!/^[0-9a-f]{64}$/i.test(sig))return false;
 const key=await crypto.subtle.importKey('raw',encoder416.encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=toHex416(await crypto.subtle.sign('HMAC',key,encoder416.encode(raw)));
 let delta=0;for(let i=0;i<64;i++)delta|=expected.charCodeAt(i)^sig.toLowerCase().charCodeAt(i);
 return delta===0;
}
export function validatePrivateHandoff416(body,nowMs){
 if(!body||typeof body!=='object'||Array.isArray(body)||
    typeof body.uid!=='string'||body.uid.length<1||body.uid.length>128||
    !UUID_416.test(body.windowId)||
    !Number.isSafeInteger(body.version)||body.version<=0||
    !Number.isSafeInteger(body.sealedAtMs)||body.sealedAtMs<=0||
    !Number.isSafeInteger(body.signedAtMs)||body.signedAtMs<=0||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    body.signedAtMs<nowMs-15*60000||body.signedAtMs>nowMs+30000||
    body.sealedAtMs>body.signedAtMs||
    !Array.isArray(body.rows)||body.rows.length<1||body.rows.length>MAX_416)
    throw Error('416_INVALID_SIGNED_BATCH');
 const seen=new Set();
 const rows=body.rows.map(x=>{
   const id=String(x?.trackId||'');
   if(!id||id.length>512||typeof x?.liked!=='boolean'||
      !UUID_416.test(x?.operationId)||seen.has(id))
     throw Error('416_INVALID_SIGNED_TRACK');
   seen.add(id);return {trackId:id,liked:x.liked};
 });
 return {uid:body.uid,windowId:body.windowId,version:body.version,
   sealedAtMs:body.sealedAtMs,rows:rows.sort((a,b)=>a.trackId.localeCompare(b.trackId))};
}
export async function acceptPrivateHandoff416(db,claim){
 const {uid,windowId,version,sealedAtMs,rows}=claim;
 const digest=await sha416(JSON.stringify({uid,windowId,version,sealedAtMs,rows}));
 const chunks=[];for(let i=0;i<rows.length;i+=BATCH_SIZE_416)
   chunks.push(rows.slice(i,i+BATCH_SIZE_416));
 const cursor=db.prepare(
   'INSERT INTO '+RECEIPTS_416+'(user_uid,version,digest,accepted_at) VALUES(?,?,?,?) '+
   'ON CONFLICT(user_uid) DO UPDATE SET '+
   'version=excluded.version,digest=excluded.digest,accepted_at=excluded.accepted_at '+
   'WHERE excluded.version>'+RECEIPTS_416+'.version RETURNING version'
 ).bind(uid,version,digest,sealedAtMs);
 const statements=[cursor],batchIds=[];
 for(let i=0;i<chunks.length;i++){
   const chunk=chunks[i];
   const chunkHash=await sha416(JSON.stringify({uid,windowId,version,i,chunk}));
   const batchId='l069_'+String(sealedAtMs).padStart(13,'0')+'_'+chunkHash;
   batchIds.push(batchId);
   statements.push(db.prepare(
     'INSERT OR IGNORE INTO '+QUEUE_416+
     '(batch_id,user_uid,created_at,mutation_count,mutations_json) '+
     'SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM '+RECEIPTS_416+
     ' WHERE user_uid=? AND version=? AND digest=?)'
   ).bind(batchId,uid,sealedAtMs,chunk.length,JSON.stringify(chunk),uid,version,digest));
 }
 const results=await db.batch(statements);
 if(!Array.isArray(results)||results.length!==statements.length||
    results.some(x=>x?.success===false))throw Error('416_ATOMIC_HANDOFF_UNAVAILABLE');
 const claimed=Number(results[0]?.meta?.changes||0);
 const writes=results.slice(1).map(x=>Number(x?.meta?.changes||0));
 if(claimed===1&&writes.every(w=>w===1))
   return {accepted:true,duplicate:false,batchIds,trackCount:rows.length,
     batchCount:chunks.length,version};
 if(claimed===0&&writes.every(w=>w===0)){
   // Only retry path pays one small read: same version+digest is idempotent.
   const saved=await db.prepare('SELECT version,digest FROM '+RECEIPTS_416+
     ' WHERE user_uid=? LIMIT 1').bind(uid).first();
   if(Number(saved?.version)===version&&saved?.digest===digest)
     return {accepted:true,duplicate:true,batchIds,trackCount:rows.length,
       batchCount:chunks.length,version};
   return {accepted:false,duplicate:false,reason:'STALE_OR_DIFFERENT_SEAL',
     version};
 }
 throw Error('416_HANDOFF_BATCH_PROOF_MISMATCH');
}
