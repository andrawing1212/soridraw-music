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
const TABLET_STORAGE_KEY = 'soridraw_studio_black_tablet_split_percent_v1';
const BUILDER_COLLAPSED_STORAGE_KEY = 'soridraw_studio_black_builder_collapsed_v1';
const RESULT_COLLAPSED_STORAGE_KEY = 'soridraw_studio_black_result_collapsed_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
const TABLET_VIEWPORT_MIN = 1100;
const TABLET_VIEWPORT_MAX = 1599;
const TABLET_MIN_PANE_PX = 430;
// Align the builder's mobile composition with the top-nav "라이브러리" label:
// the split line reaches the first "라" at roughly an 820px builder width.
const BUILDER_MOBILE_BREAKPOINT = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const PANE_MODE_HYSTERESIS = 16;
const WIDE_DESKTOP_ISOLATION_BREAKPOINT = 1600;
const ISOLATED_WORKSPACE_BOTTOM_GAP = 0;

type PaneMode = 'mobile' | 'desktop';
type SplitProfile = 'wide' | 'tablet';

type SplitBounds = {
  min: number;
  max: number;
};

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

const getSplitProfile = (): SplitProfile => {
  if (typeof window === 'undefined') return 'wide';
  return window.innerWidth >= TABLET_VIEWPORT_MIN && window.innerWidth <= TABLET_VIEWPORT_MAX
    ? 'tablet'
    : 'wide';
};

const getStorageKey = (profile: SplitProfile) => (
  profile === 'tablet' ? TABLET_STORAGE_KEY : STORAGE_KEY
);

const getSplitBounds = (layoutWidth: number): SplitBounds => {
  if (getSplitProfile() !== 'tablet' || !Number.isFinite(layoutWidth) || layoutWidth <= 1) {
    return { min: MIN_PERCENT, max: MAX_PERCENT };
  }

  // Tablet keeps a real pixel safety floor for both panes. Because this is
  // calculated from the current center workspace width, the draggable range
  // narrows automatically as the browser or either side rail gets wider.
  // Wide desktop keeps the original 24-76 range unchanged.
  const safeWidth = Math.max(layoutWidth, 1);
  const minimumPaneWidth = Math.min(TABLET_MIN_PANE_PX, safeWidth / 2);
  const minimumPercent = (minimumPaneWidth / safeWidth) * 100;
  const min = Math.max(MIN_PERCENT, minimumPercent);
  const max = Math.min(MAX_PERCENT, 100 - minimumPercent);

  if (min >= max) return { min: 50, max: 50 };
  return { min, max };
};

const clampToBounds = (value: number, bounds: SplitBounds) => (
  Math.min(bounds.max, Math.max(bounds.min, value))
);

const readStoredCollapseState = (storageKey: string) => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
};

const readStoredBuilderCollapsed = () => readStoredCollapseState(BUILDER_COLLAPSED_STORAGE_KEY);
const readStoredResultCollapsed = () => readStoredCollapseState(RESULT_COLLAPSED_STORAGE_KEY);

const readStored = (profile: SplitProfile = getSplitProfile()) => {
  if (typeof window === 'undefined') return DEFAULT_PERCENT;
  try {
    const value = Number(window.localStorage.getItem(getStorageKey(profile)));
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

type StudioSplitWorkspaceProps = {
  children: ReactNode;
  viewMode?: 'split' | 'result-only' | 'hidden';
};

export default function StudioSplitWorkspace({ children, viewMode = 'split' }: StudioSplitWorkspaceProps) {
  const panes = Children.toArray(children);
  const [percent, setPercent] = useState(readStored);
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(readStoredBuilderCollapsed);
  const [isResultCollapsed, setIsResultCollapsed] = useState(readStoredResultCollapsed);
  const draggingRef = useRef(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const builderCollapseToggleRef = useRef<HTMLButtonElement | null>(null);
  const resultCollapseToggleRef = useRef<HTMLButtonElement | null>(null);
  const percentRef = useRef(percent);
  const splitProfileRef = useRef<SplitProfile>(getSplitProfile());
  const previousViewModeRef = useRef(viewMode);
  const builderCollapsedRef = useRef(isBuilderCollapsed);
  const resultCollapsedRef = useRef(isResultCollapsed);
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
  const lastAriaBoundsRef = useRef<string | null>(null);
  const lastActionControlPixelRef = useRef<number | null>(null);
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
    // Width dragging already owns the pane geometry for this frame. Running a
    // second ResizeObserver-driven measurement here forces another synchronous
    // layout of both large panes and is the main source of visible card stutter.
    // Keep the last stable title height during the drag and refresh it once on
    // pointer-up instead.
    if (draggingRef.current) return;

    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result || !isStudioBlack() || builderCollapsedRef.current || resultCollapsedRef.current) {
      result?.style.removeProperty('--soridraw-studio-top-card-height');
      lastTopCardHeightRef.current = null;
      return;
    }

    const genreCard = builder.querySelector<HTMLElement>('[data-studio-menu="genre"]');
    if (!genreCard) return;

    // Keep the result title aligned to the normal collapsed Genre card. When
    // Genre is expanded, retain the last collapsed measurement instead of
    // making the generated-song title grow to the full keyword-list height.
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
    delete root.dataset.soridrawBuilderAtMinimum;
    delete root.dataset.soridrawResultAtMinimum;
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
    builderCollapseToggleRef.current?.style.removeProperty('left');
    resultCollapseToggleRef.current?.style.removeProperty('left');
    resultCollapseToggleRef.current?.style.removeProperty('right');
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

    // The builder collapse control is another body portal. During pointer drag
    // the committed root CSS variable intentionally stays unchanged until the
    // drag ends, so drive this button from the same live splitter coordinate.
    // Otherwise it appears to jump only after pointer-up.
    if (builderCollapseToggleRef.current && !builderCollapsedRef.current) {
      builderCollapseToggleRef.current.style.setProperty(
        'left',
        `${Math.max(0, Math.round(splitterLeft) - 54)}px`,
        'important',
      );
    }
    if (resultCollapseToggleRef.current && !resultCollapsedRef.current) {
      resultCollapseToggleRef.current.style.removeProperty('right');
      resultCollapseToggleRef.current.style.setProperty(
        'left',
        `${Math.min(window.innerWidth - 44, Math.round(splitterLeft + 20))}px`,
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
    const bounds = getSplitBounds(metricsRef.current.width);
    const nextPercent = clampToBounds(rawPercent, bounds);
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
    const builderWidth = builderCollapsedRef.current
      ? 0
      : resultCollapsedRef.current
        ? safeWidth
        : safeWidth * (nextPercent / 100);
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

    const edgeTolerancePercent = (1.5 / safeWidth) * 100;
    const root = document.documentElement;
    if (!builderCollapsedRef.current && !resultCollapsedRef.current && nextPercent <= bounds.min + edgeTolerancePercent) {
      root.dataset.soridrawBuilderAtMinimum = 'true';
    } else {
      delete root.dataset.soridrawBuilderAtMinimum;
    }
    if (!builderCollapsedRef.current && !resultCollapsedRef.current && nextPercent >= bounds.max - edgeTolerancePercent) {
      root.dataset.soridrawResultAtMinimum = 'true';
    } else {
      delete root.dataset.soridrawResultAtMinimum;
    }

    const nextBuilderMode = builderCollapsedRef.current
      ? modeRef.current.builder
      : resolvePaneMode(
          builder,
          builderWidth,
          BUILDER_MOBILE_BREAKPOINT,
          modeRef.current.builder,
        );
    const nextResultMode = resultCollapsedRef.current
      ? modeRef.current.result
      : resolvePaneMode(
          result,
          resultWidth,
          RESULT_MOBILE_BREAKPOINT,
          modeRef.current.result,
        );

    if (!builderCollapsedRef.current && (modeRef.current.builder !== nextBuilderMode || builder.dataset.paneMode !== nextBuilderMode)) {
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
    }
    if (!resultCollapsedRef.current && (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode)) {
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
    }
    const ariaBoundsKey = `${bounds.min.toFixed(2)}:${bounds.max.toFixed(2)}`;
    if (lastAriaBoundsRef.current !== ariaBoundsKey) {
      lastAriaBoundsRef.current = ariaBoundsKey;
      splitter?.setAttribute('aria-valuemin', bounds.min.toFixed(1));
      splitter?.setAttribute('aria-valuemax', bounds.max.toFixed(1));
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

    const nextProfile = getSplitProfile();
    const profileChanged = splitProfileRef.current !== nextProfile;
    const requestedPercent = profileChanged
      ? readStored(nextProfile)
      : percentRef.current;

    if (profileChanged) splitProfileRef.current = nextProfile;

    const appliedPercent = applyPercentToLayout(requestedPercent);
    if (profileChanged || Math.abs(appliedPercent - requestedPercent) > 0.001) {
      setPercent(appliedPercent);
    }
    const builderWidth = builderCollapsedRef.current
      ? 0
      : resultCollapsedRef.current
        ? metricsRef.current.width
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
    resultCollapsedRef.current = isResultCollapsed;
    const root = document.documentElement;
    if (isBuilderCollapsed) root.dataset.soridrawBuilderCollapsed = 'true';
    else delete root.dataset.soridrawBuilderCollapsed;
    if (isResultCollapsed) root.dataset.soridrawResultCollapsed = 'true';
    else delete root.dataset.soridrawResultCollapsed;

    const layout = layoutRef.current;
    if (layout) {
      if (isBuilderCollapsed) layout.dataset.builderCollapsed = 'true';
      else delete layout.dataset.builderCollapsed;
      if (isResultCollapsed) layout.dataset.resultCollapsed = 'true';
      else delete layout.dataset.resultCollapsed;
    }

    if (isBuilderCollapsed && resultRef.current) resultRef.current.scrollTop = 0;
    if (isResultCollapsed && builderRef.current) builderRef.current.scrollTop = 0;

    // Workspace-view and collapse changes must commit their pane geometry
    // before the browser paints. Waiting for the next animation frame leaves
    // one visible frame of the previous full-width result layout, which reads
    // as an entrance effect when returning to the compact split view.
    refreshLayoutMetrics();

    const frame = window.requestAnimationFrame(() => {
      refreshLayoutMetrics();
      if (isBuilderCollapsed && resultRef.current) resultRef.current.scrollTop = 0;
      if (isResultCollapsed && builderRef.current) builderRef.current.scrollTop = 0;
      if (isBuilderCollapsed && window.innerWidth >= 1100 && window.innerWidth < 1600) {
        window.scrollTo({ top: 0, left: window.scrollX, behavior: 'auto' });
      }
      window.dispatchEvent(new CustomEvent('soridraw-studio-builder-collapse-change', {
        detail: { collapsed: isBuilderCollapsed },
      }));
      window.dispatchEvent(new CustomEvent('soridraw-studio-pane-collapse-change', {
        detail: { builderCollapsed: isBuilderCollapsed, resultCollapsed: isResultCollapsed },
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isBuilderCollapsed, isResultCollapsed, refreshLayoutMetrics]);

  useEffect(() => {
    try {
      window.localStorage.setItem(BUILDER_COLLAPSED_STORAGE_KEY, String(isBuilderCollapsed));
    } catch {
      // Local storage is optional. The current session still keeps the state.
    }
  }, [isBuilderCollapsed]);


  useEffect(() => {
    try {
      window.localStorage.setItem(RESULT_COLLAPSED_STORAGE_KEY, String(isResultCollapsed));
    } catch {
      // Local storage is optional. The current session still keeps the state.
    }
  }, [isResultCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(percent));
    } catch {
      // Local storage is optional. PC and tablet still remain isolated in memory.
    }
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
      builderRef.current?.style.removeProperty('flex-basis');
      builderRef.current?.style.removeProperty('width');
      resultRef.current?.style.removeProperty('left');
      clearExternalMeasurements();
      clearRootMeasurements();
      delete document.documentElement.dataset.soridrawBuilderCollapsed;
      delete document.documentElement.dataset.soridrawResultCollapsed;
      delete document.documentElement.dataset.soridrawBuilderAtMinimum;
      delete document.documentElement.dataset.soridrawResultAtMinimum;
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
    const rawPercent = clampToBounds(
      startPercent + deltaPercent,
      getSplitBounds(safeWidth),
    );
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
    if (!isStudioBlack() || builderCollapsedRef.current || resultCollapsedRef.current) return;
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
    document.body.style.cursor = 'ew-resize';
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
      : resultCollapsedRef.current
        ? metricsRef.current.width
        : metricsRef.current.width * (percentRef.current / 100);
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearExternalMeasurements();
    scheduleFooterBoundaryRefresh();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    // Reconnect the result title to the final builder-card height after the
    // drag has committed. This keeps the expensive cross-pane measurement out
    // of pointer frames without changing the final layout.
    window.requestAnimationFrame(syncResultTitleHeight);
    setPercent(percentRef.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (builderCollapsedRef.current || resultCollapsedRef.current) return;
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
      onClick={() => {
        setIsResultCollapsed(false);
        setIsBuilderCollapsed((current) => !current);
      }}
      aria-label={isBuilderCollapsed ? '곡 만들기 영역 펼치기' : '곡 만들기 영역 접기'}
      title={isBuilderCollapsed ? '곡 만들기 영역 펼치기' : '곡 만들기 영역 접기'}
      aria-expanded={!isBuilderCollapsed}
      aria-controls="soridraw-studio-builder-pane"
    >
      <span className="soridraw-studio-panel-toggle-icon" aria-hidden="true" />
    </button>
  );

  const resultCollapseControl = (
    <button
      ref={resultCollapseToggleRef}
      type="button"
      className={`soridraw-studio-result-collapse-toggle${isResultCollapsed ? ' is-collapsed' : ''}`}
      onClick={() => {
        setIsBuilderCollapsed(false);
        setIsResultCollapsed((current) => !current);
      }}
      aria-label={isResultCollapsed ? '생성 결과 영역 펼치기' : '생성 결과 영역 접기'}
      title={isResultCollapsed ? '생성 결과 영역 펼치기' : '생성 결과 영역 접기'}
      aria-expanded={!isResultCollapsed}
      aria-controls="soridraw-studio-result-pane"
    >
      <span className="soridraw-studio-panel-toggle-icon" aria-hidden="true" />
    </button>
  );

  useLayoutEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    previousViewModeRef.current = viewMode;

    if (viewMode === 'result-only') {
      setIsResultCollapsed(false);
      setIsBuilderCollapsed(true);
      return;
    }

    if (viewMode === 'hidden' || previousViewMode !== 'split') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
    }
  }, [viewMode]);

  const renderedBounds = getSplitBounds(metricsRef.current.width);

  const splitterControl = (
    <button
      ref={splitterRef}
      type="button"
      className="soridraw-studio-splitter"
      aria-label="곡 만들기와 생성 결과 영역 너비 조절"
      aria-valuemin={renderedBounds.min}
      aria-valuemax={renderedBounds.max}
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
      <div ref={layoutRef} data-workspace-view-mode={viewMode} className={`soridraw-studio-split-workspace${isBuilderCollapsed ? ' is-builder-collapsed' : ''}${isResultCollapsed ? ' is-result-collapsed' : ''}`}>
        <div id="soridraw-studio-builder-pane" ref={builderRef} data-soridraw-studio-pane="builder" className="soridraw-studio-builder-pane" aria-hidden={isBuilderCollapsed}>{panes[0] ?? null}</div>
        <div id="soridraw-studio-result-pane" ref={resultRef} data-soridraw-studio-pane="result" className="soridraw-studio-result-pane" aria-hidden={isResultCollapsed}>{panes[1] ?? null}</div>
      </div>
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(splitterControl, document.body) : splitterControl)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(builderCollapseControl, document.body) : builderCollapseControl)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(resultCollapseControl, document.body) : resultCollapseControl)}
    </>
  );
}
