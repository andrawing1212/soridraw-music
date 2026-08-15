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
  recordSplitPerfGeometryWrite,
  recordSplitPerfLayoutAck,
  recordSplitPerfPointer,
  recordSplitPerfResponsiveSwitch,
  SPLIT_PERF_BENCHMARK_REQUEST_EVENT,
  SPLIT_PERF_BENCHMARK_STATUS_EVENT,
  SPLIT_PERF_MANUAL_DRAG_ARM_EVENT,
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
// 741 — Preserve desktop above 820px; Compact replaces the former upper-mobile
// band and true Builder mobile starts only at the shared 660px narrow-content floor.
const BUILDER_MOBILE_BREAKPOINT = 660;
const BUILDER_COMPACT_MAX = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const CONTENT_RESULT_MOBILE_BREAKPOINT = 661;
const PANE_MODE_HYSTERESIS = 16;
const TRACE_RESPONSIVE_HYSTERESIS = 28;
const PANE_WIDTH_EVENT = 'soridraw-lite-pane-width';
const CONTENT_MOBILE_MAX = 660;
const CONTENT_TABLET_MAX = 1080;
const BENCHMARK_SURFACE_WIDTH = 1400;
const BENCHMARK_SURFACE_HEIGHT = 900;
type BenchmarkLayoutMode = 'css-var' | 'direct';
type RuntimeProfile = 'adaptive' | 'library-590';

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

// 757 Trace A/B — keep the current responsive mode inside a small dead-band
// around the 660/1080 content boundaries. This is diagnostic-only and lets us
// measure how much repeated threshold churn contributes to style invalidation.
const resolveContentResponsiveMode = (
  currentMode: ContentResponsiveMode | null,
  width: number,
  hysteresis = 0,
): ContentResponsiveMode => {
  if (!currentMode || hysteresis <= 0) return readContentResponsiveMode(width);
  if (currentMode === 'mobile') {
    if (width <= CONTENT_MOBILE_MAX + hysteresis) return 'mobile';
    return width <= CONTENT_TABLET_MAX ? 'tablet' : 'pc';
  }
  if (currentMode === 'tablet') {
    if (width < CONTENT_MOBILE_MAX - hysteresis) return 'mobile';
    if (width > CONTENT_TABLET_MAX + hysteresis) return 'pc';
    return 'tablet';
  }
  if (width >= CONTENT_TABLET_MAX - hysteresis) return 'pc';
  return width <= CONTENT_MOBILE_MAX ? 'mobile' : 'tablet';
};

const readDragBoundarySignature = (
  builderWidth: number,
  resultWidth: number,
  workspaceView?: StudioWorkspaceView,
) => {
  const safeBuilderWidth = Math.max(1, builderWidth);
  const safeResultWidth = Math.max(1, resultWidth);
  const unifiedResultBreakpoint = workspaceView === 'music-note' || workspaceView === 'library' || workspaceView === 'recent';
  const resultMobileBreakpoint = unifiedResultBreakpoint ? CONTENT_RESULT_MOBILE_BREAKPOINT : RESULT_MOBILE_BREAKPOINT;
  const builderPaneBand = safeBuilderWidth < BUILDER_MOBILE_BREAKPOINT
    ? 'mobile'
    : safeBuilderWidth <= BUILDER_COMPACT_MAX
      ? 'compact'
      : 'desktop';
  const resultPaneBand = safeResultWidth < resultMobileBreakpoint ? 'mobile' : 'desktop';
  return [
    readContentResponsiveMode(safeBuilderWidth),
    builderPaneBand,
    readContentResponsiveMode(safeResultWidth),
    resultPaneBand,
  ].join(':');
};

// 609 stabilization rule from the user's real-hand verification:
// - Result content in tablet/mobile mode: direct geometry is the confirmed smooth
//   path across Music Note, Library and Recent.
// - Result content in PC mode: restore the pre-608 stable ownership. Music Note
//   keeps direct; Library/Recent/Create keep the 590 CSS-variable path.
// Crucially, the geometry owner now follows the *same responsive mode* that the
// content already uses. 608 had a second 16px engine hysteresis around 1080px,
// so visual PC/Tablet mode and geometry ownership could disagree during drag.
const resolveRuntimeLayoutMode = (
  resultMode: ContentResponsiveMode,
  workspaceView?: StudioWorkspaceView,
  runtimeProfile: RuntimeProfile = 'adaptive',
): BenchmarkLayoutMode => {
  // 617 runtime policy:
  // - `library-590` is the shared PC path for Library and Music Note. It keeps
  //   the exact 590 CSS-variable geometry at every visual responsive width.
  // - `adaptive` remains the verified Galaxy Tab/touch V2 path.
  if (runtimeProfile === 'library-590') return 'css-var';
  if (resultMode !== 'pc') return 'direct';
  return workspaceView === 'music-note' ? 'direct' : 'css-var';
};

const readInitialRuntimeLayoutMode = (
  workspaceView: StudioWorkspaceView | undefined,
  runtimeProfile: RuntimeProfile,
): BenchmarkLayoutMode => {
  if (runtimeProfile === 'library-590') return 'css-var';
  return workspaceView === 'music-note' ? 'direct' : 'css-var';
};

export type StudioV2DragPerfMode = 'normal' | 'content-left-freeze' | 'content-right-freeze' | 'content-freeze' | 'aux-boundary' | 'aux-freeze' | 'scroll-defer' | 'direct-geometry' | 'direct-scroll-defer' | 'responsive-freeze' | 'responsive-hysteresis' | 'local-responsive' | 'pure-pane' | 'pure-pane-live' | 'splitter-only' | 'left-pane-only' | 'right-pane-only' | 'tablet-touch-pure';

export type LiteStudioSplitWorkspaceProps = {
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: ViewMode;
  workspaceView?: StudioWorkspaceView;
  workspaceRequestId?: number;
  runtimeProfile?: RuntimeProfile;
  generationBarPerfMode?: 'normal' | 'freeze' | 'off';
  v2DragPerfMode?: StudioV2DragPerfMode;
};

export default function LiteStudioSplitWorkspace({
  children,
  builderMasthead,
  viewMode = 'split',
  workspaceView,
  workspaceRequestId = 0,
  runtimeProfile = 'adaptive',
  generationBarPerfMode = 'normal',
  v2DragPerfMode = 'normal',
}: LiteStudioSplitWorkspaceProps) {
  // 617: PC Music Note no longer owns a special geometry path. App routes it
  // through the same `library-590` profile as Library. Adaptive mode is kept for
  // the already-verified Galaxy Tab/touch path and explicit diagnostics.
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
  // 754: boundary-only auxiliary sync keeps the V2 pane/divider hot path clean,
  // but still publishes the visible responsive UI at the exact thresholds while
  // dragging. The signature is pure math from already-known pane widths; it adds
  // no DOM read, observer, or React state to pointermove.
  const dragBoundarySignatureRef = useRef<string | null>(null);
  const dragBuilderCqBandRef = useRef<string | null>(null);
  const dragResultCqBandRef = useRef<string | null>(null);
  const draggingRef = useRef(false);
  const finePointerFastPathRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const pointerIdRef = useRef(-1);
  // 768: remember the active input source so Galaxy Tab touch/S Pen can use
  // the same tablet-pane isolation during the Pure Pane production hot path.
  // This is set once on pointer-down; pointermove performs no capability query.
  const activePointerTypeRef = useRef<string>('');
  const manualPerfArmedWorkspaceRef = useRef<StudioWorkspaceView | null>(null);
  const manualPerfCaptureActiveRef = useRef(false);
  const pendingClientXRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const refreshFrameRef = useRef<number | null>(null);
  const lastPixelRef = useRef<number | null>(null);
  const lastAriaPercentRef = useRef<number | null>(null);
  const lastAriaBoundsRef = useRef<string | null>(null);
  const lastViewportHeightRef = useRef<number | null>(null);
  const lastIsolatedHeightRef = useRef<number | null>(null);
  const actionInsetsRef = useRef<{ left: number; right: number } | null>(null);
  // 762: preserve the result scroll-shell's resting right edge during direct/Pure Pane drag.
  // Wide split mode intentionally reaches 18px past the workspace so its scrollbar
  // sits on the outer rail boundary; forcing right:0 during drag made it jump left.
  // 775: tablet split uses the same 18px result-scrollbar reach-through as
  // wide PC. Seeding the direct-geometry owner here prevents an inline `right:0`
  // from overriding the CSS edge alignment before the first pointer gesture.
  const dragResultRightRef = useRef(
    typeof window !== 'undefined' && window.innerWidth >= 1100 && window.innerWidth < 1600
      ? '-18px'
      : '0px',
  );
  // 749 — Keep geometry callbacks stable while only the workspace result page
  // changes. The latest page is read through this ref; dedicated view effects
  // still request one exact resting refresh outside any drag gesture.
  const workspaceViewRef = useRef<StudioWorkspaceView | undefined>(workspaceView);
  workspaceViewRef.current = workspaceView;
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
  const dragScrollLocksRef = useRef<Array<{ pane: HTMLElement; edge: 'top' | 'bottom' | 'position'; scrollTop: number }>>([]);
  const dragScrollRestoreFrameRef = useRef<number | null>(null);
  const benchmarkFrameRef = useRef<number | null>(null);
  const benchmarkTimerRef = useRef<number | null>(null);
  const benchmarkRunningRef = useRef(false);
  const layoutAckObserverRef = useRef<ResizeObserver | null>(null);
  const layoutAckObservedRef = useRef<{ builder: number; result: number }>({ builder: 0, result: 0 });
  const runtimeLayoutModeRef = useRef<BenchmarkLayoutMode>(readInitialRuntimeLayoutMode(workspaceView, runtimeProfile));
  const runtimeResultContentModeRef = useRef<ContentResponsiveMode | null>(null);
  const benchmarkLayoutModeRef = useRef<BenchmarkLayoutMode>(runtimeLayoutModeRef.current);

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
    if (
      draggingRef.current
      || document.documentElement.classList.contains('soridraw-window-resizing')
      || builderCollapsedRef.current
      || resultCollapsedRef.current
    ) return;
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


  // 633 — A horizontal split drag must never become a vertical scroll action.
  // The old Lite path captured a visible card and, on pointer-up, moved scrollTop
  // by that card's reflow delta. Repeating left/right drags therefore accumulated
  // downward movement in Library and made Music Note oscillate as card heights
  // changed. Keep the user's actual pane scroll state instead: exact top stays
  // top, exact bottom stays bottom, and a middle position keeps the same scrollTop.
  // This is shared by Library + Music Note and uses no per-frame DOM scanning.
  const captureDragScrollLocks = useCallback(() => {
    dragScrollLocksRef.current = [];
    const edgeTolerance = 2;
    for (const pane of [builderRef.current, resultRef.current]) {
      if (!pane) continue;
      const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
      const scrollTop = Math.max(0, Math.min(maxScrollTop, pane.scrollTop));
      dragScrollLocksRef.current.push({
        pane,
        edge: scrollTop <= edgeTolerance
          ? 'top'
          : maxScrollTop - scrollTop <= edgeTolerance
            ? 'bottom'
            : 'position',
        scrollTop,
      });
    }
  }, []);

  const applyDragScrollLocks = useCallback(() => {
    for (const lock of dragScrollLocksRef.current) {
      if (!lock.pane.isConnected) continue;
      const target = lock.edge === 'top'
        ? 0
        : lock.edge === 'bottom'
          ? 1_000_000_000
          : lock.scrollTop;
      if (Math.abs(lock.pane.scrollTop - target) > 0.5 || lock.edge === 'bottom') {
        lock.pane.scrollTop = target;
      }
    }
  }, []);

  const finishDragScrollLocks = useCallback((preserveScroll = true) => {
    if (dragScrollRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(dragScrollRestoreFrameRef.current);
      dragScrollRestoreFrameRef.current = null;
    }
    if (!preserveScroll || dragScrollLocksRef.current.length === 0) {
      dragScrollLocksRef.current = [];
      return;
    }

    // Re-apply once after drag-end listeners/React state settle. This prevents
    // the release frame itself from changing vertical position without adding
    // a continuing observer or another layout owner.
    dragScrollRestoreFrameRef.current = window.requestAnimationFrame(() => {
      dragScrollRestoreFrameRef.current = null;
      applyDragScrollLocks();
      dragScrollLocksRef.current = [];
    });
  }, [applyDragScrollLocks]);

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

  const broadcastLitePaneResponsiveWidths = useCallback((
    builderWidth: number,
    resultWidth: number,
    force = false,
    options?: { skipBuilder?: boolean; skipResult?: boolean; rootSync?: boolean; hysteresisPx?: number },
  ) => {
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
    const hysteresisPx = Math.max(0, options?.hysteresisPx ?? 0);
    const builderMode = resolveContentResponsiveMode(contentResponsiveModeRef.current.builder, safeBuilderWidth, hysteresisPx);
    const resultMode = resolveContentResponsiveMode(contentResponsiveModeRef.current.result, safeResultWidth, hysteresisPx);
    const skipBuilder = options?.skipBuilder === true;
    const skipResult = options?.skipResult === true;
    const rootSync = options?.rootSync !== false;

    // 607: publish only the already-computed responsive ownership state. This
    // does not add another measurement or observer; App uses it solely to keep
    // the 606 rerender suppression scoped to Music Note's tablet state instead
    // of affecting every Lite V2 workspace.
    // 755: a content-freeze probe must freeze the responsive contract too.
    // Otherwise the pane shell is fixed while its children still switch
    // PC/tablet/mobile modes, which invalidates the A/B result.
    const root = document.documentElement;
    if (rootSync && !skipBuilder && root.dataset.soridrawBuilderContentMode !== builderMode) root.dataset.soridrawBuilderContentMode = builderMode;
    if (rootSync && !skipResult && root.dataset.soridrawResultContentMode !== resultMode) root.dataset.soridrawResultContentMode = resultMode;

    if (!skipBuilder && (force || contentResponsiveModeRef.current.builder !== builderMode)) {
      if (!force && contentResponsiveModeRef.current.builder !== null && contentResponsiveModeRef.current.builder !== builderMode) {
        if ((benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive()) recordSplitPerfResponsiveSwitch('content');
      }
      contentResponsiveModeRef.current.builder = builderMode;
      builder.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: safeBuilderWidth } }));
    }
    if (!skipResult && (force || contentResponsiveModeRef.current.result !== resultMode)) {
      if (!force && contentResponsiveModeRef.current.result !== null && contentResponsiveModeRef.current.result !== resultMode) {
        if ((benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive()) recordSplitPerfResponsiveSwitch('content');
      }
      contentResponsiveModeRef.current.result = resultMode;
      result.dispatchEvent(new CustomEvent(PANE_WIDTH_EVENT, { detail: { width: safeResultWidth } }));
    }
  }, []);

  const syncPaneModes = useCallback((
    builderWidth: number,
    resultWidth: number,
    options?: { skipBuilder?: boolean; skipResult?: boolean; rootSync?: boolean; hysteresisPx?: number },
  ) => {
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result) return;
    const skipBuilder = options?.skipBuilder === true;
    const skipResult = options?.skipResult === true;
    const rootSync = options?.rootSync !== false;
    const hysteresisOverride = typeof options?.hysteresisPx === 'number'
      ? Math.max(0, options.hysteresisPx)
      : null;
    const builderHysteresis = hysteresisOverride ?? PANE_MODE_HYSTERESIS;

    const nextBuilderMode = resolvePaneMode(
      modeRef.current.builder,
      builder.dataset.paneMode === 'desktop' || builder.dataset.paneMode === 'mobile',
      builderWidth,
      BUILDER_MOBILE_BREAKPOINT,
      builderHysteresis,
    );
    // 741 — Match Legacy: Compact consumes only the former upper-mobile band.
    // Desktop remains unchanged above 820px, Compact owns 661~820px, and the
    // existing one-column Builder mobile composition begins at the 660px floor.
    if (!skipBuilder) {
      const compactHysteresis = hysteresisOverride ?? 0;
      const compactWasActive = builder.dataset.soridrawPaneCompact === 'true';
      const compactThreshold = compactWasActive
        ? BUILDER_COMPACT_MAX + compactHysteresis
        : BUILDER_COMPACT_MAX - compactHysteresis;
      const builderCompactActive = !builderCollapsedRef.current
        && nextBuilderMode === 'desktop'
        && builderWidth <= compactThreshold;
      if (builderCompactActive) {
        if (builder.dataset.soridrawPaneCompact !== 'true') {
          builder.dataset.soridrawPaneCompact = 'true';
        }
      } else if (builder.dataset.soridrawPaneCompact) {
        delete builder.dataset.soridrawPaneCompact;
      }
    }

    const activeWorkspaceView = workspaceViewRef.current;
    const unifiedResultBreakpoint = activeWorkspaceView === 'music-note' || activeWorkspaceView === 'library' || activeWorkspaceView === 'recent';
    const resultHysteresis = hysteresisOverride ?? (unifiedResultBreakpoint ? 0 : PANE_MODE_HYSTERESIS);
    const nextResultMode = resolvePaneMode(
      modeRef.current.result,
      result.dataset.paneMode === 'desktop' || result.dataset.paneMode === 'mobile',
      resultWidth,
      unifiedResultBreakpoint ? CONTENT_RESULT_MOBILE_BREAKPOINT : RESULT_MOBILE_BREAKPOINT,
      resultHysteresis,
    );

    if (!skipBuilder && (modeRef.current.builder !== nextBuilderMode || builder.dataset.paneMode !== nextBuilderMode)) {
      if ((benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive() && builder.dataset.paneMode && builder.dataset.paneMode !== nextBuilderMode) recordSplitPerfResponsiveSwitch('pane');
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
      if (rootSync) document.documentElement.dataset.soridrawBuilderMode = nextBuilderMode;
    }
    if (!skipResult && (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode)) {
      if ((benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive() && result.dataset.paneMode && result.dataset.paneMode !== nextResultMode) recordSplitPerfResponsiveSwitch('pane');
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
      if (rootSync) document.documentElement.dataset.soridrawResultMode = nextResultMode;
      const host = externalRef.current.workspaceHeroHost || document.getElementById('soridraw-studio-workspace-hero-host');
      if (host) host.dataset.paneMode = nextResultMode;
    }

    // 757 Local Responsive keeps <html> untouched during drag. On pointer-up
    // the pane-local state may already equal the final mode, so mirror that
    // committed local state to root independently of a local mode change.
    if (rootSync) {
      const root = document.documentElement;
      if (!skipBuilder && root.dataset.soridrawBuilderMode !== modeRef.current.builder) {
        root.dataset.soridrawBuilderMode = modeRef.current.builder;
      }
      if (!skipResult && root.dataset.soridrawResultMode !== modeRef.current.result) {
        root.dataset.soridrawResultMode = modeRef.current.result;
      }
    }
  }, []);

  // 790 — The Generate bar must follow the same already-known Builder geometry
  // as the divider on every Lite V2 rAF frame. Keep this helper intentionally
  // read-free: pointer-down captures the command-anchor insets once, and live
  // frames only publish the two portal geometry variables (plus the collapsed
  // tab's Builder width). This preserves the Pure Pane production hot path
  // without re-enabling hero/toggle/root synchronization.
  const syncGenerationBarGeometry = useCallback((builderWidth: number) => {
    if (generationBarPerfMode !== 'normal') return;
    const { left, leftRailEdge } = metricsRef.current;
    const controls = externalRef.current;
    const cache = externalGeometryCacheRef.current;
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
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
  }, [generationBarPerfMode]);

  const syncExternalGeometry = useCallback((builderWidth: number, splitterLeft: number) => {
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

    // 752/790: the Generate bar has its own minimal geometry writer so the
    // production Pure Pane path can reuse it without re-enabling the rest of
    // external synchronization. Admin `freeze`/`off` still bypass it.
    syncGenerationBarGeometry(roundedBuilderWidth);
  }, [syncGenerationBarGeometry]);

  const clearLiveExternalGeometry = useCallback(() => {
    const controls = externalRef.current;
    // 781: live split-edge controls use direct inline coordinates only while
    // dragging. Clear them before returning ownership to the committed root
    // splitter variables, so collapsed restore positions still use the existing
    // left/right boundary rules.
    builderToggleRef.current?.style.removeProperty('left');
    builderToggleRef.current?.style.removeProperty('right');
    builderToggleRef.current?.style.removeProperty('--soridraw-lite-studio-builder-toggle-left');
    resultToggleRef.current?.style.removeProperty('left');
    resultToggleRef.current?.style.removeProperty('right');
    resultToggleRef.current?.style.removeProperty('--soridraw-lite-studio-result-toggle-left');
    controls.heroShell?.style.removeProperty('--soridraw-studio-builder-width');
    if (controls.floatingActionBar && !document.documentElement.classList.contains('soridraw-window-resizing')) {
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

  const clearV2DragContentFreeze = useCallback(() => {
    builderRef.current?.style.removeProperty('--soridraw-v2-drag-content-width');
    resultRef.current?.style.removeProperty('--soridraw-v2-drag-content-width');
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

  const writeLiveSplitGeometry = useCallback((builderWidth: number, resultWidth: number, forceSingleDirect = false) => {
    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    const splitter = splitterRef.current;
    if (!layout || !builder || !result) return;

    layout.dataset.liteRuntimeLayout = benchmarkLayoutModeRef.current;
    const viewportSplitterLeft = Math.max(0, Math.round(metricsRef.current.left + builderWidth - 8));

    // 756 Trace A/B — keep the verified V2 rAF owner, but remove the inherited
    // workspace custom-property write from the live frame. Only the actual pane
    // boundary and body splitter receive direct geometry. Result width is owned
    // by left + right rather than another width write. This is diagnostic-only;
    // pointer-up reconciles back to the normal runtime geometry owner.
    if (forceSingleDirect) {
      layout.dataset.v2TraceDirectGeometry = 'true';
      builder.style.setProperty('left', '0px', 'important');
      builder.style.setProperty('right', 'auto', 'important');
      builder.style.setProperty('width', `${builderWidth}px`, 'important');
      result.style.setProperty('left', `${builderWidth}px`, 'important');
      result.style.setProperty('right', dragResultRightRef.current, 'important');
      result.style.removeProperty('width');
      splitter?.style.setProperty('left', `${viewportSplitterLeft}px`, 'important');
      return;
    }

    if (layout.dataset.v2TraceDirectGeometry === 'true') {
      delete layout.dataset.v2TraceDirectGeometry;
      clearDirectBenchmarkGeometry();
    }

    if (benchmarkLayoutModeRef.current === 'direct') {
      layout.dataset.benchmarkLayoutMode = 'direct';
      // 609: direct geometry owns every tablet/mobile result mode and PC
      // Music Note. Explicit admin A/B can still override this temporarily.
      builder.style.setProperty('left', '0px', 'important');
      builder.style.setProperty('right', 'auto', 'important');
      builder.style.setProperty('width', `${builderWidth}px`, 'important');
      result.style.setProperty('left', `${builderWidth}px`, 'important');
      result.style.setProperty('right', dragResultRightRef.current, 'important');
      // 776: direct layout used left + explicit width + right together. In LTR,
      // left + width win, so the tablet `right:-18px` reach-through was ignored
      // and the native result scrollbar stayed 18px inside the right frame.
      // Extend only the scroll shell by the negative right inset; CSS returns
      // the same amount as padding-right, so the visible result content width
      // and card positions do not change. This is pure math from the cached
      // drag right owner and adds no DOM read to the live path.
      const directResultRight = Number.parseFloat(dragResultRightRef.current);
      const directResultReachThrough = Number.isFinite(directResultRight) && directResultRight < 0
        ? Math.abs(directResultRight)
        : 0;
      result.style.setProperty('width', `${Math.max(0, resultWidth + directResultReachThrough)}px`, 'important');
      // 622: splitter is now the same body-level fixed control as Recent Songs,
      // so its live x-coordinate must be viewport-relative rather than local.
      splitter?.style.setProperty('left', `${viewportSplitterLeft}px`, 'important');
      return;
    }

    if (layout.dataset.benchmarkLayoutMode === 'direct') clearDirectBenchmarkGeometry();
    layout.style.setProperty('--soridraw-studio-builder-width', `${builderWidth}px`);
    // CSS-variable 590 geometry keeps pane width ownership local, while the
    // shared body splitter follows the same boundary with one tiny fixed write.
    splitter?.style.setProperty('left', `${viewportSplitterLeft}px`, 'important');
  }, [clearDirectBenchmarkGeometry]);

  // 781 — The two minimum-width collapse controls must have the same live
  // boundary owner as the divider. The production Pure Pane path deliberately
  // skips `syncExternalGeometry`, so leaving minimum-state + button geometry in
  // that auxiliary lane made the previously visible edge button stay on the
  // opposite side while the divider crossed to the other minimum. Keep this
  // tiny shared rule inside the split engine itself: switch the two minimum
  // flags only when the threshold actually changes, and position only the
  // currently visible edge control from the exact live splitter coordinate.
  const syncMinimumCollapseControls = useCallback((
    nextPercent: number,
    bounds: SplitBounds,
    safeWidth: number,
    splitterLeft: number,
    livePosition: boolean,
  ) => {
    const root = document.documentElement;
    const edgeTolerancePercent = (1.5 / Math.max(1, safeWidth)) * 100;
    const builderAtMinimum = !builderCollapsedRef.current
      && !resultCollapsedRef.current
      && nextPercent <= bounds.min + edgeTolerancePercent;
    const resultAtMinimum = !builderCollapsedRef.current
      && !resultCollapsedRef.current
      && nextPercent >= bounds.max - edgeTolerancePercent;

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

    if (!livePosition) return;
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));
    if (builderAtMinimum && builderToggleRef.current) {
      builderToggleRef.current.style.removeProperty('right');
      builderToggleRef.current.style.setProperty(
        'left',
        `${Math.max(0, roundedSplitterLeft - 43)}px`,
        'important',
      );
    }
    if (resultAtMinimum && resultToggleRef.current) {
      resultToggleRef.current.style.removeProperty('right');
      resultToggleRef.current.style.setProperty(
        'left',
        `${Math.min(window.innerWidth - 43, roundedSplitterLeft + 9)}px`,
        'important',
      );
    }
  }, []);

  const applyPercent = useCallback((rawPercent: number, live = false) => {
    const layout = layoutRef.current;
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!layout || !builder || !result) return percentRef.current;

    // 611: normal hand dragging never samples PERF instrumentation. Only the
    // synthetic benchmark or an explicitly armed one-shot admin hand test can
    // enter the measurement branch below.
    const perfEnabled = (benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive();
    const perfStart = perfEnabled ? performance.now() : 0;
    const bounds = getSplitBounds(metricsRef.current.width);
    const nextPercent = clampToBounds(rawPercent, bounds);
    const auxFreezeLive = live && draggingRef.current && v2DragPerfMode === 'aux-freeze';
    const auxBoundaryLive = live && draggingRef.current && v2DragPerfMode === 'aux-boundary';
    const traceResponsiveFreezeLive = live && draggingRef.current && v2DragPerfMode === 'responsive-freeze';
    const traceResponsiveHysteresisLive = live && draggingRef.current && (v2DragPerfMode === 'responsive-hysteresis' || v2DragPerfMode === 'normal');
    const traceLocalResponsiveLive = live && draggingRef.current && (v2DragPerfMode === 'local-responsive' || v2DragPerfMode === 'normal');
    // 759 diagnostic isolation: these modes intentionally bypass every non-essential
    // drag-time sync so we can measure the raw cost of splitter/pane geometry.
    const purePaneLive = live && draggingRef.current && v2DragPerfMode === 'pure-pane';
    // 764 production path: the verified Pure Pane geometry hot path is now the
    // normal Lite V2 drag behavior. Responsive UI is published only from the
    // already-known pane widths, with no DOM read, observer or React state added
    // to pointermove. The explicit `pure-pane-live` mode remains as an admin A/B
    // alias so the proven candidate can still be compared directly.
    const tabletTouchPureLive = live && draggingRef.current && v2DragPerfMode === 'tablet-touch-pure';
    const purePaneResponsiveLive = live && draggingRef.current
      && (v2DragPerfMode === 'pure-pane-live' || v2DragPerfMode === 'normal' || v2DragPerfMode === 'tablet-touch-pure');
    const splitterOnlyLive = live && draggingRef.current && v2DragPerfMode === 'splitter-only';
    const leftPaneOnlyLive = live && draggingRef.current && v2DragPerfMode === 'left-pane-only';
    const rightPaneOnlyLive = live && draggingRef.current && v2DragPerfMode === 'right-pane-only';
    const contentLeftFreezeLive = live && draggingRef.current && v2DragPerfMode === 'content-left-freeze';
    const contentRightFreezeLive = live && draggingRef.current && v2DragPerfMode === 'content-right-freeze';
    const contentFreezeLive = live && draggingRef.current && v2DragPerfMode === 'content-freeze';
    const pureGeometryDiagnosticLive = purePaneLive || purePaneResponsiveLive || splitterOnlyLive || leftPaneOnlyLive || rightPaneOnlyLive || contentLeftFreezeLive || contentRightFreezeLive || contentFreezeLive;
    const deferScrollLockLive = live && draggingRef.current
      && (v2DragPerfMode === 'scroll-defer'
        || v2DragPerfMode === 'direct-scroll-defer'
        || traceResponsiveFreezeLive
        || traceResponsiveHysteresisLive
        || traceLocalResponsiveLive
        || v2DragPerfMode === 'normal');
    const directGeometryLive = live && draggingRef.current
      && (v2DragPerfMode === 'direct-geometry'
        || v2DragPerfMode === 'direct-scroll-defer'
        || traceResponsiveFreezeLive
        || traceResponsiveHysteresisLive
        || traceLocalResponsiveLive
        || v2DragPerfMode === 'normal');
    const freezeBuilderResponsiveLive = live && draggingRef.current
      && (v2DragPerfMode === 'content-left-freeze' || v2DragPerfMode === 'content-freeze');
    const freezeResultResponsiveLive = live && draggingRef.current
      && (v2DragPerfMode === 'content-right-freeze' || v2DragPerfMode === 'content-freeze');
    percentRef.current = nextPercent;
    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (nextPercent / 100));
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = metricsRef.current.left + builderWidth;

    if (pureGeometryDiagnosticLive) {
      const viewportSplitterLeft = Math.max(0, Math.round(splitterLeft - 8));

      // Splitter-only proves whether pointer/rAF itself is fast when pane layout is absent.
      if (splitterOnlyLive) {
        splitterRef.current?.style.setProperty('left', `${viewportSplitterLeft}px`, 'important');
      } else {
        // Mark temporary direct geometry so the normal pointer-up reconciliation can
        // remove all diagnostic inline geometry before restoring the runtime owner.
        layout.dataset.v2TraceDirectGeometry = 'true';

        if (purePaneLive || purePaneResponsiveLive || leftPaneOnlyLive || contentLeftFreezeLive || contentRightFreezeLive || contentFreezeLive) {
          builder.style.setProperty('left', '0px', 'important');
          builder.style.setProperty('right', 'auto', 'important');
          builder.style.setProperty('width', `${builderWidth}px`, 'important');
        }
        if (purePaneLive || purePaneResponsiveLive || rightPaneOnlyLive || contentLeftFreezeLive || contentRightFreezeLive || contentFreezeLive) {
          result.style.setProperty('left', `${builderWidth}px`, 'important');
          result.style.setProperty('right', dragResultRightRef.current, 'important');
          result.style.removeProperty('width');
        }
        splitterRef.current?.style.setProperty('left', `${viewportSplitterLeft}px`, 'important');
      }

      if (purePaneResponsiveLive || contentLeftFreezeLive || contentRightFreezeLive || contentFreezeLive) {
        // 768 — Galaxy Tab Pure Pane tablet isolation.
        // The old 657 fast-path marker was only published from the non-Pure branch
        // and only for fine pointers. Since 764 made Pure Pane the production path,
        // coarse touch/S Pen never received the already-proven 661~1080px layout
        // containment and therefore kept paying the full tablet card/list reflow.
        // Reuse the same marker from already-known pane widths. It changes only
        // when a pane enters/leaves the tablet band; there is no DOM read here.
        const touchLikePointer = activePointerTypeRef.current === 'touch'
          || activePointerTypeRef.current === 'pen'
          || (!activePointerTypeRef.current && !finePointerFastPathRef.current)
          || tabletTouchPureLive;
        if (touchLikePointer) {
          const syncPurePaneTabletFastPath = (pane: HTMLElement, paneWidth: number) => {
            const shouldBeActive = paneWidth > CONTENT_MOBILE_MAX && paneWidth <= CONTENT_TABLET_MAX;
            const isActive = pane.dataset.soridrawPaneTabletFastpath === 'true';
            if (shouldBeActive === isActive) return;
            if (shouldBeActive) pane.dataset.soridrawPaneTabletFastpath = 'true';
            else delete pane.dataset.soridrawPaneTabletFastpath;
          };
          syncPurePaneTabletFastPath(builder, builderWidth);
          syncPurePaneTabletFastPath(result, resultWidth);
        }

        if (tabletTouchPureLive) {
          // Discrete Pane-level Container Query band synchronization.
          // Replaces continuous 1px browser-internal CQ evaluations with discrete
          // dataset updates ONLY when actual breakpoint boundaries (1074, 760, 700 / 660) are crossed.
          const nextBuilderBand = builderWidth <= 700 ? 'compact-700' : builderWidth <= 760 ? 'compact-760' : builderWidth <= 1074 ? 'compact-1074' : 'wide';
          if (dragBuilderCqBandRef.current !== nextBuilderBand) {
            dragBuilderCqBandRef.current = nextBuilderBand;
            builder.dataset.dragCqBand = nextBuilderBand;
          }
          const nextResultBand = resultWidth <= 660 ? 'compact-660' : 'wide';
          if (dragResultCqBandRef.current !== nextResultBand) {
            dragResultCqBandRef.current = nextResultBand;
            result.dataset.dragCqBand = nextResultBand;
          }
        }

        // 762: do not rely on a one-shot boundary signature to trigger the live
        // responsive handoff. Fast pointer frames can jump across multiple bands,
        // and a missed signature left Compact/Mobile visually stale until pointer-up.
        // Run only the cheap mode comparisons every rAF; both helpers already skip
        // every DOM write/event when the resolved mode did not change. Root/html,
        // external geometry, scroll locks, ARIA and persistence stay deferred.
        const responsiveOptions = {
          rootSync: false,
          hysteresisPx: 0,
        };
        syncPaneModes(builderWidth, resultWidth, responsiveOptions);
        broadcastLitePaneResponsiveWidths(builderWidth, resultWidth, false, responsiveOptions);
        dragBoundarySignatureRef.current = readDragBoundarySignature(builderWidth, resultWidth, workspaceViewRef.current);
      }

      // 790: Pure Pane is the production drag path and used to return here before
      // `syncExternalGeometry`, so the divider moved live while the Generate bar
      // waited for pointer-up. Publish only the Generate bar's read-free geometry
      // from this same rAF frame; all other external/root work stays deferred.
      syncGenerationBarGeometry(builderWidth);

      // Keep the split-edge collapse UI correct even on the Pure Pane
      // production hot path, which intentionally returns before auxiliary
      // external-geometry synchronization. This is threshold-only state plus
      // one tiny button position write at an actual minimum edge.
      syncMinimumCollapseControls(nextPercent, bounds, safeWidth, splitterLeft, true);

      if (perfEnabled && live) {
        recordSplitPerfGeometryWrite(builderWidth, resultWidth);
        const perfEnd = performance.now();
        recordSplitPerfApply({
          totalMs: perfEnd - perfStart,
          layoutWriteMs: perfEnd - perfStart,
          responsiveMs: 0,
          externalMs: 0,
          miscMs: 0,
        });
      }
      return nextPercent;
    }
    const boundarySignature = auxBoundaryLive
      ? readDragBoundarySignature(builderWidth, resultWidth, workspaceViewRef.current)
      : null;
    const boundaryChanged = auxBoundaryLive && dragBoundarySignatureRef.current !== boundarySignature;
    if (boundaryChanged) dragBoundarySignatureRef.current = boundarySignature;
    const deferAuxLive = auxFreezeLive || auxBoundaryLive;
    const allowResponsiveSync = !traceResponsiveFreezeLive && !auxFreezeLive && (!auxBoundaryLive || boundaryChanged);

    // 657: the 656 test confirmed the slow state is owned by pane width.
    // Reuse the engine's already-known geometry and mark each fine-pointer pane
    // while its live width sits in the shared 661~1080px tablet band. The marker
    // activates only drag-time CSS isolation; normal tablet rendering is untouched.
    if (!traceResponsiveFreezeLive && (!deferAuxLive || boundaryChanged)) {
      const syncPaneTabletProbe = (pane: HTMLElement, paneWidth: number) => {
        const wasActive = pane.dataset.soridrawPaneTabletFastpath === 'true';
        const tabletBandActive = traceResponsiveHysteresisLive
          ? wasActive
            ? paneWidth > CONTENT_MOBILE_MAX - TRACE_RESPONSIVE_HYSTERESIS
              && paneWidth <= CONTENT_TABLET_MAX + TRACE_RESPONSIVE_HYSTERESIS
            : paneWidth > CONTENT_MOBILE_MAX + TRACE_RESPONSIVE_HYSTERESIS
              && paneWidth <= CONTENT_TABLET_MAX - TRACE_RESPONSIVE_HYSTERESIS
          : paneWidth > CONTENT_MOBILE_MAX && paneWidth <= CONTENT_TABLET_MAX;
        const active = finePointerFastPathRef.current && tabletBandActive;
        if (active) pane.dataset.soridrawPaneTabletFastpath = 'true';
        else delete pane.dataset.soridrawPaneTabletFastpath;
      };
      if (!freezeBuilderResponsiveLive) syncPaneTabletProbe(builder, builderWidth);
      if (!freezeResultResponsiveLive) syncPaneTabletProbe(result, resultWidth);
    }

    // 609: geometry ownership changes only when the *published content mode*
    // itself changes. This keeps the visible PC/Tablet switch and the low-level
    // pane owner on the same boundary, eliminating the 608 16px disagreement.
    if (!benchmarkRunningRef.current && !traceResponsiveFreezeLive && !freezeResultResponsiveLive && (!deferAuxLive || boundaryChanged)) {
      const nextResultContentMode = traceResponsiveHysteresisLive
        ? resolveContentResponsiveMode(runtimeResultContentModeRef.current, Math.max(1, resultWidth), TRACE_RESPONSIVE_HYSTERESIS)
        : readContentResponsiveMode(Math.max(1, resultWidth));
      if (runtimeResultContentModeRef.current !== nextResultContentMode) {
        runtimeResultContentModeRef.current = nextResultContentMode;
        const nextRuntimeLayoutMode = resolveRuntimeLayoutMode(nextResultContentMode, workspaceViewRef.current, runtimeProfile);
        if (runtimeLayoutModeRef.current !== nextRuntimeLayoutMode) {
          runtimeLayoutModeRef.current = nextRuntimeLayoutMode;
          benchmarkLayoutModeRef.current = nextRuntimeLayoutMode;
        }
      }
    }

    writeLiveSplitGeometry(builderWidth, resultWidth, directGeometryLive);
    if (perfEnabled && live) recordSplitPerfGeometryWrite(builderWidth, resultWidth);
    const perfAfterLayoutWrite = perfEnabled ? performance.now() : 0;
    if (allowResponsiveSync) {
      const responsiveOptions = {
        skipBuilder: freezeBuilderResponsiveLive,
        skipResult: freezeResultResponsiveLive,
        rootSync: !traceLocalResponsiveLive,
        hysteresisPx: traceResponsiveHysteresisLive ? TRACE_RESPONSIVE_HYSTERESIS : undefined,
      };
      syncPaneModes(builderWidth, resultWidth, responsiveOptions);
      broadcastLitePaneResponsiveWidths(builderWidth, resultWidth, false, responsiveOptions);
    }
    const perfAfterResponsive = perfEnabled ? performance.now() : 0;
    if (live && !deferAuxLive) syncExternalGeometry(builderWidth, splitterLeft);
    const perfAfterExternal = perfEnabled ? performance.now() : 0;

    if (!deferAuxLive) {
      syncMinimumCollapseControls(
        nextPercent,
        bounds,
        safeWidth,
        splitterLeft,
        live && draggingRef.current,
      );

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
      if (live && draggingRef.current && !deferScrollLockLive) applyDragScrollLocks();
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
  }, [applyDragScrollLocks, broadcastLitePaneResponsiveWidths, runtimeProfile, syncExternalGeometry, syncGenerationBarGeometry, syncMinimumCollapseControls, syncPaneModes, v2DragPerfMode, writeLiveSplitGeometry]);

  const refreshMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    refreshIsolationHeight();
    syncModalHost();
    // 775: refresh is outside the drag hot path. Keep the tablet result scroll
    // shell extended through Studio main's 18px right gutter before any direct
    // geometry write runs, so the native scrollbar sits on the outer divider.
    if (window.innerWidth >= 1100 && window.innerWidth < 1600) {
      dragResultRightRef.current = '-18px';
    }
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

    const nativeWindowResize = document.documentElement.classList.contains('soridraw-window-resizing');
    if (nativeWindowResize) {
      // 748 — The native-resize Generate bar consumes the builder geometry that
      // was committed above. Do not publish a second pair of action-bar custom
      // properties from JS on every frame.
      clearLiveExternalGeometry();
    } else {
      readExternalControls();
      syncExternalGeometry(builderWidth, splitterLeft);
      clearLiveExternalGeometry();
    }
  }, [applyPercent, broadcastLitePaneResponsiveWidths, clearLiveExternalGeometry, commitRootMeasurements, readExternalControls, refreshIsolationHeight, syncExternalGeometry, syncModalHost]);

  const scheduleMetricsRefresh = useCallback(() => {
    if (draggingRef.current || refreshFrameRef.current !== null) return;
    refreshFrameRef.current = window.requestAnimationFrame(() => {
      refreshFrameRef.current = null;
      refreshMetrics();
    });
  }, [refreshMetrics]);

  const flushPointer = useCallback(() => {
    const perfStart = (benchmarkRunningRef.current || manualPerfCaptureActiveRef.current) && isSplitPerfDragActive() ? performance.now() : 0;
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
    // 573: one real boundary again. The divider and both panes are owned by the
    // same single local width write on every rAF frame. Smoothness now comes
    // from reducing the amount of off-screen content the browser must reflow,
    // not from letting a fake 60fps divider run ahead of 30fps content.
    applyPercent(nextPercent, true);
    if (perfStart > 0) recordSplitPerfFlush(performance.now() - perfStart, true);
  }, [applyPercent]);

  const schedulePointer = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(flushPointer);
  }, [flushPointer]);

  const startLayoutAckObserver = useCallback((builderWidth: number, resultWidth: number) => {
    layoutAckObserverRef.current?.disconnect();
    layoutAckObserverRef.current = null;
    layoutAckObservedRef.current = { builder: builderWidth, result: resultWidth };
    if (typeof ResizeObserver === 'undefined') return;
    const builder = builderRef.current;
    const result = resultRef.current;
    if (!builder || !result) return;

    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const borderSize = entry.borderBoxSize?.[0]?.inlineSize;
        const width = Number.isFinite(borderSize) ? Number(borderSize) : entry.contentRect.width;
        if (entry.target === builder && Number.isFinite(width)) {
          layoutAckObservedRef.current.builder = width;
          changed = true;
        } else if (entry.target === result && Number.isFinite(width)) {
          layoutAckObservedRef.current.result = width;
          changed = true;
        }
      }
      if (changed) {
        recordSplitPerfLayoutAck(
          layoutAckObservedRef.current.builder,
          layoutAckObservedRef.current.result,
        );
      }
    });

    observer.observe(builder, { box: 'border-box' });
    observer.observe(result, { box: 'border-box' });
    layoutAckObserverRef.current = observer;
  }, []);

  const finishDrag = useCallback((event?: React.PointerEvent<HTMLButtonElement>, preserveScroll = true) => {
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
    activePointerTypeRef.current = '';
    layoutRef.current?.classList.remove('is-dragging');
    // 787: only the dedicated Lyrics vertical lock remains drag-only. The five
    // keyword cards no longer have a second drag-time height owner, so pointer-up
    // cannot swap their geometry from a snapshot back to resting CSS.
    const purePaneLockedCards = builderRef.current?.querySelectorAll<HTMLElement>('[data-soridraw-pure-pane-vertical-lock="true"]');
    purePaneLockedCards?.forEach((card) => {
      delete card.dataset.soridrawPurePaneVerticalLock;
      card.style.removeProperty('--soridraw-pure-pane-card-height');
      card.style.removeProperty('--soridraw-pure-pane-header-height');
      card.style.removeProperty('--soridraw-pure-pane-body-height');
      card.style.removeProperty('--soridraw-pure-pane-summary-height');
    });
    clearV2DragContentFreeze();
    if (
      v2DragPerfMode === 'aux-freeze'
      || v2DragPerfMode === 'aux-boundary'
      || v2DragPerfMode === 'content-left-freeze'
      || v2DragPerfMode === 'content-right-freeze'
      || v2DragPerfMode === 'content-freeze'
      || v2DragPerfMode === 'scroll-defer'
      || v2DragPerfMode === 'direct-geometry'
      || v2DragPerfMode === 'direct-scroll-defer'
      || v2DragPerfMode === 'responsive-freeze'
      || v2DragPerfMode === 'responsive-hysteresis'
      || v2DragPerfMode === 'local-responsive'
      || v2DragPerfMode === 'pure-pane'
      || v2DragPerfMode === 'pure-pane-live'
      || v2DragPerfMode === 'splitter-only'
      || v2DragPerfMode === 'left-pane-only'
      || v2DragPerfMode === 'right-pane-only'
      || v2DragPerfMode === 'tablet-touch-pure'
      || v2DragPerfMode === 'normal'
    ) {
      // Reconcile any intentionally deferred responsive/external state exactly
      // once after pointer-up. Content-freeze modes now defer their selected
      // pane's responsive contract as well as its formatting width.
      applyPercent(percentRef.current, false);
    }
    // 761: do not lock the whole split workspace height. That temporary
    // shell lock changed the scroll owner/scrollbar geometry while dragging.
    // Menu-card height stabilization is local to the Builder cards instead.
    if (layoutRef.current) delete layoutRef.current.dataset.v2DragPerfMode;
    if (builderRef.current) delete builderRef.current.dataset.dragCqBand;
    if (resultRef.current) delete resultRef.current.dataset.dragCqBand;
    dragBuilderCqBandRef.current = null;
    dragResultCqBandRef.current = null;
    dragBoundarySignatureRef.current = null;
    document.documentElement.classList.remove('soridraw-lite-split-dragging');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    const safeWidth = Math.max(1, metricsRef.current.width);
    const builderWidth = builderCollapsedRef.current ? 0 : resultCollapsedRef.current ? safeWidth : Math.round(safeWidth * (percentRef.current / 100));
    commitRootMeasurements(builderWidth, metricsRef.current.left + builderWidth);
    clearLiveExternalGeometry();
    readExternalControls();
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'));
    finishDragScrollLocks(preserveScroll);
    layoutAckObserverRef.current?.disconnect();
    layoutAckObserverRef.current = null;
    if (manualPerfCaptureActiveRef.current) {
      manualPerfCaptureActiveRef.current = false;
      finishSplitPerfDrag();
    }
    window.requestAnimationFrame(connectTopCardObserver);
    try { window.localStorage.setItem(getStorageKey(splitProfileRef.current), String(percentRef.current)); } catch { /* optional */ }
  }, [applyPercent, clearLiveExternalGeometry, clearV2DragContentFreeze, commitRootMeasurements, connectTopCardObserver, finishDragScrollLocks, flushPointer, readExternalControls, v2DragPerfMode]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (builderCollapsedRef.current || resultCollapsedRef.current || window.innerWidth < 1100) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    if (rect.width <= 0) return;

    // 789: Vocal/Lyrics must use the same vertical geometry during drag and rest.
    // 763 still snapshotted Lyrics on pointer-down and released that snapshot on
    // pointer-up. At the 1074px compact-title handoff, the live drag therefore
    // kept the old header/card height while the resting CSS used the new one,
    // producing the exact release-only jump visible in the lower card row.
    // Clear any stale legacy lock but do NOT create a new drag-time snapshot.
    // The shared 789 header-slot rule in studioLayout.css now owns both Vocal and
    // Lyrics before, during and after the gesture.
    if (builderRef.current) {
      const staleVerticalLocks = builderRef.current.querySelectorAll<HTMLElement>(
        '[data-soridraw-pure-pane-vertical-lock="true"]'
      );
      for (const card of staleVerticalLocks) {
        delete card.dataset.soridrawPurePaneVerticalLock;
        card.style.removeProperty('--soridraw-pure-pane-card-height');
        card.style.removeProperty('--soridraw-pure-pane-header-height');
        card.style.removeProperty('--soridraw-pure-pane-body-height');
        card.style.removeProperty('--soridraw-pure-pane-summary-height');
      }
    }

    const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');
    const leftRailRect = leftRail?.getBoundingClientRect();
    metricsRef.current = {
      left: rect.left,
      width: rect.width,
      leftRailEdge: leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,
    };
    readExternalControls();
    const builderRect = builderRef.current?.getBoundingClientRect();
    const resultRect = resultRef.current?.getBoundingClientRect();
    // 762: read the resting result-shell right edge once before direct drag geometry
    // starts. No geometry read is added to pointermove. This preserves the wide-PC
    // -18px scrollbar reach-through instead of overriding it with right:0.
    if (resultRef.current) {
      // 775: tablet direct geometry must not re-capture a stale inline `right:0`
      // and pull the result scrollbar back inside. Wide PC keeps its existing
      // computed-style behavior; tablet split has one canonical -18px edge.
      if (window.innerWidth >= 1100 && window.innerWidth < 1600) {
        dragResultRightRef.current = '-18px';
      } else {
        const restingRight = window.getComputedStyle(resultRef.current).right;
        dragResultRightRef.current = restingRight && restingRight !== 'auto' ? restingRight : '0px';
      }
    } else {
      dragResultRightRef.current = window.innerWidth >= 1100 && window.innerWidth < 1600 ? '-18px' : '0px';
    }
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
    captureDragScrollLocks();
    clearV2DragContentFreeze();
    if (v2DragPerfMode === 'content-left-freeze' || v2DragPerfMode === 'content-freeze') {
      if (builderRect?.width) builderRef.current?.style.setProperty('--soridraw-v2-drag-content-width', `${Math.max(1, Math.round(builderRect.width))}px`);
    }
    if (v2DragPerfMode === 'content-right-freeze' || v2DragPerfMode === 'content-freeze') {
      if (resultRect?.width) resultRef.current?.style.setProperty('--soridraw-v2-drag-content-width', `${Math.max(1, Math.round(resultRect.width))}px`);
    }
    if (v2DragPerfMode === 'tablet-touch-pure') {
      const initialBWidth = builderRect?.width || Math.round(rect.width * (percentRef.current / 100));
      const initialRWidth = resultRect?.width || Math.max(0, rect.width - initialBWidth);
      const initialBuilderBand = initialBWidth <= 700 ? 'compact-700' : initialBWidth <= 760 ? 'compact-760' : initialBWidth <= 1074 ? 'compact-1074' : 'wide';
      const initialResultBand = initialRWidth <= 660 ? 'compact-660' : 'wide';
      dragBuilderCqBandRef.current = initialBuilderBand;
      dragResultCqBandRef.current = initialResultBand;
      if (builderRef.current) builderRef.current.dataset.dragCqBand = initialBuilderBand;
      if (resultRef.current) resultRef.current.dataset.dragCqBand = initialResultBand;
    }
    dragBoundarySignatureRef.current = v2DragPerfMode === 'aux-boundary'
      || v2DragPerfMode === 'pure-pane-live'
      || v2DragPerfMode === 'normal'
      ? readDragBoundarySignature(builderRect?.width || 1, resultRect?.width || 1, workspaceViewRef.current)
      : null;
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    activePointerTypeRef.current = event.pointerType || '';
    pendingClientXRef.current = null;
    // 611: real hand dragging is intentionally uninstrumented unless the admin
    // explicitly arms the one-shot "실손 드래그 비교" diagnostic. The arm is
    // consumed here, so ordinary usage never starts observers/raf probes.
    const activeWorkspace = workspaceView || 'create';
    const captureManualPerf = manualPerfArmedWorkspaceRef.current === activeWorkspace;
    manualPerfArmedWorkspaceRef.current = null;
    manualPerfCaptureActiveRef.current = captureManualPerf;
    if (captureManualPerf) {
      beginSplitPerfDrag({
        workspaceView,
        engine: `Lite V2 · armed hand diagnostic 612 · ${runtimeResultContentModeRef.current || 'unknown'}/${runtimeLayoutModeRef.current}`,
        builder: builderRef.current,
        result: resultRef.current,
        layoutMode: runtimeLayoutModeRef.current,
      });
      startLayoutAckObserver(builderRect?.width || 0, resultRect?.width || 0);
    }
    lastPixelRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    layout.classList.add('is-dragging');
    layout.dataset.v2DragPerfMode = v2DragPerfMode;
    document.documentElement.classList.add('soridraw-lite-split-dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.dispatchEvent(new CustomEvent('soridraw-split-drag-start'));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || event.pointerId !== pointerIdRef.current) return;
    // 611: remove the 610 mouse-only coalesced-event correction. Touch keeps the
    // verified Lite V2 path; PC no longer uses this engine in automatic mode.
    if (manualPerfCaptureActiveRef.current) {
      const nativeEvent = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
      let coalescedCount = 1;
      try { coalescedCount = Math.max(1, nativeEvent.getCoalescedEvents?.().length || 1); } catch { coalescedCount = 1; }
      recordSplitPerfPointer(event.clientX, coalescedCount);
    }
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

  useEffect(() => () => {
    layoutAckObserverRef.current?.disconnect();
    layoutAckObserverRef.current = null;
    clearV2DragContentFreeze();
  }, [clearV2DragContentFreeze]);

  useEffect(() => {
    const handleManualPerfArm = (event: Event) => {
      const detail = (event as CustomEvent<{ armed?: boolean; workspace?: StudioWorkspaceView }>).detail;
      if (detail?.armed === false) {
        manualPerfArmedWorkspaceRef.current = null;
        return;
      }
      const nextWorkspace = detail?.workspace;
      if (nextWorkspace === 'create' || nextWorkspace === 'recent' || nextWorkspace === 'music-note' || nextWorkspace === 'library') {
        manualPerfArmedWorkspaceRef.current = nextWorkspace;
      }
    };
    window.addEventListener(SPLIT_PERF_MANUAL_DRAG_ARM_EVENT, handleManualPerfArm as EventListener);
    return () => window.removeEventListener(SPLIT_PERF_MANUAL_DRAG_ARM_EVENT, handleManualPerfArm as EventListener);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const nextWorkspace = workspaceView || 'create';
    root.dataset.soridrawLiteWorkspace = nextWorkspace;
    return () => {
      if (root.dataset.soridrawLiteWorkspace === nextWorkspace) delete root.dataset.soridrawLiteWorkspace;
    };
  }, [workspaceView]);

  useLayoutEffect(() => {
    if (benchmarkRunningRef.current) return;

    // 612: workspace/profile changes can alter the geometry owner. Reset the
    // cached content mode so the next refresh resolves exactly one owner from
    // the current pane, outside a gesture.
    runtimeResultContentModeRef.current = null;
    const nextLayoutMode = readInitialRuntimeLayoutMode(workspaceView, runtimeProfile);
    runtimeLayoutModeRef.current = nextLayoutMode;
    benchmarkLayoutModeRef.current = nextLayoutMode;
    if (nextLayoutMode === 'css-var') clearDirectBenchmarkGeometry();
    const frame = window.requestAnimationFrame(() => refreshMetrics());
    return () => window.cancelAnimationFrame(frame);
  }, [clearDirectBenchmarkGeometry, refreshMetrics, runtimeProfile, workspaceView]);

  useEffect(() => {
    const emitBenchmarkStatus = (state: 'running' | 'done' | 'error', message: string) => {
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_STATUS_EVENT, { detail: { state, message } }));
    };

    const handleBenchmarkRequest = (requestEvent: Event) => {
      const requestDetail = (requestEvent as CustomEvent<{ layoutMode?: BenchmarkLayoutMode }>).detail;
      // 603: a normal automatic benchmark must measure the workspace's real
      // runtime path. Only the explicit coordinate A/B diagnostic overrides it.
      const requestedLayoutMode: BenchmarkLayoutMode = requestDetail?.layoutMode === 'direct'
        ? 'direct'
        : requestDetail?.layoutMode === 'css-var'
          ? 'css-var'
          : runtimeLayoutModeRef.current;
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
        benchmarkLayoutModeRef.current = runtimeLayoutModeRef.current;
        if (runtimeLayoutModeRef.current === 'css-var') clearDirectBenchmarkGeometry();
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
      captureDragScrollLocks();
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
        finishDrag(undefined, false);
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
            engine: `Lite V2 · auto benchmark 612 · ${requestedLayoutMode} · ${benchmarkSurface} · set ${setIndex + 1}/3 · attempt ${attemptCount}`,
            builder,
            result,
            benchmarkSurface,
            benchmarkSurfacePass: surfacePass,
            layoutMode: requestedLayoutMode,
          });
          startLayoutAckObserver(builder.getBoundingClientRect().width, result.getBoundingClientRect().width);
          emitBenchmarkStatus('running', `측정 ${setIndex + 1}/3 · ${benchmarkSurface} PASS · ${requestedLayoutMode === 'direct' ? '직접 좌표' : 'CSS 변수'}`);
          runLegs(4, 1000, true, () => {
            finishSplitPerfDrag();
            layoutAckObserverRef.current?.disconnect();
            layoutAckObserverRef.current = null;
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
  }, [applyPercent, captureDragScrollLocks, clearDirectBenchmarkGeometry, finishDrag, readExternalControls, refreshMetrics, startLayoutAckObserver, viewMode, workspaceView, writeLiveSplitGeometry]);

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
        // 744 — Native window resize has one live geometry owner below. Avoid a
        // second observer commit in the same frame; keep the observer for rails
        // and non-window layout changes.
        if (!draggingRef.current && !document.documentElement.classList.contains('soridraw-window-resizing')) {
          scheduleMetricsRefresh();
        }
      });
      try { observer.observe(layout, { box: 'border-box' }); } catch { observer.observe(layout); }
    }
    // 744 — Same one-owner native resize contract as Legacy. The native resize
    // event publishes width/height changes live in one rAF path; ResizeObserver
    // stands down during that gesture and resumes for ordinary non-window layout
    // changes. Structural pane containers remain responsive while resizing.
    let lastViewportWidth = window.innerWidth;
    let lastViewportHeight = window.innerHeight;
    let resizeEndTimer: number | null = null;
    const handleWindowResize = () => {
      const root = document.documentElement;
      if (!root.classList.contains('soridraw-window-resizing')) {
        // 750 — Same one-read contract as Legacy. Capture the exact resting
        // command-anchor insets only when the native resize gesture starts;
        // every live frame still reuses the split engine's existing Builder
        // geometry, so this does not reintroduce the 746 per-frame reflow path.
        readExternalControls();
        const builderRect = builderRef.current?.getBoundingClientRect();
        const actionRect = externalRef.current.actionAnchor?.getBoundingClientRect();
        if (builderRect && actionRect && builderRect.width > 0 && actionRect.width > 0) {
          root.style.setProperty(
            '--soridraw-action-resize-measured-inset-left',
            `${Math.max(0, Math.round(actionRect.left - builderRect.left))}px`,
          );
          root.style.setProperty(
            '--soridraw-action-resize-measured-inset-right',
            `${Math.max(0, Math.round(builderRect.right - actionRect.right))}px`,
          );
        } else {
          root.style.removeProperty('--soridraw-action-resize-measured-inset-left');
          root.style.removeProperty('--soridraw-action-resize-measured-inset-right');
        }
        root.classList.add('soridraw-window-resizing');
        window.dispatchEvent(new CustomEvent('soridraw-window-resize-start'));
      }

      if (resizeEndTimer !== null) window.clearTimeout(resizeEndTimer);

      // 744 — Publish outer-window width changes every animation frame so the
      // visible Builder stage can cross desktop/Compact/mobile while the edge is
      // still being dragged. ResizeObserver is paused for the same native gesture,
      // preventing the old duplicate geometry path.
      const nextViewportWidth = window.innerWidth;
      const nextViewportHeight = window.innerHeight;
      if (nextViewportWidth !== lastViewportWidth || nextViewportHeight !== lastViewportHeight) {
        lastViewportWidth = nextViewportWidth;
        lastViewportHeight = nextViewportHeight;
        scheduleMetricsRefresh();
      }

      resizeEndTimer = window.setTimeout(() => {
        resizeEndTimer = null;
        root.classList.remove('soridraw-window-resizing');
        root.style.removeProperty('--soridraw-action-resize-measured-inset-left');
        root.style.removeProperty('--soridraw-action-resize-measured-inset-right');
        scheduleMetricsRefresh();
        syncResultTitleHeight();
        window.dispatchEvent(new CustomEvent('soridraw-window-resize-end'));
      }, 110);
    };
    // A rail toggle changes the Studio grid width immediately. Refresh the Lite
    // geometry in the same layout phase instead of one rAF later, otherwise the
    // builder masthead/search can visibly overshoot before snapping back.
    const handleFrameResize = () => {
      if (!draggingRef.current) refreshMetrics();
    };
    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('soridraw-studio-frame-resize', handleFrameResize as EventListener);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('soridraw-studio-frame-resize', handleFrameResize as EventListener);
      if (resizeEndTimer !== null) window.clearTimeout(resizeEndTimer);
      document.documentElement.classList.remove('soridraw-window-resizing');
      document.documentElement.style.removeProperty('--soridraw-action-resize-measured-inset-left');
      document.documentElement.style.removeProperty('--soridraw-action-resize-measured-inset-right');
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (refreshFrameRef.current !== null) window.cancelAnimationFrame(refreshFrameRef.current);
      document.documentElement.classList.remove('soridraw-lite-split-dragging');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      if (dragScrollRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(dragScrollRestoreFrameRef.current);
        dragScrollRestoreFrameRef.current = null;
      }
      dragScrollLocksRef.current = [];
      clearLiveExternalGeometry();
      const root = document.documentElement;
      delete root.dataset.soridrawBuilderMode;
      delete root.dataset.soridrawResultMode;
      delete root.dataset.soridrawBuilderContentMode;
      delete root.dataset.soridrawResultContentMode;
      delete root.dataset.soridrawLiteWorkspace;
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
      layoutRef.current?.removeAttribute('data-v2-trace-direct-geometry');
    };
  }, [clearLiveExternalGeometry, readExternalControls, refreshMetrics, scheduleMetricsRefresh, syncResultTitleHeight]);

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

  // 622: Studio Lite/590 now uses the exact same splitter DOM class and body
  // portal as the verified Recent Songs legacy path. Only the width engine stays
  // Lite; splitter top/bottom, thin line, hover color and <-> cursor have one
  // shared visual owner in studioLayout.css.
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
        data-lite-runtime-layout="content-mode-aligned"
        data-lite-runtime-profile={runtimeProfile}
        data-v2-drag-perf-mode={v2DragPerfMode}
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
      </div>
      {typeof document !== 'undefined' ? createPortal(centerModalHost, document.body) : centerModalHost}
      {viewMode === 'split' && !isBuilderCollapsed && !isResultCollapsed && (typeof document !== 'undefined' ? createPortal(splitter, document.body) : splitter)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(builderToggle, document.body) : builderToggle)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(resultToggle, document.body) : resultToggle)}
    </>
  );
}
