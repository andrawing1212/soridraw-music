// APP544: Firebase Admin-authenticated owner epoch registration in shared D1.
// OFF/unrouted. Server-only HMAC with fixed payload and idempotent CAS.
// NEVER accept actor-provided epoch, overwrite another generation or delete
// follower relationships/profile originals. APP546 enforces a monotonic
// Firebase Auth creation-time floor in the RETAINED canonical profile row.
// A physical profile-row erase has NO automatic enrollment fallback.
// APP547 verifies CURRENT Firebase Auth/Firebase lifecycle before and after
// D1 registration, so a stale 60-second signed request cannot bind a newly
// recreated profile row for a different Auth incarnation.
import {verifyLiveOwnerEpoch547} from './owner-follow-current-auth-547.mjs';
export const APP544_OWNER_EPOCH_BIND_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/,HEX=/^[0-9a-f]{64}$/;
const reply=(status,code)=>Response.json({ok:status===200,code},{status,
 headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const hexBytes=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
export async function handleOwnerEpochBinding544({
 request,env,now=Date.now,enabled=APP544_OWNER_EPOCH_BIND_COMPILED_OPEN,
 verify=verifyLiveOwnerEpoch547,
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
 // APP574: HMAC is necessary, but never sufficient to register other owners.
 // An unset canary is an intentional hard OFF, before all D1/Auth reads.
 if(event.uid!==String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||''))
  return reply(409,'OWNER_CANARY_HOLD');
 // Signed *historical* events are not live Auth proof; fail closed if
 // Firebase Admin is unreachable or identifies a newer/deleted generation.
 let active;
 try{active=await verify({event,env,now})}
 catch{return reply(503,'AUTH_PROOF_UNAVAILABLE')}
 if(active!==true)return reply(409,'AUTH_GENERATION_NOT_CURRENT');
 try{
  if(!env.DB)return reply(503,'DB_UNAVAILABLE');
  if(event.action==='bind'){
   // APP551: only the globally active overlay phase may use the derived
   // effective-count anchor. No implicit enrollment or whole-user backfill.
   const overlayMode=env?.SORIDRAW_OWNER_FOLLOW_OVERLAY_551==='1';
   // APP570: W2 durable-DO relay and the old APP530/551 D1 revision
   // transport are mutually exclusive. A mixed release would add profile
   // writes, duplicate delivery, and require absent 8-column schema.
   if(overlayMode&&env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1')
    return reply(503,'OWNER_FOLLOW_TRANSPORT_CONFLICT');
   if(overlayMode){
    const control=await env.DB.prepare(
      'SELECT phase FROM explore_follow_cutover_control_348 WHERE id=1 LIMIT 1'
    ).first();
    if(control?.phase!=='overlay')return reply(409,'FOLLOW_AUTHORITY_PHASE_HOLD');
   }
   // APP546: NEVER create a profile_stats row from a signed registration.
   // Store the Firebase Auth creation-time floor in the already-retained
   // canonical profile row. Revocation clears the epoch, NOT the floor.
   // Current Auth proof (APP547) is mandatory for same-generation retries. A
 // removed incarnation cannot pass that live proof, even after row erasure.
   // Physical removal of this row requires a separately approved lifecycle:
   // do not enrol before its new generation has a verified durable anchor.
   const overlaySql=`
    UPDATE profile_stats SET
      owner_follow_auth_epoch_532=?,
      owner_follow_auth_created_at_ms_544=?,
      owner_follow_baseline_offset_551=(
        SELECT COUNT(*) FROM follows WHERE following_uid=?
      )-follower_count,
      owner_follow_overlay_delta_551=(
        SELECT COALESCE(SUM(following-baseline_following),0)
        FROM explore_follow_overrides_348 WHERE following_uid=?
      )
    WHERE uid=? AND owner_follow_auth_epoch_532=''
      AND (owner_follow_auth_created_at_ms_544=0
        OR owner_follow_auth_created_at_ms_544 <= ?)
    RETURNING uid,owner_follow_auth_epoch_532 AS epoch,
      owner_follow_auth_created_at_ms_544 AS created_at
   `;
   // APP570 W2 path writes ONLY the Auth-generation pair. Global follow
   // authority can remain overlay; the settled count comes from exact R2.
   const epochOnlySql=`
    UPDATE profile_stats SET
      owner_follow_auth_epoch_532=?,
      owner_follow_auth_created_at_ms_544=?
    WHERE uid=? AND owner_follow_auth_epoch_532=''
      AND (owner_follow_auth_created_at_ms_544=0
        OR owner_follow_auth_created_at_ms_544 <= ?)
    RETURNING uid,owner_follow_auth_epoch_532 AS epoch,
      owner_follow_auth_created_at_ms_544 AS created_at
   `;
   const result=await env.DB.prepare(overlayMode?overlaySql:epochOnlySql)
     .bind(...(overlayMode
       ?[event.authEpoch,event.authCreatedAtMs,event.uid,event.uid,
         event.uid,event.authCreatedAtMs]
       :[event.authEpoch,event.authCreatedAtMs,event.uid,
         event.authCreatedAtMs])).first();
   let bound=Boolean(result?.epoch===event.authEpoch&&
      result.created_at===event.authCreatedAtMs);
   if(!bound){
    const row=await env.DB.prepare(`
      SELECT owner_follow_auth_epoch_532 AS epoch,
        owner_follow_auth_created_at_ms_544 AS created_at
      FROM profile_stats WHERE uid=?
    `).bind(event.uid).first();
    if(!row)return reply(409,'OWNER_PROFILE_MISSING_HOLD');
    if(row.epoch!==event.authEpoch||
       row.created_at!==event.authCreatedAtMs)
      return reply(409,'AUTH_GENERATION_FLOOR_HOLD');
    bound=true;
   }
   // Cross-service Auth deletion may begin after the first proof. Verify again
   // and undo ONLY this exact old generation if it was withdrawn meanwhile.
   let stillCurrent=false,proofUnavailable=false;
   try{stillCurrent=await verify({event,env,now})===true}
   catch{proofUnavailable=true}
   if(stillCurrent&&bound)return reply(200,result?.uid?'BOUND':'ALREADY_BOUND');
   await env.DB.prepare(`
     UPDATE profile_stats SET owner_follow_auth_epoch_532=''
     WHERE uid=? AND owner_follow_auth_epoch_532=?
       AND owner_follow_auth_created_at_ms_544=?
   `).bind(event.uid,event.authEpoch,event.authCreatedAtMs).run();
   // Preserve birth floor and social rows for the legitimate next incarnation.
   return reply(proofUnavailable?503:409,
     proofUnavailable?'AUTH_POSTPROOF_UNAVAILABLE':'AUTH_CHANGED_DURING_BIND');
  }
  const result=await env.DB.prepare(`
   UPDATE profile_stats SET owner_follow_auth_epoch_532=''
   WHERE uid=? AND owner_follow_auth_epoch_532=?
     AND owner_follow_auth_created_at_ms_544=?
   RETURNING uid
  `).bind(event.uid,event.authEpoch,event.authCreatedAtMs).first();
  // The outbox drain excludes empty epoch; preserve all canonical rows.
  return reply(200,result?.uid?'REVOKED':'ALREADY_REVOKED');
 }catch{return reply(503,'DB_UNAVAILABLE')}
}
