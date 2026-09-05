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

# Replace only the patch-script definition block. This avoids coupling the
# runner to an older FavoritesPage folder implementation.
start_token = "old_folder_write = r'''"
end_token = "page = replace_once(page, old_folder_write, new_folder_write, 'folder structure write')"
start = s.find(start_token)
end = s.find(end_token)
if start < 0 or end < 0 or end <= start:
    raise SystemExit(f'fix-1021 folder block not found: start={start}, end={end}')

folder_definition = r'''old_folder_write = r''' + "'''" + r'''const persistMusicNoteFolders = async (
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
};''' + "'''" + r'''
new_folder_write = r''' + "'''" + r'''const persistMusicNoteFolders = async (
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
};''' + "'''" + "\n"

s = s[:start] + folder_definition + s[end:]
p.write_text(s, encoding='utf-8')
print('fix-1021: card-state and current folder anchors aligned')
