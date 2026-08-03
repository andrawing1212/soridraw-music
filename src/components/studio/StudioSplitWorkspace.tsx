import React, {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'soridraw_studio_black_split_percent_v1';
const BUILDER_COLLAPSED_STORAGE_KEY = 'soridraw_studio_black_builder_collapsed_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
// Align the builder's mobile composition with the top-nav "라이브러리" label:
// the split line reaches the first "라" at roughly an 820px builder width.
const BUILDER_MOBILE_BREAKPOINT = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const PANE_MODE_HYSTERESIS = 30;
const WIDE_DESKTOP_ISOLATION_BREAKPOINT = 1600;
const ISOLATED_WORKSPACE_BOTTOM_GAP = 0;

type PaneMode = 'mobile' | 'desktop';

type LayoutMetrics = {
  left: number;
  width: number;
  leftRailEdge: number;
};

type ExternalSplitControls = {
  searchButton: HTMLElement | null;
  floatingActionBar: HTMLElement | null;
  collapsedActionButton: HTMLElement | null;
  liveKeywords: HTMLElement | null;
};

const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

const readStoredBuilderCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(BUILDER_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

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
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(readStoredBuilderCollapsed);
  const draggingRef = useRef(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const builderCollapseToggleRef = useRef<HTMLButtonElement | null>(null);
  const percentRef = useRef(percent);
  const builderCollapsedRef = useRef(isBuilderCollapsed);
  const metricsRef = useRef<LayoutMetrics>({ left: 0, width: 1, leftRailEdge: 0 });
  const modeRef = useRef<{ builder: PaneMode; result: PaneMode }>({
    builder: 'desktop',
    result: 'desktop',
  });
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startPercent: DEFAULT_PERCENT,
    width: 1,
    startBuilderPixel: 0,
  });
  const pendingClientXRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const footerFrameRef = useRef<number | null>(null);
  const lastDragBuilderPixelRef = useRef<number | null>(null);
  const lastAriaPercentRef = useRef<number | null>(null);
  const externalControlsReadyRef = useRef(false);
  const lastIsolatedWorkspaceHeightRef = useRef<number | null>(null);
  const lastTopCardHeightRef = useRef<number | null>(null);
  const externalControlsRef = useRef<ExternalSplitControls>({
    searchButton: null,
    floatingActionBar: null,
    collapsedActionButton: null,
    liveKeywords: null,
  });

  const isStudioBlack = useCallback(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.soridrawTheme === 'studio-black', []);

  const syncResultTitleHeight = useCallback(() => {
    if (draggingRef.current) return;

    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result || !isStudioBlack() || builderCollapsedRef.current) {
      result?.style.removeProperty('--soridraw-studio-top-card-height');
      lastTopCardHeightRef.current = null;
      return;
    }

    const genreCard = builder.querySelector<HTMLElement>('[data-studio-menu="genre"]');
    if (!genreCard) return;

    const summary = genreCard.querySelector<HTMLElement>('.soridraw-expand-summary');
    if (summary?.dataset.expanded === 'true') return;

    const nextHeight = Math.round(genreCard.getBoundingClientRect().height);
    if (!Number.isFinite(nextHeight) || nextHeight < 160) return;
    if (lastTopCardHeightRef.current === nextHeight) return;

    lastTopCardHeightRef.current = nextHeight;
    result.style.setProperty('--soridraw-studio-top-card-height', `${nextHeight}px`);
  }, [isStudioBlack]);

  const clearRootMeasurements = useCallback(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    delete root.dataset.soridrawBuilderMode;
    delete root.dataset.soridrawResultMode;
    root.style.removeProperty('--soridraw-studio-builder-left');
    root.style.removeProperty('--soridraw-studio-builder-right');
    root.style.removeProperty('--soridraw-studio-builder-width');
    root.style.removeProperty('--soridraw-studio-left-rail-edge');
    root.style.removeProperty('--soridraw-studio-splitter-left');
    root.style.removeProperty('--soridraw-studio-splitter-bottom');
    root.style.removeProperty('--soridraw-studio-action-footer-offset');
    root.style.removeProperty('--soridraw-studio-result-left');
    root.style.removeProperty('--soridraw-studio-result-right');
  }, []);

  const clearExternalMeasurements = useCallback(() => {
    lastActionControlPixelRef.current = null;
    externalControlsReadyRef.current = false;
  }, []);

  const lastActionControlPixelRef = useRef<number | null>(null);

  const commitRootMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const root = document.documentElement;
    const { left, leftRailEdge } = metricsRef.current;
    root.style.setProperty('--soridraw-studio-builder-left', `${Math.max(0, left)}px`);
    root.style.setProperty('--soridraw-studio-builder-right', `${Math.max(0, window.innerWidth - (left + builderWidth))}px`);
    root.style.setProperty('--soridraw-studio-builder-width', `${Math.max(0, builderWidth)}px`);
    root.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, leftRailEdge)}px`);
    root.style.setProperty('--soridraw-studio-splitter-left', `${Math.max(0, splitterLeft)}px`);
    root.style.setProperty('--soridraw-studio-result-left', `${Math.max(0, splitterLeft + 18)}px`);
    root.style.setProperty(
      '--soridraw-studio-result-right',
      `${Math.max(0, window.innerWidth - (metricsRef.current.left + metricsRef.current.width))}px`,
    );
  }, []);

  const refreshSplitterFooterBoundary = useCallback(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const setRootPropertyIfChanged = (name: string, value: string | null) => {
      const currentValue = root.style.getPropertyValue(name);
      if (value === null) {
        if (currentValue) root.style.removeProperty(name);
        return;
      }
      if (currentValue !== value) root.style.setProperty(name, value);
    };

    if (!isStudioBlack()) {
      setRootPropertyIfChanged('--soridraw-studio-splitter-bottom', null);
      setRootPropertyIfChanged('--soridraw-studio-action-footer-offset', null);
      return;
    }

    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (!footer) {
      setRootPropertyIfChanged('--soridraw-studio-splitter-bottom', '0px');
      setRootPropertyIfChanged('--soridraw-studio-action-footer-offset', '0px');
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    const maximumBottom = Math.max(0, window.innerHeight - 58);
    const footerOverlap = Math.max(0, window.innerHeight - footerTop);
    const overlapValue = `${Math.min(maximumBottom, footerOverlap)}px`;
    setRootPropertyIfChanged(
      '--soridraw-studio-splitter-bottom',
      window.innerWidth >= 1100 ? overlapValue : null,
    );
    setRootPropertyIfChanged('--soridraw-studio-action-footer-offset', overlapValue);
  }, [isStudioBlack]);

  const scheduleFooterBoundaryRefresh = useCallback(() => {
    if (draggingRef.current || footerFrameRef.current !== null) return;
    footerFrameRef.current = window.requestAnimationFrame(() => {
      footerFrameRef.current = null;
      refreshSplitterFooterBoundary();
    });
  }, [refreshSplitterFooterBoundary]);

  const refreshWorkspaceIsolation = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const shouldIsolate = isStudioBlack()
      && window.innerWidth >= WIDE_DESKTOP_ISOLATION_BREAKPOINT;
    if (!shouldIsolate) {
      delete layout.dataset.scrollIsolated;
      layout.style.removeProperty('--soridraw-studio-isolated-height');
      layout.style.removeProperty('height');
      lastIsolatedWorkspaceHeightRef.current = null;
      return;
    }

    const rect = layout.getBoundingClientRect();
    const visibleTop = Math.max(58, Math.min(window.innerHeight - 1, rect.top));
    const parentBottomPadding = layout.parentElement
      ? Number.parseFloat(window.getComputedStyle(layout.parentElement).paddingBottom) || 0
      : 0;
    const nextHeight = Math.max(
      1,
      Math.floor(
        window.innerHeight
        - visibleTop
        - parentBottomPadding
        - ISOLATED_WORKSPACE_BOTTOM_GAP,
      ),
    );

    layout.dataset.scrollIsolated = 'true';
    if (lastIsolatedWorkspaceHeightRef.current !== nextHeight) {
      lastIsolatedWorkspaceHeightRef.current = nextHeight;
      layout.style.setProperty('--soridraw-studio-isolated-height', `${nextHeight}px`);
      layout.style.height = `${nextHeight}px`;
    }
  }, [isStudioBlack]);

  const resolvePaneMode = useCallback((
    width: number,
    breakpoint: number,
    currentMode: PaneMode,
  ): PaneMode => {
    if (currentMode === 'desktop') {
      return width < breakpoint - PANE_MODE_HYSTERESIS ? 'mobile' : 'desktop';
    }
    return width > breakpoint + PANE_MODE_HYSTERESIS ? 'desktop' : 'mobile';
  }, []);

  const applyPercentToLayout = useCallback((rawPercent: number) => {
    const nextPercent = clamp(rawPercent);
    percentRef.current = nextPercent;

    const root = document.documentElement;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;

    const { width } = metricsRef.current;
    const safeWidth = Math.max(width, 1);
    const builderWidth = builderCollapsedRef.current ? 0 : Math.round(safeWidth * (nextPercent / 100));

    // Single CSS variable updates split position for all components simultaneously:
    root.style.setProperty('--soridraw-studio-builder-width', `${builderWidth}px`);
    root.style.setProperty('--studio-split-x', `${builderWidth}px`);

    // During drag, skip JS pane-mode dataset mutations for maximum FPS
    if (!draggingRef.current) {
      const resultWidth = Math.max(0, safeWidth - builderWidth);
      const nextBuilderMode = builderCollapsedRef.current
        ? modeRef.current.builder
        : resolvePaneMode(
            builderWidth,
            BUILDER_MOBILE_BREAKPOINT,
            modeRef.current.builder,
          );
      const nextResultMode = resolvePaneMode(
        resultWidth,
        RESULT_MOBILE_BREAKPOINT,
        modeRef.current.result,
      );

      if (!builderCollapsedRef.current && modeRef.current.builder !== nextBuilderMode) {
        modeRef.current.builder = nextBuilderMode;
        if (builder) builder.dataset.paneMode = nextBuilderMode;
      }
      if (modeRef.current.result !== nextResultMode) {
        modeRef.current.result = nextResultMode;
        if (result) result.dataset.paneMode = nextResultMode;
      }
    }

    const roundedPercent = Math.round(nextPercent);
    if (lastAriaPercentRef.current !== roundedPercent) {
      lastAriaPercentRef.current = roundedPercent;
      splitter?.setAttribute('aria-valuenow', String(roundedPercent));
    }
    return nextPercent;
  }, [resolvePaneMode]);

  const refreshLayoutMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout || !isStudioBlack()) {
      clearRootMeasurements();
      return;
    }

    refreshWorkspaceIsolation();
    const rect = layout.getBoundingClientRect();
    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: Math.max(rect.width, 1),
      leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
    };
    const appliedPercent = applyPercentToLayout(percentRef.current);
    const builderWidth = builderCollapsedRef.current
      ? 0
      : metricsRef.current.width * (appliedPercent / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    refreshSplitterFooterBoundary();
  }, [applyPercentToLayout, clearExternalMeasurements, clearRootMeasurements, commitRootMeasurements, isStudioBlack, refreshSplitterFooterBoundary, refreshWorkspaceIsolation]);

  useLayoutEffect(() => {
    percentRef.current = percent;
    const frame = window.requestAnimationFrame(refreshLayoutMetrics);
    return () => window.cancelAnimationFrame(frame);
  }, [percent, refreshLayoutMetrics]);

  useLayoutEffect(() => {
    builderCollapsedRef.current = isBuilderCollapsed;
    const root = document.documentElement;
    if (isBuilderCollapsed) {
      root.dataset.soridrawBuilderCollapsed = 'true';
    } else {
      delete root.dataset.soridrawBuilderCollapsed;
    }

    const layout = layoutRef.current;
    if (layout) {
      if (isBuilderCollapsed) layout.dataset.builderCollapsed = 'true';
      else delete layout.dataset.builderCollapsed;
    }

    if (isBuilderCollapsed && resultRef.current) {
      resultRef.current.scrollTop = 0;
    }

    const frame = window.requestAnimationFrame(() => {
      refreshLayoutMetrics();
      if (isBuilderCollapsed && resultRef.current) {
        resultRef.current.scrollTop = 0;
      }
      window.dispatchEvent(new CustomEvent('soridraw-studio-builder-collapse-change', {
        detail: { collapsed: isBuilderCollapsed },
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isBuilderCollapsed, refreshLayoutMetrics]);

  useEffect(() => {
    try {
      window.localStorage.setItem(BUILDER_COLLAPSED_STORAGE_KEY, String(isBuilderCollapsed));
    } catch { /* ignore */ }
  }, [isBuilderCollapsed]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(percent)); } catch { /* ignore */ }
  }, [percent]);

  useEffect(() => {
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result || typeof ResizeObserver === 'undefined') return;

    let observedCard: HTMLElement | null = null;
    const observer = new ResizeObserver(() => syncResultTitleHeight());
    const connect = () => {
      const nextCard = builder.querySelector<HTMLElement>('[data-studio-menu="genre"]');
      if (nextCard !== observedCard) {
        if (observedCard) observer.unobserve(observedCard);
        observedCard = nextCard;
        if (observedCard) observer.observe(observedCard);
      }
      syncResultTitleHeight();
    };

    connect();
    const frame = window.requestAnimationFrame(connect);
    const themeObserver = new MutationObserver(syncResultTitleHeight);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-soridraw-theme'],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      result.style.removeProperty('--soridraw-studio-top-card-height');
      lastTopCardHeightRef.current = null;
    };
  }, [syncResultTitleHeight]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!draggingRef.current) refreshLayoutMetrics();
    });
    if (layoutRef.current) observer.observe(layoutRef.current);
    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (footer) observer.observe(footer);

    const themeObserver = new MutationObserver(refreshLayoutMetrics);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-soridraw-theme'] });
    window.addEventListener('resize', refreshLayoutMetrics);
    window.addEventListener('soridraw-studio-frame-resize', refreshLayoutMetrics as EventListener);
    window.addEventListener('scroll', scheduleFooterBoundaryRefresh, { passive: true });
    scheduleFooterBoundaryRefresh();

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', refreshLayoutMetrics);
      window.removeEventListener('soridraw-studio-frame-resize', refreshLayoutMetrics as EventListener);
      window.removeEventListener('scroll', scheduleFooterBoundaryRefresh);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      if (footerFrameRef.current !== null) {
        window.cancelAnimationFrame(footerFrameRef.current);
        footerFrameRef.current = null;
      }
      if (draggingRef.current) {
        draggingRef.current = false;
        window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
      }
      layoutRef.current?.classList.remove('is-dragging');
      if (layoutRef.current) {
        delete layoutRef.current.dataset.scrollIsolated;
        layoutRef.current.style.removeProperty('--soridraw-studio-isolated-height');
        layoutRef.current.style.removeProperty('height');
      }
      lastIsolatedWorkspaceHeightRef.current = null;
      document.documentElement.classList.remove('soridraw-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      clearExternalMeasurements();
      clearRootMeasurements();
      delete document.documentElement.dataset.soridrawBuilderCollapsed;
    };
  }, [clearExternalMeasurements, clearRootMeasurements, refreshLayoutMetrics, scheduleFooterBoundaryRefresh]);

  const flushPendingPointer = useCallback(() => {
    dragFrameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null) return;

    const { startX, width, startBuilderPixel } = dragRef.current;
    const safeWidth = Math.max(width, 1);
    const deltaX = clientX - startX;
    const minPixel = Math.round(safeWidth * (MIN_PERCENT / 100));
    const maxPixel = Math.round(safeWidth * (MAX_PERCENT / 100));
    const nextBuilderPixel = Math.min(maxPixel, Math.max(minPixel, Math.round(startBuilderPixel + deltaX)));

    if (lastDragBuilderPixelRef.current === nextBuilderPixel) return;
    lastDragBuilderPixelRef.current = nextBuilderPixel;

    applyPercentToLayout((nextBuilderPixel / safeWidth) * 100);
  }, [applyPercentToLayout]);

  const schedulePointerUpdate = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(flushPendingPointer);
  }, [flushPendingPointer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isStudioBlack() || builderCollapsedRef.current) return;
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const safeWidth = Math.max(rect.width, 1);
    const startBuilderPixel = builderCollapsedRef.current
      ? 0
      : Math.round(safeWidth * (percentRef.current / 100));

    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    const leftRailEdge = leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left;

    metricsRef.current = {
      left: rect.left,
      width: safeWidth,
      leftRailEdge,
    };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPercent: percentRef.current,
      width: safeWidth,
      startBuilderPixel,
    };
    pendingClientXRef.current = null;
    lastDragBuilderPixelRef.current = null;

    const root = document.documentElement;
    root.style.setProperty('--soridraw-studio-builder-left', `${Math.max(0, rect.left)}px`);
    root.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, leftRailEdge)}px`);

    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    draggingRef.current = true;
    layoutRef.current?.classList.add('is-dragging');
    document.documentElement.classList.add('soridraw-split-dragging');
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-start'));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || event.pointerId !== dragRef.current.pointerId) return;
    const nativeEvent = event.nativeEvent as PointerEvent;
    const coalesced = typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [];
    const latestEvent = coalesced.length > 0 ? coalesced[coalesced.length - 1] : nativeEvent;
    schedulePointerUpdate(latestEvent.clientX);
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
    layoutRef.current?.classList.remove('is-dragging');
    document.documentElement.classList.remove('soridraw-split-dragging');
    lastDragBuilderPixelRef.current = null;

    const builderWidth = builderCollapsedRef.current
      ? 0
      : Math.round(metricsRef.current.width * (percentRef.current / 100));

    // Update dataset pane mode once on drag end
    const builder = builderRef.current;
    const result = resultRef.current;
    if (builder) {
      const nextBuilderMode = resolvePaneMode(builderWidth, BUILDER_MOBILE_BREAKPOINT, modeRef.current.builder);
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
    }
    const resultWidth = Math.max(0, metricsRef.current.width - builderWidth);
    if (result) {
      const nextResultMode = resolvePaneMode(resultWidth, RESULT_MOBILE_BREAKPOINT, modeRef.current.result);
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
    }

    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    scheduleFooterBoundaryRefresh();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    window.requestAnimationFrame(syncResultTitleHeight);
    setPercent(percentRef.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (builderCollapsedRef.current) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextPercent = applyPercentToLayout(
      percentRef.current + (event.key === 'ArrowRight' ? 2 : -2),
    );
    const builderWidth = metricsRef.current.width * (nextPercent / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    setPercent(nextPercent);
  };

  const builderCollapseControl = (
    <button
      ref={builderCollapseToggleRef}
      type="button"
      className={`soridraw-studio-builder-collapse-toggle${isBuilderCollapsed ? ' is-collapsed' : ''}`}
      onClick={() => setIsBuilderCollapsed((current) => !current)}
      aria-label={isBuilderCollapsed ? '곡 만들기 메뉴 펼치기' : '곡 만들기 메뉴 접기'}
      title={isBuilderCollapsed ? '곡 만들기 메뉴 펼치기' : '곡 만들기 메뉴 접기'}
      aria-expanded={!isBuilderCollapsed}
      aria-controls="soridraw-studio-builder-pane"
    >
      <span className="soridraw-studio-panel-toggle-icon" aria-hidden="true" />
    </button>
  );

  const splitterControl = (
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
  );

  return (
    <>
      <div ref={layoutRef} className={`soridraw-studio-split-workspace${isBuilderCollapsed ? ' is-builder-collapsed' : ''}`}>
        <div id="soridraw-studio-builder-pane" ref={builderRef} className="soridraw-studio-builder-pane" aria-hidden={isBuilderCollapsed}>
          {panes[0] ?? null}
        </div>
        <div ref={resultRef} className="soridraw-studio-result-pane">
          {panes[1] ?? null}
        </div>
      </div>
      {typeof document !== 'undefined' ? createPortal(splitterControl, document.body) : splitterControl}
      {typeof document !== 'undefined' ? createPortal(builderCollapseControl, document.body) : builderCollapseControl}
    </>
  );
}

