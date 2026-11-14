// APP662: alter ONLY the settled canonical overlay follow ACK on the active
// PREVIEW Worker. The old (frozen) legacy writer is deliberately untouched.
import {createHash} from 'node:crypto';
export const sha662=x=>createHash('sha256').update(x).digest('hex');
export const LIVE_MAIN_SHA662='607d2a12da52cbff6da1173d4c165c1d337d74adf782de2a30872a26682d0e83';
const once=(s,needle,replacement)=>{
 if(s.split(needle).length!==2)throw Error('APP662_LIVE_ACK_ANCHOR_CHANGED');
 return s.replace(needle,replacement);
};
const anchorBefore=`  const current = await readFollowProfile354(env, target, cutover);
  if (!result2.duplicate) await invalidateFollowProfiles355(request, env, [actor, target]);`;
const anchorAfter=`  const current = await readFollowProfile354(env, target, cutover);
  // The actor's Following total is ALREADY an exact R2 projection created by
  // the same settled overlay operation. Legacy profile_stats is frozen.
  // Read only the changed actor's R2 profile, not the complete relation list.
  let actorProfile662 = await readFollowProfile354(env, actor, cutover);
  if (!actorProfile662.sync.exact || Object.keys(actorProfile662.sync.pending).length) {
    await repairFollowProfile354(env, actor, cutover, request);
    actorProfile662 = await readFollowProfile354(env, actor, cutover);
  }
  const actorFollowing662 = actorProfile662.bundle?.body?.data?.profile?.followingCount;
  const targetFollower662 = current.bundle?.body?.data?.profile?.followerCount;
  const targetFollowing662 = current.bundle?.body?.data?.profile?.followingCount;
  const validCount662 = count => typeof count === "number" &&
    Number.isSafeInteger(count) && count>=0 && count<=1e9;
  const canonicalCounts662 = current.sync.exact===true &&
    Object.keys(current.sync.pending).length===0 &&
    actorProfile662.sync.exact===true &&
    Object.keys(actorProfile662.sync.pending).length===0 &&
    validCount662(actorFollowing662) && validCount662(targetFollower662) &&
    validCount662(targetFollowing662);
  if (!result2.duplicate) await invalidateFollowProfiles355(request, env, [actor, target]);`;
const anchorReply=`      followerCount: current.bundle.body.data.profile.followerCount,
      followingCount: current.bundle.body.data.profile.followingCount`;
const patchedReply=`      followerCount: current.bundle.body.data.profile.followerCount,
      followingCount: current.bundle.body.data.profile.followingCount,
      followProtocol: 354,
      canonicalCounts662,
      actorFollowingCount: canonicalCounts662 ? actorFollowing662 : null`;
export function patchSettledCanonicalFollowAck662(source,expectedSha=LIVE_MAIN_SHA662){
 if(sha662(source)!==expectedSha)throw Error('APP662_LIVE_MAIN_SOURCE_SHA_DRIFT');
 const begin=source.indexOf('async function handleFollowOverlay354(');
 const end=source.indexOf('\n__name(handleFollowOverlay354',begin);
 if(begin<0||end<=begin)throw Error('APP662_LIVE_OVERLAY_WRITER_BOUNDARY_DRIFT');
 let section=source.slice(begin,end);
 section=once(section,anchorBefore,anchorAfter);
 section=once(section,anchorReply,patchedReply);
 const updated=source.slice(0,begin)+section+source.slice(end);
 if(updated===source)throw Error('APP662_UNCHANGED_OVERLAY_ACK');
 return updated;
}
