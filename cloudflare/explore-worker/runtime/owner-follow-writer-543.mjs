// APP543: isolated source wiring for the ACTUAL canonical follow counter path.
// Compile-time OFF; no extra D1 reads on any existing request.
export const OWNER_FOLLOW_INLINE_543_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
export async function resolveOwnerFollowWriter543({
 env,targetUid,mode,enabled=OWNER_FOLLOW_INLINE_543_COMPILED_OPEN,
}={}){
 if(!enabled||mode!=='legacy'||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_INLINE_543!=='1')return null;
 if(!UID.test(String(targetUid||'')))throw Error('543_INVALID_OWNER_UID');
 // D1 epoch is written only by the HMAC-signed, Firebase Admin-authenticated
 // enrollment operation; NEVER use an epoch provided by actor/client data.
 const row=await env.DB.prepare(
  'SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=? LIMIT 1'
 ).bind(targetUid).first();
 if(!row||row.epoch==='')return null; // un-enrolled owner: proven old path.
 if(!EPOCH.test(String(row.epoch||'')))throw Error('543_CORRUPT_OWNER_EPOCH');
 return row.epoch;
}
