from pathlib import Path
import re

MARKER = 'SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


def replace_all(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count < 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # Keep the recent-songs cache path aligned with Music Note 903/904:
    # local cache first, then one explicit server document read. A persistent
    # listener is unnecessary here and causes a second read callback after the
    # same device writes the recent-songs document.
    listener_pattern = re.compile(
        r'''    const ref = doc\(db, "user_recent_songs", user\.uid\);\n'''
        r'''    const unsubscribe = onSnapshot\(\n'''
        r'''      ref,\n'''
        r'''      \(snap\) => \{\n'''
        r'''(?P<success>.*?)'''
        r'''      \},\n'''
        r'''      \(error\) => \{\n'''
        r'''(?P<failure>.*?)'''
        r'''      \}\n'''
        r'''    \);\n\n'''
        r'''    return \(\) => \{\n'''
        r'''      unsubscribe\(\);\n'''
        r'''    \};''',
        re.S,
    )
    match = listener_pattern.search(app)
    if not match:
        raise SystemExit('recent songs realtime listener anchor missing')

    success = match.group('success')
    failure = match.group('failure')
    one_shot = '''    const ref = doc(db, "user_recent_songs", user.uid);\n    let cancelledRecentSongsRead = false;\n\n    void getDocFromServer(ref)\n      .then((snap) => {\n        if (cancelledRecentSongsRead) return;\n''' + success + '''      })\n      .catch((error) => {\n        if (cancelledRecentSongsRead) return;\n''' + failure + '''      });\n\n    return () => {\n      cancelledRecentSongsRead = true;\n    };'''
    app = app[:match.start()] + one_shot + app[match.end():]

    app = app.replace(
        '// Firestore remains the source of truth and is listened to in real time on the Studio page.',
        '// Firestore remains the source of truth, but Studio verifies it with one server read instead of a persistent listener.',
        1,
    )
    app = app.replace(
        '// Keep the realtime listener limited to Studio so the cost stays bounded.',
        '// Keep the one-shot server verification limited to Studio so the cost stays bounded.',
        1,
    )

    # The save merge performs one explicit document read before its write.
    app = replace_once(
        app,
        '''      const snap = await getDoc(ref);\n      const firestoreSongs = snap.exists() ? normalizeRecentSongList(snap.data().songs || []) : [];''',
        '''      const snap = await getDoc(ref);\n      markCacheDiagnostic('recentSongs', 'SYNC', 1, 0);\n      const firestoreSongs = snap.exists() ? normalizeRecentSongList(snap.data().songs || []) : [];''',
        'recent songs merge read accounting',
    )

    # Every successful user_recent_songs document write is one Firestore write.
    app = replace_all(
        app,
        '''await setDoc(ref, { songs: [] }, { merge: true });''',
        '''await setDoc(ref, { songs: [] }, { merge: true });\n          markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);''',
        'recent songs clear write accounting',
    )
    app = replace_all(
        app,
        '''await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });''',
        '''await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });\n        markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);''',
        'recent songs delete write accounting',
    )
    app = replace_all(
        app,
        '''await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });''',
        '''await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);''',
        'recent songs generation write accounting',
    )
    app = replace_all(
        app,
        '''await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });''',
        '''await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);''',
        'recent songs edit write accounting',
    )
    app = replace_all(
        app,
        '''setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true }).catch((error) => {''',
        '''setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })\n            .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n            .catch((error) => {''',
        'recent songs async language write accounting',
    )
    app = replace_all(
        app,
        '''setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }).catch((error) => {''',
        '''setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })\n          .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n          .catch((error) => {''',
        'recent songs async studio edit write accounting',
    )

    marker_anchor = 'const SORIDRAW_904_MUSIC_NOTE_LAZY_BUNDLE_ENTRY_RUNTIME = true;\n'
    app = replace_once(
        app,
        marker_anchor,
        f'const {MARKER} = true;\n' + marker_anchor,
        '905 runtime marker',
    )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 905: recent songs cache-first one-shot read + read/write accounting.')
else:
    print('SORIDRAW 905 already applied.')
