import React, {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const STORAGE_KEY = 'soridraw_studio_black_split_percent_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
const BUILDER_MOBILE_BREAKPOINT = 900;
const RESULT_MOBILE_BREAKPOINT = 720;

type PaneMode = 'mobile' | 'desktop';

type LayoutMetrics = {
  left: number;
  width: number;
};

const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

const readStored = () => {
  if (typeof window === 'undefined') return DEFAULT_PERCENT;
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) ? clamp(value) : DEFAULT_PERCENT;
  } catch {
    return DEFAULT_PERCENT;
  }
};

export function StudioBuilderPane({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function StudioResultPane({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function StudioSplitWorkspace({ children }: { children: ReactNode }) {
  const panes = Children.toArray(children);
  const [percent, setPercent] = useState(readStored);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const percentRef = useRef(percent);
  const metricsRef = useRef<LayoutMetrics>({ left: 0, width: 1 });
  const modeRef = useRef<{ builder: PaneMode; result: PaneMode }>({
    builder: 'desktop',
    result: 'desktop',
  });
  const dragRef = useRef({ pointerId: -1, startX: 0, startPercent: DEFAULT_PERCENT, width: 1 });
  const pendingClientXRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const footerFrameRef = useRef<number | null>(null);

  const isStudioBlack = useCallback(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.soridrawTheme === 'studio-black', []);

  const clearRootMeasurements = useCallback(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    delete root.dataset.soridrawBuilderMode;
    delete root.dataset.soridrawResultMode;
    root.style.removeProperty('--soridraw-studio-builder-left');
    root.style.removeProperty('--soridraw-studio-builder-right');
    root.style.removeProperty('--soridraw-studio-builder-width');
    root.style.removeProperty('--soridraw-studio-splitter-left');
    root.style.removeProperty('--soridraw-studio-splitter-bottom');
  }, []);

  const refreshSplitterFooterBoundary = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!isStudioBlack() || window.innerWidth < 1100) {
      document.documentElement.style.removeProperty('--soridraw-studio-splitter-bottom');
      return;
    }

    const root = document.documentElement;
    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (!footer) {
      root.style.setProperty('--soridraw-studio-splitter-bottom', '0px');
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    const maximumBottom = Math.max(0, window.innerHeight - 58);
    const footerOverlap = Math.max(0, window.innerHeight - footerTop);
    root.style.setProperty(
      '--soridraw-studio-splitter-bottom',
      `${Math.min(maximumBottom, footerOverlap)}px`,
    );
  }, [isStudioBlack]);

  const scheduleFooterBoundaryRefresh = useCallback(() => {
    if (footerFrameRef.current !== null) return;
    footerFrameRef.current = window.requestAnimationFrame(() => {
      footerFrameRef.current = null;
      refreshSplitterFooterBoundary();
    });
  }, [refreshSplitterFooterBoundary]);

  /**
   * Apply the split directly to DOM/CSS variables.
   *
   * Pointer movement must not call React setState on every event. Doing so made
   * the entire Studio tree reconcile and then wait for ResizeObserver before the
   * fixed splitter/action bar caught up. Direct CSS writes keep the grid,
   * splitter, search button and portal action bar in the same animation frame.
   */
  const applyPercentToLayout = useCallback((rawPercent: number) => {
    const nextPercent = clamp(rawPercent);
    percentRef.current = nextPercent;

    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;

    if (!layout || !builder || !result || !isStudioBlack()) {
      clearRootMeasurements();
      return nextPercent;
    }

    const root = document.documentElement;
    const { left, width } = metricsRef.current;
    const safeWidth = Math.max(width, 1);
    const builderWidth = safeWidth * (nextPercent / 100);
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = left + builderWidth;

    layout.style.setProperty('--soridraw-studio-builder-percent', `${nextPercent}%`);
    root.style.setProperty('--soridraw-studio-builder-left', `${Math.max(0, left)}px`);
    root.style.setProperty('--soridraw-studio-builder-right', `${Math.max(0, window.innerWidth - (left + builderWidth))}px`);
    root.style.setProperty('--soridraw-studio-builder-width', `${Math.max(0, builderWidth)}px`);
    root.style.setProperty('--soridraw-studio-splitter-left', `${Math.max(0, splitterLeft)}px`);

    const nextBuilderMode: PaneMode = builderWidth < BUILDER_MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
    const nextResultMode: PaneMode = resultWidth < RESULT_MOBILE_BREAKPOINT ? 'mobile' : 'desktop';

    if (modeRef.current.builder !== nextBuilderMode || builder.dataset.paneMode !== nextBuilderMode) {
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
    }
    if (root.dataset.soridrawBuilderMode !== nextBuilderMode) {
      root.dataset.soridrawBuilderMode = nextBuilderMode;
    }

    if (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode) {
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
    }
    if (root.dataset.soridrawResultMode !== nextResultMode) {
      root.dataset.soridrawResultMode = nextResultMode;
    }

    splitter?.setAttribute('aria-valuenow', String(Math.round(nextPercent)));
    return nextPercent;
  }, [clearRootMeasurements, isStudioBlack]);

  const refreshLayoutMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout || !isStudioBlack()) {
      clearRootMeasurements();
      return;
    }

    const rect = layout.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: Math.max(rect.width, 1),
    };
    applyPercentToLayout(percentRef.current);
    refreshSplitterFooterBoundary();
  }, [applyPercentToLayout, clearRootMeasurements, isStudioBlack, refreshSplitterFooterBoundary]);

  useLayoutEffect(() => {
    percentRef.current = percent;
    const frame = window.requestAnimationFrame(refreshLayoutMetrics);
    return () => window.cancelAnimationFrame(frame);
  }, [percent, refreshLayoutMetrics]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(percent)); } catch { /* ignore */ }
  }, [percent]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // ResizeObserver can fire repeatedly while the grid is being dragged.
      // During an active drag the pointer-frame path already owns measurements,
      // so avoid a second competing update loop.
      if (!draggingRef.current) refreshLayoutMetrics();
      else scheduleFooterBoundaryRefresh();
    });
    if (layoutRef.current) observer.observe(layoutRef.current);
    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (footer) observer.observe(footer);

    const themeObserver = new MutationObserver(refreshLayoutMetrics);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-soridraw-theme'] });
    window.addEventListener('resize', refreshLayoutMetrics);
    window.addEventListener('scroll', scheduleFooterBoundaryRefresh, { passive: true });
    scheduleFooterBoundaryRefresh();

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', refreshLayoutMetrics);
      window.removeEventListener('scroll', scheduleFooterBoundaryRefresh);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      if (footerFrameRef.current !== null) {
        window.cancelAnimationFrame(footerFrameRef.current);
        footerFrameRef.current = null;
      }
      draggingRef.current = false;
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      clearRootMeasurements();
    };
  }, [clearRootMeasurements, refreshLayoutMetrics, scheduleFooterBoundaryRefresh]);

  const flushPendingPointer = useCallback(() => {
    dragFrameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null) return;

    const { startX, startPercent, width } = dragRef.current;
    const deltaPercent = ((clientX - startX) / Math.max(width, 1)) * 100;
    applyPercentToLayout(startPercent + deltaPercent);
  }, [applyPercentToLayout]);

  const schedulePointerUpdate = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(flushPendingPointer);
  }, [flushPendingPointer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isStudioBlack()) return;
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    metricsRef.current = { left: rect.left, width: rect.width };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPercent: percentRef.current,
      width: rect.width,
    };
    pendingClientXRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || event.pointerId !== dragRef.current.pointerId) return;
    schedulePointerUpdate(event.clientX);
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragRef.current.pointerId) return;

    pendingClientXRef.current = event.clientX;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    flushPendingPointer();

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    draggingRef.current = false;
    setDragging(false);
    setPercent(percentRef.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextPercent = applyPercentToLayout(
      percentRef.current + (event.key === 'ArrowRight' ? 2 : -2),
    );
    setPercent(nextPercent);
  };

  return (
    <div ref={layoutRef} className={`soridraw-studio-split-workspace ${dragging ? 'is-dragging' : ''}`}>
      <div ref={builderRef} className="soridraw-studio-builder-pane">{panes[0] ?? null}</div>
      <button
        ref={splitterRef}
        type="button"
        className="soridraw-studio-splitter"
        aria-label="곡 만들기와 생성 결과 영역 너비 조절"
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        aria-valuenow={Math.round(percent)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={handleKeyDown}
      ><span /></button>
      <div ref={resultRef} className="soridraw-studio-result-pane">{panes[1] ?? null}</div>
    </div>
  );
}
