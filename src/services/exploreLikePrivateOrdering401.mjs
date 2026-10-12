// app401 Stage416 same-account ordering helpers.
// These helpers are intentionally pure: no DB, no timers, no navigation IO.

const positiveSafeInt401 = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value) : 0;

export function shouldRemoteIntentSupersedeLocal401(
  local,
  observed,
  sessionStartedAt,
) {
  if (!local || !observed ||
      typeof local.operationId !== 'string' ||
      typeof observed.operationId !== 'string' ||
      local.operationId === observed.operationId) return false;

  const remoteVersion = positiveSafeInt401(observed.version);
  if (!remoteVersion) return false;

  const localIntentVersion = positiveSafeInt401(local.privateIntentVersion416);
  if (localIntentVersion) return remoteVersion > localIntentVersion;

  // app400 rows did not persist the private intent version. A live event
  // received after app401 starts can safely retire only a row that already
  // existed before this browser session. A current-session unversioned click
  // stays protected until its own RTDB transaction receipt arrives.
  const updatedAt = positiveSafeInt401(local.updatedAt);
  const startedAt = positiveSafeInt401(sessionStartedAt);
  return !!updatedAt && !!startedAt && updatedAt < startedAt;
}

export function shouldFinalReceiptSupersedeLocal401(
  local,
  receiptVersion,
  receiptRow,
) {
  if (!local || !receiptRow ||
      typeof local.operationId !== 'string' ||
      typeof receiptRow.operationId !== 'string' ||
      local.operationId === receiptRow.operationId) return false;
  if (local.privateServerRegistered416 !== true) return false;

  const localServerVersion = positiveSafeInt401(local.privateServerVersion416);
  const finalVersion = positiveSafeInt401(receiptVersion);
  return !!localServerVersion && !!finalVersion && localServerVersion < finalVersion;
}
