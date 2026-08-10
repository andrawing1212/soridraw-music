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
import {
  beginSplitPerfDrag,
  clearSplitPerfBenchmarkSummary,
  finishSplitPerfDrag,
  getLastSplitPerfResult,
  isSplitPerfDragActive,
  publishSplitPerfBenchmarkSummary,
  recordSplitPerfApply,
  recordSplitPerfFlush,
  SPLIT_PERF_BENCHMARK_REQUEST_EVENT,
  SPLIT_PERF_BENCHMARK_STATUS_EVENT,
} from './splitPerfDiagnostics';

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
const PANE_WIDTH_EVENT = 'soridraw-lite-pane-width';
const CONTENT_MOBILE_MAX = 660;
const CONTENT_TABLET_MAX = 1080;
const BENCHMARK_SURFACE_WIDTH = 1400;
const BENCHMARK_SURFACE_HEIGHT = 900;
type BenchmarkLayoutMode = 'css-var' | 'direct';

type PaneMode = 'mobile' | 'desktop';
type ContentResponsiveMode = 'mobile' | 'tablet' | 'pc';
type SplitProfile = 'wide' | 'tablet';
type StudioWorkspaceView = 'create' | 'recent' | 'music-note' | 'library';
type ViewMode = 'split' | 'result-only' | 'hidden';

type SplitBounds = { min: number; max: number };
type LayoutMetrics = { left: number; width: number; leftRailEdge: number };
type ExternalControls = {
  floatingActionBar: HTMLElement | null;
  actionAnchor: HTMLElement | null;
  collapsedActionButton: HTMLElement | null;
  heroShell: HTMLElement | null;
  workspaceHeroHost: HTMLElement | null;
};

type ExternalGeometryCache = {
  builderToggleLeft: string;
  resultToggleLeft: string;
  heroBuilderWidth: string;
  floatingLeft: string;
  floatingWidth: string;
  collapsedBuilderWidth: string;
  collapsedLeftRailEdge: string;
};

const createEmptyExternalGeometryCache = (): ExternalGeometryCache => ({
  builderToggleLeft: '',
  resultToggleLeft: '',
  heroBuilderWidth: '',
  floatingLeft: '',
  floatingWidth: '',
  collapsedBuilderWidth: '',
  collapsedLeftRailEdge: '',
});

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


const readContentResponsiveMode = (width: number): ContentResponsiveMode => (
  width <= CONTENT_MOBILE_MAX ? 'mobile' : width <= CONTENT_TABLET_MAX ? 'tablet' : 'pc'
);

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
  const contentResponsiveModeRef = useRef<{ builder: ContentResponsiveMode | null; result: ContentResponsiveMode | null }>({ builder: null, result: null });
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
    floatingActionBar: null,
    actionAnchor: null,
    collapsedActionButton: null,
    heroShell: null,
    workspaceHeroHost: null,
  });
  const externalGeometryCacheRef = useRef<ExternalGeometryCache>(createEmptyExternalGeometryCache());
  const dragRenderAnchorsRef = useRef<Array<{ pane: HTMLElement; element: HTMLElement; viewportOffset: number }>>([]);
  const dragRenderRestoreFrameRef = useRef<number | null>(null);
  const benchmarkFrameRef = useRef<number | null>(null);
  const benchmarkTimerRef = useRef<number | null>(null);
  const benchmarkRunningRef = useRef(false);
  const benchmarkLayoutModeRef = useRef<BenchmarkLayoutMode>('direct');

  const readExternalControls = useCallback(() => {
    const current = externalRef.current;
    current.floatingActionBar = document.querySelector<HTMLElement>('body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]');
    current.actionAnchor = document.querySelector<HTMLElement>('.soridraw-studio-action-geometry-anchor');
    current.collapsedActionButton = document.querySelector<HTMLElement>('body > .soridraw-studio-action-collapsed');
    // 578: one inherited builder-width write on the hero shell now drives the
    // search button and masthead descendants together. The former direct
    // search-button right/left/transform writes were redundant with existing
    // CSS and widened the live style-invalidation surface.
    current.heroShell = document.querySelector<HTMLElement>('.soridraw-studio-hero > .soridraw-studio-shell');
    current.workspaceHeroHost = document.getElementById('soridraw-studio-workspace-hero-host');
    externalGeometryCacheRef.current = createEmptyExternalGeometryCache();
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


  const restoreDragViewportAnchors = useCallback((preserveAnchor = true) => {
    if (dragRenderRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(dragRenderRestoreFrameRef.current);
      dragRenderRestoreFrameRef.current = null;
    }

    const anchors = dragRenderAnchorsRef.current;
    dragRenderAnchorsRef.current = [];
    if (!preserveAnchor || anchors.length === 0) return;

    // 576: native CSS content-visibility keeps off-screen rows cheap without
    // swapping React DOM or scanning/measuring every card at pointer-down.
    // Preserve only one visible anchor per pane after the final width commit.
    dragRenderRestoreFrameRef.current = window.requestAnimationFrame(() => {
      dragRenderRestoreFrameRef.current = null;
      for (const anchor of anchors) {
        if (!anchor.element.isConnected || !anchor.pane.isConnected) continue;
        const paneRect = anchor.pane.getBoundingClientRect();
        const nextOffset = anchor.element.getBoundingClientRect().top - paneRect.top;
        const delta = nextOffset - anchor.viewportOffset;
        if (Math.abs(delta) > 0.5) anchor.pane.scrollTop += delta;
      }
    });
  }, []);

  const captureDragViewportAnchors = useCallback(() => {
    dragRenderAnchorsRef.current = [];
    const selector = [
      '.soridraw-musicnote-song-card',
      '.soridraw-library-playlist-row',
      '.soridraw-library-workspace-track-row',
      '.soridraw-studio-menu-card',
      '.soridraw-result-title-card',
      '.soridraw-result-keywords-card',
      '.soridraw-result-prompt-card',
    ].join(',');

    for (const pane of [builderRef.current, resultRef.current]) {
      if (!pane) continue;
      const paneRect = pane.getBoundingClientRect();
      const x = Math.min(paneRect.right - 8, Math.max(paneRect.left + 8, paneRect.left + paneRect.width * 0.5));
      const probeYs = [paneRect.top + 24, paneRect.top + 96, paneRect.top + paneRect.height * 0.5];
      let anchor: HTMLElement | null = null;

      for (const y of probeYs) {
        const hit = document.elementFromPoint(x, Math.min(paneRect.bottom - 4, Math.max(paneRect.top + 4, y))) as HTMLElement | null;
        const candidate = hit?.closest<HTMLElement>(selector) || null;
        if (candidate && pane.contains(candidate)) {
          anchor = candidate;
          break;
        }
      }

      if (!anchor) continue;
      dragRenderAnchorsRef.current.push({
        pane,
        element: anchor,
        viewportOffset: anchor.getBoundingClientRect().top - paneRect.top,
      });
    }
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

  const broadcastLitePaneResponsiveWidths = useCallback((builderWidth: number, resultWidth: number, force = false) => {
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result) return;

    // 569: Music Note / Library already have a responsive contract that can
    // consume the split engine's known pane width directly. Do not let those
    // pages create their own ResizeObserver + getBoundingClientRect loop while
    // the Lite V2 divider is moving. Only notify when a published
    // PC/tablet/mobile boundary is actually crossed (or when layout is first
    // committed outside a drag).
    const safeBuilderWidth = Math.max(1, builderWidth);
    const safeResultWidth = Math.max(1, resultWidth);
    const builderMode = readContentResponsiveMode(safeBuilderWidth);
    const resultMode = readContentResponsiveMode(safeResultWidth);

    if (force || contentResponsiveModeRef.current.builder !== builderMode) {
      contentResponsiveModeRef.current.builder = builderMode;
      builder.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: safeBuilderWidth } }));
    }
    if (force || contentResponsiveModeRef.current.result !== resultMode) {
      contentResponsiveModeRef.current.result = resultMode;
      result.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: safeResultWidth } }));
    }
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
    const { left, leftRailEdge } = metricsRef.current;
    const controls = externalRef.current;
    const cache = externalGeometryCacheRef.current;
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));

    // 578: keep live external writes to the minimum set that actually owns
    // visible geometry. No reads follow these writes, and unchanged rounded
    // values are skipped. Music Note/Library are the measurement baseline.
    const builderToggleLeft = `${Math.max(0, roundedSplitterLeft - 43)}px`;
    if (cache.builderToggleLeft !== builderToggleLeft) {
      cache.builderToggleLeft = builderToggleLeft;
      builderToggleRef.current?.style.setProperty('--soridraw-lite-studio-builder-toggle-left', builderToggleLeft);
    }

    const resultToggleLeft = `${Math.min(window.innerWidth - 43, roundedSplitterLeft + 9)}px`;
    if (cache.resultToggleLeft !== resultToggleLeft) {
      cache.resultToggleLeft = resultToggleLeft;
      resultToggleRef.current?.style.setProperty('--soridraw-lite-studio-result-toggle-left', resultToggleLeft);
    }

    // Search geometry is already expressed in CSS from
    // --soridraw-studio-builder-width. Publish it once on the smallest common
    // ancestor instead of also mutating the search button itself every frame.
    const heroBuilderWidth = `${roundedBuilderWidth}px`;
    if (cache.heroBuilderWidth !== heroBuilderWidth) {
      cache.heroBuilderWidth = heroBuilderWidth;
      controls.heroShell?.style.setProperty('--soridraw-studio-builder-width', heroBuilderWidth, 'important');
    }

    // The desktop live-keyword body portal is display:none in Studio Black, so
    // the old left/right writes were pure drag-time work and are intentionally
    // omitted in Lite V2.

    const actionInsets = actionInsetsRef.current ?? { left: 0, right: 0 };
    const anchorLeft = Math.max(0, Math.round(left + actionInsets.left));
    const anchorWidth = Math.max(0, Math.round(roundedBuilderWidth - actionInsets.left - actionInsets.right));
    const actionGutter = getStudioActionFloatingGutter(window.innerWidth, modeRef.current.builder);
    const actionGeometry = resolveStudioActionFloatingGeometry(anchorLeft, anchorWidth, actionGutter);
    if (controls.floatingActionBar) {
      const floatingLeft = `${actionGeometry.left}px`;
      if (cache.floatingLeft !== floatingLeft) {
        cache.floatingLeft = floatingLeft;
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-left', floatingLeft);
      }
      const floatingWidth = `${actionGeometry.width}px`;
      if (cache.floatingWidth !== floatingWidth) {
        cache.floatingWidth = floatingWidth;
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-width', floatingWidth);
      }
      // No Studio CSS consumes --soridraw-studio-builder-width from the
      // expanded floating bar, so the former third write was redundant.
    }
    if (controls.collapsedActionButton) {
      const collapsedBuilderWidth = `${roundedBuilderWidth}px`;
      if (cache.collapsedBuilderWidth !== collapsedBuilderWidth) {
        cache.collapsedBuilderWidth = collapsedBuilderWidth;
        controls.collapsedActionButton.style.setProperty('--soridraw-studio-builder-width', collapsedBuilderWidth);
      }
      const collapsedLeftRailEdge = `${Math.max(0, Math.round(leftRailEdge))}px`;
      if (cache.collapsedLeftRailEdge !== collapsedLeftRailEdge) {
        cache.collapsedLeftRailEdge = collapsedLeftRailEdge;
        controls.collapsedActionButton.style.setProperty('--soridraw-studio-left-rail-edge', collapsedLeftRailEdge);
      }
    }
  }, []);

  const clearLiveExternalGeometry = useCallback(() => {
    const controls = externalRef.current;
    controls.heroShell?.style.removeProperty('--soridraw-studio-builder-width');
    if (controls.floatingActionBar) {
      controls.floatingActionBar.style.removeProperty('--soridraw-action-fixed-left');
      controls.floatingActionBar.style.removeProperty('--soridraw-action-fixed-width');
    }
    if (controls.collapsedActionButton) {
      controls.collapsedActionButton.style.removeProperty('--soridraw-studio-builder-width');
      controls.collapsedActionButton.style.removeProperty('--soridraw-studio-left-rail-edge');
    }
    externalGeometryCacheRef.current = createEmptyExternalGeometryCache();
    actionInsetsRef.current = null;
  }, []);

  const clearDirectBenchmarkGeometry = useCallback(() => {
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;
    builder?.style.removeProperty('width');
    builder?.style.removeProperty('left');
    builder?.style.removeProperty('right');
    result?.style.removeProperty('width');
    result?.style.removeProperty('left');
    result?.style.removeProperty('right');
    splitter?.style.removeProperty('left');
    layoutRef.current?.removeAttribute('data-benchmark-layout-mode');
  }, []);

  const writeLiveSplitGeometry = useCallback((builderWidth: number, resultWidth: number) => {
    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;
    if (!layout || !builder || !result) return;

    if (benchmarkLayoutModeRef.current === 'direct') {
      layout.dataset.benchmarkLayoutMode = 'direct';
      // 591 runtime path: avoid mutating the inherited split custom property.
      // The same visible geometry is written directly to the three owners only.
      builder.style.setProperty('left', '0px', 'important');
      builder.style.setProperty('right', 'auto', 'important');
      builder.style.setProperty('width', `${builderWidth}px`, 'important');
      result.style.setProperty('left', `${builderWidth}px`, 'important');
      result.style.setProperty('right', '0px', 'important');
      result.style.setProperty('width', `${resultWidth}px`, 'important');
      splitter?.style.setProperty('left', `${Math.max(0, builderWidth - 8)}px`, 'important');
      return;
    }

    if (layout.dataset.benchmarkLayoutMode === 'direct') clearDirectBenchmarkGeometry();
    layout.style.setProperty('--soridraw-studio-builder-width', `${builderWidth}px`);
  }, [clearDirectBenchmarkGeometry]);

  const applyPercent = useCallback((rawPercent: number, live = false) => {
    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!layout || !builder || !result) return percentRef.current;

    const perfEnabled = isSplitPerfDragActive();
    const perfStart = perfEnabled ? performance.now() : 0;
    const bounds = getSplitBounds(metricsRef.current.width);
    const nextPercent = clampToBounds(rawPercent, bounds);
    percentRef.current = nextPercent;
    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (nextPercent / 100));
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = metricsRef.current.left + builderWidth;

    writeLiveSplitGeometry(builderWidth, resultWidth);
    const perfAfterLayoutWrite = perfEnabled ? performance.now() : 0;
    syncPaneModes(builderWidth, resultWidth);
    broadcastLitePaneResponsiveWidths(builderWidth, resultWidth);
    const perfAfterResponsive = perfEnabled ? performance.now() : 0;
    if (live) syncExternalGeometry(builderWidth, splitterLeft);
    const perfAfterExternal = perfEnabled ? performance.now() : 0;

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
    if (perfEnabled) {
      const perfEnd = performance.now();
      recordSplitPerfApply({
        totalMs: perfEnd - perfStart,
        layoutWriteMs: perfAfterLayoutWrite - perfStart,
        responsiveMs: perfAfterResponsive - perfAfterLayoutWrite,
        externalMs: perfAfterExternal - perfAfterResponsive,
        miscMs: perfEnd - perfAfterExternal,
      });
    }
    return nextPercent;
  }, [broadcastLitePaneResponsiveWidths, syncExternalGeometry, syncPaneModes, writeLiveSplitGeometry]);

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
    const resultWidth = Math.max(0, metricsRef.current.width - builderWidth);
    broadcastLitePaneResponsiveWidths(builderWidth, resultWidth, true);
    const splitterLeft = metricsRef.current.left + builderWidth;
    commitRootMeasurements(builderWidth, splitterLeft);
    readExternalControls();
    syncExternalGeometry(builderWidth, splitterLeft);
    clearLiveExternalGeometry();
  }, [applyPercent, broadcastLitePaneResponsiveWidths, clearLiveExternalGeometry, commitRootMeasurements, readExternalControls, refreshIsolationHeight, syncExternalGeometry, syncModalHost]);

  const scheduleMetricsRefresh = useCallback(() => {
    if (draggingRef.current || refreshFrameRef.current !== null) return;
    refreshFrameRef.current = window.requestAnimationFrame(() => {
      refreshFrameRef.current = null;
      refreshMetrics();
    });
  }, [refreshMetrics]);

  const flushPointer = useCallback(() => {
    const perfStart = isSplitPerfDragActive() ? performance.now() : 0;
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

    const nextPercent = (nextPixel / width) * 100;
    // 591: one real boundary, but no inherited split-width mutation. The
    // builder/result/divider owners receive their own direct pixel geometry in
    // the same rAF. This keeps the approved live boundary while avoiding a
    // custom-property invalidation wave through the entire pane subtree.
    applyPercent(nextPercent, true);
    if (perfStart > 0) recordSplitPerfFlush(performance.now() - perfStart, true);
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
    document.documentElement.classList.remove('soridraw-lite-split-dragging');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    restoreDragViewportAnchors(true);

    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (percentRef.current / 100));
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearLiveExternalGeometry();
    readExternalControls();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    finishSplitPerfDrag();
    window.requestAnimationFrame(connectTopCardObserver);
    try { window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(percentRef.current)); } catch { /* optional */ }
  }, [clearLiveExternalGeometry, commitRootMeasurements, connectTopCardObserver, flushPointer, readExternalControls, restoreDragViewportAnchors]);

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
    captureDragViewportAnchors();
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    pendingClientXRef.current = null;
    beginSplitPerfDrag({
      workspaceView,
      engine: 'Lite V2 · minimal external writes + native leaf isolation (578)',
      builder: builderRef.current,
      result: resultRef.current,
    });
    lastPixelRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    layout.classList.add('is-dragging');
    document.documentElement.classList.add('soridraw-lite-split-dragging');
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

  useEffect(() => {
    const emitBenchmarkStatus = (state: 'running' | 'done' | 'error', message: string) => {
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_STATUS_EVENT, { detail: { state, message } }));
    };

    const handleBenchmarkRequest = (requestEvent: Event) => {
      const requestDetail = (requestEvent as CustomEvent<{ layoutMode?: BenchmarkLayoutMode }>).detail;
      const requestedLayoutMode: BenchmarkLayoutMode = requestDetail?.layoutMode === 'css-var' ? 'css-var' : 'direct';
      if (benchmarkRunningRef.current || draggingRef.current) {
        emitBenchmarkStatus('error', '이미 분할 테스트가 진행 중입니다.');
        return;
      }
      if (viewMode !== 'split' || builderCollapsedRef.current || resultCollapsedRef.current || window.innerWidth < 1100) {
        emitBenchmarkStatus('error', '좌우 패널이 모두 열린 PC 분할 화면에서 실행하세요.');
        return;
      }

      const layout = layoutRef.current;
      const builder = builderRef.current;
      const result = resultRef.current;
      if (!layout || !builder || !result) {
        emitBenchmarkStatus('error', 'Lite V2 분할 영역을 찾지 못했습니다.');
        return;
      }

      const benchmarkSurface = `${BENCHMARK_SURFACE_WIDTH}×${BENCHMARK_SURFACE_HEIGHT}`;
      const savedSurfaceStyles = ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', '--soridraw-studio-isolated-height'].map((property) => ({
        property,
        value: layout.style.getPropertyValue(property),
        priority: layout.style.getPropertyPriority(property),
      }));
      const originalBuilderScrollTop = builder.scrollTop;
      const originalResultScrollTop = result.scrollTop;
      const originalBenchmarkSurfaceFlag = layout.dataset.perfBenchmarkSurface;

      const restoreBenchmarkSurface = () => {
        benchmarkLayoutModeRef.current = 'direct';
        clearDirectBenchmarkGeometry();
        for (const saved of savedSurfaceStyles) {
          if (saved.value) layout.style.setProperty(saved.property, saved.value, saved.priority);
          else layout.style.removeProperty(saved.property);
        }
        if (originalBenchmarkSurfaceFlag === undefined) delete layout.dataset.perfBenchmarkSurface;
        else layout.dataset.perfBenchmarkSurface = originalBenchmarkSurfaceFlag;
        builder.scrollTop = originalBuilderScrollTop;
        result.scrollTop = originalResultScrollTop;
      };

      // 590: benchmark geometry is fully owned by the tool. DEV/PROD can have
      // different browser/window sizes, but the measured split surface is always
      // exactly the same and the user's original geometry is restored afterward.
      layout.dataset.perfBenchmarkSurface = 'true';
      layout.style.setProperty('width', `${BENCHMARK_SURFACE_WIDTH}px`, 'important');
      layout.style.setProperty('min-width', `${BENCHMARK_SURFACE_WIDTH}px`, 'important');
      layout.style.setProperty('max-width', `${BENCHMARK_SURFACE_WIDTH}px`, 'important');
      layout.style.setProperty('height', `${BENCHMARK_SURFACE_HEIGHT}px`, 'important');
      layout.style.setProperty('min-height', `${BENCHMARK_SURFACE_HEIGHT}px`, 'important');
      layout.style.setProperty('max-height', `${BENCHMARK_SURFACE_HEIGHT}px`, 'important');
      layout.style.setProperty('--soridraw-studio-isolated-height', `${BENCHMARK_SURFACE_HEIGHT}px`);
      builder.scrollTop = 0;
      result.scrollTop = 0;
      benchmarkLayoutModeRef.current = requestedLayoutMode;
      // 591: direct element geometry is now the real Lite V2 runtime path.
      // The legacy CSS-variable path is retained only for admin A/B diagnosis.
      // When an A/B run explicitly requests CSS-variable mode, remove the
      // runtime inline geometry first so the inherited variable owns the panes.
      if (requestedLayoutMode === 'css-var') clearDirectBenchmarkGeometry();

      const rect = layout.getBoundingClientRect();
      const surfacePass = Math.abs(rect.width - BENCHMARK_SURFACE_WIDTH) <= 1 && Math.abs(rect.height - BENCHMARK_SURFACE_HEIGHT) <= 1;
      if (!surfacePass) {
        restoreBenchmarkSurface();
        emitBenchmarkStatus('error', `벤치마크 표면 고정 실패 · 실제 ${Math.round(rect.width)}×${Math.round(rect.height)}px`);
        return;
      }

      const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
      const leftRailRect = leftRail?.getBoundingClientRect();
      metricsRef.current = {
        left: rect.left,
        width: rect.width,
        leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
      };
      readExternalControls();
      const builderRect = builder.getBoundingClientRect();
      const actionRect = externalRef.current.actionAnchor?.getBoundingClientRect();
      if (builderRect.width > 0 && actionRect && actionRect.width > 0) {
        actionInsetsRef.current = {
          left: Math.max(0, actionRect.left - builderRect.left),
          right: Math.max(0, builderRect.right - actionRect.right),
        };
      } else {
        actionInsetsRef.current = { left: 0, right: 0 };
      }

      const originalPercent = percentRef.current;
      const bounds = getSplitBounds(rect.width);
      const lowPercent = clampToBounds(32, bounds);
      const highPercent = clampToBounds(68, bounds);
      if (highPercent - lowPercent < 8) {
        restoreBenchmarkSurface();
        emitBenchmarkStatus('error', '고정 벤치마크 표면에서 이동 폭이 너무 좁습니다.');
        return;
      }

      topCardObserverRef.current?.disconnect();
      topCardObserverRef.current = null;
      captureDragViewportAnchors();
      draggingRef.current = true;
      benchmarkRunningRef.current = true;
      pointerIdRef.current = -1;
      pendingClientXRef.current = null;
      lastPixelRef.current = null;
      layout.classList.add('is-dragging');
      document.documentElement.classList.add('soridraw-lite-split-dragging');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      window.dispatchEvent(new CustomEvent('soridraw-split-drag-start'));

      const restoreOriginalState = () => {
        percentRef.current = originalPercent;
        restoreBenchmarkSurface();
        // Restore the real workspace geometry immediately so the diagnostic
        // never leaves a one-frame visual jump after the fixed surface closes.
        const restoredRect = layout.getBoundingClientRect();
        if (restoredRect.width > 0) {
          metricsRef.current = { ...metricsRef.current, left: restoredRect.left, width: restoredRect.width };
          const restoredBuilderWidth = Math.round(restoredRect.width * (originalPercent / 100));
          writeLiveSplitGeometry(restoredBuilderWidth, Math.max(0, restoredRect.width - restoredBuilderWidth));
        }
        try { window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(originalPercent)); } catch { /* optional */ }
        window.requestAnimationFrame(refreshMetrics);
      };

      const finishBenchmark = (measuredSets: NonNullable<ReturnType<typeof getLastSplitPerfResult>>[]) => {
        benchmarkRunningRef.current = false;
        benchmarkFrameRef.current = null;
        if (benchmarkTimerRef.current !== null) {
          window.clearTimeout(benchmarkTimerRef.current);
          benchmarkTimerRef.current = null;
        }
        finishDrag();
        restoreOriginalState();
        if (measuredSets.length) publishSplitPerfBenchmarkSummary(measuredSets);
        emitBenchmarkStatus('done', `자동 테스트 완료 · ${benchmarkSurface} PASS · ${requestedLayoutMode === 'direct' ? '직접 좌표' : 'CSS 변수'} · 3세트 중앙값`);
      };

      const runLegs = (
        legs: number,
        msPerLeg: number,
        measure: boolean,
        onDone: () => void,
      ) => {
        let legIndex = 0;
        let from = lowPercent;
        let to = highPercent;
        let legStartedAt = performance.now();
        applyPercent(from, true);

        const tick = (timestamp: number) => {
          if (!benchmarkRunningRef.current) return;
          const progress = Math.min(1, Math.max(0, (timestamp - legStartedAt) / msPerLeg));
          const next = from + (to - from) * progress;
          const perfStart = measure && isSplitPerfDragActive() ? performance.now() : 0;
          applyPercent(next, true);
          if (perfStart > 0) recordSplitPerfFlush(performance.now() - perfStart, true);

          if (progress >= 1) {
            legIndex += 1;
            if (legIndex >= legs) {
              onDone();
              return;
            }
            from = to;
            to = from === lowPercent ? highPercent : lowPercent;
            legStartedAt = timestamp;
          }
          benchmarkFrameRef.current = window.requestAnimationFrame(tick);
        };

        benchmarkFrameRef.current = window.requestAnimationFrame(tick);
      };

      clearSplitPerfBenchmarkSummary();
      const measuredSets: NonNullable<ReturnType<typeof getLastSplitPerfResult>>[] = [];
      let attemptCount = 0;
      const maxAttempts = 7;
      let fingerprint: { targetNodes: number; resultNodes: number; viewport: string } | null = null;

      const targetNodeCount = (measured: NonNullable<ReturnType<typeof getLastSplitPerfResult>>) => {
        if (workspaceView === 'music-note') return measured.regionNodes.musicNoteList;
        if (workspaceView === 'library') return measured.regionNodes.libraryList;
        return measured.resultNodes;
      };

      const validateMeasuredSet = (measured: NonNullable<ReturnType<typeof getLastSplitPerfResult>>) => {
        const targetNodes = targetNodeCount(measured);
        if (measured.workspaceView !== (workspaceView || 'create')) {
          return { valid: false, reason: `화면 대상 변경(${measured.workspaceView})` };
        }
        if ((workspaceView === 'music-note' || workspaceView === 'library') && targetNodes <= 0) {
          return { valid: false, reason: `${workspaceView === 'music-note' ? '뮤직노트' : '라이브러리'} 리스트 DOM 0` };
        }
        if (measured.resultNodes <= 0) return { valid: false, reason: '우측 패널 DOM 0' };
        if (measured.benchmarkSurface !== benchmarkSurface || measured.benchmarkSurfacePass !== true) {
          return { valid: false, reason: `벤치마크 표면 불일치(${measured.benchmarkSurface || '없음'})` };
        }
        if (measured.layoutMode !== requestedLayoutMode) {
          return { valid: false, reason: `좌표 모드 불일치(${measured.layoutMode || '없음'})` };
        }

        if (!fingerprint) {
          fingerprint = { targetNodes, resultNodes: measured.resultNodes, viewport: measured.viewport };
          return { valid: true, reason: '' };
        }

        const targetTolerance = Math.max(24, Math.round(fingerprint.targetNodes * 0.22));
        const resultTolerance = Math.max(40, Math.round(fingerprint.resultNodes * 0.25));
        if (measured.viewport !== fingerprint.viewport) return { valid: false, reason: '측정 중 viewport 변경' };
        if (Math.abs(targetNodes - fingerprint.targetNodes) > targetTolerance) {
          return { valid: false, reason: `리스트 DOM 변동 ${fingerprint.targetNodes}→${targetNodes}` };
        }
        if (Math.abs(measured.resultNodes - fingerprint.resultNodes) > resultTolerance) {
          return { valid: false, reason: `우측 DOM 변동 ${fingerprint.resultNodes}→${measured.resultNodes}` };
        }
        return { valid: true, reason: '' };
      };

      const abortBenchmark = (message: string) => {
        benchmarkRunningRef.current = false;
        benchmarkFrameRef.current = null;
        if (benchmarkTimerRef.current !== null) {
          window.clearTimeout(benchmarkTimerRef.current);
          benchmarkTimerRef.current = null;
        }
        finishDrag();
        restoreOriginalState();
        if (measuredSets.length) publishSplitPerfBenchmarkSummary(measuredSets);
        emitBenchmarkStatus('error', message);
      };

      const runMeasurementSet = (setIndex: number) => {
        if (!benchmarkRunningRef.current) return;
        if (attemptCount >= maxAttempts) {
          abortBenchmark(`유효한 측정 3세트를 확보하지 못했습니다. 현재 ${measuredSets.length}/3세트`);
          return;
        }
        attemptCount += 1;
        applyPercent(lowPercent, true);
        benchmarkTimerRef.current = window.setTimeout(() => {
          if (!benchmarkRunningRef.current) return;
          beginSplitPerfDrag({
            workspaceView,
            engine: `Lite V2 · auto benchmark 591 · ${requestedLayoutMode} · ${benchmarkSurface} · set ${setIndex + 1}/3 · attempt ${attemptCount}`,
            builder,
            result,
            benchmarkSurface,
            benchmarkSurfacePass: surfacePass,
            layoutMode: requestedLayoutMode,
          });
          emitBenchmarkStatus('running', `측정 ${setIndex + 1}/3 · ${benchmarkSurface} PASS · ${requestedLayoutMode === 'direct' ? '직접 좌표' : 'CSS 변수'}`);
          runLegs(4, 1000, true, () => {
            finishSplitPerfDrag();
            const measured = getLastSplitPerfResult();
            if (!measured) {
              benchmarkTimerRef.current = window.setTimeout(() => runMeasurementSet(setIndex), 320);
              return;
            }
            const validation = validateMeasuredSet(measured);
            if (!validation.valid) {
              emitBenchmarkStatus('running', `무효 세트 재측정 · ${validation.reason}`);
              benchmarkTimerRef.current = window.setTimeout(() => runMeasurementSet(setIndex), 520);
              return;
            }
            measuredSets.push(measured);
            if (setIndex >= 2) {
              finishBenchmark(measuredSets);
              return;
            }
            benchmarkTimerRef.current = window.setTimeout(() => runMeasurementSet(setIndex + 1), 260);
          });
        }, 180);
      };

      emitBenchmarkStatus('running', `워밍업 · ${benchmarkSurface} PASS · 동일 DOM · ${requestedLayoutMode === 'direct' ? '직접 좌표' : 'CSS 변수'}`);
      runLegs(2, 650, false, () => runMeasurementSet(0));
    };

    window.addEventListener(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, handleBenchmarkRequest as EventListener);
    return () => {
      window.removeEventListener(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, handleBenchmarkRequest as EventListener);
      if (benchmarkFrameRef.current !== null) {
        window.cancelAnimationFrame(benchmarkFrameRef.current);
        benchmarkFrameRef.current = null;
      }
      if (benchmarkTimerRef.current !== null) {
        window.clearTimeout(benchmarkTimerRef.current);
        benchmarkTimerRef.current = null;
      }
      benchmarkRunningRef.current = false;
    };
  }, [applyPercent, captureDragViewportAnchors, clearDirectBenchmarkGeometry, finishDrag, readExternalControls, refreshMetrics, viewMode, workspaceView, writeLiveSplitGeometry]);

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
      document.documentElement.classList.remove('soridraw-lite-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      restoreDragViewportAnchors(false);
      if (dragRenderRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(dragRenderRestoreFrameRef.current);
        dragRenderRestoreFrameRef.current = null;
      }
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
  }, [clearLiveExternalGeometry, refreshMetrics, restoreDragViewportAnchors, scheduleMetricsRefresh]);

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
      className="soridraw-lite-splitter soridraw-lite-studio-splitter"
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
        data-split-engine="lite-v2-studio-direct"
        className={`soridraw-studio-split-workspace soridraw-lite-studio-split-workspace${isBuilderCollapsed ? ' is-builder-collapsed' : ''}${isResultCollapsed ? ' is-result-collapsed' : ''}`}
        style={{
          '--soridraw-studio-builder-width': `${percentRef.current}%`,
        } as React.CSSProperties}
      >
        <div
          id="soridraw-studio-builder-pane"
          ref={builderRef}
          data-soridraw-studio-pane="builder"
          data-soridraw-lite-pane="builder"
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
          data-soridraw-lite-pane="result"
          className="soridraw-studio-result-pane soridraw-lite-studio-pane is-result"
          aria-hidden={isResultCollapsed}
        >
          <div id="soridraw-studio-result-pane-masthead-host" className="soridraw-studio-pane-masthead-host soridraw-studio-result-pane-masthead-host" />
          {panes[1] ?? null}
        </div>
        {viewMode === 'split' && !isBuilderCollapsed && !isResultCollapsed ? splitter : null}
      </div>
      {typeof document !== 'undefined' ? createPortal(centerModalHost, document.body) : centerModalHost}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(builderToggle, document.body) : builderToggle)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(resultToggle, document.body) : resultToggle)}
    </>
  );
}
