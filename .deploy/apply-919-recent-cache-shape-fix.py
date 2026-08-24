from pathlib import Path

MARKER = 'SORIDRAW_919_RECENT_CACHE_PAYLOAD_SHAPE_FIX'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    old_local = '''    saveRecentSongsCache(uid, nextSongs);'''
    new_local = '''    saveRecentSongsCache(uid, {
      history: nextSongs,
      historyIndex: activeIndex,
      latestGenerationBatchId: (nextSongs[0]?.appliedKeywords as any)?.generationBatchId || null,
    });'''
    if app.count(old_local) != 1:
        raise SystemExit(f'919 local cache save anchor mismatch: {app.count(old_local)}')
    app = app.replace(old_local, new_local, 1)

    old_heart = '''          saveRecentSongsCache(user.uid, nextCommittedHistory);'''
    new_heart = '''          saveRecentSongsCache(user.uid, {
            history: nextCommittedHistory,
            historyIndex: currentIndex,
            latestGenerationBatchId: (nextCommittedHistory[0]?.appliedKeywords as any)?.generationBatchId || null,
          });'''
    if app.count(old_heart) != 1:
        raise SystemExit(f'919 heart cache save anchor mismatch: {app.count(old_heart)}')
    app = app.replace(old_heart, new_heart, 1)

    marker_anchor = 'const SORIDRAW_918_FAVORITE_MUTATION_SIGNAL_ORDER_FIX = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = app.find('const ')
        if first_const < 0:
            raise SystemExit('919 marker insertion anchor missing')
        app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]

    if 'saveRecentSongsCache(uid, nextSongs);' in app:
        raise SystemExit('919 raw local array call still present')
    if 'saveRecentSongsCache(user.uid, nextCommittedHistory);' in app:
        raise SystemExit('919 raw heart array call still present')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 919: recent-song local cache calls use the required payload object shape.')
else:
    print('SORIDRAW 919 already applied.')

apply_921_library = Path('.deploy/apply-921-library-prehardening.py')
if apply_921_library.exists():
    exec(compile(apply_921_library.read_text(encoding='utf-8'), str(apply_921_library), 'exec'), {'__name__': '__main__'})

apply_921 = Path('.deploy/apply-921-firestore-cost-hardening.py')
if apply_921.exists():
    exec(compile(apply_921.read_text(encoding='utf-8'), str(apply_921), 'exec'), {'__name__': '__main__'})

apply_922 = Path('.deploy/apply-922-no-unbounded-bootstrap.py')
if apply_922.exists():
    exec(compile(apply_922.read_text(encoding='utf-8'), str(apply_922), 'exec'), {'__name__': '__main__'})

apply_925 = Path('.deploy/apply-925-cache-live-large-source-trace.py')
if apply_925.exists():
    exec(compile(apply_925.read_text(encoding='utf-8'), str(apply_925), 'exec'), {'__name__': '__main__'})

apply_926 = Path('.deploy/apply-926-session-profile-structure-cache.py')
if apply_926.exists():
    exec(compile(apply_926.read_text(encoding='utf-8'), str(apply_926), 'exec'), {'__name__': '__main__'})

apply_927 = Path('.deploy/apply-927-monotonic-section-version-and-op-trace.py')
if apply_927.exists():
    exec(compile(apply_927.read_text(encoding='utf-8'), str(apply_927), 'exec'), {'__name__': '__main__'})

apply_928 = Path('.deploy/apply-928-cache-live-opaque.py')
if apply_928.exists():
    exec(compile(apply_928.read_text(encoding='utf-8'), str(apply_928), 'exec'), {'__name__': '__main__'})

apply_929 = Path('.deploy/apply-929-single-user-profile-source.py')
if apply_929.exists():
    exec(compile(apply_929.read_text(encoding='utf-8'), str(apply_929), 'exec'), {'__name__': '__main__'})

apply_923 = Path('.deploy/apply-923-final-firestore-guard.py')
if apply_923.exists():
    exec(compile(apply_923.read_text(encoding='utf-8'), str(apply_923), 'exec'), {'__name__': '__main__'})

apply_920 = Path('.deploy/apply-920-firestore-runtime-audit.py')
if apply_920.exists():
    exec(compile(apply_920.read_text(encoding='utf-8'), str(apply_920), 'exec'), {'__name__': '__main__'})
