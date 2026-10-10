// Stage416-420 | Pure, deterministic per-UID rate policy.
// IMPORTANT: an individual client may use this for UX, but it is NOT an
// anti-abuse security boundary. Only a server-owned, atomic state and
// enforcement that also closes the direct RTDB / REST path is authoritative.
// This file is deliberately NOT wired to the deployed app392 until its
// server-owned write path and legacy-client compatibility are proven.
export const EXPLORE_LIKE_ABUSE_WARNING_PER_MINUTE_420 = 30;
export const EXPLORE_LIKE_ABUSE_LIMIT_PER_MINUTE_420 = 40;
export const EXPLORE_LIKE_ABUSE_MINUTE_MS_420 = 60_000;
export const EXPLORE_LIKE_ABUSE_SUSPEND_MS_420 = 120 * 60_000;

export type ExploreLikeAbuseState420 = {
  windowStartMs: number;
  acceptedInWindow: number;
  previousWindowStartMs: number;
  previousWindowReachedLimit: boolean;
  lockedUntilMs: number;
};
export type ExploreLikeAbuseDecision420 = {
  allowed: boolean;
  warning: boolean;
  newlySuspended: boolean;
  lockedUntilMs: number;
  remainingInWindow: number;
  nextState: ExploreLikeAbuseState420;
};
export const emptyExploreLikeAbuseState420 = (): ExploreLikeAbuseState420 => ({
  windowStartMs: 0,
  acceptedInWindow: 0,
  previousWindowStartMs: 0,
  previousWindowReachedLimit: false,
  lockedUntilMs: 0,
});

// 60s fixed windows anchored at the trusted server clock, never a device clock.
// One account's PCs/tabs/mobiles must share the same atomically saved state.
// Returning unchanged state on a rejected attempt prevents abusive repeated
// requests from growing the persistent counter storage.
export const evaluateExploreLikeAbuseClick420 = (
  current: ExploreLikeAbuseState420,
  trustedServerNowMs: number,
): ExploreLikeAbuseDecision420 => {
  if (!Number.isSafeInteger(trustedServerNowMs) || trustedServerNowMs < 0) {
    throw new Error('A trusted non-negative server timestamp is required');
  }
  const nowWindow = Math.floor(trustedServerNowMs / EXPLORE_LIKE_ABUSE_MINUTE_MS_420) *
    EXPLORE_LIKE_ABUSE_MINUTE_MS_420;
  const lockUntil = Number.isSafeInteger(current.lockedUntilMs)
    ? Math.max(0, current.lockedUntilMs) : 0;
  if (lockUntil > trustedServerNowMs) {
    return { allowed: false, warning: true, newlySuspended: false,
      lockedUntilMs: lockUntil, remainingInWindow: 0, nextState: current };
  }
  let next = current;
  if (current.windowStartMs !== nowWindow) {
    const contiguous = current.windowStartMs === nowWindow - EXPLORE_LIKE_ABUSE_MINUTE_MS_420;
    next = {
      windowStartMs: nowWindow,
      acceptedInWindow: 0,
      previousWindowStartMs: contiguous ? current.windowStartMs : 0,
      previousWindowReachedLimit: contiguous &&
        current.acceptedInWindow >= EXPLORE_LIKE_ABUSE_LIMIT_PER_MINUTE_420,
      lockedUntilMs: 0,
    };
  }
  if (next.acceptedInWindow >= EXPLORE_LIKE_ABUSE_LIMIT_PER_MINUTE_420) {
    return { allowed: false, warning: true, newlySuspended: false,
      lockedUntilMs: 0, remainingInWindow: 0, nextState: next };
  }
  const acceptedInWindow = next.acceptedInWindow + 1;
  const newlySuspended = acceptedInWindow >= EXPLORE_LIKE_ABUSE_LIMIT_PER_MINUTE_420 &&
    next.previousWindowReachedLimit &&
    next.previousWindowStartMs === nowWindow - EXPLORE_LIKE_ABUSE_MINUTE_MS_420;
  const lockedUntilMs = newlySuspended ? trustedServerNowMs + EXPLORE_LIKE_ABUSE_SUSPEND_MS_420 : 0;
  const nextState: ExploreLikeAbuseState420 = {
    ...next,
    acceptedInWindow,
    lockedUntilMs,
  };
  return {
    allowed: true,
    warning: acceptedInWindow >= EXPLORE_LIKE_ABUSE_WARNING_PER_MINUTE_420,
    newlySuspended,
    lockedUntilMs,
    remainingInWindow: EXPLORE_LIKE_ABUSE_LIMIT_PER_MINUTE_420 - acceptedInWindow,
    nextState,
  };
};
