// Pure, zero-I/O predicates for the UID-scoped recent-song catalog.
// RTDB delivery timestamps and Firestore syncVersions are intentionally not
// compared as the same source of truth. A successful snapshot is the only ACK.
export type RecentSongsGate = {
  hasLocalCache: boolean;
  profileVersion: number;
  localDocumentVersion: number;
  pendingSignalVersion: number;
  acknowledgedSignalVersion: number;
};

export const needsRecentSongsServerRead = (gate: RecentSongsGate): boolean =>
  !gate.hasLocalCache
  || gate.profileVersion > gate.localDocumentVersion
  || gate.pendingSignalVersion > gate.acknowledgedSignalVersion;

export type RecentSongsRecheck = {
  newestSignalVersion: number;
  signalVersionAtRead: number;
  acknowledgedSignalVersion: number;
};

export const needsRecentSongsSignalRecheck = (gate: RecentSongsRecheck): boolean =>
  gate.newestSignalVersion > gate.signalVersionAtRead
  && gate.newestSignalVersion > gate.acknowledgedSignalVersion;
