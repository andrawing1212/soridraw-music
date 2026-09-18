from pathlib import Path

MARKER = 'SORIDRAW_918_FAVORITE_MUTATION_SIGNAL_ORDER_FIX'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 901 accidentally referenced `syncedFavorite` while constructing signalUid
    # before `syncedFavorite` itself was initialized. Vite/esbuild transpiles this,
    # but at runtime JS throws a TDZ ReferenceError. That single ordering bug sits
    # on every favorite mutation path:
    #   save    -> Firestore add succeeds, then signal throws
    #   unsave  -> signal throws before the Firestore update
    #   trash   -> Firestore update succeeds, then signal throws and UI rolls back
    # Build the compact favorite snapshot first, then derive signalUid from it.
    signal_anchor = """    const signalUid = String(
      syncedFavorite?.uid || song?.uid || relatedFavorites?.[0]?.uid || auth.currentUser?.uid || ''
    ).trim();
"""
    synced_decl = """    const syncedFavorite = buildFavoriteSyncSignalFavorite(action, song, relatedFavorites, at);
"""

    signal_pos = app.find(signal_anchor)
    if signal_pos < 0:
        raise SystemExit('918 signalUid anchor missing')
    original_synced_pos = app.find(synced_decl, signal_pos + len(signal_anchor))
    if original_synced_pos < 0:
        raise SystemExit('918 syncedFavorite declaration anchor missing')

    app = app[:signal_pos] + synced_decl + signal_anchor + app[signal_pos + len(signal_anchor):]
    shifted_original_pos = app.find(
        synced_decl,
        signal_pos + len(synced_decl) + len(signal_anchor),
    )
    if shifted_original_pos < 0:
        raise SystemExit('918 duplicate syncedFavorite declaration not found after reorder')
    app = app[:shifted_original_pos] + app[shifted_original_pos + len(synced_decl):]

    marker_anchor = 'const SORIDRAW_917_MUSIC_NOTE_DELTA_SYNC_NO_FULLSCAN = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        # Marker position is non-functional; keep the runtime fix even if 917's
        # marker has moved in a later compatible patch.
        first_const = app.find('const ')
        if first_const >= 0:
            app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]
        else:
            raise SystemExit('918 marker insertion anchor missing')

    # Build-time safety check: declaration must now precede the first signalUid use.
    check_signal = app.find(signal_anchor)
    check_synced = app.rfind(synced_decl, 0, check_signal)
    if check_synced < 0 or check_synced >= check_signal:
        raise SystemExit('918 ordering verification failed')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 918: favorite mutation signal initializes syncedFavorite before use; save/unsave/trash share the repaired path.')
else:
    print('SORIDRAW 918 already applied.')

apply_919 = Path('.deploy/apply-919-recent-cache-shape-fix.py')
if apply_919.exists():
    exec(compile(apply_919.read_text(encoding='utf-8'), str(apply_919), 'exec'), {'__name__': '__main__'})
