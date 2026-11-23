// APP761: owner-bound production DO runtime adapter (SOURCE ONLY, COMPILE OFF).
// This deliberately does NOT export a deployable Durable Object class or Worker.
// No DO namespace, migration, service binding, secret, route or backend mutation.
import {createApp755ProductionOwnerReceiptStore}
  from './app755-production-owner-receipt.mjs';
import {createApp759ProductionOwnerAlarm}
  from './app759-production-owner-alarm.mjs';
export const APP761_PRODUCTION_OWNER_DO_RUNTIME_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const stop=x=>{throw Error('APP761_OWNER_DO_HOLD_'+x)};
export function createApp761ProductionOwnerDoRuntime({
 enabled=APP761_PRODUCTION_OWNER_DO_RUNTIME_COMPILED_OPEN,
 state,env,ownerUid,verifyBoundOwner,
 backend,proveExactSettledOwnerEvent,now=Date.now,issueId,
}={}){
 if(enabled!==true)return null;
 // Fail closed if invoked with a different environment, unverified DO
 // identity or unconnected canonical proof/receiver. Never substitute a
 // caller-supplied UID for the owner bound to the Durable Object.
 if(env?.SORIDRAW_ENVIRONMENT!=='production'||
    !UID.test(ownerUid||'')||
    !state?.storage||typeof verifyBoundOwner!=='function'||
    typeof proveExactSettledOwnerEvent!=='function'||
    typeof backend?.deliverFromOwnerAlarm!=='function')
   stop('TRUSTED_OWNER_BINDING_AND_RELAY_REQUIRED');
 const receipts=createApp755ProductionOwnerReceiptStore({
   storage:state.storage,ownerUid,enabled:true,now,issueId,
 });
 const coordinator=createApp759ProductionOwnerAlarm({
   enabled:true,ownerUid,receiptStore:receipts,backend,
   proveExactSettledOwnerEvent,
 });
 async function guard(){
   const binding=await verifyBoundOwner({state,env,ownerUid});
   // An explicit equality check; false, missing, mismatched or errors
   // cannot result in storage read, alarm or signed receiver invocation.
   if(binding?.ownerUid!==ownerUid||
      binding?.verifiedOwnerDoIdentity!==true)
     stop('OWNER_BINDING_UNVERIFIED');
 }
 return Object.freeze({
   async find(ticket){
     await guard();
     return receipts.find(ticket);
   },
   async inspectReceipt(ticket,options){
     await guard();
     return receipts.inspectReceipt(ticket,options);
   },
   async reserve(ticket){
     await guard();
     return receipts.reserve(ticket);
   },
   async alarm(){
     await guard();
     return coordinator.alarm(env);
   },
 });
}
