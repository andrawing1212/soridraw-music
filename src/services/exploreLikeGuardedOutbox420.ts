// Stage420 guarded outbox reducer. Source-only until the existing app392
// direct channel, shared RTDB Rules and canonical Worker are safely cut over.
// Do not enable a guarded batch by just changing a UI feature flag.
export type GuardedOutboxEntry420 = {
  uid: string;
  trackId: string;
  ownerUid: string;
  desiredLiked: boolean;
  operationId: string;
  baseLiked: boolean;
  updatedAt: number;
  guardStatus: 'awaiting' | 'approved';
};
export type GuardedOutboxReply420 = {
  allowed: boolean;
  ok: true;
  lockedUntilMs: number;
  guardPermit420?: string;
};
export type GuardedCanonicalEvidence420 = {
  uid: string;
  trackId: string;
  liked: boolean;
  // Never infer personal membership from a public count.
  source: 'accepted-127' | 'verified-personal-snapshot' | 'verified-local-baseline';
  version: number;
};
export type GuardedResolution420 =
  | { action: 'superseded'; canFlush: false }
  | { action: 'await-reply'; canFlush: false }
  | { action: 'await-proof'; canFlush: false }
  | { action: 'approved'; canFlush: true; guardPermit420: string }
  | { action: 'rollback'; canFlush: false; liked: boolean; evidenceVersion: number };

// No asynchronous gap is permitted between reading the newest outbox row
// and applying this result to persistent storage. All UI notification must
// occur AFTER the caller durably persists the returned transition.
export const resolveGuardedOutbox420 = (
  sent: GuardedOutboxEntry420,
  latest: GuardedOutboxEntry420 | null | undefined,
  reply: GuardedOutboxReply420 | null,
  evidence: GuardedCanonicalEvidence420 | null,
): GuardedResolution420 => {
  if (!latest || latest.uid !== sent.uid ||
      latest.trackId !== sent.trackId ||
      latest.ownerUid !== sent.ownerUid ||
      latest.operationId !== sent.operationId ||
      latest.desiredLiked !== sent.desiredLiked ||
      latest.updatedAt !== sent.updatedAt) {
    return { action: 'superseded', canFlush: false };
  }
  if (!reply || reply.ok !== true) return { action: 'await-reply', canFlush: false };
  if (reply.allowed) {
    // Authentication and rate approval alone do NOT authorize Worker intake.
    // No signed permit => no canonical flush; wait for safe retry. Actual
    // signature/UID/track/action verification happens in the Worker.
    if (typeof reply.guardPermit420 !== 'string' ||
        !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(reply.guardPermit420) ||
        reply.guardPermit420.length > 2400) {
      return { action: 'await-reply', canFlush: false };
    }
    return { action: 'approved', canFlush: true, guardPermit420: reply.guardPermit420 };
  }
  if (!evidence || evidence.uid !== sent.uid ||
      evidence.trackId !== sent.trackId ||
      !Number.isSafeInteger(evidence.version) || evidence.version < 0 ||
      typeof evidence.liked !== 'boolean' ||
      !['accepted-127', 'verified-personal-snapshot', 'verified-local-baseline'].includes(evidence.source)) {
    // A denied provisional signal does not prove a canonical liked/unliked
    // value. Retain the durable row until bounded authoritative reconciliation.
    return { action: 'await-proof', canFlush: false };
  }
  return {
    action: 'rollback', canFlush: false, liked: evidence.liked,
    evidenceVersion: evidence.version,
  };
};

export const canFlushGuardedOutbox420 = (
  entry: GuardedOutboxEntry420 & { guardPermit420?: string },
): boolean => entry.guardStatus === 'approved' &&
  typeof entry.guardPermit420 === 'string' &&
  /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(entry.guardPermit420) &&
  entry.guardPermit420.length <= 2400;

// The outer caller supplies read/apply to guarantee a fresh synchronous
// comparison. It must commit outbox+personal-cache before notifying the UI.
// No canonical batch can be submitted while authorization is unknown.
export const settleGuardedOutbox420 = (
  sent: GuardedOutboxEntry420,
  reply: GuardedOutboxReply420 | null,
  readCurrent: () => {
    latest: GuardedOutboxEntry420 | null;
    evidence: GuardedCanonicalEvidence420 | null;
  },
  commit: (decision: GuardedResolution420) => void,
  notifyAfterCommit: (decision: GuardedResolution420) => void,
): GuardedResolution420 => {
  const snapshot = readCurrent();
  const decision = resolveGuardedOutbox420(
    sent, snapshot.latest, reply, snapshot.evidence,
  );
  if (decision.action === 'approved' || decision.action === 'rollback') {
    // All callbacks are synchronous: no remote read or write between the
    // final operationId comparison and local durable transaction.
    commit(decision);
    notifyAfterCommit(decision);
  }
  return decision;
};
