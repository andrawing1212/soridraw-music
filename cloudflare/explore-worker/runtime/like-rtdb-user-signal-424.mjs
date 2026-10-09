// SORIDRAW 424 SOURCE-ONLY: server-assisted account-owned RTDB signal.
// This matches the EXISTING database.rules.json userSync/$uid/exploreLike
// allowed payload exactly (no extra fields, zero database-rules changes).
// Only use a Firebase ID token already VERIFIED as the exact authenticated UID.
// RTDB conditional PUT prevents racing PC/mobile changes from being overwritten.
// The REST auth query parameter is Firebase's documented ID-token transport;
// NEVER log request URLs, auth tokens or serialized signal payloads.
const fixedOrigin424='https://soridraw-app-866a5-default-rtdb.firebaseio.com';
const err424=(code)=>Object.assign(new Error(code),{code});
const good424=(s,max)=>typeof s==='string' && s.length>0 &&
  s.length<=max&&s===s.trim();
const maxVersion424=Number.MAX_SAFE_INTEGER-2;

export function createLikeUserRtdbSignal424({
  authenticatedUid, firebaseIdToken, fetchImpl=fetch, now=()=>Date.now(),
}={}){
  if(!good424(authenticatedUid,128) ||
     !good424(firebaseIdToken,8192) || typeof fetchImpl!=='function'){
    throw err424('424_VERIFIED_UID_AND_FIREBASE_ID_TOKEN_REQUIRED');
  }
  const resource=fixedOrigin424+'/userSync/'+
    encodeURIComponent(authenticatedUid)+'/exploreLike.json?auth='+
    encodeURIComponent(firebaseIdToken);
  return async function queueSameAccountSignal({
    uid,trackId,ownerUid,liked,likeCount,revision,
  }={}){
    if(uid!==authenticatedUid || !good424(trackId,512) ||
       typeof ownerUid!=='string' || ownerUid.length>128 ||
       typeof liked!=='boolean' || !Number.isSafeInteger(likeCount) ||
       likeCount<0 || likeCount>1000000000 ||
       !Number.isSafeInteger(revision) || revision<0){
      throw err424('424_AUTH_UID_OR_SIGNAL_INVALID');
    }
    const row={trackId,ownerUid,liked,likeCount,canonicalSettled417:true};
    for(let attempt=0;attempt<8;attempt++){
      let response=await fetchImpl(resource,{
        method:'GET',headers:{'X-Firebase-ETag':'true'},
      });
      if(!response?.ok)throw err424('424_RTDB_HEAD_NOT_VERIFIED');
      const tag=response.headers?.get('etag');
      if(!tag||tag.length>256)throw err424('424_RTDB_ETAG_MISSING');
      let prior;
      try {prior=await response.json();}
      catch {throw err424('424_RTDB_JSON_UNREADABLE');}
      const prev=Number(prior?.version||0);
      if(!Number.isSafeInteger(prev)||prev<0||prev>=maxVersion424)
        throw err424('424_RTDB_VERSION_INVALID');
      if(Array.isArray(prior?.results) && prior.results.length===1 &&
         prior.results[0]?.trackId===trackId &&
         prior.results[0]?.liked===liked &&
         prior.results[0]?.likeCount===likeCount &&
         prior.results[0]?.canonicalSettled417===true) {
        return {queued:true,trackId,revision,unchanged:true};
      }
      const version=Math.max(1,Math.floor(Number(now())||0),prev+1);
      if(!Number.isSafeInteger(version)||version>=maxVersion424)
        throw err424('424_RTDB_NEXT_VERSION_INVALID');
      const body={version,previousVersion:prev,results:[row]};
      response=await fetchImpl(resource,{
        method:'PUT',headers:{
          'Content-Type':'application/json; charset=utf-8',
          'if-match':tag,
        },body:JSON.stringify(body),
      });
      if(response?.status===412)continue; // CAS race; recheck existing signal
      if(!response?.ok)throw err424('424_RTDB_SIGNAL_NOT_PERSISTED');
      return {queued:true,trackId,revision};
    }
    throw err424('424_RTDB_CONCURRENT_SIGNAL_RETRY_EXHAUSTED');
  };
}
