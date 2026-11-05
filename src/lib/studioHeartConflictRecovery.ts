import type { StudioHeartPendingIntent } from './studioHeartBatch';

// Pure decisions shared by the recovery path and the ten-song regression.
// A preview is never a canonical Firestore acknowledgement.
export const isStudioHeartRemoteSuperseded = (
  pending: Pick<StudioHeartPendingIntent, 'signalVersion' | 'pendingRemotePreviewVersion'>,
): boolean => pending.pendingRemotePreviewVersion > pending.signalVersion;

export const canRetireStudioHeartPendingFromCanonical = (
  pending: StudioHeartPendingIntent,
  canonicalVersion: number,
  canonicalSaved: boolean,
  preview?: { version: number; desiredSaved: boolean } | null,
): boolean => {
  if (!Number.isFinite(canonicalVersion) || canonicalVersion <= pending.signalVersion) return false;
  if (!isStudioHeartRemoteSuperseded(pending)) {
    return pending.desiredSaved === canonicalSaved;
  }
  const remotelyRequested = typeof pending.pendingRemotePreviewSaved === 'boolean'
    ? pending.pendingRemotePreviewSaved
    : preview?.version === pending.pendingRemotePreviewVersion
      ? preview.desiredSaved
      : null;
  // An older save can complete after a newer UNSAVE preview. Only the
  // matching, later canonical result can settle that conflict.
  return canonicalVersion > pending.pendingRemotePreviewVersion
    && typeof remotelyRequested === 'boolean'
    && remotelyRequested === canonicalSaved;
};

export const rebaseStudioHeartPendingAfterCommit = (
  latest: StudioHeartPendingIntent,
  committed: StudioHeartPendingIntent,
  confirmedFavorite: any | null,
): StudioHeartPendingIntent => ({
  ...latest,
  baselineSaved: committed.desiredSaved,
  baselineFavorite: committed.desiredSaved ? (confirmedFavorite || committed.song || null) : null,
});
