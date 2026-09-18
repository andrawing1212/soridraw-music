from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8E4_PERSONAL_LIKE_FIX_959'

if marker in text:
    print('apply-959: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_8E4_STATE_BUTTON_FILL_LIVE_LIKE_958' not in text:
    raise RuntimeError('apply-959: apply-958 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-959: anchor not found: {label}')
    text = text.replace(old, new, 1)


replace_once(
    '// SORIDRAW_EXPLORE_8E4_STATE_BUTTON_FILL_LIVE_LIKE_958',
    '// SORIDRAW_EXPLORE_8E4_STATE_BUTTON_FILL_LIVE_LIKE_958\n  ' + marker,
    '959 marker',
)

# Music Note card Like is a personal card state, not the public Explore social-like.
# Additive optional `isLiked` keeps all existing favorite documents backward compatible.
lock_anchor = '''  const handleToggleLock = async (song: any) => {
    const newLockedState = !song.isLocked;
    await updateFavorite(song.id, { isLocked: newLockedState });
'''
like_helper = '''  const handleTogglePersonalLike = async (song: any) => {
    if (!song?.id || shouldHideSunoUrlControls(song)) return;
    const newLikedState = !Boolean(song.isLiked);
    await updateFavorite(song.id, { isLiked: newLikedState });

    if (selectedSong && selectedSong.id === song.id) {
      setSelectedSong({ ...selectedSong, isLiked: newLikedState });
    }
  };

'''
if lock_anchor not in text:
    raise RuntimeError('apply-959: handleToggleLock anchor not found')
text = text.replace(lock_anchor, like_helper + lock_anchor, 1)

old_like = '''                            <button
                              data-no-card-long-press="true"
                              type="button"
                              disabled={exploreLikeBusySourceId === getFavoriteDocumentId(song)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void toggleFavoriteExploreLike(song);
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-60"
                              style={{
                                backgroundColor: isFavoriteExploreLiked(song) ? '#f7f7f7' : '#343438',
                                color: isFavoriteExploreLiked(song) ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: isFavoriteExploreLiked(song) ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={isFavoriteExploreLiked(song) ? '좋아요 취소' : '좋아요'}
                              title={isFavoriteExploreLiked(song) ? '좋아요 취소' : '좋아요'}
                            >
                              {exploreLikeBusySourceId === getFavoriteDocumentId(song)
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <ThumbsUp className="h-4 w-4" />}
                            </button>'''
new_like = '''                            <button
                              data-no-card-long-press="true"
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleTogglePersonalLike(song);
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
                              style={{
                                backgroundColor: song.isLiked ? '#f7f7f7' : '#343438',
                                color: song.isLiked ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: song.isLiked ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={song.isLiked ? '좋아요 해제' : '좋아요'}
                              title={song.isLiked ? '좋아요 해제' : '좋아요'}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>'''
replace_once(old_like, new_like, 'replace Explore social like with personal Music Note like')

required = [
    marker,
    'handleTogglePersonalLike',
    "updateFavorite(song.id, { isLiked: newLikedState })",
    "backgroundColor: song.isLiked ? '#f7f7f7' : '#343438'",
    "aria-label={song.isLiked ? '좋아요 해제' : '좋아요'}",
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-959 verification failed: missing {fragment}')

# The visible Music Note like button must no longer invoke Explore-publication gating.
state_start = text.find('soridraw-musicnote-song-state-actions')
state_end = text.find('soridraw-musicnote-song-keywords', state_start)
if state_start < 0 or state_end < 0:
    raise RuntimeError('apply-959: state button region not found')
state_region = text[state_start:state_end]
if 'toggleFavoriteExploreLike(song)' in state_region or 'exploreLikeBusySourceId' in state_region:
    raise RuntimeError('apply-959: social-like gating remains in Music Note card button')

path.write_text(text, encoding='utf-8')
print('apply-959: Music Note personal like works on every owned song; Explore social like kept separate')
