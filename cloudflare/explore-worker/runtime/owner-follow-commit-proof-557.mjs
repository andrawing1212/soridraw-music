// APP557: read-only, exact canonical overlay receipt gate for a durable
// pre-commit owner-follow reservation. SOURCE ONLY; not a public endpoint.
// The older APP556 R2-version-only replay was unsafe: an unrelated profile
// edit could increase revision after a rejected follow operation.
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const TOKEN=/^.{1,128}$/;
export const APP557_FOLLOW_COMMIT_PROOF_COMPILED_OPEN=false;
export async function verifyOwnerFollowCommitProof557({reservation,env}={}){
 const r=reservation||{};
 if(!UID.test(String(r.ownerUid||''))||!UID.test(String(r.actorUid||''))||
    r.actorUid===r.ownerUid||!OP.test(String(r.operationId||''))||
    !TOKEN.test(String(r.cutoverToken||''))||
    typeof r.desired!=='boolean'||typeof r.beforeFollowing!=='boolean'||
    r.desired===r.beforeFollowing||
    !Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0||
    !Number.isSafeInteger(r.priorR2Revision)||r.priorR2Revision<0)
  return {status:'invalid-reservation',committed:false};
 const media=env?.PROFILE_MEDIA;
 if(!media||typeof media.get!=='function')
  return {status:'r2-unavailable',committed:false};
 let manifest;
 try{
  const file=await media.get('internal/explore/follow-cutover-v348/active.json');
  if(!file)return {status:'cutover-unavailable',committed:false};
  manifest=JSON.parse(await file.text());
 }catch{return {status:'cutover-unavailable',committed:false}}
 if(manifest?.cutoverToken!==r.cutoverToken||
    manifest?.relationMode!=='overlay348'||manifest?.writeMode!=='active'||
    manifest?.profileCountsR2Exact!==true||
    manifest?.crashConsistentWriter354!==true||
    manifest?.orderedClientRequests354!==true||
    manifest?.oneWayAuthority348!==true||
    manifest?.legacyRelationWritersFrozen!==true||
    manifest?.legacyCounterWritersFrozen!==true)
  return {status:'cutover-mismatch',committed:false};
 const key='internal/explore/follow-intents-v354/'+
  encodeURIComponent(r.cutoverToken)+'/'+encodeURIComponent(r.actorUid)+'/'+
  encodeURIComponent(r.ownerUid)+'.json';
 let op;
 try{
  const file=await media.get(key);
  if(!file)return {status:'intent-not-present',committed:false};
  op=JSON.parse(await file.text());
 }catch{return {status:'intent-unavailable',committed:false}}
 if(op?.token!==r.cutoverToken||op?.actor!==r.actorUid||
    op?.target!==r.ownerUid||op?.id!==r.operationId||
    op?.following!==r.desired||op?.expectedRevision!==r.expectedRevision)
  return {status:'intent-not-matching',committed:false};
 if(op?.settled!==true||
    !Number.isSafeInteger(op.revision)||op.revision<=r.expectedRevision)
  return {status:'intent-not-settled',committed:false};
 // A settled exact pair intent is necessary, but the outgoing owner snapshot
 // still needs its own exact+no-pending R2 guard and Auth-incarnation proof.
 return {status:'committed',committed:true,operationRevision:op.revision};
}
