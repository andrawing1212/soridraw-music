// SORIDRAW_420_SOURCE_ONLY_EXACT_D1_WRITER_ADAPTER
// NOT WIRED INTO PRODUCT. NOT A DEPLOYMENT GATE BY ITSELF.
// Request contract of app164+/current preview has: trackId, liked, baseLiked,
// mutationAt, operationId, expectedRevision. Older cached apps may lack these.
// Never synthesize a revision/operationId or claim success for legacy payloads.
// No database schema modifications or shared-user-data backfill.
import { createLikeD1OnlyCanonical171 } from './like-d1only-171.mjs';

const owns = (x,k) => Object.prototype.hasOwnProperty.call(x,k);
const validIdentity = (v,n) => typeof v === 'string' && v.length > 0 && v.length <= n && v.trim() === v;
const validRevision = (v) => Number.isSafeInteger(v) && v >= 0;
const validTimestamp = (v) => Number.isSafeInteger(v) && v > 0;
const validOperation = (v) => validIdentity(v,128) && /^[a-zA-Z0-9_-]{1,128}$/.test(v);

const inputError = (code) => Object.assign(new Error(code), { code, status: 409 });

export function createLikeD1OnlyBatchAdapter420(db, {
  allEnvironmentCutoverVerified = false,
  publishChangedTrack = null,
  beforeCanonicalMutation = null,
} = {}) {
  if (allEnvironmentCutoverVerified !== true) {
    throw inputError('420_SHARED_PHASE_NOT_VERIFIED');
  }
  if (typeof publishChangedTrack !== 'function') {
    // A D1-only success without a corresponding public R2+RTDB publication
    // is not an end-to-end settled like and can desynchronize other devices.
    throw inputError('420_PUBLIC_PROJECTION_PUBLISHER_REQUIRED');
  }
  const writer = createLikeD1OnlyCanonical171(db,{cutoverVerified:true});

  return {
    async acceptAuthenticatedBatch(uid,body) {
      if (!validIdentity(uid,256) || !body || typeof body !== 'object' ||
          !Array.isArray(body.mutations) || body.mutations.length < 1 ||
          body.mutations.length > 50) {
        throw inputError('420_INVALID_AUTHENTICATED_BATCH');
      }
      const seen = new Set();
      const entries=body.mutations.map(item=>{
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            !validIdentity(item.trackId,512) || seen.has(item.trackId) ||
            typeof item.liked !== 'boolean' ||
            typeof item.baseLiked !== 'boolean' ||
            !validTimestamp(item.mutationAt)) {
          throw inputError('420_INVALID_MUTATION');
        }
        seen.add(item.trackId);
        // Older clients lacking either field cannot be promoted to the
        // 171 writer by guessing; the server needs an authenticated stable
        // per-click ID AND the user's canonical revision to avoid stale
        // PC/mobile events overwriting newer choices.
        if (!owns(item,'operationId') || !validOperation(item.operationId) ||
            !owns(item,'expectedRevision') || !validRevision(item.expectedRevision)) {
          throw inputError('420_LEGACY_MUTATION_NEEDS_COMPATIBILITY_GATE');
        }
        return {
          trackId:item.trackId,liked:item.liked,baseLiked:item.baseLiked,
          mutationAt:item.mutationAt,operationId:item.operationId,
          expectedRevision:item.expectedRevision,
        };
      });
      // Validate ENTIRE batch before any R2 preflight or D1 write.
      // This optional hook is only for audited, bounded pre-write canonical
      // readiness (e.g. cold new-user R2) and must never write D1.
      if(beforeCanonicalMutation !== null){
        if(typeof beforeCanonicalMutation !== 'function')
          throw inputError('420_INVALID_PREWRITE_HOOK');
        await beforeCanonicalMutation(uid,entries);
      }
      const results=[];
      let physicalRowsWritten=0;
      for(const item of entries) {
        const row=await writer.applyAtomically(uid,item.trackId,item.liked,{
          expectedRevision:item.expectedRevision,
          operationId:item.operationId,
          now:item.mutationAt,
        });
        physicalRowsWritten+=row.rowsWritten;
        const result={
          trackId:item.trackId,liked:row.liked,likeCount:row.likeCount,
          revision:row.revision,generation:row.generation,
          operationId:row.operationId,status:row.status,
        };
        // Publishing must prove monotonically correct R2 card/profile/Feed
        // and same-account changed-track signal *before* success response.
        // If publication fails, the stable operation ID makes D1 retries
        // W0 and must repair the unacknowledged projection. No fake settled
        // response, no deleting client's pending outbox.
        if (row.status==='applied' || row.status==='duplicate' ||
            row.status==='already-desired') {
          const published=await publishChangedTrack({
            uid,trackId:item.trackId,liked:row.liked,
            likeCount:row.likeCount,revision:row.revision,
            generation:row.generation,operationId:row.operationId,
          });
          if (published?.settled !== true || published?.trackId !== item.trackId ||
              published?.generation !== row.generation ||
              published?.personalSnapshotPersisted !== true ||
              published?.publicProjectionPersisted !== true ||
              published?.sameAccountSignalQueued !== true) {
            throw inputError('420_PUBLIC_PROJECTION_NOT_SETTLED_RETRY_SAME_ID');
          }
        }
        results.push(result);
      }
      return {
        ok:true,
        data:{
          queued:false,
          canonicalD1:'settled',
          canonicalProof:'isolated-171-publication-confirmed-420',
          personalLikeSnapshot:'changed-track-r2',
          results,rowsWritten:physicalRowsWritten,
        },
      };
    },
  };
}
