from pathlib import Path

APP = Path('src/App.tsx')
s = APP.read_text(encoding='utf-8')

MARKER = 'SORIDRAW_MUSIC_NOTE_CLEAN_BOOTSTRAP_LEGACY_AXIS_1031'
if MARKER in s:
    print('1031 already applied')
    raise SystemExit(0)

old_marker = 'const SORIDRAW_MUSIC_NOTE_STAGE1_PAGE_SIZED_CACHE_REUSE_1030B = true;'
new_marker = old_marker + '\nconst SORIDRAW_MUSIC_NOTE_CLEAN_BOOTSTRAP_LEGACY_AXIS_1031 = true;'
if old_marker not in s:
    raise SystemExit('1031 marker anchor missing')
s = s.replace(old_marker, new_marker, 1)

old_condition = """        const musicNoteCacheNeedsBoundedVerification = !musicNoteCacheNeedsFullBootstrap
          && hasAnyMusicNotePayload
          && cachedFavoriteCount < FAVORITES_PAGE_SIZE;"""
new_condition = """        const musicNoteCacheNeedsBoundedVerification = musicNoteCacheNeedsFullBootstrap
          || (hasAnyMusicNotePayload && cachedFavoriteCount < FAVORITES_PAGE_SIZE);"""
if old_condition not in s:
    raise SystemExit('1031 verification condition anchor missing')
s = s.replace(old_condition, new_condition, 1)

old_gate = """        const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false) => {
          if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote) || musicNoteCacheNeedsFullBootstrap) return;"""
new_gate = """        const attachFavoritesSourceBootstrap902 = (allowCachedRepair = false) => {
          // 1031: a clean browser has no valid Music Note payload. That state must
          // be allowed to perform exactly one bounded first-page bootstrap.
          if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote)) return;"""
if old_gate not in s:
    raise SystemExit('1031 bootstrap gate anchor missing')
s = s.replace(old_gate, new_gate, 1)

# 1026 moved the Music Note first page to createdAtMs. Firestore orderBy excludes
# documents that do not contain that field, so legacy favorites disappeared from
# a clean browser. Use createdAt, which exists on old and new favorites, without
# any migration or collection scan.
fetch_start = s.index('// Fetch favorites for the user.')
load_start = s.index('  const loadMoreFavorites = useCallback(async () => {', fetch_start)
first_page_region = s[fetch_start:load_start]
first_page_count = first_page_region.count("orderBy('createdAtMs', 'desc')")
if first_page_count < 1:
    raise SystemExit('1031 no createdAtMs first-page query found')
first_page_region = first_page_region.replace("orderBy('createdAtMs', 'desc')", "orderBy('createdAt', 'desc')")
s = s[:fetch_start] + first_page_region + s[load_start:]

cursor_old = """    let cursorMs = cursorValue instanceof Date
      ? cursorValue.getTime()
      : Number(cursorData?.createdAtMs || cursorValue?.createdAtMs || 0);"""
cursor_new = """    let cursorMs = cursorValue instanceof Date
      ? cursorValue.getTime()
      : Number(cursorData?.createdAtMs || cursorValue?.createdAtMs || 0)
        || getTimestampMs(cursorData?.createdAt)
        || getTimestampMs(cursorValue?.createdAt);"""
if cursor_old not in s:
    raise SystemExit('1031 cursor fallback anchor missing')
s = s.replace(cursor_old, cursor_new, 1)

more_old = """        where('uid', '==', uid),
        orderBy('createdAtMs', 'desc'),
        startAfter(cursorMs),
        limit(FAVORITES_PAGE_SIZE),"""
more_new = """        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        startAfter(new Date(cursorMs)),
        limit(FAVORITES_PAGE_SIZE),"""
if more_old not in s:
    raise SystemExit('1031 More query anchor missing')
s = s.replace(more_old, more_new, 1)

if 'if (unsubFavs || (!allowCachedRepair && hasCachedMusicNote) || musicNoteCacheNeedsFullBootstrap) return;' in s:
    raise SystemExit('1031 clean bootstrap is still blocked')
if "const musicNoteCacheNeedsBoundedVerification = musicNoteCacheNeedsFullBootstrap" not in s:
    raise SystemExit('1031 clean bootstrap condition missing')

fetch_start = s.index('// Fetch favorites for the user.')
load_start = s.index('  const loadMoreFavorites = useCallback(async () => {', fetch_start)
first_page_region = s[fetch_start:load_start]
if "orderBy('createdAtMs', 'desc')" in first_page_region:
    raise SystemExit('1031 createdAtMs-only query remains in first-page region')
if "orderBy('createdAt', 'desc')" not in first_page_region or 'limit(FAVORITES_PAGE_SIZE)' not in first_page_region:
    raise SystemExit('1031 bounded legacy-safe first page missing')

le = s.index('  const syncMusicNoteIncrementalFromRemoteVersion', load_start)
block = s[load_start:le]
if block.count('await getDocs(') != 1:
    raise SystemExit(f'1031 More getDocs count {block.count("await getDocs(")}')
if 'while (' in block or 'maxScanPages' in block or 'loadCompatibilityTail' in block:
    raise SystemExit('1031 More scanner regression')
if "orderBy('createdAt', 'desc')" not in block or 'startAfter(new Date(cursorMs))' not in block:
    raise SystemExit('1031 legacy-safe More axis missing')

APP.write_text(s, encoding='utf-8')
print(f'MUSIC_NOTE_1031_CLEAN_BOOTSTRAP_LEGACY_AXIS=PASS first_page_queries={first_page_count}')
