from pathlib import Path

page_path = Path('src/pages/FavoritesPage.tsx')
css_path = Path('src/index.css')
text = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_COMPACT_SUNO_BUTTONS_964'

if marker in text and marker in css:
    print('apply-964: already applied')
    raise SystemExit(0)

if '// SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963' not in text:
    raise RuntimeError('apply-964: apply-963 must run first')

start = text.find('soridraw-musicnote-song-state-actions')
end = text.find('soridraw-musicnote-song-keywords', start)
if start < 0 or end < 0:
    raise RuntimeError('apply-964: state button region not found')
region = text[start:end]

# Compact spacing and 30px circular controls, closer to the Suno reference.
region = region.replace('items-center gap-1"', 'items-center gap-[5px]"', 1)
button_class = 'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all'
compact_class = 'relative flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full transition-all'
count = region.count(button_class)
if count != 3:
    raise RuntimeError(f'apply-964: expected 3 state buttons, found {count}')
region = region.replace(button_class, compact_class)

old_like = '''                              <ThumbsUp
                                className="relative z-[1] h-4 w-4"
                                fill={isMusicNoteCardLiked(song) ? 'currentColor' : 'none'}
                                strokeWidth={isMusicNoteCardLiked(song) ? 1.7 : 2}
                                style={{ color: isMusicNoteCardLiked(song) ? '#252528' : 'rgba(255,255,255,0.68)' }}
                              />'''
new_like = '''                              {isMusicNoteCardLiked(song) ? (
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>
                                  <path fill="currentColor" d="M2.8 20.2h3.4V9.7H2.8v10.5Zm18.1-9.35c0-.93-.75-1.68-1.68-1.68h-5.28l.8-3.87.03-.28c0-.35-.14-.69-.38-.93L13.5 3.2 7.9 8.8a1.7 1.7 0 0 0-.5 1.2v7.9c0 .93.75 1.68 1.68 1.68h7.58c.7 0 1.31-.42 1.57-1.03l2.53-5.9c.09-.2.14-.43.14-.67v-1.13Z" />
                                </svg>
                              ) : (
                                <ThumbsUp className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />
                              )}'''
if old_like not in region:
    raise RuntimeError('apply-964: like icon anchor not found')
region = region.replace(old_like, new_like, 1)

old_lock = '''                              <Lock
                                className="relative z-[1] h-4 w-4"
                                fill={isMusicNoteCardLocked(song) ? 'currentColor' : 'none'}
                                strokeWidth={isMusicNoteCardLocked(song) ? 1.7 : 2}
                                style={{ color: isMusicNoteCardLocked(song) ? '#252528' : 'rgba(255,255,255,0.68)' }}
                              />'''
new_lock = '''                              {isMusicNoteCardLocked(song) ? (
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>
                                  <path fill="currentColor" fillRule="evenodd" d="M7.1 9V6.9a4.9 4.9 0 0 1 9.8 0V9h.7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h.7Zm2.2 0h5.4V6.9a2.7 2.7 0 0 0-5.4 0V9Z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <Lock className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />
                              )}'''
if old_lock not in region:
    raise RuntimeError('apply-964: lock icon anchor not found')
region = region.replace(old_lock, new_lock, 1)

old_public_active = '''                                  ? (
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
                                  : <Globe2 className="relative z-[1] h-4 w-4" style={{ color: 'rgba(255,255,255,0.68)' }} />}'''
new_public_active = '''                                  ? (
                                    <svg aria-hidden="true" viewBox="0 0 24 24" className="relative z-[1] h-[14px] w-[14px]" style={{ color: '#202024' }}>
                                      <path fill="currentColor" d="M12 2.2A9.8 9.8 0 1 0 12 21.8 9.8 9.8 0 0 0 12 2.2Zm6.55 5.9h-2.72a15.4 15.4 0 0 0-1.18-3.15 8.05 8.05 0 0 1 3.9 3.15ZM12 4.15c.72 1.08 1.3 2.4 1.68 3.95h-3.36c.38-1.55.96-2.87 1.68-3.95ZM4.65 14a7.95 7.95 0 0 1 0-4h3.17a17.5 17.5 0 0 0 0 4H4.65Zm.8 2h2.72c.27 1.13.67 2.2 1.18 3.15A8.05 8.05 0 0 1 5.45 16Zm2.72-7.9H5.45a8.05 8.05 0 0 1 3.9-3.15A15.4 15.4 0 0 0 8.17 8.1ZM12 19.85c-.72-1.08-1.3-2.4-1.68-3.85h3.36c-.38 1.45-.96 2.77-1.68 3.85ZM14.07 14H9.93a14.1 14.1 0 0 1 0-4h4.14a14.1 14.1 0 0 1 0 4Zm.58 5.15c.51-.95.91-2.02 1.18-3.15h2.72a8.05 8.05 0 0 1-3.9 3.15ZM16.18 14a17.5 17.5 0 0 0 0-4h3.17a7.95 7.95 0 0 1 0 4h-3.17Z" />
                                    </svg>
                                  )
                                  : <Globe2 className="relative z-[1] h-[14px] w-[14px]" strokeWidth={1.9} style={{ color: 'rgba(255,255,255,0.66)' }} />}'''
if old_public_active not in region:
    raise RuntimeError('apply-964: public icon anchor not found')
region = region.replace(old_public_active, new_public_active, 1)

text = text[:start] + region + text[end:]

# OFF stays visibly darker than the original #343438. ON remains white.
text = text.replace("background: active ? '#f7f7f7' : '#29292d',", "background: active ? '#f7f7f7' : '#303034',", 1)

# Marker near 963 contract.
text = text.replace('// SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963\n', '// SORIDRAW_MUSIC_NOTE_VISUAL_TUNE_963\n  ' + marker + '\n', 1)

css_marker = '/* SORIDRAW_MUSIC_NOTE_COMPACT_SUNO_BUTTONS_964 */'
if css_marker not in css:
    css += r'''

/* SORIDRAW_MUSIC_NOTE_COMPACT_SUNO_BUTTONS_964 */
.soridraw-musicnote-song-keywords > :is(button, span, div) {
  color: rgba(255, 255, 255, 0.38) !important;
}
.soridraw-musicnote-song-keywords > :is(button, span, div):is(:hover, :active, :focus, :focus-visible) {
  color: rgba(255, 255, 255, 0.46) !important;
}
html[data-soridraw-color-mode="light"] .soridraw-musicnote-song-keywords > :is(button, span, div),
html:not(.dark) .soridraw-musicnote-song-keywords > :is(button, span, div) {
  color: rgba(30, 30, 32, 0.42) !important;
}
'''
css = css.replace(css_marker, marker)

required = [
    marker,
    'h-[30px] w-[30px]',
    "background: active ? '#f7f7f7' : '#303034'",
    'M2.8 20.2h3.4V9.7H2.8v10.5',
    'M7.1 9V6.9a4.9 4.9',
    'M12 2.2A9.8 9.8',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-964 verification failed: missing {fragment}')
if marker not in css:
    raise RuntimeError('apply-964 verification failed: css marker missing')

page_path.write_text(text, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('apply-964: compact Suno-like state controls; OFF outline / ON flat filled silhouettes; dim text-only keywords')
