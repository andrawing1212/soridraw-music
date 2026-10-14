// Stage416 dormant client registration sequencer.
// One deviceSequence must reach a terminal server result before any later
// sequence from the same durable drain is allowed onto the network.
const FINAL_REJECTION_REASONS_416=new Set(['DEVICE_LIMIT','TRACK_LIMIT']);

export const createStage416PrivateRegistrationError416=(reason,final=false)=>{
 const safe=String(reason||'UNKNOWN');
 const error=new Error('416_PRIVATE_SERVER_CLICK_NOT_ACCEPTED:'+safe);
 error.stage416Reason=safe;
 error.stage416Final=final===true;
 return error;
};

export const readStage416PrivateRegistrationFailure416=(error)=>{
 const value=error&&typeof error==='object'?error:null;
 return {
  reason:String(value?.stage416Reason||''),
  final:value?.stage416Final===true,
 };
};

export const isFinalStage416PrivateRegistrationReason416=(reason)=>
 FINAL_REJECTION_REASONS_416.has(String(reason||''));

// Rows MUST already be sorted by deviceSequence/queuedAt by the caller.
// Ambiguous/network failures stop the drain immediately. Only an explicit
// final server rejection may advance to the next sequence, and only after the
// caller durably records that terminal rejection.
export async function drainStage416PrivateRegistrationsInOrder416(
 rows,{isCurrent,send,persistAccepted,persistRejected},
){
 if(!Array.isArray(rows)||typeof isCurrent!=='function'||typeof send!=='function'||
    typeof persistAccepted!=='function'||typeof persistRejected!=='function')
  throw Error('416_BAD_ORDERED_REGISTRATION_DRAIN');
 let accepted=0,rejected=0,skipped=0;
 for(const row of rows){
  if(!isCurrent(row)){skipped++;continue;}
  try{
   const receipt=await send(row);
   if(!receipt||!isCurrent(row)){skipped++;continue;}
   await persistAccepted(row,receipt);
   accepted++;
  }catch(error){
   const failure=readStage416PrivateRegistrationFailure416(error);
   if(failure.final&&failure.reason&&isCurrent(row)){
    const recorded=await persistRejected(row,failure.reason);
    if(recorded===true){
     rejected++;
     continue;
    }
   }
   // Never allow seq N+1 to leapfrog an unresolved seq N.
   return {completed:false,blocked:true,accepted,rejected,skipped};
  }
 }
 return {completed:true,blocked:false,accepted,rejected,skipped};
}
