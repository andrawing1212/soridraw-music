// APP759: source-only owner Durable Object alarm coordinator. NEVER wired to
// active PROD. Uses APP755 durable receipt and signed receiver contract.
// No HTTP callback, DO migration, binding, polling, or deployment code.
export const APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const fail=code=>{throw Error('APP759_ALARM_HOLD_'+code)};
export function createApp759ProductionOwnerAlarm({
 enabled=APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN,
 ownerUid,receiptStore,backend,proveExactSettledOwnerEvent,
}={}){
 if(enabled!==true)return null;
 if(!UID.test(ownerUid||'')||
    !receiptStore||typeof receiptStore.duePending!=='function'||
    typeof receiptStore.markDelivery!=='function'||
    !backend||typeof backend.deliverFromOwnerAlarm!=='function'||
    typeof proveExactSettledOwnerEvent!=='function')
   fail('VERIFIED_OWNER_DO_AND_PROOF_REQUIRED');
 return {
  // Called exclusively from an independently authorized DO alarm handler.
  // Never from a follow HTTP request. APP743's precommit alarm owns delivery.
  async alarm(env){
   if(env?.SORIDRAW_ENVIRONMENT!=='production')
     fail('PRODUCTION_ENVIRONMENT_REQUIRED');
   let due=await receiptStore.duePending(); // storage failure: throw, never ACK
   if(!Array.isArray(due)||due.length>4)fail('DUE_RECEIPT_BOUND');
   let delivered=0,retried=0,held=0;
   for(const receipt of due){
     if(receipt?.ownerUid!==ownerUid||receipt?.durable!==true||
        receipt?.ownerDoAlarmScheduled!==true||
        receipt?.delivery?.status==='held'||receipt?.delivery?.status==='delivered')
       fail('OWNER_PENDING_RECEIPT_SCOPE');
     let outcome='relay-failed';
     try{
       // Only trusted server-side D1/R2/APP557 exact settled proofs may
       // derive ownerEvent. No browser assertion or optimistic counts.
       const proof=await proveExactSettledOwnerEvent({receipt,env});
       if(proof?.settled?.committed===true&&
          proof.settled.projectionSettled===true&&
          proof.settled.changed===true&&
          proof.settled.operationId===receipt.operationId&&
          proof.settled.ownerUid===ownerUid&&
          proof.ownerEvent?.ownerUid===ownerUid&&
          proof.ownerEvent.authEpoch===receipt.authEpoch){
         const relay=await backend.deliverFromOwnerAlarm({
           env,reservation:receipt,settled:proof.settled,
           ownerEvent:proof.ownerEvent});
         if(relay?.status==='delivered')outcome='delivered';
         if(relay?.status==='rejected-generation')outcome='rejected-generation';
       }
     }catch{
       // Unverified canonical state, Functions 503, network fault and
       // incomplete proof all retain the same receipt; never ACK.
     }
     // Atomic DO transaction: never count success until persisted ACK.
     const saved=await receiptStore.markDelivery({receipt,result:outcome});
     if(saved?.changed!==true)fail('DELIVERY_SETTLEMENT_UNKNOWN');
     if(saved.status==='delivered')delivered++;
     else if(saved.status==='pending')retried++;
     else if(saved.status==='held')held++;
     else fail('DELIVERY_RESULT_UNEXPECTED');
   }
   return {processed:due.length,delivered,retried,held,
    noCanonicalMutation:true,noUserDataAccess:true};
  },
 };
}
