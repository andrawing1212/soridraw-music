// Isolated integration QA against REAL Firestore + RTDB emulators.
// Never touches an authenticated user account, any live Firebase project,
// actual canonical likes, shared D1/R2, or a deployed Cloud Function.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const projectId = 'demo-soridraw-stage420-rules';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080',
  'Firestore emulator must be running; refuse any live database fallback');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000',
  'RTDB emulator must be running; refuse any live database fallback');
assert.equal(process.env.GCLOUD_PROJECT || projectId, projectId,
  'never run against any real project ID');
const requireFunctions = createRequire(new URL('../functions/package.json',import.meta.url));
const admin = requireFunctions('firebase-admin');
const {
  approveLikeWithAtomicLedgerCandidate420: approve,
  recoverExactAtomicLikeApprovalCandidate420: recoverExact,
  handleApprovedLikeReceiptWakeupCandidate420: deliver,
  recoverHeldLikeDeliveryAfterMasterAuthCandidate420: recoverHeld,
} = requireFunctions('./lib/exploreLikeAtomicLedgerCandidate420.js');
admin.initializeApp({
  projectId,
  databaseURL: 'https://' + projectId + '-default-rtdb.firebaseio.com',
});
const firestore = admin.firestore();
const realtime = admin.database();
const uid = 'uid-atomic-emulator';
const account = firestore.collection('privateLikeGuardV2_420').doc(uid);
const display = realtime.ref('privateLikeSync420/' + uid + '/displayV2');

const now = Date.now();
const make = (id, at = now) => {
  const hex = at.toString(16).padStart(12,'0');
  return {
    trackId:'track-'+id,
    ownerUid:'artist-1',
    liked:id%2===1,
    operationId: hex.slice(0,8)+'-'+hex.slice(8)+'-7abc-8abc-'+id.toString(16).padStart(12,'0'),
  };
};
const receipt = async (op) => {
  const value=await account.collection('approvals').doc(op.operationId).get();
  assert.equal(value.exists,true);
  return value.data();
};
try {
  const one = make(1);
  const first = await approve(firestore,uid,one,now);
  assert.equal(first.allowed,true);
  assert.equal(first.duplicate,false);
  assert.equal(first.version,1);
  const savedOne = await receipt(one);
  const firstDelivery = await deliver(firestore,realtime,uid,one.operationId,savedOne,now+5);
  assert.equal(firstDelivery.status,'delivered');
  assert.equal((await display.get()).val().version,1);
  const repeated = await approve(firestore,uid,one,now+10);
  assert.equal(repeated.allowed,true);
  assert.equal(repeated.duplicate,true);
  assert.equal(repeated.version,1);
  const repeatedDelivery = await deliver(firestore,realtime,uid,one.operationId,savedOne,now+20);
  assert.equal(repeatedDelivery.status,'already-delivered');
  assert.equal((await display.get()).val().version,1);
  assert.equal((await account.get()).data().version,1);
  // Server lost its initial callable response after Firestore transaction:
  // recover exactly one existing receipt without any second quota charge.
  assert.equal(await recoverExact(firestore,uid,one,now+30),true);
  assert.equal(await recoverExact(firestore,uid,{...one,liked:!one.liked},now+30),false);
  assert.equal(await recoverExact(firestore,'other-uid',one,now+30),false);
  const missing=make(99,now+31);
  assert.equal(await recoverExact(firestore,uid,missing,now+31),false);
  assert.equal((await account.get()).data().version,1,
    'read-only recovery cannot approve, unlock or spend quota');
  console.log('STAGE420_REAL_EMULATOR_FIRST_ACK_LOSS_EXACT_RECOVERY_R1_W0=PASS');
  console.log('STAGE420_REAL_EMULATOR_ATOMIC_FIRST_APPROVAL_EXACT_REPLAY_W0=PASS');

  const two=make(2,now+1), three=make(3,now+2);
  assert.equal((await approve(firestore,uid,two,now+1)).version,2);
  assert.equal((await approve(firestore,uid,three,now+2)).version,3);
  const savedTwo=await receipt(two), savedThree=await receipt(three);
  // Deliver Eventarc receipt v3 BEFORE v2. The exact indexed gap query
  // must restore v2 without resubmitting either click to the rate limiter.
  const recoveredGap=await deliver(firestore,realtime,uid,three.operationId,savedThree,now+30);
  assert.equal(recoveredGap.status,'delivered');
  const settled=(await display.get()).val();
  assert.equal(settled.version,3);
  assert.deepEqual(settled.results.map(row=>row.version),[1,2,3]);
  assert.deepEqual(settled.results.map(row=>row.operationId),[
    one.operationId,two.operationId,three.operationId,
  ]);
  assert.equal((await account.get()).data().version,3);
  const lateSecond=await deliver(firestore,realtime,uid,two.operationId,savedTwo,now+40);
  assert.equal(lateSecond.status,'already-delivered');
  assert.equal((await display.get()).val().version,3);
  console.log('STAGE420_REAL_EMULATOR_OUT_OF_ORDER_VERSION_GAP_REPAIRED=PASS');

  // Normal version 4 is NOT an out-of-order gap: its Eventarc source snapshot
  // must reach RTDB without performing an extra indexed Firestore approval
  // query. Throw if the normal-path handler touches Firestore at all.
  const four=make(4,now+3);
  const fourthApproval=await approve(firestore,uid,four,now+3);
  assert.equal(fourthApproval.version,4);
  const savedFour=await receipt(four);
  const noExtraFirestoreRead={collection:()=>{
    throw new Error('NORMAL_EVENT_MUST_NOT_READ_FIRESTORE_AGAIN');
  }};
  const fourthDelivery=await deliver(noExtraFirestoreRead,realtime,uid,
    four.operationId,savedFour,now+45);
  assert.equal(fourthDelivery.status,'delivered');
  assert.equal(fourthDelivery.delivered,1);
  assert.equal((await display.get()).val().version,4);
  console.log('STAGE420_REAL_EMULATOR_NORMAL_SOURCE_EVENT_FS_R0=PASS');

  // The REAL Firestore transaction and REAL RTDB delivery are also reused
  // for exact Master HOLD repair; no new like receipt is granted.
  const hold=account.collection('deliveryFailures').doc(three.operationId);
  await hold.create({
    uid, operationId:three.operationId,
    approvalVersion:savedThree.version, approvedAtMs:savedThree.approvedAtMs,
    state:'needs-manual-reconciliation',heldAtMs:now+50,
  });
  const firstRepair=await recoverHeld(firestore,realtime,'master-sandbox',uid,
    three.operationId,'integration-test',now+60);
  assert.equal(firstRepair.recovered,true);
  assert.equal(firstRepair.duplicate,false);
  assert.equal(firstRepair.delivered,0,'already delivered event must never reemit');
  const secondRepair=await recoverHeld(firestore,realtime,'master-sandbox',uid,
    three.operationId,'integration-test',now+70);
  assert.equal(secondRepair.recovered,false);
  assert.equal(secondRepair.duplicate,true);
  assert.equal((await account.get()).data().version,4);
  assert.equal((await display.get()).val().version,4);
  assert.equal((await hold.get()).data().state,'recovered');
  console.log('STAGE420_REAL_EMULATOR_MASTER_HOLD_EXACT_REPAIR_IDEMPOTENT=PASS');

  // Legacy v4 after migration must remain unapproved, with no missing
  // receipt silently rewritten as a newly approved click.
  await assert.rejects(approve(firestore,uid,{
    ...make(4),operationId:'2e2db23f-56aa-4f91-82b2-13e3d2c62c00',
  },now+90),/420_LEGACY_PROOF_MISSING_FAIL_CLOSED/);
  assert.equal((await account.get()).data().version,4);
  console.log('STAGE420_REAL_EMULATOR_LEGACY_UNPROVEN_V4_FAIL_CLOSED=PASS');

  console.log('STAGE420_EMULATOR_REAL_DB_OPERATIONS_NOT_LIVE_BILLING=PASS');
} finally {
  await Promise.allSettled([
    firestore.terminate(),
    realtime.goOffline(),
  ]);
  await admin.app().delete();
}
