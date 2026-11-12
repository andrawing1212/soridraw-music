// APP530 source-only alternative. No shared Worker import, config, or deployment.
import {validateOwnerFollowOutboxEvent529,nextOwnerFollowRetryAt529}
 from './owner-follow-outbox-529.mjs';
export const INLINE_OWNER_FOLLOW_530_COMPILED_OPEN=false;
// Updated canonical Writer only: BOTH follower_count and durable revision are
// committed in ONE profile_stats UPDATE (vs legacy fallback trigger 2 writes).
// This must not be used until 3-environment worker/rollout compatibility is proven.
export const INLINE_OWNER_FOLLOW_530_UPDATE_SQL=`
 UPDATE profile_stats SET follower_count=?,updated_at=?,
  owner_follow_revision_530=owner_follow_revision_530+1,
  owner_follow_attempts_530=0,owner_follow_next_at_530=0,
  owner_follow_dead_at_530=0
 WHERE uid=? AND follower_count<>?`;
const SELECT_530=`
 SELECT uid AS owner_uid,owner_follow_revision_530 AS revision,
 follower_count,updated_at,
 owner_follow_attempts_530 AS attempts,
 owner_follow_acked_revision_530 AS acked_revision
 FROM profile_stats INDEXED BY idx_owner_follow_due_530
 WHERE owner_follow_revision_530>owner_follow_acked_revision_530
 AND owner_follow_dead_at_530=0 AND owner_follow_attempts_530<8
 AND owner_follow_next_at_530<=?
 ORDER BY owner_follow_next_at_530 ASC,uid ASC LIMIT ?`;
export const INLINE_OWNER_FOLLOW_530_SELECT_SQL=SELECT_530;
const MAX_BATCH=12,MAX_ATTEMPTS=8;
export const drainOwnerFollowInline530=async({
 db,deliver,now=Date.now,enabled=INLINE_OWNER_FOLLOW_530_COMPILED_OPEN,
 limit=MAX_BATCH,
}={})=>{
 if(!enabled)return {skipped:true,selected:0,delivered:0,failed:0};
 if(!db||typeof db.prepare!=='function'||typeof deliver!=='function')
  throw Error('INLINE_530_BACKEND_UNAVAILABLE');
 const when=now(),size=Math.max(1,Math.min(MAX_BATCH,Math.floor(Number(limit)||1)));
 const result=await db.prepare(SELECT_530).bind(when,size).all();
 const rows=Array.isArray(result?.results)?result.results:[];
 let delivered=0,failed=0;
 for(const raw of rows){
  const event=validateOwnerFollowOutboxEvent529(raw);
  if(!event)throw Error('INLINE_530_INVALID_DURABLE_ROW');
  let ok=false;try{ok=await deliver(event)===true;}catch{}
  if(ok){
   await db.prepare(`UPDATE profile_stats
    SET owner_follow_acked_revision_530=?,owner_follow_delivered_at_530=?
    WHERE uid=? AND owner_follow_revision_530=?
    AND owner_follow_acked_revision_530<?`)
    .bind(event.version,now(),event.ownerUid,event.version,event.version).run();
   delivered++;
  }else{
   const attempts=event.attempts+1;
   const dead=attempts>=MAX_ATTEMPTS?now():0;
   await db.prepare(`UPDATE profile_stats SET
    owner_follow_attempts_530=?,owner_follow_next_at_530=?,
    owner_follow_dead_at_530=?
    WHERE uid=? AND owner_follow_revision_530=?
    AND owner_follow_attempts_530=?
    AND owner_follow_acked_revision_530<?`)
    .bind(attempts,dead?0:nextOwnerFollowRetryAt529(attempts,now()),
     dead,event.ownerUid,event.version,event.attempts,event.version).run();
   failed++;
   if(dead)console.warn('[530] OWNER_FOLLOW_INLINE_DEAD_HOLD_REQUIRES_ADMIN_REPLAY');
  }
 }
 return {skipped:false,selected:rows.length,delivered,failed};
};
