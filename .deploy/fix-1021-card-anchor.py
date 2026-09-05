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

# The persistent Music Note card-state patch represents the complete local map.
# Replace the cached items map rather than deep-merging it, otherwise removed
# per-card state could be resurrected from an older persistent cache entry.
old_card_merge = """      items: {\n        ...((base as any)?.musicNoteCardState?.items || {}),\n        ...(patch.musicNoteCardState?.items || {}),\n      },"""
new_card_merge = """      items: patch.musicNoteCardState?.items && typeof patch.musicNoteCardState.items === 'object'\n        ? { ...patch.musicNoteCardState.items }\n        : { ...((base as any)?.musicNoteCardState?.items || {}) },"""
if s.count(old_card_merge) != 1:
    raise SystemExit(f'fix-1021 card cache merge anchor: expected 1, found {s.count(old_card_merge)}')
s = s.replace(old_card_merge, new_card_merge, 1)

# Replace only the patch-script folder definition block. The live page currently
# persists normalized folder metadata through the closure-scoped user.uid API;
# keep every existing field and timestamp semantic unchanged, then patch the
# persistent cache only after the real Firestore mutation succeeds.
start_token = "old_folder_write = r'''"
end_token = "page = replace_once(page, old_folder_write, new_folder_write, 'folder structure write')"
start = s.find(start_token)
end = s.find(end_token)
if start < 0 or end < 0 or end <= start:
    raise SystemExit(f'fix-1021 folder block not found: start={start}, end={end}')

folder_definition = '''old_folder_write = r\'''    await setDoc(doc(db, 'user_structures', user.uid), {
      musicNoteFolders: {
        [mode]: normalized.map((folder, index) => ({
          id: folder.id,
          title: folder.title,
          order: folder.order || index + 1,
          isDefault: Boolean(folder.isDefault || folder.id === 'default'),
          createdAt: folder.createdAt || Date.now(),
          updatedAt: Date.now(),
        })),
        updatedAt: Date.now(),
      },
    }, { merge: true });\'''
new_folder_write = r\'''    const folderItems = normalized.map((folder, index) => ({
      id: folder.id,
      title: folder.title,
      order: folder.order || index + 1,
      isDefault: Boolean(folder.isDefault || folder.id === 'default'),
      createdAt: folder.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));
    const folderPatch = {
      musicNoteFolders: {
        [mode]: folderItems,
        updatedAt: Date.now(),
      },
    };
    await runV1MutationBoundary(
      { domain: 'musicNote', operation: 'structure-update', uid: user.uid, affectedCount: Math.max(1, folderItems.length) },
      setDoc(doc(db, 'user_structures', user.uid), folderPatch, { merge: true }),
    );
    patchMusicNoteStructureCache(user.uid, folderPatch);\'''\n'''

s = s[:start] + folder_definition + s[end:]

# If the cheap RTDB security/control channel itself becomes unavailable, fall
# back to the existing Firestore listener immediately. Normal healthy reloads
# still stay at zero Firestore reads, while auth/admin safety is never delayed
# for the 24-hour verification lease because of an RTDB failure.
old_control_error = """          (error) => {\n            console.warn('User control revision unavailable; cached profile remains active until bounded safety verification.', error);\n            if (!readUserProfileCache(currentUser.uid)) attachUserRoleListenerFromGate();\n          },"""
new_control_error = """          (error) => {\n            console.warn('User control revision unavailable; attaching Firestore safety fallback.', error);\n            attachUserRoleListenerFromGate();\n          },"""
if s.count(old_control_error) != 1:
    raise SystemExit(f'fix-1021 control fallback anchor: expected 1, found {s.count(old_control_error)}')
s = s.replace(old_control_error, new_control_error, 1)

p.write_text(s, encoding='utf-8')
print('fix-1021: current card/folder anchors + cache deletion + auth fallback aligned')
