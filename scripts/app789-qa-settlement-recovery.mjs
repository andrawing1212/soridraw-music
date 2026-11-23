// APP789 QA-only continuation; this helper cannot send a canonical commit.
const OP=/^qa789_operation_[a-z0-9_]{16,50}$/;
const RECEIPT=/^qa789_do_receipt_[a-f0-9]{32}$/;
const reset=v=>v?.code===409&&v.value?.status==='HOLD'&&
 v.value?.reason==='DO_RECEIPT_LOOKUP_UNCERTAIN'&&
 v.value?.stage==='POSTCOMMIT_RECEIPT'&&
 v.value?.diagnostic==='STATE_READ__OBJECT_RESET'&&
 v.value?.d1RowsWritten===0&&v.value?.canonicalRetryAuthorized===false;
export async function continueQa789Settlement({get,commit,canonicalOperationId,expectedReceiptId}={}){
 if(typeof get!=='function'||!OP.test(canonicalOperationId||'')||
    !RECEIPT.test(expectedReceiptId||'')||
    commit?.code!==200||commit.value?.status!=='QA789_CANONICAL_WRITTEN_PENDING_SETTLEMENT'||
    commit.value?.stage!=='CANONICAL_WRITTEN'||commit.value?.d1RowsWritten!==1||
    commit.value?.r2ProjectionSettled!==true||commit.value?.canonicalRetryAuthorized!==false)
  return {attempts:0,result:{code:409,value:{status:'HOLD',reason:'CANONICAL_WRITE_ACK_UNVERIFIED'}}};
 const body={canonicalOperationId,expectedReceiptId};
 let result=await get('POST','/qa789/do/finalize',body);
 // Only a confirmed reset during the receipt read is eligible. No automatic
 // retry for missing/mismatched records, unknown writes, transport errors,
 // or settlement/floor CAS failures. At most one fresh request.
 if(!reset(result))return {attempts:1,result};
 result=await get('POST','/qa789/do/finalize',body);
 return {attempts:2,result};
}
