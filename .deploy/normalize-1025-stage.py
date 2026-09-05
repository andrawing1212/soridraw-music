from pathlib import Path

p = Path('.deploy/apply-1025-music-note-pagination-continuity.py')
s = p.read_text(encoding='utf-8')

# Current preview has the 1024 marker as a comment rather than a constant.
s = s.replace(
    '"const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;",\n    "const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;\\n"',
    '"// SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024",\n    "// SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024\\n"',
    1,
)

# Normalize every bundle hydration path away from the old timestamp-only cursor.
needle = '    "bundle cursor id",\n)\n\nload_more_pattern'
replacement = '''    "bundle cursor id",
)
# App contains another bundle-hydration path used by incremental sync. Never
# keep a timestamp-only cursor there either: recover the exact document id.
app = app.replace(bundle_old, bundle_new)
remaining_bundle_cursor = "favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;"
remaining_bundle_replacement = """favoritePaginationCursorRef.current = (() => {
        const cursorFavorite = Array.isArray(bundle.items) && bundle.items.length > 0
          ? bundle.items[bundle.items.length - 1]
          : null;
        const cursorId = String(cursorFavorite?.id || cursorFavorite?.firestoreId || '').trim();
        return bundle.hasMore && cursorId
          ? { id: cursorId, createdAtMs: Number(bundle.cursorCreatedAtMs || 0), legacy: false }
          : null;
      })();"""
app = app.replace(remaining_bundle_cursor, remaining_bundle_replacement)

load_more_pattern'''
if needle not in s:
    raise SystemExit('1025 normalizer: bundle insertion anchor missing')
s = s.replace(needle, replacement, 1)

# FavoritesPageLazy is rendered from more than one wrapper. Passing App-local
# favoriteTotalCount through the first textual occurrence caused TS2304 in the
# wrapper that does not own that state. Keep favoriteTotalCount internal to App
# for pagination termination, and let FavoritesPage read the already-cached
# user profile count for display. This adds zero Firestore reads.
write_anchor = 'APP.write_text(app, encoding="utf-8")\nFAVORITES.write_text(favorites, encoding="utf-8")'
write_replacement = '''# Do not thread App-local count state through unrelated FavoritesPage wrappers.
app = app.replace("      totalFavoritesCount={favoriteTotalCount}\\n", "")

profile_count_old = """  const musicNoteTotalCount = typeof totalFavoritesCount === 'number' && Number.isFinite(totalFavoritesCount)
    ? Math.max(Math.max(0, Math.floor(totalFavoritesCount)), favorites.length)
    : favorites.length;"""
profile_count_new = """  const cachedProfileFavoriteCount = Number(
    user?.uid ? readUserProfileCache(user.uid)?.favoriteCount : Number.NaN,
  );
  const preferredMusicNoteTotalCount = typeof totalFavoritesCount === 'number' && Number.isFinite(totalFavoritesCount)
    ? totalFavoritesCount
    : cachedProfileFavoriteCount;
  const musicNoteTotalCount = Number.isFinite(preferredMusicNoteTotalCount) && preferredMusicNoteTotalCount >= 0
    ? Math.max(Math.floor(preferredMusicNoteTotalCount), favorites.length)
    : favorites.length;"""
if profile_count_old not in favorites:
    raise SystemExit("1025 profile total-count display anchor missing")
favorites = favorites.replace(profile_count_old, profile_count_new, 1)

APP.write_text(app, encoding="utf-8")
FAVORITES.write_text(favorites, encoding="utf-8")'''
if write_anchor not in s:
    raise SystemExit('1025 normalizer: write anchor missing')
s = s.replace(write_anchor, write_replacement, 1)

# Make the staging script idempotency and final checks match the scoped design.
s = s.replace(
    'if "totalFavoritesCount={favoriteTotalCount}" not in app:\n        raise SystemExit("1025 marker exists but App.tsx is incomplete")',
    'if "cachedProfileFavoriteCount" not in favorites:\n        raise SystemExit("1025 marker exists but FavoritesPage total-count source is incomplete")',
    1,
)
s = s.replace(
    'if "totalFavoritesCount={favoriteTotalCount}" not in app:\n    raise SystemExit("1025 verification: total count prop missing")',
    'if "cachedProfileFavoriteCount" not in favorites:\n    raise SystemExit("1025 verification: cached profile total count missing")',
    1,
)

p.write_text(s, encoding='utf-8')
print('1025 staging compatibility normalized')
