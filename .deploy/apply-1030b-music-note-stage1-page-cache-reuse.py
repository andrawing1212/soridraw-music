from pathlib import Path

APP = Path('src/App.tsx')
s = APP.read_text(encoding='utf-8')

if 'SORIDRAW_MUSIC_NOTE_STAGE1_PAGE_SIZED_CACHE_REUSE_1030B' in s:
    print('1030b already applied')
    raise SystemExit(0)

old_marker = 'const SORIDRAW_MUSIC_NOTE_NORMALIZATION_STAGE1_1030 = true;'
new_marker = old_marker + '\nconst SORIDRAW_MUSIC_NOTE_STAGE1_PAGE_SIZED_CACHE_REUSE_1030B = true;'
if old_marker not in s:
    raise SystemExit('1030b marker anchor missing')
s = s.replace(old_marker, new_marker, 1)

old = """        const musicNoteCacheNeedsBoundedVerification = !musicNoteCacheNeedsFullBootstrap
          && hasAnyMusicNotePayload
          && (cachedFavoriteCount < FAVORITES_PAGE_SIZE || knownFavoriteCount > cachedFavoriteCount);"""
new = """        const musicNoteCacheNeedsBoundedVerification = !musicNoteCacheNeedsFullBootstrap
          && hasAnyMusicNotePayload
          && cachedFavoriteCount < FAVORITES_PAGE_SIZE;"""
if old not in s:
    raise SystemExit('1030b bounded-verification anchor missing')
s = s.replace(old, new, 1)

old_comment = """        // A tiny/under-count payload must get exactly one bounded first-page repair
        // instead of being trusted forever and hiding the user's saved songs."""
new_comment = """        // A tiny payload must get one bounded first-page repair instead of being
        // trusted forever and hiding the user's saved songs. Once a full 20-item
        // page is cached, keep it: knownFavoriteCount only keeps More available for
        // older history and must not force the same latest 20 reads on every reload."""
if old_comment in s:
    s = s.replace(old_comment, new_comment, 1)

APP.write_text(s, encoding='utf-8')
print('Applied 1030b page-sized cache reuse guard')
