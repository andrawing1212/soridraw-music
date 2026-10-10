import { onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { functions, realtimeDb } from '../firebase';

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
      !Number.isFinite(decision.lockedUntilMs)) {
    throw new Error('INVALID_GUARDED_LIKE_RESPONSE');
  }
  return decision;
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
