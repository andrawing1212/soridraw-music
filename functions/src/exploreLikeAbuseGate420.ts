// Stage420 server-owned, authenticated rate/lock gate prototype.
// NOT deployed or wired to app392. A user can still write the legacy
// userSync/$uid/exploreLikeIntent416 path until the shared ancestor .write
// permission is migrated safely; do not claim this closes abuse by itself.
import type { Database } from 'firebase-admin/database';

export const LIKE_420_WARNING = 30;
export const LIKE_420_MINUTE_LIMIT = 40;
export const LIKE_420_TWO_HOURS_MS = 120 * 60_000;
const MINUTE_MS = 60_000;
const MAX_RESULTS = 50;

export type LikePrivateCommand420 = {
  trackId: string;
  ownerUid: string;
  liked: boolean;
  operationId: string;
};
export type LikeGuardState420 = {
  windowStartMs: number;
  acceptedInWindow: number;
  previousWindowStartMs: number;
  previousWindowReachedLimit: boolean;
  lockedUntilMs: number;
};
type PrivateRow420 = LikePrivateCommand420 & {
  version: number;
  at: number;
  status: 'pending';
};
type ServerOwnedSignal420 = {
  version: number;
  rate: LikeGuardState420;
  results: PrivateRow420[];
};
type ServerOwnedRoot420 = {
  display?: ServerOwnedSignal420;
  adminUnlockAudit?: Array<Record<string, unknown>>;
};
export type GuardedLikeResult420 = {
  allowed: boolean;
  warning: boolean;
  lockedUntilMs: number;
  remainingInWindow: number;
  version: number;
  duplicate: boolean;
};
const initial = (): LikeGuardState420 => ({
  windowStartMs: 0,
  acceptedInWindow: 0,
  previousWindowStartMs: 0,
  previousWindowReachedLimit: false,
  lockedUntilMs: 0,
});
const normalizeState = (value: unknown): LikeGuardState420 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return initial();
  const x = value as Partial<LikeGuardState420>;
  const n = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0;
  return {
    windowStartMs: n(x.windowStartMs),
    acceptedInWindow: Math.min(LIKE_420_MINUTE_LIMIT, n(x.acceptedInWindow)),
    previousWindowStartMs: n(x.previousWindowStartMs),
    previousWindowReachedLimit: x.previousWindowReachedLimit === true,
    lockedUntilMs: n(x.lockedUntilMs),
  };
};
const validOp = (x: LikePrivateCommand420): boolean =>
  !!x && typeof x.trackId === 'string' && x.trackId.length > 0 &&
  x.trackId.length <= 512 && typeof x.ownerUid === 'string' &&
  x.ownerUid.length <= 128 && typeof x.liked === 'boolean' &&
  typeof x.operationId === 'string' && /^[0-9a-f-]{36}$/i.test(x.operationId);

const decide = (state: LikeGuardState420, now: number):
  { allowed: boolean; warning: boolean; lockedUntilMs: number; remaining: number; rate: LikeGuardState420 } => {
  if (state.lockedUntilMs > now) {
    return { allowed: false, warning: true, lockedUntilMs: state.lockedUntilMs,
      remaining: 0, rate: state };
  }
  const minute = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  let next = state;
  if (state.windowStartMs !== minute) {
    const consecutive = state.windowStartMs === minute - MINUTE_MS;
    next = {
      windowStartMs: minute, acceptedInWindow: 0,
      previousWindowStartMs: consecutive ? state.windowStartMs : 0,
      previousWindowReachedLimit: consecutive &&
        state.acceptedInWindow >= LIKE_420_MINUTE_LIMIT,
      lockedUntilMs: 0,
    };
  }
  if (next.acceptedInWindow >= LIKE_420_MINUTE_LIMIT) {
    return { allowed: false, warning: true, lockedUntilMs: 0, remaining: 0, rate: next };
  }
  const count = next.acceptedInWindow + 1;
  const secondFullMinute = count === LIKE_420_MINUTE_LIMIT &&
    next.previousWindowReachedLimit && next.previousWindowStartMs === minute - MINUTE_MS;
  const lockedUntilMs = secondFullMinute ? now + LIKE_420_TWO_HOURS_MS : 0;
  return {
    allowed: true, warning: count >= LIKE_420_WARNING,
    lockedUntilMs, remaining: LIKE_420_MINUTE_LIMIT - count,
    rate: { ...next, acceptedInWindow: count, lockedUntilMs },
  };
};

// Atomic server-side transaction; only Firebase Admin is allowed to write
// privateLikeSync420/UID. A denied action leaves the prior RTDB value alone.
// Every transaction runs the policy against the Function server clock, never
// the mobile device clock, and uses an operationId for idempotent retries.
export const publishGuardedLikeSignal420 = async (
  database: Database,
  authUid: string,
  input: LikePrivateCommand420,
  serverNowMs = Date.now(),
): Promise<GuardedLikeResult420> => {
  if (!authUid || authUid.length > 128 || !validOp(input) ||
      !Number.isSafeInteger(serverNowMs) || serverNowMs < 0) {
    throw new Error('INVALID_PRIVATE_LIKE_REQUEST');
  }
  const ref = database.ref(`privateLikeSync420/${authUid}`);
  const transaction = await ref.transaction((value: unknown) => {
    const current = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Partial<ServerOwnedRoot420> : {};
    const visible = current.display || {} as Partial<ServerOwnedSignal420>;
    const previousVersion = Number(visible.version || 0);
    if (!Number.isSafeInteger(previousVersion) || previousVersion >= Number.MAX_SAFE_INTEGER) return;
    const prior = Array.isArray(visible.results) ? visible.results : [];
    if (prior.some((row) => row?.operationId === input.operationId)) return;
    const decision = decide(normalizeState(visible.rate), serverNowMs);
    if (!decision.allowed) return;
    const row: PrivateRow420 = { ...input, version: previousVersion + 1,
      at: serverNowMs, status: 'pending' };
    const bounded = prior.filter((item) =>
      !!item && item.status === 'pending' && item.trackId !== input.trackId &&
      typeof item.at === 'number' && serverNowMs - item.at <= 60 * 60_000
    ).slice(-(MAX_RESULTS - 1));
    // Keep the Master-only audit beside, but never inside the user-readable
    // display subtree. One atomic root transaction preserves either side.
    return { ...current, display: {
      version: previousVersion + 1, rate: decision.rate,
      results: [...bounded, row],
    } } as ServerOwnedRoot420;
  }, undefined, false);
  const root = transaction.snapshot.val() as ServerOwnedRoot420 | null;
  const snapshot = root?.display;
  const version = Number(snapshot?.version || 0);
  const rate = normalizeState(snapshot?.rate);
  const duplicate = Array.isArray(snapshot?.results) &&
    snapshot.results.some((row) => row?.operationId === input.operationId);
  const allowed = transaction.committed || duplicate;
  return {
    allowed,
    warning: rate.acceptedInWindow >= LIKE_420_WARNING || !allowed,
    lockedUntilMs: rate.lockedUntilMs > serverNowMs ? rate.lockedUntilMs : 0,
    remainingInWindow: Math.max(0, LIKE_420_MINUTE_LIMIT - rate.acceptedInWindow),
    version,
    duplicate: !transaction.committed && duplicate,
  };
};
