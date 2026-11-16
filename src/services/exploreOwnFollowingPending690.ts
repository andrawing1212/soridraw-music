// APP690: owner-only presentation of the five-second pending Follow choices.
// Never persist this projection as an exact server list or publish it publicly.
import type { ExploreProfileConnection } from './exploreSocialService';

export type OwnFollowingChoice690 = {
  targetUid:string;desiredFollowing:boolean;updatedAt:number;
};
export const overlayOwnFollowingPending690 = (
  items:ReadonlyArray<ExploreProfileConnection>,
  pending:ReadonlyArray<OwnFollowingChoice690>,
  readProfile:(uid:string)=>ExploreProfileConnection|null,
):ExploreProfileConnection[]=>{
  if(!pending.length)return [...items];
  const latest=new Map<string,OwnFollowingChoice690>();
  for(const row of pending){
    if(!row?.targetUid||typeof row.desiredFollowing!=='boolean')continue;
    const old=latest.get(row.targetUid);
    if(!old||row.updatedAt>=old.updatedAt)latest.set(row.targetUid,row);
  }
  const output=items.filter(row=>latest.get(row.uid)?.desiredFollowing!==false);
  const seen=new Set(output.map(row=>row.uid));
  for(const row of latest.values()){
    if(!row.desiredFollowing||seen.has(row.targetUid))continue;
    const profile=readProfile(row.targetUid);
    if(!profile||profile.uid!==row.targetUid)continue;
    output.push({...profile,followedAt:row.updatedAt});
    seen.add(row.targetUid);
  }
  return output;
};
