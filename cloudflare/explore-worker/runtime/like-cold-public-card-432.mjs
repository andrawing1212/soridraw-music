// Stage432 dormant PREVIEW-only cold-card recovery for 171 cutover.
// Unlike a full-Feed rebuild, this performs ONE bounded indexed track lookup
// on an actual authenticated like prewrite when a single card R2 is absent.
// NEVER call before legacy writers in all three environments are frozen.
// The normal warm route performs ZERO D1 reads from this helper.
const fail432=code=>Object.assign(new Error(code),{code});
const valid432=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&v.trim()===v;
const key432=id=>'internal/explore/shared-track-card-v115/'+encodeURIComponent(id)+'.json';

// Matches the established Stage062 card shape without scanning other songs.
// The effective count MUST include the 171 overlay, never legacy alone.
const sql432=`SELECT
  t.id, t.owner_uid,
  p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,
  t.title,t.cover_url,t.suno_url_primary,t.suno_url_secondary,
  t.published_at,t.profile_pinned,
  COALESCE(s.like_count,0)+COALESCE(d.delta,0) AS like_count,
  COALESCE(d.generation,0) AS generation
 FROM tracks t
 JOIN public_profiles p ON p.uid=t.owner_uid AND p.is_public=1
 LEFT JOIN track_stats s ON s.track_id=t.id
 LEFT JOIN explore_like_count_deltas_171 d ON d.track_id=t.id
 WHERE t.id=? AND t.is_public=1 AND t.status='published'
 LIMIT 1`;

export async function recoverVerifiedColdCard432({
  db,sharedR2,trackId,cutoverVerified=false,now=()=>Date.now(),
}={}){
  if(cutoverVerified!==true)throw fail432('432_SHARED_WRITER_FREEZE_REQUIRED');
  if(!valid432(trackId,512)||!db?.prepare||!sharedR2?.get||!sharedR2?.put)
    throw fail432('432_INVALID_TRACK_OR_BINDING');
  const key=key432(trackId);
  if(await sharedR2.get(key))return {status:'exists'};
  const row=await db.prepare(sql432).bind(trackId).first();
  if(!row||row.id!==trackId||!valid432(row.owner_uid,256))
    throw fail432('432_PUBLIC_TRACK_NOT_CANONICALLY_VERIFIED');
  const count=Number(row.like_count),generation=Number(row.generation);
  if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(generation)||generation<0)
    throw fail432('432_CANONICAL_COUNT_OR_GENERATION_INVALID');
  // Identical normalized fields to Stage062; do not fabricate private media.
  const item={
    id:row.id,ownerUid:row.owner_uid,
    ownerNickname:String(row.owner_nickname||'').trim(),
    ownerAvatarUrl:String(row.owner_avatar_url||'').trim(),
    title:String(row.title||'').trim(),
    coverUrl:String(row.cover_url||'').trim(),
    sunoUrlPrimary:String(row.suno_url_primary||'').trim(),
    openUrl:String(row.suno_url_primary||row.suno_url_secondary||'').trim(),
    likeCount:count,publishedAt:Math.max(0,Number(row.published_at||0)),
    profilePinned:Boolean(row.profile_pinned),likeGeneration421:generation,
  };
  if(!item.title)throw fail432('432_PUBLIC_TRACK_DATA_INCOMPLETE');
  const stamp=Math.max(1,Math.floor(Number(now())||0));
  const body={schemaVersion:1,trackId,updatedAt:stamp,card:item};
  const written=await sharedR2.put(key,JSON.stringify(body),{
    onlyIf:{etagDoesNotMatch:'*'},
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{soridrawSharedTrackCard:'115',
      updatedAt:String(stamp),coldVerified432:'1'},
  });
  if(written)return{status:'created',trackId,generation};
  // A concurrent publisher may have created a newer card. Never overwrite it.
  if(await sharedR2.get(key))return{status:'concurrent-created'};
  throw fail432('432_COLD_CARD_CAS_RETRY_REQUIRED');
}
