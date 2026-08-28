from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = 'const SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FILL_LAYER_962 = true;'

if marker in text:
    print('apply-962: already applied')
    raise SystemExit(0)

if 'const SORIDRAW_MUSIC_NOTE_EXIT_ONLY_CARD_STATE_SYNC_961 = true;' not in text:
    raise RuntimeError('apply-962: apply-961 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-962: anchor not found: {label}')
    text = text.replace(old, new, 1)

anchor = "  const handleTogglePersonalLike = (song: any) => {\n"
helper = r'''  const renderMusicNoteStateButtonFill = (active: boolean) => (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full"
      style={{
        background: active ? '#f7f7f7' : '#343438',
        boxShadow: active ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
      }}
    />
  );

'''
replace_once(anchor, helper + anchor, 'fill helper')

old_like = '''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
                              style={{
                                backgroundColor: isMusicNoteCardLiked(song) ? '#f7f7f7' : '#343438',
                                color: isMusicNoteCardLiked(song) ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: isMusicNoteCardLiked(song) ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}
                              title={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>'''
new_like = '''                              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all"
                              style={{ border: 'none', outline: 'none', background: 'transparent' }}
                              aria-label={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}
                              title={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}
                            >
                              {renderMusicNoteStateButtonFill(isMusicNoteCardLiked(song))}
                              <ThumbsUp
                                className="relative z-[1] h-4 w-4"
                                style={{ color: isMusicNoteCardLiked(song) ? '#252528' : 'rgba(255,255,255,0.78)' }}
                              />
                            </button>'''
replace_once(old_like, new_like, 'like button')

old_lock_shell = '''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
                              style={{
                                backgroundColor: isMusicNoteCardLocked(song) ? '#f7f7f7' : '#343438',
                                color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: isMusicNoteCardLocked(song) ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                              title={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                            >
                              <Lock className="h-4 w-4" />'''
new_lock_shell = '''                              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all"
                              style={{ border: 'none', outline: 'none', background: 'transparent' }}
                              aria-label={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                              title={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                            >
                              {renderMusicNoteStateButtonFill(isMusicNoteCardLocked(song))}
                              <Lock
                                className="relative z-[1] h-4 w-4"
                                style={{ color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.78)' }}
                              />'''
replace_once(old_lock_shell, new_lock_shell, 'lock button')

public_state = "explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'"
old_public_shell = f'''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40"
                              style={{{{
                                backgroundColor: {public_state} ? '#f7f7f7' : '#343438',
                                color: {public_state} ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: {public_state} ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}}}'''
new_public_shell = f'''                              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all disabled:cursor-wait disabled:opacity-40"
                              style={{{{ border: 'none', outline: 'none', background: 'transparent', color: {public_state} ? '#252528' : 'rgba(255,255,255,0.78)' }}}}'''
replace_once(old_public_shell, new_public_shell, 'public shell')

public_content_anchor = '''                            >
                              {explorePublicationBusySourceId === getFavoriteDocumentId(song)
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Globe2 className="h-4 w-4" />}'''
public_content_new = f'''                            >
                              {{renderMusicNoteStateButtonFill({public_state})}}
                              {{explorePublicationBusySourceId === getFavoriteDocumentId(song)
                                ? <Loader2 className="relative z-[1] h-4 w-4 animate-spin" />
                                : <Globe2 className="relative z-[1] h-4 w-4" />}}'''
replace_once(public_content_anchor, public_content_new, 'public fill + icon')

replace_once(
    'const SORIDRAW_MUSIC_NOTE_EXIT_ONLY_CARD_STATE_SYNC_961 = true;\n',
    'const SORIDRAW_MUSIC_NOTE_EXIT_ONLY_CARD_STATE_SYNC_961 = true;\nconst SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FILL_LAYER_962 = true;\n',
    '962 marker',
)

required = [
    marker,
    'renderMusicNoteStateButtonFill',
    "background: active ? '#f7f7f7' : '#343438'",
    'renderMusicNoteStateButtonFill(isMusicNoteCardLiked(song))',
    'renderMusicNoteStateButtonFill(isMusicNoteCardLocked(song))',
    f'renderMusicNoteStateButtonFill({public_state})',
    'relative z-[1] h-4 w-4',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-962 verification failed: missing {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-962: independent fill layer active; OFF dark circle / ON white circle for Like Lock Public')
