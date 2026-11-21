// APP763: bounded, offline owner-receipt capacity and rollback drill.
// Tests synthesize metadata only; no DO/list()/PITR/Cloudflare API calls.
import assert from 'node:assert/strict';
import {app763RepresentativeReceipt,estimateApp763OwnerCost,
 captureApp763OwnerSnapshot,assessApp763Recovery}
 from './app763-owner-receipt-capacity.mjs';
const sample=app763RepresentativeReceipt();
assert.equal(sample.delivery.status,'delivered');
const five=estimateApp763OwnerCost({owners:100000,eventsPerOwnerPerYear:5});
const fifty=estimateApp763OwnerCost({owners:100000,eventsPerOwnerPerYear:50});
const fiveHundred=estimateApp763OwnerCost({owners:100000,eventsPerOwnerPerYear:500});
assert.equal(five.assumptions.sampleReceiptBytes,
 Buffer.byteLength(JSON.stringify(sample),'utf8'));
assert.equal(five.assumptions.logicalBytesPerReceipt,
 five.assumptions.sampleReceiptBytes+five.assumptions.sampleArchiveKeyBytes+
 five.assumptions.archiveWitnessBytesPerReceipt);
assert.equal(five.totals.totalChanges,500000);
assert.equal(fifty.totals.totalChanges,5000000);
assert.equal(fiveHundred.totals.totalChanges,50000000);
assert(five.totals.storedGB<fifty.totals.storedGB);
assert(fifty.totals.storedGB<fiveHundred.totals.storedGB);
assert.equal(five.freeSQLiteStorageLimitExceeded,false);
assert.equal(fifty.freeSQLiteStorageLimitExceeded,true);
assert.equal(fiveHundred.freeDailyRequestLimitExceeded,true);
assert.equal(fiveHundred.freeDailyWrittenRowsLimitExceeded,true);
assert.equal(fiveHundred.freeSQLiteStorageLimitExceeded,true);
assert.equal(fifty.physicalStorageMeasured,false);
assert.equal(fifty.liveBillingConfirmed,false);
assert.equal(fifty.productionDeployAuthorized,false);
const tenYears=estimateApp763OwnerCost({
 owners:100000,eventsPerOwnerPerYear:50,months:120});
assert.equal(tenYears.totals.totalChanges,50000000);
assert.equal(tenYears.totals.requestsPerMonth,
 fifty.totals.requestsPerMonth);
assert(tenYears.totals.storedGB>fifty.totals.storedGB);
const heavy=estimateApp763OwnerCost({
 owners:1,eventsPerOwnerPerYear:10000000,months:120});
assert.equal(heavy.estimatedPerOwner10GBLimitExceeded,true);
assert.throws(()=>estimateApp763OwnerCost({
 owners:100000,eventsPerOwnerPerYear:-1}),/APP763_INVALID/);
assert.throws(()=>estimateApp763OwnerCost({
 owners:100000,eventsPerOwnerPerYear:Infinity}),/APP763_INVALID/);
assert.throws(()=>estimateApp763OwnerCost({
 owners:1.5,eventsPerOwnerPerYear:50}),/APP763_REQUIRES_INTEGER_COUNTS/);
assert(estimateApp763OwnerCost({
 owners:100000,eventsPerOwnerPerYear:5,storageOverheadMultiplier:6
}).totals.storedGB>five.totals.storedGB);
assert(Object.keys(five.paidSQLiteOverageUSD).every(k=>k.endsWith('USD')));
assert(!Object.hasOwn(five,'productionEnabled'));
// Restore check: pin owner storage identity and EVERY immutable receipt before
// any simulated point-in-time rollback. Omit one key, alter owner or server
// ID, or revert the hot state -> HOLD. A byte match is offline-only.
const owner='ownerSyntheticApp763';
const hot='app755-owner-follow-pending-v1';
const finalPrefix='app762-owner-follow-final-';
const receipt=id=>({...sample,actorUid:'actorSyntheticApp763',
 ownerUid:owner,canonicalOperationId:'canonical_synthetic_app763_'+id,
 operationId:'server_synthetic_app763_'+id,
 delivery:{status:'delivered',attempts:0}});
const archived=[receipt('00001'),receipt('00002'),receipt('00003')];
const hotReceipt=receipt('00004');
hotReceipt.delivery={status:'pending',attempts:1,retryAt:1800000000000};
const entries=[
 [hot,{version:1,ownerUid:owner,archiveUsed:true,entries:[hotReceipt]}],
 ...archived.map(x=>[finalPrefix+x.canonicalOperationId,x]),
];
const clone=v=>structuredClone(v);
const before=captureApp763OwnerSnapshot({ownerUid:owner,entries:clone(entries)});
const after=captureApp763OwnerSnapshot({ownerUid:owner,entries:clone(entries)});
assert.equal(before.fingerprintSha256,after.fingerprintSha256);
assert.equal(before.archivedCount,3);
assert.equal(before.receiptCount,4);
assert.deepEqual(assessApp763Recovery({before,after}),{
 status:'OFFLINE_STORAGE_MATCH_ONLY',
 reason:'EXTERNAL_D1_R2_AUTH_EPOCH_AND_FUNCTIONS_PARITY_NOT_VERIFIED',
 productionDeployAuthorized:false,
});
assert.equal(assessApp763Recovery({before}).status,'HOLD');
// If one earlier completed reservation disappears in restore, DO may mistake
// it for authoritative absence. This detector must fail closed before any
// cutover; actual independent canonical replay check still required.
const missing=captureApp763OwnerSnapshot({
 ownerUid:owner,entries:clone(entries.slice(0,-1))});
assert.equal(assessApp763Recovery({before,after:missing}).status,'HOLD');
assert.equal(assessApp763Recovery({before,after:missing}).reason,
 'OWNER_STORAGE_SNAPSHOT_CHANGED_OR_LOST');
const older=clone(entries);
older[0][1].entries[0].delivery.status='delivered';
delete older[0][1].entries[0].delivery.retryAt;
const outdated=captureApp763OwnerSnapshot({ownerUid:owner,entries:older});
assert.equal(assessApp763Recovery({before,after:outdated}).status,'HOLD');
const forged=clone(entries);
forged[1][1].operationId='forged_server_id';
const corrupted=captureApp763OwnerSnapshot({ownerUid:owner,entries:forged});
assert.equal(assessApp763Recovery({before,after:corrupted}).status,'HOLD');
const wrongOwner=clone(entries);
wrongOwner[2][1].ownerUid='anotherOwner';
assert.throws(()=>captureApp763OwnerSnapshot({ownerUid:owner,entries:wrongOwner}),
 /APP763_ARCHIVE_OWNER_STATE_OR_ID_UNVERIFIED/);
const duplicate=clone(entries);
duplicate.push([finalPrefix+archived[0].canonicalOperationId,
 clone(archived[0])]);
assert.throws(()=>captureApp763OwnerSnapshot({ownerUid:owner,entries:duplicate}),
 /APP763_ARCHIVE_OWNER_STATE_OR_ID_UNVERIFIED/);
const fakeHot=clone(entries);
fakeHot[0][1].entries.push({...fakeHot[0][1].entries[0]});
assert.throws(()=>captureApp763OwnerSnapshot({ownerUid:owner,entries:fakeHot}),
 /APP763_RECEIPT_ID_COLLISION/);
assert.throws(()=>captureApp763OwnerSnapshot({ownerUid:owner,entries:[
 [hot,{version:1,ownerUid:owner,archiveUsed:true,entries:[]}],
 ['unexpected_cleanup_marker',{ok:true}],
]}),/APP763_UNKNOWN_STORAGE_KEY/);
console.log('APP763_100K_OWNER_5_50_500_EVENTS_YR_SCENARIOS=PASS');
console.log('APP763_SQLITE_STORAGE_ROWS_ALARM_DO_REQUESTS_BILLING_MODEL_OFFLINE=PASS');
console.log('APP763_MISSING_TOMBSTONE_STALE_HOT_OWNER_CORRUPTION_RESTORE_HOLD=PASS');
console.log('APP763_PRODUCTION_ACTIVE_STORAGE_METRICS_AND_BACKEND=UNVERIFIED_HOLD');
console.log('APP763_SHARED_DATA_READS_WRITES=0; SERVER_DEPLOY=0');
