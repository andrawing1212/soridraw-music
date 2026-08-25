from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact anchor, got {count}')
    return text.replace(old, new, 1)


def replace_in_region(text: str, start: str, end: str, old: str, new: str, label: str) -> str:
    start_i = text.find(start)
    if start_i < 0:
        raise SystemExit(f'{label}: start anchor missing')
    end_i = text.find(end, start_i + len(start))
    if end_i < 0:
        raise SystemExit(f'{label}: end anchor missing')
    region = text[start_i:end_i]
    count = region.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor in region, got {count}')
    region = region.replace(old, new, 1)
    return text[:start_i] + region + text[end_i:]


# ---------- App.tsx ----------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
import_line = "import { runV1MutationBoundary } from './data/v1MutationBoundary';\n"
if import_line not in app:
    app = import_line + app

# Recent Songs: every current V1 content mutation gets a metadata-only common boundary.
app = replace_in_region(
    app,
    'const clearAll = useCallback(async (options: ClearAllOptions = {}) => {',
    'const deleteHistoryItem = async (index: number) => {',
    'await setDoc(ref, { songs: [] }, { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: userRef.current.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));",
    'recent clearAll',
)
app = replace_in_region(
    app,
    'const deleteHistoryItem = async (index: number) => {',
    'const clearHistory = async () => {',
    'await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'delete-item', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true }));",
    'recent delete item',
)
app = replace_in_region(
    app,
    'const clearHistory = async () => {',
    '// Keep the in-progress Home draft when navigating away and back.',
    'await setDoc(ref, { songs: [] }, { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: user.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));",
    'recent clear history',
)
app = replace_in_region(
    app,
    'const saveRecentSongsBatch = async (newSongs: any[]) => {',
    'const saveRecentSong = async (newSong: any) => saveRecentSongsBatch([newSong]);',
    'await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'save-batch', uid: user.uid, affectedCount: newSongs.length }, setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true }));",
    'recent save batch',
)
app = replace_in_region(
    app,
    'const persistRegeneratedCurrentSong = async (nextSong: SongResult) => {',
    "const handleRegenerateCurrentSongPart = async (target: 'title' | { type: 'lyrics'; lang: LanguageCode }) => {",
    'await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    'recent regenerate',
)
app = replace_once(
    app,
    "setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true }).catch((error) => {\n              console.error('Failed to persist added lyric language:', error);\n            });",
    "runV1MutationBoundary({ domain: 'recent', operation: 'add-lyrics-language', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })).catch((error) => {\n              console.error('Failed to persist added lyric language:', error);\n            });",
    'recent add lyrics language',
)
app = replace_in_region(
    app,
    'const saveRecentSongEdit = async () => {',
    'const handleRecentSongTitleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {',
    'await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });',
    "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    'recent edit',
)
app = replace_once(
    app,
    "setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }).catch((error) => {\n          console.error('Failed to persist studio edit before favorite save:', error);\n        });",
    "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })).catch((error) => {\n          console.error('Failed to persist studio edit before favorite save:', error);\n        });",
    'recent pre-favorite edit',
)

# Music Note primary content mutations in App.tsx.
app = replace_once(
    app,
    "await updateDoc(doc(db, 'favorites', existingFav.id), { isLocked: false });",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', existingFav.id), { isLocked: false }));",
    'music note unlock before permanent delete',
)
app = replace_once(
    app,
    "await deleteDoc(doc(db, 'favorites', existingFav.id));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'permanent-delete', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1 }, deleteDoc(doc(db, 'favorites', existingFav.id)));",
    'music note permanent delete',
)
app = replace_once(
    app,
    "await updateDoc(doc(db, 'favorites', existingFav.id), sanitizeForFirestore(restoreUpdates));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'restore', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', existingFav.id), sanitizeForFirestore(restoreUpdates)));",
    'music note restore',
)

# Wrap each unsave target individually; Promise.all concurrency stays exactly as before.
unsave_pattern = re.compile(
    r"updateDoc\(doc\(db, 'favorites', targetFavorite\.id\), sanitizeForFirestore\(\{\n(?P<body>.*?)\n\s*\}\)\)",
    re.S,
)
match = unsave_pattern.search(app)
if not match:
    raise SystemExit('music note unsave target anchor missing')
original = match.group(0)
wrapped = (
    "runV1MutationBoundary({ domain: 'musicNote', operation: 'unsave', uid: user.uid, documentIds: [targetFavorite.id], affectedCount: 1 }, "
    + original
    + ")"
)
app = app[:match.start()] + wrapped + app[match.end():]

app = replace_once(
    app,
    "await updateDoc(doc(db, 'favorites', existingFav.id), unsaveUpdates);",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'unsave', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', existingFav.id), unsaveUpdates));",
    'music note unsave fallback',
)
app = replace_once(
    app,
    "const favoriteDocRef = await addDoc(collection(db, 'favorites'), favoritePayload);",
    "const favoriteDocRef = await runV1MutationBoundary({ domain: 'musicNote', operation: 'save', uid: user.uid, affectedCount: 1 }, addDoc(collection(db, 'favorites'), favoritePayload));",
    'music note save',
)
app = replace_once(
    app,
    "await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user?.uid || currentFavorite?.uid || '', documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), sanitizedUpdates));",
    'music note update',
)
app = replace_once(
    app,
    "await Promise.all(serverMatches.map((favorite) => updateDoc(doc(db, 'favorites', favorite.id), sanitizedUpdates)));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'recovery-update', uid: user?.uid || currentFavorite?.uid || '', documentIds: serverMatches.map((favorite) => favorite.id), affectedCount: serverMatches.length }, Promise.all(serverMatches.map((favorite) => updateDoc(doc(db, 'favorites', favorite.id), sanitizedUpdates))));",
    'music note recovery update',
)
app = replace_in_region(
    app,
    'const clearAllFavorites = async () => {',
    'const lockAllFavorites = async () => {',
    'await batch.commit();',
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-delete', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());",
    'music note bulk delete',
)
app = replace_in_region(
    app,
    'const lockAllFavorites = async () => {',
    'const unlockAllFavorites = async () => {',
    'await batch.commit();',
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-lock', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());",
    'music note bulk lock',
)
app = replace_in_region(
    app,
    'const unlockAllFavorites = async () => {',
    '// Scroll to top on mount',
    'await batch.commit();',
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-unlock', uid: user.uid, documentIds: lockedDocs.map((docSnap) => docSnap.id), affectedCount: lockedDocs.length }, batch.commit());",
    'music note bulk unlock',
)
app_path.write_text(app, encoding='utf-8')


# ---------- FavoritesPage.tsx ----------
fav_path = Path('src/pages/FavoritesPage.tsx')
fav = fav_path.read_text(encoding='utf-8')
fav_import = "import { runV1MutationBoundary } from '../data/v1MutationBoundary';\n"
if fav_import not in fav:
    fav = fav_import + fav
fav = replace_in_region(
    fav,
    'const commitMusicNoteFolderUpdates = async (songIds: string[], updates: Record<string, any>) => {',
    'const saveSongsToMusicNoteFolder = async (',
    'await batch.commit();',
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'folder-update', uid: user?.uid || '', documentIds: chunk, affectedCount: chunk.length }, batch.commit());",
    'music note folder update',
)
fav = replace_once(
    fav,
    "await addDoc(collection(db, 'favorites'), payload);",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'shared-note-save', uid: user?.uid || '', affectedCount: 1 }, addDoc(collection(db, 'favorites'), payload));",
    'shared music note save',
)
fav = replace_once(
    fav,
    "await Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), titleUpdates)));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'folder-rename', uid: user?.uid || '', documentIds: affectedSongs.map((song) => song.id), affectedCount: affectedSongs.length }, Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), titleUpdates))));",
    'music note folder rename',
)
fav = replace_once(
    fav,
    "await Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), fallbackUpdates)));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'folder-delete', uid: user?.uid || '', documentIds: affectedSongs.map((song) => song.id), affectedCount: affectedSongs.length }, Promise.all(affectedSongs.map((song) => updateDoc(doc(db, 'favorites', song.id), fallbackUpdates))));",
    'music note folder delete',
)
fav_path.write_text(fav, encoding='utf-8')


# ---------- SunoLibraryPage.tsx ----------
lib_path = Path('src/pages/SunoLibraryPage.tsx')
lib = lib_path.read_text(encoding='utf-8')
lib_import = "import { runV1MutationBoundary } from '../data/v1MutationBoundary';\n"
if lib_import not in lib:
    lib = lib_import + lib
old_color = """await updateDoc(doc(db, 'favorites', id), {
          favoriteColorTag: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        });"""
new_color = """await runV1MutationBoundary({ domain: 'musicNote', operation: 'color-sync', uid: user.uid, documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), {
          favoriteColorTag: color === 'gray' ? null : color,
          updatedAt: serverTimestamp()
        }));"""
lib = replace_once(lib, old_color, new_color, 'library -> music note color sync')
lib_path.write_text(lib, encoding='utf-8')

print('Step 2-A4b deterministic V1 mutation-boundary patch applied')
