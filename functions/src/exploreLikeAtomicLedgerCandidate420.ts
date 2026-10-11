// Stage420 source-only alternative: per-operation Firestore receipts and one
// constant-size rate document. This candidate is deliberately NOT wired into
// a Callable or used by any deployed app; RTDB provisional delivery and
// Master unlock parity must be solved before a coordinated cutover.
import type { Firestore } from 'firebase-admin/firestore';
import type { Database, DataSnapshot } from 'firebase-admin/database';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { createHash } from 'node:crypto';
import { DEFAULT_LIKE_ABUSE_SETTINGS_420, type LikeAbuseSettings420 } from './exploreLikeAbuseSettings420';

export const LIKE_LEDGER420_MAX_FIRST_SEND_AGE_MS = 7 * 24 * 60 * 60_000;
export const LIKE_LEDGER420_MAX_REPLAY_AGE_MS = 30 * 24 * 60 * 60_000;
export const LIKE_LEDGER420_TTL_DELETE_AFTER_MS = 31 * 24 * 60 * 60_000;
const CLOCK_SKEW_MS = 5 * 60_000;
const MINUTE = 60_000;
const validAccount = (uid: string): boolean =>
  typeof uid === 'string' && uid.length > 0 && uid.length <= 128 &&
  !/[/.#$\\[\\]]/.test(uid);
const UUID_V7 = /^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Existing app396 pending operations use crypto.randomUUID() (UUID v4).
// v4 has no immutable creation timestamp. A NEW v4 approval cannot be proven
// safe after receipt expiry; only exact, server-existing approval may replay.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Unlike a v4 operationId, the original click time is immutable in this ID.
// It lets the server fail closed after TTL has safely removed a receipt.
// Do not convert old v4 pending operations without a canonical reconciliation.
export const readLikeOperationTime420 = (operationId: string): number | null => {
  if (typeof operationId !== 'string') return null;
  const match = UUID_V7.exec(operationId);
  if (!match) return null;
  const timestamp = Number.parseInt(match[1] + match[2], 16);
  return Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null;
};

export type AtomicLikeCommand420 = {
  trackId: string;
  ownerUid: string;
  liked: boolean;
  operationId: string;
};
export type AtomicLikeDecision420 = {
  allowed: boolean;
  duplicate: boolean;
  warning: boolean;
  lockedUntilMs: number;
  remainingInWindow: number;
  version: number;
};
type RateState = {
  windowStartMs: number;
  acceptedInWindow: number;
  previousWindowStartMs: number;
  previousWindowReachedLimit: boolean;
  lockedUntilMs: number;
  limitPerMinute: number;
  version: number;
};
const normalize = (raw: unknown): RateState => {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Partial<RateState> : {};
  const n = (v: unknown): number =>
    Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0;
  return {
    windowStartMs: n(data.windowStartMs),
    acceptedInWindow: n(data.acceptedInWindow),
    previousWindowStartMs: n(data.previousWindowStartMs),
    previousWindowReachedLimit: data.previousWindowReachedLimit === true,
    lockedUntilMs: n(data.lockedUntilMs),
    limitPerMinute: n(data.limitPerMinute),
    version: n(data.version),
  };
};
const fingerprint = (uid: string, op: AtomicLikeCommand420): string =>
  createHash('sha256')
    .update(JSON.stringify([uid, op.trackId, op.ownerUid, op.liked, op.operationId]))
    .digest('base64url');
const denied = (rate: RateState, limit: number): AtomicLikeDecision420 => ({
  allowed: false, duplicate: false, warning: true,
  lockedUntilMs: rate.lockedUntilMs,
  remainingInWindow: Math.max(0, limit - rate.acceptedInWindow),
  version: rate.version,
});

// Read-only recovery of EXACT prior Firestore approval when the first
// callable ACK was lost. Never rerun approveLikeWithAtomicLedger here:
// missing receipts must not become a NEW charge or signed click. A different
// action reusing an operationId must never mint a permit either.
export const recoverExactAtomicLikeApprovalCandidate420 = async (
  db: Firestore,
  uid: string,
  op: AtomicLikeCommand420,
  nowMs = Date.now(),
): Promise<boolean> => {
  if (!validAccount(uid) || !op || typeof op.trackId !== 'string' ||
      !op.trackId || op.trackId.length > 512 ||
      typeof op.ownerUid !== 'string' || op.ownerUid.length > 128 ||
      typeof op.liked !== 'boolean' ||
      typeof op.operationId !== 'string' ||
      (!UUID_V7.test(op.operationId) && !UUID_V4.test(op.operationId)) ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error('420_ATOMIC_EXACT_RECOVERY_INVALID');
  }
  const record = await db.collection('privateLikeGuardV2_420').doc(uid)
    .collection('approvals').doc(op.operationId).get();
  if (!record.exists) return false;
  const proof = record.data();
  const issuedAt = Number(proof?.approvedAtMs || 0);
  const originMs = readLikeOperationTime420(op.operationId);
  return proof?.status === 'approved' &&
    proof?.operationId === op.operationId &&
    proof?.trackId === op.trackId &&
    proof?.ownerUid === op.ownerUid &&
    proof?.liked === op.liked &&
    proof?.digest === fingerprint(uid, op) &&
    Number.isSafeInteger(proof?.version) && proof.version >= 1 &&
    Number.isSafeInteger(issuedAt) && issuedAt > 0 &&
    issuedAt <= nowMs + CLOCK_SKEW_MS &&
    nowMs - issuedAt < LIKE_LEDGER420_MAX_REPLAY_AGE_MS &&
    (originMs === null || (originMs <= issuedAt + CLOCK_SKEW_MS &&
      issuedAt - originMs <= LIKE_LEDGER420_MAX_FIRST_SEND_AGE_MS));
};

// Candidate-only delivery projection, NOT attached to RTDB or any Callable.
// Firestore is the approval authority; the RTDB display is only a bounded
// ordered signal. A missing predecessor MUST NOT be silently skipped.
// A server-owned RTDB transaction must run this planner inside its callback.
// The future integration needs durable retries for missing predecessors and
// separate Master unlock parity; this pure planner alone is not a cutover.
export type AtomicLikeDisplayEvent420 = AtomicLikeCommand420 & {
  version: number;
  at: number;
  status: 'pending';
};
export type AtomicLikeDisplayState420 = {
  version: number;
  results: AtomicLikeDisplayEvent420[];
};
export type AtomicLikeDisplayOutcome420 =
  | { status: 'emit'; next: AtomicLikeDisplayState420 }
  | { status: 'already-delivered' | 'waiting-prior' | 'invalid'; next?: never };

export const planAtomicLikeDisplayDeliveryCandidate420 = (
  uid: string,
  op: AtomicLikeCommand420,
  rawApproval: unknown,
  rawDisplay: unknown,
  nowMs = Date.now(),
): AtomicLikeDisplayOutcome420 => {
  if (!validAccount(uid) || !op || typeof op.trackId !== 'string' ||
      !op.trackId || op.trackId.length > 512 ||
      typeof op.ownerUid !== 'string' || op.ownerUid.length > 128 ||
      typeof op.liked !== 'boolean' || typeof op.operationId !== 'string' ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) return { status: 'invalid' };
  const proof = rawApproval && typeof rawApproval === 'object' &&
    !Array.isArray(rawApproval)
    ? rawApproval as Record<string, unknown> : {};
  const receiptVersion = proof.version;
  const approvedAtMs = proof.approvedAtMs;
  // The caller must obtain proof directly from the authenticated UID's
  // Firestore receipt document, never from an untrusted client payload.
  if (proof.status !== 'approved' || proof.digest !== fingerprint(uid, op) ||
      !Number.isSafeInteger(receiptVersion) || Number(receiptVersion) < 1 ||
      !Number.isSafeInteger(approvedAtMs) || Number(approvedAtMs) <= 0 ||
      Number(approvedAtMs) > nowMs + CLOCK_SKEW_MS ||
      nowMs - Number(approvedAtMs) >= LIKE_LEDGER420_MAX_REPLAY_AGE_MS) {
    return { status: 'invalid' };
  }
  // This state must live at a NEW displayV2 subtree. It MUST start at 0
  // before the first Firestore receipt version=1; don't reuse legacy display.
  const existing = rawDisplay === null || rawDisplay === undefined
    ? { version: 0, results: [] as AtomicLikeDisplayEvent420[] }
    : rawDisplay && typeof rawDisplay === 'object' && !Array.isArray(rawDisplay)
      ? rawDisplay as Partial<AtomicLikeDisplayState420>
      : null;
  if (!existing || !Number.isSafeInteger(existing.version) ||
      Number(existing.version) < 0 || !Array.isArray(existing.results) ||
      existing.results.length > 50) return { status: 'invalid' };
  const previousVersion = Number(existing.version);
  if (Number(receiptVersion) <= previousVersion) {
    // Correct ONLY if all previous versions were applied sequentially under
    // this RTDB transaction. No manual seed, jump, or foreign writers allowed.
    return { status: 'already-delivered' };
  }
  if (Number(receiptVersion) !== previousVersion + 1) {
    // Different tracks can be in-flight concurrently. Skipping a version
    // could lose a valid earlier track's like signal forever.
    return { status: 'waiting-prior' };
  }
  const prior = existing.results as AtomicLikeDisplayEvent420[];
  return {
    status: 'emit',
    next: {
      version: Number(receiptVersion),
      results: [...prior.slice(-49), {
        ...op, version: Number(receiptVersion),
        // Listener freshness tracks server DELIVERY time, not old approval
        // time; a delayed retry must not look expired upon its first emit.
        at: nowMs, status: 'pending',
      }],
    },
  };
};

// Stage420 source-only gap recovery. This is deliberately NOT exported as
// a deployed Cloud Function trigger. A future Firestore receipt-create event
// can invoke this after approval has COMMITTED, even if the original Callable
// dies before talking to RTDB. Events can arrive in any order.
export type AtomicLikeGapRecovery420 = {
  complete: boolean;
  delivered: number;
  lastVersion: number;
  reason: 'delivered' | 'missing-proof' | 'invalid-proof' | 'needs-retry';
};
export const recoverAtomicLikeDisplayGapCandidate420 = async (
  firestore: Firestore,
  realtime: Database,
  uid: string,
  throughVersion: number,
  nowMs = Date.now(),
  maxPerAttempt = 16,
): Promise<AtomicLikeGapRecovery420> => {
  if (!validAccount(uid) || !Number.isSafeInteger(throughVersion) ||
      throughVersion <= 0 || !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !Number.isSafeInteger(maxPerAttempt) || maxPerAttempt < 1 ||
      maxPerAttempt > 32) throw new Error('420_DISPLAY_RECOVERY_INVALID');
  const displayRef = realtime.ref(`privateLikeSync420/${uid}/displayV2`);
  // CRITICAL: Admin RTDB transactions may invoke the updater with local
  // null BEFORE fetching the remote tree. If the known prior version is
  // nonzero, returning undefined aborts the transaction without fetching it.
  // Prime the local transaction cache via the value listener (not get()).
  // This one bounded account-scoped read is only for an actual delivery gap.
  // Keep the small UID-scoped listener LIVE for the gap transaction.
  // Firebase Admin's RTDB SDK can otherwise call a transaction updater
  // with uncached null and silently abort when receipt.version > 1.
  // Detach in every exit path; this listener is never used on page entry.
  let onSnapshot: (snapshot: DataSnapshot) => void = () => {};
  const firstSnapshot = new Promise<DataSnapshot>((resolve, reject) => {
    onSnapshot = resolve;
    displayRef.on('value', onSnapshot, reject);
  });
  try {
    const initial = await firstSnapshot;
    const currentVersion = Number(initial.val()?.version || 0);
    if (!Number.isSafeInteger(currentVersion) || currentVersion < 0) {
      throw new Error('420_DISPLAY_RECOVERY_CORRUPT_VERSION');
    }
    if (currentVersion >= throughVersion) {
      return { complete: true, delivered: 0, lastVersion: currentVersion,
        reason: 'delivered' };
    }
    let delivered = 0;
    let lastVersion = currentVersion;
    for (let attempt = 0; attempt < maxPerAttempt && lastVersion < throughVersion; attempt++) {
      const missingVersion = lastVersion + 1;
      // Indexed equality query within ONE UID's receipt subcollection. One
      // missing version at a time; no scans of users, tracks, or full catalogs.
      const query = await firestore.collection('privateLikeGuardV2_420')
        .doc(uid).collection('approvals')
        .where('version', '==', missingVersion).limit(1).get();
      if (query.empty || query.docs.length !== 1) {
        return { complete: false, delivered, lastVersion, reason: 'missing-proof' };
      }
      const proofDoc = query.docs[0];
      const proof = proofDoc.data();
      const command: AtomicLikeCommand420 = {
        trackId: proof.trackId, ownerUid: proof.ownerUid, liked: proof.liked,
        operationId: proof.operationId,
      };
      if (proofDoc.id !== command.operationId ||
          planAtomicLikeDisplayDeliveryCandidate420(
            uid, command, proof, { version: missingVersion - 1, results: [] },
            nowMs,
          ).status !== 'emit') {
        return { complete: false, delivered, lastVersion, reason: 'invalid-proof' };
      }
      // A separate RTDB transaction serializes racing triggers. A competing
      // event may already have delivered this version by the time we write.
      let transactionPlan: AtomicLikeDisplayOutcome420 = { status: 'invalid' };
      const transaction = await displayRef.transaction((previous: unknown) => {
        transactionPlan = planAtomicLikeDisplayDeliveryCandidate420(
          uid, command, proof, previous, nowMs,
        );
        return transactionPlan.status === 'emit' ? transactionPlan.next : undefined;
      }, undefined, false);
      const actualVersion = Number(transaction.snapshot.val()?.version || 0);
      if (!Number.isSafeInteger(actualVersion) || actualVersion < lastVersion) {
        throw new Error('420_DISPLAY_RECOVERY_TRANSACTION_INVALID');
      }
      lastVersion = actualVersion;
      if (transaction.committed) delivered++;
      if (!transaction.committed && actualVersion < missingVersion) {
        return { complete: false, delivered, lastVersion, reason: 'needs-retry' };
      }
    }
    return { complete: lastVersion >= throughVersion, delivered, lastVersion,
      reason: lastVersion >= throughVersion ? 'delivered' : 'needs-retry' };
  } finally {
    displayRef.off('value', onSnapshot);
  }
};


// Candidate only: Eventarc Firestore onCreate can call this with a trusted
// receipt snapshot AFTER Firestore has committed. It is intentionally not
// wired to functions/src/index.ts or deployed.
export type AtomicLikeWakeupResult420 =
  | { status: 'delivered' | 'already-delivered'; delivered: number }
  | { status: 'retry-required'; reason: string; delivered: number };
export const handleApprovedLikeReceiptWakeupCandidate420 = async (
  firestore: Firestore,
  realtime: Database,
  uid: string,
  receiptId: string,
  rawReceipt: unknown,
  nowMs = Date.now(),
): Promise<AtomicLikeWakeupResult420> => {
  if (!validAccount(uid) || typeof receiptId !== 'string' ||
      receiptId.length > 128) throw new Error('420_RECEIPT_WAKEUP_INVALID');
  const proof = rawReceipt && typeof rawReceipt === 'object' &&
    !Array.isArray(rawReceipt) ? rawReceipt as Record<string, unknown> : {};
  const op: AtomicLikeCommand420 = {
    trackId: proof.trackId as string,
    ownerUid: proof.ownerUid as string,
    liked: proof.liked as boolean,
    operationId: proof.operationId as string,
  };
  if (op.operationId !== receiptId ||
      planAtomicLikeDisplayDeliveryCandidate420(
        uid, op, proof, { version: Number(proof.version) - 1, results: [] },
        nowMs,
      ).status !== 'emit') {
    throw new Error('420_RECEIPT_WAKEUP_PROOF_INVALID');
  }
  // Fast path: the event already contains the original server-owned proof,
  // so there is no additional Firestore query per normal delivery.
  const display = realtime.ref('privateLikeSync420/' + uid + '/displayV2');
  // Real Admin RTDB may call a cold transaction updater with local null,
  // causing a false waiting-prior and an unnecessary indexed Firestore read
  // on EVERY normal approval after version 1. A short live listener primes
  // the exact UID display cache; it is always detached after the transaction.
  let onSnapshot: (snapshot: DataSnapshot) => void = () => {};
  const ready = new Promise<DataSnapshot>((resolve, reject) => {
    onSnapshot = resolve;
    display.on('value', onSnapshot, reject);
  });
  const outcome = await (async () => {
    try {
      await ready;
      return await display.transaction((raw: unknown) => {
        const planned = planAtomicLikeDisplayDeliveryCandidate420(
          uid, op, proof, raw, nowMs,
        );
        return planned.status === 'emit' ? planned.next : undefined;
      }, undefined, false);
    } finally {
      display.off('value', onSnapshot);
    }
  })();
  const currentVersion = Number(outcome.snapshot.val()?.version || 0);
  if (outcome.committed) return { status: 'delivered', delivered: 1 };
  if (Number.isSafeInteger(currentVersion) &&
      currentVersion >= Number(proof.version)) {
    return { status: 'already-delivered', delivered: 0 };
  }
  // Out-of-order onCreate event: use only the exact missing versions under
  // this UID, and never repeat the approval transaction.
  const gap = await recoverAtomicLikeDisplayGapCandidate420(
    firestore, realtime, uid, Number(proof.version), nowMs, 16,
  );
  return gap.complete
    ? { status: gap.delivered > 0 ? 'delivered' : 'already-delivered',
        delivered: gap.delivered }
    : { status: 'retry-required', reason: gap.reason, delivered: gap.delivered };
};

// FACTORY ONLY: do NOT register/export an active Cloud Function from index.ts.
// This can be activated only after legacy app, shared RTDB Rules and Master
// cutover gates pass. An onCreate event arrives AFTER an atomic approval.
export const createLikeReceiptDeliveryTriggerCandidate420 = (
  firestore: Firestore,
  realtime: Database,
) => onDocumentCreated({
  document: 'privateLikeGuardV2_420/{uid}/approvals/{operationId}',
  region: 'us-central1',
  retry: true,
  // Keep per-attempt resource use bounded; Eventarc delivers at least once
  // and may deliver out of order. This is not a 30-day retry guarantee.
  timeoutSeconds: 60,
  memory: '256MiB',
}, async event => {
  const uid = event.params.uid;
  const operationId = event.params.operationId;
  const receipt = event.data?.data();
  if (!receipt || typeof receipt !== 'object') {
    // A malformed event must never authorize a like or acknowledge delivery.
    throw new Error('420_DELIVERY_EVENT_PROOF_MISSING');
  }
  const approvedAtMs = receipt.approvedAtMs;
  if (!Number.isSafeInteger(approvedAtMs) || approvedAtMs <= 0) {
    throw new Error('420_DELIVERY_EVENT_TIMESTAMP_INVALID');
  }
  const ageMs = Date.now() - approvedAtMs;
  if (ageMs < 0) {
    throw new Error('420_DELIVERY_EVENT_CLOCK_SKEW');
  }
  try {
    const result = await handleApprovedLikeReceiptWakeupCandidate420(
      firestore, realtime, uid, operationId, receipt,
    );
    // CRITICAL: returning retry-required is an Eventarc ACK unless thrown.
    if (result.status === 'retry-required') {
      throw new Error('420_DELIVERY_RETRY_REQUIRED_' + result.reason);
    }
  } catch (error) {
    if (ageMs < 23 * 60 * 60_000) {
      // Must throw, not return. The deployed Eventarc retry policy still has
      // to be verified independently before any Stage420 activation.
      throw error;
    }
    // Past the bounded retry horizon, preserve a server-owned, exact-operation
    // failure record for explicit repair. This is NOT successful delivery.
    // Unique operation ID avoids ever rewriting an existing failure record.
    const hold = firestore.collection('privateLikeGuardV2_420').doc(uid)
      .collection('deliveryFailures').doc(operationId);
    try {
      await hold.create({
        uid, operationId, approvalVersion: receipt.version,
        approvedAtMs, heldAtMs: Date.now(),
        state: 'needs-manual-reconciliation',
        // TTL policy is NOT yet provisioned; do not claim auto deletion.
        expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60_000),
      });
    } catch (writeError: unknown) {
      // The only tolerable conflict is that the exact hold already exists.
      if ((writeError as { code?: string | number })?.code !== 6 &&
          (writeError as { code?: string | number })?.code !== 'already-exists') {
        // Do not falsely acknowledge a retry if the alert write failed.
        throw writeError;
      }
    }
    // Terminal HOLD is deliberately not success. An operator needs an
    // out-of-band alert and authenticated, exact-ID recovery before cutover.
    console.error('420_DELIVERY_HELD_FOR_OPERATOR', { uid, operationId });
  }
});

// Triggers not linked in index.ts. No new service may be deployed on push.

// Master-only MANUAL recovery candidate for a held, previously approved
// like delivery. The future callable MUST invoke requireMasterCaller first.
// Exact per-operation Firestore reads only; this NEVER repeats an approval.
export type AtomicLikeHeldRecoveryResult420 = {
  recovered: boolean;
  duplicate: boolean;
  delivered: number;
};
export const recoverHeldLikeDeliveryAfterMasterAuthCandidate420 = async (
  firestore: Firestore,
  realtime: Database,
  masterUid: string,
  targetUid: string,
  operationId: string,
  reason: string,
  nowMs = Date.now(),
): Promise<AtomicLikeHeldRecoveryResult420> => {
  if (!validAccount(masterUid) || !validAccount(targetUid) ||
      typeof operationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(operationId) ||
      typeof reason !== 'string' || !reason.trim() ||
      reason.length > 120 || !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error('420_HELD_RECOVERY_REQUEST_INVALID');
  }
  const account = firestore.collection('privateLikeGuardV2_420').doc(targetUid);
  const heldRef = account.collection('deliveryFailures').doc(operationId);
  const proofRef = account.collection('approvals').doc(operationId);
  const [heldSnap, proofSnap] = await Promise.all([
    heldRef.get(), proofRef.get(),
  ]);
  if (!heldSnap.exists) throw new Error('420_HELD_RECOVERY_NOT_FOUND');
  const held = heldSnap.data();
  if (held?.state === 'recovered') {
    return { recovered: false, duplicate: true, delivered: 0 };
  }
  if (!proofSnap.exists || held?.state !== 'needs-manual-reconciliation') {
    throw new Error('420_HELD_RECOVERY_PROOF_MISSING');
  }
  const proof = proofSnap.data();
  if (!proof) throw new Error('420_HELD_RECOVERY_PROOF_MISSING');
  if (held?.uid !== targetUid || held?.operationId !== operationId ||
      held?.approvalVersion !== proof?.version ||
      held?.approvedAtMs !== proof?.approvedAtMs) {
    throw new Error('420_HELD_RECOVERY_PROOF_MISMATCH');
  }
  const wake = await handleApprovedLikeReceiptWakeupCandidate420(
    firestore, realtime, targetUid, operationId, proof, nowMs,
  );
  if (wake.status === 'retry-required') {
    throw new Error('420_HELD_RECOVERY_STILL_WAITING_' + wake.reason);
  }
  // Two Masters could race on the same held event. The delivery transaction
  // already prevents duplicate notifications; the receipt update stays W1.
  return firestore.runTransaction(async tx => {
    const current = await tx.get(heldRef);
    const value = current.data();
    if (value?.state === 'recovered') {
      return { recovered: false, duplicate: true, delivered: 0 };
    }
    if (!current.exists || value?.state !== 'needs-manual-reconciliation' ||
        value?.approvedAtMs !== proof.approvedAtMs ||
        value?.approvalVersion !== proof.version) {
      throw new Error('420_HELD_RECOVERY_CHANGED');
    }
    tx.set(heldRef, {
      ...value,
      state: 'recovered',
      recoveredAtMs: nowMs,
      recoveredByMasterUid: masterUid,
      recoveryReason: reason.trim(),
    });
    return { recovered: true, duplicate: false, delivered: wake.delivered };
  });
};

// Only callable by a future server wrapper AFTER requireMasterCaller has
// authenticated the Master. DO NOT directly expose this as a Function.
// The unlock and immutable audit are one atomic Firestore transaction.
export type AtomicLikeMasterUnlockResult420 = {
  unlocked: boolean;
  duplicate: boolean;
  previousLockedUntilMs: number;
  version: number;
};
export const masterUnlockAtomicLikeAfterAuthCandidate420 = async (
  firestore: Firestore,
  masterUid: string,
  targetUid: string,
  requestId: string,
  reason: string,
  nowMs = Date.now(),
): Promise<AtomicLikeMasterUnlockResult420> => {
  if (!validAccount(masterUid) || !validAccount(targetUid) ||
      typeof requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{12,96}$/.test(requestId) ||
      typeof reason !== 'string' || !reason.trim() ||
      reason.length > 120 || !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error('420_MASTER_UNLOCK_INVALID');
  }
  const rateRef = firestore.collection('privateLikeGuardV2_420').doc(targetUid);
  const auditRef = rateRef.collection('adminUnlockAudit').doc(requestId);
  return firestore.runTransaction(async tx => {
    const previousAudit = await tx.get(auditRef);
    if (previousAudit.exists) {
      const record = previousAudit.data();
      if (record?.masterUid !== masterUid ||
          record?.reason !== reason.trim()) {
        throw new Error('420_MASTER_UNLOCK_REPLAY_MISMATCH');
      }
      return { unlocked: false, duplicate: true,
        previousLockedUntilMs: Number(record?.previousLockedUntilMs || 0),
        version: Number(record?.version || 0) };
    }
    const snapshot = await tx.get(rateRef);
    const state = normalize(snapshot.data());
    if (state.lockedUntilMs <= nowMs) {
      return { unlocked: false, duplicate: false,
        previousLockedUntilMs: state.lockedUntilMs, version: state.version };
    }
    const next: RateState = { ...state, windowStartMs: 0,
      acceptedInWindow: 0, previousWindowStartMs: 0,
      previousWindowReachedLimit: false, lockedUntilMs: 0 };
    // Keep last approved version intact: the next genuine click must be
    // contiguous. Audit is a separate immutable exact-ID document, rather
    // than growing the every-click rate document.
    tx.set(rateRef, next);
    tx.create(auditRef, {
      masterUid, targetUid, requestId, reason: reason.trim(), at: nowMs,
      previousLockedUntilMs: state.lockedUntilMs, version: state.version,
    });
    return { unlocked: true, duplicate: false,
      previousLockedUntilMs: state.lockedUntilMs, version: state.version };
  });
};

// Firestore guarantees atomic create(receipt)+update(rate) in one transaction.
// NO RTDB tree read/rewrite; bounded 1 exact receipt + 1 small rate document.
// A permanent/old v4 op is never silently granted after receipt TTL deletion.
export const approveLikeWithAtomicLedgerCandidate420 = async (
  db: Firestore,
  uid: string,
  op: AtomicLikeCommand420,
  nowMs = Date.now(),
  settings: LikeAbuseSettings420 = DEFAULT_LIKE_ABUSE_SETTINGS_420,
): Promise<AtomicLikeDecision420> => {
  const timestamp = readLikeOperationTime420(op?.operationId);
  const isLegacyV4 = typeof op?.operationId === 'string' &&
    UUID_V4.test(op.operationId);
  if (!validAccount(uid) || !op || typeof op.trackId !== 'string' ||
      !op.trackId || op.trackId.length > 512 ||
      typeof op.ownerUid !== 'string' || op.ownerUid.length > 128 ||
      typeof op.liked !== 'boolean' ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !Number.isInteger(settings.limitPerMinute) ||
      settings.limitPerMinute < 1 || settings.limitPerMinute > 200 ||
      !Number.isInteger(settings.warningPerMinute) ||
      settings.warningPerMinute < 1 ||
      !Number.isInteger(settings.suspensionMinutes) ||
      settings.suspensionMinutes < 1 ||
      (timestamp === null && !isLegacyV4)) {
    throw new Error('420_ATOMIC_LEDGER_REQUEST_INVALID');
  }
  // Critical ordering: v7 IDs older than the replay window can NEVER become
  // new once Firestore TTL removes the receipt. A v4 has no embedded timestamp,
  // so it is allowed ONLY as exact replay of an existing trusted receipt.
  if (timestamp !== null && (timestamp > nowMs + CLOCK_SKEW_MS ||
      nowMs - timestamp >= LIKE_LEDGER420_MAX_REPLAY_AGE_MS)) {
    throw new Error('420_ATOMIC_LEDGER_EXPIRED_FAIL_CLOSED');
  }
  const digest = fingerprint(uid, op);
  const account = db.collection('privateLikeGuardV2_420').doc(uid);
  const receipt = account.collection('approvals').doc(op.operationId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(receipt);
    if (isLegacyV4 && !existing.exists) {
      // No proof exists in the new ledger for a pre-cutover v4 request.
      // Never manufacture an approval, rewrite opId, or spend click quota.
      // Caller must keep its original durable pending state for reconciliation.
      throw new Error('420_LEGACY_PROOF_MISSING_FAIL_CLOSED');
    }
    if (existing.exists) {
      const raw = existing.data();
      if (isLegacyV4) {
        const approvedAtMs = raw?.approvedAtMs;
        if (!Number.isSafeInteger(approvedAtMs) || approvedAtMs <= 0 ||
            approvedAtMs > nowMs + CLOCK_SKEW_MS ||
            nowMs - approvedAtMs >= LIKE_LEDGER420_MAX_REPLAY_AGE_MS) {
          throw new Error('420_LEGACY_PROOF_EXPIRED_FAIL_CLOSED');
        }
      }
      const rateFromReceipt = normalize(raw?.rateAtApproval);
      if (raw?.digest !== digest || raw?.status !== 'approved') {
        return denied(rateFromReceipt, settings.limitPerMinute);
      }
      return {
        allowed: true, duplicate: true,
        warning: raw?.warning === true, lockedUntilMs: rateFromReceipt.lockedUntilMs,
        remainingInWindow: Math.max(0,
          settings.limitPerMinute - rateFromReceipt.acceptedInWindow),
        version: Number(raw?.version || 0),
      };
    }
    const rateRef = await tx.get(account);
    const state = normalize(rateRef.data());
    if (timestamp === null || nowMs - timestamp > LIKE_LEDGER420_MAX_FIRST_SEND_AGE_MS ||
        state.lockedUntilMs > nowMs) return denied(state, settings.limitPerMinute);
    const minute = Math.floor(nowMs / MINUTE) * MINUTE;
    const current = state.windowStartMs === minute ? state : {
      ...state,
      windowStartMs: minute,
      acceptedInWindow: 0,
      previousWindowStartMs: state.windowStartMs === minute - MINUTE
        ? state.windowStartMs : 0,
      previousWindowReachedLimit: state.windowStartMs === minute - MINUTE &&
        state.acceptedInWindow >= (state.limitPerMinute || settings.limitPerMinute),
      lockedUntilMs: 0,
      limitPerMinute: settings.limitPerMinute,
    };
    const limit = current.limitPerMinute || settings.limitPerMinute;
    if (current.acceptedInWindow >= limit ||
        current.version >= Number.MAX_SAFE_INTEGER) return denied(current, limit);
    const count = current.acceptedInWindow + 1;
    const isSecondFull = count === limit && current.previousWindowReachedLimit &&
      current.previousWindowStartMs === minute - MINUTE;
    const next: RateState = {
      ...current, acceptedInWindow: count, version: current.version + 1,
      lockedUntilMs: isSecondFull
        ? nowMs + settings.suspensionMinutes * MINUTE : 0,
    };
    const warning = count >= settings.warningPerMinute || isSecondFull;
    tx.set(account, next);
    tx.create(receipt, {
      digest, status: 'approved', approvedAtMs: nowMs, version: next.version,
      // Trigger/recovery can reconstruct the exact changed track without
      // accessing the user's whole catalog or trusting client-provided data.
      trackId: op.trackId, ownerUid: op.ownerUid, liked: op.liked,
      operationId: op.operationId,
      warning, rateAtApproval: next,
      expiresAt: new Date(timestamp + LIKE_LEDGER420_TTL_DELETE_AFTER_MS),
    });
    return {
      allowed: true, duplicate: false, warning,
      lockedUntilMs: next.lockedUntilMs,
      remainingInWindow: Math.max(0, limit - count), version: next.version,
    };
  });
};
