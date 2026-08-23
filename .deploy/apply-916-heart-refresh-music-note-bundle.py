from pathlib import Path

MARKER = 'SORIDRAW_916_HEART_REFRESH_MUSIC_NOTE_BUNDLE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 909/906 intentionally block generic cache-hydration writes while Music Note
    # is closed. That must not suppress a real favorite mutation: a heart save or
    # unsave changes canonical Music Note data and therefore must refresh the
    # latest-20 bundle immediately so the next /history entry is current without
    # requiring the manual full-sync button.
    toggle_old = '''      await toggleFavorite(snapshot);\n\n      // Persist the exact favorite document id back into the recent-song local'''
    toggle_new = '''      await toggleFavorite(snapshot);\n\n      // 916: this is an explicit user mutation, not navigation/cache hydration.\n      // Refresh the one-document latest-20 Music Note bundle even when /history\n      // has not been opened in this SPA session. scheduleListBundleWrite already\n      // dedupes/coalesces an identical write if the page-active path also fires.\n      if (user?.uid) {\n        const latestFavoritesForBundle = favoritesStore\n          .getFavorites()\n          .filter((favorite: any) => !isFavoriteSoftRemoved(favorite));\n        scheduleListBundleWrite('musicNote', user.uid, latestFavoritesForBundle, {\n          limit: 20,\n          hasMore: latestFavoritesForBundle.length >= 20,\n          deletedIds: Array.from(getFavoriteDeletedTombstoneIds(user.uid)),\n        });\n      }\n\n      // Persist the exact favorite document id back into the recent-song local'''
    app = replace_once(app, toggle_old, toggle_new, '916 explicit heart bundle refresh')

    marker_anchor = 'const SORIDRAW_915_HEART_EXPLICIT_UNSAVE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('916 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 916: heart save/unsave refreshes Music Note latest-20 bundle; navigation remains write-free.')
else:
    print('SORIDRAW 916 already applied.')
