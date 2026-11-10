// APP556 source-only Durable Object adapter for a PRE-COMMIT owner reservation.
// This module is not imported/exported by an active Worker and has no binding.
// Reservations MUST be created by a trusted server AFTER authenticated follow
// admission but BEFORE the canonical D1 mutation; never from a browser route.
// Actual active Worker integration, DO costs and shared rollout remain NO-GO.
import {replayOwnerFollowReservation556} from './owner-follow-postcommit-555.mjs';
export const OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const MAX=8,INITIAL_MS=1000;
const valid=r=>r&&UID.test(String(r.ownerUid||''))&&
 EPOCH.test(String(r.authEpoch||''))&&
 Number.isSafeInteger(r.priorR2Revision)&&r.priorR2Revision>=0;
const backoff=n=>Math.min(60*60_000,INITIAL_MS*2**Math.max(0,n-1));
const fail=status=>({ok:false,status});

// state.storage is a per-owner DO persistent store; its put/setAlarm are
// issued without an intervening await so Cloudflare can batch their writes.
// A failed reservation MUST block the canonical mutation at its future caller.
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
  const prev=await storage.get('pending');
  const same=prev?.authEpoch===record.authEpoch&&prev?.ownerUid===record.ownerUid;
  const generation=Math.max(0,Number(prev?.generation)||0)+1;
  const pending={ownerUid:record.ownerUid,authEpoch:record.authEpoch,
   priorR2Revision:same?Math.min(prev.priorR2Revision,record.priorR2Revision):record.priorR2Revision,
   generation,attempts:0,dead:false};
  // Both operations must durably complete before returning success. If either
  // fails, the future integration MUST not proceed to the canonical writer.
  const put=storage.put('pending',pending);
  const alarm=storage.setAlarm(now()+INITIAL_MS);
  await Promise.all([put,alarm]);
  return {ok:true,status:'reserved',generation};
 };
 const alarm=async()=>{
  if(!allowed()||!storage)return fail('disabled');
  const pending=await storage.get('pending');
  if(!pending)return {ok:true,status:'empty'};
  if(!valid(pending)||pending.dead)return fail('manual-hold');
  let result;
  try{result=await deliver({reservation:pending,env,now,enabled:true});}
  catch{result={status:'relay-failed'};}
  const latest=await storage.get('pending');
  // A new reservation arrived during the HTTP call. Never clear or overwrite it.
  if(latest?.generation!==pending.generation||latest?.authEpoch!==pending.authEpoch){
   if(latest&&!latest.dead)await storage.setAlarm(now()+INITIAL_MS);
   return {ok:true,status:'newer-reservation-preserved'};
  }
  if(result?.status==='delivered'||result?.status==='rejected-generation'){
   await storage.delete('pending');
   return {ok:true,status:result.status};
  }
  const attempts=pending.attempts+1;
  const dead=attempts>=MAX;
  const next={...pending,attempts,dead};
  const put=storage.put('pending',next);
  const wake=dead?Promise.resolve():storage.setAlarm(now()+backoff(attempts));
  await Promise.all([put,wake]);
  return {ok:false,status:dead?'manual-hold':'retry-scheduled',attempts};
 };
 return {reserve,alarm};
}
