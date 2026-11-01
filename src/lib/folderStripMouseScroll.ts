import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

/**
 * Mouse drag pans a folder strip. Cancel the existing long-press edit/reorder
 * before its move handlers run. Touch and ordinary clicks keep their behavior.
 * No folder metadata or synchronization state is changed here.
 */
export const useFolderStripMouseScroll = (
  cancelFolderLongPress: () => void,
  isFolderReordering: () => boolean,
) => {
  const cancelRef = useRef(cancelFolderLongPress);
  cancelRef.current = cancelFolderLongPress;
  const reorderingRef = useRef(isFolderReordering);
  reorderingRef.current = isFolderReordering;
  const detachRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    detachRef.current?.();
    if (suppressTimeoutRef.current !== null) window.clearTimeout(suppressTimeoutRef.current);
  }, []);

  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const strip = event.currentTarget;
    if (strip.scrollWidth <= strip.clientWidth + 1) return;

    detachRef.current?.();
    if (suppressTimeoutRef.current !== null) window.clearTimeout(suppressTimeoutRef.current);
    suppressClickRef.current = false;
    suppressTimeoutRef.current = null;

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let previousX = startX;
    let scrolling = false;

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return;
      // The 700ms long press wins once folder reordering is active.
      // Detach this passive mouse-pan observer, leaving the existing window
      // reorder handlers in full control until pointer release.
      if (reorderingRef.current()) {
        detach();
        return;
      }
      const deltaX = move.clientX - startX;
      const deltaY = move.clientY - startY;
      if (!scrolling) {
        if (Math.abs(deltaX) <= 8 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
        scrolling = true;
        // Capture-phase listener runs before React handlers and old reorder listeners.
        cancelRef.current();
        strip.dataset.soridrawMouseScrolling = 'true';
      }
      strip.scrollLeft -= move.clientX - previousX;
      previousX = move.clientX;
      if (move.cancelable) move.preventDefault();
    };

    const detach = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onEnd, true);
      delete strip.dataset.soridrawMouseScrolling;
      detachRef.current = null;
    };

    const onEnd = (end: PointerEvent) => {
      if (end.pointerId !== pointerId) return;
      detach();
      if (!scrolling) return;
      // Block the click synthesized after drag-release, not the next real click.
      suppressClickRef.current = true;
      suppressTimeoutRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimeoutRef.current = null;
      }, 250);
    };

    window.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onEnd, true);
    detachRef.current = detach;
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    if (suppressTimeoutRef.current !== null) window.clearTimeout(suppressTimeoutRef.current);
    suppressTimeoutRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  return { onPointerDownCapture, onClickCapture };
};
