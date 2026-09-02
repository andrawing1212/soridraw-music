from pathlib import Path

BASE = 'd3c9b41b0d024c5d127a8b323e8a88261537a636'

app = Path('src/App.tsx')
app_text = app.read_text(encoding='utf-8')
app_import_anchor = "import { resolveExpandedHeight, useStableContentHeight } from './lib/stableContentHeight';\n"
app_import = app_import_anchor + "import { useStableHoverTooltip } from './lib/stableHoverTooltip';\n"
if "./lib/stableHoverTooltip" not in app_text:
    if app_import_anchor not in app_text:
        raise SystemExit('App import anchor missing')
    app_text = app_text.replace(app_import_anchor, app_import, 1)

old_state = 'const [showTitleTooltip, setShowTitleTooltip] = useState(false);'
app_count = app_text.count(old_state)
if app_count < 6:
    raise SystemExit(f'Expected >=6 App title tooltip states, found {app_count}')
app_text = app_text.replace(old_state, 'const [showTitleTooltip, setShowTitleTooltip] = useStableHoverTooltip(60);')

old_story = 'const [showStoryboardTitleTooltip, setShowStoryboardTitleTooltip] = useState(false);'
story_count = app_text.count(old_story)
if story_count != 1:
    raise SystemExit(f'Expected 1 storyboard tooltip state, found {story_count}')
app_text = app_text.replace(old_story, 'const [showStoryboardTitleTooltip, setShowStoryboardTitleTooltip] = useStableHoverTooltip(60);', 1)
app.write_text(app_text, encoding='utf-8')


genre = Path('src/components/GenreHierarchySelector.tsx')
genre_text = genre.read_text(encoding='utf-8')
genre_import_anchor = 'import { resolveExpandedHeight, useStableContentHeight } from "../lib/stableContentHeight";\n'
if '../lib/stableHoverTooltip' not in genre_text:
    if genre_import_anchor not in genre_text:
        raise SystemExit('Genre import anchor missing')
    genre_text = genre_text.replace(
        genre_import_anchor,
        genre_import_anchor + 'import { useStableHoverTooltip } from "../lib/stableHoverTooltip";\n',
        1,
    )
genre_count = genre_text.count(old_state)
if genre_count != 1:
    raise SystemExit(f'Expected 1 Genre title tooltip state, found {genre_count}')
genre_text = genre_text.replace(old_state, 'const [showTitleTooltip, setShowTitleTooltip] = useStableHoverTooltip(60);', 1)
genre.write_text(genre_text, encoding='utf-8')


hook = Path('src/lib/stableHoverTooltip.ts')
if hook.exists():
    raise SystemExit('stableHoverTooltip.ts already exists')
hook.write_text("""import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Stabilizes hover-only tooltips so fast pointer sweeps do not repeatedly mount
 * and unmount tooltip DOM. Hiding remains immediate; showing waits for the
 * pointer to stay on the same title for the requested delay.
 */
export function useStableHoverTooltip(
  delayMs = 60,
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null || typeof window === 'undefined') return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const setRequestedVisible = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const resolved = typeof next === 'function'
      ? (next as (previous: boolean) => boolean)(visibleRef.current)
      : next;

    clearTimer();

    if (!resolved) {
      visibleRef.current = false;
      setVisible(false);
      return;
    }

    if (typeof window === 'undefined' || delayMs <= 0) {
      visibleRef.current = true;
      setVisible(true);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      visibleRef.current = true;
      setVisible(true);
    }, delayMs);
  }, [clearTimer, delayMs]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [visible, setRequestedVisible] as const;
}
""", encoding='utf-8')


css = Path('src/components/studio/studioLayout.css')
css_text = css.read_text(encoding='utf-8').rstrip()
marker = '/* 987 — title tooltip hover stabilization + unclipped stacking. */'
if marker in css_text:
    raise SystemExit('CSS marker already present')
css_block = r'''

/* 987 — title tooltip hover stabilization + unclipped stacking.
 * The matching React hover state now waits 60ms before mounting. That means
 * these :has() overflow/z-index corrections only activate on an intentional
 * title hover, never while the pointer is simply sweeping across menu titles.
 * Keep the original title-bubble position and appearance, but allow the bubble
 * to paint above narrow/mobile builder cards and the adjacent result pane. */
html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-builder-pane:has(.soridraw-card-title-tooltip) {
  overflow: visible !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-lite-split-pane.is-left:has(.soridraw-card-title-tooltip) {
  position: relative !important;
  z-index: 520 !important;
  overflow: visible !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-builder-pane .soridraw-studio-menu-card:has(.soridraw-card-title-tooltip) {
  position: relative !important;
  z-index: 521 !important;
  overflow: visible !important;
  isolation: auto !important;
  contain: none !important;
  content-visibility: visible !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-builder-pane :is(
  .soridraw-studio-selection-grid,
  .soridraw-studio-secondary-grid,
  .soridraw-studio-mood-theme-grid,
  .soridraw-studio-vocal-lyrics-grid
) > *:has(.soridraw-card-title-tooltip) {
  position: relative !important;
  z-index: 521 !important;
  overflow: visible !important;
}
'''
css.write_text(css_text + css_block + '\n', encoding='utf-8')

print(f'App tooltip states stabilized: {app_count}')
print(f'Genre tooltip states stabilized: {genre_count}')
print(f'Storyboard tooltip states stabilized: {story_count}')
print('Title tooltip overflow/stacking guard appended.')
