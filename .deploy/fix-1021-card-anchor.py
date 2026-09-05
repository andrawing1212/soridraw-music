from pathlib import Path

p = Path('.deploy/apply-1021-refresh-zero-firestore-listeners.py')
s = p.read_text(encoding='utf-8')

# Current lightweight card-state writer uses the exit-only snapshot captured
# before the async server write. Keep the patch aligned to that source.
checks = [
    ('items: current.items,', 'items: snapshot.items,', 2),
    ('updatedAtMs: current.updatedAtMs,', 'updatedAtMs: snapshot.updatedAtMs,', 2),
    ('Object.keys(current.items).length', 'Object.keys(snapshot.items).length', 1),
]
for old, new, expected in checks:
    count = s.count(old)
    if count != expected:
        raise SystemExit(f'fix-1021 card anchor {old!r}: expected {expected}, found {count}')
    s = s.replace(old, new)

old_folder_definition = r'''old_folder_write = r\'''    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: {
        [mode]: normalized.map((folder, index) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order || index + 1,
        })),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });\'''
new_folder_write = r\'''    const folderItems = normalized.map((folder, index) => ({
      id: folder.id,
      title: folder.title,
      order: folder.order || index + 1,
    }));
    const folderPatch = { musicNoteFolders: { [mode]: folderItems } };
    await runV1MutationBoundary(
      { domain: 'musicNote', operation: 'structure-update', uid: user.uid, affectedCount: folderItems.length },
      setDoc(doc(db, 'user_structures', user.uid), {
        ...folderPatch,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
    );
    patchMusicNoteStructureCache(user.uid, folderPatch);\''' '''

new_folder_definition = r'''old_folder_write = r\'''const persistMusicNoteFolders = async (
  uid: string,
  mode: FavoriteMode,
  folders: Folder[],
) => {
  await runV1MutationBoundary(
    {
      domain: 'musicNote',
      operation: 'folder-update',
      uid,
      affectedCount: Math.max(1, folders.length),
    },
    setDoc(doc(db, 'user_structures', uid), {
      musicNoteFolders: {
        [mode]: folders.map((folder) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order,
        })),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  );
};\'''
new_folder_write = r\'''const persistMusicNoteFolders = async (
  uid: string,
  mode: FavoriteMode,
  folders: Folder[],
) => {
  const folderItems = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    order: folder.order,
  }));
  await runV1MutationBoundary(
    {
      domain: 'musicNote',
      operation: 'folder-update',
      uid,
      affectedCount: Math.max(1, folders.length),
    },
    setDoc(doc(db, 'user_structures', uid), {
      musicNoteFolders: {
        [mode]: folderItems,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  );
  patchMusicNoteStructureCache(uid, {
    musicNoteFolders: {
      [mode]: folderItems,
    },
  });
};\''' '''

count = s.count(old_folder_definition)
if count != 1:
    raise SystemExit(f'fix-1021 folder definition: expected 1 stale definition, found {count}')
s = s.replace(old_folder_definition, new_folder_definition, 1)

p.write_text(s, encoding='utf-8')
print('fix-1021: card-state and current folder anchors aligned')
