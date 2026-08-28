from pathlib import Path

css_path = Path('src/components/studio/studioLayout.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* SORIDRAW_MUSIC_NOTE_CARD_RHYTHM_968 */'

if marker in css:
    print('apply-968: already applied')
    raise SystemExit(0)

css += r'''

/* SORIDRAW_MUSIC_NOTE_CARD_RHYTHM_968 */
/* Give genre/title the same breathing rhythm as title/actions without changing
 * the list structure. The row and thumbnail grow together so alignment stays stable. */
:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page
.soridraw-musicnote-song-row {
  height: 88px !important;
  min-height: 88px !important;
  max-height: 88px !important;
}

:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page
.soridraw-musicnote-song-media {
  width: 50px !important;
  min-width: 50px !important;
  max-width: 50px !important;
  height: 64px !important;
  min-height: 64px !important;
  max-height: 64px !important;
  flex: 0 0 50px !important;
}

:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page:not([data-soridraw-responsive-mode="mobile"])
.soridraw-musicnote-song-title {
  margin-top: 6px !important;
}

:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page[data-soridraw-responsive-mode="mobile"]
.soridraw-musicnote-song-title {
  margin-top: 5px !important;
}
'''

required = [
    marker,
    'height: 88px !important;',
    'width: 50px !important;',
    'height: 64px !important;',
    'margin-top: 6px !important;',
    'margin-top: 5px !important;',
]
for fragment in required:
    if fragment not in css:
        raise RuntimeError(f'apply-968 verification failed: missing {fragment}')

css_path.write_text(css, encoding='utf-8')
print('apply-968: Music Note row 88px; thumbnail 50x64; genre/title gap balanced across desktop/mobile')
