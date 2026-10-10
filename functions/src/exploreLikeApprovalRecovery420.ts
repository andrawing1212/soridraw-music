// Stage420 dormant recovery: recover EXACT server-approved first click if its
// callable ACK was lost. Bounded read of the existing max-50 RTDB display,
// NEVER publish again or change a rate counter. Records evicted from display
// are NOT proof and must stay pending (fail closed).
import type { Database } from 'firebase-admin/database';
import type { LikePrivateCommand420 } from './exploreLikeAbuseGate420';

export const LIKE_APPROVAL_RECOVERY_MAX_AGE_MS_420 = 60 * 60_000;
const operationValid = (x: LikePrivateCommand420): boolean =>
  !!x && typeof x.trackId === 'string' && x.trackId.length > 0 &&
  x.trackId.length <= 512 && typeof x.ownerUid === 'string' &&
  x.ownerUid.length <= 128 && typeof x.liked === 'boolean' &&
  typeof x.operationId === 'string' &&
  /^[0-9a-f-]{36}$/i.test(x.operationId);

export const hasExactRecentApprovedLike420 = async (
  database: Database,
  authenticatedUid: string,
  input: LikePrivateCommand420,
  nowMs = Date.now(),
): Promise<boolean> => {
  if (!authenticatedUid || authenticatedUid.length > 128 ||
      /[.#$\[\]\/]/.test(authenticatedUid) ||
      !operationValid(input) || !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error('420_APPROVAL_RECOVERY_INVALID');
  }
  // One bounded, read-only path. Do not read account collections, D1 receipts,
  // or unbounded per-operation history. No new mutation or quota event.
  const snapshot = await database.ref(
    `privateLikeSync420/${authenticatedUid}/display/results`,
  ).get();
  const rows: unknown = snapshot.val();
  if (!Array.isArray(rows) || rows.length > 50) return false;
  return rows.some((candidate): boolean => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const r = candidate as Record<string, unknown>;
    return r.operationId === input.operationId &&
      r.trackId === input.trackId && r.ownerUid === input.ownerUid &&
      r.liked === input.liked && r.status === 'pending' &&
      Number.isSafeInteger(r.at) && (r.at as number) > 0 &&
      (r.at as number) <= nowMs &&
      nowMs - (r.at as number) <= LIKE_APPROVAL_RECOVERY_MAX_AGE_MS_420;
  });
};
