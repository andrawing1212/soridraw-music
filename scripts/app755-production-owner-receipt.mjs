// APP755: source-only, owner-scoped Durable Object receipt storage adapter.
// Runs ONLY inside a separately approved owner DO class with storage.transaction.
// No class, migration, binding, route, alarm deployment or Functions call here.
// Server-owned operation ID must differ from the APP354 client correlation ID.
export const APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const KEY='app755-owner-follow-pending-v1',MAX=24,DELAY=1000;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
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
 x.ownerDoAlarmScheduled===true;
const validState=(s,owner)=>s?.version===1&&s.ownerUid===owner&&
 Array.isArray(s.entries)&&s.entries.length<=MAX&&
 s.entries.every(validReceipt)&&
 new Set(s.entries.map(x=>x.canonicalOperationId)).size===s.entries.length;
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
 const alarmReady=async st=>{
   const at=now();if(!safe(at)||at===0)hold('CLOCK');
   const due=await st.getAlarm();
   if(!safe(due)||due<=at||due>at+DELAY){
     await st.setAlarm(at+DELAY);
   }
 };
 return {
   async find(input){
     scope(input);
     // Any storage failure is unknown, NEVER authoritative absence.
     try{
       const state=await load(storage);
       const conflict=state.entries.find(x=>
         x.canonicalOperationId===input.canonicalOperationId);
       if(!conflict)return {status:'absent',authoritative:true,...input};
       if(!same(conflict,input))return {status:'unknown'};
       // A partial failure between durable put and alarm cannot be a
       // successful reservation until the same receipt's alarm is rearmed.
       await alarmReady(storage);
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
         const previous=state.entries.find(x=>
           x.canonicalOperationId===input.canonicalOperationId);
         if(previous){
           if(!same(previous,input)||previous.authEpoch!==input.authEpoch||
              previous.cutoverToken!==input.cutoverToken)
             return {durable:false,reason:'conflict'};
           await alarmReady(tx);
           return previous;
         }
         if(state.entries.length>=MAX)return {durable:false,reason:'owner-queue-full'};
         const id=issueId();
         if(!OP.test(id||'')||id===input.canonicalOperationId||
           state.entries.some(x=>x.operationId===id))
           hold('SERVER_OPERATION_ID_UNVERIFIED');
         const receipt={...input,operationId:id,durable:true,
           ownerDoAlarmScheduled:true};
         // Transaction commits pending receipt and DO alarm together.
         // Any error fails closed; no canonical D1 write may follow.
         await tx.put(KEY,{version:1,ownerUid,
           entries:[...state.entries,receipt]});
         await alarmReady(tx);
         return receipt;
       });
     }catch{return {durable:false,reason:'storage-or-alarm-uncertain'}}
   },
 };
}
