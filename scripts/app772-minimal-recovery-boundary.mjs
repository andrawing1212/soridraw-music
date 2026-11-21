// APP772 — OFF-only minimal recovery-window policy. No runtime wiring or I/O.
// A complete response shape is NOT a trusted live callback or a replay permit.
import {assessApp770PostAdmission} from './app770-post-admission-reconcile.mjs';

export const APP772_MINIMAL_RECOVERY_COMPILED_OPEN = false;
const permitted = Object.freeze({
  canonicalD1WriteAuthorized: false,
  repeatCanonicalWriteAuthorized: false,
  mintOperationIdAuthorized: false,
  ownerDoReserveAuthorized: false,
  relayAuthorized: false,
  mutationAuthorized: false,
  productionDeployAuthorized: false,
  activeCallbackConnected: false,
});
const hold = (reason, next = 'EXACT_OPERATION_READ_ONLY_OR_MANUAL_HOLD') =>
  Object.freeze({status: 'HOLD', reason, next, ...permitted});
const phases = new Set([
  'R2_CLAIM_ACK_UNKNOWN', 'ADMITTED_D1_RESULT_UNKNOWN',
  'D1_FAILURE_OBSERVED', 'D1_COMMITTED_ACK_LOST',
  'R2_SETTLEMENT_ACK_UNKNOWN', 'OWNER_DO_PITR',
  'EXACT_SETTLED_RECEIPT_REPLAY',
]);
const validOpId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(x);
const validUid = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const validEpoch = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x);

/**
 * Read-only policy for the minimal R2-first candidate. Only two paths can
 * describe an exact settled shape; even they authorize ZERO mutations.
 * @returns {{status: string, [key: string]: unknown}}
 */
export async function assessApp772FailureWindow({
  phase, reservation, admission, evidence, pendingFence, budget,
} = {}) {
  if (!phases.has(phase)) return hold('INVALID_FAILURE_PHASE');
  const op = reservation;
  if (!op || !validOpId(op.canonicalOperationId) ||
      !validOpId(op.cutoverToken) || !validEpoch(op.authEpoch) ||
      !validUid(op.ownerUid) || !validUid(op.actorUid) ||
      op.ownerUid === op.actorUid || typeof op.desired !== 'boolean')
    return hold('CANONICAL_OPERATION_SCOPE_UNVERIFIED');

  // No extra D1 ledger row is allowed. Even if a mock claims W2, real Writer
  // D1 meta.rows_written and every index must be checked separately in QA.
  if (budget?.source !== 'EXACT_CANONICAL_WRITER_META_772' ||
      budget.verified !== true ||
      !Number.isSafeInteger(budget.originalD1RowsWritten) ||
      budget.originalD1RowsWritten < 1 ||
      budget.originalD1RowsWritten > 2 ||
      budget.additionalD1RowsWritten !== 0 ||
      budget.fullScanAllowed !== false ||
      budget.backgroundPollingAllowed !== false)
    return hold('D1_W1_W2_OR_NO_SCAN_BUDGET_UNPROVEN');

  // A new admission can be physically conditional, yet never be called a
  // canonical write. On any uncertain phase, stop; never infer never-seen.
  if (phase === 'R2_CLAIM_ACK_UNKNOWN')
    return hold('R2_CLAIM_POSSIBLY_ACCEPTED');
  if (phase === 'ADMITTED_D1_RESULT_UNKNOWN')
    return hold('D1_COMMIT_OUTCOME_UNKNOWN');
  if (phase === 'D1_FAILURE_OBSERVED')
    return hold('D1_NOT_COMMITTED_IS_NOT_RETRY_PROOF');
  if (phase === 'R2_SETTLEMENT_ACK_UNKNOWN')
    return hold('SETTLEMENT_OR_CANONICAL_ACK_UNKNOWN');
  if (phase === 'OWNER_DO_PITR')
    return hold('EXTERNAL_OPERATION_FLOOR_AND_WRITER_CUTOVER_REQUIRED');

  // These are only *claimed* full settlement paths. First reuse APP770's
  // strict matching admission digest, D1+R2 operation ID, auth, complete
  // history, and external revision floor. A current pair snapshot fails.
  let verified;
  try {
    verified = await assessApp770PostAdmission({
      reservation: op, admission, evidence,
    });
  } catch {
    return hold('APP770_EVIDENCE_CHECK_UNAVAILABLE');
  }
  if (verified?.status !== 'OFFLINE_EXACT_SETTLED_PROOF_SHAPE_MATCHED_ONLY')
    return hold('APP770_EXACT_SETTLEMENT_UNVERIFIED');

  // No later mutation is allowed to overwrite the D1's last mutation_id
  // until this operation has exact settlement evidence. The old Writer,
  // downgraded browser and entire DO rollback must also be fenced.
  const fence = pendingFence;
  if (fence?.source !== 'TRUSTED_INDEPENDENT_PAIR_PENDING_FENCE_772' ||
      fence.verified !== true || fence.independentOfOwnerDo !== true ||
      fence.allActiveAndLegacyWritersCovered !== true ||
      fence.noLaterPairCommitBeforeSettle !== true ||
      fence.fullOwnerDoPitrCannotBypass !== true ||
      fence.userDeletionAndUidReuseReviewed !== true ||
      fence.ownerUid !== op.ownerUid ||
      fence.actorUid !== op.actorUid ||
      fence.authEpoch !== op.authEpoch ||
      fence.canonicalOperationId !== op.canonicalOperationId)
    return hold('PAIR_WRITER_PENDING_FENCE_UNVERIFIED');

  return Object.freeze({
    status: 'OFFLINE_EXACT_SETTLED_READ_ONLY_SHAPE_ONLY',
    phase,
    confirmedD1Revision: verified.confirmedD1Revision,
    confirmedR2Revision: verified.confirmedR2Revision,
    // The runtime never calls this module, and none of these proofs exist
    // as a verified active independent server callback yet.
    actualAutomaticRecoveryVerified: false,
    realD1CostPhysicallyVerified: false,
    next: 'HOLD_UNTIL_TRUSTED_BACKEND_AND_RELEASE_APPROVAL',
    ...permitted,
  });
}
