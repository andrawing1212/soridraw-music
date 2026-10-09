// SORIDRAW 423 SOURCE-ONLY / dormant PREVIEW candidate.
// The existing shared-social-v114 account object is personal like catalog.
// Preserve its exact snapshot completeness/metadata: never assume that a
// missing/partial catalog is a complete canonical baseline.
// No D1 read/write, no whole-user rebuild or user-data copy.
const key423 = uid => 'internal/explore/shared-social-v114/likes/' +
  encodeURIComponent(uid) + '.json';
const error423 = code => Object.assign(new Error(code),{code});
const goodId423 = (s,max) => typeof s==='string' && s.length>0 &&
  s.length<=max && s===s.trim();
const goodRevision423 = n => Number.isSafeInteger(n) && n>=0;

export function createPersonalLikeR2Publisher423({r2, now=()=>Date.now()}={}) {
  if(!r2?.get||!r2?.put)throw error423('423_SHARED_R2_REQUIRED');
  return async function persistPersonalSnapshot({
    uid,trackId,liked,revision,operationId,
  }={}) {
    if(!goodId423(uid,256)||!goodId423(trackId,512)||
       typeof liked!=='boolean'||!goodRevision423(revision)||
       !goodId423(operationId,128))throw error423('423_INVALID_INTENT');
    const key=key423(uid);
    for(let attempt=0;attempt<10;attempt++){
      const obj=await r2.get(key);
      if(!obj)throw error423('423_COLD_CATALOG_REQUIRES_CANONICAL_BOOTSTRAP');
      let prior;
      try {prior=JSON.parse(await obj.text());}
      catch {throw error423('423_BROKEN_CATALOG');}
      if(prior?.schemaVersion!==1||prior?.uid!==uid||
         !Array.isArray(prior.likedTrackIds)||prior.likedTrackIds.length>2000||
         prior.canonicalComplete156!==true||
         typeof prior.canonicalSource156!=='string'||!prior.canonicalSource156||
         prior.exactLikeCount156!==prior.likedTrackIds.length) {
        throw error423('423_PERSONAL_CATALOG_NOT_CANONICAL_COMPLETE');
      }
      const list=prior.likedTrackIds;
      const unique=new Set(list);
      if(unique.size!==list.length||list.some(id=>!goodId423(id,512))) {
        throw error423('423_PERSONAL_CATALOG_DUPLICATE_OR_INVALID');
      }
      const metadata=prior.likeRevisions423||{};
      if(typeof metadata!=='object'||Array.isArray(metadata)||!metadata)
        throw error423('423_BAD_REVISION_METADATA');
      // Prototype-looking song IDs must not resolve to inherited Object keys.
      // Such an inherited 'constructor' / '__proto__' value can otherwise
      // throw only AFTER canonical D1 has committed W2.
      const prev=Object.prototype.hasOwnProperty.call(metadata,trackId)
        ? metadata[trackId] : undefined;
      if(prev!==undefined && (!goodRevision423(prev?.revision)||
          !goodId423(prev?.operationId,128)||typeof prev?.liked!=='boolean')) {
        throw error423('423_BAD_TRACK_REVISION');
      }
      if(prev?.revision>revision)throw error423('423_STALE_PRIVATE_REVISION');
      if(prev?.revision===revision) {
        if(prev.operationId!==operationId||prev.liked!==liked||
           unique.has(trackId)!==liked) {
          throw error423('423_SAME_REVISION_CONFLICT');
        }
        return {persisted:true,trackId,revision,unchanged:true};
      }
      // No writes when the prior published state is already proven equal.
      // A new D1 revision MUST still be persisted, even if liked is the same:
      // it fences future stale PC/mobile requests by that revision.
      const updated=liked
        ? (unique.add(trackId),[...unique])
        : list.filter(id=>id!==trackId);
      if(updated.length>2000)throw error423('423_PERSONAL_CATALOG_CAPACITY');
      const version=Object.keys(metadata).length;
      if(version>=2000&&!Object.prototype.hasOwnProperty.call(metadata,trackId))
        throw error423('423_REVISION_METADATA_CAPACITY');
      const rev={...metadata,[trackId]:{revision,operationId,liked}};
      const next={...prior,likedTrackIds:updated,
        exactLikeCount156:updated.length,likeRevisions423:rev,
        updatedAt:Math.max(1,Math.floor(Number(now())||0))};
      const saved=await r2.put(key,JSON.stringify(next),{
        onlyIf:{etagMatches:obj.etag},
        httpMetadata:{contentType:'application/json; charset=utf-8'},
        customMetadata:{...(obj.customMetadata||{}),
          soridrawSharedLikes:'114',likeRevisionProtocol:'423'},
      });
      if(saved)return {persisted:true,trackId,revision};
    }
    throw error423('423_PRIVATE_R2_CAS_CONTENTION');
  };
}
