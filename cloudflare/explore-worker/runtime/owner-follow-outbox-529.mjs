// APP529 — Durable D1 outbox drain, SOURCE ONLY. No shared D1 or cron enabled.
// D1 trigger inserts event in SAME canonical profile_stats UPDATE transaction.
// All replays carry the same D1 event_id; arrival time does not determine order.
export const OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN = false;
const MAX_BATCH_529 = 12;
const MAX_ATTEMPTS_529 = 8;
const MAX_SAFE_COUNT_529 = 1_000_000_000;
const UID_529 = /^[a-zA-Z0-9_-]{1,128}$/;
const PINNED_ENDPOINT_529 = 'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower529';

export const validateOwnerFollowOutboxEvent529 = row => {
  const eventId=Number(row?.event_id);
  const ownerUid=String(row?.owner_uid||'').trim();
  const followerCount=Number(row?.follower_count);
  const createdAt=Number(row?.created_at);
  const attempts=Number(row?.attempts);
  if(!Number.isSafeInteger(eventId)||eventId<=0||!UID_529.test(ownerUid)||
     !Number.isSafeInteger(followerCount)||followerCount<0||
     followerCount>MAX_SAFE_COUNT_529||
     !Number.isSafeInteger(createdAt)||createdAt<=0||
     !Number.isSafeInteger(attempts)||attempts<0||attempts>=MAX_ATTEMPTS_529)
    return null;
  return {eventId,ownerUid,followerCount,createdAt,attempts};
};
const hex529=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
export const signOwnerFollowPayload529=async(body,at,secret)=>{
  if(typeof secret!=='string'||secret.length<32)throw Error('OWNER_FOLLOW_529_SECRET_REQUIRED');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex529(await crypto.subtle.sign('HMAC',key,
    new TextEncoder().encode(String(at)+'.'+body)));
};
export const sendOwnerFollowOutboxEvent529=async(row,{endpoint,secret,send=fetch,now=Date.now}={})=>{
  const event=validateOwnerFollowOutboxEvent529(row);
  if(!event)throw Error('OWNER_FOLLOW_529_INVALID_EVENT');
  if(endpoint!==PINNED_ENDPOINT_529)throw Error('OWNER_FOLLOW_529_ENDPOINT_NOT_PINNED');
  const at=now();
  if(!Number.isSafeInteger(at)||at<=0)throw Error('OWNER_FOLLOW_529_CLOCK');
  const body=JSON.stringify({
    version:1,eventId:event.eventId,ownerUid:event.ownerUid,
    followerCount:event.followerCount,createdAt:event.createdAt,at,
  });
  const sig=await signOwnerFollowPayload529(body,at,secret);
  const response=await send(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json',
      'X-Soridraw-Follow-Relay529-At':String(at),
      'X-Soridraw-Follow-Relay529-Signature':sig},
    body,
  });
  return response?.ok===true;
};
export const nextOwnerFollowRetryAt529=(attempts,now)=>{
  const n=Math.max(1,Math.min(MAX_ATTEMPTS_529,Math.floor(Number(attempts)||1)));
  return now+Math.min(60*60_000,15_000*(2**(n-1)));
};

// Consumer can be called from a verified fast path and a single existing
// bounded retry cron. Idempotent RTDB receiver tolerates concurrent drains.
// D1 read is ONLY when enabled; no browser polling or per-profile D1 read.
export const drainOwnerFollowOutbox529=async({
  db, deliver, now=Date.now, enabled=OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN,
  limit=MAX_BATCH_529,
}={})=>{
  if(!enabled)return {skipped:true,selected:0,delivered:0,failed:0};
  if(!db||typeof db.prepare!=='function'||typeof deliver!=='function')
    throw Error('OWNER_FOLLOW_529_BACKEND_UNAVAILABLE');
  const at=now();
  const count=Math.max(1,Math.min(MAX_BATCH_529,Math.floor(Number(limit)||1)));
  const page=await db.prepare(
    'SELECT event_id,owner_uid,follower_count,created_at,attempts FROM explore_owner_follow_outbox_529 '+
    'WHERE delivered_at=0 AND dead_at=0 AND attempts<8 AND next_attempt_at<=? '+
    'ORDER BY event_id ASC LIMIT ?'
  ).bind(at,count).all();
  const rows=Array.isArray(page?.results)?page.results:[];
  let delivered=0,failed=0;
  for(const raw of rows){
    const ev=validateOwnerFollowOutboxEvent529(raw);
    if(!ev)throw Error('OWNER_FOLLOW_529_BAD_DURABLE_RECORD');
    let success=false;
    try{success=await deliver(ev)===true;}catch{}
    if(success){
      await db.prepare('UPDATE explore_owner_follow_outbox_529 SET delivered_at=? '+
        'WHERE event_id=? AND delivered_at=0 AND dead_at=0')
        .bind(now(),ev.eventId).run();
      delivered++;
    }else{
      const attempts=ev.attempts+1;
      const dead=attempts>=MAX_ATTEMPTS_529?now():0;
      await db.prepare('UPDATE explore_owner_follow_outbox_529 '+
        'SET attempts=?,next_attempt_at=?,dead_at=? '+
        'WHERE event_id=? AND delivered_at=0 AND dead_at=0 AND attempts=?')
        .bind(attempts,dead?0:nextOwnerFollowRetryAt529(attempts,now()),dead,ev.eventId,ev.attempts).run();
      failed++;
    }
  }
  return {skipped:false,selected:rows.length,delivered,failed};
};
