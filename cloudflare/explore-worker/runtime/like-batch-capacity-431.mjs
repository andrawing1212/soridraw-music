// SORIDRAW 431 — source-only, dormant pre-D1 batch publication capacity.
// A valid single-item readiness check is insufficient for 2+ likes in a
// batch. Validate the evolving private R2 catalog for every operation BEFORE
// the 171 writer commits any canonical D1 row.
// Never truncate the user's catalog or drop a pending operation.
const fail431 = code => { const error=new Error(code); error.code=code; return error; };
const id431 = value => typeof value==='string' && value.length>0 &&
  value.length<=512 && value.trim()===value;
const MAX431 = 2000;
const own431 = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
export function verifyLikeBatchCatalogCapacity431(catalog,entries){
  if(!catalog || !Array.isArray(catalog.likedTrackIds) ||
     !Array.isArray(entries) || entries.length<1 || entries.length>50)
    throw fail431('431_INVALID_BATCH_OR_PRIVATE_CATALOG');
  const known=new Set(catalog.likedTrackIds);
  if(known.size!==catalog.likedTrackIds.length ||
     known.size>MAX431 || catalog.likedTrackIds.some(id=>!id431(id)))
    throw fail431('431_PRIVATE_MEMBERSHIP_INVALID');
  const metadata=catalog.likeRevisions423 ?? {};
  if(!metadata || typeof metadata!=='object' || Array.isArray(metadata))
    throw fail431('431_PRIVATE_REVISION_METADATA_INVALID');
  const revisions=new Set(Object.keys(metadata));
  if(revisions.size>MAX431)throw fail431('431_REVISION_METADATA_CAPACITY');
  const seen=new Set();
  for(const entry of entries){
    const id=entry?.trackId;
    if(!id431(id) || typeof entry?.liked!=='boolean' || seen.has(id))
      throw fail431('431_INVALID_OR_DUPLICATED_TRACK');
    seen.add(id);
    if(own431(metadata,id)){
      const prior=metadata[id];
      if(!prior || !Number.isSafeInteger(prior.revision) || prior.revision<0 ||
         typeof prior.liked!=='boolean' || typeof prior.operationId!=='string' ||
         prior.operationId.length<1 || prior.operationId.length>128)
        throw fail431('431_PRIVATE_TRACK_REVISION_INVALID');
    }else{
      if(revisions.size>=MAX431)throw fail431('431_REVISION_METADATA_CAPACITY');
      revisions.add(id);
    }
    if(entry.liked)known.add(id);else known.delete(id);
    // The publisher applies each item sequentially; a temporary overflow
    // followed by a later unlike is still unsafe and must be rejected.
    if(known.size>MAX431)throw fail431('431_BATCH_MEMBERSHIP_CAPACITY');
  }
  return {ready:true,projectedLikedCount:known.size,
    projectedRevisionKeys:revisions.size};
}
