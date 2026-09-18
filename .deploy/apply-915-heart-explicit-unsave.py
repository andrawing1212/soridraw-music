from pathlib import Path

MARKER = 'SORIDRAW_915_HEART_EXPLICIT_UNSAVE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # A filled Studio heart now carries the exact Music Note Firestore id on the
    # recent-song snapshot. The old toggle path still tried content matching
    # first, so the second click could miss that active favorite and fall through
    # to the save path again. Prefer the exact linked document before any content
    # identity lookup. This keeps the contract simple:
    # empty heart -> save, filled heart -> unsave the same favorite.
    lookup_old = '''    const findLocalExistingFavorite = () => {
      if ((song as any)?.recentFavoriteDetachedAt) return null;
      const latestFavorites = favoritesStore.getFavorites();'''
    lookup_new = '''    const findLocalExistingFavorite = () => {
      if ((song as any)?.recentFavoriteDetachedAt) return null;
      const latestFavorites = favoritesStore.getFavorites();
      const linkedFavoriteId = String((song as any)?.favoriteFirestoreId || '').trim();
      if (linkedFavoriteId) {
        const exactLinkedFavorite = latestFavorites.find((favorite: any) =>
          String(favorite?.firestoreId || favorite?.id || '').trim() === linkedFavoriteId,
        );
        if (exactLinkedFavorite) return exactLinkedFavorite;
      }'''
    app = replace_once(app, lookup_old, lookup_new, '915 exact linked favorite lookup')

    marker_anchor = 'const SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('915 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 915: filled heart resolves exact linked favorite first, so second click unsaves it.')
else:
    print('SORIDRAW 915 already applied.')
