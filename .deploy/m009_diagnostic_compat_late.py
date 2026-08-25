from pathlib import Path


def replace_exact(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} simulator anchor mismatch: {count}')
    return source.replace(before, after, 1)


# 912 follows 910/911. Keep 2-A4b operation metadata even though 912 removes
# time-based Firestore text writes and commits the pending Recent snapshot at heart.
p = Path('.deploy/apply-912-heart-triggered-recent-save.py')
s = p.read_text(encoding='utf-8')
old_queue = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[]) => {
    if (!uid || !Array.isArray(songs)) return;
    recentSongTextWritePendingRef.current = { uid, songs };
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
new_queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {
    if (!uid || !Array.isArray(songs)) return;
    recentSongTextWritePendingRef.current = { uid, songs, operation };
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
new_queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {
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
    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };
  }, []);
'''
s = replace_exact(s, old_queue, new_queue_old, '912 old queue definition')
s = replace_exact(s, "    queue_new = '''" + new_queue_old + "'''", "    queue_new = '''" + new_queue_new + "'''", '912 new queue definition')

old_pending = '''          recentSongTextWritePendingRef.current = {
            uid: user.uid,
            songs: nextCommittedHistory,
          };
          await flushRecentSongTextWrite();'''
new_pending = '''          recentSongTextWritePendingRef.current = {
            uid: user.uid,
            songs: nextCommittedHistory,
            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',
          };
          await flushRecentSongTextWrite();'''
s = replace_exact(s, old_pending, new_pending, '912 heart pending operation')
p.write_text(s, encoding='utf-8')


# 913 removes the invalid 912 cache ref. Match the operation-aware pending shape.
p = Path('.deploy/apply-913-recent-save-runtime-fix.py')
s = p.read_text(encoding='utf-8')
s = replace_exact(
    s,
    '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    recentSongsCacheRef.current = nextSongs;\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs };''',
    '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    recentSongsCacheRef.current = nextSongs;\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };''',
    '913 edit path operation-aware anchor',
)
s = replace_exact(
    s,
    '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs };''',
    '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };''',
    '913 edit path operation-aware replacement',
)
s = replace_exact(
    s,
    '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n          };\n          await flushRecentSongTextWrite();''',
    '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };\n          await flushRecentSongTextWrite();''',
    '913 heart operation-aware old anchor',
)
s = replace_exact(
    s,
    '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n          };\n          await flushRecentSongTextWrite();''',
    '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };\n          await flushRecentSongTextWrite();''',
    '913 heart operation-aware replacement',
)
p.write_text(s, encoding='utf-8')

print('M009_LATE_COMPAT_READY=912,913')
