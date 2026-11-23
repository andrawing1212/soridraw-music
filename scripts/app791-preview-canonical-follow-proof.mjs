// APP791: PREVIEW source-only exact current canonical observation adapter.
// Reuses the existing 348/354 D1/R2 contracts. No writer, endpoint, alarm,
// user enrollment, new resource, or active Worker import. NOT a complete
// independent history/cutover proof, nor authority to send a notification.
export const APP791_PREVIEW_CANONICAL_PROOF_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/, OP=/^[A-Za-z0-9_-]{16,128}$/, EPOCH=/^[a-f0-9]{32}$/;
const revision=x=>Number.isSafeInteger(x)&&x>=0;
const hold=reason=>Object.freeze({status:'HOLD',reason,canonicalWriteAuthorized:false,relayAuthorized:false,deployAuthorized:false});
const flags=['profileCountsR2Exact','crashConsistentWriter354','orderedClientRequests354','oneWayAuthority348','legacyRelationWritersFrozen','legacyCounterWritersFrozen'];
const manifestKey='internal/explore/follow-cutover-v348/active.json';
const intentKey=a=>'internal/explore/follow-intents-v354/'+[a.cutoverToken,a.actorUid,a.ownerUid].map(encodeURIComponent).join('/')+'.json';
const profileKey=a=>'internal/explore/shared-profile-v113/'+encodeURIComponent(a.ownerUid)+'.json';
// One exact indexed pair + owner epoch lookup, not a list or count scan.
const sql='SELECT o.following, o.updated_at, o.mutation_id, p.owner_follow_auth_epoch_532 AS epoch FROM explore_follow_overrides_348 o JOIN profile_stats p ON p.uid=o.following_uid WHERE o.follower_uid=? AND o.following_uid=? LIMIT 1';
const valid=a=>a&&UID.test(a.ownerUid||'')&&UID.test(a.actorUid||'')&&a.ownerUid!==a.actorUid&&
 OP.test(a.canonicalOperationId||'')&&OP.test(a.operationId||'')&&a.operationId!==a.canonicalOperationId&&
 EPOCH.test(a.authEpoch||'')&&typeof a.cutoverToken==='string'&&a.cutoverToken.length>0&&a.cutoverToken.length<=128&&
 revision(a.expectedRevision)&&revision(a.priorR2Revision)&&typeof a.desired==='boolean'&&
 a.beforeFollowing===!a.desired&&a.durable===true&&a.ownerDoAlarmScheduled===true;
const json=async(b,k,max)=>{
 const o=await b.get(k);
 if(!o||typeof o.etag!=='string'||!o.etag)throw Error('OBJECT_MISSING');
 const t=await o.text();if(t.length>max)throw Error('OBJECT_SIZE');
 return {etag:o.etag,value:JSON.parse(t)};
};
const pendingEmpty=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===0;
export function createApp791PreviewCanonicalProof({enabled=APP791_PREVIEW_CANONICAL_PROOF_COMPILED_OPEN,
 verifyBoundReceipt}={}){
 if(enabled!==true)return null;
 if(typeof verifyBoundReceipt!=='function')throw Error('APP791_TRUSTED_RECEIPT_REQUIRED');
 return async ({env,reservation:a}={})=>{
  // The future owner service must obtain this ticket from its bound durable
  // store. Browser bodies/ACKs are NOT sufficient; do not expose as a route.
  if(env?.SORIDRAW_ENVIRONMENT!=='preview'||!valid(a)||
     !env?.DB?.prepare||!env?.PROFILE_MEDIA?.get||!env?.PROFILE_MEDIA?.head)
   return hold('PREVIEW_SCOPE_OR_RECEIPT_UNVERIFIED');
  try{
   if(await verifyBoundReceipt({env,reservation:a})!==true)return hold('BOUND_DURABLE_RECEIPT_UNVERIFIED');
   const bucket=env.PROFILE_MEDIA;
   const m=await json(bucket,manifestKey,65536);
   if(m.value?.relationMode!=='overlay348'||m.value.writeMode!=='active'||
      m.value.cutoverToken!==a.cutoverToken||!flags.every(k=>m.value[k]===true))
    return hold('CANONICAL_MANIFEST_UNVERIFIED');
   const k=intentKey(a),i=await json(bucket,k,8192),p=i.value;
   if(p?.token!==a.cutoverToken||p.actor!==a.actorUid||p.target!==a.ownerUid||
      p.id!==a.canonicalOperationId||p.following!==a.desired||
      p.expectedRevision!==a.expectedRevision||!revision(p.revision)||p.revision<=a.expectedRevision)
    return hold('PAIR_INTENT_IDENTITY_MISMATCH');
   if(p.settled!==true)return hold('PAIR_INTENT_NOT_SETTLED');
   const row=await env.DB.prepare(sql).bind(a.actorUid,a.ownerUid).first();
   // Exact changed operation. A same-state/no-op receipt may have advanced
   // the R2 intent but did not change mutation_id in the D1 overlay.
   if(!row||row.mutation_id!==a.canonicalOperationId||row.updated_at!==p.revision||
      row.following!==Number(a.desired)||row.epoch!==a.authEpoch)
    return hold('D1_EXACT_MUTATION_OR_OWNER_EPOCH_MISMATCH');
   const pr=await json(bucket,profileKey(a),8*1024*1024),b=pr.value;
   const v=b?.body?.data?.profile,s=b?.followSync354;
   // Real owner projection revisions are distinct from pair revisions.
   // Never derive count from desired or assume expectedRevision+1.
   if(Number(b?.schemaVersion)!==1||!Array.isArray(b.body?.data?.items)||
      v?.uid!==a.ownerUid||s?.token!==a.cutoverToken||s.exact!==true||
      !pendingEmpty(s.pending)||!revision(b.revision)||b.revision<=a.priorR2Revision||
      !revision(v.followerCount)||v.followerCount>1000000000||
      !revision(b.updatedAt)||b.updatedAt===0)
    return hold('OWNER_PROJECTION_NOT_EXACT_OR_NOT_ADVANCED');
   // Check the exact manifest and pair ETags again after the D1/profile
   // observation. A changed or missing record is HOLD, never auto retry.
   // This is NOT a cross-store transaction or a global writer fence.
   const [m2,i2]=await Promise.all([bucket.head(manifestKey),bucket.head(k)]);
   if(m2?.etag!==m.etag||i2?.etag!==i.etag)return hold('CANONICAL_OBSERVATION_CHANGED');
   return Object.freeze({status:'CURRENT_EXACT_CHANGED_COMMIT_OBSERVED',
    ownerUid:a.ownerUid,actorUid:a.actorUid,authEpoch:a.authEpoch,
    canonicalOperationId:a.canonicalOperationId,operationId:a.operationId,
    pairRevision:p.revision,ownerProjectionRevision:b.revision,
    ownerEventCandidate:Object.freeze({ownerUid:a.ownerUid,authEpoch:a.authEpoch,
      version:b.revision,followerCount:v.followerCount,updatedAt:b.updatedAt}),
    independentHistoryVerified:false,allWritersCutoverVerified:false,
    canonicalWriteAuthorized:false,relayAuthorized:false,deployAuthorized:false});
  }catch{return hold('CANONICAL_READ_UNAVAILABLE_OR_CORRUPT')}
 };
}
