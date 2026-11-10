// APP532: SOURCE ONLY / no live import / never deploy or enable without approval.
// An Auth account incarnation is a random 128-bit server-created claim; unlike
// a user UID it changes upon delete/recreate. No retired UID table is needed.
// Auth customClaims.soridrawFollowEpoch532 MUST be checked via Firebase Admin
// on every server receipt. Client never supplies identity evidence.
import {validateOwnerFollowOutboxEvent529,nextOwnerFollowRetryAt529}
 from './owner-follow-outbox-529.mjs';

export const OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN=false;
const UID=/^[a-zA-Z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const MAX_ATTEMPTS=8,MAX_BATCH=12;
export const isOwnerFollowAuthEpoch532=e=>typeof e==='string'&&EPOCH.test(e);
export const INLINE_OWNER_FOLLOW_532_UPDATE_SQL=`
 UPDATE profile_stats SET follower_count=?,updated_at=?,
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=? AND follower_count<>?
  AND owner_follow_auth_epoch_532=?`;
export const INLINE_OWNER_FOLLOW_532_SELECT_SQL=`
 SELECT uid AS owner_uid, owner_follow_revision_530 AS revision,
 follower_count,updated_at,owner_follow_attempts_530 AS attempts,
 owner_follow_acked_revision_530 AS acked_revision,
 owner_follow_auth_epoch_532 AS auth_epoch
 FROM profile_stats INDEXED BY idx_owner_follow_due_530
 WHERE owner_follow_revision_530>owner_follow_acked_revision_530
 AND owner_follow_dead_at_530=0 AND owner_follow_attempts_530<8
 AND owner_follow_auth_epoch_532<>''
 AND owner_follow_next_at_530<=?
 ORDER BY owner_follow_next_at_530 ASC,uid ASC LIMIT ?`;
// APP551 overlay mode is explicitly opt-in. Never publish historical
// profile_stats.follower_count alone after the real cutover became overlay.
// The two enrolment offsets are built only after current Firebase Auth proof.
export const INLINE_OWNER_FOLLOW_551_SELECT_SQL=
 INLINE_OWNER_FOLLOW_532_SELECT_SQL.replace(
  'follower_count,updated_at,',
  '(follower_count+owner_follow_baseline_offset_551+owner_follow_overlay_delta_551) AS follower_count,updated_at,'
 );
export const normalizeOwnerFollowEpochEvent532=raw=>{
 const ev=validateOwnerFollowOutboxEvent529(raw);
 return ev&&isOwnerFollowAuthEpoch532(raw.auth_epoch)
  ?{...ev,authEpoch:raw.auth_epoch}:null;
};
// This is a SOURCE-ONLY receiver authorization helper; it must be invoked
// AFTER the signed raw-body/HMAC validation in the existing Function.
export const authorizeOwnerFollowEpoch532=async(event,{getAuthUser}={})=>{
 if(!event||!UID.test(String(event.ownerUid||''))||
    !isOwnerFollowAuthEpoch532(event.authEpoch)||
    !Number.isSafeInteger(event.version)||event.version<=0||
    !Number.isSafeInteger(event.followerCount)||event.followerCount<0||
    event.followerCount>1_000_000_000||
    typeof getAuthUser!=='function')
  return {allowed:false,reason:'invalid'};
 let user;
 try{user=await getAuthUser(event.ownerUid);}
 catch(error){
  // Auth user-not-found is a stable stale generation; other failures must
  // retry without writing a marker or confirming success.
  if(error?.code==='auth/user-not-found')
   return {allowed:false,reason:'deleted'};
  throw error;
 }
 if(!user)return {allowed:false,reason:'deleted'};
 if(user.uid!==event.ownerUid||
    user.customClaims?.soridrawFollowEpoch532!==event.authEpoch)
  return {allowed:false,reason:'incarnation-mismatch'};
 return {allowed:true,authEpoch:event.authEpoch};
};
export const nextOwnerFollowMarker532=(current,event,verifiedEpoch,now)=>{
 if(!isOwnerFollowAuthEpoch532(verifiedEpoch)||
    event?.authEpoch!==verifiedEpoch)throw Error('532_UNVERIFIED_AUTH_EPOCH');
 const oldEpoch=current?.authEpoch;
 const oldVersion=Number(current?.version||0);
 if(oldEpoch===verifiedEpoch&&Number.isSafeInteger(oldVersion)&&
    oldVersion>=event.version)return undefined;
 // A different verified Auth incarnation can reset revision to 1.
 return {ownerUid:event.ownerUid,authEpoch:verifiedEpoch,
   version:event.version,followerCount:event.followerCount,
   receiptId:verifiedEpoch+':'+event.version,at:now};
};
// Old in-flight ACK/failure must not mutate a recreated UID's same revision.
// Every state update is CAS-fenced by (uid, Auth epoch, revision).
export const drainOwnerFollowAuthEpoch532=async({
 db,deliver,now=Date.now,enabled=OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN,
 limit=MAX_BATCH,overlayRevisionSource=false,
}={})=>{
 if(!enabled)return {skipped:true,selected:0,delivered:0,failed:0};
 if(!db||typeof db.prepare!=='function'||typeof deliver!=='function')
  throw Error('532_BACKEND_UNAVAILABLE');
 const at=now(),n=Math.max(1,Math.min(MAX_BATCH,Math.floor(Number(limit)||1)));
 const sql=overlayRevisionSource
  ?INLINE_OWNER_FOLLOW_551_SELECT_SQL:INLINE_OWNER_FOLLOW_532_SELECT_SQL;
 const page=await db.prepare(sql).bind(at,n).all();
 const rows=Array.isArray(page?.results)?page.results:[];
 let delivered=0,failed=0;
 for(const raw of rows){
  const event=normalizeOwnerFollowEpochEvent532(raw);
  if(!event)throw Error('532_INVALID_DURABLE_EVENT');
  let ok=false;try{ok=await deliver(event)===true;}catch{}
  if(ok){
   await db.prepare(`UPDATE profile_stats
    SET owner_follow_acked_revision_530=?,owner_follow_delivered_at_530=?
    WHERE uid=? AND owner_follow_auth_epoch_532=?
      AND owner_follow_revision_530=? AND owner_follow_acked_revision_530<?`)
    .bind(event.version,now(),event.ownerUid,event.authEpoch,
      event.version,event.version).run();
   delivered++;
  }else{
   const attempts=event.attempts+1,dead=attempts>=MAX_ATTEMPTS?now():0;
   await db.prepare(`UPDATE profile_stats SET
    owner_follow_attempts_530=?,owner_follow_next_at_530=?,
    owner_follow_dead_at_530=?
    WHERE uid=? AND owner_follow_auth_epoch_532=?
      AND owner_follow_revision_530=? AND owner_follow_attempts_530=?
      AND owner_follow_acked_revision_530<?`)
    .bind(attempts,dead?0:nextOwnerFollowRetryAt529(attempts,now()),
     dead,event.ownerUid,event.authEpoch,event.version,event.attempts,event.version).run();
   failed++;
  }
 }
 return {skipped:false,selected:rows.length,delivered,failed};
};
