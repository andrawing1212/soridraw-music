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
