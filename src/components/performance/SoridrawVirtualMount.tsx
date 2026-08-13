import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

type SoridrawVirtualMountProps = {
  children: React.ReactNode;
  estimatedHeight: number;
  forceMounted?: boolean;
  overscanPx?: number;
  itemKey?: string;
  className?: string;
};

type IntersectionCallback = (entry: IntersectionObserverEntry) => void;
type ObserverPool = {
  observer: IntersectionObserver;
  callbacks: Map<Element, IntersectionCallback>;
};

const viewportObserverPools = new Map<number, ObserverPool>();
const elementObserverPools = new WeakMap<HTMLElement, Map<number, ObserverPool>>();
const gestureEndSubscribers = new Set<() => void>();
let gestureEndListenersAttached = false;

const isScrollableOverflow = (value: string) => /(auto|scroll|overlay)/.test(value);

const findVerticalScrollRoot = (element: HTMLElement): HTMLElement | null => {
  let current = element.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    if (isScrollableOverflow(style.overflowY)) return current;
    current = current.parentElement;
  }
  return null;
};

const isLayoutGestureActive = () => {
  const root = document.documentElement;
  return root.classList.contains('soridraw-split-dragging')
    || root.classList.contains('soridraw-lite-split-dragging')
    || root.classList.contains('soridraw-window-resizing');
};

const getObserverPool = (root: HTMLElement | null, overscanPx: number): ObserverPool => {
  const normalizedOverscan = Math.max(0, Math.round(overscanPx));
  let bucket: Map<number, ObserverPool>;

  if (root) {
    bucket = elementObserverPools.get(root) || new Map<number, ObserverPool>();
    if (!elementObserverPools.has(root)) elementObserverPools.set(root, bucket);
  } else {
    bucket = viewportObserverPools;
  }

  const existing = bucket.get(normalizedOverscan);
  if (existing) return existing;

  const callbacks = new Map<Element, IntersectionCallback>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) callbacks.get(entry.target)?.(entry);
  }, {
    root,
    rootMargin: `${normalizedOverscan}px 0px ${normalizedOverscan}px 0px`,
    threshold: 0,
  });

  const pool = { observer, callbacks };
  bucket.set(normalizedOverscan, pool);
  return pool;
};

const releaseObserverPoolIfEmpty = (root: HTMLElement | null, overscanPx: number, pool: ObserverPool) => {
  if (pool.callbacks.size > 0) return;
  pool.observer.disconnect();
  const normalizedOverscan = Math.max(0, Math.round(overscanPx));
  if (root) elementObserverPools.get(root)?.delete(normalizedOverscan);
  else viewportObserverPools.delete(normalizedOverscan);
};

const emitGestureEnd = () => {
  for (const subscriber of gestureEndSubscribers) subscriber();
};

const ensureGestureEndListeners = () => {
  if (gestureEndListenersAttached) return;
  gestureEndListenersAttached = true;
  window.addEventListener('soridraw-window-resize-end', emitGestureEnd as EventListener);
  window.addEventListener('pointerup', emitGestureEnd, { passive: true });
  window.addEventListener('pointercancel', emitGestureEnd, { passive: true });
};

const releaseGestureEndListenersIfUnused = () => {
  if (!gestureEndListenersAttached || gestureEndSubscribers.size > 0) return;
  gestureEndListenersAttached = false;
  window.removeEventListener('soridraw-window-resize-end', emitGestureEnd as EventListener);
  window.removeEventListener('pointerup', emitGestureEnd);
  window.removeEventListener('pointercancel', emitGestureEnd);
};

/**
 * 695 — real DOM virtualization slot for dense Music Note / Library rows.
 *
 * The slot itself always stays in the list so scroll geometry remains stable,
 * but the expensive row subtree is mounted only while the slot is in/near the
 * active scroll viewport. Once a row leaves the overscan band we remember its
 * last measured block height and remove the heavy descendants from the DOM.
 *
 * All slots under the same scroll root share one IntersectionObserver. Window
 * membership is frozen during splitter/native-window resize gestures, so the
 * horizontal performance path never creates an observer mount/unmount loop.
 */
export default function SoridrawVirtualMount({
  children,
  estimatedHeight,
  forceMounted = false,
  overscanPx = 280,
  itemKey,
  className = '',
}: SoridrawVirtualMountProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    mountedRef.current = mounted;
  }, [mounted]);

  const captureCurrentHeight = () => {
    const slot = slotRef.current;
    if (!slot || !mountedRef.current) return;
    const height = slot.getBoundingClientRect().height;
    if (!Number.isFinite(height) || height <= 0) return;
    const roundedHeight = Math.ceil(height);
    slot.style.height = `${roundedHeight}px`;
    slot.dataset.soridrawVirtualHeight = String(roundedHeight);
  };

  const mountNow = () => {
    const slot = slotRef.current;
    if (slot) slot.style.height = '';
    if (mountedRef.current) return;
    mountedRef.current = true;
    setMounted(true);
  };

  const unmountNow = () => {
    if (!mountedRef.current || forceMounted) return;
    captureCurrentHeight();
    mountedRef.current = false;
    setMounted(false);
  };

  const evaluateNearViewport = () => {
    const slot = slotRef.current;
    if (!slot) return;
    if (forceMounted) {
      mountNow();
      return;
    }

    const scrollRoot = findVerticalScrollRoot(slot);
    const slotRect = slot.getBoundingClientRect();
    const rootRect = scrollRoot
      ? scrollRoot.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const near = slotRect.bottom >= rootRect.top - overscanPx
      && slotRect.top <= rootRect.bottom + overscanPx;

    if (near) mountNow();
    else unmountNow();
  };

  useLayoutEffect(() => {
    // Resolve the first virtual window before paint. We start with empty slots,
    // so the full heavy list is never mounted as an intermediate first frame.
    evaluateNearViewport();
  }, [forceMounted, overscanPx]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof IntersectionObserver === 'undefined') {
      mountNow();
      return;
    }

    const scrollRoot = findVerticalScrollRoot(slot);
    const pool = getObserverPool(scrollRoot, overscanPx);
    const handleIntersection: IntersectionCallback = (entry) => {
      if (isLayoutGestureActive()) return;
      if (entry.isIntersecting || forceMounted) mountNow();
      else unmountNow();
    };

    pool.callbacks.set(slot, handleIntersection);
    pool.observer.observe(slot);

    const handleGestureEnd = () => evaluateNearViewport();
    gestureEndSubscribers.add(handleGestureEnd);
    ensureGestureEndListeners();

    return () => {
      pool.observer.unobserve(slot);
      pool.callbacks.delete(slot);
      releaseObserverPoolIfEmpty(scrollRoot, overscanPx, pool);
      gestureEndSubscribers.delete(handleGestureEnd);
      releaseGestureEndListenersIfUnused();
    };
  }, [forceMounted, overscanPx]);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot || !mounted) return;
    // A remounted row must take its real height at the current pane width.
    slot.style.height = '';
  }, [mounted, children]);

  return (
    <div
      ref={slotRef}
      className={`soridraw-virtual-list-slot ${className}`.trim()}
      data-soridraw-virtual-key={itemKey || undefined}
      data-soridraw-virtual-mounted={(mounted || forceMounted) ? 'true' : 'false'}
      style={{
        minHeight: `${Math.max(1, Math.round(estimatedHeight))}px`,
        contain: (mounted || forceMounted) ? undefined : 'layout style paint',
      }}
      aria-hidden={(mounted || forceMounted) ? undefined : true}
    >
      {(mounted || forceMounted) ? children : null}
    </div>
  );
}
