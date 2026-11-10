// APP544: Firebase Admin-authenticated owner epoch registration in shared D1.
// OFF/unrouted. Server-only HMAC with fixed payload and idempotent CAS.
// NEVER accept actor-provided epoch, overwrite another generation or delete
// follower relationships/profile originals.
export const APP544_OWNER_EPOCH_BIND_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/,HEX=/^[0-9a-f]{64}$/;
const reply=(status,code)=>Response.json({ok:status===200,code},{status,
 headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const hexBytes=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
export async function handleOwnerEpochBinding544({
 request,env,now=Date.now,enabled=APP544_OWNER_EPOCH_BIND_COMPILED_OPEN,
}={}){
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_BIND_544!=='1')return reply(503,'DISABLED');
 if(request?.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
 const secret=env.SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544;
 if(typeof secret!=='string'||secret.length<32)return reply(503,'SECRET_UNAVAILABLE');
 const at=String(request.headers.get('X-Soridraw-Owner-Epoch-At')||'');
 const signature=String(request.headers.get('X-Soridraw-Owner-Epoch-Signature')||'');
 if(!/^\d{13}$/.test(at)||!HEX.test(signature)||
    Math.abs(now()-Number(at))>60000)return reply(403,'INVALID_AUTH');
 let body;
 try{
  const b=await request.arrayBuffer();
  if(b.byteLength<85||b.byteLength>512)return reply(403,'INVALID_BODY');
  body=new TextDecoder('utf-8',{fatal:true}).decode(b);
 }catch{return reply(403,'INVALID_BODY')}
 try{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!(await crypto.subtle.verify('HMAC',key,hexBytes(signature),
       new TextEncoder().encode(at+'.'+body))))
   return reply(403,'INVALID_AUTH');
 }catch{return reply(403,'INVALID_AUTH')}
 let event;try{event=JSON.parse(body)}catch{return reply(403,'INVALID_BODY')}
 if(!event||typeof event!=='object'||Array.isArray(event)||
    Object.keys(event).sort().join(',')!=='action,at,authCreatedAtMs,authEpoch,uid'||
    !['bind','revoke'].includes(event.action)||!UID.test(event.uid)||
    !EPOCH.test(event.authEpoch)||event.at!==Number(at)||
    !Number.isSafeInteger(event.authCreatedAtMs)||event.authCreatedAtMs<=0)
  return reply(403,'INVALID_BODY');
 try{
  if(!env.DB)return reply(503,'DB_UNAVAILABLE');
  if(event.action==='bind'){
   const result=await env.DB.prepare(`
    INSERT INTO profile_stats
     (uid,follower_count,following_count,updated_at,owner_follow_auth_epoch_532)
    VALUES (?,0,0,?,?)
    ON CONFLICT(uid) DO UPDATE SET
      owner_follow_auth_epoch_532=excluded.owner_follow_auth_epoch_532
    WHERE profile_stats.owner_follow_auth_epoch_532=''
    RETURNING uid,owner_follow_auth_epoch_532 AS epoch
   `).bind(event.uid,event.at,event.authEpoch).first();
   if(result?.epoch===event.authEpoch)return reply(200,'BOUND');
   const row=await env.DB.prepare(
     'SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=?'
   ).bind(event.uid).first();
   return reply(row?.epoch===event.authEpoch?200:409,
    row?.epoch===event.authEpoch?'ALREADY_BOUND':'GENERATION_CONFLICT');
  }
  const result=await env.DB.prepare(`
   UPDATE profile_stats SET owner_follow_auth_epoch_532=''
   WHERE uid=? AND owner_follow_auth_epoch_532=? RETURNING uid
  `).bind(event.uid,event.authEpoch).first();
  // The outbox drain excludes empty epoch; preserve all canonical rows.
  return reply(200,result?.uid?'REVOKED':'ALREADY_REVOKED');
 }catch{return reply(503,'DB_UNAVAILABLE')}
}
