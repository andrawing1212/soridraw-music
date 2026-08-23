from pathlib import Path
import re

MARKER = 'SORIDRAW_910_RECENT_TEXT_BATCH_UNSAVE_FIX'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # -------------------------------------------------------------------------
    # 1) Recent-song text edits: local-first, debounce server writes.
    # Title / prompt / lyrics edits already update React state immediately. Keep
    # those local changes responsive and merge repeated text edits into one
    # user_recent_songs document write after the user stops editing briefly.
    # -------------------------------------------------------------------------
    helper_anchor = '''  const persistRegeneratedCurrentSong = async (nextSong: SongResult) => {'''
    helper = '''  const recentSongTextWriteTimerRef = useRef<number | null>(null);
  const recentSongTextWritePendingRef = useRef<{ uid: string; songs: any[] } | null>(null);

  const flushRecentSongTextWrite = useCallback(async () => {
    const pending = recentSongTextWritePendingRef.current;
    if (!pending?.uid || !Array.isArray(pending.songs)) return;

    recentSongTextWritePendingRef.current = null;
    if (recentSongTextWriteTimerRef.current !== null) {
      window.clearTimeout(recentSongTextWriteTimerRef.current);
      recentSongTextWriteTimerRef.current = null;
    }

    try {
      const ref = doc(db, "user_recent_songs", pending.uid);
      await setDoc(ref, sanitizeForFirestore({ songs: pending.songs }), { merge: true });
      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);
    } catch (error) {
      // Keep the newest pending value so a later edit/flush can retry instead of
      // dropping a locally saved text change.
      recentSongTextWritePendingRef.current = pending;
      console.error('Failed to flush batched recent-song text edits:', error);
    }
  }, []);

  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[]) => {
    if (!uid || !Array.isArray(songs)) return;
    recentSongTextWritePendingRef.current = { uid, songs };
    if (recentSongTextWriteTimerRef.current !== null) {
      window.clearTimeout(recentSongTextWriteTimerRef.current);
    }
    recentSongTextWriteTimerRef.current = window.setTimeout(() => {
      void flushRecentSongTextWrite();
    }, 10000);
  }, [flushRecentSongTextWrite]);

  useEffect(() => {
    const handlePageHide = () => {
      void flushRecentSongTextWrite();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [flushRecentSongTextWrite]);

'''
    app = replace_once(app, helper_anchor, helper + helper_anchor, '910 recent-song text batch helper')

    # Regenerated title/lyrics are also text-only changes; queue them instead of
    # writing the whole recent-song document immediately.
    regen_old = '''    if (user) {
      const ref = doc(db, "user_recent_songs", user.uid);
      await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });
      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);
    }
  };

  const handleRegenerateCurrentSongPart'''
    regen_new = '''    if (user?.uid) {
      queueRecentSongTextWrite(user.uid, nextHistory);
    }
  };

  const handleRegenerateCurrentSongPart'''
    app = replace_once(app, regen_old, regen_new, '910 regenerated recent-song text queue')

    # Manual recent-song editor save: keep local state immediate, queue one server
    # write instead of committing every title/prompt/lyrics edit separately.
    manual_pattern = re.compile(
        r'''(      recentSongsReadyToCacheRef\.current = true;\n\n)'''
        r'''      if \(user\) \{\n'''
        r'''        const ref = doc\(db, "user_recent_songs", user\.uid\);\n'''
        r'''        await setDoc\(ref, sanitizeForFirestore\(\{ songs: nextHistory \}\), \{ merge: true \}\);\n'''
        r'''        markCacheDiagnostic\('recentSongs', 'SYNC', 0, 1\);\n'''
        r'''      \}\n\n'''
        r'''(      setIsRecentSongEditOpen\(false\);)'''
    )
    manual_match = manual_pattern.search(app)
    if not manual_match:
        raise SystemExit('910 recent-song manual text save anchor missing')
    manual_replacement = (
        manual_match.group(1)
        + '''      if (user?.uid) {\n        queueRecentSongTextWrite(user.uid, nextHistory);\n      }\n\n'''
        + manual_match.group(2)
    )
    app = app[:manual_match.start()] + manual_replacement + app[manual_match.end():]

    # If the user hearts a song while an edit draft is still open, preserve the
    # same local-first batching rule. The favorite snapshot itself is still saved
    # independently by toggleFavorite, so the heart action remains safe.
    heart_pattern = re.compile(
        r'''      if \(user\) \{\n'''
        r'''        const ref = doc\(db, "user_recent_songs", user\.uid\);\n'''
        r'''        setDoc\(ref, sanitizeForFirestore\(\{ songs: nextHistory \}\), \{ merge: true \}\)\n'''
        r'''          \.then\(\(\) => markCacheDiagnostic\('recentSongs', 'SYNC', 0, 1\)\)\n'''
        r'''          \.catch\(\(error\) => \{\n'''
        r'''          console\.error\('Failed to persist studio edit before favorite save:', error\);\n'''
        r'''        \}\);\n'''
        r'''      \}'''
    )
    heart_match = heart_pattern.search(app)
    if not heart_match:
        # Accept the pre-905 formatting as a compatibility fallback.
        heart_pattern = re.compile(
            r'''      if \(user\) \{\n'''
            r'''        const ref = doc\(db, "user_recent_songs", user\.uid\);\n'''
            r'''        setDoc\(ref, sanitizeForFirestore\(\{ songs: nextHistory \}\), \{ merge: true \}\)\.catch\(\(error\) => \{\n'''
            r'''          console\.error\('Failed to persist studio edit before favorite save:', error\);\n'''
            r'''        \}\);\n'''
            r'''      \}'''
        )
        heart_match = heart_pattern.search(app)
    if not heart_match:
        raise SystemExit('910 favorite-before-save recent text anchor missing')
    app = app[:heart_match.start()] + '''      if (user?.uid) {
        queueRecentSongTextWrite(user.uid, nextHistory);
      }''' + app[heart_match.end():]

    # -------------------------------------------------------------------------
    # 2) Heart unsave: trust the exact active local favorite first.
    # The old path always queried Firestore before unsaving and preferred the
    # server candidate. If an older hidden/removed duplicate matched first, the
    # heart could restore that stale row instead of unsaving the active local row.
    # Local-first also removes unnecessary reads for the common save -> unsave flow.
    # -------------------------------------------------------------------------
    lookup_old = '''      const localExistingFav = findLocalExistingFavorite();
      const serverExistingFav = await findServerExistingFavorite().catch((error) => {
        console.warn('Favorite server confirmation failed. Using local favorite state as fallback.', error);
        return null;
      });
      const existingFav = serverExistingFav || localExistingFav;
'''
    lookup_new = '''      const localExistingFav = findLocalExistingFavorite();
      const serverExistingFav = localExistingFav ? null : await findServerExistingFavorite().catch((error) => {
        console.warn('Favorite server confirmation failed. Using local favorite state as fallback.', error);
        return null;
      });
      const existingFav = localExistingFav || serverExistingFav;
'''
    app = replace_once(app, lookup_old, lookup_new, '910 local-first favorite unsave lookup')

    marker_anchor = 'const SORIDRAW_909_MUSIC_NOTE_NO_STARTUP_WRITE = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        app = app.replace(
            'const SORIDRAW_908_MUSIC_NOTE_NO_HOME_DELTA_READ = true;\n',
            f'const {MARKER} = true;\nconst SORIDRAW_908_MUSIC_NOTE_NO_HOME_DELTA_READ = true;\n',
            1,
        )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 910: recent text edits batch to one delayed write; heart unsave is local-first.')
else:
    print('SORIDRAW 910 already applied.')
