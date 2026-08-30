from pathlib import Path

page_path = Path('src/pages/FavoritesPage.tsx')
css_path = Path('src/index.css')
text = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_STATE_BUTTON_HOVER_TONE_967'
css_marker = '/* SORIDRAW_MUSIC_NOTE_STATE_BUTTON_HOVER_TONE_967 */'

if marker in text and css_marker in css:
    print('apply-967: already applied')
    raise SystemExit(0)

if '// SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FINAL_ALIGN_966' not in text:
    raise RuntimeError('apply-967: apply-966 must run first')

old_fill = '''  const renderMusicNoteStateButtonFill = (active: boolean) => (\n    <span\n      aria-hidden="true"\n      className="pointer-events-none absolute inset-0 rounded-full"\n      style={{\n        background: active ? '#f7f7f7' : '#303034',\n        boxShadow: active ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',\n      }}\n    />\n  );'''
new_fill = '''  const renderMusicNoteStateButtonFill = (active: boolean) => (\n    <span\n      aria-hidden="true"\n      className="pointer-events-none absolute inset-0 rounded-full"\n      style={{\n        background: active ? '#f7f7f7' : 'var(--soridraw-musicnote-state-bg, #242428)',\n        boxShadow: active ? '0 2px 9px rgba(0,0,0,0.24)' : 'none',\n      }}\n    />\n  );'''
if old_fill not in text:
    raise RuntimeError('apply-967: fill helper anchor not found')
text = text.replace(old_fill, new_fill, 1)

text = text.replace(
    '// SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FINAL_ALIGN_966\n',
    '// SORIDRAW_MUSIC_NOTE_STATE_BUTTON_FINAL_ALIGN_966\n  ' + marker + '\n',
    1,
)

if css_marker not in css:
    css += r'''

/* SORIDRAW_MUSIC_NOTE_STATE_BUTTON_HOVER_TONE_967 */
.soridraw-musicnote-song-state-actions > button {
  --soridraw-musicnote-state-bg: #242428;
}
@media (hover: hover) and (pointer: fine) {
  .soridraw-musicnote-song-state-actions > button:hover {
    --soridraw-musicnote-state-bg: #303034;
  }
}
'''

required_text = [
    marker,
    "background: active ? '#f7f7f7' : 'var(--soridraw-musicnote-state-bg, #242428)'",
]
for fragment in required_text:
    if fragment not in text:
        raise RuntimeError(f'apply-967 verification failed: missing {fragment}')
if css_marker not in css or '--soridraw-musicnote-state-bg: #242428;' not in css or '--soridraw-musicnote-state-bg: #303034;' not in css:
    raise RuntimeError('apply-967 verification failed: hover css missing')

page_path.write_text(text, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('apply-967: OFF idle darker; hover returns current tone; active white unchanged')
