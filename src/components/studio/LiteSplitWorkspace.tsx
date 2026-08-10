import React, { Children, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './liteSplitWorkspace.css';

const STORAGE_KEY = 'soridraw_lite_split_percent_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
const PANE_GUTTER_PX = 18;
const PANE_WIDTH_EVENT = 'soridraw-lite-pane-width';

const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

const readStoredPercent = () => {
  if (typeof window === 'undefined') return DEFAULT_PERCENT;
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) ? clamp(value) : DEFAULT_PERCENT;
  } catch {
    return DEFAULT_PERCENT;
  }
};

export function LiteSplitLeftPane({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function LiteSplitRightPane({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function LiteSplitWorkspace({ children }: { children: ReactNode }) {
  const panes = Children.toArray(children);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const percentRef = useRef(readStoredPercent());
  const layoutWidthRef = useRef(1);
  const layoutLeftRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(-1);
  const pendingClientXRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastPixelRef = useRef<number | null>(null);

  const broadcastPaneWidths = useCallback((percent: number, totalWidth: number) => {
    const safeWidth = Math.max(1, totalWidth);
    const leftColumn = safeWidth * (percent / 100);
    const rightColumn = safeWidth - leftColumn;
    const leftContentWidth = Math.max(1, leftColumn - PANE_GUTTER_PX);
    const rightContentWidth = Math.max(1, rightColumn - PANE_GUTTER_PX);

    leftPaneRef.current?.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: leftContentWidth } }));
    rightPaneRef.current?.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: rightContentWidth } }));
  }, []);

  const applyPercent = useCallback((percent: number) => {
    const next = clamp(percent);
    percentRef.current = next;
    const layout = layoutRef.current;
    if (!layout) return;

    layout.style.setProperty('--soridraw-lite-split-percent', `${next}%`);
    const splitter = splitterRef.current;
    if (splitter) splitter.setAttribute('aria-valuenow', String(Math.round(next)));
    broadcastPaneWidths(next, layoutWidthRef.current);
  }, [broadcastPaneWidths]);

  const flushPointer = useCallback(() => {
    frameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null || !draggingRef.current) return;

    const width = Math.max(1, layoutWidthRef.current);
    const rawPixel = Math.min(width * (MAX_PERCENT / 100), Math.max(width * (MIN_PERCENT / 100), clientX - layoutLeftRef.current));
    const nextPixel = Math.round(rawPixel);
    if (lastPixelRef.current === nextPixel) return;
    lastPixelRef.current = nextPixel;
    applyPercent((nextPixel / width) * 100);
  }, [applyPercent]);

  const schedulePointer = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPointer);
  }, [flushPointer]);

  const finishDrag = useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    if (event && event.pointerId !== pointerIdRef.current) return;

    if (event) schedulePointer(event.clientX);
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      flushPointer();
    }

    draggingRef.current = false;
    pointerIdRef.current = -1;
    layoutRef.current?.classList.remove('is-dragging');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    try {
      window.localStorage.setItem(STORAGE_KEY, String(percentRef.current));
    } catch {
      // Persistence is optional for the performance test.
    }
  }, [flushPointer, schedulePointer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const layout = layoutRef.current;
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    if (rect.width <= 0) return;

    layoutWidthRef.current = rect.width;
    layoutLeftRef.current = rect.left;
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    pendingClientXRef.current = null;
    lastPixelRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    layout.classList.add('is-dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || event.pointerId !== pointerIdRef.current) return;
    schedulePointer(event.clientX);
  };

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    layout.style.setProperty('--soridraw-lite-split-percent', `${percentRef.current}%`);

    const rect = layout.getBoundingClientRect();
    layoutWidthRef.current = Math.max(1, rect.width);
    layoutLeftRef.current = rect.left;

    const initialFrame = window.requestAnimationFrame(() => {
      broadcastPaneWidths(percentRef.current, layoutWidthRef.current);
    });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || draggingRef.current) return;
        const borderSize = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
        const width = borderSize?.inlineSize || entry.contentRect.width;
        if (!Number.isFinite(width) || width <= 0) return;
        layoutWidthRef.current = width;
        // The outer layout itself changed (window/rail), not the divider.
        // One rect read here refreshes the X origin outside the drag hot path.
        layoutLeftRef.current = layout.getBoundingClientRect().left;
        broadcastPaneWidths(percentRef.current, width);
      });
      try {
        observer.observe(layout, { box: 'border-box' });
      } catch {
        observer.observe(layout);
      }
    }

    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer?.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [broadcastPaneWidths]);

  useEffect(() => {
    const handleWindowPointerUp = () => finishDrag();
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleWindowPointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [finishDrag]);

  return (
    <div
      ref={layoutRef}
      className="soridraw-lite-split-workspace"
      style={{ '--soridraw-lite-split-percent': `${percentRef.current}%` } as React.CSSProperties}
      data-split-engine="lite-v2"
    >
      <div ref={leftPaneRef} className="soridraw-lite-split-pane is-left" data-soridraw-lite-pane="left">
        {panes[0] ?? null}
      </div>
      <div ref={rightPaneRef} className="soridraw-lite-split-pane is-right" data-soridraw-lite-pane="right">
        {panes[1] ?? null}
      </div>
      <button
        ref={splitterRef}
        type="button"
        className="soridraw-lite-splitter"
        aria-label="뮤직노트와 라이브러리 영역 너비 조절"
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        aria-valuenow={Math.round(percentRef.current)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
