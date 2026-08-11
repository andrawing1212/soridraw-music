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
import { getStudioActionFloatingGutter, resolveStudioActionFloatingGeometry } from '../../lib/studioActionBarGeometry';
import './liteSplitWorkspace.css';

const WIDE_STORAGE_KEY = 'soridraw_lite_studio_split_percent_v2';
const TABLET_STORAGE_KEY = 'soridraw_lite_studio_tablet_split_percent_v2';
const LEGACY_WIDE_STORAGE_KEY = 'soridraw_studio_black_split_percent_v1';
const LEGACY_TABLET_STORAGE_KEY = 'soridraw_studio_black_tablet_split_percent_v1';
const BUILDER_COLLAPSED_STORAGE_KEY = 'soridraw_studio_black_builder_collapsed_v1';
const RESULT_COLLAPSED_STORAGE_KEY = 'soridraw_studio_black_result_collapsed_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;
const TABLET_VIEWPORT_MIN = 1100;
const TABLET_VIEWPORT_MAX = 1599;
const TABLET_MIN_PANE_PX = 430;
const BUILDER_MOBILE_BREAKPOINT = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const CONTENT_RESULT_MOBILE_BREAKPOINT = 661;
const PANE_MODE_HYSTERESIS = 16;

type PaneMode = 'mobile' | 'desktop';
type SplitProfile = 'wide' | 'tablet';
type StudioWorkspaceView = 'create' | 'recent' | 'music-note' | 'library';
type ViewMode = 'split' | 'result-only' | 'hidden';

type SplitBounds = { min: number; max: number };
type LayoutMetrics = { left: number; width: number; leftRailEdge: number };
type ExternalControls = {
  searchButton: HTMLElement | null;
  floatingActionBar: HTMLElement | null;
  actionAnchor: HTMLElement | null;
  collapsedActionButton: HTMLElement | null;
  liveKeywords: HTMLElement | null;
  heroRow: HTMLElement | null;
  workspaceHeroHost: HTMLElement | null;
};

const getSplitProfile = (): SplitProfile => (
  typeof window !== 'undefined'
  && window.innerWidth >= TABLET_VIEWPORT_MIN
  && window.innerWidth <= TABLET_VIEWPORT_MAX
    ? 'tablet'
    : 'wide'
);

const getStorageKey = (profile: SplitProfile) => profile === 'tablet' ? TABLET_STORAGE_KEY : WIDE_STORAGE_KEY;
const getLegacyStorageKey = (profile: SplitProfile) => profile === 'tablet' ? LEGACY_TABLET_STORAGE_KEY : LEGACY_WIDE_STORAGE_KEY;

const getSplitBounds = (layoutWidth: number): SplitBounds => {
  if (getSplitProfile() !== 'tablet' || !Number.isFinite(layoutWidth) || layoutWidth <= 1) {
    return { min: MIN_PERCENT, max: MAX_PERCENT };
  }
  const safeWidth = Math.max(layoutWidth, 1);
  const minimumPaneWidth = Math.min(TABLET_MIN_PANE_PX, safeWidth / 2);
  const minimumPercent = (minimumPaneWidth / safeWidth) * 100;
  const min = Math.max(MIN_PERCENT, minimumPercent);
  const max = Math.min(MAX_PERCENT, 100 - minimumPercent);
  return min >= max ? { min: 50, max: 50 } : { min, max };
};

const clampToBounds = (value: number, bounds: SplitBounds) => Math.min(bounds.max, Math.max(bounds.min, value));

const readStoredPercent = (profile: SplitProfile = getSplitProfile()) => {
  if (typeof window === 'undefined') return DEFAULT_PERCENT;
  try {
    const current = Number(window.localStorage.getItem(getStorageKey(profile)));
    if (Number.isFinite(current)) return clampToBounds(current, { min: MIN_PERCENT, max: MAX_PERCENT });
    const legacy = Number(window.localStorage.getItem(getLegacyStorageKey(profile)));
    return Number.isFinite(legacy) ? clampToBounds(legacy, { min: MIN_PERCENT, max: MAX_PERCENT }) : DEFAULT_PERCENT;
  } catch {
    return DEFAULT_PERCENT;
  }
};

const readStoredCollapse = (key: string) => {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(key) === 'true'; } catch { return false; }
};

const resolvePaneMode = (
  currentMode: PaneMode,
  hasCommittedMode: boolean,
  width: number,
  breakpoint: number,
  hysteresis: number,
): PaneMode => {
  if (!hasCommittedMode) return width < breakpoint ? 'mobile' : 'desktop';
  if (currentMode === 'desktop') return width < breakpoint - hysteresis ? 'mobile' : 'desktop';
  return width > breakpoint + hysteresis ? 'desktop' : 'mobile';
};

export type LiteStudioSplitWorkspaceProps = {
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: ViewMode;
  workspaceView?: StudioWorkspaceView;
  workspaceRequestId?: number;
};

export default function LiteStudioSplitWorkspace({
  children,
  builderMasthead,
  viewMode = 'split',
  workspaceView,
  workspaceRequestId = 0,
}: LiteStudioSplitWorkspaceProps) {
  const panes = Children.toArray(children);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLButtonElement | null>(null);
  const builderToggleRef = useRef<HTMLButtonElement | null>(null);
  const resultToggleRef = useRef<HTMLButtonElement | null>(null);
  const modalHostRef = useRef<HTMLDivElement | null>(null);
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(() => readStoredCollapse(BUILDER_COLLAPSED_STORAGE_KEY));
  const [isResultCollapsed, setIsResultCollapsed] = useState(() => readStoredCollapse(RESULT_COLLAPSED_STORAGE_KEY));
  const builderCollapsedRef = useRef(isBuilderCollapsed);
  const resultCollapsedRef = useRef(isResultCollapsed);
  const percentRef = useRef(readStoredPercent());
  const splitProfileRef = useRef<SplitProfile>(getSplitProfile());
  const metricsRef = useRef<LayoutMetrics>({ left: 0, width: 1, leftRailEdge: 0 });
  const modeRef = useRef<{ builder: PaneMode; result: PaneMode }>({ builder: 'desktop', result: 'desktop' });
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(-1);
  const pendingClientXRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const refreshFrameRef = useRef<number | null>(null);
  const lastPixelRef = useRef<number | null>(null);
  const lastAriaPercentRef = useRef<number | null>(null);
  const lastAriaBoundsRef = useRef<string | null>(null);
  const lastViewportHeightRef = useRef<number | null>(null);
  const lastIsolatedHeightRef = useRef<number | null>(null);
  const actionInsetsRef = useRef<{ left: number; right: number } | null>(null);
  const topCardObserverRef = useRef<ResizeObserver | null>(null);
  const lastTopCardHeightRef = useRef<number | null>(null);
  const externalRef = useRef<ExternalControls>({
    searchButton: null,
    floatingActionBar: null,
    actionAnchor: null,
    collapsedActionButton: null,
    liveKeywords: null,
    heroRow: null,
    workspaceHeroHost: null,
  });

  const readExternalControls = useCallback(() => {
    const current = externalRef.current;
    current.searchButton = document.querySelector<HTMLElement>('.soridraw-studio-hero-search-button');
    current.floatingActionBar = document.querySelector<HTMLElement>('body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]');
    current.actionAnchor = document.querySelector<HTMLElement>('.soridraw-studio-action-geometry-anchor');
    current.collapsedActionButton = document.querySelector<HTMLElement>('body > .soridraw-studio-action-collapsed');
    current.liveKeywords = document.querySelector<HTMLElement>('body > .soridraw-live-keywords-fixed');
    current.heroRow = document.querySelector<HTMLElement>('.soridraw-studio-hero-row');
    current.workspaceHeroHost = document.getElementById('soridraw-studio-workspace-hero-host');
    return current;
  }, []);

  const syncResultTitleHeight = useCallback(() => {
    if (draggingRef.current || builderCollapsedRef.current || resultCollapsedRef.current) return;
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result) return;
    const genreCard = builder.querySelector<HTMLElement>('[data-studio-menu="genre"]');
    if (!genreCard) return;
    const summary = genreCard.querySelector<HTMLElement>('.soridraw-expand-summary');
    if (summary?.dataset.expanded === 'true') return;
    const nextHeight = Math.round(genreCard.getBoundingClientRect().height);
    if (!Number.isFinite(nextHeight) || nextHeight < 160 || lastTopCardHeightRef.current === nextHeight) return;
    lastTopCardHeightRef.current = nextHeight;
    result.style.setProperty('--soridraw-studio-top-card-height', `${nextHeight}px`);
  }, []);

  const connectTopCardObserver = useCallback(() => {
    topCardObserverRef.current?.disconnect();
    topCardObserverRef.current = null;
    if (typeof ResizeObserver === 'undefined' || draggingRef.current) return;
    const genreCard = builderRef.current?.querySelector<HTMLElement>('[data-studio-menu="genre"]') || null;
    if (!genreCard) {
      syncResultTitleHeight();
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!draggingRef.current) syncResultTitleHeight();
    });
    observer.observe(genreCard);
    topCardObserverRef.current = observer;
    syncResultTitleHeight();
  }, [syncResultTitleHeight]);

  const commitRootMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const root = document.documentElement;
    const { left, width, leftRailEdge } = metricsRef.current;
    const roundedLeft = Math.max(0, Math.round(left));
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));
    const workspaceRight = Math.max(0, Math.round(window.innerWidth - (left + width)));
    root.style.setProperty('--soridraw-studio-builder-left', `${roundedLeft}px`);
    root.style.setProperty('--soridraw-studio-builder-right', `${Math.max(0, Math.round(window.innerWidth - (left + roundedBuilderWidth)))}px`);
    root.style.setProperty('--soridraw-studio-builder-width', `${roundedBuilderWidth}px`);
    root.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, Math.round(leftRailEdge))}px`);
    root.style.setProperty('--soridraw-studio-splitter-left', `${roundedSplitterLeft}px`);
    root.style.setProperty('--soridraw-studio-result-left', `${roundedSplitterLeft + 18}px`);
    root.style.setProperty('--soridraw-studio-result-right', `${workspaceRight}px`);
  }, []);

  const syncModalHost = useCallback(() => {
    const host = modalHostRef.current;
    if (!host) return;
    host.style.left = '0px';
    host.style.top = '0px';
    host.style.width = `${Math.max(0, Math.round(window.innerWidth))}px`;
    host.style.height = `${Math.max(0, Math.round(window.innerHeight))}px`;
  }, []);

  const refreshIsolationHeight = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout || window.innerWidth < 1100) {
      if (layout) {
        delete layout.dataset.scrollIsolated;
        layout.style.removeProperty('--soridraw-studio-isolated-height');
        layout.style.removeProperty('height');
      }
      lastViewportHeightRef.current = null;
      lastIsolatedHeightRef.current = null;
      return;
    }
    if (
      layout.dataset.scrollIsolated === 'true'
      && lastViewportHeightRef.current === window.innerHeight
      && lastIsolatedHeightRef.current !== null
    ) return;

    const rect = layout.getBoundingClientRect();
    const visibleTop = Math.max(58, Math.min(window.innerHeight - 1, rect.top));
    const parentBottomPadding = layout.parentElement
      ? Number.parseFloat(window.getComputedStyle(layout.parentElement).paddingBottom) || 0
      : 0;
    const nextHeight = Math.max(1, Math.floor(window.innerHeight - visibleTop - parentBottomPadding));
    layout.dataset.scrollIsolated = 'true';
    lastViewportHeightRef.current = window.innerHeight;
    lastIsolatedHeightRef.current = nextHeight;
    layout.style.setProperty('--soridraw-studio-isolated-height', `${nextHeight}px`);
    layout.style.height = `${nextHeight}px`;
  }, []);

  const syncPaneModes = useCallback((builderWidth: number, resultWidth: number) => {
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result) return;

    const nextBuilderMode = resolvePaneMode(
      modeRef.current.builder,
      builder.dataset.paneMode === 'desktop' || builder.dataset.paneMode === 'mobile',
      builderWidth,
      BUILDER_MOBILE_BREAKPOINT,
      PANE_MODE_HYSTERESIS,
    );
    const unifiedResultBreakpoint = workspaceView === 'music-note' || workspaceView === 'library';
    const nextResultMode = resolvePaneMode(
      modeRef.current.result,
      result.dataset.paneMode === 'desktop' || result.dataset.paneMode === 'mobile',
      resultWidth,
      unifiedResultBreakpoint ? CONTENT_RESULT_MOBILE_BREAKPOINT : RESULT_MOBILE_BREAKPOINT,
      unifiedResultBreakpoint ? 0 : PANE_MODE_HYSTERESIS,
    );

    if (modeRef.current.builder !== nextBuilderMode || builder.dataset.paneMode !== nextBuilderMode) {
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
      document.documentElement.dataset.soridrawBuilderMode = nextBuilderMode;
    }
    if (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode) {
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
      document.documentElement.dataset.soridrawResultMode = nextResultMode;
      const host = externalRef.current.workspaceHeroHost || document.getElementById('soridraw-studio-workspace-hero-host');
      if (host) host.dataset.paneMode = nextResultMode;
    }
  }, [workspaceView]);

  const syncExternalGeometry = useCallback((builderWidth: number, splitterLeft: number) => {
    const { left, width, leftRailEdge } = metricsRef.current;
    const controls = externalRef.current;
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));
    const workspaceRight = Math.max(0, Math.round(window.innerWidth - (left + width)));

    splitterRef.current?.style.setProperty('--soridraw-lite-studio-splitter-left', `${roundedSplitterLeft}px`);
    builderToggleRef.current?.style.setProperty('--soridraw-lite-studio-builder-toggle-left', `${Math.max(0, roundedSplitterLeft - 43)}px`);
    resultToggleRef.current?.style.setProperty('--soridraw-lite-studio-result-toggle-left', `${Math.min(window.innerWidth - 43, roundedSplitterLeft + 9)}px`);

    controls.heroRow?.style.setProperty('--soridraw-studio-builder-width', `${roundedBuilderWidth}px`, 'important');
    if (controls.searchButton) {
      controls.searchButton.style.setProperty('right', `${Math.max(26, Math.round(width - roundedBuilderWidth + 26))}px`, 'important');
      controls.searchButton.style.removeProperty('left');
      controls.searchButton.style.removeProperty('transform');
    }
    if (controls.liveKeywords) {
      controls.liveKeywords.style.setProperty('left', `${Math.max(0, roundedSplitterLeft + 18)}px`, 'important');
      controls.liveKeywords.style.setProperty('right', `${workspaceRight}px`, 'important');
    }

    const actionInsets = actionInsetsRef.current ?? { left: 0, right: 0 };
    const anchorLeft = Math.max(0, Math.round(left + actionInsets.left));
    const anchorWidth = Math.max(0, Math.round(roundedBuilderWidth - actionInsets.left - actionInsets.right));
    const actionGutter = getStudioActionFloatingGutter(window.innerWidth, modeRef.current.builder);
    const actionGeometry = resolveStudioActionFloatingGeometry(anchorLeft, anchorWidth, actionGutter);
    if (controls.floatingActionBar) {
      controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-left', `${actionGeometry.left}px`);
      controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-width', `${actionGeometry.width}px`);
      controls.floatingActionBar.style.setProperty('--soridraw-studio-builder-width', `${anchorWidth}px`);
    }
    if (controls.collapsedActionButton) {
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-builder-width', `${roundedBuilderWidth}px`);
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, Math.round(leftRailEdge))}px`);
    }
  }, []);

  const clearLiveExternalGeometry = useCallback(() => {
    const controls = externalRef.current;
    controls.searchButton?.style.removeProperty('right');
    controls.searchButton?.style.removeProperty('left');
    controls.searchButton?.style.removeProperty('transform');
    controls.heroRow?.style.removeProperty('--soridraw-studio-builder-width');
    controls.liveKeywords?.style.removeProperty('left');
    controls.liveKeywords?.style.removeProperty('right');
    if (controls.floatingActionBar) {
      controls.floatingActionBar.style.removeProperty('--soridraw-action-fixed-left');
      controls.floatingActionBar.style.removeProperty('--soridraw-action-fixed-width');
      controls.floatingActionBar.style.removeProperty('--soridraw-studio-builder-width');
    }
    if (controls.collapsedActionButton) {
      controls.collapsedActionButton.style.removeProperty('--soridraw-studio-builder-width');
      controls.collapsedActionButton.style.removeProperty('--soridraw-studio-left-rail-edge');
    }
    actionInsetsRef.current = null;
  }, []);

  const applyPercent = useCallback((rawPercent: number, live = false) => {
    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!layout || !builder || !result) return percentRef.current;

    const bounds = getSplitBounds(metricsRef.current.width);
    const nextPercent = clampToBounds(rawPercent, bounds);
    percentRef.current = nextPercent;
    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (nextPercent / 100));
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = metricsRef.current.left + builderWidth;

    layout.style.setProperty('--soridraw-studio-builder-width', `${builderWidth}px`);
    syncPaneModes(builderWidth, resultWidth);
    if (live) syncExternalGeometry(builderWidth, splitterLeft);

    const root = document.documentElement;
    const edgeTolerancePercent = (1.5 / safeWidth) * 100;
    const builderAtMinimum = !builderCollapsedRef.current && !resultCollapsedRef.current && nextPercent <= bounds.min + edgeTolerancePercent;
    const resultAtMinimum = !builderCollapsedRef.current && !resultCollapsedRef.current && nextPercent >= bounds.max - edgeTolerancePercent;
    if (builderAtMinimum) {
      if (root.dataset.soridrawBuilderAtMinimum !== 'true') root.dataset.soridrawBuilderAtMinimum = 'true';
    } else if (root.dataset.soridrawBuilderAtMinimum) {
      delete root.dataset.soridrawBuilderAtMinimum;
    }
    if (resultAtMinimum) {
      if (root.dataset.soridrawResultAtMinimum !== 'true') root.dataset.soridrawResultAtMinimum = 'true';
    } else if (root.dataset.soridrawResultAtMinimum) {
      delete root.dataset.soridrawResultAtMinimum;
    }

    const boundsKey = `${bounds.min.toFixed(2)}:${bounds.max.toFixed(2)}`;
    if (lastAriaBoundsRef.current !== boundsKey) {
      lastAriaBoundsRef.current = boundsKey;
      splitterRef.current?.setAttribute('aria-valuemin', bounds.min.toFixed(1));
      splitterRef.current?.setAttribute('aria-valuemax', bounds.max.toFixed(1));
    }
    const roundedPercent = Math.round(nextPercent);
    if (lastAriaPercentRef.current !== roundedPercent) {
      lastAriaPercentRef.current = roundedPercent;
      splitterRef.current?.setAttribute('aria-valuenow', String(roundedPercent));
    }
    return nextPercent;
  }, [syncExternalGeometry, syncPaneModes]);

  const refreshMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    refreshIsolationHeight();
    syncModalHost();
    const rect = layout.getBoundingClientRect();
    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: Math.max(1, rect.width),
      leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
    };

    const nextProfile = getSplitProfile();
    if (splitProfileRef.current !== nextProfile) {
      splitProfileRef.current = nextProfile;
      percentRef.current = readStoredPercent(nextProfile);
    }
    const appliedPercent = applyPercent(percentRef.current, false);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? metricsRef.current.width : Math.round(metricsRef.current.width * (appliedPercent / 100));
    const splitterLeft = metricsRef.current.left + builderWidth;
    commitRootMeasurements(builderWidth, splitterLeft);
    readExternalControls();
    syncExternalGeometry(builderWidth, splitterLeft);
    clearLiveExternalGeometry();
  }, [applyPercent, clearLiveExternalGeometry, commitRootMeasurements, readExternalControls, refreshIsolationHeight, syncExternalGeometry, syncModalHost]);

  const scheduleMetricsRefresh = useCallback(() => {
    if (draggingRef.current || refreshFrameRef.current !== null) return;
    refreshFrameRef.current = window.requestAnimationFrame(() => {
      refreshFrameRef.current = null;
      refreshMetrics();
    });
  }, [refreshMetrics]);

  const flushPointer = useCallback(() => {
    frameRef.current = null;
    const clientX = pendingClientXRef.current;
    pendingClientXRef.current = null;
    if (clientX === null || !draggingRef.current || builderCollapsedRef.current || resultCollapsedRef.current) return;
    const width = Math.max(1, metricsRef.current.width);
    const bounds = getSplitBounds(width);
    const minPx = width * (bounds.min / 100);
    const maxPx = width * (bounds.max / 100);
    const nextPixel = Math.round(Math.min(maxPx, Math.max(minPx, clientX - metricsRef.current.left)));
    if (lastPixelRef.current === nextPixel) return;
    lastPixelRef.current = nextPixel;
    applyPercent((nextPixel / width) * 100, true);
  }, [applyPercent]);

  const schedulePointer = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPointer);
  }, [flushPointer]);

  const finishDrag = useCallback((event?: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    if (event && event.pointerId !== pointerIdRef.current) return;
    if (event) pendingClientXRef.current = event.clientX;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    flushPointer();

    draggingRef.current = false;
    pointerIdRef.current = -1;
    layoutRef.current?.classList.remove('is-dragging');
    document.documentElement.classList.remove('soridraw-split-dragging');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (percentRef.current / 100));
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearLiveExternalGeometry();
    readExternalControls();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    window.requestAnimationFrame(connectTopCardObserver);
    try { window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(percentRef.current)); } catch { /* optional */ }
  }, [clearLiveExternalGeometry, commitRootMeasurements, connectTopCardObserver, flushPointer, readExternalControls]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (builderCollapsedRef.current || resultCollapsedRef.current || window.innerWidth < 1100) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    if (rect.width <= 0) return;
    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: rect.width,
      leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
    };
    readExternalControls();
    const builderRect = builderRef.current?.getBoundingClientRect();
    const actionRect = externalRef.current.actionAnchor?.getBoundingClientRect();
    if (builderRect && actionRect && builderRect.width > 0 && actionRect.width > 0) {
      actionInsetsRef.current = {
        left: Math.max(0, actionRect.left - builderRect.left),
        right: Math.max(0, builderRect.right - actionRect.right),
      };
    } else {
      actionInsetsRef.current = { left: 0, right: 0 };
    }

    topCardObserverRef.current?.disconnect();
    topCardObserverRef.current = null;
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    pendingClientXRef.current = null;
    lastPixelRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    layout.classList.add('is-dragging');
    document.documentElement.classList.add('soridraw-split-dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-start'));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || event.pointerId !== pointerIdRef.current) return;
    schedulePointer(event.clientX);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (builderCollapsedRef.current || resultCollapsedRef.current) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = applyPercent(percentRef.current + (event.key === 'ArrowRight' ? 2 : -2), false);
    const builderWidth = Math.round(metricsRef.current.width * (next / 100));
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    try { window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(next)); } catch { /* optional */ }
  };

  useLayoutEffect(() => {
    builderCollapsedRef.current = isBuilderCollapsed;
    resultCollapsedRef.current = isResultCollapsed;
    const root = document.documentElement;
    if (isBuilderCollapsed) root.dataset.soridrawBuilderCollapsed = 'true'; else delete root.dataset.soridrawBuilderCollapsed;
    if (isResultCollapsed) root.dataset.soridrawResultCollapsed = 'true'; else delete root.dataset.soridrawResultCollapsed;
    if (layoutRef.current) {
      if (isBuilderCollapsed) layoutRef.current.dataset.builderCollapsed = 'true'; else delete layoutRef.current.dataset.builderCollapsed;
      if (isResultCollapsed) layoutRef.current.dataset.resultCollapsed = 'true'; else delete layoutRef.current.dataset.resultCollapsed;
    }
    if (isBuilderCollapsed && resultRef.current) resultRef.current.scrollTop = 0;
    if (isResultCollapsed && builderRef.current) builderRef.current.scrollTop = 0;
    refreshMetrics();
    const frame = window.requestAnimationFrame(() => {
      refreshMetrics();
      window.dispatchEvent(new CustomEvent('soridraw-studio-builder-collapse-change', { detail: { collapsed: isBuilderCollapsed } }));
      window.dispatchEvent(new CustomEvent('soridraw-studio-pane-collapse-change', { detail: { builderCollapsed: isBuilderCollapsed, resultCollapsed: isResultCollapsed } }));
    });
    try { window.localStorage.setItem(BUILDER_COLLAPSED_STORAGE_KEY, String(isBuilderCollapsed)); } catch { /* optional */ }
    try { window.localStorage.setItem(RESULT_COLLAPSED_STORAGE_KEY, String(isResultCollapsed)); } catch { /* optional */ }
    return () => window.cancelAnimationFrame(frame);
  }, [isBuilderCollapsed, isResultCollapsed, refreshMetrics]);

  useLayoutEffect(() => {
    if (viewMode === 'result-only') {
      setIsResultCollapsed(false);
      setIsBuilderCollapsed(true);
      return;
    }
    if (viewMode === 'hidden') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
      return;
    }
    if (workspaceView === 'create') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(true);
      return;
    }
    if (workspaceView) {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
    }
  }, [viewMode, workspaceRequestId, workspaceView]);

  useLayoutEffect(() => {
    const initialFrame = window.requestAnimationFrame(refreshMetrics);
    const layout = layoutRef.current;
    let observer: ResizeObserver | null = null;
    if (layout && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!draggingRef.current) scheduleMetricsRefresh();
      });
      try { observer.observe(layout, { box: 'border-box' }); } catch { observer.observe(layout); }
    }
    const handleWindowResize = () => scheduleMetricsRefresh();
    const handleFrameResize = () => scheduleMetricsRefresh();
    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('soridraw-studio-frame-resize', handleFrameResize as EventListener);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('soridraw-studio-frame-resize', handleFrameResize as EventListener);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (refreshFrameRef.current !== null) window.cancelAnimationFrame(refreshFrameRef.current);
      document.documentElement.classList.remove('soridraw-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      clearLiveExternalGeometry();
      const root = document.documentElement;
      delete root.dataset.soridrawBuilderMode;
      delete root.dataset.soridrawResultMode;
      delete root.dataset.soridrawBuilderCollapsed;
      delete root.dataset.soridrawResultCollapsed;
      delete root.dataset.soridrawBuilderAtMinimum;
      delete root.dataset.soridrawResultAtMinimum;
      root.style.removeProperty('--soridraw-studio-builder-left');
      root.style.removeProperty('--soridraw-studio-builder-right');
      root.style.removeProperty('--soridraw-studio-builder-width');
      root.style.removeProperty('--soridraw-studio-left-rail-edge');
      root.style.removeProperty('--soridraw-studio-splitter-left');
      root.style.removeProperty('--soridraw-studio-result-left');
      root.style.removeProperty('--soridraw-studio-result-right');
    };
  }, [clearLiveExternalGeometry, refreshMetrics, scheduleMetricsRefresh]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(connectTopCardObserver);
    return () => {
      window.cancelAnimationFrame(frame);
      topCardObserverRef.current?.disconnect();
      topCardObserverRef.current = null;
      resultRef.current?.style.removeProperty('--soridraw-studio-top-card-height');
      lastTopCardHeightRef.current = null;
    };
  }, [connectTopCardObserver, workspaceRequestId, workspaceView]);

  useEffect(() => {
    const handleWindowPointerUp = () => finishDrag();
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleWindowPointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [finishDrag]);

  const centerModalHost = (
    <div id="soridraw-studio-center-modal-root" ref={modalHostRef} className="soridraw-studio-center-modal-host" />
  );

  const splitter = (
    <button
      ref={splitterRef}
      type="button"
      className="soridraw-studio-splitter soridraw-lite-studio-splitter"
      aria-label="곡 만들기와 생성 결과 영역 너비 조절"
      aria-valuemin={MIN_PERCENT}
      aria-valuemax={MAX_PERCENT}
      aria-valuenow={Math.round(percentRef.current)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true" />
    </button>
  );

  const builderToggle = (
    <button
      ref={builderToggleRef}
      type="button"
      className={`soridraw-studio-builder-collapse-toggle soridraw-lite-studio-builder-toggle${isBuilderCollapsed ? ' is-collapsed' : ''}`}
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

  const resultToggle = (
    <button
      ref={resultToggleRef}
      type="button"
      className={`soridraw-studio-result-collapse-toggle soridraw-lite-studio-result-toggle${isResultCollapsed ? ' is-collapsed' : ''}`}
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

  return (
    <>
      <div
        ref={layoutRef}
        data-workspace-view-mode={viewMode}
        data-split-engine="lite-v2-studio"
        className={`soridraw-studio-split-workspace soridraw-lite-studio-split-workspace${isBuilderCollapsed ? ' is-builder-collapsed' : ''}${isResultCollapsed ? ' is-result-collapsed' : ''}`}
        style={{ '--soridraw-studio-builder-width': `${percentRef.current}%` } as React.CSSProperties}
      >
        <div
          id="soridraw-studio-builder-pane"
          ref={builderRef}
          data-soridraw-studio-pane="builder"
          className="soridraw-studio-builder-pane soridraw-lite-studio-pane is-builder"
          aria-hidden={isBuilderCollapsed}
        >
          <div id="soridraw-studio-builder-pane-masthead-host" className="soridraw-studio-pane-masthead-host soridraw-studio-builder-pane-masthead-host">
            {builderMasthead}
          </div>
          {panes[0] ?? null}
        </div>
        <div
          id="soridraw-studio-result-pane"
          ref={resultRef}
          data-soridraw-studio-pane="result"
          className="soridraw-studio-result-pane soridraw-lite-studio-pane is-result"
          aria-hidden={isResultCollapsed}
        >
          <div id="soridraw-studio-result-pane-masthead-host" className="soridraw-studio-pane-masthead-host soridraw-studio-result-pane-masthead-host" />
          {panes[1] ?? null}
        </div>
      </div>
      {typeof document !== 'undefined' ? createPortal(centerModalHost, document.body) : centerModalHost}
      {viewMode === 'split' && !isBuilderCollapsed && !isResultCollapsed && (typeof document !== 'undefined' ? createPortal(splitter, document.body) : splitter)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(builderToggle, document.body) : builderToggle)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(resultToggle, document.body) : resultToggle)}
    </>
  );
}
