import type {Database} from 'firebase-admin/database';

// Admin-only server seal for Stage416. Not exported as Callable / deployed.
// No D1 request is issued here; downstream authenticated Worker receipt is
// a separate mandatory release gate. Pending envelope is UID-scoped RTDB.
const MAX_TRACKS=256;
const MINUTES=[1,3,5,10,20];
type Row={trackId:string;liked:boolean;operationId:string;deviceId:string;deviceSequence:number;version:number};
type Seal={id:string;version:number;closedAtMs:number;rows:Row[]};
type Pending={
  version:number;deviceSeq:Record<string,number>;
  window?:{id:string;minutes:number;openedAtMs:number;lastClickAtMs:number;revision:number}|null;
  pending?:Record<string,Row>;
  sealed?:Seal|null;
};
const validUuid=(value:unknown)=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validRow=(row:Row)=>!!row&&typeof row.trackId==='string'&&row.trackId.length>0&&
 row.trackId.length<=512&&typeof row.liked==='boolean'&&validUuid(row.operationId)&&
 validUuid(row.deviceId)&&Number.isSafeInteger(row.deviceSequence)&&row.deviceSequence>0&&
 Number.isSafeInteger(row.version)&&row.version>0;
export type Stage416SealResult={sealed:boolean;reason:string;value?:Seal;retryAfterMs?:number};

// RTDB transaction commits the deadline decision and frozen final per-track
// payload in the SAME account record, serialized against every new device
// transaction. An account clock is ONLY trusted after RTDB resolves .sv timestamp.
export async function sealUserPrivateLikes416(
  database:Database,uid:string,nowMs=Date.now(),expectedWindowId?:string,
):Promise<Stage416SealResult>{
  if(!uid||uid.length>128||!Number.isSafeInteger(nowMs)||nowMs<=0)
    throw Error('416_BAD_SERVER_SEAL');
  if(expectedWindowId && !validUuid(expectedWindowId))
    throw Error('416_BAD_SERVER_WINDOW_ID');
  let disposition:Stage416SealResult={sealed:false,reason:'UNDETERMINED'};
  const result=await database.ref('privateLikeBatch416/'+uid).transaction(
    (raw:unknown)=>{
      const value=raw as Pending|null;
      if(value?.sealed){
        if(expectedWindowId && value.sealed.id!==expectedWindowId){
          if(value.window?.id===expectedWindowId){
            // A new window may have begun while the older frozen seal awaits
            // a remote queue ACK. Do not discard the new task; retry later.
            disposition={sealed:false,reason:'WAITING_FOR_PRIOR_SEAL',retryAfterMs:60_000};
            return;
          }
          disposition={sealed:false,reason:'STALE_WINDOW_TASK'};return;
        }
        disposition={sealed:false,reason:'PRIOR_SEAL_UNACKNOWLEDGED',value:value.sealed};
        return;
      }
      if(!value?.window){disposition={sealed:false,reason:'EMPTY'};return;}
      const {window,pending}=value;
      if(expectedWindowId && window.id!==expectedWindowId){
        disposition={sealed:false,reason:'STALE_WINDOW_TASK'};return;
      }
      if(!Number.isSafeInteger(window.lastClickAtMs)||window.lastClickAtMs<=0||
         !MINUTES.includes(window.minutes)||!validUuid(window.id)||
         !Number.isSafeInteger(window.revision)||window.revision<=0)
        throw Error('416_BAD_SERVER_WINDOW');
      const deadline=window.lastClickAtMs+window.minutes*60000;
      if(nowMs<deadline){
        disposition={sealed:false,reason:'NOT_DUE',retryAfterMs:deadline-nowMs};
        return;
      }
      const rows=Object.values(pending||{});
      if(!rows.length||rows.length>MAX_TRACKS||rows.some(row=>!validRow(row)))
        throw Error('416_BAD_SERVER_PENDING');
      const sealed:Seal={id:window.id,version:window.revision,closedAtMs:nowMs,
        rows:rows.sort((a,b)=>a.trackId.localeCompare(b.trackId))};
      disposition={sealed:true,reason:'SEALED',value:sealed};
      return {...value,window:null,pending:null,sealed};
    },
    undefined,false,
  );
  if(!result.committed)return {sealed:false,reason:disposition.reason,
    ...(disposition.value?{value:disposition.value}:{}),
    ...(disposition.retryAfterMs!==undefined?{retryAfterMs:disposition.retryAfterMs}:{})};
  const committed=result.snapshot.val() as Pending;
  if(!committed?.sealed||committed.sealed.id!==disposition.value?.id||
     committed.sealed.version!==disposition.value?.version)
    throw Error('416_SERVER_SEAL_RECEIPT_MISMATCH');
  return {...disposition,value:committed.sealed};
}
// Called ONLY after exact authenticated Worker canonical queue receipt.
// ACK retries/mismatches are no-op; they never mutate newer pending clicks.
export async function acknowledgeUserPrivateSeal416(
  database:Database,uid:string,receipt:{id:string;version:number},
):Promise<boolean>{
  if(!uid||uid.length>128||!validUuid(receipt?.id)||
     !Number.isSafeInteger(receipt?.version)||receipt.version<=0)
    throw Error('416_BAD_SERVER_ACK');
  const result=await database.ref('privateLikeBatch416/'+uid).transaction(
    (raw:unknown)=>{
      const value=raw as Pending|null;
      if(!value?.sealed||value.sealed.id!==receipt.id||
         value.sealed.version!==receipt.version)return;
      return {...value,sealed:null};
    },undefined,false,
  );
  return result.committed;
}
