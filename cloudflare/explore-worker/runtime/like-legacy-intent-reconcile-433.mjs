// Stage433 dormant: bounded read-only canonical recovery for upgraded
// clients carrying old pending intents with no operationId/expectedRevision.
// NEVER synthesize a stable ID/revision or return a fake mutation ACK.
// Only usable after a shared, all-environment 171/174/419 writer freeze.
import {createLikeD1OnlyCanonical171} from './like-d1only-171.mjs';
const fail433=code=>Object.assign(new Error(code),{code,status:409});
const valid433=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&v.trim()===v;

export async function readAuthoritativeLikeIntents433({
  db,uid,trackIds,allEnvironmentCutoverVerified=false,
}={}){
  if(allEnvironmentCutoverVerified!==true)
    throw fail433('433_ALL_ENVIRONMENT_FENCE_NOT_PROVEN');
  if(!valid433(uid,256)||!Array.isArray(trackIds)||trackIds.length<1||
     trackIds.length>10||trackIds.some(id=>!valid433(id,512))||
     new Set(trackIds).size!==trackIds.length)
    throw fail433('433_INVALID_TARGETED_RECONCILIATION');
  const canonical=createLikeD1OnlyCanonical171(db,{cutoverVerified:true});
  const rows=[];
  for(const trackId of trackIds){
    const row=await canonical.readSnapshot(uid,trackId);
    if(!row.eligible){
      rows.push({trackId,status:'ineligible'});
      continue;
    }
    rows.push({trackId,status:'exact',liked:row.liked,
      revision:row.revision,likeCount:row.likeCount,
      generation:row.generation});
  }
  return{ok:true,data:{
    source:'canonical-171-after-three-environment-fence',
    appliedMutation:false,canonicalD1:'read-only',
    results:rows,
  }};
}

// Rebase only AFTER an authenticated 433 exact server read. Same desired
// state means no new write. A different state can be sent with a NEW stable
// operationId (generated once by the current upgraded client) and exact
// server revision; retry uses that same ID. A previously ambiguous old
// request cannot survive the global legacy fence.
export function reconcileLegacyPendingIntent433(pending,server,idFactory){
  if(!pending||!valid433(pending.trackId,512)||
     typeof pending.desiredLiked!=='boolean'||!server||
     server.trackId!==pending.trackId||
     server.status!=='exact'||typeof server.liked!=='boolean'||
     !Number.isSafeInteger(server.revision)||server.revision<0||
     !Number.isSafeInteger(server.likeCount)||server.likeCount<0)
    throw fail433('433_EXACT_AUTHORITY_UNAVAILABLE_RETAIN_OUTBOX');
  if(server.liked===pending.desiredLiked)return{
    status:'already-satisfied',trackId:pending.trackId,
    canonicalRevision:server.revision,clearOnlyIfUnchanged:true,
  };
  if(typeof idFactory!=='function')
    throw fail433('433_STABLE_OPERATION_ID_REQUIRED');
  const operationId=idFactory();
  if(!valid433(operationId,128)||!/^[a-zA-Z0-9_-]+$/.test(operationId))
    throw fail433('433_INVALID_STABLE_OPERATION_ID');
  return{status:'rebased',pending:{
    ...pending,operationId,expectedRevision:server.revision,
    baseLiked:server.liked,baseLikeCount:server.likeCount,
    retryCount:0,
  }};
}
