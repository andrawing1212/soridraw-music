from pathlib import Path

p = Path('src/components/studio/studioLayout.css')
text = p.read_text(encoding='utf-8')
marker = '/* 986 — idle hover style/layout isolation. */'
if marker in text:
    raise SystemExit('marker already present')

block = r'''

/* 986 — idle hover style/layout isolation.
 * Keep the existing visuals and interactions, but give the browser smaller
 * invalidation boundaries while the pointer moves across dense Studio UI.
 * No paint/size containment is used, so menus, shadows and responsive sizes
 * keep their current behavior. Active list rows stay uncontained for popovers. */
@media (min-width: 1100px) {
  :root[data-soridraw-theme="studio-black"]
  .soridraw-lite-studio-split-workspace:not(.is-dragging)
  .soridraw-studio-builder-pane .soridraw-studio-menu-card {
    contain: style;
  }

  :root[data-soridraw-theme="studio-black"]
  .soridraw-lite-studio-split-workspace:not(.is-dragging)
  :is(
    .soridraw-musicnote-song-card:not(.soridraw-list-perf-item--active),
    .soridraw-library-playlist-row:not(.soridraw-list-perf-item--active),
    .soridraw-library-workspace-track-row:not(.soridraw-list-perf-item--active)
  ) {
    contain: layout style;
  }
}
'''

p.write_text(text.rstrip() + block, encoding='utf-8')
