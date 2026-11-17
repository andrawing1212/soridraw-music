// APP713 PREVIEW candidate: durable client-click intent state for a dedicated
// per-(actor,target) DO instance. SOURCE ONLY / no route, import or deployment.
// The ingress MUST verify Firebase Auth+AppCheck before providing principalUid;
// the alarm MUST call a private capability-verified canonical writer. Never
// persist bearer/AppCheck tokens in DO storage or publish uncommitted counts.
export const APP713_SERVER_CLICK_QUEUE_COMPILED_OPEN = false;
export const APP713_FIRST_CLICK_WINDOW_MS = 5_000;
const KEY='follow-click-intent-713';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const DEVICE=/^[A-Za-z0-9_-]{8,80}$/;
const MAX_WINDOWS=2, MAX_DEVICES=8, MAX_ATTEMPTS=8;
const RECEIPT_RETENTION_MS=24*60*60_000;
const fail=status=>({ok:false,status});
const backoff=attempt=>Math.min(60_000,1000*2**Math.max(0,attempt-1));
export function createFollowClickIntent713({
 storage,env,now=Date.now,commit,makeOperationId=()=>crypto.randomUUID().replaceAll('-','_'),
 enabled=APP713_SERVER_CLICK_QUEUE_COMPILED_OPEN,
}={}){
 const allowed=()=>enabled===true&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
   env?.SORIDRAW_FOLLOW_SERVER_CLICK_713==='1'&&
   env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&
   env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only';
 const valid=(actorUid,ownerUid,desired,deviceId,sequence,issuedAtSec)=>
   UID.test(String(actorUid||''))&&UID.test(String(ownerUid||''))&&
   actorUid!==ownerUid&&typeof desired==='boolean'&&
   DEVICE.test(String(deviceId||''))&&Number.isSafeInteger(sequence)&&
   sequence>0&&sequence<=Number.MAX_SAFE_INTEGER&&
   Number.isSafeInteger(issuedAtSec)&&issuedAtSec>0;
 // A separate DO instance keyed on actor+owner keeps the APP711 owner's
 // notification pending/alarm untouched. One alarm covers this pair's windows.
 const submit=async({principalUid,ownerUid,desired,deviceId,sequence,issuedAtSec}={})=>{
  if(!allowed()||!storage?.transaction)return fail('disabled');
  if(!valid(principalUid,ownerUid,desired,deviceId,sequence,issuedAtSec))
   return fail('invalid-intent');
  const at=now();
  try{return await storage.transaction(async tx=>{
   const existing=await tx.get(KEY);
   const old=existing?.retainUntil&&existing.retainUntil<=at?null:existing;
   if(old&&(old.actorUid!==principalUid||old.ownerUid!==ownerUid))
    return fail('identity-conflict');
   const state=old||{actorUid:principalUid,ownerUid,windows:[],deviceFloors:{}};
   const floor=Number(state.deviceFloors[deviceId]||0);
   if(sequence<=floor){
    const receipt=state.deviceReceipts?.[deviceId];
    return sequence===floor&&receipt?.sequence===sequence?
      {ok:true,status:'already-accepted',
       generation:receipt.operationId,dueAt:receipt.dueAt}:
      fail('stale-sequence');
   }
   if(!Object.hasOwn(state.deviceFloors,deviceId)&&
     Object.keys(state.deviceFloors).length>=MAX_DEVICES)
    return fail('device-limit');
   const windows=[...state.windows];
   // A terminal held operation must never falsely accept a later click that
   // the alarm cannot reach. Repair requires explicit operator review.
   if(windows.some(window=>window.status==='dead'))return fail('manual-hold');
   let tail=windows.at(-1);
   if(!tail||tail.status!=='waiting'||at>=tail.dueAt){
    if(windows.length>=MAX_WINDOWS)return fail('pair-window-full');
    const operationId='click713_'+makeOperationId();
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(operationId))
     return fail('invalid-operation-id');
    tail={operationId,dueAt:at+APP713_FIRST_CLICK_WINDOW_MS,
      desired,issuedAtSec,attempts:0,status:'waiting',nextAttemptAt:0};
    windows.push(tail);
   }else{
    // First click's five-second floor NEVER slides on rapid follow/unfollow.
    tail={...tail,desired};
    windows[windows.length-1]=tail;
   }
   const next={...state,windows,
    deviceFloors:{...state.deviceFloors,[deviceId]:sequence},
    deviceReceipts:{...(state.deviceReceipts||{}),
     [deviceId]:{sequence,operationId:tail.operationId,dueAt:tail.dueAt}}};
   await tx.put(KEY,next);
   // Cloudflare DurableObjectTransaction has only KV methods (get/put/delete/list).
   // With the already-SQLite-backed DO class, direct storage alarm APIs
   // called inside transaction() join the same transaction.
   const alarm=await storage.getAlarm();
   const due=windows[0].status==='waiting'?
     windows[0].dueAt:Math.max(at+1000,windows[0].nextAttemptAt||at+1000);
   if(!Number.isSafeInteger(alarm)||alarm<=at||alarm>due)
    await storage.setAlarm(due);
   return {ok:true,status:'accepted',generation:tail.operationId,
     dueAt:tail.dueAt};
  });}catch{return fail('durable-reservation-unavailable')}
 };
 const alarm=async()=>{
  if(!allowed()||!storage?.transaction||typeof commit!=='function')
   return fail('disabled');
  const at=now();
  let item;
  try{
   const initial=await storage.get(KEY);
   if(!initial?.windows?.length){
    if(initial?.retainUntil&&initial.retainUntil<=at){
     await storage.delete(KEY);
     return {ok:true,status:'expired-receipt'};
    }
    if(initial?.retainUntil>at){await storage.setAlarm(initial.retainUntil);
     return {ok:true,status:'receipt-retained'};}
    return {ok:true,status:'empty'};
   }
   item=initial.windows[0];
   if(item.status==='dead')return fail('manual-hold');
   // A previously authenticated click is NOT an unlimited delegation.
   // Never change a relationship hours after a prolonged service outage.
   if(at>item.dueAt+10*60_000)return fail('expired-click-manual-hold');
   const due=item.status==='waiting'?item.dueAt:item.nextAttemptAt;
   if(due>at){await storage.setAlarm(due);return {ok:true,status:'not-due'}}
   // Fence later arrivals: once this window starts, subsequent clicks
   // create a new window instead of mutating a possibly committed operation.
   if(item.status==='waiting'){
    await storage.transaction(async tx=>{
     const latest=await tx.get(KEY);
     if(latest?.windows?.[0]?.operationId!==item.operationId)return;
     item={...latest.windows[0],status:'committing'};
     await tx.put(KEY,{...latest,windows:[item,...latest.windows.slice(1)]});
    });
   }
  }catch{return fail('storage-unavailable')}
  let result;
  try{result=await commit({
   actorUid:(await storage.get(KEY)).actorUid,
   ownerUid:(await storage.get(KEY)).ownerUid,
   desired:item.desired,operationId:item.operationId,issuedAtSec:item.issuedAtSec,
  });}catch{result=null;}
  const confirmed=result?.ok===true&&result?.canonicalFollowing===item.desired&&
    Number.isSafeInteger(result?.revision)&&result.revision>=0;
  try{return await storage.transaction(async tx=>{
   const latest=await tx.get(KEY);
   if(latest?.windows?.[0]?.operationId!==item.operationId)
    return fail('generation-held');
   let windows=latest.windows.slice(1);
   if(!confirmed){
    const attempts=item.attempts+1;
    const dead=attempts>=MAX_ATTEMPTS;
    windows=[{...item,status:dead?'dead':'committing',
     attempts,nextAttemptAt:dead?0:now()+backoff(attempts)},...windows];
   }
   if(!windows.length){
    // Preserve bounded per-device sequence floors after settlement, so an
    // old reordered click cannot re-open a new window after the first ACK.
    const retainUntil=now()+RECEIPT_RETENTION_MS;
    await tx.put(KEY,{...latest,windows:[],retainUntil,
     lastReceipt:{operationId:item.operationId,dueAt:item.dueAt,
      desired:item.desired,revision:result.revision}});
    await storage.setAlarm(retainUntil);
    return {ok:true,status:result?.changed===true?'committed':'noop',
     revision:result.revision};
   }
   await tx.put(KEY,{...latest,windows});
   if(windows[0].status!=='dead'){
    const due=windows[0].status==='waiting'?
      windows[0].dueAt:windows[0].nextAttemptAt;
    await storage.setAlarm(Math.max(now()+1,due));
   }
   return confirmed?{ok:true,status:'next-window-scheduled'}
     :fail(windows[0].status==='dead'?'manual-hold':'retry-scheduled');
  });}catch{return fail('storage-unavailable')}
 };
 return {submit,alarm};
}
