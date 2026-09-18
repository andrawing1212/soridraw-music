from pathlib import Path

MARKER = 'SORIDRAW_911_RECENT_HEART_LINK_30S_BATCH'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 1) Frequent recent-song text edits wait for 30 seconds of inactivity.
    timer_old = '''    recentSongTextWriteTimerRef.current = window.setTimeout(() => {
      void flushRecentSongTextWrite();
    }, 10000);'''
    timer_new = '''    recentSongTextWriteTimerRef.current = window.setTimeout(() => {
      void flushRecentSongTextWrite();
    }, 30000);'''
    app = replace_once(app, timer_old, timer_new, '911 recent text 30-second debounce')

    # 2) Once a recent song is heart-saved, keep the exact favorites Firestore id
    # on the recent-song snapshot. Title/lyrics/prompt edits can then never break
    # the save/unsave relationship because toggling no longer depends on content.
    delete_id_old = '''    const favoriteDeleteId = (song as any)?.firestoreId || (song as any)?.id;'''
    delete_id_new = '''    const favoriteDeleteId = (song as any)?.favoriteFirestoreId || (song as any)?.firestoreId || (song as any)?.id;'''
    app = replace_once(app, delete_id_old, delete_id_new, '911 exact favorite id for unsave')

    favorite_state_old = '''    const statusMap = favoritesStore.getStatusMap();
    if (song.id && statusMap.has(song.id)) return true;'''
    favorite_state_new = '''    const statusMap = favoritesStore.getStatusMap();
    const linkedFavoriteId = String((song as any)?.favoriteFirestoreId || '').trim();
    if (linkedFavoriteId && statusMap.has(linkedFavoriteId)) return true;
    if (song.id && statusMap.has(song.id)) return true;'''
    app = replace_once(app, favorite_state_old, favorite_state_new, '911 linked favorite heart state')

    toggle_start_old = '''    setIsTogglingCurrentStudioFavorite(true);
    const favoriteToggleStartedAt = Date.now();
    const currentIndex = historyIndexRef.current;'''
    toggle_start_new = '''    setIsTogglingCurrentStudioFavorite(true);
    const favoriteToggleStartedAt = Date.now();
    const wasFavoritedBeforeToggle = isSongFavorited(snapshot);
    const currentIndex = historyIndexRef.current;'''
    app = replace_once(app, toggle_start_old, toggle_start_new, '911 capture heart state before toggle')

    toggle_call_old = '''    try {
      await toggleFavorite(snapshot);
    } catch (error) {'''
    toggle_call_new = '''    try {
      await toggleFavorite(snapshot);

      // Persist the exact favorite document id back into the recent-song local
      // snapshot. This update itself stays inside the same delayed recent-song
      // bundle write, so it does not add an immediate recent-song Firestore write.
      const linkedFavorite = wasFavoritedBeforeToggle
        ? null
        : findBestMatchingFavorite(
            favoritesStore.getFavorites(),
            snapshot,
            buildFavoriteIdentityKey(snapshot),
          );
      const linkedFavoriteId = String(
        (linkedFavorite as any)?.firestoreId || (linkedFavorite as any)?.id || '',
      ).trim();

      if (currentIndex >= 0) {
        const currentSongAfterToggle = (historyRef.current[currentIndex] || snapshot) as any;
        const nextLinkedSong = ({
          ...currentSongAfterToggle,
          favoriteFirestoreId: wasFavoritedBeforeToggle
            ? null
            : (linkedFavoriteId || currentSongAfterToggle.favoriteFirestoreId || null),
        } as SongResult);
        const nextLinkedHistory = historyRef.current.map((song, index) =>
          index === currentIndex ? nextLinkedSong : song,
        );
        historyRef.current = nextLinkedHistory;
        resultRef.current = nextLinkedSong;
        setHistory(nextLinkedHistory);
        setResult(nextLinkedSong);
        if (user?.uid) {
          queueRecentSongTextWrite(user.uid, nextLinkedHistory);
        }
      }
    } catch (error) {'''
    app = replace_once(app, toggle_call_old, toggle_call_new, '911 persist favorite id onto recent song')

    marker_anchor = 'const SORIDRAW_910_RECENT_TEXT_BATCH_UNSAVE_FIX = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        raise SystemExit('911 marker anchor missing')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 911: recent text waits 30s; hearts keep the exact favorite Firestore id.')
else:
    print('SORIDRAW 911 already applied.')
