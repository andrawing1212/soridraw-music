// app518 safety policy, inactive until a separately audited shared deployment.
// This does not add an endpoint or modify the current media worker.
// Every writer/rebuild/seed path must call the same policy at the same R2 HEAD
// ETag used for its conditional PUT. Checking on a prior GET is insufficient.
const text=x=>typeof x==='string'?x.trim():'';
const OWN=Object.prototype.hasOwnProperty;
export const classifyCatalogAuthority518=(head,kind)=>{
  if(!head||head.kind!==kind) return {code:'DENY_UNKNOWN_HEAD'};
  const fenced=OWN.call(head,'sourceLedger518')||head.canonicalAuthority518===true;
  if(!fenced) return {code:'LEGACY_UNFENCED'};
  // Never infer safe fallback when the ledger is damaged or truncated.
  const ledger=head.sourceLedger518;
  if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))
    return {code:'DENY_DAMAGED_LEDGER'};
  if(head.canonicalAuthority518!==true) return {code:'DENY_PARTIAL_MIGRATION'};
  return {code:'CANONICAL_FENCED',ledger};
};
export const decideCatalogWriterAuthority518=({
  kind,head,operation,hasServerVerifiedExactCanonical=false,
  baseRevision,expectedHeadRevision,
}={})=>{
  const classification=classifyCatalogAuthority518(head,kind);
  if(classification.code.startsWith('DENY_')) return classification;
  const fenced=classification.code==='CANONICAL_FENCED';
  if(!fenced) return {code:'LEGACY_ALLOWED_WHILE_NOT_MIGRATED'};
  if(operation==='legacy-delta'){
    // Existing clients must NOT be told they committed the catalog. Server
    // canonical settlement needs to own the write; current code cannot do that.
    return {code:'DENY_LEGACY_DELTA_REQUIRES_CANONICAL'};
  }
  if(operation==='bootstrap'||operation==='seed-legacy'||operation==='rebuild'){
    // A newer Firestore canonical snapshot plus an unchanged HEAD ledger is not
    // an atomic proof of all per-song tombstones; block until safe reconciliation.
    return {code:'DENY_REBUILD_REQUIRES_LEDGER_RECONCILIATION'};
  }
  if(operation!=='canonical-delta'||!hasServerVerifiedExactCanonical){
    return {code:'DENY_UNVERIFIED_WRITER'};
  }
  if(!Number.isSafeInteger(baseRevision)||!Number.isSafeInteger(expectedHeadRevision)
    ||baseRevision!==expectedHeadRevision||baseRevision!==head.headRevision) {
    return {code:'DENY_STALE_HEAD'};
  }
  return {code:'CANONICAL_CAS_ONLY'};
};
// Calling this on a read without the last-moment CAS check is forbidden.
export const requiresFinalFencedCas518=(plan)=>plan?.code==='CANONICAL_CAS_ONLY';
