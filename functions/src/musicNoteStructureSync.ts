import { isDeepStrictEqual } from "node:util";

export const hasMusicNoteStructureRelevantChange = (before: any, after: any): boolean => {
  const beforeFolders = {
    musicNoteFolders: before?.musicNoteFolders ?? null,
    myNoteFolders: before?.myNoteFolders ?? null,
    sharedNoteFolders: before?.sharedNoteFolders ?? null,
  };
  const afterFolders = {
    musicNoteFolders: after?.musicNoteFolders ?? null,
    myNoteFolders: after?.myNoteFolders ?? null,
    sharedNoteFolders: after?.sharedNoteFolders ?? null,
  };
  if (!isDeepStrictEqual(beforeFolders, afterFolders)) return true;
  return !isDeepStrictEqual(before?.musicNoteCardState ?? null, after?.musicNoteCardState ?? null);
};

export const getMusicNoteStructureSignalVersion = (
  after: any,
  eventTimeMs: number,
  currentVersion = 0,
): number => {
  const requestedRaw = Number(after?.musicNoteStructureVersion || 0);
  const requested = Number.isFinite(requestedRaw) && requestedRaw > 0 ? Math.floor(requestedRaw) : 0;
  const eventVersion = Number.isFinite(eventTimeMs) && eventTimeMs > 0 ? Math.floor(eventTimeMs) : 0;
  const current = Number.isFinite(currentVersion) && currentVersion > 0 ? Math.floor(currentVersion) : 0;
  if (requested > current) return requested;
  return Math.max(eventVersion, current + 1);
};


// app514 staged mixed-version recovery. An older browser writes complete folder
// arrays with setDoc(merge:true) but leaves the newer browser's writer token
// untouched. Save BOTH immutable before/after mode snapshots on a real
// overwriting legacy write, never on a healthy modern commit or card-only edit.
export type LegacyMusicNoteFolderRecovery = {
  schemaVersion: 1;
  source: 'legacy-writer-after-modern';
  changedModes: Array<'myNote' | 'sharedNote'>;
  beforeFolders: Record<string, unknown>;
  afterFolders: Record<string, unknown>;
  beforeVersion: number;
  afterVersion: number;
  priorWriterToken: string;
};

export const buildLegacyMusicNoteFolderRecovery = (
  before: any,
  after: any,
): LegacyMusicNoteFolderRecovery | null => {
  const token = typeof before?.musicNoteStructureWriterToken === 'string'
    ? before.musicNoteStructureWriterToken : '';
  if (token.length < 8 || token !== after?.musicNoteStructureWriterToken) return null;
  const original = before?.musicNoteFolders;
  const next = after?.musicNoteFolders;
  if (!original || !next || typeof original !== 'object' || typeof next !== 'object') return null;
  const changedModes = (['myNote', 'sharedNote'] as const).filter(mode =>
    !isDeepStrictEqual(original[mode] ?? null, next[mode] ?? null),
  );
  if (!changedModes.length) return null;
  const beforeFolders: Record<string, unknown> = {};
  const afterFolders: Record<string, unknown> = {};
  for (const mode of changedModes) {
    beforeFolders[mode] = original[mode] ?? null;
    afterFolders[mode] = next[mode] ?? null;
  }
  return {
    schemaVersion: 1,
    source: 'legacy-writer-after-modern',
    changedModes,
    beforeFolders,
    afterFolders,
    beforeVersion: Number(before?.musicNoteStructureVersion || 0) || 0,
    afterVersion: Number(after?.musicNoteStructureVersion || 0) || 0,
    priorWriterToken: token,
  };
};

// Recovery is deliberately a read-only choice. Applying either snapshot to
// canonical Firestore must be an explicit, separately authorized operation;
// silent automatic replay could delete legitimate edits on another device.
export const chooseLegacyMusicNoteFolderRecovery = (
  recovery: LegacyMusicNoteFolderRecovery,
  choice: 'before' | 'after',
): Record<string, unknown> => {
  const folders = choice === 'before' ? recovery.beforeFolders : recovery.afterFolders;
  if (recovery.schemaVersion !== 1 || recovery.source !== 'legacy-writer-after-modern') {
    throw new Error('invalid legacy recovery record');
  }
  return JSON.parse(JSON.stringify(folders));
};
