import { useCallback, useEffect, useMemo, useState } from 'react';

const SPLIT_DRAG_PREPARE_EVENT = 'soridraw-split-drag-prepare';
const SPLIT_DRAG_END_EVENT = 'soridraw-split-drag-end';

type VirtualWindowSnapshot = {
  keep: Set<string>;
  heights: Map<string, number>;
};

type SplitDragVirtualWindowOptions = {
  selector: string;
  keyAttribute: string;
  overscan?: number;
};

/**
 * Drag-only React windowing for the heavy Music Note / Library lists.
 *
 * The normal page is untouched. Immediately before a Lite V2 split drag starts,
 * the hook samples the currently mounted list once and keeps only rows that are
 * inside (or close to) the pane viewport. Off-window rows are rendered by the
 * page as exact-height placeholders until pointer-up, then the full list returns.
 *
 * There is no observer, scroll listener, or per-frame React state in this hook.
 */
export function useSplitDragVirtualWindow({
  selector,
  keyAttribute,
  overscan = 360,
}: SplitDragVirtualWindowOptions) {
  const [snapshot, setSnapshot] = useState<VirtualWindowSnapshot | null>(null);

  useEffect(() => {
    const capture = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
      if (nodes.length === 0) {
        setSnapshot(null);
        return;
      }

      const paneRects = new Map<HTMLElement, DOMRect>();
      const keep = new Set<string>();
      const heights = new Map<string, number>();
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      for (const node of nodes) {
        const key = node.getAttribute(keyAttribute);
        if (!key) continue;

        const rect = node.getBoundingClientRect();
        if (Number.isFinite(rect.height) && rect.height > 0) {
          heights.set(key, Math.max(1, Math.ceil(rect.height)));
        }

        const pane = node.closest<HTMLElement>('[data-soridraw-lite-pane]');
        let viewportTop = 0;
        let viewportBottom = window.innerHeight;
        if (pane) {
          let paneRect = paneRects.get(pane);
          if (!paneRect) {
            paneRect = pane.getBoundingClientRect();
            paneRects.set(pane, paneRect);
          }
          viewportTop = paneRect.top;
          viewportBottom = paneRect.bottom;
        }

        const isActive = node.classList.contains('soridraw-list-perf-item--active')
          || Boolean(activeElement && node.contains(activeElement));
        const isNearViewport = rect.bottom >= viewportTop - overscan && rect.top <= viewportBottom + overscan;
        if (isActive || isNearViewport) keep.add(key);
      }

      setSnapshot({ keep, heights });
    };

    const release = () => setSnapshot(null);

    window.addEventListener(SPLIT_DRAG_PREPARE_EVENT, capture as EventListener);
    window.addEventListener(SPLIT_DRAG_END_EVENT, release as EventListener);
    return () => {
      window.removeEventListener(SPLIT_DRAG_PREPARE_EVENT, capture as EventListener);
      window.removeEventListener(SPLIT_DRAG_END_EVENT, release as EventListener);
    };
  }, [keyAttribute, overscan, selector]);

  const shouldRender = useCallback((key: string) => snapshot === null || snapshot.keep.has(key), [snapshot]);
  const getPlaceholderHeight = useCallback((key: string, fallback = 72) => snapshot?.heights.get(key) || fallback, [snapshot]);

  return useMemo(() => ({
    active: snapshot !== null,
    shouldRender,
    getPlaceholderHeight,
  }), [getPlaceholderHeight, shouldRender, snapshot]);
}
