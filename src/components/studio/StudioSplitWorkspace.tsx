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
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
// Align the builder's mobile composition with the top-nav "라이브러리" label:
// the split line reaches the first "라" at roughly an 820px builder width.
const BUILDER_MOBILE_BREAKPOINT = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const PANE_MODE_HYSTERESIS = 16;
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
  const dragRef = useRef({ pointerId: -1, startX: 0, startPercent: DEFAULT_PERCENT, width: 1 });
  const pendingClientXRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const footerFrameRef = useRef<number | null>(null);
  const lastDragBuilderPixelRef = useRef<number | null>(null);
  const lastAriaPercentRef = useRef<number | null>(null);
  const lastActionControlPixelRef = useRef<number | null>(null);
  const externalControlsReadyRef = useRef(false);
  const lastIsolatedWorkspaceHeightRef = useRef<number | null>(null);
  const lastMatchedTopCardHeightRef = useRef<number | null>(null);
  const externalControlsRef = useRef<ExternalSplitControls>({
    searchButton: null,
    floatingActionBar: null,
    collapsedActionButton: null,
    liveKeywords: null,
  });

  const isStudioBlack = useCallback(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.soridrawTheme === 'studio-black', []);

  const syncTopCardHeights = useCallback(() => {
    const builder = builderRef.current;
    const result = resultRef.current;
    const genreCard = builder?.querySelector<HTMLElement>('[data-studio-menu="genre"]') ?? null;
    const titleCard = result?.querySelector<HTMLElement>('.soridraw-result-title-card--genre-height') ?? null;

    if (!builder || !result || !genreCard || !titleCard || !isStudioBlack()) {
      genreCard?.style.removeProperty('min-height');
      lastMatchedTopCardHeightRef.current = null;
      return;
    }

    const summary = genreCard.querySelector<HTMLElement>('.soridraw-expand-summary');
    if (summary?.dataset.expanded === 'true') {
      genreCard.style.removeProperty('min-height');
      lastMatchedTopCardHeightRef.current = null;
      return;
    }

    // Preserve the previously verified title-card UI.  The result card keeps
    // its own natural/fixed layout; only the collapsed Genre card grows to the
    // same outer height.  Title edit mode is ignored so opening inputs never
    // stretches the left column.
    if (titleCard.querySelector('input, textarea')) return;

    const nextHeight = Math.round(titleCard.getBoundingClientRect().height);
    if (!Number.isFinite(nextHeight) || nextHeight < 160) return;
    if (lastMatchedTopCardHeightRef.current === nextHeight) return;

    lastMatchedTopCardHeightRef.current = nextHeight;
    genreCard.style.setProperty('min-height', `${nextHeight}px`, 'important');
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
      current.liveKeywords = document.querySelector<HTMLElement>(
        'body > .soridraw-live-keywords-fixed',
      );
      externalControlsReadyRef.current = true;
    }
    return current;
  }, []);

  const clearExternalMeasurements = useCallback(() => {
    const { searchButton, floatingActionBar, collapsedActionButton, liveKeywords } = externalControlsRef.current;
    searchButton?.style.removeProperty('left');
    searchButton?.style.removeProperty('right');
    searchButton?.style.removeProperty('transform');
    searchButton?.style.removeProperty('--soridraw-studio-search-x');
    if (floatingActionBar) {
      floatingActionBar.style.removeProperty('left');
      floatingActionBar.style.removeProperty('width');
      floatingActionBar.style.removeProperty('--soridraw-studio-builder-width');
    }
    if (collapsedActionButton) {
      collapsedActionButton.style.removeProperty('--soridraw-studio-builder-width');
      collapsedActionButton.style.removeProperty('--soridraw-studio-left-rail-edge');
    }
    if (liveKeywords) {
      liveKeywords.style.removeProperty('left');
      liveKeywords.style.removeProperty('right');
    }
    splitterRef.current?.style.removeProperty('left');
    splitterRef.current?.style.removeProperty('transform');
    lastActionControlPixelRef.current = null;
    externalControlsReadyRef.current = false;
  }, []);

  const syncExternalMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const { left, leftRailEdge } = metricsRef.current;
    const controls = readExternalControls();
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const workspaceRight = Math.max(0, window.innerWidth - (left + metricsRef.current.width));

    // The divider is a fixed body portal. Give it one coordinate owner only:
    // the exact viewport left position. The previous transform preview lost to
    // an older higher-specificity `transform: none !important` rule, leaving
    // the divider at x=0 and making it appear to have vanished.
    if (splitterRef.current) {
      splitterRef.current.style.removeProperty('transform');
      splitterRef.current.style.setProperty(
        'left',
        `${Math.max(0, Math.round(splitterLeft) - 8)}px`,
        'important',
      );
    }
    if (controls.liveKeywords) {
      controls.liveKeywords.style.setProperty(
        'left',
        `${Math.max(0, Math.round(splitterLeft + 18))}px`,
        'important',
      );
      controls.liveKeywords.style.setProperty(
        'right',
        `${Math.max(0, Math.round(workspaceRight))}px`,
        'important',
      );
    }
    if (controls.searchButton) {
      // Search is absolutely positioned inside the same 1500px Studio shell as
      // the split workspace. Track the builder boundary with `right` only.
      // Never combine layout positioning with transform/transition: that made
      // the button ease behind the divider and wander during fast drags.
      controls.searchButton.style.removeProperty('left');
      controls.searchButton.style.removeProperty('transform');
      controls.searchButton.style.removeProperty('--soridraw-studio-search-x');
      controls.searchButton.style.setProperty(
        'right',
        `${Math.max(18, Math.round(metricsRef.current.width - roundedBuilderWidth + 18))}px`,
        'important',
      );
    }

    // The floating action bar lives in a body portal, so it does not inherit
    // the builder pane width automatically. Keep its outer box and responsive
    // controls on the exact same builder width in this animation frame. The
    // previous wide-desktop early return froze the bar until pointer-up.
    const actionControlPixel = roundedBuilderWidth;
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

    // Measure only during mount/resize/outer layout refresh, never on pointer
    // frames. An explicit remaining-viewport height gives CSS containment a
    // stable size boundary, so changing pane widths cannot bubble a layout root
    // all the way to #document.
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
  const applyPercentToLayout = useCallback((rawPercent: number) => {
    const nextPercent = clamp(rawPercent);
    percentRef.current = nextPercent;

    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;

    if (!layout || !builder || !result || !isStudioBlack()) {
      layout?.style.removeProperty('grid-template-columns');
      builder?.style.removeProperty('flex-basis');
      builder?.style.removeProperty('width');
      result?.style.removeProperty('left');
      clearRootMeasurements();
      return nextPercent;
    }

    const { left, width } = metricsRef.current;
    const safeWidth = Math.max(width, 1);
    const builderWidth = safeWidth * (nextPercent / 100);
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = left + builderWidth;

    const isIsolatedWorkspace = layout.dataset.scrollIsolated === 'true';

    // Wide desktop uses two absolutely positioned scroll panes inside a fixed
    // containment boundary. Changing their local width/left values cannot
    // resize the outer page or footer. The bridge/tablet layout keeps the
    // previously verified flex behavior.
    layout.style.removeProperty('grid-template-columns');
    if (isIsolatedWorkspace) {
      builder.style.removeProperty('flex-basis');
      builder.style.setProperty('width', `${Math.max(0, builderWidth)}px`, 'important');
      result.style.setProperty('left', `${Math.max(0, builderWidth)}px`, 'important');
    } else {
      builder.style.removeProperty('width');
      result.style.removeProperty('left');
      builder.style.flexBasis = `${Math.max(0, builderWidth)}px`;
    }
    if (draggingRef.current) syncExternalMeasurements(builderWidth, splitterLeft);

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
    if (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode) {
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
    }
    const root = document.documentElement;
    if (root.dataset.soridrawResultMode !== nextResultMode) {
      root.dataset.soridrawResultMode = nextResultMode;
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
    const builderWidth = metricsRef.current.width * (appliedPercent / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    refreshSplitterFooterBoundary();
  }, [applyPercentToLayout, clearExternalMeasurements, clearRootMeasurements, commitRootMeasurements, isStudioBlack, refreshSplitterFooterBoundary, refreshWorkspaceIsolation]);

  useLayoutEffect(() => {
    percentRef.current = percent;
    const frame = window.requestAnimationFrame(refreshLayoutMetrics);
    return () => window.cancelAnimationFrame(frame);
  }, [percent, refreshLayoutMetrics]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(percent)); } catch { /* ignore */ }
  }, [percent]);

  useEffect(() => {
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result || typeof ResizeObserver === 'undefined') return;

    let observedTitleCard: HTMLElement | null = null;
    const titleObserver = new ResizeObserver(() => syncTopCardHeights());
    const connect = () => {
      const nextTitleCard = result.querySelector<HTMLElement>('.soridraw-result-title-card--genre-height');
      if (nextTitleCard !== observedTitleCard) {
        if (observedTitleCard) titleObserver.unobserve(observedTitleCard);
        observedTitleCard = nextTitleCard;
        if (observedTitleCard) titleObserver.observe(observedTitleCard);
      }
      syncTopCardHeights();
    };

    const contentObserver = new MutationObserver(connect);
    contentObserver.observe(builder, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-expanded'],
    });
    contentObserver.observe(result, { subtree: true, childList: true });

    const themeObserver = new MutationObserver(connect);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-soridraw-theme'],
    });

    const frame = window.requestAnimationFrame(connect);
    return () => {
      window.cancelAnimationFrame(frame);
      titleObserver.disconnect();
      contentObserver.disconnect();
      themeObserver.disconnect();
      builder.querySelector<HTMLElement>('[data-studio-menu="genre"]')?.style.removeProperty('min-height');
      lastMatchedTopCardHeightRef.current = null;
    };
  }, [syncTopCardHeights]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // The pointer-frame path owns horizontal measurements during a drag.
      // Footer geometry is synchronized once after pointer-up.
      if (!draggingRef.current) refreshLayoutMetrics();
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
      if (layoutRef.current) {
        delete layoutRef.current.dataset.scrollIsolated;
        layoutRef.current.style.removeProperty('--soridraw-studio-isolated-height');
        layoutRef.current.style.removeProperty('height');
      }
      lastIsolatedWorkspaceHeightRef.current = null;
      document.documentElement.classList.remove('soridraw-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      builderRef.current?.style.removeProperty('flex-basis');
      builderRef.current?.style.removeProperty('width');
      resultRef.current?.style.removeProperty('left');
      clearExternalMeasurements();
      clearRootMeasurements();
    };
  }, [clearExternalMeasurements, clearRootMeasurements, refreshLayoutMetrics, scheduleFooterBoundaryRefresh]);

  const flushPendingPointer = useCallback(() => {
    dragFrameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null) return;

    const { startX, startPercent, width } = dragRef.current;
    const safeWidth = Math.max(width, 1);
    const deltaPercent = ((clientX - startX) / safeWidth) * 100;
    const rawPercent = clamp(startPercent + deltaPercent);
    const rawBuilderPixel = safeWidth * (rawPercent / 100);
    // Preserve one-pixel pointer fidelity. The former 2px quantization made a
    // healthy frame rate still look like stepping on wide desktop screens.
    const nextBuilderPixel = Math.round(rawBuilderPixel);
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
    if (!isStudioBlack()) return;
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    metricsRef.current = {
      left: rect.left,
      width: rect.width,
      leftRailEdge: metricsRef.current.leftRailEdge,
    };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPercent: percentRef.current,
      width: rect.width,
    };
    pendingClientXRef.current = null;
    lastDragBuilderPixelRef.current = null;
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
    flushPendingPointer();

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    draggingRef.current = false;
    layoutRef.current?.classList.remove('is-dragging');
    document.documentElement.classList.remove('soridraw-split-dragging');
    lastDragBuilderPixelRef.current = null;
    const builderWidth = metricsRef.current.width * (percentRef.current / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    scheduleFooterBoundaryRefresh();
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
      <div ref={layoutRef} className="soridraw-studio-split-workspace">
        <div ref={builderRef} className="soridraw-studio-builder-pane">{panes[0] ?? null}</div>
        <div ref={resultRef} className="soridraw-studio-result-pane">{panes[1] ?? null}</div>
      </div>
      {typeof document !== 'undefined' ? createPortal(splitterControl, document.body) : splitterControl}
    </>
  );
}
