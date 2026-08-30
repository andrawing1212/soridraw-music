from pathlib import Path

page_path = Path('src/pages/FavoritesPage.tsx')
css_path = Path('src/index.css')
text = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963'

if marker in text and marker in css:
    print('apply-963: already applied')
    raise SystemExit(0)

if 'const SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FILL_LAYER_962 = true;' not in text:
    raise RuntimeError('apply-963: apply-962 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-963: anchor not found: {label}')
    text = text.replace(old, new, 1)

# OFF only gets darker. ON stays the same white fill.
replace_once(
    "background: active ? '#f7f7f7' : '#343438',",
    "background: active ? '#f7f7f7' : '#29292d',",
    'darker inactive button fill',
)

# Like: active icon becomes a solid filled glyph instead of an outline.
replace_once(
    '''                              <ThumbsUp
                                className="relative z-[1] h-4 w-4"
                                style={{ color: isMusicNoteCardLiked(song) ? '#252528' : 'rgba(255,255,255,0.78)' }}
                              />''',
    '''                              <ThumbsUp
                                className="relative z-[1] h-4 w-4"
                                fill={isMusicNoteCardLiked(song) ? 'currentColor' : 'none'}
                                strokeWidth={isMusicNoteCardLiked(song) ? 1.7 : 2}
                                style={{ color: isMusicNoteCardLiked(song) ? '#252528' : 'rgba(255,255,255,0.68)' }}
                              />''',
    'filled active like icon',
)

# Lock: active icon also becomes a solid glyph.
replace_once(
    '''                              <Lock
                                className="relative z-[1] h-4 w-4"
                                style={{ color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.78)' }}
                              />''',
    '''                              <Lock
                                className="relative z-[1] h-4 w-4"
                                fill={isMusicNoteCardLocked(song) ? 'currentColor' : 'none'}
                                strokeWidth={isMusicNoteCardLocked(song) ? 1.7 : 2}
                                style={{ color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.68)' }}
                              />''',
    'filled active lock icon',
)

public_state = "explorePublicationStateBySongId[getFavoriteDocumentId(song)]?.status === 'public'"
old_public = '''                              {explorePublicationBusyId === getFavoriteDocumentId(song)
                                ? <Loader2 className="relative z-[1] h-4 w-4 animate-spin" />
                                : <Globe2 className="relative z-[1] h-4 w-4" />}'''
new_public = f'''                              {{explorePublicationBusyId === getFavoriteDocumentId(song)
                                ? <Loader2 className="relative z-[1] h-4 w-4 animate-spin" />
                                : {public_state}
                                  ? (
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 24 24"
                                      className="relative z-[1] h-[17px] w-[17px]"
                                    >
                                      <circle cx="12" cy="12" r="8.7" fill="#252528" />
                                      <path d="M6.1 9.2c1.15-2.18 3.04-3.72 5.2-4.18l.62 1.55-1.34 1.14.16 1.58-1.42.7-.7 1.56-1.7-.18-.82-2.17Z" fill="#f7f7f7" />
                                      <path d="M13.15 8.1l1.7-.58 2.14 1.13.24 1.48 1.5.92-.2 1.54-1.46.45-.5 1.8-1.25.5-1.18-1.08.35-1.48-1.38-1.1.04-3.58Z" fill="#f7f7f7" />
                                      <path d="M9.35 14.18l1.55-.6 1.28.76-.14 1.48 1.06.86-.88 1.74-1.76.28-1.12-1.1-1.2-.48.22-1.52.99-1.42Z" fill="#f7f7f7" />
                                    </svg>
                                  )
                                  : <Globe2 className="relative z-[1] h-4 w-4" style={{{{ color: 'rgba(255,255,255,0.68)' }}}} />}}'''
replace_once(old_public, new_public, 'filled active public globe')

replace_once(
    'const SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FILL_LAYER_962 = true;\n',
    'const SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FILL_LAYER_962 = true;\n  ' + marker + '\n',
    '963 page marker',
)

css_block = r'''

/* SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963
   Music Note applied keywords are metadata text, not controls: remove chip fills/borders
   and lower their contrast. State buttons keep white ON fills, darker OFF fills. */
.soridraw-musicnote-song-keywords {
  gap: 0.38rem !important;
}
.soridraw-musicnote-song-keywords > :is(button, span, div) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  color: rgba(255, 255, 255, 0.43) !important;
  padding-left: 0.08rem !important;
  padding-right: 0.08rem !important;
}
.soridraw-musicnote-song-keywords > :is(button, span, div):is(:hover, :active, :focus, :focus-visible) {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  color: rgba(255, 255, 255, 0.52) !important;
}
html[data-soridraw-color-mode="light"] .soridraw-musicnote-song-keywords > :is(button, span, div),
html:not(.dark) .soridraw-musicnote-song-keywords > :is(button, span, div) {
  color: rgba(30, 30, 32, 0.48) !important;
}
'''
if '/* SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963' not in css:
    css += css_block

required_page = [
    marker,
    "background: active ? '#f7f7f7' : '#29292d'",
    "fill={isMusicNoteCardLiked(song) ? 'currentColor' : 'none'}",
    "fill={isMusicNoteCardLocked(song) ? 'currentColor' : 'none'}",
    '<circle cx="12" cy="12" r="8.7" fill="#252528" />',
]
for fragment in required_page:
    if fragment not in text:
        raise RuntimeError(f'apply-963 verification failed: page missing {fragment}')
if '/* SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963' not in css or 'background: transparent !important;' not in css:
    raise RuntimeError('apply-963 verification failed: keyword text-only CSS missing')

page_path.write_text(text, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('apply-963: keyword chips -> dim text only; OFF buttons darker; ON icons filled; public uses filled map globe')
