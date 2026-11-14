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
