// APP763: review-only Durable Object capacity and recovery planning.
// No Cloudflare credentials, storage reads, writes, deployment or exports to Workers.
// Sources: https://developers.cloudflare.com/durable-objects/platform/pricing/
// https://developers.cloudflare.com/durable-objects/platform/limits/
// https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
// Rates snapshot 2026-11-22; NOT an invoice, approved rollout or billing cap.
import {createHash} from 'node:crypto';
const HOT='app755-owner-follow-pending-v1';
const ARCHIVE='app762-owner-follow-final-';
const sha=s=>createHash('sha256').update(s).digest('hex');
const GB=1_000_000_000;
const RATES=Object.freeze({
 paid: {monthlyDORequestsIncluded:1_000_000,monthlyDurationGBsIncluded:400_000,
  monthlyRowsReadIncluded:25_000_000_000,monthlyRowsWrittenIncluded:50_000_000,
  storageGBIncluded:5,requestsUSDPerMillion:0.15,
  durationUSDPerMillionGBs:12.50,rowsReadUSDPerMillion:0.001,
  rowsWrittenUSDPerMillion:1,storageUSDPerGBMonth:0.20},
 free: {dailyRequests:100_000,dailyRowsRead:5_000_000,dailyRowsWritten:100_000,
  storageGB:5},
 sqliteObjectLimitGB:10,
});
const number=(n,min,max,label)=>{
 if(!Number.isFinite(n)||n<min||n>max)throw Error('APP763_INVALID_'+label);
 return n;
};
const charge=(units,free,increment,rate)=>
 Math.ceil(Math.max(0,units-free)/increment)*rate;
const asUSD=n=>Math.round(n*10000)/10000;
// This shape mirrors APP755/762's existing receipt fields; all values are
// synthetic. Storage overhead per key, SQLite pages, index & WAL is unknown.
export function app763RepresentativeReceipt(){
 return {
  actorUid:'actorSynthetic755',ownerUid:'ownerSynthetic755',desired:true,
  canonicalOperationId:'canonical_354_operation_755',expectedRevision:7,
  authEpoch:'a'.repeat(32),cutoverToken:'server-cutover',
  priorR2Revision:13,beforeFollowing:false,
  operationId:'owner_755_server_receipt_00000001',
  durable:true,ownerDoAlarmScheduled:true,
  delivery:{status:'delivered',attempts:0},
 };
}
export function estimateApp763OwnerCost({
 owners=100_000,eventsPerOwnerPerYear=50,months=12,
 storageOverheadMultiplier=3,metadataBytesPerOwner=12_000,
 requestsPerChange=3,rowsWrittenPerChange=6,rowsReadPerChange=8,
 activeMillisPerChange=40,
}={}){
 for(const [label,value,min,max] of [
  ['OWNERS',owners,1,10_000_000],
  ['YEARLY_EVENTS_PER_OWNER',eventsPerOwnerPerYear,0,100_000_000],
  ['MONTHS',months,1,120],
  ['OVERHEAD',storageOverheadMultiplier,1,20],
  ['BASE_BYTES',metadataBytesPerOwner,0,1_000_000],
  ['REQUESTS_PER_CHANGE',requestsPerChange,1,100],
  ['ROWS_WRITTEN_PER_CHANGE',rowsWrittenPerChange,1,100],
  ['ROWS_READ_PER_CHANGE',rowsReadPerChange,1,100],
  ['ACTIVE_MS_PER_CHANGE',activeMillisPerChange,0,60_000],
 ])number(value,min,max,label);
 if(!Number.isSafeInteger(owners)||!Number.isSafeInteger(eventsPerOwnerPerYear))
  throw Error('APP763_REQUIRES_INTEGER_COUNTS');
 const receipt=app763RepresentativeReceipt();
 const archiveKey=ARCHIVE+receipt.canonicalOperationId;
 const sampleReceiptBytes=Buffer.byteLength(JSON.stringify(receipt),'utf8');
 const sampleArchiveKeyBytes=Buffer.byteLength(archiveKey,'utf8');
 const totalChanges=owners*eventsPerOwnerPerYear*(months/12);
 if(!Number.isSafeInteger(totalChanges))throw Error('APP763_COUNT_OVERFLOW');
 // This is a simplified *logical-key* size plus a scenario multiplier,
 // not physical SQLite databaseSize. Hot queue, B-tree and per-object
 // metadata are approximated separately. Real reads/writes require metrics.
 // APP764 keeps an additional 128-bit archived-operation witness in hot
 // state. Approximate 32 hex chars + JSON quotes/array separator per ID.
 const archiveWitnessBytesPerReceipt=35;
 const logicalBytesPerReceipt=sampleReceiptBytes+sampleArchiveKeyBytes+
  archiveWitnessBytesPerReceipt;
 const estimatedStoredBytes=owners*metadataBytesPerOwner+
  totalChanges*logicalBytesPerReceipt*storageOverheadMultiplier;
 const totalStorageGB=estimatedStoredBytes/GB;
 const eventsPerMonth=owners*eventsPerOwnerPerYear/12;
 const requestsMonth=eventsPerMonth*requestsPerChange;
 const rowsReadMonth=eventsPerMonth*rowsReadPerChange;
 const rowsWrittenMonth=eventsPerMonth*rowsWrittenPerChange;
 const durationGBsMonth=eventsPerMonth*activeMillisPerChange/1000*0.128;
 const paid=RATES.paid;
 const bill={
  storageUSD:asUSD(Math.max(0,totalStorageGB-paid.storageGBIncluded)*
    paid.storageUSDPerGBMonth),
  requestsUSD:asUSD(charge(requestsMonth,paid.monthlyDORequestsIncluded,
    1_000_000,paid.requestsUSDPerMillion)),
  rowsReadUSD:asUSD(charge(rowsReadMonth,paid.monthlyRowsReadIncluded,
    1_000_000,paid.rowsReadUSDPerMillion)),
  rowsWrittenUSD:asUSD(charge(rowsWrittenMonth,paid.monthlyRowsWrittenIncluded,
    1_000_000,paid.rowsWrittenUSDPerMillion)),
  durationUSD:asUSD(charge(durationGBsMonth,paid.monthlyDurationGBsIncluded,
    1_000_000,paid.durationUSDPerMillionGBs)),
 };
 const monthlyDOOverageUSD=asUSD(Object.values(bill).reduce((a,b)=>a+b,0));
 const perOwnerGB=metadataBytesPerOwner/GB+
  eventsPerOwnerPerYear*(months/12)*logicalBytesPerReceipt*storageOverheadMultiplier/GB;
 return {
  code:'APP763_HYPOTHETICAL_OWNER_DO_STORAGE_MODEL',status:'ESTIMATE_ONLY',
  assumptions:{owners,eventsPerOwnerPerYear,months,storageOverheadMultiplier,
   metadataBytesPerOwner,requestsPerChange,rowsWrittenPerChange,
   rowsReadPerChange,activeMillisPerChange,
   sampleReceiptBytes,sampleArchiveKeyBytes,archiveWitnessBytesPerReceipt,
   logicalBytesPerReceipt,
   backend:'SQLite-backed candidate; ACTUAL PRODUCTION NOT CONNECTED'},
  totals:{totalChanges,storedGB:Math.round(totalStorageGB*1000)/1000,
   perOwnerGB:Math.round(perOwnerGB*1_000_000)/1_000_000,
   requestsPerMonth:Math.round(requestsMonth),
   rowsReadPerMonth:Math.round(rowsReadMonth),
   rowsWrittenPerMonth:Math.round(rowsWrittenMonth),
   durationGBSecondsPerMonth:Math.round(durationGBsMonth)},
  paidSQLiteOverageUSD:bill,monthlyDOOverageUSD,
  freeSQLiteStorageLimitExceeded:totalStorageGB>RATES.free.storageGB,
  freeDailyRequestLimitExceeded:requestsMonth*12/365>RATES.free.dailyRequests,
  freeDailyWrittenRowsLimitExceeded:rowsWrittenMonth*12/365>RATES.free.dailyRowsWritten,
  freeDailyReadRowsLimitExceeded:rowsReadMonth*12/365>RATES.free.dailyRowsRead,
  estimatedPerOwner10GBLimitExceeded:perOwnerGB>RATES.sqliteObjectLimitGB,
  physicalStorageMeasured:false,cloudflarePlanConfirmed:false,
  liveBillingConfirmed:false,otherDOUsageExcluded:true,
  otherCloudflareWorkersFirebaseCostsExcluded:true,productionDeployAuthorized:false,
 };
}
// This *offline* full-map checkpoint is for rollback drills. It deliberately
// never runs on active DO request paths, which would add list/read costs.
// It can detect incomplete or corrupted snapshots supplied by a trusted
// independent fixture. A byte match alone CANNOT prove canonical D1/R2
// has not advanced, so every real restoration still requires a freeze and
// cross-system exact committed revision/owner-epoch reconciliation.
export function captureApp763OwnerSnapshot({ownerUid,entries}={}){
 if(typeof ownerUid!=='string'||!ownerUid.length||
    !Array.isArray(entries))throw Error('APP763_SNAPSHOT_UNVERIFIED');
 const serialized=[];
 const canonicalIds=new Set(),serverIds=new Set();
 let hotSeen=false;
 for(const [key,value] of entries){
  if(typeof key!=='string'||!value||typeof value!=='object')
   throw Error('APP763_CORRUPT_KEY_OR_VALUE');
  if(key===HOT){
   if(hotSeen||value.ownerUid!==ownerUid||value.version!==1||
      !Array.isArray(value.entries)||value.entries.length>24)
    throw Error('APP763_HOT_STATE_UNVERIFIED');
   hotSeen=true;
   for(const item of value.entries){
    if(item.ownerUid!==ownerUid||!item.canonicalOperationId||
       !item.operationId)throw Error('APP763_HOT_OWNER_OR_RECEIPT_UNVERIFIED');
    if(canonicalIds.has(item.canonicalOperationId)||serverIds.has(item.operationId))
     throw Error('APP763_RECEIPT_ID_COLLISION');
    canonicalIds.add(item.canonicalOperationId);serverIds.add(item.operationId);
   }
  }else if(key.startsWith(ARCHIVE)){
   const id=key.slice(ARCHIVE.length);
   if(!id||value.canonicalOperationId!==id||value.ownerUid!==ownerUid||
      !value.operationId||!['delivered','held'].includes(value.delivery?.status)||
      canonicalIds.has(id)||serverIds.has(value.operationId))
    throw Error('APP763_ARCHIVE_OWNER_STATE_OR_ID_UNVERIFIED');
   canonicalIds.add(id);serverIds.add(value.operationId);
  }else throw Error('APP763_UNKNOWN_STORAGE_KEY');
  serialized.push([key,JSON.stringify(value)]);
 }
 if(!hotSeen)throw Error('APP763_OWNER_HOT_STATE_MISSING');
 serialized.sort((a,b)=>a[0].localeCompare(b[0]));
 return Object.freeze({status:'SNAPSHOT_REVIEW_ONLY',fingerprintSha256:sha(JSON.stringify(serialized)),
  keyCount:serialized.length,receiptCount:canonicalIds.size,
  archivedCount:serialized.length-1,ownerIdentitySha256:sha(ownerUid)});
}
export function assessApp763Recovery({before,after}={}){
 if(!before||!after)return {status:'HOLD',reason:'SNAPSHOT_MISSING'};
 if(before.ownerIdentitySha256!==after.ownerIdentitySha256||
    before.fingerprintSha256!==after.fingerprintSha256||
    before.keyCount!==after.keyCount||before.receiptCount!==after.receiptCount)
  return {status:'HOLD',reason:'OWNER_STORAGE_SNAPSHOT_CHANGED_OR_LOST'};
 return {status:'OFFLINE_STORAGE_MATCH_ONLY',
  reason:'EXTERNAL_D1_R2_AUTH_EPOCH_AND_FUNCTIONS_PARITY_NOT_VERIFIED',
  productionDeployAuthorized:false};
}
