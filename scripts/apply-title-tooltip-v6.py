from pathlib import Path
import re

BASE = '05fce240107df33607d73a036744efaf3a8634f5'

# Remove rollback-only markers before publishing the corrected source commit.
for marker_path in [
    Path('src/rollbackPreviewMarker.ts'),
    Path('.deploy/rollback-title-tooltip-v5.txt'),
]:
    if marker_path.exists():
        marker_path.unlink()

app = Path('src/App.tsx')
app_text = app.read_text(encoding='utf-8')
app_import_anchor = "import { resolveExpandedHeight, useStableContentHeight } from './lib/stableContentHeight';\n"
if "./lib/stableHoverTooltip" not in app_text:
    if app_import_anchor not in app_text:
        raise SystemExit('App import anchor missing')
    app_text = app_text.replace(
        app_import_anchor,
        app_import_anchor + "import { useStableHoverTooltip } from './lib/stableHoverTooltip';\n",
        1,
    )

old_state = 'const [showTitleTooltip, setShowTitleTooltip] = useState(false);'
app_count = app_text.count(old_state)
if app_count != 6:
    raise SystemExit(f'Expected exactly 6 App title tooltip states, found {app_count}')
app_text = app_text.replace(
    old_state,
    'const [showTitleTooltip, setShowTitleTooltip] = useStableHoverTooltip(60);',
)

old_story = 'const [showStoryboardTitleTooltip, setShowStoryboardTitleTooltip] = useState(false);'
story_count = app_text.count(old_story)
if story_count != 1:
    raise SystemExit(f'Expected exactly 1 storyboard tooltip state, found {story_count}')
app_text = app_text.replace(
    old_story,
    'const [showStoryboardTitleTooltip, setShowStoryboardTitleTooltip] = useStableHoverTooltip(60);',
    1,
)

def unwrap_title_animate_presence(text: str, state_name: str, expected: int) -> tuple[str, int]:
    pattern = re.compile(
        r'(?P<indent>^[ \t]*)<AnimatePresence>\s*'
        r'\{\s*' + re.escape(state_name) + r'\s*&&\s*\(\s*'
        r'(?P<body><motion\.div\b.*?</motion\.div>)\s*'
        r'\)\s*\}\s*</AnimatePresence>',
        re.MULTILINE | re.DOTALL,
    )

    def repl(match: re.Match[str]) -> str:
        indent = match.group('indent')
        body = match.group('body')
        return f"{indent}{{{state_name} && (\n{body}\n{indent})}}"

    updated, count = pattern.subn(repl, text)
    if count != expected:
        raise SystemExit(f'Expected {expected} {state_name} AnimatePresence wrappers, found {count}')
    return updated, count

app_text, app_unwrapped = unwrap_title_animate_presence(app_text, 'showTitleTooltip', 6)
app_text, story_unwrapped = unwrap_title_animate_presence(app_text, 'showStoryboardTitleTooltip', 1)
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
    raise SystemExit(f'Expected exactly 1 Genre title tooltip state, found {genre_count}')
genre_text = genre_text.replace(
    old_state,
    'const [showTitleTooltip, setShowTitleTooltip] = useStableHoverTooltip(60);',
    1,
)
genre_text, genre_unwrapped = unwrap_title_animate_presence(genre_text, 'showTitleTooltip', 1)
genre.write_text(genre_text, encoding='utf-8')


hook = Path('src/lib/stableHoverTooltip.ts')
if hook.exists():
    raise SystemExit('stableHoverTooltip.ts already exists on rollback baseline')
hook.write_text("""import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

let activeTooltipDismiss: (() => void) | null = null;

/**
 * Title-help hover guard.
 * - A quick pointer sweep never mounts the tooltip.
 * - Leaving hides immediately (no AnimatePresence exit tail).
 * - Only one menu-title tooltip can be active at a time.
 */
export function useStableHoverTooltip(
  delayMs = 60,
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const dismissRef = useRef<() => void>(() => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current === null || typeof window === 'undefined') return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const hideNow = useCallback(() => {
    clearTimer();
    if (visibleRef.current) {
      visibleRef.current = false;
      setVisible(false);
    }
    if (activeTooltipDismiss === dismissRef.current) {
      activeTooltipDismiss = null;
    }
  }, [clearTimer]);

  dismissRef.current = hideNow;

  const setRequestedVisible = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const resolved = typeof next === 'function'
      ? (next as (previous: boolean) => boolean)(visibleRef.current)
      : next;

    clearTimer();

    if (!resolved) {
      hideNow();
      return;
    }

    const activate = () => {
      timerRef.current = null;
      const previousDismiss = activeTooltipDismiss;
      if (previousDismiss && previousDismiss !== dismissRef.current) {
        previousDismiss();
      }
      activeTooltipDismiss = dismissRef.current;
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
    };

    if (typeof window === 'undefined' || delayMs <= 0) {
      activate();
      return;
    }

    timerRef.current = window.setTimeout(activate, delayMs);
  }, [clearTimer, delayMs, hideNow]);

  useEffect(() => () => {
    clearTimer();
    if (activeTooltipDismiss === dismissRef.current) {
      activeTooltipDismiss = null;
    }
  }, [clearTimer]);

  return [visible, setRequestedVisible] as const;
}
""", encoding='utf-8')


css = Path('src/components/studio/studioLayout.css')
css_text = css.read_text(encoding='utf-8').rstrip()
marker = '/* 988 — title tooltip sibling stacking only. */'
if marker in css_text:
    raise SystemExit('CSS marker already present')
css_block = r'''

/* 988 — title tooltip sibling stacking only.
 * Keep the baseline split containment/overflow engine untouched. The tooltip
 * already paints outside its own card; this only raises the active grid item
 * above adjacent menu cards, so the next card cannot cut the bubble in half.
 * The title anchor itself is also raised above controls inside the same card. */
html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-builder-pane :is(
  .soridraw-studio-selection-grid,
  .soridraw-studio-secondary-grid,
  .soridraw-studio-mood-theme-grid,
  .soridraw-studio-vocal-lyrics-grid
) > *:has(.soridraw-card-title-tooltip) {
  position: relative !important;
  z-index: 520 !important;
}

html[data-soridraw-theme="studio-black"] body #root .soridraw-app-root
.soridraw-studio-menu-card :is(.soridraw-card-title-anchor, .relative):has(> .soridraw-card-title-tooltip) {
  position: relative !important;
  z-index: 521 !important;
}
'''
css.write_text(css_text + css_block + '\n', encoding='utf-8')

print(f'App title states stabilized: {app_count}')
print(f'App title AnimatePresence removed: {app_unwrapped}')
print(f'Storyboard state stabilized: {story_count}')
print(f'Storyboard AnimatePresence removed: {story_unwrapped}')
print(f'Genre state stabilized: {genre_count}')
print(f'Genre AnimatePresence removed: {genre_unwrapped}')
print('Only sibling/anchor z-index was added; split pane overflow/containment was not changed.')
