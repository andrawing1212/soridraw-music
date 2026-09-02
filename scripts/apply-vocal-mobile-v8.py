from pathlib import Path

APP = Path('src/App.tsx')
CSS = Path('src/components/studio/studioLayout.css')

app = APP.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)

# Add semantic hooks only; handlers, disabled state and button content stay unchanged.
app = replace_once(
    app,
    "              <button\n                onClick={() => handleAddMember('male')}\n",
    "              <button\n                data-vocal-add-member=\"male\"\n                onClick={() => handleAddMember('male')}\n",
    'male add-member hook',
)
app = replace_once(
    app,
    "              <button\n                onClick={() => handleAddMember('female')}\n",
    "              <button\n                data-vocal-add-member=\"female\"\n                onClick={() => handleAddMember('female')}\n",
    'female add-member hook',
)

marker = '/* 1008 — Vocal group mobile/split parity.'
if marker in css:
    raise SystemExit('v8 CSS marker already exists')

css += r'''

/* 1008 — Vocal group mobile/split parity.
 * 1) The compact mobile builder must show each group member as one full-width row,
 *    matching the already-approved split/mobile-pane composition.
 * 2) Group add-member controls keep the existing dark-mode semantic blue/pink
 *    treatment inside split Studio Black instead of being flattened by generic
 *    Studio button rules. No vocal behavior or split geometry changes. */
html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-page-frame[data-compact-workspace="true"]:is([data-workspace-view="create"], [data-workspace-view="recent"])
.soridraw-studio-compact-mobile-builder .soridraw-vocal-member-grid,
:root[data-soridraw-theme="studio-black"] .soridraw-studio-builder-pane[data-pane-mode="mobile"] .soridraw-vocal-member-grid {
  grid-template-columns: minmax(0, 1fr) !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
:is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
button[data-vocal-add-member="male"]:not(:disabled) {
  background: rgb(37 99 235 / 0.10) !important;
  background-color: rgb(37 99 235 / 0.10) !important;
  background-image: none !important;
  border-color: rgb(59 130 246 / 0.20) !important;
  color: rgb(96 165 250) !important;
  -webkit-text-fill-color: rgb(96 165 250) !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
:is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
button[data-vocal-add-member="female"]:not(:disabled) {
  background: rgb(219 39 119 / 0.10) !important;
  background-color: rgb(219 39 119 / 0.10) !important;
  background-image: none !important;
  border-color: rgb(236 72 153 / 0.20) !important;
  color: rgb(244 114 182) !important;
  -webkit-text-fill-color: rgb(244 114 182) !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
:is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
button[data-vocal-add-member="male"]:not(:disabled) :where(svg, span),
html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
:is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
button[data-vocal-add-member="female"]:not(:disabled) :where(svg, span) {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}

@media (hover: hover) and (pointer: fine) {
  html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
  :is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
  button[data-vocal-add-member="male"]:not(:disabled):hover {
    background: rgb(37 99 235 / 0.20) !important;
    background-color: rgb(37 99 235 / 0.20) !important;
  }

  html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
  :is(.soridraw-studio-split-workspace, .soridraw-lite-studio-split-workspace)
  button[data-vocal-add-member="female"]:not(:disabled):hover {
    background: rgb(219 39 119 / 0.20) !important;
    background-color: rgb(219 39 119 / 0.20) !important;
  }
}
'''

APP.write_text(app, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')

print('Applied Vocal group mobile/split parity v8.')
print('Only App semantic hooks and studioLayout CSS were changed.')
