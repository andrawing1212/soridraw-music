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
// APP764: independent monotonic per-owner index guards missing archive keys.
// SHA-256 truncated to 128-bit: collisions fail closed; no false negatives
// for an intact index. This is NOT proof across a full DO PITR rollback.
const HEX128=/^[a-f0-9]{32}$/;
const HEX256=/^[a-f0-9]{64}$/;
const digest=async input=>{
 const bytes=new TextEncoder().encode(input);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
};
const archiveWitness=id=>digest(id).then(h=>h.slice(0,32));
const archiveSeal=hashes=>digest(JSON.stringify(hashes));
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const validDelivery=d=>d===undefined||(
 d&&['pending','delivered','held'].includes(d.status)&&
 safe(d.attempts)&&d.attempts<=3&&
 (d.settlementChecks===undefined||safe(d.settlementChecks)&&d.settlementChecks<=4)&&
 (d.holdReason===undefined||d.status==='held'&&d.holdReason==='settlement-unverified')&&
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
// Diagnostic codes are bounded enums only. Never return raw exception text,
// stored values, owner IDs, credentials, or tokens.
const readDiagnostic=(error,phase)=>{
 const m=typeof error?.message==='string'?error.message:'';
 const safeCode=[
  'PERSISTED_STATE_UNVERIFIED','ARCHIVE_WITNESS_MISSING_OR_UNVERIFIED',
  'UNEXPECTED_ARCHIVE_WITNESS','ARCHIVED_RECEIPT_MISSING_WITH_WITNESS',
  'ARCHIVED_RECEIPT_OR_WITNESS_UNVERIFIED'
 ].find(c=>m==='APP755_RECEIPT_HOLD_'+c);
 if(safeCode)return phase+'__'+safeCode;
 const kind=/different request|different durable object|different io context/i.test(m)?'CROSS_CONTEXT':
  /no longer running|context.*closed|not currently running|outside.*request/i.test(m)?'CONTEXT_CLOSED':
  /reset|restart|evict/i.test(m)?'OBJECT_RESET':
  /overload|too many|limit exceeded/i.test(m)?'RESOURCE_LIMIT':
  /timeout|timed out|deadline/i.test(m)?'TIMEOUT':
  /disconnect|connection lost/i.test(m)?'DISCONNECTED':
  /sqlite|database.*locked/i.test(m)?'SQLITE':
  /serializ|deserializ|clone/i.test(m)?'SERIALIZATION':
  /internal error/i.test(m)?'INTERNAL_ERROR':
  'UNCLASSIFIED';
 return phase+'__'+kind;
};
const invalidStateCode=(s,owner)=>{
 if(s?.version!==1)return 'STATE_VERSION';
 if(s.ownerUid!==owner)return 'STATE_OWNER';
 if(s.archiveUsed!==undefined&&s.archiveUsed!==true)return 'STATE_ARCHIVE_FLAG';
 if(!Array.isArray(s.entries)||s.entries.length>MAX)return 'STATE_ENTRIES_SHAPE';
 for(const x of s.entries){
  if(!validInput(x))return 'ENTRY_INPUT';
  if(!OP.test(x.operationId||'')||x.operationId===x.canonicalOperationId)return 'ENTRY_OPERATION_ID';
  if(!EPOCH.test(x.authEpoch||'')||typeof x.cutoverToken!=='string'||!x.cutoverToken||
     x.cutoverToken.length>128)return 'ENTRY_EPOCH_CUTOVER';
  if(!safe(x.priorR2Revision)||typeof x.beforeFollowing!=='boolean'||
     x.beforeFollowing===x.desired)return 'ENTRY_PRIOR_STATE';
  if(x.durable!==true||x.ownerDoAlarmScheduled!==true)return 'ENTRY_DURABILITY';
  if(!validDelivery(x.delivery))return 'ENTRY_DELIVERY';
 }
 return 'STATE_DUPLICATE_IDS';
};
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
 const load=async(st,note)=>{
   note?.('STATE_READ');
   const state=await st.get(KEY);
   note?.('STATE_VALIDATE');
   if(state===undefined||state===null)return {version:1,ownerUid,entries:[]};
   if(!validState(state,ownerUid)){
     if(note)note('STATE_VALIDATE_'+invalidStateCode(state,ownerUid));
     hold('PERSISTED_STATE_UNVERIFIED');
   }
   note?.('ARCHIVE_WITNESS_VALIDATE');
   // Legacy APP755 v1 (no rollover) still reads without an extra key/CPU
   // hash. An APP762-only archived state without witness is UNKNOWN, never
   // authoritative absence: there is no safe silent backfill.
   if(state.archiveUsed===true){
     const hashes=state.archiveWitnesses;
     if(!Array.isArray(hashes)||!HEX256.test(state.archiveWitnessSeal||'')||
       hashes.some((v,i)=>!HEX128.test(v)||(i>0&&hashes[i-1]>=v))||
       await archiveSeal(hashes)!==state.archiveWitnessSeal)
       hold('ARCHIVE_WITNESS_MISSING_OR_UNVERIFIED');
   }else if(state.archiveWitnesses!==undefined||
            state.archiveWitnessSeal!==undefined)
     hold('UNEXPECTED_ARCHIVE_WITNESS');
   return state;
 };
 // Legacy v1 storage with no archiveUsed flag retains the original single
 // read path. Once the first terminal receipt is archived, lookups check
 // exactly one indexed key (no list scans, no background polling).
 const receiptFor=async(st,state,id,note)=>{
   note?.('HOT_RECEIPT_LOOKUP');
   const current=state.entries.find(x=>x.canonicalOperationId===id);
   if(current||state.archiveUsed!==true)return current||null;
   // One indexed read, no listing or remote canonical query. If an
   // archived receipt disappears but its monotonic witness survives,
   // it cannot be represented as 'absent' or minted a second receipt.
   note?.('ARCHIVE_WITNESS_LOOKUP');
   const fingerprint=await archiveWitness(id);
   const seen=state.archiveWitnesses.includes(fingerprint);
   note?.('ARCHIVE_RECEIPT_READ');
   const finished=await st.get(finalKey(id));
   note?.('ARCHIVE_RECEIPT_VALIDATE');
   if(finished===undefined||finished===null){
     if(seen)hold('ARCHIVED_RECEIPT_MISSING_WITH_WITNESS');
     return null;
   }
   if(!seen||!validFinal(finished,id,ownerUid))
     hold('ARCHIVED_RECEIPT_OR_WITNESS_UNVERIFIED');
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
   // Settlement verification must never touch the alarm. Existing find()
   // intentionally rearms pending receipts for admission/recovery callers.
   async inspectReceipt(input,{qaDiagnostic=false}={}){
     scope(input);
     let phase='START';
     const note=qaDiagnostic===true?v=>{phase=v}:undefined;
     try{
       const state=await load(storage,note);
       const receipt=await receiptFor(storage,state,input.canonicalOperationId,note);
       note?.('RECEIPT_IDENTITY_VALIDATE');
       if(!receipt)return {status:'absent',authoritative:true};
       if(!same(receipt,input)||
          receipt.authEpoch!==input.authEpoch||
          receipt.cutoverToken!==input.cutoverToken||
          receipt.priorR2Revision!==input.priorR2Revision||
          receipt.beforeFollowing!==input.beforeFollowing)
         return {status:'unknown',reason:'RECEIPT_IDENTITY_MISMATCH'};
       return {status:'found',receipt};
     }catch(error){return {status:'unknown',reason:'RECEIPT_READ_OR_STATE_UNVERIFIED',
       ...(qaDiagnostic===true?{diagnostic:readDiagnostic(error,phase)}:{})}}
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
         let nextWitnesses=null;
         let nextSeal=null;
         if(entries.length>=MAX){
           // Only finished/held receipts leave the bounded hot queue.
           // Pending work is never lost, acknowledged, or replaced.
           const finishedIndex=entries.findIndex(x=>
             x.delivery?.status==='delivered'||x.delivery?.status==='held');
           if(finishedIndex<0)return {durable:false,reason:'owner-pending-queue-full'};
           const finished=entries[finishedIndex];
           const key=finalKey(finished.canonicalOperationId);
           const fingerprint=await archiveWitness(finished.canonicalOperationId);
           if((state.archiveWitnesses||[]).includes(fingerprint))
             hold('ARCHIVE_WITNESS_COLLISION_OR_REPLAY');
           nextWitnesses=[...(state.archiveWitnesses||[]),fingerprint].sort();
           nextSeal=await archiveSeal(nextWitnesses);
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
           ...(archived?{archiveUsed:true,archiveWitnesses:nextWitnesses,
             archiveWitnessSeal:nextSeal}:{}),
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
   // APP792: bounded precommit/proof recovery separate from relay attempts.
   // Existing APP755/759 callers do not use this method. No network or D1.
   async deferSettlement({receipt}={}){
     scope(receipt);
     return storage.transaction(async tx=>{
       const s=await load(tx),index=s.entries.findIndex(x=>x.operationId===receipt.operationId);
       const old=s.entries[index];
       if(!old||!same(old,receipt)||old.authEpoch!==receipt.authEpoch||
          old.cutoverToken!==receipt.cutoverToken||old.priorR2Revision!==receipt.priorR2Revision||
          old.beforeFollowing!==receipt.beforeFollowing||old.generation!==receipt.generation||
          old.delivery?.status!=='pending')hold('SETTLEMENT_RECEIPT_MISMATCH');
       const at=now();if(!safe(at)||at<=0)hold('CLOCK');
       const checks=(old.delivery.settlementChecks||0)+1;
       const status=checks>=4?'held':'pending';
       const delivery={status,attempts:old.delivery.attempts,settlementChecks:checks,
         ...(status==='pending'?{retryAt:at+[0,2000,5000,15000][checks]}:{holdReason:'settlement-unverified'})};
       const entries=s.entries.slice();entries[index]={...old,delivery};
       await tx.put(KEY,{...s,entries});
       const next=entries.filter(x=>(x.delivery?.status||'pending')==='pending');
       if(next.length)await tx.setAlarm(Math.max(at+1,Math.min(...next.map(x=>x.delivery?.retryAt||at+DELAY))));
       else if(typeof tx.deleteAlarm==='function')await tx.deleteAlarm();
       return {status,changed:true,settlementChecks:checks};
     });
   },
   // Explicit, exact settled proof only. Never revive a generation rejection
   // or exhausted actual relay budget. Caller must verify immutable proof.
   async rearmVerifiedSettlement({receipt}={}){
     scope(receipt);
     return storage.transaction(async tx=>{
       const s=await load(tx),index=s.entries.findIndex(x=>x.operationId===receipt.operationId);
       const old=s.entries[index];
       if(!old||!same(old,receipt)||old.authEpoch!==receipt.authEpoch||
          old.cutoverToken!==receipt.cutoverToken||old.priorR2Revision!==receipt.priorR2Revision||
          old.beforeFollowing!==receipt.beforeFollowing||old.generation!==receipt.generation)
         hold('SETTLEMENT_REARM_RECEIPT_MISMATCH');
       if(old.delivery?.status==='delivered')return {status:'delivered',changed:false};
       if(old.delivery?.status==='held'&&old.delivery.holdReason!=='settlement-unverified')
         return {status:'held',changed:false};
       if(old.delivery?.status==='held'){
         const entries=s.entries.slice();
         entries[index]={...old,delivery:{status:'pending',attempts:old.delivery.attempts,
           settlementChecks:0,retryAt:now()+DELAY}};
         await tx.put(KEY,{...s,entries});
       }
       await alarmReady(tx);
       return {status:'pending',changed:true};
     });
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
         ...(old.delivery?.settlementChecks!==undefined?{settlementChecks:old.delivery.settlementChecks}:{}),
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
