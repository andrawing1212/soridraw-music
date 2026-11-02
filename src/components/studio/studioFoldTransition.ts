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
  root.dataset.soridrawFoldTransition = kind;
  try {
    const transition = doc.startViewTransition(() => flushSync(update));
    activeTransition = transition;
    void transition.finished.catch(() => undefined).then(() => {
      if (token !== activeToken) return;
      delete root.dataset.soridrawFoldTransition;
      activeTransition = null;
    });
  } catch {
    if (token === activeToken) delete root.dataset.soridrawFoldTransition;
    activeTransition = null;
    update();
  }
};
