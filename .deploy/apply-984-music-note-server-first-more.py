from pathlib import Path

MARKER = 'SORIDRAW_984_MUSIC_NOTE_SERVER_FIRST_MORE'
path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')

if MARKER in text:
    print('SORIDRAW 984 already applied; no-op')
    raise SystemExit(0)

before = '''                onClick={async (event) => {
                  event.stopPropagation();
                  if (canShowCachedMusicNoteMore) {
                    setVisibleCount(prev => prev + MUSIC_NOTE_VISIBLE_BATCH_SIZE);
                    return;
                  }
                  if (canRequestMoreMusicNotePage) {
                    await onLoadMoreFavorites?.();
                    setVisibleCount(prev => prev + MUSIC_NOTE_VISIBLE_BATCH_SIZE);
                  }
                }}
'''

after = '''                onClick={async (event) => {
                  event.stopPropagation();
                  // SORIDRAW_984_MUSIC_NOTE_SERVER_FIRST_MORE
                  // When the server says there are older pages, never reveal a stale
                  // local-cache tail first. The old order could expose a months-old
                  // cached slice and delay the canonical Firestore cursor repair until
                  // every cached row had been shown. Server pagination is authoritative.
                  if (canRequestMoreMusicNotePage) {
                    await onLoadMoreFavorites?.();
                    setVisibleCount(prev => prev + MUSIC_NOTE_VISIBLE_BATCH_SIZE);
                    return;
                  }
                  if (canShowCachedMusicNoteMore) {
                    setVisibleCount(prev => prev + MUSIC_NOTE_VISIBLE_BATCH_SIZE);
                  }
                }}
'''

count = text.count(before)
if count != 1:
    raise SystemExit(f'984 load-more click anchor mismatch: {count}')
text = text.replace(before, after, 1)

label_before = '''                {isLoadingMoreFavorites
                  ? '불러오는 중...'
                  : canShowCachedMusicNoteMore
                    ? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`
                    : musicNoteViewMode === 'noteSpace'
                      ? '더보기 (20개 더 불러오기)'
                      : '더보기'}
'''

label_after = '''                {isLoadingMoreFavorites
                  ? '불러오는 중...'
                  : canRequestMoreMusicNotePage
                    ? '더보기 (20개 더 불러오기)'
                    : canShowCachedMusicNoteMore
                      ? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`
                      : '더보기'}
'''

count = text.count(label_before)
if count != 1:
    raise SystemExit(f'984 load-more label anchor mismatch: {count}')
text = text.replace(label_before, label_after, 1)

required = [
    MARKER,
    'if (canRequestMoreMusicNotePage)',
    'if (canShowCachedMusicNoteMore)',
    "? '더보기 (20개 더 불러오기)'",
]
for fragment in required:
    if fragment not in text:
        raise SystemExit(f'984 safety failed: missing {fragment}')

path.write_text(text, encoding='utf-8')
print('Applied SORIDRAW 984: Music Note More requests canonical server page before revealing stale cached tail.')
