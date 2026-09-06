from pathlib import Path

root = Path('.')

p = root / 'src/pages/FavoritesPage.tsx'
s = p.read_text()
anchor = "const getMusicNoteStructureCacheStorageKey = (uid: string) => `${MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE}_${uid}`;\n\n"
insert = r'''const projectMusicNoteStructureData = (value: any) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...(source.musicNoteFolders && typeof source.musicNoteFolders === 'object' ? { musicNoteFolders: source.musicNoteFolders } : {}),
    ...(source.myNoteFolders !== undefined ? { myNoteFolders: source.myNoteFolders } : {}),
    ...(source.sharedNoteFolders !== undefined ? { sharedNoteFolders: source.sharedNoteFolders } : {}),
    ...(source.musicNoteCardState && typeof source.musicNoteCardState === 'object' ? { musicNoteCardState: source.musicNoteCardState } : {}),
    ...(Number.isFinite(Number(source.musicNoteStructureVersion)) ? { musicNoteStructureVersion: Number(source.musicNoteStructureVersion) } : {}),
  };
};

'''
if anchor not in s:
    raise SystemExit('project anchor missing')
s = s.replace(anchor, anchor + insert, 1)
s = s.replace(
    "      publishMusicNoteStructureSession(uid, data, resolvedVersion, true);",
    "      publishMusicNoteStructureSession(uid, projectMusicNoteStructureData(data), resolvedVersion, true);",
    1,
)
p.write_text(s)

p = root / 'functions/src/musicNoteStructureSync.ts'
s = p.read_text()
s = s.replace(
    "  const beforeFolders = before?.musicNoteFolders ?? before?.myNoteFolders ?? before?.sharedNoteFolders ?? null;\n  const afterFolders = after?.musicNoteFolders ?? after?.myNoteFolders ?? after?.sharedNoteFolders ?? null;\n  if (!isDeepStrictEqual(beforeFolders, afterFolders)) return true;",
    "  const beforeFolders = {\n    musicNoteFolders: before?.musicNoteFolders ?? null,\n    myNoteFolders: before?.myNoteFolders ?? null,\n    sharedNoteFolders: before?.sharedNoteFolders ?? null,\n  };\n  const afterFolders = {\n    musicNoteFolders: after?.musicNoteFolders ?? null,\n    myNoteFolders: after?.myNoteFolders ?? null,\n    sharedNoteFolders: after?.sharedNoteFolders ?? null,\n  };\n  if (!isDeepStrictEqual(beforeFolders, afterFolders)) return true;",
    1,
)
s = s.replace(
    "  const requested = Number(after?.musicNoteStructureVersion || 0);\n  return Math.max(\n    Number.isFinite(requested) ? Math.floor(requested) : 0,\n    Number.isFinite(eventTimeMs) ? Math.floor(eventTimeMs) : 0,\n    Number.isFinite(currentVersion) ? Math.floor(currentVersion) : 0,\n  );",
    "  const requestedRaw = Number(after?.musicNoteStructureVersion || 0);\n  const requested = Number.isFinite(requestedRaw) && requestedRaw > 0 ? Math.floor(requestedRaw) : 0;\n  const eventVersion = Number.isFinite(eventTimeMs) && eventTimeMs > 0 ? Math.floor(eventTimeMs) : 0;\n  const current = Number.isFinite(currentVersion) && currentVersion > 0 ? Math.floor(currentVersion) : 0;\n  if (requested > current) return requested;\n  return Math.max(eventVersion, current + 1);",
    1,
)
p.write_text(s)

p = root / 'functions/scripts/test-music-note-structure-sync.cjs'
s = p.read_text()
s = s.replace(
    "assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 100, 110), 120, 'client mutation version wins');\nassert.equal(getMusicNoteStructureSignalVersion({}, 130, 110), 130, 'legacy client event time produces a signal');\nassert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 110, 140), 140, 'transaction never regresses current version');",
    "assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 130, 110), 120, 'fresh client mutation version is mirrored exactly');\nassert.equal(getMusicNoteStructureSignalVersion({}, 130, 110), 130, 'legacy client event time produces a signal');\nassert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 130, 140), 141, 'stale or concurrent client mutation advances the authority version');",
    1,
)
p.write_text(s)

print('1056 refinements applied')
