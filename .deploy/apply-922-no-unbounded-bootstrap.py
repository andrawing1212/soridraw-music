from pathlib import Path

MARKER = 'SORIDRAW_922_NO_UNBOUNDED_BOOTSTRAP_READS'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    old = '''            const favsSnap = await getDocs(
              query(collection(db, 'favorites'), where('uid', '==', currentUser.uid))
            );
            const songsSnap = await getDoc(doc(db, 'user_recent_songs', currentUser.uid));
            const songCount = songsSnap.exists() ? (songsSnap.data().songs?.length || 0) : 0;
            await setDoc(userRef, {'''
    new = '''            // 922: missing-profile recovery must never full-scan favorites.
            // Use the account-scoped local cache as a safe approximate seed; normal
            // favorite mutations keep the count current after the profile exists.
            const cachedFavoritesForProfile = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);
            const recoveredFavoriteCount = Array.isArray(cachedFavoritesForProfile)
              ? cachedFavoritesForProfile.filter((favorite) => !isFavoriteSoftRemoved(favorite)).length
              : 0;
            const songsSnap = await getDoc(doc(db, 'user_recent_songs', currentUser.uid));
            const songCount = songsSnap.exists() ? (songsSnap.data().songs?.length || 0) : 0;
            await setDoc(userRef, {'''
    if app.count(old) != 1:
        raise SystemExit(f'922 missing-user favorites scan anchor mismatch: {app.count(old)}')
    app = app.replace(old, new, 1)
    app = app.replace('              favoriteCount: favsSnap.size,', '              favoriteCount: recoveredFavoriteCount,', 1)

    marker_anchor = 'const SORIDRAW_921_FIRESTORE_COST_HARDENING = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = app.find('const ')
        app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]
    app_path.write_text(app, encoding='utf-8')

library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    old_query = '''      const q = query(
        collectionGroup(db, 'tracks'),
        where('isPublic', '==', true)
      );'''
    new_query = '''      const q = query(
        collectionGroup(db, 'tracks'),
        where('isPublic', '==', true),
        limit(50)
      );'''
    if old_query in library:
        library = library.replace(old_query, new_query, 1)
    marker_anchor = 'const SORIDRAW_921_FIRESTORE_COST_HARDENING = true;\n'
    if marker_anchor in library:
        library = library.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = library.find('const ')
        library = library[:first_const] + f'const {MARKER} = true;\n' + library[first_const:]
    library_path.write_text(library, encoding='utf-8')

print('Applied SORIDRAW 922: missing-user recovery and shared-track fallback cannot full-scan automatically.')
