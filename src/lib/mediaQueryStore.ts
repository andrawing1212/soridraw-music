import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

type MediaQueryEntry = {
  mql: MediaQueryList;
  listeners: Set<Listener>;
  handleChange: () => void;
};

const mediaQueryEntries = new Map<string, MediaQueryEntry>();

const getOrCreateEntry = (query: string): MediaQueryEntry | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const existing = mediaQueryEntries.get(query);
  if (existing) return existing;

  const mql = window.matchMedia(query);
  const listeners = new Set<Listener>();
  const entry: MediaQueryEntry = {
    mql,
    listeners,
    handleChange: () => {
      for (const listener of Array.from(listeners)) listener();
    },
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
      entry.mql.removeEventListener('change', entry.handleChange);
      mediaQueryEntries.delete(query);
    }
  };
};

const getMediaQuerySnapshot = (query: string, fallback: boolean) => {
  const entry = getOrCreateEntry(query);
  return entry ? entry.mql.matches : fallback;
};

/**
 * Shared matchMedia subscription.
 *
 * Browser resize emits dozens of native resize events while a window edge is
 * being dragged. Components that only care about a breakpoint should not run
 * on every pixel. This store wakes subscribers only when the requested media
 * query actually changes state, and components using the same query share the
 * same native MediaQueryList listener.
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
