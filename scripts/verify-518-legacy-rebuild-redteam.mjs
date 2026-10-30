// Inactive policy/red-team tests — no real Worker import, R2, Firebase or data.
import assert from 'node:assert/strict';
import {
  classifyCatalogAuthority518,decideCatalogWriterAuthority518,
  requiresFinalFencedCas518
} from '../cloudflare/media-worker/src/catalogAuthorityPolicy518.js';
const head={kind:'musicNote',headRevision:250,sourceLedger518:{
 'track-deleted':{uid:'owner',documentId:'track-deleted',durable:true,
   state:'removed',sourceVersionNs:'1793152800000000000'}},canonicalAuthority518:true};
const gate=(operation,h=head,extra={})=>decideCatalogWriterAuthority518({
 kind:'musicNote',head:h,operation,...extra
});
assert.equal(classifyCatalogAuthority518(head,'musicNote').code,'CANONICAL_FENCED');
for (const operation of ['legacy-delta','bootstrap','seed-legacy','rebuild']) {
 const decision=gate(operation);
 assert.ok(decision.code.startsWith('DENY_'),operation+' must never erase/override tombstones');
 assert.equal(requiresFinalFencedCas518(decision),false);
}
assert.equal(gate('canonical-delta',head,{hasServerVerifiedExactCanonical:true,
 baseRevision:249,expectedHeadRevision:249}).code,'DENY_STALE_HEAD');
assert.equal(gate('canonical-delta',head,{hasServerVerifiedExactCanonical:false,
 baseRevision:250,expectedHeadRevision:250}).code,'DENY_UNVERIFIED_WRITER');
const ok=gate('canonical-delta',head,{hasServerVerifiedExactCanonical:true,
 baseRevision:250,expectedHeadRevision:250});
assert.equal(ok.code,'CANONICAL_CAS_ONLY');
assert.equal(requiresFinalFencedCas518(ok),true);
assert.equal(gate('legacy-delta',{...head,sourceLedger518:undefined}).code,'DENY_DAMAGED_LEDGER');
assert.equal(gate('legacy-delta',{...head,canonicalAuthority518:false}).code,'DENY_PARTIAL_MIGRATION');
assert.equal(gate('rebuild',{...head,sourceLedger518:undefined}).code,'DENY_DAMAGED_LEDGER');
const unprotected={kind:'musicNote',headRevision:250};
assert.equal(gate('legacy-delta',unprotected).code,'LEGACY_ALLOWED_WHILE_NOT_MIGRATED');
assert.equal(gate('bootstrap',unprotected).code,'LEGACY_ALLOWED_WHILE_NOT_MIGRATED');
assert.equal(gate('legacy-delta',{...head,kind:'library'}).code,'DENY_UNKNOWN_HEAD');
console.log('APP518_ALL_FENCED_LEGACY_DELTA_DENIED=PASS');
console.log('APP518_SEED_REBUILD_TOMBSTONE_ERASURE_DENIED=PASS');
console.log('APP518_CAS_SOURCE_AND_HEAD_REVISION_REQUIRED=PASS');
console.log('APP518_UNMIGRATED_EXISTING_CATALOG_UNMODIFIED=PASS');
console.log('APP518_INACTIVE_POLICY_NETWORK_IO=ZERO');
