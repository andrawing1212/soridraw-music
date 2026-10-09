// SORIDRAW Stage430 dormant candidate: authenticated cold, genuinely empty
// private catalog bootstrap. NEVER infer an empty catalog from missing R2 alone.
// This is source-only; the 171 route stays COMPILED_OFF until a separately
// approved all-environment shared D1 fence/phase and live audit.
const valid430 = (s,n) => typeof s === 'string' && s.length>0 && s.length<=n && s.trim()===s;
const error430 = code => Object.assign(new Error(code),{code});
const key430 = uid => 'internal/explore/shared-social-v114/likes/'+encodeURIComponent(uid)+'.json';

async function indexedEmpty430(db,table,uid) {
  // Require a bounded index lookup, never a full likes table scan. A missing
  // user_uid index must fail closed, not trigger an expensive cold bootstrap.
  const query=`SELECT 1 AS present FROM ${table} WHERE user_uid=? LIMIT 1`;
  const plan=await db.prepare('EXPLAIN QUERY PLAN '+query).bind(uid).all();
  const lines=plan?.results?.map(x=>String(x?.detail||''))||[];
  const search=lines.some(detail=>
    /\bSEARCH\b/i.test(detail) && /\bUSING\b/i.test(detail) &&
    /\b(?:INDEX|PRIMARY KEY)\b/i.test(detail));
  if(!search || lines.some(detail=>/\bSCAN\b/i.test(detail)))
    throw error430('430_INDEXED_USER_PROBE_REQUIRED');
  const row=await db.prepare(query).bind(uid).first();
  return !row;
}

export async function bootstrapVerifiedEmptyPrivate430({
  db,r2,uid,cutoverVerified=false,now=()=>Date.now(),
}={}) {
  if(cutoverVerified!==true)throw error430('430_SHARED_CUTOVER_NOT_VERIFIED');
  if(!valid430(uid,256)||!db?.prepare||!r2?.get||!r2?.put)
    throw error430('430_AUTH_UID_OR_BINDING_REQUIRED');
  const key=key430(uid);
  if(await r2.get(key))return {status:'exists'};
  // Legacy baseline and the post-cutover overlay BOTH must be absent. Even a
  // false override owns a revision and cannot be discarded or guessed.
  if(!await indexedEmpty430(db,'likes',uid))
    throw error430('430_LEGACY_LIKES_REQUIRE_EXACT_RECOVERY');
  if(!await indexedEmpty430(db,'explore_like_overrides_171',uid))
    throw error430('430_OVERLAY_REVISIONS_REQUIRE_EXACT_RECOVERY');
  const stamp=Math.max(1,Math.floor(Number(now())||0));
  const document={schemaVersion:1,uid,likedTrackIds:[],
    canonicalComplete156:true,canonicalSource156:'verified-empty-legacy-and-overlay-430',
    exactLikeCount156:0,likeRevisions423:{},updatedAt:stamp};
  // Create-if-absent R2 CAS: never overwrite a concurrent client publisher.
  const saved=await r2.put(key,JSON.stringify(document),{
    onlyIf:{etagDoesNotMatch:'*'},
    httpMetadata:{contentType:'application/json; charset=utf-8'},
    customMetadata:{soridrawSharedLikes:'114',emptyBootstrap:'430'},
  });
  if(saved)return {status:'created'};
  if(await r2.get(key))return {status:'concurrent-created'};
  throw error430('430_PRIVATE_R2_CAS_RETRY_REQUIRED');
}
