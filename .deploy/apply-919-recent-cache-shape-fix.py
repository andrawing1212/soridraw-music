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

apply_920 = Path('.deploy/apply-920-firestore-runtime-audit.py')
if apply_920.exists():
    exec(compile(apply_920.read_text(encoding='utf-8'), str(apply_920), 'exec'), {'__name__': '__main__'})
