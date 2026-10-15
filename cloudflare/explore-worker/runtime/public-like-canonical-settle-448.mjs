// SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015
// Public like membership settles immediately, but the published track_stats
// count changes only when the shared window closes. Release is two-phase:
// read the exact changed-track target counts first, checkpoint them in the DO,
// then apply those exact counts. This keeps retries idempotent.
const MAX_TRACKS_PER_QUERY_448=80;

const cleanTrackIds448=(trackIds)=>{
  if(!Array.isArray(trackIds)||trackIds.length<1)throw Error('448_PUBLIC_TRACKS_REQUIRED');
  const ids=[...new Set(trackIds.map(id=>String(id||'').trim()).filter(Boolean))];
  if(!ids.length||ids.some(id=>id.length>512))throw Error('448_PUBLIC_TRACKS_INVALID');
  return ids;
};

const cleanPlanRows448=(rows)=>{
  if(!Array.isArray(rows)||!rows.length)throw Error('448_PUBLIC_PLAN_REQUIRED');
  const out=[],seen=new Set();
  for(const raw of rows){
    const trackId=String(raw?.trackId||raw?.track_id||'').trim();
    const targetLikeCount=Number(raw?.targetLikeCount??raw?.target_like_count);
    if(!trackId||trackId.length>512||seen.has(trackId)||
       !Number.isSafeInteger(targetLikeCount)||targetLikeCount<0)
      throw Error('448_PUBLIC_PLAN_INVALID');
    seen.add(trackId);
    out.push({trackId,targetLikeCount});
  }
  return out;
};

export async function planPublicLikeCountsFromMembership448(db,trackIds){
  if(!db?.prepare)throw Error('448_PUBLIC_PLAN_INPUT_INVALID');
  const ids=cleanTrackIds448(trackIds);
  const changedRows=[];
  let readQueries=0;
  for(let offset=0;offset<ids.length;offset+=MAX_TRACKS_PER_QUERY_448){
    const part=ids.slice(offset,offset+MAX_TRACKS_PER_QUERY_448);
    const values=part.map(()=>'?').join(',');
    const sql=`
      SELECT t.id AS track_id,
        COALESCE(s.like_count,0) AS published_like_count,
        COUNT(l.user_uid) AS target_like_count
      FROM tracks t
      LEFT JOIN track_stats s ON s.track_id=t.id
      LEFT JOIN likes l ON l.track_id=t.id
      WHERE t.id IN (${values})
      GROUP BY t.id,s.like_count
    `;
    const result=await db.prepare(sql).bind(...part).all();
    readQueries++;
    for(const row of result?.results||[]){
      const trackId=String(row?.track_id||'').trim();
      const publishedLikeCount=Number(row?.published_like_count);
      const targetLikeCount=Number(row?.target_like_count);
      if(!part.includes(trackId)||!Number.isSafeInteger(publishedLikeCount)||
         publishedLikeCount<0||!Number.isSafeInteger(targetLikeCount)||
         targetLikeCount<0)
        throw Error('448_PUBLIC_PLAN_RESULT_INVALID');
      if(publishedLikeCount!==targetLikeCount)
        changedRows.push({trackId,targetLikeCount,publishedLikeCount});
    }
  }
  return {
    requestedTracks:ids.length,
    changedTracks:changedRows.length,
    changedTrackIds:changedRows.map(row=>row.trackId),
    changedRows,
    d1ReadQueries:readQueries,
    d1Writes:0,
  };
}

export async function applyPublicLikeCountPlan448(
  db,rows,nowMs=Date.now(),
){
  if(!db?.prepare||!Number.isSafeInteger(nowMs)||nowMs<=0)
    throw Error('448_PUBLIC_APPLY_INPUT_INVALID');
  const plan=cleanPlanRows448(rows);
  let writeQueries=0,writes=0;
  const appliedTrackIds=[];
  for(let offset=0;offset<plan.length;offset+=MAX_TRACKS_PER_QUERY_448){
    const part=plan.slice(offset,offset+MAX_TRACKS_PER_QUERY_448);
    const values=part.map(()=>'(?,?,0,0,?)').join(',');
    const args=[];
    for(const row of part)args.push(row.trackId,row.targetLikeCount,nowMs);
    const sql=`
      INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)
      VALUES ${values}
      ON CONFLICT(track_id) DO UPDATE SET
        like_count=excluded.like_count,
        updated_at=excluded.updated_at
      WHERE track_stats.like_count<>excluded.like_count
      RETURNING track_id,like_count
    `;
    const result=await db.prepare(sql).bind(...args).all();
    writeQueries++;
    writes+=Number(result?.meta?.changes||0);
    for(const row of result?.results||[]){
      const trackId=String(row?.track_id||'').trim();
      const likeCount=Number(row?.like_count);
      const planned=part.find(item=>item.trackId===trackId);
      if(!planned||!Number.isSafeInteger(likeCount)||likeCount<0||
         likeCount!==planned.targetLikeCount)
        throw Error('448_PUBLIC_APPLY_RESULT_INVALID');
      appliedTrackIds.push(trackId);
    }
  }
  return {
    plannedTracks:plan.length,
    appliedTrackIds:[...new Set(appliedTrackIds)],
    d1ReadQueries:0,
    d1WriteQueries:writeQueries,
    d1Writes:writes,
  };
}

// Compatibility helper for focused tests and any source-only callers.
export async function settlePublicLikeCountsFromMembership448(
  db,trackIds,nowMs=Date.now(),
){
  const planned=await planPublicLikeCountsFromMembership448(db,trackIds);
  if(!planned.changedRows.length)return planned;
  const applied=await applyPublicLikeCountPlan448(db,planned.changedRows,nowMs);
  return {
    ...planned,
    d1WriteQueries:applied.d1WriteQueries,
    d1Writes:applied.d1Writes,
    appliedTrackIds:applied.appliedTrackIds,
  };
}
