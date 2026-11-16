// APP662: a settled 1:N follow MUST use the actual canonical counts returned
// by the Worker; a stale device cache plus/minus one is only provisional.
export type CanonicalFollowCounts662={
 followerCount:number;followingCount:number;actorFollowingCount?:number;
 countVerified661?:boolean;actorCountVerified662?:boolean;
};
export type DisplayFollowCounts662={
 followerCount:number;followingCount:number;actorFollowingCount:number|null;
};
const exact662=(v:unknown):number|null=>typeof v==='number'&&
 Number.isSafeInteger(v)&&v>=0&&v<=1_000_000_000?v:null;
const local662=(v:unknown)=>exact662(v)??0;
export const resolveFollowCounts662=({
 previousFollowing,following,baseFollowerCount,baseFollowingCount,
 baseActorFollowingCount,canonical,
}:{
 previousFollowing:boolean;following:boolean;
 baseFollowerCount:number;baseFollowingCount:number;
 baseActorFollowingCount:number|null;
 canonical?:CanonicalFollowCounts662|null;
}):DisplayFollowCounts662=>{
 const delta=Number(following)-Number(previousFollowing);
 const followerBase=Math.max(0,local662(baseFollowerCount)+delta);
 const actorBase=baseActorFollowingCount===null?null:
  Math.max(0,local662(baseActorFollowingCount)+delta);
 const confirmedTarget=canonical?.countVerified661===true;
 const confirmedActor=canonical?.actorCountVerified662===true;
 return {
  followerCount:(confirmedTarget?exact662(canonical?.followerCount):null)??followerBase,
  followingCount:(confirmedTarget?exact662(canonical?.followingCount):null)??local662(baseFollowingCount),
  actorFollowingCount:(confirmedActor?exact662(canonical?.actorFollowingCount):null)??actorBase,
 };
};
// Ignore retained cross-device actor events predating an authenticated own-count
// GET; no page/focus polling. Changes later than the request can be reflected
// even when the already-in-flight GET resolves afterward.
export const shouldApplyActorFollowSignal662=(eventAt:number,requestAt:number)=>
 Number.isSafeInteger(eventAt)&&eventAt>0&&
 (!Number.isSafeInteger(requestAt)||requestAt<=0||eventAt>requestAt);

// APP689: only the signed-in owner's OWN page may show unsent local follow
// deltas. Never publish this provisional value into shared/public caches.
// Each pending pair stores the pre-window own following count; using the
// earliest baseline avoids double-applying an already visible local delta.
export const displayOwnPendingFollowing689=(
 verifiedCount:number,
 pending:ReadonlyArray<{
  baseFollowing:boolean;desiredFollowing:boolean;
  baseActorFollowingCount:number|null;updatedAt:number;
 }>,
):number=>{
 const safe=(value:unknown):number|null=>typeof value==='number'&&
   Number.isSafeInteger(value)&&value>=0&&value<=1_000_000_000?value:null;
 const rows=pending.filter(row=>row&&typeof row.baseFollowing==='boolean'&&
   typeof row.desiredFollowing==='boolean'&&Number.isSafeInteger(row.updatedAt));
 if(!rows.length)return safe(verifiedCount)??0;
 const anchored=[...rows].sort((a,b)=>a.updatedAt-b.updatedAt);
 const base=safe(anchored[0].baseActorFollowingCount)??safe(verifiedCount)??0;
 const delta=rows.reduce((total,row)=>
   total+Number(row.desiredFollowing)-Number(row.baseFollowing),0);
 return Math.max(0,Math.min(1_000_000_000,base+delta));
};
