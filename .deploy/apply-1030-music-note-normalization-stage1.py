from pathlib import Path

APP = Path('src/App.tsx')
MARKER = 'SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        raise SystemExit(f'1030 anchor not found: {label}')
    return source.replace(old, new, 1)


s = APP.read_text(encoding='utf-8')
if MARKER in s:
    print('1030 already applied')
    raise SystemExit(0)

s = replace_once(
    s,
    "const SORIDRAW_MUSIC_NOTE_CACHE_INTEGRITY_1028 = true;",
    "const SORIDRAW_MUSIC_NOTE_CACHE_INTEGRITY_1028 = true;\n"
    "const SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030 = true;",
    'normalization marker',
)

s = replace_once(
    s,
    "        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);\n"
    "        if (!musicNoteCacheNeedsFullBootstrap && hasMusicNotePayloadCache(currentUser.uid)) {",
    "        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);\n"
    "        const cachedFavoriteCount = Array.isArray(cachedFavs)\n"
    "          ? cachedFavs.filter((favorite) => !isFavoriteSoftRemoved(favorite)).length\n"
    "          : 0;\n"
    "        const cachedMusicNoteProfile = readUserProfileCache(currentUser.uid) as any;\n"
    "        const knownFavoriteCount = Math.max(\n"
    "          0,\n"
    "          Math.floor(Number(cachedMusicNoteProfile?.favoriteCount || 0) || 0),\n"
    "        );\n"
    "        const hasAnyMusicNotePayload = hasMusicNotePayloadCache(currentUser.uid);\n"
    "        // 1030 Stage 1: cache is an instant-paint layer, not proof of completeness.\n"
    "        // A tiny/under-count payload must get exactly one bounded first-page repair\n"
    "        // instead of being trusted forever and hiding the user's saved songs.\n"
    "        const musicNoteCacheNeedsBoundedVerification = !musicNoteCacheNeedsFullBootstrap\n"
    "          && hasAnyMusicNotePayload\n"
    "          && (cachedFavoriteCount < FAVORITES_PAGE_SIZE || knownFavoriteCount > cachedFavoriteCount);\n"
    "        if (!musicNoteCacheNeedsFullBootstrap && hasAnyMusicNotePayload) {",
    'cache integrity signals',
)

s = replace_once(
    s,
    "        const hasCachedMusicNote = !musicNoteCacheNeedsFullBootstrap\n"
    "          && hasMusicNotePayloadCache(currentUser.uid);",
    "        const hasCachedMusicNote = !musicNoteCacheNeedsFullBootstrap\n"
    "          && hasAnyMusicNotePayload;",
    'reuse payload signal',
)

s = replace_once(
    s,
    "          const mayHaveCachedHistory = historicalMaxCount > cachedCount || cachedCount >= FAVORITES_PAGE_SIZE;\n"
    "          favoritePaginationCursorRef.current = persistedCursor;\n"
    "          favoritePaginationExhaustedRef.current = !persistedCursor && !mayHaveCachedHistory;\n"
    "          setHasMoreFavorites(Boolean(persistedCursor) || mayHaveCachedHistory);\n"
    "          setIsFavoritesLoading(false);",
    "          const mayHaveCachedHistory = musicNoteCacheNeedsBoundedVerification\n"
    "            || knownFavoriteCount > cachedCount\n"
    "            || historicalMaxCount > cachedCount\n"
    "            || cachedCount >= FAVORITES_PAGE_SIZE;\n"
    "          favoritePaginationCursorRef.current = persistedCursor;\n"
    "          favoritePaginationExhaustedRef.current = !musicNoteCacheNeedsBoundedVerification\n"
    "            && !persistedCursor\n"
    "            && !mayHaveCachedHistory;\n"
    "          setHasMoreFavorites(Boolean(persistedCursor) || mayHaveCachedHistory);\n"
    "          if (!musicNoteCacheNeedsBoundedVerification) setIsFavoritesLoading(false);",
    'partial cache pagination state',
)

s = replace_once(
    s,
    "        const attachFavoritesSourceBootstrap902 = () => {\n"
    "          if (unsubFavs || hasCachedMusicNote || musicNoteCacheNeedsFullBootstrap) return;",
    "        const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false) => {\n"
    "          if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote) || musicNoteCacheNeedsFullBootstrap) return;",
    'bounded cached repair gate',
)

s = replace_once(
    s,
    "        const shouldVerifyMusicNoteBundle = hasCachedMusicNote && (\n"
    "          musicNoteLocalVersionAtBootstrap <= 0\n"
    "          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap\n"
    "        );\n\n"
    "        if (shouldVerifyMusicNoteBundle) {",
    "        const shouldVerifyMusicNoteBundle = hasCachedMusicNote\n"
    "          && !musicNoteCacheNeedsBoundedVerification\n"
    "          && (\n"
    "            musicNoteLocalVersionAtBootstrap <= 0\n"
    "            || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap\n"
    "          );\n\n"
    "        if (musicNoteCacheNeedsBoundedVerification) {\n"
    "          // Normalization first: one latest-page read repairs a suspicious local payload.\n"
    "          // Skip the bundle read here so this recovery never stacks two server reads.\n"
    "          attachFavoritesSourceBootstrap902(true);\n"
    "        } else if (shouldVerifyMusicNoteBundle) {",
    'direct bounded repair before bundle verification',
)

old_missing = """              if (hasCachedMusicNote) {
                scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs, {
                  limit: 20,
                  hasMore: cachedFavs.length >= 20,
                  deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
                });
                setIsFavoritesLoading(false);
                return;
              }
              attachFavoritesSourceBootstrap902();"""
new_missing = """              if (hasCachedMusicNote) {
                // 1030: page entry/cache hydration is read-only. Never publish a local
                // cache as the server bundle merely because that bundle is missing.
                // A partial cache could otherwise become the new shared bad baseline.
                markCacheDiagnostic('musicNote', 'CACHE', 0);
                setIsFavoritesLoading(false);
                return;
              }
              attachFavoritesSourceBootstrap902();"""
s = replace_once(s, old_missing, new_missing, 'remove cache-to-server bundle propagation')

APP.write_text(s, encoding='utf-8')
print('Applied 1030 Music Note normalization stage 1')
