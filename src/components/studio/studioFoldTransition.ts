import { flushSync } from 'react-dom';

/**
 * Button-only Studio fold animation. The browser interpolates snapshots of the
 * original layout; Lite V2's pointer/resize geometry owners stay untouched.
 */
type FoldKind = 'rail' | 'pane';
type NativeFoldTransition = { finished: Promise<void>; skipTransition: () => void };
type FoldDocument = Document & {
  startViewTransition?: (update: () => void) => NativeFoldTransition;
};

type FoldBounds = { left: number; top: number; width: number; height: number };

const readFoldBounds = (selector: string): FoldBounds | null => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { left, top, width, height } : null;
};

const CENTER = '.soridraw-studio-page-frame > .soridraw-studio-page-center';
const BUILDER = '.soridraw-lite-studio-split-workspace > .soridraw-studio-builder-pane';
const RESULT = '.soridraw-lite-studio-split-workspace > .soridraw-studio-result-pane';
const FOLD_GEOMETRY_VARS = [
  '--soridraw-fold-from-left', '--soridraw-fold-from-width',
  '--soridraw-fold-to-left', '--soridraw-fold-to-top',
  '--soridraw-fold-to-width', '--soridraw-fold-to-height',
] as const;

const setHorizontalFoldBounds = (root: HTMLElement, before: FoldBounds | null, after: FoldBounds | null) => {
  if (!before || !after) return;
  // Read geometry only on a deliberate fold click, never on split pointermove.
  root.style.setProperty(FOLD_GEOMETRY_VARS[0], `${before.left}px`);
  root.style.setProperty(FOLD_GEOMETRY_VARS[1], `${before.width}px`);
  root.style.setProperty(FOLD_GEOMETRY_VARS[2], `${after.left}px`);
  root.style.setProperty(FOLD_GEOMETRY_VARS[3], `${after.top}px`);
  root.style.setProperty(FOLD_GEOMETRY_VARS[4], `${after.width}px`);
  root.style.setProperty(FOLD_GEOMETRY_VARS[5], `${after.height}px`);
  root.dataset.soridrawFoldHorizontal = 'true';
};

const clearHorizontalFoldBounds = (root: HTMLElement) => {
  delete root.dataset.soridrawFoldHorizontal;
  FOLD_GEOMETRY_VARS.forEach((name) => root.style.removeProperty(name));
};

let activeTransition: NativeFoldTransition | null = null;
let activeToken = 0;

export const runStudioFoldTransition = (kind: FoldKind, update: () => void) => {
  const doc = document as FoldDocument;
  if (
    window.innerWidth < 1100
    || document.documentElement.dataset.soridrawTheme !== 'studio-black'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || !doc.startViewTransition
    || document.documentElement.classList.contains('soridraw-lite-split-dragging')
    || document.documentElement.classList.contains('soridraw-window-resizing')
  ) {
    update();
    return;
  }

  // A second button click replaces, rather than queues behind, an old snapshot.
  activeTransition?.skipTransition();
  const token = ++activeToken;
  const root = document.documentElement;
  // A surviving center/pane can change height when its cards change columns.
  // Native View Transition otherwise interpolates that *height* along with
  // the width, making its header and cards bob vertically during rail folds.
  const beforeCenter = kind === 'rail' ? readFoldBounds(CENTER) : null;
  const beforeBuilder = kind === 'pane' ? readFoldBounds(BUILDER) : null;
  const beforeResult = kind === 'pane' ? readFoldBounds(RESULT) : null;
  const wasBuilderCollapsed = root.dataset.soridrawBuilderCollapsed === 'true';
  const wasResultCollapsed = root.dataset.soridrawResultCollapsed === 'true';
  root.dataset.soridrawFoldTransition = kind;
  delete root.dataset.soridrawFoldSurvivor;
  clearHorizontalFoldBounds(root);
  try {
    const transition = doc.startViewTransition(() => {
      flushSync(update);
      if (kind === 'rail') {
        setHorizontalFoldBounds(root, beforeCenter, readFoldBounds(CENTER));
        return;
      }
      const builderChanged = (root.dataset.soridrawBuilderCollapsed === 'true') !== wasBuilderCollapsed;
      const resultChanged = (root.dataset.soridrawResultCollapsed === 'true') !== wasResultCollapsed;
      if (builderChanged !== resultChanged) {
        const survivor = builderChanged ? 'result' : 'builder';
        root.dataset.soridrawFoldSurvivor = survivor;
        setHorizontalFoldBounds(
          root,
          survivor === 'builder' ? beforeBuilder : beforeResult,
          readFoldBounds(survivor === 'builder' ? BUILDER : RESULT),
        );
      }
    });
    activeTransition = transition;
    void transition.finished.catch(() => undefined).then(() => {
      if (token !== activeToken) return;
      delete root.dataset.soridrawFoldTransition;
      delete root.dataset.soridrawFoldSurvivor;
      clearHorizontalFoldBounds(root);
      activeTransition = null;
    });
  } catch {
    if (token === activeToken) {
      delete root.dataset.soridrawFoldTransition;
      delete root.dataset.soridrawFoldSurvivor;
      clearHorizontalFoldBounds(root);
    }
    activeTransition = null;
    update();
  }
};
