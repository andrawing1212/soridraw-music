// APP529: one durable pending scalar per owner, not an append-only event log.
// D1 profile_stats count UPDATE + outbox UPSERT share the canonical transaction.
// Source-only until shared D1, cron, HMAC, Function and physical-cost approval.
export const OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN=false;
const MAX_BATCH_529=12,MAX_ATTEMPTS_529=8;
const UID_529=/^[a-zA-Z0-9_-]{1,128}$/;
const ENDPOINT_529='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower529';

export const validateOwnerFollowOutboxEvent529=row=>{
 const ownerUid=String(row?.owner_uid||'').trim();
 const version=Number(row?.revision),followerCount=Number(row?.follower_count);
 const updatedAt=Number(row?.updated_at),attempts=Number(row?.attempts),
   ackedRevision=Number(row?.acked_revision);
 if(!UID_529.test(ownerUid)||!Number.isSafeInteger(version)||version<=0||
    !Number.isSafeInteger(followerCount)||followerCount<0||followerCount>1_000_000_000||
    !Number.isSafeInteger(updatedAt)||updatedAt<=0||
    !Number.isSafeInteger(attempts)||attempts<0||attempts>=MAX_ATTEMPTS_529||
    !Number.isSafeInteger(ackedRevision)||ackedRevision<0||ackedRevision>=version)
    return null;
 return {ownerUid,version,followerCount,updatedAt,attempts,ackedRevision};
};
const hex529=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const signOwnerFollowPayload529=async(body,at,secret)=>{
 if(typeof secret!=='string'||secret.length<32)throw Error('OWNER_FOLLOW_529_SECRET_REQUIRED');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex529(await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode(String(at)+'.'+body)));
};
export const sendOwnerFollowOutboxEvent529=async(row,{endpoint,secret,send=fetch,now=Date.now}={})=>{
 const event=validateOwnerFollowOutboxEvent529(row);
 if(!event)throw Error('OWNER_FOLLOW_529_INVALID_RECORD');
 if(endpoint!==ENDPOINT_529)throw Error('OWNER_FOLLOW_529_ENDPOINT_NOT_PINNED');
 const at=now();
 if(!Number.isSafeInteger(at)||at<=0)throw Error('OWNER_FOLLOW_529_CLOCK');
 const body=JSON.stringify({
   version:1,revision:event.version,ownerUid:event.ownerUid,
   followerCount:event.followerCount,updatedAt:event.updatedAt,at,
 });
 const signature=await signOwnerFollowPayload529(body,at,secret);
 const response=await send(endpoint,{method:'POST',
  headers:{'Content-Type':'application/json',
   'X-Soridraw-Follow-Relay529-At':String(at),
   'X-Soridraw-Follow-Relay529-Signature':signature},body,
 });
 return response?.ok===true;
};
export const nextOwnerFollowRetryAt529=(attempts,now)=>{
 const n=Math.max(1,Math.min(MAX_ATTEMPTS_529,Math.floor(Number(attempts)||1)));
 return now+Math.min(60*60_000,15_000*2**(n-1));
};
// Concurrent drains may send the same event, but the RTDB receiver is
// idempotent and each ACK/failure uses (owner_uid,revision) CAS. A newer
// owner version can never be acknowledged by an older in-flight delivery.
export const drainOwnerFollowOutbox529=async({
 db,deliver,now=Date.now,enabled=OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN,limit=MAX_BATCH_529,
}={})=>{
 if(!enabled)return {skipped:true,selected:0,delivered:0,failed:0};
 if(!db||typeof db.prepare!=='function'||typeof deliver!=='function')
   throw Error('OWNER_FOLLOW_529_BACKEND_UNAVAILABLE');
 const at=now(),count=Math.max(1,Math.min(MAX_BATCH_529,Math.floor(Number(limit)||1)));
 const page=await db.prepare(
   'SELECT owner_uid,revision,follower_count,updated_at,attempts,acked_revision '+
   'FROM explore_owner_follow_outbox_529 WHERE revision>acked_revision '+
   'AND dead_at=0 AND attempts<8 AND next_attempt_at<=? '+
   'ORDER BY updated_at ASC,owner_uid ASC LIMIT ?'
 ).bind(at,count).all();
 const rows=Array.isArray(page?.results)?page.results:[];
 let delivered=0,failed=0;
 for(const raw of rows){
   const ev=validateOwnerFollowOutboxEvent529(raw);
   if(!ev)throw Error('OWNER_FOLLOW_529_BAD_DURABLE_RECORD');
   let success=false;
   try{success=await deliver(ev)===true;}catch{}
   if(success){
     await db.prepare('UPDATE explore_owner_follow_outbox_529 '+
       'SET acked_revision=?,delivered_at=? WHERE owner_uid=? '+
       'AND revision=? AND acked_revision<?')
       .bind(ev.version,now(),ev.ownerUid,ev.version,ev.version).run();
     delivered++;
   }else{
     const attempts=ev.attempts+1,dead=attempts>=MAX_ATTEMPTS_529?now():0;
     await db.prepare('UPDATE explore_owner_follow_outbox_529 '+
       'SET attempts=?,next_attempt_at=?,dead_at=? WHERE owner_uid=? '+
       'AND revision=? AND attempts=? AND acked_revision<?')
       .bind(attempts,dead?0:nextOwnerFollowRetryAt529(attempts,now()),
         dead,ev.ownerUid,ev.version,ev.attempts,ev.version).run();
     failed++;
   }
 }
 return {skipped:false,selected:rows.length,delivered,failed};
};
