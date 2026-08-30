from pathlib import Path

css_path = Path('src/components/studio/studioLayout.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* SORIDRAW_MUSIC_NOTE_GENRE_COLOR_DOT_CLEANUP_969 */'

if marker in css:
    print('apply-969: already applied')
    raise SystemExit(0)

css += r'''

/* SORIDRAW_MUSIC_NOTE_GENRE_COLOR_DOT_CLEANUP_969 */
/* Genre is secondary metadata: match the dim keyword tone and reduce it slightly. */
:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page:not([data-soridraw-responsive-mode="mobile"])
.soridraw-musicnote-song-genre {
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.43) !important;
}

:root body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page[data-soridraw-responsive-mode="mobile"]
.soridraw-musicnote-song-genre {
  font-size: 10px !important;
  color: rgba(255, 255, 255, 0.43) !important;
}

html[data-soridraw-color-mode="light"] body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page .soridraw-musicnote-song-genre,
html:not(.dark) body #root .soridraw-app-root
.soridraw-musicnote-theme.soridraw-responsive-content-page .soridraw-musicnote-song-genre {
  color: rgba(30, 30, 32, 0.48) !important;
}

/* Per-song color picker: keep the hit area, show only the actual color dot. */
:root body #root .soridraw-app-root
.soridraw-musicnote-theme [data-favorite-color-control="true"],
:root body #root .soridraw-app-root
.soridraw-musicnote-theme [data-favorite-color-control="true"]:is(:hover, :active, :focus, :focus-visible) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
}

/* Color picker popup dots: no secondary gray/ring button around the dot. */
:root body #root .soridraw-app-root
.soridraw-musicnote-theme [data-favorite-color-menu="true"] button,
:root body #root .soridraw-app-root
.soridraw-musicnote-theme [data-favorite-color-menu="true"] button:is(:hover, :active, :focus, :focus-visible) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
}

/* Top color filter: retain the large shared filter tray, but each color is only a dot. */
:root body #root .soridraw-app-root
.soridraw-musicnote-theme .soridraw-responsive-color-filter > button:not(.soridraw-color-reset-button),
:root body #root .soridraw-app-root
.soridraw-musicnote-theme .soridraw-responsive-color-filter > button:not(.soridraw-color-reset-button):is(:hover, :active, :focus, :focus-visible) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
}
'''

required = [
    marker,
    'font-size: 12px !important;',
    'color: rgba(255, 255, 255, 0.43) !important;',
    '[data-favorite-color-control="true"]',
    '[data-favorite-color-menu="true"] button',
    '.soridraw-responsive-color-filter > button:not(.soridraw-color-reset-button)',
    'box-shadow: none !important;',
]
for fragment in required:
    if fragment not in css:
        raise RuntimeError(f'apply-969 verification failed: missing {fragment}')

css_path.write_text(css, encoding='utf-8')
print('apply-969: genre dimmed/smaller; per-song and top-filter color controls show color dots without gray outer buttons')
