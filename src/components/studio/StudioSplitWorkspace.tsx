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
// Align the builder's mobile composition with the top-nav "라이브러리" label:
// the split line reaches the first "라" at roughly an 820px builder width.
const BUILDER_MOBILE_BREAKPOINT = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const PANE_MODE_HYSTERESIS = 16;
const ACTION_CONTROL_PIXEL_STEP = 8;
// Wide desktop panes contain substantially more text and cards than the tablet bridge.
// Keep the visual divider at display refresh speed, but cap expensive live pane
// re-layouts to about 33fps only on >=1600px viewports. Tablet keeps full-rate resize.
const WIDE_DESKTOP_LAYOUT_INTERVAL_MS = 30;

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
  const draggingRef = useRef(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const percentRef = useRef(percent);
  const metricsRef = useRef<LayoutMetrics>({ left: 0, width: 1, leftRailEdge: 0 });
  const modeRef = useRef<{ builder: PaneMode; result: PaneMode }>({
    builder: 'desktop',
    result: 'desktop',
  });
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startPercent: DEFAULT_PERCENT,
    startBuilderPixel: 0,
    width: 1,
  });
  const pendingClientXRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const footerFrameRef = useRef<number | null>(null);
  const lastDragBuilderPixelRef = useRef<number | null>(null);
  const lastCommittedBuilderPixelRef = useRef<number | null>(null);
  const lastPaneLayoutTimeRef = useRef(0);
  const lastAriaPercentRef = useRef<number | null>(null);
  const lastActionControlPixelRef = useRef<number | null>(null);
  const externalControlsReadyRef = useRef(false);
  const externalControlsRef = useRef<ExternalSplitControls>({
    searchButton: null,
    floatingActionBar: null,
    collapsedActionButton: null,
  });

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
    root.style.removeProperty('--soridraw-studio-left-rail-edge');
    root.style.removeProperty('--soridraw-studio-splitter-left');
    root.style.removeProperty('--soridraw-studio-splitter-bottom');
    root.style.removeProperty('--soridraw-studio-action-footer-offset');
  }, []);

  const readExternalControls = useCallback((force = false) => {
    const current = externalControlsRef.current;
    if (force || !externalControlsReadyRef.current) {
      current.searchButton = document.querySelector<HTMLElement>('.soridraw-studio-hero-search-button');
      current.floatingActionBar = document.querySelector<HTMLElement>(
        'body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]',
      );
      current.collapsedActionButton = document.querySelector<HTMLElement>(
        'body > .soridraw-studio-action-collapsed',
      );
      externalControlsReadyRef.current = true;
    }
    return current;
  }, []);

  const clearExternalMeasurements = useCallback(() => {
    const { searchButton, floatingActionBar, collapsedActionButton } = externalControlsRef.current;
    searchButton?.style.removeProperty('right');
    if (floatingActionBar) {
      floatingActionBar.style.removeProperty('left');
      floatingActionBar.style.removeProperty('width');
      floatingActionBar.style.removeProperty('--soridraw-studio-builder-width');
    }
    if (collapsedActionButton) {
      collapsedActionButton.style.removeProperty('--soridraw-studio-builder-width');
      collapsedActionButton.style.removeProperty('--soridraw-studio-left-rail-edge');
    }
    splitterRef.current?.style.removeProperty('left');
    splitterRef.current?.style.removeProperty('--soridraw-split-preview-x');
    lastActionControlPixelRef.current = null;
    externalControlsReadyRef.current = false;
  }, []);

  const syncExternalMeasurements = useCallback((
    builderWidth: number,
    splitterLeft: number,
    updateSplitter = true,
  ) => {
    const { left, leftRailEdge } = metricsRef.current;
    const controls = readExternalControls();
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));

    // The divider and search control remain pixel-accurate on every layout frame.
    // Search is positioned inside the center/hero width, not against the full
    // viewport. Using window.innerWidth included the right dashboard rail and
    // made the icon jump far left while the divider was moving.
    if (updateSplitter) {
      splitterRef.current?.style.setProperty('left', `${Math.max(0, Math.round(splitterLeft) - 8)}px`);
    }
    controls.searchButton?.style.setProperty(
      'right',
      `${Math.max(18, Math.round(metricsRef.current.width - roundedBuilderWidth + 18))}px`,
      'important',
    );

    // The portal action controls contain their own responsive layout and were
    // causing a second full reflow for every single divider pixel. Their visual
    // width now follows in tiny 8px steps while the real panes remain live.
    const actionControlPixel = Math.round(roundedBuilderWidth / ACTION_CONTROL_PIXEL_STEP)
      * ACTION_CONTROL_PIXEL_STEP;
    if (lastActionControlPixelRef.current === actionControlPixel) return;
    lastActionControlPixelRef.current = actionControlPixel;

    if (controls.floatingActionBar) {
      controls.floatingActionBar.style.setProperty('left', `${Math.max(0, Math.round(left))}px`, 'important');
      controls.floatingActionBar.style.setProperty('width', `${actionControlPixel}px`, 'important');
      controls.floatingActionBar.style.setProperty('--soridraw-studio-builder-width', `${actionControlPixel}px`);
    }
    if (controls.collapsedActionButton) {
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-builder-width', `${actionControlPixel}px`);
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, Math.round(leftRailEdge))}px`);
    }
  }, [readExternalControls]);

  const commitRootMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const root = document.documentElement;
    const { left, leftRailEdge } = metricsRef.current;
    root.style.setProperty('--soridraw-studio-builder-left', `${Math.max(0, left)}px`);
    root.style.setProperty('--soridraw-studio-builder-right', `${Math.max(0, window.innerWidth - (left + builderWidth))}px`);
    root.style.setProperty('--soridraw-studio-builder-width', `${Math.max(0, builderWidth)}px`);
    root.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, leftRailEdge)}px`);
    root.style.setProperty('--soridraw-studio-splitter-left', `${Math.max(0, splitterLeft)}px`);
  }, []);

  const refreshSplitterFooterBoundary = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!isStudioBlack()) {
      document.documentElement.style.removeProperty('--soridraw-studio-splitter-bottom');
      document.documentElement.style.removeProperty('--soridraw-studio-action-footer-offset');
      return;
    }

    const root = document.documentElement;
    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (!footer) {
      root.style.setProperty('--soridraw-studio-splitter-bottom', '0px');
      root.style.setProperty('--soridraw-studio-action-footer-offset', '0px');
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    const maximumBottom = Math.max(0, window.innerHeight - 58);
    const footerOverlap = Math.max(0, window.innerHeight - footerTop);
    if (window.innerWidth >= 1100) {
      root.style.setProperty(
        '--soridraw-studio-splitter-bottom',
        `${Math.min(maximumBottom, footerOverlap)}px`,
      );
    } else {
      root.style.removeProperty('--soridraw-studio-splitter-bottom');
    }
    // The action controls share the footer boundary with the splitter. Their
    // own CSS bottom gap is added on top, so the footer divider always remains
    // visible and the controls return smoothly when the page scrolls upward.
    root.style.setProperty(
      '--soridraw-studio-action-footer-offset',
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

  const resolvePaneMode = useCallback((
    pane: HTMLElement,
    width: number,
    breakpoint: number,
    currentMode: PaneMode,
  ): PaneMode => {
    const hasCommittedMode = pane.dataset.paneMode === 'mobile' || pane.dataset.paneMode === 'desktop';
    if (!hasCommittedMode) return width < breakpoint ? 'mobile' : 'desktop';
    if (currentMode === 'desktop') {
      return width < breakpoint - PANE_MODE_HYSTERESIS ? 'mobile' : 'desktop';
    }
    return width > breakpoint + PANE_MODE_HYSTERESIS ? 'desktop' : 'mobile';
  }, []);

  /**
   * Apply the split directly to DOM/CSS variables.
   *
   * Pointer movement must not call React setState on every event. Doing so made
   * the entire Studio tree reconcile and then wait for ResizeObserver before the
   * fixed splitter/action bar caught up. Direct CSS writes keep the grid,
   * splitter, search button and portal action bar in the same animation frame.
   */
  const applyPercentToLayout = useCallback((
    rawPercent: number,
    options: { updateSplitter?: boolean } = {},
  ) => {
    const nextPercent = clamp(rawPercent);
    percentRef.current = nextPercent;

    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;

    if (!layout || !builder || !result || !isStudioBlack()) {
      layout?.style.removeProperty('grid-template-columns');
      builder?.style.removeProperty('flex-basis');
      clearRootMeasurements();
      return nextPercent;
    }

    const root = document.documentElement;
    const { left, width } = metricsRef.current;
    const safeWidth = Math.max(width, 1);
    const builderWidth = safeWidth * (nextPercent / 100);
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = left + builderWidth;

    // The split workspace uses flex tracks. Updating only the builder's
    // flex-basis gives the browser one simple width owner instead of rebuilding
    // both CSS Grid tracks and every dependent container on every drag frame.
    layout.style.removeProperty('grid-template-columns');
    builder.style.flexBasis = `${Math.max(0, builderWidth)}px`;
    if (draggingRef.current) {
      syncExternalMeasurements(builderWidth, splitterLeft, options.updateSplitter !== false);
    }

    const nextBuilderMode = resolvePaneMode(
      builder,
      builderWidth,
      BUILDER_MOBILE_BREAKPOINT,
      modeRef.current.builder,
    );
    const nextResultMode = resolvePaneMode(
      result,
      resultWidth,
      RESULT_MOBILE_BREAKPOINT,
      modeRef.current.result,
    );

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
    const roundedPercent = Math.round(nextPercent);
    if (lastAriaPercentRef.current !== roundedPercent) {
      lastAriaPercentRef.current = roundedPercent;
      splitter?.setAttribute('aria-valuenow', String(roundedPercent));
    }
    return nextPercent;
  }, [clearRootMeasurements, isStudioBlack, resolvePaneMode, syncExternalMeasurements]);

  const refreshLayoutMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout || !isStudioBlack()) {
      clearRootMeasurements();
      return;
    }

    const rect = layout.getBoundingClientRect();
    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: Math.max(rect.width, 1),
      leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
    };
    const appliedPercent = applyPercentToLayout(percentRef.current);
    const builderWidth = metricsRef.current.width * (appliedPercent / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    splitterRef.current?.style.setProperty('--soridraw-split-preview-x', '0px');
    clearExternalMeasurements();
    refreshSplitterFooterBoundary();
  }, [applyPercentToLayout, clearExternalMeasurements, clearRootMeasurements, commitRootMeasurements, isStudioBlack, refreshSplitterFooterBoundary]);

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
      if (draggingRef.current) {
        draggingRef.current = false;
        window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
      }
      layoutRef.current?.classList.remove('is-dragging');
      document.documentElement.classList.remove('soridraw-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      builderRef.current?.style.removeProperty('flex-basis');
      clearExternalMeasurements();
      clearRootMeasurements();
    };
  }, [clearExternalMeasurements, clearRootMeasurements, refreshLayoutMetrics, scheduleFooterBoundaryRefresh]);

  const flushPendingPointer = useCallback((
    frameTime = window.performance.now(),
    forcePaneLayout = false,
  ) => {
    dragFrameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null) return;

    const { startX, startPercent, startBuilderPixel, width } = dragRef.current;
    const safeWidth = Math.max(width, 1);
    const deltaPercent = ((clientX - startX) / safeWidth) * 100;
    const rawPercent = clamp(startPercent + deltaPercent);
    const nextBuilderPixel = Math.round(safeWidth * (rawPercent / 100));
    if (!forcePaneLayout && lastDragBuilderPixelRef.current === nextBuilderPixel) return;

    lastDragBuilderPixelRef.current = nextBuilderPixel;
    const nextPercent = (nextBuilderPixel / safeWidth) * 100;
    percentRef.current = nextPercent;

    // The fixed divider is a compositor-only preview while dragging. It follows
    // the pointer every animation frame without forcing both large panes to
    // recalculate layout on that same frame. The real panes still resize live,
    // just at a controlled cadence on very wide desktop screens.
    splitterRef.current?.style.setProperty(
      '--soridraw-split-preview-x',
      `${nextBuilderPixel - startBuilderPixel}px`,
    );

    const roundedPercent = Math.round(nextPercent);
    if (lastAriaPercentRef.current !== roundedPercent) {
      lastAriaPercentRef.current = roundedPercent;
      splitterRef.current?.setAttribute('aria-valuenow', String(roundedPercent));
    }

    const layoutInterval = window.innerWidth >= 1600
      ? WIDE_DESKTOP_LAYOUT_INTERVAL_MS
      : 0;
    const elapsed = frameTime - lastPaneLayoutTimeRef.current;
    if (!forcePaneLayout && layoutInterval > 0 && elapsed < layoutInterval) return;
    if (!forcePaneLayout && lastCommittedBuilderPixelRef.current === nextBuilderPixel) return;

    lastPaneLayoutTimeRef.current = frameTime;
    lastCommittedBuilderPixelRef.current = nextBuilderPixel;
    applyPercentToLayout(nextPercent, { updateSplitter: false });
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

    metricsRef.current = {
      left: rect.left,
      width: rect.width,
      leftRailEdge: metricsRef.current.leftRailEdge,
    };
    const startBuilderPixel = rect.width * (percentRef.current / 100);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPercent: percentRef.current,
      startBuilderPixel,
      width: rect.width,
    };
    pendingClientXRef.current = null;
    lastDragBuilderPixelRef.current = Math.round(startBuilderPixel);
    lastCommittedBuilderPixelRef.current = Math.round(startBuilderPixel);
    lastPaneLayoutTimeRef.current = window.performance.now();
    splitterRef.current?.style.setProperty('--soridraw-split-preview-x', '0px');
    readExternalControls(true);
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
    flushPendingPointer(window.performance.now(), true);

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    draggingRef.current = false;
    layoutRef.current?.classList.remove('is-dragging');
    document.documentElement.classList.remove('soridraw-split-dragging');
    lastDragBuilderPixelRef.current = null;
    lastCommittedBuilderPixelRef.current = null;
    lastPaneLayoutTimeRef.current = 0;
    const builderWidth = metricsRef.current.width * (percentRef.current / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    setPercent(percentRef.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
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

  return (
    <div ref={layoutRef} className="soridraw-studio-split-workspace">
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
