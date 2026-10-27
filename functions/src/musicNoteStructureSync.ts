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


// A whole before+after pair can exceed Firestore's 1 MiB document limit.
// Split only oversized, genuine legacy conflicts into immutable bounded parts.
// An event creates one manifest + at most 32 parts atomically; healthy writes
// still have zero recovery writes and require no additional reads.
export type LegacyRecoveryArchivePart = { id: string; payload: string };
export type LegacyRecoveryArchivePlan = {
  manifest: Record<string, unknown>;
  parts: LegacyRecoveryArchivePart[];
};
const LEGACY_RECOVERY_SINGLE_DOC_BYTES = 700_000;
const LEGACY_RECOVERY_PART_BYTES = 300_000;
export const planLegacyMusicNoteFolderRecoveryArchive = (
  payload: LegacyMusicNoteFolderRecovery & { observedAtMs: number },
): LegacyRecoveryArchivePlan => {
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') <= LEGACY_RECOVERY_SINGLE_DOC_BYTES) {
    return { manifest: payload, parts: [] };
  }
  const parts: LegacyRecoveryArchivePart[] = [];
  for (const side of ['beforeFolders', 'afterFolders'] as const) {
    for (const mode of payload.changedModes) {
      const raw = JSON.stringify(payload[side][mode] ?? null);
      let chunk = '';
      let size = 0;
      let index = 0;
      for (const character of raw) {
        const bytes = Buffer.byteLength(character, 'utf8');
        if (size + bytes > LEGACY_RECOVERY_PART_BYTES && chunk) {
          parts.push({ id: `${side}_${mode}_${index++}`, payload: chunk });
          chunk = '';
          size = 0;
        }
        chunk += character;
        size += bytes;
      }
      if (chunk) parts.push({ id: `${side}_${mode}_${index}`, payload: chunk });
    }
  }
  // Canonical user_structures is at most 1 MiB, so 32 parts is generous.
  // Never silently truncate or reduce fidelity to fit a document.
  if (parts.length > 32) throw new Error('app514 oversized recovery exceeds bounded archive parts');
  return {
    manifest: {
      schemaVersion: 2,
      source: payload.source,
      changedModes: payload.changedModes,
      beforeVersion: payload.beforeVersion,
      afterVersion: payload.afterVersion,
      observedAtMs: payload.observedAtMs,
      priorWriterToken: payload.priorWriterToken,
      partIds: parts.map(part => part.id),
    },
    parts,
  };
};
