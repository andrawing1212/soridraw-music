// APP529 canonical follower count is written only by signed Admin callback.
// RTDB version is the D1 AUTOINCREMENT outbox event sequence, not delivery time.
export type ExploreOwnerFollowerSignal529 = {
 ownerUid:string; version:number; followerCount:number; at:number; receiptId:string;
};
export const normalizeOwnerFollowerSignal529=(
  raw:unknown,ownerUid:string,
):ExploreOwnerFollowerSignal529|null=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const row=raw as Record<string,unknown>;
  const version=Number(row.version), count=Number(row.followerCount),
    at=Number(row.at), receiptId=String(row.receiptId||'');
  if(row.ownerUid!==ownerUid||!Number.isSafeInteger(version)||version<=0||
     !Number.isSafeInteger(count)||count<0||count>1_000_000_000||
     !Number.isSafeInteger(at)||at<=0||receiptId!==String(version))
    return null;
  return {ownerUid,version,followerCount:count,at,receiptId};
};
export const createOwnerFollowerGate529=(
 ownerUid:string,
 applyCount:(count:number,version:number)=>void,
 now:()=>number=Date.now,
 knownVersion=0,
 rememberVersion:(version:number)=>void=()=>{},
)=>{
 let latestVersion=Number.isSafeInteger(knownVersion)&&knownVersion>0?knownVersion:0;
 let disposed=false;
 const receive=(raw:unknown)=>{
   if(disposed)return;
   const signal=normalizeOwnerFollowerSignal529(raw,ownerUid);
   if(!signal||signal.at>now()+60_000)return;
   if(signal.version<latestVersion)return;
   // Replayed identical owner marker repairs a stale profile cache without
   // requiring any D1/R2 GET. Neither NULL snapshot nor duplicate adds reads.
   const increased=signal.version>latestVersion;
   latestVersion=signal.version;
   if(increased)rememberVersion(signal.version);
   applyCount(signal.followerCount,signal.version);
 };
 return {receive,dispose:()=>{disposed=true;},version:()=>latestVersion};
};
