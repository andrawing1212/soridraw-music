import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

type MediaQueryEntry = {
  mql: MediaQueryList;
  listeners: Set<Listener>;
  settledMatches: boolean;
  pendingFrame: number | null;
  handleChange: () => void;
};

const mediaQueryEntries = new Map<string, MediaQueryEntry>();
const WINDOW_RESIZE_SETTLE_MS = 160;

let nativeResizeActive = false;
let nativeResizeTimer: number | null = null;
let settledViewportWidth = typeof window === 'undefined' ? 1600 : window.innerWidth;
let resizeLifecycleInstalled = false;

const getViewportProfile = (width: number) => {
  if (width < 1100) return 'mobile';
  if (width < 1600) return 'compact';
  return 'wide';
};

const notifyEntry = (entry: MediaQueryEntry) => {
  for (const listener of Array.from(entry.listeners)) listener();
};

const flushSettledMediaQueries = () => {
  for (const entry of mediaQueryEntries.values()) {
    const next = entry.mql.matches;
    if (entry.settledMatches === next) continue;
    entry.settledMatches = next;
    notifyEntry(entry);
  }
};

const finishNativeResize = () => {
  if (typeof window === 'undefined') return;
  nativeResizeTimer = null;
  nativeResizeActive = false;
  settledViewportWidth = window.innerWidth;

  const root = document.documentElement;
  root.classList.remove('soridraw-window-resizing');
  delete root.dataset.soridrawResizeLockProfile;
  root.style.removeProperty('--soridraw-window-resize-lock-width');

  // Breakpoint subscribers now receive only the final viewport state. This is
  // intentionally synchronous so Studio performs one structural pass after a
  // native window resize rather than one pass per intermediate pixel.
  flushSettledMediaQueries();
  window.dispatchEvent(new CustomEvent('soridraw-window-resize-end'));
};

const beginOrContinueNativeResize = () => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  if (!nativeResizeActive) {
    nativeResizeActive = true;
    root.classList.add('soridraw-window-resizing');
    root.dataset.soridrawResizeLockProfile = getViewportProfile(settledViewportWidth);
    root.style.setProperty('--soridraw-window-resize-lock-width', `${Math.max(settledViewportWidth, 1)}px`);
    window.dispatchEvent(new CustomEvent('soridraw-window-resize-start'));
  }

  if (nativeResizeTimer !== null) window.clearTimeout(nativeResizeTimer);
  nativeResizeTimer = window.setTimeout(finishNativeResize, WINDOW_RESIZE_SETTLE_MS);
};

const ensureResizeLifecycle = () => {
  if (resizeLifecycleInstalled || typeof window === 'undefined') return;
  resizeLifecycleInstalled = true;
  settledViewportWidth = window.innerWidth;
  window.addEventListener('resize', beginOrContinueNativeResize, { passive: true });
};

const getOrCreateEntry = (query: string): MediaQueryEntry | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  ensureResizeLifecycle();
  const existing = mediaQueryEntries.get(query);
  if (existing) return existing;

  const mql = window.matchMedia(query);
  const listeners = new Set<Listener>();
  const entry: MediaQueryEntry = {
    mql,
    listeners,
    settledMatches: mql.matches,
    pendingFrame: null,
    handleChange: () => undefined,
  };

  entry.handleChange = () => {
    // Some browsers deliver MediaQueryList changes before/after the native
    // resize callback in the same frame. Defer one frame so the shared resize
    // latch can take ownership first. During the latch the snapshot stays at
    // its last settled value; the final value is flushed once on resize-end.
    if (entry.pendingFrame !== null) return;
    entry.pendingFrame = window.requestAnimationFrame(() => {
      entry.pendingFrame = null;
      if (nativeResizeActive) return;
      const next = entry.mql.matches;
      if (entry.settledMatches === next) return;
      entry.settledMatches = next;
      notifyEntry(entry);
    });
  };

  mql.addEventListener('change', entry.handleChange);
  mediaQueryEntries.set(query, entry);
  return entry;
};

const subscribeMediaQuery = (query: string, listener: Listener) => {
  const entry = getOrCreateEntry(query);
  if (!entry) return () => undefined;
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      if (entry.pendingFrame !== null) window.cancelAnimationFrame(entry.pendingFrame);
      entry.mql.removeEventListener('change', entry.handleChange);
      mediaQueryEntries.delete(query);
    }
  };
};

const getMediaQuerySnapshot = (query: string, fallback: boolean) => {
  const entry = getOrCreateEntry(query);
  return entry ? entry.settledMatches : fallback;
};

/**
 * Shared, resize-latched matchMedia subscription.
 *
 * Internal Studio split dragging never touches this latch, so pane resizing
 * remains fully live. Native browser resizing is different: breakpoint-driven
 * React structure stays at the last settled state while the window edge moves,
 * then all matching queries publish the final state once after 160ms idle.
 */
export function useMediaQuery(query: string, fallback = false) {
  const subscribe = useCallback((listener: Listener) => subscribeMediaQuery(query, listener), [query]);
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query, fallback), [fallback, query]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const getMediaQueryMatch = (query: string, fallback = false) => (
  getMediaQuerySnapshot(query, fallback)
);

export const isNativeWindowResizeActive = () => nativeResizeActive;
