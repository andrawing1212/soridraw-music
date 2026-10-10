import { onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { functions, realtimeDb } from '../firebase';
import { settleGuardedOutbox420, type GuardedOutboxEntry420, type GuardedCanonicalEvidence420, type GuardedOutboxReply420, type GuardedResolution420 } from './exploreLikeGuardedOutbox420';

// Stage420 candidate-only adapter: intentionally NOT wired into app392.
// The parent privateLikeSync420/$uid is unreadable to every client. Only its
// display subtree is readable by that authenticated UID; Master audit is not.
export type GuardedLikeMutation420 = {
  trackId: string;
  ownerUid: string;
  liked: boolean;
  operationId: string;
};
export type GuardedLikeDecision420 = {
  ok: boolean;
  allowed: boolean;
  warning: boolean;
  lockedUntilMs: number;
  remainingInWindow: number;
  version: number;
  duplicate: boolean;
  guardPermit420?: string;
};
export type GuardedLikeEvent420 = GuardedLikeMutation420 & {
  version: number;
  at: number;
  status: 'pending' | 'accepted' | 'rejected';
};
type GuardedLikeDisplay420 = {
  version: number;
  results: GuardedLikeEvent420[];
  rate?: { lockedUntilMs?: number; acceptedInWindow?: number };
};
const MAX_EVENTS = 50;
const MAX_EVENT_AGE_MS = 30_000;
const operationIdValid = (value: string): boolean =>
  /^[0-9a-f-]{36}$/i.test(value);
const isRow = (row: unknown): row is GuardedLikeEvent420 => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const r = row as Partial<GuardedLikeEvent420>;
  return typeof r.trackId === 'string' && r.trackId.length > 0 && r.trackId.length <= 512 &&
    typeof r.ownerUid === 'string' && r.ownerUid.length <= 128 &&
    typeof r.liked === 'boolean' && typeof r.operationId === 'string' &&
    operationIdValid(r.operationId) &&
    Number.isSafeInteger(Number(r.version)) && Number(r.version) > 0 &&
    Number.isSafeInteger(Number(r.at)) && Number(r.at) > 0 &&
    (r.status === 'pending' || r.status === 'accepted' || r.status === 'rejected');
};

// Server-enforced protection is not implemented by this client wrapper. The
// Function auth identity + Admin RTDB transaction + strict shared RTDB rules
// are collectively required. Do not silently fall back to direct RTDB writes
// on permission-denied: that would reopen the cost-attack bypass.
export const publishGuardedLikeIntent420 = async (
  mutation: GuardedLikeMutation420,
): Promise<GuardedLikeDecision420> => {
  if (!mutation.trackId || mutation.trackId.length > 512 ||
      !operationIdValid(mutation.operationId)) {
    throw new Error('INVALID_GUARDED_LIKE_REQUEST');
  }
  const call = httpsCallable<GuardedLikeMutation420, GuardedLikeDecision420>(
    functions, 'publishExploreLikeIntent420',
  );
  const result = await call(mutation);
  const decision = result.data;
  if (!decision || decision.ok !== true ||
      typeof decision.allowed !== 'boolean' ||
      !Number.isFinite(decision.lockedUntilMs) ||
      (decision.allowed && (typeof decision.guardPermit420 !== 'string' ||
        !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(decision.guardPermit420)))) {
    throw new Error('INVALID_GUARDED_LIKE_RESPONSE');
  }
  return decision;
};

// Dormant renewal adapter: refresh only an earlier signed exact operation.
// No RTDB fallback or rate-call fallback if this endpoint rejects/has no proof.
export const renewGuardedLikePermitCandidate420 = async (
  mutation: Pick<GuardedLikeMutation420, 'trackId' | 'liked' | 'operationId'>,
  previousGuardPermit420: string,
): Promise<string> => {
  if (!mutation.trackId || mutation.trackId.length > 512 ||
      typeof mutation.liked !== 'boolean' ||
      !operationIdValid(mutation.operationId) ||
      typeof previousGuardPermit420 !== 'string' ||
      !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(previousGuardPermit420) ||
      previousGuardPermit420.length > 2400) {
    throw new Error('INVALID_GUARDED_LIKE_RENEW_REQUEST');
  }
  const call = httpsCallable<
    { trackId: string; liked: boolean; operationId: string; previousGuardPermit420: string },
    { ok: boolean; renewed: boolean; guardPermit420?: string }
  >(functions, 'renewExploreLikePermit420');
  const result = await call({ ...mutation, previousGuardPermit420 });
  const reply = result.data;
  if (!reply || reply.ok !== true || reply.renewed !== true ||
      typeof reply.guardPermit420 !== 'string' ||
      !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(reply.guardPermit420) ||
      reply.guardPermit420.length > 2400) {
    throw new Error('INVALID_GUARDED_LIKE_RENEW_RESPONSE');
  }
  return reply.guardPermit420;
};

// Candidate-only settlement planner. A denied Function ACK must never
// delete a newer local click that was made while the network was in flight.
// The caller must re-check this plan at the moment of its synchronous
// durable-outbox update; it is NOT permission to change canonical membership.
// Unknown/network failures keep the outbox for a bounded authoritative retry.
export type GuardedLikePending420 = {
  trackId: string;
  ownerUid: string;
  desiredLiked: boolean;
  operationId: string;
};
export type GuardedLikeDisposition420 =
  | 'ignore-superseded'
  | 'retain-unconfirmed'
  | 'retain-canonical-pending'
  | 'reject-matching-only';
export const planGuardedLikeDecision420 = (
  sent: GuardedLikeMutation420,
  latest: GuardedLikePending420 | null | undefined,
  decision: GuardedLikeDecision420 | null,
): GuardedLikeDisposition420 => {
  if (!latest || latest.trackId !== sent.trackId ||
      latest.ownerUid !== sent.ownerUid ||
      latest.desiredLiked !== sent.liked ||
      latest.operationId !== sent.operationId) return 'ignore-superseded';
  if (!decision) return 'retain-unconfirmed';
  if (decision.allowed) return 'retain-canonical-pending';
  // This is only a rejection of the private provisional SEND. An older
  // accepted canonical signal or a different device's confirmed state must
  // still win after the exact outbox intent is removed by the future caller.
  return 'reject-matching-only';
};

// Entire candidate preflight: the originating device is already painted from
// its durable outbox. A server denial is applied only to the EXACT current
// operation, with known canonical evidence; a newer click is never overwritten.
// Errors and unknown replies remain pending and MUST NOT be sent to /likes/batch.
// Called only by a future coordinated cutover after shared Rules + Worker gates.
export const submitGuardedOutboxCandidate420 = async (
  sent: GuardedOutboxEntry420,
  readCurrent: () => {
    latest: GuardedOutboxEntry420 | null;
    evidence: GuardedCanonicalEvidence420 | null;
  },
  commit: (decision: GuardedResolution420) => void,
  notifyAfterCommit: (decision: GuardedResolution420) => void,
  // Synchronously persist the exact first attempt BEFORE any network call.
  persistFirstAttempt420: (sent: GuardedOutboxEntry420) => boolean,
): Promise<GuardedResolution420> => {
  let reply: GuardedOutboxReply420 | null = null;
  try {
    if (sent.guardStatus === 'approved' || sent.guardPermit420 !== undefined) {
      // A retry of an already-approved intent MUST NOT count as a new click,
      // even if its operationId fell out of the latest 50 display events.
      // Missing/invalid original proof fails closed; never call publish().
      if (!sent.guardPermit420) throw new Error('MISSING_ORIGINAL_GUARD_PROOF');
      const freshPermit420 = await renewGuardedLikePermitCandidate420({
        trackId: sent.trackId,
        liked: sent.desiredLiked,
        operationId: sent.operationId,
      }, sent.guardPermit420);
      reply = { ok: true, allowed: true, lockedUntilMs: 0,
        guardPermit420: freshPermit420 };
    } else {
      // A missing first ACK has no signed proof to renew. After the first
      // durable send marker, hold for exact canonical/approval reconciliation.
      // Do NOT re-count the original opId as a new click after 50 events.
      if (!persistFirstAttempt420(sent)) {
        return settleGuardedOutbox420(sent, null, readCurrent, commit, notifyAfterCommit);
      }
      const marked = readCurrent().latest;
      if (!marked || marked.guardAttempt420 !== 'sent-unconfirmed' ||
          marked.uid !== sent.uid || marked.trackId !== sent.trackId ||
          marked.ownerUid !== sent.ownerUid ||
          marked.operationId !== sent.operationId ||
          marked.desiredLiked !== sent.desiredLiked ||
          marked.updatedAt !== sent.updatedAt) {
        return settleGuardedOutbox420(sent, null, readCurrent, commit, notifyAfterCommit);
      }
      const response = await publishGuardedLikeIntent420({
        trackId: sent.trackId,
        ownerUid: sent.ownerUid,
        liked: sent.desiredLiked,
        operationId: sent.operationId,
      });
      reply = { ok: true, allowed: response.allowed,
        lockedUntilMs: response.lockedUntilMs,
        ...(response.guardPermit420 ? {guardPermit420: response.guardPermit420} : {}) };
    }
  } catch {
    // No direct RTDB fallback. Canonical outbox remains durable, unapproved,
    // and unavailable to the Worker intake until an exact verified response.
  }
  return settleGuardedOutbox420(
    sent, reply, readCurrent, commit, notifyAfterCommit,
  );
};

// One listener per signed-in UID, not per card. No D1/Firestore whole-read.
// Cold replay is intentionally ignored: settled 127/canonical outbox owns
// old membership and same-account live updates are only provisional.
export const subscribeGuardedLikeIntent420 = (
  uid: string,
  onChanged: (event: GuardedLikeEvent420) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!uid || uid.length > 128) return () => {};
  let initialized = false;
  let seenVersion = 0;
  return onValue(
    databaseRef(realtimeDb, `privateLikeSync420/${uid}/display`),
    (snapshot) => {
      const raw = snapshot.val() as Partial<GuardedLikeDisplay420> | null;
      const version = Number(raw?.version || 0);
      if (!initialized) {
        initialized = true;
        seenVersion = Number.isSafeInteger(version) ? version : 0;
        return;
      }
      if (!Number.isSafeInteger(version) || version <= seenVersion ||
          !Array.isArray(raw?.results)) return;
      const previous = seenVersion;
      seenVersion = version;
      for (const row of raw.results.slice(-MAX_EVENTS)) {
        if (!isRow(row) || row.version <= previous || row.version > version) continue;
        if (Date.now() - row.at > MAX_EVENT_AGE_MS ||
            row.at > Date.now() + MAX_EVENT_AGE_MS) continue;
        onChanged(row);
      }
    },
    (error) => onError?.(error),
  );
};
