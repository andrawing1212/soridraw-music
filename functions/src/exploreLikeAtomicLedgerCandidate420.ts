// Stage420 source-only alternative: per-operation Firestore receipts and one
// constant-size rate document. This candidate is deliberately NOT wired into
// a Callable or used by any deployed app; RTDB provisional delivery and
// Master unlock parity must be solved before a coordinated cutover.
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
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
  const initial = await displayRef.get();
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
