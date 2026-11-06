import type { StudioHeartPendingIntent } from './studioHeartBatch';

// A first retained RTDB event is the last *attempted* action, not proof
// that its originating tab survived the +30s canonical settlement.
export const isUnconfirmedStudioHeartPreview = (operation: string): boolean =>
  operation === 'heart-preview-save' || operation === 'heart-preview-unsave';

export const shouldApplyStudioHeartSignalOnAttach = (
  operation: string,
  retainedOrReplayed: boolean,
): boolean => !(retainedOrReplayed && isUnconfirmedStudioHeartPreview(operation));

// A verified, newer RTDB receipt can supersede a *previously ACKed*
// local outbox from another device. Never discard a locally newer/unACKed click.
export const canStudioHeartReceiptTakeOverOlderLocal = (
  pending: Pick<StudioHeartPendingIntent, 'documentId' | 'handoffSeq'> | null,
  receipt: { documentId: string; seq: number; originDeviceId: string } | null,
  localDeviceId: string,
): boolean => Boolean(
  pending && receipt && localDeviceId
  && pending.documentId === receipt.documentId
  && Number.isSafeInteger(receipt.seq)
  && receipt.seq > 0
  && Number(pending.handoffSeq || 0) > 0
  && receipt.seq > Number(pending.handoffSeq)
  && receipt.originDeviceId !== localDeviceId
);

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
