from pathlib import Path

MARKER = 'SORIDRAW_907_SESSION_READ_GUARDS'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # -------------------------------------------------------------------------
    # Music Note: the lazy wrapper exists outside the /history route lifecycle,
    # so 904's entry event must be gated by the actual pathname. Home/login must
    # never trigger the one-document Music Note read.
    # -------------------------------------------------------------------------
    old_music_note_effect = '''  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__soridrawMusicNotePageActive = true;
      window.dispatchEvent(new Event('soridraw:music-note-bundle-page-entry'));
    }

    if (!new URLSearchParams(location.search).has('note')) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
    };
  }, [location.pathname, location.search]);
'''
    new_music_note_effect = '''  useEffect(() => {
    const isMusicNoteRoute = location.pathname === '/history';
    if (!isMusicNoteRoute) {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
      return;
    }

    if (typeof window !== 'undefined') {
      (window as any).__soridrawMusicNotePageActive = true;
      window.dispatchEvent(new Event('soridraw:music-note-bundle-page-entry'));
    }

    if (!new URLSearchParams(location.search).has('note')) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
    };
  }, [location.pathname, location.search]);
'''
    app = replace_once(app, old_music_note_effect, new_music_note_effect, '907 Music Note pathname gate')

    # -------------------------------------------------------------------------
    # Recent songs: 905 intentionally changed the live listener to a one-shot
    # read, but the surrounding effect still reruns on route changes. Remember a
    # successful verification per uid for the lifetime of the SPA session so
    # re-entering Studio/recent songs is cache-only.
    # -------------------------------------------------------------------------
    marker_anchor = 'const SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING = true;\n'
    app = replace_once(
        app,
        marker_anchor,
        marker_anchor + "const recentSongsSessionVerifiedUids = new Set<string>();\nconst recentSongsSessionReadInFlightUids = new Set<string>();\n",
        '907 recent songs session guards',
    )

    read_anchor = '''    const ref = doc(db, "user_recent_songs", user.uid);
    let cancelledRecentSongsRead = false;

    void getDocFromServer(ref)
      .then((snap) => {
        if (cancelledRecentSongsRead) return;
'''
    read_replacement = '''    const ref = doc(db, "user_recent_songs", user.uid);
    let cancelledRecentSongsRead = false;

    if (recentSongsSessionVerifiedUids.has(user.uid) || recentSongsSessionReadInFlightUids.has(user.uid)) {
      markCacheDiagnostic('recentSongs', 'CACHE', 0, 0);
      return () => {};
    }
    recentSongsSessionReadInFlightUids.add(user.uid);

    void getDocFromServer(ref)
      .then((snap) => {
        recentSongsSessionReadInFlightUids.delete(user.uid);
        if (cancelledRecentSongsRead) return;
        recentSongsSessionVerifiedUids.add(user.uid);
'''
    app = replace_once(app, read_anchor, read_replacement, '907 recent songs one-read-per-session')

    catch_anchor = '''      .catch((error) => {
        if (cancelledRecentSongsRead) return;
'''
    catch_replacement = '''      .catch((error) => {
        recentSongsSessionReadInFlightUids.delete(user.uid);
        if (cancelledRecentSongsRead) return;
'''
    app = replace_once(app, catch_anchor, catch_replacement, '907 recent songs failed read retry release')

    runtime_marker_anchor = 'const SORIDRAW_906_NAVIGATION_NO_BUNDLE_WRITES = true;\n'
    if runtime_marker_anchor in app:
      app = app.replace(runtime_marker_anchor, f'const {MARKER} = true;\n' + runtime_marker_anchor, 1)
    else:
      # 906 marker lives in the helper, not necessarily App.tsx. Use 905 marker vicinity.
      app = app.replace(
          'const SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING = true;\n',
          f'const {MARKER} = true;\nconst SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING = true;\n',
          1,
      )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 907: Home Music Note read=0; recent songs one successful server read per SPA session.')
else:
    print('SORIDRAW 907 already applied.')
