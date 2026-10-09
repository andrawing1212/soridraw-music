// Stage422 composition candidate. UNDEPLOYED, NO live Worker import.
// It connects the actual R2 public CAS publisher to the actual 171 D1 writer,
// but personal R2 persistence and same-account RTDB signaling still need
// production bindings and authentic all-environment cutover verification.
import {createLikeD1OnlyBatchAdapter420} from './like-d1only-batch-adapter-420.mjs';
import {createLikeProjectionPublisher421} from './like-public-r2-publisher-421.mjs';
import {createPersonalLikeR2Publisher423} from './like-personal-r2-publisher-423.mjs';
import {createLikeUserRtdbSignal424} from './like-rtdb-user-signal-424.mjs';
import {bootstrapVerifiedEmptyPrivate430} from './like-cold-personal-bootstrap-430.mjs';

// Stage429 pre-write readiness for the verified modern 171-only path.
// Cold/partial R2 must never be discovered only AFTER a D1 W2 mutation:
// otherwise a new account or newly published track gets stranded with an
// accepted canonical click and no durable personal/public publication.
// This performs bounded R2 reads only on an authenticated, validated mutation;
// there is no navigation read, D1 query, backfill, or shared database write.
export async function verifyLikeR2Readiness429(r2, uid, entries, {db,cutoverVerified=false}={}) {
  if(!r2?.get||typeof uid!=='string'||!uid.trim()||
      !Array.isArray(entries)||entries.length<1||entries.length>50)
    throw new Error('429_PREWRITE_REQUEST_INVALID');
  const privateKey='internal/explore/shared-social-v114/likes/'+encodeURIComponent(uid)+'.json';
  let privateObject=await r2.get(privateKey);
  if(!privateObject){
    // Never assume missing personal R2 means no previous likes. Only a fully
    // fenced all-environment writer with two indexed canonical empty proofs
    // may bootstrap a new account. Existing or uncertain users fail closed.
    if(!db||cutoverVerified!==true)throw new Error('429_PRIVATE_COLD_BEFORE_D1');
    await bootstrapVerifiedEmptyPrivate430({db,r2,uid,cutoverVerified});
    privateObject=await r2.get(privateKey);
    if(!privateObject)throw new Error('430_PRIVATE_NOT_DURABLE_BEFORE_D1');
  }
  let catalog;
  try{catalog=JSON.parse(await privateObject.text());}
  catch{throw new Error('429_PRIVATE_CORRUPT_BEFORE_D1');}
  if(catalog?.schemaVersion!==1||catalog?.uid!==uid||
     catalog?.canonicalComplete156!==true||
     !catalog?.canonicalSource156||
     !Array.isArray(catalog.likedTrackIds)||catalog.likedTrackIds.length>2000||
     new Set(catalog.likedTrackIds).size!==catalog.likedTrackIds.length||
     catalog?.exactLikeCount156!==catalog.likedTrackIds.length||
     catalog.likedTrackIds.some(id=>typeof id!=='string'||!id||
       id.length>512||id.trim()!==id))
    throw new Error('429_PRIVATE_PARTIAL_BEFORE_D1');
  const revisions=catalog.likeRevisions423||{};
  if(!revisions||typeof revisions!=='object'||Array.isArray(revisions))
    throw new Error('429_PRIVATE_REVISION_METADATA_INVALID');
  for(const item of entries){
    const prior=revisions[item.trackId];
    if(prior!==undefined&&(
      !Number.isSafeInteger(prior?.revision)||prior.revision<0||
      typeof prior?.operationId!=='string'||!prior.operationId||
      prior.operationId.length>128||typeof prior?.liked!=='boolean'))
      throw new Error('429_PRIVATE_TRACK_REVISION_INVALID');
    const newlyLiked=item.liked&&!catalog.likedTrackIds.includes(item.trackId);
    if(newlyLiked&&catalog.likedTrackIds.length>=2000)
      throw new Error('429_PRIVATE_CAPACITY_BEFORE_D1');
    if(prior===undefined&&Object.keys(revisions).length>=2000)
      throw new Error('429_PRIVATE_REVISION_CAPACITY_BEFORE_D1');
  }
  for(const item of entries){
    const id=item.trackId;
    const key='internal/explore/shared-track-card-v115/'+encodeURIComponent(id)+'.json';
    const obj=await r2.get(key);
    if(!obj)throw new Error('429_CARD_COLD_BEFORE_D1');
    let payload;
    try{payload=JSON.parse(await obj.text());}
    catch{throw new Error('429_CARD_CORRUPT_BEFORE_D1');}
    if(payload?.schemaVersion!==1||
       String(payload?.card?.id||payload?.card?.trackId||'')!==id)
      throw new Error('429_CARD_WRONG_SNAPSHOT_BEFORE_D1');
  }
  for(const sort of ['latest','popular']){
    const obj=await r2.get('internal/explore/shared-feed-v112/'+sort+'-40.json');
    if(!obj)throw new Error('429_FEED_COLD_BEFORE_D1');
    let payload;
    try{payload=JSON.parse(await obj.text());}
    catch{throw new Error('429_FEED_CORRUPT_BEFORE_D1');}
    if(!Array.isArray(payload?.payload?.data?.items)||
       payload.payload.data.items.length>40)
      throw new Error('429_FEED_WRONG_SNAPSHOT_BEFORE_D1');
  }
  return {ready:true};
}

export function createCandidateLikeBatch422({
  db, sharedR2, allEnvironmentCutoverVerified = false,
  authenticatedUid, firebaseIdToken, firebaseTokenVerified = false,
  resolveOwnerUid, persistPersonalSnapshot, queueSameAccountSignal,
} = {}) {
  if(allEnvironmentCutoverVerified !== true) {
    throw new Error('422_NOT_AUTHORIZED_TO_SWITCH_SHARED_LIKE_WRITER');
  }
  if(typeof authenticatedUid!=='string'||authenticatedUid.length===0) {
    throw new Error('422_AUTHENTICATED_UID_REQUIRED');
  }
  const personalWriter=typeof persistPersonalSnapshot==='function'
    ? persistPersonalSnapshot
    : createPersonalLikeR2Publisher423({r2:sharedR2});
  const signalWriter=typeof queueSameAccountSignal==='function'
    ? queueSameAccountSignal
    : (firebaseTokenVerified===true
      ? createLikeUserRtdbSignal424({authenticatedUid,firebaseIdToken})
      : (()=>{throw new Error('422_VERIFIED_RTDB_CREDENTIAL_REQUIRED');})());
  const publisher=createLikeProjectionPublisher421({
    sharedR2,resolveOwnerUid,persistPersonalSnapshot:personalWriter,
    queueSameAccountSignal:signalWriter,
  });
  const handler=createLikeD1OnlyBatchAdapter420(db,{
    allEnvironmentCutoverVerified:true,publishChangedTrack:publisher,
    beforeCanonicalMutation:typeof persistPersonalSnapshot==='function'
      ? null : (uid,entries)=>verifyLikeR2Readiness429(sharedR2,uid,entries,
        {db,cutoverVerified:allEnvironmentCutoverVerified===true}),
  });
  return {
    async acceptAuthenticatedBatch(uid,body){
      // Reject impersonated batch BEFORE 171 D1 receives even one statement.
      if(uid!==authenticatedUid)throw new Error('422_AUTH_UID_MISMATCH');
      return handler.acceptAuthenticatedBatch(uid,body);
    },
  };
}
