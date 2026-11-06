/** Display-only agreement: a verified same-UID Music Note membership beats a
 * persisted Recent heart receipt, but never an unsettled latest click/preview.
 * No backend access, mutation, cache invalidation or canonical rewrite. */
export type StudioHeartDisplayPending = {
  desiredSaved: boolean;
  signalVersion: number;
  pendingRemotePreviewVersion: number;
};
export type StudioHeartDisplayPreview = { desiredSaved: boolean; version: number };

export const resolveStudioHeartVisibleSaved = ({
  pending,
  preview,
  catalogVerified,
  musicNoteMembership,
  recentHeartSaved,
  legacyUnsaved = false,
}: {
  pending?: StudioHeartDisplayPending | null;
  preview?: StudioHeartDisplayPreview | null;
  catalogVerified: boolean;
  musicNoteMembership: boolean;
  recentHeartSaved?: boolean | null;
  legacyUnsaved?: boolean;
}): boolean => {
  if (pending) {
    // The same existing source-order guard used by the Music Note overlay.
    // A later LOCAL click resets pendingRemotePreviewVersion, so stale remote
    // previews cannot reverse its visible state during an app update.
    if (preview && pending.pendingRemotePreviewVersion > pending.signalVersion
      && pending.pendingRemotePreviewVersion === preview.version)
      return preview.desiredSaved;
    return pending.desiredSaved;
  }
  if (preview) return preview.desiredSaved;
  if (catalogVerified) return musicNoteMembership;
  if (typeof recentHeartSaved === 'boolean') return recentHeartSaved;
  if (legacyUnsaved) return false;
  return musicNoteMembership;
};
