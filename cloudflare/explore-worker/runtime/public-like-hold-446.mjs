// Stage416 public hold journal candidate — NOT ACTIVE/NOT DEPLOYED.
// Signed net deltas are persisted in the SAME D1 transaction as canonical
// 035/069 drain, BEFORE 'likes' membership or queue deletion is changed.
// The existing 075 and bounded 191 queries read only the changed track IDs.
// Do not execute additive SQL migration without specific user approval.
export const PUBLIC_HOLD_TABLE_446='explore_like_public_hold_446';

export function makePublicHoldStatement446(db,cte,prefix,now){
  if(!db?.prepare||typeof cte!=='string'||!Array.isArray(prefix)||
     !Number.isSafeInteger(now)||now<=0)throw Error('446_INVALID_JOURNAL_REQUEST');
  // CTE 'deltas' is the exact settled net after de-duping same-UID changes.
  // Grouping by winning batch_id avoids duplicate same-track journal keys.
  const statement=cte+`
    INSERT INTO explore_like_public_hold_446(batch_id,track_id,created_at,delta)
    SELECT batch_id,track_id,?,SUM(delta)
    FROM deltas WHERE stage416_signed=1 AND delta<>0
    GROUP BY batch_id,track_id HAVING SUM(delta)<>0
    ON CONFLICT(batch_id,track_id) DO NOTHING
  `;
  return db.prepare(statement).bind(...prefix,now);
}

// Embed in the EXISTING bounded SELECT. Requires an index lookup for each
// changed/first-page row; no extra D1 query or whole-journal enumeration.
// For signed Master -1 + ordinary +1: canonical=10, held=-1 -> public=11.
export const PUBLIC_HELD_DELTA_SQL_446=(trackAlias)=>
  `COALESCE((SELECT SUM(h.delta) FROM explore_like_public_hold_446 h WHERE h.track_id=${trackAlias}),0)`;

export const projectPublicCount446=(canonical,held)=>
  Math.max(0,Number(canonical)-Number(held));

// A release must run only after server-verified public deadline. This WHERE
// boundary never clears newer-window journal rows on the same track. A
// successful public projection is the precondition, and retry is idempotent.
export function makeReleaseHoldStatement446(db,trackIds,deadlineAtMs){
  if(!db?.prepare||!Array.isArray(trackIds)||!trackIds.length||
     !Number.isSafeInteger(deadlineAtMs)||deadlineAtMs<=0||
     trackIds.length>256||trackIds.some(id=>typeof id!=='string'||!id||id.length>512))
    throw Error('446_INVALID_HOLD_RELEASE');
  const ids=[...new Set(trackIds)];
  const sql=`DELETE FROM explore_like_public_hold_446
    WHERE created_at<=? AND track_id IN (${ids.map(()=>'?').join(',')})`;
  return db.prepare(sql).bind(deadlineAtMs,...ids);
}
