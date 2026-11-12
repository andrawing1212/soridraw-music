// APP531 physical-profile deletion/recreation: SOURCE ONLY, compiler OFF.
// A durable retirement revision is stored by the AFTER DELETE D1 trigger.
// This bounded drain runs ONLY when explicitly invoked in a future release;
// it never polls or touches the live shared database under current code.
import {validateOwnerFollowOutboxEvent529,nextOwnerFollowRetryAt529}
 from './owner-follow-outbox-529.mjs';
export const OWNER_FOLLOW_RETIRED_531_COMPILED_OPEN=false;
export const OWNER_FOLLOW_RETIRED_531_SELECT_SQL=`
 SELECT t.owner_uid,t.revision,0 AS follower_count,
 t.deleted_at AS updated_at,t.attempts,t.acked_revision
 FROM explore_owner_follow_retired_531 t INDEXED BY idx_owner_follow_retired_due_531
 WHERE t.revision>t.acked_revision AND t.dead_at=0
  AND t.attempts<8 AND t.next_attempt_at<=?
  AND NOT EXISTS(SELECT 1 FROM profile_stats p WHERE p.uid=t.owner_uid)
 ORDER BY t.next_attempt_at ASC,t.owner_uid ASC LIMIT ?`;
const MAX_BATCH=12,MAX_ATTEMPTS=8;
export const drainOwnerFollowRetired531=async({
 db,deliver,now=Date.now,enabled=OWNER_FOLLOW_RETIRED_531_COMPILED_OPEN,
 limit=MAX_BATCH,
}={})=>{
 if(!enabled)return {skipped:true,selected:0,delivered:0,failed:0};
 if(!db||typeof db.prepare!=='function'||typeof deliver!=='function')
  throw Error('RETIRED_531_BACKEND_UNAVAILABLE');
 const when=now(),size=Math.max(1,Math.min(MAX_BATCH,Math.floor(Number(limit)||1)));
 const page=await db.prepare(OWNER_FOLLOW_RETIRED_531_SELECT_SQL).bind(when,size).all();
 const rows=Array.isArray(page?.results)?page.results:[];
 let delivered=0,failed=0;
 for(const raw of rows){
  const event=validateOwnerFollowOutboxEvent529({...raw,retired:true});
  if(!event)throw Error('RETIRED_531_INVALID_DURABLE_ROW');
  let ok=false;try{ok=await deliver(event)===true;}catch{}
  if(ok){
   await db.prepare(`UPDATE explore_owner_follow_retired_531
    SET acked_revision=?,delivered_at=? WHERE owner_uid=?
    AND revision=? AND acked_revision<?`)
    .bind(event.version,now(),event.ownerUid,event.version,event.version).run();
   delivered++;
  }else{
   const attempts=event.attempts+1,dead=attempts>=MAX_ATTEMPTS?now():0;
   await db.prepare(`UPDATE explore_owner_follow_retired_531
    SET attempts=?,next_attempt_at=?,dead_at=?
    WHERE owner_uid=? AND revision=? AND attempts=? AND acked_revision<?`)
    .bind(attempts,dead?0:nextOwnerFollowRetryAt529(attempts,now()),
      dead,event.ownerUid,event.version,event.attempts,event.version).run();
   failed++;
   if(dead)console.warn('[531] OWNER_FOLLOW_RETIREMENT_DEAD_HOLD_REQUIRES_ADMIN_REPLAY');
  }
 }
 return {skipped:false,selected:rows.length,delivered,failed};
};
