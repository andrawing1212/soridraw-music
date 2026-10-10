// Stage420 source-only alternative: per-operation Firestore receipts and one
// constant-size rate document. This candidate is deliberately NOT wired into
// a Callable or used by any deployed app; RTDB provisional delivery and
// Master unlock parity must be solved before a coordinated cutover.
import type { Firestore } from 'firebase-admin/firestore';
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
      settings.suspensionMinutes < 1 || timestamp === null) {
    throw new Error('420_ATOMIC_LEDGER_REQUEST_INVALID');
  }
  // Critical ordering: reject old operation IDs BEFORE checking receipts.
  // Once Firestore TTL removes a receipt, the old ID must never be new again.
  if (timestamp > nowMs + CLOCK_SKEW_MS ||
      nowMs - timestamp >= LIKE_LEDGER420_MAX_REPLAY_AGE_MS) {
    throw new Error('420_ATOMIC_LEDGER_EXPIRED_FAIL_CLOSED');
  }
  const digest = fingerprint(uid, op);
  const account = db.collection('privateLikeGuardV2_420').doc(uid);
  const receipt = account.collection('approvals').doc(op.operationId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(receipt);
    if (existing.exists) {
      const raw = existing.data();
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
    if (nowMs - timestamp > LIKE_LEDGER420_MAX_FIRST_SEND_AGE_MS ||
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
