// SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015
// Public like counts are materialized only when the shared window closes.
// Personal membership in `likes` is already canonical; recomputing only the
// changed track IDs avoids a pending-delta table and stays idempotent on retry.
const MAX_TRACKS_PER_QUERY_448=80;

const cleanTrackIds448=(trackIds)=>{
  if(!Array.isArray(trackIds)||trackIds.length<1)throw Error('448_PUBLIC_TRACKS_REQUIRED');
  const ids=[...new Set(trackIds.map(id=>String(id||'').trim()).filter(Boolean))];
  if(!ids.length||ids.some(id=>id.length>512))throw Error('448_PUBLIC_TRACKS_INVALID');
  return ids;
};

export async function settlePublicLikeCountsFromMembership448(
  db,trackIds,nowMs=Date.now(),
){
  if(!db?.prepare||!Number.isSafeInteger(nowMs)||nowMs<=0)
    throw Error('448_PUBLIC_SETTLE_INPUT_INVALID');
  const ids=cleanTrackIds448(trackIds);
  let statements=0,writes=0;
  const changedTrackIds=[];
  for(let offset=0;offset<ids.length;offset+=MAX_TRACKS_PER_QUERY_448){
    const part=ids.slice(offset,offset+MAX_TRACKS_PER_QUERY_448);
    const values=part.map(()=>'?').join(',');
    const sql=`
      INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)
      SELECT t.id,COUNT(l.user_uid),0,0,?
      FROM tracks t
      LEFT JOIN likes l ON l.track_id=t.id
      WHERE t.id IN (${values})
      GROUP BY t.id
      ON CONFLICT(track_id) DO UPDATE SET
        like_count=excluded.like_count,
        updated_at=excluded.updated_at
      WHERE track_stats.like_count<>excluded.like_count
      RETURNING track_id,like_count
    `;
    const result=await db.prepare(sql).bind(nowMs,...part).all();
    statements++;
    writes+=Number(result?.meta?.changes||0);
    for(const row of result?.results||[]){
      const id=String(row?.track_id||'').trim();
      const count=Number(row?.like_count);
      if(!part.includes(id)||!Number.isSafeInteger(count)||count<0)
        throw Error('448_PUBLIC_SETTLE_RESULT_INVALID');
      changedTrackIds.push(id);
    }
  }
  return {
    requestedTracks:ids.length,
    changedTracks:new Set(changedTrackIds).size,
    changedTrackIds:[...new Set(changedTrackIds)],
    d1ReadQueries:statements,
    d1Writes:writes,
  };
}
