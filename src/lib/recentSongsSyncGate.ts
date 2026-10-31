// Pure, zero-I/O predicates for the UID-scoped recent-song catalog.
// RTDB delivery timestamps and Firestore syncVersions are intentionally not
// compared as the same source of truth. A successful snapshot is the only ACK.
export type RecentSongsGate = {
  hasLocalCache: boolean;
  profileVersion: number;
  localDocumentVersion: number;
  // Exact profile hint compared against a durably cached server document.
  verifiedProfileVersion?: number;
  pendingSignalVersion: number;
  acknowledgedSignalVersion: number;
};

export const needsRecentSongsServerRead = (gate: RecentSongsGate): boolean =>
  !gate.hasLocalCache
  || gate.profileVersion > Math.max(gate.localDocumentVersion, gate.verifiedProfileVersion || 0)
  || gate.pendingSignalVersion > gate.acknowledgedSignalVersion;

// Do not let an orphaned text-edit marker suppress the only canonical read
// when the UID's primary cache is already empty. A real local draft or
// in-memory pending song continues to outrank an older server snapshot.
export const shouldDeferRecentSongsServerReadForPendingText = (gate: {
  hasPendingMarker: boolean;
  cachedSongCount: number;
  pendingInMemorySongCount: number;
}): boolean =>
  gate.pendingInMemorySongCount > 0
  || (gate.hasPendingMarker && gate.cachedSongCount > 0);

export type RecentSongsRecheck = {
  newestSignalVersion: number;
  signalVersionAtRead: number;
  acknowledgedSignalVersion: number;
};

export const needsRecentSongsSignalRecheck = (gate: RecentSongsRecheck): boolean =>
  gate.newestSignalVersion > gate.signalVersionAtRead
  && gate.newestSignalVersion > gate.acknowledgedSignalVersion;


// A retained RTDB node is only the latest changed song, not an aggregate
// membership snapshot. Applying that one row does not prove all older
// mutations were received while this origin was closed/offline.
export type RecentSongsInlineAckGate = {
  itemApplied: boolean;
  itemPersisted: boolean;
  itemPartial: boolean;
  signalVersion: number;
  initialRetained: boolean;
};

export const canAcknowledgeRecentSongsInlineSignal = (gate: RecentSongsInlineAckGate): boolean =>
  gate.itemApplied
  && gate.itemPersisted === true
  && !gate.itemPartial
  && Number.isFinite(gate.signalVersion)
  && gate.signalVersion > 0
  && !gate.initialRetained;

/**
 * One-time read-only gap verification, separate from canonical version/ACK.
 * The last retained RTDB text draft can mask unrelated settled song changes
 * while this device was offline. A successfully read snapshot marks only this
 * signal version verified; repeated same-signal cold starts cost R0.
 */
export const needsRecentSongsRetainedDraftGapRead460 = (
  retainedDraftVersion: number,
  verifiedDraftVersion: number,
): boolean =>
  Number.isFinite(retainedDraftVersion)
  && retainedDraftVersion > 0
  && retainedDraftVersion > Math.max(0, Number(verifiedDraftVersion) || 0);
