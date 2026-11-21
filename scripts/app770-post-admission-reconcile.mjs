// APP770 — SOURCE-ONLY, read-only post-admission evidence policy.
// Never hooks into a Worker, DO, D1, R2, Firebase or Hosting at runtime.
// A trusted production callback/complete operation ledger DOES NOT exist yet.
// Even a complete-looking proof only matches a contract; it is not a replay
// permit, recovery signal, receipt, or evidence that a backend was deployed.
export const APP770_POST_ADMISSION_COMPILED_OPEN = false;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const OP = /^[A-Za-z0-9_-]{16,128}$/;
const EPOCH = /^[a-f0-9]{32}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const revision = n => Number.isSafeInteger(n) && n >= 0;
const hold = reason => Object.freeze({
  status: 'HOLD', reason,
  retryOriginalOperationAuthorized: false,
  mintNewOperationAuthorized: false,
  canonicalD1WritesAuthorized: false,
  ownerDoReservationAuthorized: false,
  signedRelayAuthorized: false,
  productionDeployAuthorized: false,
});
const same = (proof, op) =>
  proof && proof.ownerUid === op.ownerUid &&
  proof.actorUid === op.actorUid &&
  proof.canonicalOperationId === op.canonicalOperationId &&
  proof.authEpoch === op.authEpoch &&
  proof.cutoverToken === op.cutoverToken;
const ownerSame = (proof, op) =>
  proof && proof.ownerUid === op.ownerUid &&
  proof.authEpoch === op.authEpoch;
async function admissionDigest(op) {
  const data = new TextEncoder().encode(JSON.stringify([
    op.cutoverToken, op.ownerUid, op.actorUid,
    op.authEpoch, op.canonicalOperationId,
  ]));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash, n => n.toString(16).padStart(2, '0')).join('');
}

// Read-only *shape verifier*. Arguments are trusted server evidence only in a
// FUTURE system; user input, client JSON, and a latest-state-only D1/R2 pair
// never qualify. Returning shape-matched never triggers ANY mutation.
export async function assessApp770PostAdmission({reservation, admission, evidence} = {}) {
  const op = reservation;
  if (!op || !UID.test(op.ownerUid || '') || !UID.test(op.actorUid || '') ||
      op.ownerUid === op.actorUid || !OP.test(op.canonicalOperationId || '') ||
      !EPOCH.test(op.authEpoch || '') ||
      typeof op.cutoverToken !== 'string' || op.cutoverToken.length < 16 ||
      op.cutoverToken.length > 128 ||
      !revision(op.expectedRevision) || !revision(op.priorR2Revision) ||
      typeof op.desired !== 'boolean' ||
      typeof op.beforeFollowing !== 'boolean' ||
      op.beforeFollowing === op.desired)
    return hold('RESERVATION_SCOPE_UNVERIFIED');

  // Reuses APP767's accepted conditional-PUT digest. R2 admission alone can
  // never establish D1 commit, settle, or that a request is safe to retry.
  if (admission?.status !== 'ADMISSION_ONLY_NOT_D1_COMMIT' ||
      admission?.requiresCanonicalCommitProof !== true ||
      admission?.productionDeployAuthorized !== false ||
      admission?.d1AdditionalRowsWritten !== 0 ||
      !DIGEST.test(admission?.keyDigest || ''))
    return hold('R2_ADMISSION_UNVERIFIED_OR_UNCERTAIN');
  try {
    if (admission.keyDigest !== await admissionDigest(op))
      return hold('R2_ADMISSION_DIFFERENT_OPERATION');
  } catch {
    return hold('R2_ADMISSION_HASH_UNAVAILABLE');
  }

  // Presence of an operation key, the latest pair snapshot, or an HTTP 200
  // is not a trusted history or an exact canonical commit receipt.
  const e = evidence;
  if (e?.source !== 'TRUSTED_SERVER_POST_ADMISSION_770' ||
      e.verified !== true || e.independentOfOwnerDo !== true)
    return hold('INDEPENDENT_SETTLEMENT_EVIDENCE_UNAVAILABLE');

  const auth = e.auth;
  if (auth?.source !== 'FIREBASE_VERIFIED_OWNER_AUTH_EPOCH' ||
      auth.verified !== true ||
      auth.firebaseProjectId !== 'soridraw-app-866a5' ||
      !ownerSame(auth, op))
    return hold('AUTH_EPOCH_NOT_VERIFIED');

  const cutover = e.cutover;
  if (cutover?.source !== 'SERVER_ATTESTED_COMPLETE_CUTOVER_770' ||
      cutover.verified !== true || !ownerSame(cutover, op) ||
      cutover.cutoverToken !== op.cutoverToken ||
      cutover.completeBeforeFirstAcceptedOperation !== true ||
      cutover.everyWriterCovered !== true ||
      cutover.legacyWriterCoverageProven !== true ||
      cutover.noLegacyIdNamespaceOverlap !== true ||
      cutover.userDeletionLifecycleReviewed !== true)
    return hold('COMPLETE_WRITER_CUTOVER_UNPROVEN');

  const d1 = e.d1;
  if (d1?.source !== 'EXACT_CANONICAL_D1_OPERATION_RECEIPT' ||
      d1.verified !== true || d1.committed !== true ||
      !same(d1, op) ||
      d1.expectedRevision !== op.expectedRevision ||
      d1.beforeFollowing !== op.beforeFollowing ||
      d1.following !== op.desired ||
      !revision(d1.revision) || d1.revision <= op.expectedRevision ||
      d1.immutableOperationIdProof !== true)
    return hold('EXACT_D1_OPERATION_COMMIT_UNPROVEN');

  const r2 = e.r2;
  if (r2?.source !== 'EXACT_SETTLED_OWNER_R2_OPERATION_RECEIPT' ||
      r2.verified !== true || r2.projectionSettled !== true ||
      !same(r2, op) || !revision(r2.revision) ||
      r2.revision <= op.priorR2Revision ||
      r2.d1CommittedRevision !== d1.revision ||
      r2.immutableOperationIdProof !== true)
    return hold('EXACT_R2_SETTLEMENT_UNPROVEN');

  const history = e.history;
  if (history?.source !== 'INDEPENDENT_MONOTONIC_OPERATION_LEDGER' ||
      history.verified !== true || history.independentOfOwnerDo !== true ||
      history.completeFromOrigin !== true ||
      history.everyWriterCovered !== true ||
      history.legacyWriterCoverageProven !== true ||
      history.operationStatus !== 'committed' ||
      !same(history, op) ||
      history.committedD1Revision !== d1.revision ||
      !revision(history.completeThroughRevision) ||
      history.completeThroughRevision < d1.revision)
    return hold('COMPLETE_INDEPENDENT_OPERATION_HISTORY_UNPROVEN');

  const floor = e.checkpoint;
  if (floor?.source !== 'EXTERNAL_OWNER_REVISION_FLOOR' ||
      floor.verified !== true || floor.independentOfOwnerDo !== true ||
      !ownerSame(floor, op) || !revision(floor.minD1Revision) ||
      !revision(floor.minR2Revision) ||
      floor.minD1Revision < d1.revision ||
      floor.minR2Revision < r2.revision)
    return hold('EXTERNAL_REVISION_FLOOR_UNPROVEN');

  // This is NOT a backend recovery PASS: no callback supplies such proof today.
  return Object.freeze({
    status: 'OFFLINE_EXACT_SETTLED_PROOF_SHAPE_MATCHED_ONLY',
    expectedRevision: op.expectedRevision,
    confirmedD1Revision: d1.revision,
    confirmedR2Revision: r2.revision,
    requiresOriginalDurableReceiptRecovery: true,
    runtimeCallbackConnected: false,
    actualCanonicalRecoveryVerified: false,
    retryOriginalOperationAuthorized: false,
    mintNewOperationAuthorized: false,
    canonicalD1WritesAuthorized: false,
    ownerDoReservationAuthorized: false,
    signedRelayAuthorized: false,
    productionDeployAuthorized: false,
  });
}
