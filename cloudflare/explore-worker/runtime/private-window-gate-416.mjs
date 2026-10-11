// Stage416 SERVER candidate: pure UID-wide private-like batch clock.
// This module performs no I/O and is not called by the live Worker until the
// server-authenticated per-UID storage/serialization path is proven.
// All timestamps in this module MUST be assigned by the server, not clients.
export const PRIVATE_CLOCK_MINUTES_416 = Object.freeze([1, 3, 5, 10, 20]);

const safeTime = value => Number.isSafeInteger(value) && value > 0;
const safeVersion = value => Number.isSafeInteger(value) && value > 0;
const validMinutes = value => PRIVATE_CLOCK_MINUTES_416.includes(value);
const isClock416 = clock => !!clock && typeof clock === 'object' &&
  safeVersion(clock.version) && safeTime(clock.openedAtMs) &&
  safeTime(clock.lastClickAtMs) && safeTime(clock.deadlineAtMs) &&
  validMinutes(clock.minutes) &&
  clock.lastClickAtMs >= clock.openedAtMs &&
  clock.deadlineAtMs === clock.lastClickAtMs + clock.minutes * 60_000;

// Called only after the authenticated click is accepted by the single
// per-UID coordinator. Version MUST originate from the monotonic server
// sequence; sender device timestamps cannot be used for ordering.
export function registerServerPrivateClick416(prior, input) {
  const { version, serverReceivedAtMs, configuredMinutes } = input || {};
  if (!safeVersion(version) || !safeTime(serverReceivedAtMs) ||
      !validMinutes(configuredMinutes)) throw new Error('416_CLOCK_INVALID_INPUT');
  if (prior != null && !isClock416(prior)) throw new Error('416_CLOCK_CORRUPT');
  if (prior && version <= prior.version) {
    return { updated: false, reason: 'STALE_OR_DUPLICATE', clock: prior };
  }
  // Use the server's clock exclusively. If an earlier click is delivered
  // after a newer one, its lower monotonic version cannot reopen the window.
  const serverAt = prior ? Math.max(serverReceivedAtMs, prior.lastClickAtMs) : serverReceivedAtMs;
  const continuing = !!prior && serverAt <= prior.deadlineAtMs;
  const minutes = continuing ? prior.minutes : configuredMinutes;
  const clock = {
    version,
    openedAtMs: continuing ? prior.openedAtMs : serverAt,
    lastClickAtMs: serverAt,
    minutes,
    deadlineAtMs: serverAt + minutes * 60_000,
  };
  return { updated: true, reason: 'RECORDED', clock };
}

// A preflight alone is NOT a release token. The eventual canonical writer
// MUST be serialized with registerServerPrivateClick416 using this SAME UID
// coordinator; checking here and writing through another actor is a TOCTOU
// race and must fail the release audit.
export function evaluateServerPrivateIntake416(clock, { observedVersion, serverNowMs } = {}) {
  if (!safeVersion(observedVersion) || !safeTime(serverNowMs)) {
    return { allowed: false, reason: 'INVALID_INTAKE' };
  }
  if (!isClock416(clock)) return { allowed: false, reason: 'NO_SERVER_CLOCK' };
  if (observedVersion !== clock.version) {
    return { allowed: false, reason: observedVersion < clock.version ? 'STALE_DEVICE' : 'UNKNOWN_VERSION' };
  }
  if (serverNowMs < clock.deadlineAtMs) {
    return { allowed: false, reason: 'WAIT_UNTIL_DEADLINE', retryAfterMs: clock.deadlineAtMs - serverNowMs };
  }
  return { allowed: true, reason: 'READY', version: clock.version };
}
