// APP669 public follow signal lifecycle revocation, source-only.
// Must deploy before enabling public-profile RTDB read/publisher; Auth deletion
// triggers perform a single exact owner path transaction (never a fan-out).
import * as functions from 'firebase-functions/v1';
import {getDatabase} from 'firebase-admin/database';
const UID=/^[A-Za-z0-9_-]{1,128}$/,GEN=/^[a-f0-9]{32}$/;
export const APP669_PUBLIC_FOLLOW_DELETION_HOOK_COMPILED_OPEN=false;
export async function revokeDeletedPublicFollow669(
 db:Pick<ReturnType<typeof getDatabase>,'ref'>,
 uid:string,epoch:string,
){
 if(!UID.test(uid)||!GEN.test(epoch))return {status:'invalid-or-not-enrolled'};
 const ref=db.ref('publicSync/exploreFollowProfiles667/'+uid);
 const outcome=await ref.transaction((current:unknown)=>{
  if(current===null)return null;
  if(!current||typeof current!=='object'||Array.isArray(current))
   return undefined;
  const row=current as Record<string,unknown>;
  // Never let a stale deletion event remove another Auth incarnation.
  return row.profileUid===uid&&row.generation===epoch?null:undefined;
 },undefined,false);
 return {status:outcome.committed?'revoked':'different-generation-or-absent'};
}
export const revokePublicFollowOnAuthDelete669=functions
 .region('asia-northeast3')
 .runWith({failurePolicy:true})
 .auth.user().onDelete(async user=>{
  if(!APP669_PUBLIC_FOLLOW_DELETION_HOOK_COMPILED_OPEN)return;
  const epoch=user.customClaims?.soridrawFollowEpoch532;
  if(typeof epoch!=='string'||!GEN.test(epoch))return;
  await revokeDeletedPublicFollow669(getDatabase(),user.uid,epoch);
 });
