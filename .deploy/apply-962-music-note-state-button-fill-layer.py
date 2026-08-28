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

# Add a component-local helper that renders the visual fill as a child layer.
# This is intentionally independent from button background-color so global button CSS cannot erase it.
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
replace_once(anchor, helper + anchor, 'fill layer helper')

# Personal Like: make button a positioning shell; fill and icon own their visual colors.
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
replace_once(old_like, new_like, 'personal like fill layer')

# Lock: 958 used song.isLocked, while 960/961 rewrote reads to isMusicNoteCardLocked(song).
old_lock = '''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
                              style={{
                                backgroundColor: isMusicNoteCardLocked(song) ? '#f7f7f7' : '#343438',
                                color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: isMusicNoteCardLocked(song) ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}
                              aria-label={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}'''
new_lock = '''                              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all"
                              style={{ border: 'none', outline: 'none', background: 'transparent' }}
                              aria-label={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}'''
replace_once(old_lock, new_lock, 'lock shell')

# Add the fill immediately after lock button open tag, before the conditional icon.
lock_icon_anchor = '''                              title={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                            >
                              {isMusicNoteCardLocked(song) ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}'''
lock_icon_new = '''                              title={isMusicNoteCardLocked(song) ? '잠금 해제' : '잠금'}
                            >
                              {renderMusicNoteStateButtonFill(isMusicNoteCardLocked(song))}
                              {isMusicNoteCardLocked(song)
                                ? <Unlock className="relative z-[1] h-4 w-4" style={{ color: '#252528' }} />
                                : <Lock className="relative z-[1] h-4 w-4" style={{ color: 'rgba(255,255,255,0.78)' }} />}'''
replace_once(lock_icon_anchor, lock_icon_new, 'lock fill + icon')

# Public: keep server/D1 state, but render its fill independently from global button CSS.
public_state = "explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'"
old_public = f'''                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-wait disabled:opacity-40"
                              style={{{{
                                backgroundColor: {public_state} ? '#f7f7f7' : '#343438',
                                color: {public_state} ? '#252528' : 'rgba(255,255,255,0.78)',
                                border: 'none',
                                outline: 'none',
                                boxShadow: {public_state} ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',
                              }}}}
                              aria-label={{{public_state} ? '공개 설정' : '공개'}}'''
new_public = f'''                              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all disabled:cursor-wait disabled:opacity-40"
                              style={{{{ border: 'none', outline: 'none', background: 'transparent' }}}}
                              aria-label={{{public_state} ? '공개 설정' : '공개'}}'''
replace_once(old_public, new_public, 'public shell')

# Public icon can be Globe2 or Lock/Unlock depending on the 956 output. Inject a fill before the first icon expression.
public_open_anchor = f'''                              title={{{public_state} ? '공개 설정' : '공개'}}
                            >'''
public_open_new = public_open_anchor + f'''\n                              {{renderMusicNoteStateButtonFill({public_state})}}'''
replace_once(public_open_anchor, public_open_new, 'public fill layer')

# Ensure any direct child public icon inherits an explicit active/inactive color by wrapping the button content.
# The fill layer is the key visual contract; existing icon color remains monochrome.

# Marker near the 961 contract.
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
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-962 verification failed: missing {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-962: state buttons use an independent child fill layer; active white / inactive dark gray')
