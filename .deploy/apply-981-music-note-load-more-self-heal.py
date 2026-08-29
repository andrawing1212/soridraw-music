from pathlib import Path

MARKER = 'SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL'
app_path = Path('src/App.tsx')
favorites_path = Path('src/pages/FavoritesPage.tsx')
app = app_path.read_text(encoding='utf-8')
favorites = favorites_path.read_text(encoding='utf-8')

if MARKER in app and MARKER in favorites:
    print('SORIDRAW 981 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY' not in app:
    raise SystemExit('981 requires SORIDRAW 979 to run first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'981 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# A legacy 10-item cache can be perfectly valid while the current visible batch is
# 20. Server hasMore is the pagination authority; requiring a full local 20-item
# batch hides the button before the next page can ever be requested.
ui_before = '''  const canRequestMoreMusicNotePage = Boolean(
    !isMusicNoteSharedView &&
    !searchQuery.trim() &&
    favoriteColorFilter === 'all' &&
    !favoriteTrashView &&
    hasMoreFavorites &&
    filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE
  );
'''
ui_after = '''  // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL
  // Trust server pagination metadata even when this device still has a legacy
  // 10-item local cache. Filters/shared views remain intentionally excluded.
  const canRequestMoreMusicNotePage = Boolean(
    !isMusicNoteSharedView &&
    !searchQuery.trim() &&
    favoriteColorFilter === 'all' &&
    !favoriteTrashView &&
    hasMoreFavorites
  );
'''
favorites = replace_once(favorites, ui_before, ui_after, 'FavoritesPage load-more gate')

# If local cursor metadata is missing/stale at click time, recover it from the
# existing one-document Music Note bundle instead of silently returning. This is
# read-only and does not change Firestore/Auth/Functions structures or user data.
load_before = '''    if (!currentUser?.uid) return;
    if (favoritePaginationFallbackModeRef.current) return;
    if (favoritePaginationLoadingRef.current || favoritePaginationExhaustedRef.current) return;
    const cursor = favoritePaginationCursorRef.current;
    if (!cursor) return;

    favoritePaginationLoadingRef.current = true;
'''
load_after = '''    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL
    let cursor = favoritePaginationCursorRef.current;
    if (favoritePaginationFallbackModeRef.current || favoritePaginationExhaustedRef.current || !cursor) {
      try {
        const recoveryBundle = await readListBundleFromServerOnce('musicNote', currentUser.uid);
        const recoveryCursor = recoveryBundle && recoveryBundle.cursorCreatedAtMs > 0
          ? new Date(recoveryBundle.cursorCreatedAtMs)
          : null;
        if (!recoveryBundle?.hasMore || !recoveryCursor) {
          favoritePaginationExhaustedRef.current = true;
          favoritePaginationFallbackModeRef.current = false;
          setHasMoreFavorites(false);
          return;
        }
        cursor = recoveryCursor;
        favoritePaginationCursorRef.current = recoveryCursor;
        favoritePaginationExhaustedRef.current = false;
        favoritePaginationFallbackModeRef.current = false;
        setHasMoreFavorites(true);
        markCacheDiagnostic('musicNote', 'SYNC', 1);
      } catch (recoveryError) {
        console.warn('Music Note pagination metadata recovery failed; keeping retry available.', recoveryError);
        favoritePaginationExhaustedRef.current = false;
        setHasMoreFavorites(true);
        return;
      }
    }

    favoritePaginationLoadingRef.current = true;
'''
app = replace_once(app, load_before, load_after, 'loadMore early guard')

# Fetch one look-ahead document. Showing 20 remains unchanged, but the 21st result
# proves whether another page really exists instead of guessing from exactly 20.
load_start = app.index('  const loadMoreFavorites = useCallback(async () => {')
load_end = app.index('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', load_start)
load_block = app[load_start:load_end]
query_before = '''        startAfter(cursor),
        limit(FAVORITES_PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
'''
query_after = '''        startAfter(cursor),
        limit(FAVORITES_PAGE_SIZE + 1)
      );
      const snapshot = await getDocs(q);
      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
'''
load_block = replace_once(load_block, query_before, query_after, 'loadMore look-ahead query')
load_block = replace_once(
    load_block,
    '      favoritePaginationExhaustedRef.current = snapshot.docs.length < FAVORITES_PAGE_SIZE;\n',
    '      favoritePaginationExhaustedRef.current = snapshot.docs.length <= FAVORITES_PAGE_SIZE;\n',
    'loadMore hasMore calculation',
)
load_block = replace_once(
    load_block,
    '''      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
''',
    '''      // A transient/index/network failure is not proof of EOF. Keep the
      // button retryable instead of permanently hiding older Music Note pages.
      favoritePaginationExhaustedRef.current = false;
      setHasMoreFavorites(true);
''',
    'loadMore retry state',
)
app = app[:load_start] + load_block + app[load_end:]

if MARKER not in app or MARKER not in favorites:
    raise SystemExit('981 safety failed: marker missing')
if "readListBundleFromServerOnce('musicNote', currentUser.uid)" not in app:
    raise SystemExit('981 safety failed: one-document cursor recovery missing')
if 'limit(FAVORITES_PAGE_SIZE + 1)' not in app:
    raise SystemExit('981 safety failed: look-ahead pagination missing')
if 'filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE' in favorites:
    raise SystemExit('981 safety failed: legacy 20-item UI gate still present')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print('Applied SORIDRAW 981: Music Note load-more trusts hasMore, self-heals cursor metadata, and uses one-item look-ahead.')
