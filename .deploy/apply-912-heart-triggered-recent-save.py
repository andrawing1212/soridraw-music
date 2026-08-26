from pathlib import Path

MARKER = 'SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE'

# Step 2-A4c compatibility: keep stable mirror targets through heart-triggered commit.


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # ---------------------------------------------------------------------
    # 1) Remove the time-based save rule completely.
    # Text edits stay local (React + local cache) for as long as the user needs.
    # queueRecentSongTextWrite now means "keep the newest local working copy",
    # not "schedule a Firestore write".
    # Any edit after a heart save detaches that recent-song version from the
    # Music Note snapshot so it becomes a new, unsaved working version.
    # ---------------------------------------------------------------------
    queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit', mirrorTargets?: V1MutationMirrorTarget[]) => {
    if (!uid || !Array.isArray(songs)) return;
    recentSongTextWritePendingRef.current = { uid, songs, operation, mirrorTargets };
    if (recentSongTextWriteTimerRef.current !== null) {
      window.clearTimeout(recentSongTextWriteTimerRef.current);
    }
    recentSongTextWriteTimerRef.current = window.setTimeout(() => {
      void flushRecentSongTextWrite();
    }, 30000);
  }, [flushRecentSongTextWrite]);

  useEffect(() => {
    const handlePageHide = () => {
      void flushRecentSongTextWrite();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [flushRecentSongTextWrite]);
'''
    queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit', mirrorTargets?: V1MutationMirrorTarget[]) => {
    if (!uid || !Array.isArray(songs)) return;

    const activeIndex = historyIndexRef.current;
    let nextSongs = songs;

    if (activeIndex >= 0 && activeIndex < songs.length) {
      const detachedSong = { ...(songs[activeIndex] as any) };
      delete detachedSong.favoriteFirestoreId;
      delete detachedSong.musicNoteFavoriteId;
      detachedSong.recentFavoriteDetachedAt = Date.now();

      nextSongs = songs.map((song, index) => index === activeIndex ? detachedSong : song);
      historyRef.current = nextSongs;
      resultRef.current = detachedSong as SongResult;
      setHistory(nextSongs);
      setResult(detachedSong as SongResult);
    }

    // Local persistence only. No timer and no pagehide Firestore flush.
    recentSongsCacheRef.current = nextSongs;
    saveRecentSongsCache(uid, nextSongs);
    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation, mirrorTargets };
  }, []);
'''
    app = replace_once(app, queue_old, queue_new, '912 remove timer and keep recent edits local')

    # ---------------------------------------------------------------------
    # 2) A detached recent-song version must visually/semantically be unsaved.
    # Do not let content-based matching accidentally point it back to the old
    # Music Note snapshot.
    # ---------------------------------------------------------------------
    favorite_state_old = '''  const isSongFavorited = useCallback((song: any) => {
    if (!song) return false;
    const statusMap = favoritesStore.getStatusMap();'''
    favorite_state_new = '''  const isSongFavorited = useCallback((song: any) => {
    if (!song) return false;
    if ((song as any)?.recentFavoriteDetachedAt) return false;
    const statusMap = favoritesStore.getStatusMap();'''
    app = replace_once(app, favorite_state_old, favorite_state_new, '912 detached recent version heart-off state')

    local_lookup_old = '''    const findLocalExistingFavorite = () => {
      const latestFavorites = favoritesStore.getFavorites();'''
    local_lookup_new = '''    const findLocalExistingFavorite = () => {
      if ((song as any)?.recentFavoriteDetachedAt) return null;
      const latestFavorites = favoritesStore.getFavorites();'''
    app = replace_once(app, local_lookup_old, local_lookup_new, '912 detached recent version skips old local favorite')

    server_lookup_old = '''      const serverExistingFav = localExistingFav ? null : await findServerExistingFavorite().catch((error) => {'''
    server_lookup_new = '''      const serverExistingFav = (localExistingFav || (song as any)?.recentFavoriteDetachedAt) ? null : await findServerExistingFavorite().catch((error) => {'''
    app = replace_once(app, server_lookup_old, server_lookup_new, '912 detached recent version skips old server favorite')

    # ---------------------------------------------------------------------
    # 3) Heart is now the explicit commit boundary.
    # toggleFavorite saves/unsaves the Music Note snapshot. After that succeeds,
    # persist the same current recent-song version (plus exact favorite id) once.
    # There is no delayed second write.
    # ---------------------------------------------------------------------
    toggle_start_old = '''    setIsTogglingCurrentStudioFavorite(true);
    const favoriteToggleStartedAt = Date.now();
    const wasFavoritedBeforeToggle = isSongFavorited(snapshot);
    const currentIndex = historyIndexRef.current;'''
    toggle_start_new = '''    setIsTogglingCurrentStudioFavorite(true);
    const favoriteToggleStartedAt = Date.now();
    const currentIndex = historyIndexRef.current;'''
    app = replace_once(app, toggle_start_old, toggle_start_new, '912 defer heart-state decision until local edit detach is applied')

    toggle_call_old = '''    try {
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
    toggle_call_new = '''    try {
      const currentSongBeforeToggle = currentIndex >= 0
        ? ((historyRef.current[currentIndex] || snapshot) as any)
        : (snapshot as any);
      const wasDetachedBeforeToggle = Boolean(currentSongBeforeToggle?.recentFavoriteDetachedAt);
      const heartSnapshot = ({ ...snapshot } as any);

      if (wasDetachedBeforeToggle) {
        delete heartSnapshot.favoriteFirestoreId;
        delete heartSnapshot.musicNoteFavoriteId;
      }
      delete heartSnapshot.recentFavoriteDetachedAt;

      const wasFavoritedBeforeToggle = wasDetachedBeforeToggle
        ? false
        : isSongFavorited(heartSnapshot);

      await toggleFavorite(heartSnapshot as SongResult);

      const linkedFavorite = wasFavoritedBeforeToggle
        ? null
        : findBestMatchingFavorite(
            favoritesStore.getFavorites(),
            heartSnapshot,
            buildFavoriteIdentityKey(heartSnapshot),
          );
      const linkedFavoriteId = String(
        (linkedFavorite as any)?.firestoreId || (linkedFavorite as any)?.id || '',
      ).trim();

      if (currentIndex >= 0) {
        const currentSongAfterToggle = (historyRef.current[currentIndex] || heartSnapshot) as any;
        const nextCommittedSong = ({ ...currentSongAfterToggle } as any);
        delete nextCommittedSong.recentFavoriteDetachedAt;
        delete nextCommittedSong.musicNoteFavoriteId;

        if (wasFavoritedBeforeToggle) {
          delete nextCommittedSong.favoriteFirestoreId;
        } else if (linkedFavoriteId) {
          nextCommittedSong.favoriteFirestoreId = linkedFavoriteId;
        } else {
          delete nextCommittedSong.favoriteFirestoreId;
        }

        const nextCommittedHistory = historyRef.current.map((song, index) =>
          index === currentIndex ? (nextCommittedSong as SongResult) : song,
        );

        historyRef.current = nextCommittedHistory;
        resultRef.current = nextCommittedSong as SongResult;
        setHistory(nextCommittedHistory);
        setResult(nextCommittedSong as SongResult);

        if (user?.uid) {
          // Heart is the only Firestore commit boundary for text edits.
          // Store the recent-song bundle once with the exact post-toggle link state.
          recentSongsCacheRef.current = nextCommittedHistory;
          saveRecentSongsCache(user.uid, nextCommittedHistory);
          recentSongTextWritePendingRef.current = {
            uid: user.uid,
            songs: nextCommittedHistory,
            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',
            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),
          };
          await flushRecentSongTextWrite();
        }
      }
    } catch (error) {'''
    app = replace_once(app, toggle_call_old, toggle_call_new, '912 heart-triggered recent-song commit')

    marker_anchor = 'const SORIDRAW_911_RECENT_HEART_LINK_30S_BATCH = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        raise SystemExit('912 marker anchor missing')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 912: no timer; recent text stays local until heart, then commits once and detaches on later edits.')
else:
    print('SORIDRAW 912 already applied.')
