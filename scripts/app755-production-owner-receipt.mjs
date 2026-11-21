// APP755: source-only, owner-scoped Durable Object receipt storage adapter.
// Runs ONLY inside a separately approved owner DO class with storage.transaction.
// No class, migration, binding, route, alarm deployment or Functions call here.
// Server-owned operation ID must differ from the APP354 client correlation ID.
export const APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const KEY='app755-owner-follow-pending-v1',MAX=24,DELAY=1000;
// APP762: finished receipts move to owner-DO-local immutable per-operation
// keys. Never delete/timestamp-expire them: the same canonical ID must always
// map to its original server-issued receipt, including across Worker upgrades.
const FINAL_PREFIX='app762-owner-follow-final-';
const finalKey=id=>FINAL_PREFIX+id;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const validDelivery=d=>d===undefined||(
 d&&['pending','delivered','held'].includes(d.status)&&
 safe(d.attempts)&&d.attempts<=3&&
 (d.status!=='pending'||(safe(d.retryAt)&&d.retryAt>0)));
const hold=x=>{throw Error('APP755_RECEIPT_HOLD_'+x)};
const same=(a,b)=>a.actorUid===b.actorUid&&a.ownerUid===b.ownerUid&&
 a.canonicalOperationId===b.canonicalOperationId&&
 a.expectedRevision===b.expectedRevision&&a.desired===b.desired;
const validInput=x=>x&&UID.test(x.ownerUid||'')&&UID.test(x.actorUid||'')&&
 x.actorUid!==x.ownerUid&&OP.test(x.canonicalOperationId||'')&&
 safe(x.expectedRevision)&&typeof x.desired==='boolean';
const validReceipt=x=>validInput(x)&&OP.test(x.operationId||'')&&
 x.operationId!==x.canonicalOperationId&&EPOCH.test(x.authEpoch||'')&&
 typeof x.cutoverToken==='string'&&x.cutoverToken.length>0&&
 x.cutoverToken.length<=128&&safe(x.priorR2Revision)&&
 typeof x.beforeFollowing==='boolean'&&
 x.beforeFollowing!==x.desired&&x.durable===true&&
 x.ownerDoAlarmScheduled===true&&validDelivery(x.delivery);
const validFinal=(v,id,owner)=>validReceipt(v)&&
 v.canonicalOperationId===id&&v.ownerUid===owner&&
 ['delivered','held'].includes(v.delivery?.status);
const validState=(s,owner)=>s?.version===1&&s.ownerUid===owner&&
 (s.archiveUsed===undefined||s.archiveUsed===true)&&
 Array.isArray(s.entries)&&s.entries.length<=MAX&&
 s.entries.every(validReceipt)&&
 new Set(s.entries.map(x=>x.canonicalOperationId)).size===s.entries.length&&
 new Set(s.entries.map(x=>x.operationId)).size===s.entries.length;
// Function has no HTTP endpoint. Pass only a trusted owner-specific DO storage,
// never the browser request or an arbitrary remote service namespace.
export function createApp755ProductionOwnerReceiptStore({
 storage,ownerUid,enabled=APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN,
 now=Date.now,issueId=()=>('owner_755_'+crypto.randomUUID().replaceAll('-','')),
}={}){
 if(enabled!==true) return null;
 if(!UID.test(ownerUid||'')||!storage||
    !['get','getAlarm','setAlarm','transaction'].every(k=>typeof storage[k]==='function')||
    typeof now!=='function'||typeof issueId!=='function')hold('OWNER_STORAGE_UNVERIFIED');
 const scope=x=>{if(!validInput(x)||x.ownerUid!==ownerUid)hold('OWNER_SCOPE_OR_INPUT')};
 const load=async st=>{
   const state=await st.get(KEY);
   if(state===undefined||state===null)return {version:1,ownerUid,entries:[]};
   if(!validState(state,ownerUid))hold('PERSISTED_STATE_UNVERIFIED');
   return state;
 };
 // Legacy v1 storage with no archiveUsed flag retains the original single
 // read path. Once the first terminal receipt is archived, lookups check
 // exactly one indexed key (no list scans, no background polling).
 const receiptFor=async(st,state,id)=>{
   const current=state.entries.find(x=>x.canonicalOperationId===id);
   if(current||state.archiveUsed!==true)return current||null;
   const finished=await st.get(finalKey(id));
   if(finished===undefined||finished===null)return null;
   if(!validFinal(finished,id,ownerUid))hold('ARCHIVED_RECEIPT_UNVERIFIED');
   return finished;
 };
 const alarmReady=async(st,requestedAt)=>{
   const at=now();if(!safe(at)||at===0)hold('CLOCK');
   const target=Math.max(at+1,requestedAt??at+DELAY);
   const due=await st.getAlarm();
   if(!safe(due)||due<=at||due>target){
     await st.setAlarm(target);
   }
 };
 return {
   async find(input){
     scope(input);
     // Any storage failure is unknown, NEVER authoritative absence.
     try{
       const state=await load(storage);
       const conflict=await receiptFor(storage,state,input.canonicalOperationId);
       if(!conflict)return {status:'absent',authoritative:true,...input};
       if(!same(conflict,input))return {status:'unknown'};
       // A partial failure between durable put and alarm cannot be a
       // successful reservation until the same receipt's alarm is rearmed.
       if(!conflict.delivery||conflict.delivery.status==='pending')
         await alarmReady(storage,conflict.delivery?.retryAt);
       return {status:'found',receipt:conflict};
     }catch{return {status:'unknown'}}
   },
   async reserve(input){
     scope(input);
     if(!EPOCH.test(input.authEpoch||'')||
       typeof input.cutoverToken!=='string'||!input.cutoverToken||
       input.cutoverToken.length>128||!safe(input.priorR2Revision)||
       typeof input.beforeFollowing!=='boolean'||
       input.beforeFollowing===input.desired)
       hold('TRUSTED_CANONICAL_PREFLIGHT_MISSING');
     try{
       return await storage.transaction(async tx=>{
         const state=await load(tx);
         const previous=await receiptFor(tx,state,input.canonicalOperationId);
         if(previous){
           if(!same(previous,input)||previous.authEpoch!==input.authEpoch||
              previous.cutoverToken!==input.cutoverToken)
             return {durable:false,reason:'conflict'};
           if(!previous.delivery||previous.delivery.status==='pending')
             await alarmReady(tx,previous.delivery?.retryAt);
           return previous;
         }
         let entries=state.entries;
         let archived=false;
         if(entries.length>=MAX){
           // Only finished/held receipts leave the bounded hot queue.
           // Pending work is never lost, acknowledged, or replaced.
           const finishedIndex=entries.findIndex(x=>
             x.delivery?.status==='delivered'||x.delivery?.status==='held');
           if(finishedIndex<0)return {durable:false,reason:'owner-pending-queue-full'};
           const finished=entries[finishedIndex];
           const key=finalKey(finished.canonicalOperationId);
           const prior=await tx.get(key);
           if(prior!==undefined&&prior!==null){
             // An unexpected prior archive must not be overwritten, even if
             // it looks similar. Require exact validated receipt equality.
             if(!validFinal(prior,finished.canonicalOperationId,ownerUid)||
                JSON.stringify(prior)!==JSON.stringify(finished))
               hold('ARCHIVE_COLLISION_OR_CORRUPTION');
           }else await tx.put(key,finished);
           entries=entries.filter((_,i)=>i!==finishedIndex);
           archived=true;
         }
         const id=issueId();
         if(!OP.test(id||'')||id===input.canonicalOperationId||
           entries.some(x=>x.operationId===id))
           hold('SERVER_OPERATION_ID_UNVERIFIED');
         const receipt={...input,operationId:id,durable:true,
           ownerDoAlarmScheduled:true,delivery:{status:'pending',attempts:0,
             retryAt:now()+DELAY}};
         // Transaction commits pending receipt and DO alarm together.
         // Any error fails closed; no canonical D1 write may follow.
         await tx.put(KEY,{...state,
           ...(archived?{archiveUsed:true}:{}),
           entries:[...entries,receipt]});
         await alarmReady(tx);
         return receipt;
       });
     }catch{return {durable:false,reason:'storage-or-alarm-uncertain'}}
   },
   // Read only the owner's pending, due receipts. No user data, D1, R2,
   // Firebase or new DO namespace is accessed. An uncertain store is HOLD.
   async duePending(){
     const state=await load(storage);
     const at=now();
     if(!safe(at)||at<=0)hold('CLOCK');
     return state.entries.filter(x=>
       x.delivery===undefined||
       (x.delivery.status==='pending'&&x.delivery.retryAt<=at))
       .sort((a,b)=>a.expectedRevision-b.expectedRevision)
       .slice(0,4);
   },
   // Only the trusted owner DO alarm coordinator calls this after exact
   // canonical settle proof + signed receiver result. Never exposed to HTTP.
   async markDelivery({receipt,result}={}){
     scope(receipt);
     if(!OP.test(receipt.operationId||'')||
       !['delivered','relay-failed','rejected-generation'].includes(result))
       hold('DELIVERY_RESULT_UNVERIFIED');
     return storage.transaction(async tx=>{
       const s=await load(tx);
       const index=s.entries.findIndex(x=>x.operationId===receipt.operationId);
       const old=s.entries[index];
       if(!old||!same(old,receipt)||old.authEpoch!==receipt.authEpoch||
          old.cutoverToken!==receipt.cutoverToken)
         hold('DELIVERY_RECEIPT_MISMATCH');
       const oldState=old.delivery?.status||'pending';
       if(oldState!=='pending')return {status:oldState,changed:false};
       const at=now();
       if(!safe(at)||at<=0)hold('CLOCK');
       const attempts=old.delivery?.attempts||0;
       const nextAttempts=result==='relay-failed'?attempts+1:attempts;
       const status=result==='delivered'?'delivered':
         result==='rejected-generation'||nextAttempts>=3?'held':'pending';
       const retryAt=status==='pending'?at+Math.min(4000,1000*2**nextAttempts):null;
       const updated={...old,delivery:{status,attempts:nextAttempts,
         ...(retryAt!==null?{retryAt}:{})}};
       const entries=s.entries.slice();
       entries[index]=updated;
       await tx.put(KEY,{...s,entries});
       // Always preserve other owners' pending receipts; no global
       // polling, queue deletion, or fabricated success on a failed ACK.
       const next=entries.filter(x=>(x.delivery?.status||'pending')==='pending');
       if(next.length){
         const earliest=Math.min(...next.map(x=>x.delivery?.retryAt||at+DELAY));
         await tx.setAlarm(Math.max(at+1,earliest));
       }else if(typeof tx.deleteAlarm==='function'){
         await tx.deleteAlarm();
       }
       return {status,changed:true,attempts:nextAttempts};
     });
   },
 };
}
