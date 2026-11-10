// APP538: isolated A-owner UI gate for APP532/533 era-separated signals.
// SOURCE-ONLY; not imported in ExplorePage, no RTDB subscription or D1 reads.
// The old APP529 UID-only seen-version storage cannot safely survive same-UID
// Auth account recreation with a fresh epoch and reset revision.
export const APP538_OWNER_CLIENT_GATE_COMPILED_OPEN=false;
const UID538=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH538=/^[0-9a-f]{32}$/;
export type OwnerEpochSignal538={
 ownerUid:string;authEpoch:string;authCreatedAtMs:number;
 version:number;followerCount:number;at:number;receiptId:string;
};
export const normalizeOwnerEpochSignal538=(
 raw:unknown,uid:string,expectedEpoch:string,
):OwnerEpochSignal538|null=>{
 if(!UID538.test(uid)||!EPOCH538.test(expectedEpoch)||
   !raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const record=raw as Record<string,unknown>;
 const {authEpoch,ownerUid,receiptId}=record;
 const version=record.version, count=record.followerCount,
   created=record.authCreatedAtMs, at=record.at;
 if(ownerUid!==uid||authEpoch!==expectedEpoch||
   typeof version!=="number"||!Number.isSafeInteger(version)||version<=0||
   typeof count!=="number"||!Number.isSafeInteger(count)||count<0||count>1e9||
   typeof created!=="number"||!Number.isSafeInteger(created)||created<=0||
   typeof at!=="number"||!Number.isSafeInteger(at)||at<=0||
   receiptId!==expectedEpoch+":"+version)return null;
 return record as OwnerEpochSignal538;
};
export const createOwnerEpochGate538=({
 ownerUid,authEpoch,applyCount,now=Date.now,
 initialSeenVersion=0,rememberVersion=()=>{},
}:{
 ownerUid:string;authEpoch:string;
 applyCount:(count:number,version:number,invalidateList:boolean)=>void;
 now?:()=>number;initialSeenVersion?:number;
 rememberVersion?:(version:number,epoch:string)=>void;
})=>{
 if(!UID538.test(ownerUid)||!EPOCH538.test(authEpoch))
  throw Error("APP538_INVALID_AUTH_GENERATION");
 let seenVersion=Number.isSafeInteger(initialSeenVersion)&&
  initialSeenVersion>0?initialSeenVersion:0;
 let seenCount:number|null=null,disposed=false;
 const receive=(input:unknown)=>{
  if(disposed)return false;
  const event=normalizeOwnerEpochSignal538(input,ownerUid,authEpoch);
  if(!event||event.at>now()+60_000||event.version<seenVersion)return false;
  if(event.version===seenVersion&&seenCount!==null&&seenCount!==event.followerCount)
   return false;
  const isNew=event.version>seenVersion;
  seenVersion=event.version;
  seenCount=event.followerCount;
  if(isNew)rememberVersion(event.version,authEpoch);
  // Exact retained same event can refresh the count but MUST NOT trigger
  // another APP527/528 followers-list read or list-cache invalidation.
  applyCount(event.followerCount,event.version,isNew);
  return true;
 };
 return {receive,dispose:()=>{disposed=true;},version:()=>seenVersion};
};
