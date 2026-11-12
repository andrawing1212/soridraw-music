// APP556/557: run-owned, source-only per-owner Durable Object reservation.
// The authenticated wrapper must commit a validated reservation BEFORE calling
// the canonical overlay Worker. No live DO class, route, binding or deployment.
import {replayOwnerFollowReservation556} from './owner-follow-postcommit-555.mjs';
export const OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const MAX_ATTEMPTS=8,MAX_QUEUE=24,INITIAL_MS=1000;
const valid=r=>r&&UID.test(String(r.ownerUid||''))&&
 UID.test(String(r.actorUid||''))&&r.ownerUid!==r.actorUid&&
 OP.test(String(r.operationId||''))&&
 typeof r.cutoverToken==='string'&&r.cutoverToken.length>0&&r.cutoverToken.length<=128&&
 typeof r.desired==='boolean'&&typeof r.beforeFollowing==='boolean'&&
 r.desired!==r.beforeFollowing&&EPOCH.test(String(r.authEpoch||''))&&
 Number.isSafeInteger(r.expectedRevision)&&r.expectedRevision>=0&&
 Number.isSafeInteger(r.priorR2Revision)&&r.priorR2Revision>=0;
const backoff=n=>Math.min(60*60_000,INITIAL_MS*2**Math.max(0,n-1));
const fail=status=>({ok:false,status});
const identity=r=>r.actorUid+':'+r.operationId;
const same=(a,b)=>a.ownerUid===b.ownerUid&&a.actorUid===b.actorUid&&
 a.operationId===b.operationId&&a.cutoverToken===b.cutoverToken&&
 a.authEpoch===b.authEpoch&&a.desired===b.desired&&
 a.beforeFollowing===b.beforeFollowing&&
 a.expectedRevision===b.expectedRevision&&a.priorR2Revision===b.priorR2Revision;
export function createOwnerFollowRecovery556({
 state,env,now=Date.now,deliver=replayOwnerFollowReservation556,
 enabled=OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,
}={}){
 const storage=state?.storage;
 const allowed=()=>enabled&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
  env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1';
 const reserve=async record=>{
  if(!allowed())return fail('disabled');
  if(!valid(record)||!storage)return fail('invalid-reservation');
  const current=await storage.get('pending');
  if(current&&(current.ownerUid!==record.ownerUid||
     current.authEpoch!==record.authEpoch))return fail('generation-held');
  const entries=Array.isArray(current?.entries)?current.entries:[];
  const old=entries.find(x=>identity(x)===identity(record));
  if(old)return same(old,record)
    ?{ok:true,status:'already-reserved',generation:old.generation}
    :fail('operation-conflict');
  if(entries.length>=MAX_QUEUE)return fail('owner-queue-full');
  const generation=Math.max(0,Number(current?.generation)||0)+1;
  const next={ownerUid:record.ownerUid,authEpoch:record.authEpoch,generation,
   entries:[...entries,{...record,generation,attempts:0,dead:false,nextAttemptAt:0}]};
  // SQLite-backed DO storage batches these consecutive writes. Both awaited
  // promises MUST succeed before the canonical mutation may begin.
  // Keep an already-earlier alarm instead of resetting its one-second timer
  // for every incoming follower. Avoids a billed setAlarm write on bursts and
  // prevents starvation under constant follows. Never skip when absent,
  // overdue, or beyond the desired wake-up deadline.
  const at=now(),due=at+INITIAL_MS;
  const scheduled=typeof storage.getAlarm==='function'
   ?await storage.getAlarm():null;
  const canReuse=Number.isSafeInteger(scheduled)&&
   scheduled>at&&scheduled<=due;
  const put=storage.put('pending',next);
  const wake=canReuse?Promise.resolve():storage.setAlarm(due);
  await Promise.all([put,wake]);
  return {ok:true,status:'reserved',generation};
 };
 const alarm=async()=>{
  if(!allowed()||!storage)return fail('disabled');
  const current=await storage.get('pending');
  if(!current)return {ok:true,status:'empty'};
  const entries=Array.isArray(current.entries)?current.entries:[];
  const live=entries.filter(x=>valid(x)&&!x.dead);
  if(!live.length)return fail('manual-hold');
  // Per-entry deadlines prevent one uncommitted/crashed follow reservation
  // from blocking an unrelated confirmed follow for the same owner.
  // Historical DO entries without nextAttemptAt remain eligible.
  const at=now();
  const dueOf=x=>Number.isSafeInteger(x.nextAttemptAt)&&x.nextAttemptAt>0
    ?x.nextAttemptAt:0;
  const due=live.filter(x=>dueOf(x)<=at);
  // Prefer fresh work over retried work, then preserve old-generation order.
  const item=due.reduce((best,x)=>!best||x.attempts<best.attempts||
    (x.attempts===best.attempts&&x.generation<best.generation)?x:best,null);
  if(!item){
   await storage.setAlarm(Math.max(at+INITIAL_MS,Math.min(...live.map(dueOf))));
   return {ok:true,status:'retry-scheduled',attempts:0};
  }
  let result;
  try{result=await deliver({reservation:item,env,now,enabled:true});}
  catch{result={status:'relay-failed'};}
  const latest=await storage.get('pending');
  const target=latest?.entries?.find(x=>identity(x)===identity(item));
  if(!target||target.generation!==item.generation||
     latest.ownerUid!==item.ownerUid||latest.authEpoch!==item.authEpoch){
   if(latest?.entries?.some(x=>!x.dead))await storage.setAlarm(now()+INITIAL_MS);
   return {ok:true,status:'newer-reservation-preserved'};
  }
  const done=result?.status==='delivered'||result?.status==='rejected-generation';
  const attempts=item.attempts+1;
  const dead=!done&&attempts>=MAX_ATTEMPTS;
  const updated=done
   ?latest.entries.filter(x=>identity(x)!==identity(item))
   :latest.entries.map(x=>identity(x)===identity(item)
     ?{...x,attempts,dead,nextAttemptAt:dead?0:now()+backoff(attempts)}:x);
  if(updated.length===0){
   await storage.delete('pending');
   return {ok:true,status:result.status};
  }
  const put=storage.put('pending',{...latest,entries:updated});
  // One alarm per owner at the next eligible item; a stalled older item
  // retains its durable retry budget, while newer settled work advances.
  const pending=updated.filter(x=>valid(x)&&!x.dead);
  const earliest=pending.length?Math.min(...pending.map(x=>
    Number.isSafeInteger(x.nextAttemptAt)&&x.nextAttemptAt>0
      ?x.nextAttemptAt:0)):0;
  const wake=pending.length
   ?storage.setAlarm(Math.max(now()+INITIAL_MS,earliest))
   :Promise.resolve();
  await Promise.all([put,wake]);
  return {ok:done,status:done?result.status:dead?'manual-hold':'retry-scheduled',
    attempts:done?item.attempts:attempts};
 };
 return {reserve,alarm};
}
