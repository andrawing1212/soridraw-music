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
// 741 — Keep the proven desktop Builder range intact and make Compact consume
// the former upper-mobile band instead. Mobile now begins only at the shared
// narrow-content floor; Compact owns 661~820px without shrinking desktop.
const BUILDER_MOBILE_BREAKPOINT = 660;
const BUILDER_COMPACT_MAX = 820;
const RESULT_MOBILE_BREAKPOINT = 680;
const CONTENT_RESULT_MOBILE_BREAKPOINT = 661;
const PANE_MODE_HYSTERESIS = 16;
const WIDE_DESKTOP_ISOLATION_BREAKPOINT = 1100;
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
  actionAnchor: HTMLElement | null;
  collapsedActionButton: HTMLElement | null;
  liveKeywords: HTMLElement | null;
  heroRow: HTMLElement | null;
  workspaceHeroHost: HTMLElement | null;
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

type StudioWorkspaceView = 'create' | 'recent' | 'music-note' | 'library';

type StudioSplitWorkspaceProps = {
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: 'split' | 'result-only' | 'hidden';
  workspaceView?: StudioWorkspaceView;
  workspaceRequestId?: number;
};

export default function StudioSplitWorkspace({
  children,
  builderMasthead,
  viewMode = 'split',
  workspaceView,
  workspaceRequestId = 0,
}: StudioSplitWorkspaceProps) {
  const panes = Children.toArray(children);
  const [percent, setPercent] = useState(readStored);
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(readStoredBuilderCollapsed);
  const [isResultCollapsed, setIsResultCollapsed] = useState(readStoredResultCollapsed);
  const draggingRef = useRef(false);
  const finePointerFastPathRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const modalHostRef = useRef<HTMLDivElement | null>(null);
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
  const lastDragLayoutCommitAtRef = useRef(0);
  const dragLayoutIntervalRef = useRef(16);
  const footerFrameRef = useRef<number | null>(null);
  const layoutRefreshFrameRef = useRef<number | null>(null);
  const builderModeAnchorFrameRef = useRef<number | null>(null);
  const builderModeScrollAnchorRef = useRef<{
    targetMode: PaneMode;
    edge: 'top' | 'bottom' | 'content' | 'progress';
    progress: number;
    element?: HTMLElement;
    elementRatio?: number;
    viewportOffset?: number;
  } | null>(null);
  const builderDragScrollAnchorRef = useRef<{
    edge: 'top' | 'bottom' | 'content';
    element?: HTMLElement;
    elementRatio?: number;
    viewportOffset?: number;
  } | null>(null);
  const lastDragBuilderPixelRef = useRef<number | null>(null);
  const lastAriaPercentRef = useRef<number | null>(null);
  const lastAriaBoundsRef = useRef<string | null>(null);
  const lastActionControlPixelRef = useRef<string | null>(null);
  const actionAnchorInsetsRef = useRef<{ left: number; right: number } | null>(null);
  const externalControlsReadyRef = useRef(false);
  const lastIsolatedWorkspaceHeightRef = useRef<number | null>(null);
  const lastIsolationViewportHeightRef = useRef<number | null>(null);
  const lastTopCardHeightRef = useRef<number | null>(null);
  const externalControlsRef = useRef<ExternalSplitControls>({
    searchButton: null,
    floatingActionBar: null,
    actionAnchor: null,
    collapsedActionButton: null,
    liveKeywords: null,
    heroRow: null,
    workspaceHeroHost: null,
  });

  const isStudioBlack = useCallback(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.soridrawTheme === 'studio-black', []);

  const syncCenterModalHostBounds = useCallback(() => {
    const host = modalHostRef.current;
    if (!host || typeof window === 'undefined') return;

    // Detail windows must behave like Studio-wide modals, not like content
    // inside either split pane. Give the shared body portal the full viewport
    // so its backdrop covers the navigation/rails and the panel can extend
    // beyond the current builder/result boundaries.
    host.style.left = '0px';
    host.style.top = '0px';
    host.style.width = `${Math.max(0, Math.round(window.innerWidth))}px`;
    host.style.height = `${Math.max(0, Math.round(window.innerHeight))}px`;
  }, []);

  const syncResultTitleHeight = useCallback(() => {
    // Width dragging already owns the pane geometry for this frame. Running a
    // second ResizeObserver-driven measurement here forces another synchronous
    // layout of both large panes and is the main source of visible card stutter.
    // 664: native horizontal window resizing has the same ownership rule. In the
    // 1100~1599 compact/tablet composition the Genre card rewraps repeatedly, so
    // its observer can otherwise force a second full-tree layout on nearly every
    // browser resize tick. Keep the last stable cross-pane title height until the
    // existing resize-end path performs one final exact sync.
    if (
      draggingRef.current
      || document.documentElement.classList.contains('soridraw-window-resizing')
    ) return;

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
    root.style.removeProperty('--soridraw-studio-scroll-masthead-space');
    delete root.dataset.soridrawBuilderAtMinimum;
    delete root.dataset.soridrawResultAtMinimum;
    delete root.dataset.soridrawBuilderMastheadScrolled;
    delete root.dataset.soridrawResultMastheadScrolled;
  }, []);

  const readExternalControls = useCallback((force = false) => {
    const current = externalControlsRef.current;
    if (force || !externalControlsReadyRef.current) {
      current.searchButton = document.querySelector<HTMLElement>('.soridraw-studio-hero-search-button');
      current.floatingActionBar = document.querySelector<HTMLElement>(
        'body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]',
      );
      current.actionAnchor = document.querySelector<HTMLElement>('.soridraw-studio-action-geometry-anchor');
      current.collapsedActionButton = document.querySelector<HTMLElement>(
        'body > .soridraw-studio-action-collapsed',
      );
      current.liveKeywords = document.querySelector<HTMLElement>(
        'body > .soridraw-live-keywords-fixed',
      );
      current.heroRow = document.querySelector<HTMLElement>('.soridraw-studio-hero-row');
      current.workspaceHeroHost = document.getElementById('soridraw-studio-workspace-hero-host');
      externalControlsReadyRef.current = true;
    }
    return current;
  }, []);

  const clearExternalMeasurements = useCallback(() => {
    const { searchButton, floatingActionBar, collapsedActionButton, liveKeywords, heroRow } = externalControlsRef.current;
    searchButton?.style.removeProperty('left');
    searchButton?.style.removeProperty('right');
    searchButton?.style.removeProperty('transform');
    searchButton?.style.removeProperty('--soridraw-studio-search-x');
    if (floatingActionBar) {
      floatingActionBar.style.removeProperty('left');
      floatingActionBar.style.removeProperty('width');
      floatingActionBar.style.removeProperty('--soridraw-studio-builder-width');
      floatingActionBar.style.removeProperty('--soridraw-action-fixed-left');
      floatingActionBar.style.removeProperty('--soridraw-action-fixed-width');
    }
    if (collapsedActionButton) {
      collapsedActionButton.style.removeProperty('--soridraw-studio-builder-width');
      collapsedActionButton.style.removeProperty('--soridraw-studio-left-rail-edge');
    }
    if (liveKeywords) {
      liveKeywords.style.removeProperty('left');
      liveKeywords.style.removeProperty('right');
    }
    // During drag the hero row owns a local live split width so its portaled
    // Music Note / Library title follows the divider in the same frame. Once
    // pointer-up commits the matching root variable, remove only this preview.
    heroRow?.style.removeProperty('--soridraw-studio-builder-width');
    splitterRef.current?.style.removeProperty('left');
    splitterRef.current?.style.removeProperty('transform');
    builderCollapseToggleRef.current?.style.removeProperty('left');
    resultCollapseToggleRef.current?.style.removeProperty('left');
    resultCollapseToggleRef.current?.style.removeProperty('right');
    lastActionControlPixelRef.current = null;
    actionAnchorInsetsRef.current = null;
    externalControlsReadyRef.current = false;
  }, []);

  const syncExternalMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const { left, leftRailEdge } = metricsRef.current;
    const controls = readExternalControls();
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));
    const workspaceRight = Math.max(0, window.innerWidth - (left + metricsRef.current.width));
    const resultWidth = Math.max(0, metricsRef.current.width - roundedBuilderWidth);
    // 658: 590/591 proved that production can pay a much larger style/layout
    // cost when live geometry is published through inherited root custom
    // properties. 656/657 isolated the remaining slow state to a 661~1080px
    // pane. In that exact fine-pointer band, keep external live geometry local
    // to the element that consumes it, matching Lite V2's verified PROD path.
    const useTabletProdParityPath = finePointerFastPathRef.current && (
      (roundedBuilderWidth > 660 && roundedBuilderWidth <= 1080)
      || (resultWidth > 660 && resultWidth <= 1080)
    );

    // The page masthead is outside the split layout and therefore cannot inherit
    // the builder pane's temporary inline width. Mirror the live builder width
    // onto its own grid variable on every pointer frame. This keeps Music Note
    // and Suno Library titles attached to the divider instead of snapping only
    // after the root variable is committed on pointer-up.
    controls.heroRow?.style.setProperty(
      '--soridraw-studio-builder-width',
      `${roundedBuilderWidth}px`,
      'important',
    );

    // The divider is a fixed body portal. Give it one coordinate owner only:
    // the exact viewport left position. The previous transform preview lost to
    // an older higher-specificity `transform: none !important` rule, leaving
    // the divider at x=0 and making it appear to have vanished.
    if (splitterRef.current) {
      splitterRef.current.style.removeProperty('transform');
      splitterRef.current.style.setProperty(
        'left',
        `${Math.max(0, roundedSplitterLeft - 8)}px`,
        'important',
      );
    }

    // The pane collapse controls are body portals. During pointer drag the
    // committed root CSS variable intentionally stays unchanged until pointer-up,
    // so drive both controls from the same rounded live splitter coordinate.
    // Keep the exact approved 9px edge gap used by the resting CSS; using the
    // older -54/+20 offsets made the newly revealed buttons jump while the
    // pointer remained held at either drag limit, then snap back on release.
    if (builderCollapseToggleRef.current && !builderCollapsedRef.current) {
      builderCollapseToggleRef.current.style.setProperty(
        'left',
        `${Math.max(0, roundedSplitterLeft - 43)}px`,
        'important',
      );
    }
    if (resultCollapseToggleRef.current && !resultCollapsedRef.current) {
      resultCollapseToggleRef.current.style.removeProperty('right');
      resultCollapseToggleRef.current.style.setProperty(
        'left',
        `${Math.min(window.innerWidth - 43, roundedSplitterLeft + 9)}px`,
        'important',
      );
    }
    if (controls.liveKeywords && !useTabletProdParityPath) {
      controls.liveKeywords.style.setProperty(
        'left',
        `${Math.max(0, roundedSplitterLeft + 18)}px`,
        'important',
      );
      controls.liveKeywords.style.setProperty(
        'right',
        `${Math.max(0, Math.round(workspaceRight))}px`,
        'important',
      );
    } else if (controls.liveKeywords) {
      // Desktop Studio Black hides this body portal. Avoid two dead layout
      // writes per pointer frame in the 656-confirmed hot band.
      controls.liveKeywords.style.removeProperty('left');
      controls.liveKeywords.style.removeProperty('right');
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
        `${Math.max(26, Math.round(metricsRef.current.width - roundedBuilderWidth + 26))}px`,
        'important',
      );
    }

    // The floating action bar lives in a body portal, so it does not inherit
    // the builder pane width automatically. Keep its outer box and responsive
    // controls on the exact same builder width in this animation frame. The
    // previous wide-desktop early return froze the bar until pointer-up.
    const actionInsets = actionAnchorInsetsRef.current ?? { left: 0, right: 0 };
    const anchorLeft = Math.max(0, Math.round(left + actionInsets.left));
    const anchorWidth = Math.max(0, Math.round(roundedBuilderWidth - actionInsets.left - actionInsets.right));
    const actionGutter = getStudioActionFloatingGutter(
      window.innerWidth,
      document.documentElement.dataset.soridrawBuilderMode,
    );
    const actionGeometry = resolveStudioActionFloatingGeometry(anchorLeft, anchorWidth, actionGutter);
    const actionGeometryKey = `${actionGeometry.left}:${actionGeometry.width}`;
    if (lastActionControlPixelRef.current === actionGeometryKey) return;
    lastActionControlPixelRef.current = actionGeometryKey;

    // 535 keeps resting geometry on the root, but 658 must not mutate inherited
    // root custom properties on every pointer frame inside the confirmed tablet
    // hot band. Publish directly on the floating portal there (same mechanism as
    // Lite V2); pointer-up still commits the final root values once.
    const rootStyle = document.documentElement.style;
    if (useTabletProdParityPath) {
      if (controls.floatingActionBar) {
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-left', `${actionGeometry.left}px`);
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-width', `${actionGeometry.width}px`);
      }
    } else {
      controls.floatingActionBar?.style.removeProperty('--soridraw-action-fixed-left');
      controls.floatingActionBar?.style.removeProperty('--soridraw-action-fixed-width');
      rootStyle.setProperty('--soridraw-action-fixed-left', `${actionGeometry.left}px`);
      rootStyle.setProperty('--soridraw-action-fixed-width', `${actionGeometry.width}px`);
    }

    if (controls.floatingActionBar) {
      controls.floatingActionBar.style.removeProperty('left');
      controls.floatingActionBar.style.removeProperty('width');
      controls.floatingActionBar.style.setProperty('--soridraw-studio-builder-width', `${anchorWidth}px`);
    }
    if (controls.collapsedActionButton) {
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-builder-width', `${roundedBuilderWidth}px`);
      controls.collapsedActionButton.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, Math.round(leftRailEdge))}px`);
    }
  }, [readExternalControls]);

  const commitRootMeasurements = useCallback((builderWidth: number, splitterLeft: number) => {
    const root = document.documentElement;
    const { left, leftRailEdge } = metricsRef.current;
    const roundedLeft = Math.max(0, Math.round(left));
    const roundedBuilderWidth = Math.max(0, Math.round(builderWidth));
    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));
    const roundedWorkspaceRight = Math.max(
      0,
      Math.round(window.innerWidth - (metricsRef.current.left + metricsRef.current.width)),
    );

    // Pointer frames use integer pixel coordinates. Commit those same rounded
    // coordinates after pointer-up so the divider and portal controls do not
    // shift by a visible subpixel/one-pixel step when inline drag styles clear.
    root.style.setProperty('--soridraw-studio-builder-left', `${roundedLeft}px`);
    root.style.setProperty(
      '--soridraw-studio-builder-right',
      `${Math.max(0, Math.round(window.innerWidth - (left + roundedBuilderWidth)))}px`,
    );
    root.style.setProperty('--soridraw-studio-builder-width', `${roundedBuilderWidth}px`);
    root.style.setProperty('--soridraw-studio-left-rail-edge', `${Math.max(0, Math.round(leftRailEdge))}px`);
    root.style.setProperty('--soridraw-studio-splitter-left', `${roundedSplitterLeft}px`);
    root.style.setProperty('--soridraw-studio-result-left', `${roundedSplitterLeft + 18}px`);
    root.style.setProperty('--soridraw-studio-result-right', `${roundedWorkspaceRight}px`);
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
    // 664: footer position is vertical geometry. A horizontal native resize must
    // not force footer.getBoundingClientRect() in parallel with the workspace
    // width layout on every frame. The existing resize-end refresh commits the
    // exact footer/splitter bottom once the gesture settles.
    if (
      draggingRef.current
      || document.documentElement.classList.contains('soridraw-window-resizing')
      || footerFrameRef.current !== null
    ) return;
    footerFrameRef.current = window.requestAnimationFrame(() => {
      footerFrameRef.current = null;
      refreshSplitterFooterBoundary();
    });
  }, [refreshSplitterFooterBoundary]);

  const refreshWorkspaceIsolation = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const root = document.documentElement;
    const shouldIsolate = isStudioBlack()
      && window.innerWidth >= WIDE_DESKTOP_ISOLATION_BREAKPOINT;

    // 461: the split mastheads are now real children of their own pane scrollers.
    // Clear every 460-era synthetic scroll flag/offset so divider movement can no
    // longer toggle a second visual state while pane widths are being recomputed.
    root.style.removeProperty('--soridraw-studio-scroll-masthead-space');
    delete root.dataset.soridrawBuilderMastheadScrolled;
    delete root.dataset.soridrawResultMastheadScrolled;

    if (!shouldIsolate) {
      delete layout.dataset.scrollIsolated;
      layout.style.removeProperty('--soridraw-studio-isolated-height');
      layout.style.removeProperty('height');
      lastIsolatedWorkspaceHeightRef.current = null;
      lastIsolationViewportHeightRef.current = null;
      return;
    }

    // A horizontal browser resize does not change the remaining vertical
    // viewport height. Re-reading layout + computed style here on every width
    // tick forces synchronous reflow across the whole Studio tree. Reuse the
    // verified height until the actual viewport height changes.
    if (
      layout.dataset.scrollIsolated === 'true'
      && lastIsolatedWorkspaceHeightRef.current !== null
      && lastIsolationViewportHeightRef.current === window.innerHeight
    ) {
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
    lastIsolationViewportHeightRef.current = window.innerHeight;
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
    hysteresis = PANE_MODE_HYSTERESIS,
  ): PaneMode => {
    const hasCommittedMode = pane.dataset.paneMode === 'mobile' || pane.dataset.paneMode === 'desktop';
    if (!hasCommittedMode) return width < breakpoint ? 'mobile' : 'desktop';
    if (currentMode === 'desktop') {
      return width < breakpoint - hysteresis ? 'mobile' : 'desktop';
    }
    return width > breakpoint + hysteresis ? 'desktop' : 'mobile';
  }, []);

  // 545 — Desktop/mobile mode changes reflow the builder from multi-column cards
  // to a single column. A normalized scroll percentage cannot preserve what the
  // user is actually looking at because every card changes height by a different
  // amount. Preserve exact top/bottom edges, but in the middle pin the currently
  // visible content itself to the same visual line in the pane. This runs only at
  // the breakpoint crossing, never on ordinary divider frames.
  const captureBuilderContentAnchor = useCallback((builder: HTMLElement) => {
    const builderRect = builder.getBoundingClientRect();
    const viewportOffset = Math.max(0, Math.min(builder.clientHeight, builder.clientHeight * 0.5));
    const focusY = builderRect.top + viewportOffset;
    const candidates = Array.from(
      builder.querySelectorAll<HTMLElement>(
        '[data-soridraw-scroll-anchor], [data-studio-menu], .soridraw-studio-menu-card',
      ),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.height > 1
        && rect.width > 1
        && rect.bottom > builderRect.top
        && rect.top < builderRect.bottom;
    });

    if (candidates.length === 0) return null;

    let bestElement: HTMLElement | null = null;
    let bestRect: DOMRect | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      const containsFocus = rect.top <= focusY && rect.bottom >= focusY;
      const distance = containsFocus
        ? 0
        : Math.min(Math.abs(focusY - rect.top), Math.abs(focusY - rect.bottom));
      // When nested candidates cover the same focus line, prefer the smaller,
      // more specific element (for example the lyrics cue row over the whole
      // lyrics card).
      const specificityPenalty = containsFocus ? Math.min(rect.height, 2000) / 10000 : 0;
      const score = distance + specificityPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestElement = element;
        bestRect = rect;
      }
    }

    if (!bestElement || !bestRect) return null;
    const elementRatio = bestRect.height > 1
      ? Math.max(0, Math.min(1, (focusY - bestRect.top) / bestRect.height))
      : 0;
    return { element: bestElement, elementRatio, viewportOffset };
  }, []);

  const restoreBuilderModeScrollAnchor = useCallback(() => {
    const builder = builderRef.current;
    const anchor = builderModeScrollAnchorRef.current;
    if (!builder || !anchor || builder.dataset.paneMode !== anchor.targetMode) return;

    const maxScrollTop = Math.max(0, builder.scrollHeight - builder.clientHeight);
    let targetScrollTop = builder.scrollTop;

    if (anchor.edge === 'top') {
      targetScrollTop = 0;
    } else if (anchor.edge === 'bottom') {
      targetScrollTop = maxScrollTop;
    } else if (anchor.edge === 'content' && anchor.element && builder.contains(anchor.element)) {
      const builderRect = builder.getBoundingClientRect();
      const elementRect = anchor.element.getBoundingClientRect();
      const elementRatio = Math.max(0, Math.min(1, anchor.elementRatio ?? 0));
      const viewportOffset = Math.max(0, Math.min(builder.clientHeight, anchor.viewportOffset ?? builder.clientHeight * 0.5));
      const anchoredPointY = elementRect.top + (elementRect.height * elementRatio);
      const desiredPointY = builderRect.top + viewportOffset;
      targetScrollTop = builder.scrollTop + (anchoredPointY - desiredPointY);
    } else {
      targetScrollTop = maxScrollTop * anchor.progress;
    }

    targetScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));
    if (Math.abs(builder.scrollTop - targetScrollTop) > 0.5) {
      builder.scrollTop = targetScrollTop;
    }
  }, []);

  const scheduleBuilderModeScrollAnchorRestore = useCallback(() => {
    if (builderModeAnchorFrameRef.current !== null) {
      window.cancelAnimationFrame(builderModeAnchorFrameRef.current);
    }
    builderModeAnchorFrameRef.current = window.requestAnimationFrame(() => {
      builderModeAnchorFrameRef.current = null;
      restoreBuilderModeScrollAnchor();
      if (!draggingRef.current) builderModeScrollAnchorRef.current = null;
    });
  }, [restoreBuilderModeScrollAnchor]);

  // 549 — Divider-width reflow must not move the builder viewport. Vocal/Lyrics,
  // Tempo and command controls legitimately rewrap as the pane width changes, but
  // letting those height changes alter scrollTop makes the whole lower stack look
  // like it is being pushed down/up. Capture one visual anchor when the divider
  // grab starts and restore that same point inside the existing rAF drag frame.
  // This adds no React renders/observers/listeners and costs only two rect reads
  // while the pointer is actively moving. Exact top/bottom remain exact edges.
  const captureBuilderDragScrollAnchor = useCallback(() => {
    const builder = builderRef.current;
    if (!builder) {
      builderDragScrollAnchorRef.current = null;
      return;
    }

    const maxScrollTop = Math.max(0, builder.scrollHeight - builder.clientHeight);
    const currentScrollTop = Math.max(0, Math.min(maxScrollTop, builder.scrollTop));
    const edgeTolerance = 2;
    if (currentScrollTop <= edgeTolerance) {
      builderDragScrollAnchorRef.current = { edge: 'top' };
      return;
    }
    if (maxScrollTop - currentScrollTop <= edgeTolerance) {
      builderDragScrollAnchorRef.current = { edge: 'bottom' };
      return;
    }

    const contentAnchor = captureBuilderContentAnchor(builder);
    builderDragScrollAnchorRef.current = contentAnchor
      ? {
          edge: 'content',
          element: contentAnchor.element,
          elementRatio: contentAnchor.elementRatio,
          viewportOffset: contentAnchor.viewportOffset,
        }
      : { edge: 'top' };
  }, [captureBuilderContentAnchor]);

  const restoreBuilderDragScrollAnchor = useCallback(() => {
    if (!draggingRef.current) return;
    const builder = builderRef.current;
    const anchor = builderDragScrollAnchorRef.current;
    if (!builder || !anchor) return;

    const maxScrollTop = Math.max(0, builder.scrollHeight - builder.clientHeight);
    let targetScrollTop = builder.scrollTop;

    if (anchor.edge === 'top') {
      targetScrollTop = 0;
    } else if (anchor.edge === 'bottom') {
      targetScrollTop = maxScrollTop;
    } else if (anchor.element && builder.contains(anchor.element)) {
      const builderRect = builder.getBoundingClientRect();
      const elementRect = anchor.element.getBoundingClientRect();
      const elementRatio = Math.max(0, Math.min(1, anchor.elementRatio ?? 0));
      const viewportOffset = Math.max(0, Math.min(builder.clientHeight, anchor.viewportOffset ?? builder.clientHeight * 0.5));
      const anchoredPointY = elementRect.top + (elementRect.height * elementRatio);
      const desiredPointY = builderRect.top + viewportOffset;
      targetScrollTop = builder.scrollTop + (anchoredPointY - desiredPointY);
    }

    targetScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));
    if (Math.abs(builder.scrollTop - targetScrollTop) > 0.5) {
      builder.scrollTop = targetScrollTop;
    }
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
        : Math.round(safeWidth * (nextPercent / 100));
    const resultWidth = Math.max(0, safeWidth - builderWidth);
    const splitterLeft = left + builderWidth;

    // 657: reuse the 656-proven pane-owned tablet band as a real drag fast path.
    // The split engine already knows both pane widths, so mark only a fine-pointer
    // pane whose live width is 661~1080px. CSS uses this marker only while an
    // active divider drag is in progress; resting tablet UI remains unchanged.
    const syncPaneTabletProbe = (pane: HTMLElement, paneWidth: number) => {
      const active = finePointerFastPathRef.current && paneWidth > 660 && paneWidth <= 1080;
      if (active) pane.dataset.soridrawPaneTabletFastpath = 'true';
      else delete pane.dataset.soridrawPaneTabletFastpath;
    };
    syncPaneTabletProbe(builder, builderWidth);
    syncPaneTabletProbe(result, resultWidth);

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

    const previousBuilderMode = modeRef.current.builder;
    const nextBuilderMode = builderCollapsedRef.current
      ? previousBuilderMode
      : resolvePaneMode(
          builder,
          builderWidth,
          BUILDER_MOBILE_BREAKPOINT,
          previousBuilderMode,
        );
    const usesUnifiedContentBreakpoint = workspaceView === 'library';
    const nextResultMode = resultCollapsedRef.current
      ? modeRef.current.result
      : resolvePaneMode(
          result,
          resultWidth,
          usesUnifiedContentBreakpoint ? CONTENT_RESULT_MOBILE_BREAKPOINT : RESULT_MOBILE_BREAKPOINT,
          modeRef.current.result,
          usesUnifiedContentBreakpoint ? 0 : PANE_MODE_HYSTERESIS,
        );
    // 741 — Compact no longer steals space from the desktop composition. It only
    // replaces the former upper-mobile band: desktop stays unchanged above 820px,
    // Compact owns the middle 661~820px range, and the final one-column mobile
    // composition is delayed to the narrow 660px floor. No extra measurement path.
    const builderCompactActive = !builderCollapsedRef.current
      && nextBuilderMode === 'desktop'
      && builderWidth <= BUILDER_COMPACT_MAX;
    if (builderCompactActive) {
      if (builder.dataset.soridrawPaneCompact !== 'true') {
        builder.dataset.soridrawPaneCompact = 'true';
      }
    } else if (builder.dataset.soridrawPaneCompact) {
      delete builder.dataset.soridrawPaneCompact;
    }

    const externalControls = readExternalControls();
    const builderModeChanged = !builderCollapsedRef.current
      && previousBuilderMode !== nextBuilderMode;

    if (builderModeChanged) {
      // 550 — During an active divider drag, the drag-start content anchor is the
      // sole scroll owner. Keeping a second desktop/mobile crossing anchor here
      // leaves a stale snapshot that gets replayed after pointer-up, which is why
      // releasing the divider in builder-mobile jumped the viewport upward.
      // Non-drag responsive changes still use the exact top/bottom/content rule.
      if (draggingRef.current) {
        builderModeScrollAnchorRef.current = null;
      } else {
        const maxScrollTop = Math.max(0, builder.scrollHeight - builder.clientHeight);
        const currentScrollTop = Math.max(0, Math.min(maxScrollTop, builder.scrollTop));
        const edgeTolerance = 2;
        const contentAnchor = currentScrollTop > edgeTolerance && maxScrollTop - currentScrollTop > edgeTolerance
          ? captureBuilderContentAnchor(builder)
          : null;
        builderModeScrollAnchorRef.current = {
          targetMode: nextBuilderMode,
          edge: currentScrollTop <= edgeTolerance
            ? 'top'
            : maxScrollTop - currentScrollTop <= edgeTolerance
              ? 'bottom'
              : contentAnchor
                ? 'content'
                : 'progress',
          progress: maxScrollTop > 0 ? currentScrollTop / maxScrollTop : 0,
          element: contentAnchor?.element,
          elementRatio: contentAnchor?.elementRatio,
          viewportOffset: contentAnchor?.viewportOffset,
        };
      }
    }

    if (!builderCollapsedRef.current && (previousBuilderMode !== nextBuilderMode || builder.dataset.paneMode !== nextBuilderMode)) {
      modeRef.current.builder = nextBuilderMode;
      builder.dataset.paneMode = nextBuilderMode;
      if (builderModeChanged && !draggingRef.current) {
        // Correct non-drag responsive changes in the same breakpoint frame, then
        // verify once on the next frame after CSS reflow settles. Active divider
        // drags are already owned by restoreBuilderDragScrollAnchor below.
        restoreBuilderModeScrollAnchor();
        scheduleBuilderModeScrollAnchorRestore();
      }
    }
    if (!resultCollapsedRef.current && (modeRef.current.result !== nextResultMode || result.dataset.paneMode !== nextResultMode)) {
      modeRef.current.result = nextResultMode;
      result.dataset.paneMode = nextResultMode;
    }

    // 521 — The floating Generate bar is portaled directly under <body>, so it
    // cannot inherit the builder pane's data-pane-mode. Mirror the already
    // resolved builder mode onto <html> in the same layout frame. This gives
    // the action bar the exact same desktop/mobile state as the builder while
    // the divider is being dragged, without adding a second width observer or
    // a viewport-based breakpoint.
    if (root.dataset.soridrawBuilderMode !== nextBuilderMode) {
      root.dataset.soridrawBuilderMode = nextBuilderMode;
    }
    if (root.dataset.soridrawResultMode !== nextResultMode) {
      root.dataset.soridrawResultMode = nextResultMode;
    }

    // The Library credit shortcut is portaled into the hero and sits outside the
    // result pane. Copy the resolved pane mode to the host so its compact/mobile
    // size changes at the same breakpoint as the content below it.
    const workspaceHeroHost = externalControls.workspaceHeroHost;
    if (workspaceHeroHost && workspaceHeroHost.dataset.paneMode !== nextResultMode) {
      workspaceHeroHost.dataset.paneMode = nextResultMode;
    }

    // Keep the same visible builder content pinned while width-driven wrapping
    // changes card heights. Do this after pane-mode attributes are committed so
    // desktop/mobile crossings and ordinary in-mode reflow share one behavior.
    restoreBuilderDragScrollAnchor();

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
  }, [captureBuilderContentAnchor, clearRootMeasurements, isStudioBlack, readExternalControls, resolvePaneMode, restoreBuilderDragScrollAnchor, restoreBuilderModeScrollAnchor, scheduleBuilderModeScrollAnchorRestore, syncExternalMeasurements, workspaceView]);

  const refreshLayoutMetrics = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout || !isStudioBlack()) {
      clearRootMeasurements();
      return;
    }

    refreshWorkspaceIsolation();
    const rect = layout.getBoundingClientRect();
    syncCenterModalHostBounds();
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
    scheduleFooterBoundaryRefresh();
  }, [applyPercentToLayout, clearExternalMeasurements, clearRootMeasurements, commitRootMeasurements, isStudioBlack, refreshWorkspaceIsolation, scheduleFooterBoundaryRefresh, syncCenterModalHostBounds]);

  const scheduleLayoutMetricsRefresh = useCallback(() => {
    if (layoutRefreshFrameRef.current !== null) return;
    layoutRefreshFrameRef.current = window.requestAnimationFrame(() => {
      layoutRefreshFrameRef.current = null;
      refreshLayoutMetrics();
    });
  }, [refreshLayoutMetrics]);

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
      // Browser resize and rail/layout changes can produce several observer
      // callbacks in the same frame. The Studio geometry owner commits at most
      // once per animation frame.
      if (!draggingRef.current) scheduleLayoutMetricsRefresh();
    });
    if (layoutRef.current) observer.observe(layoutRef.current);
    const footer = document.querySelector<HTMLElement>('.soridraw-app-footer');
    if (footer) observer.observe(footer);

    const themeObserver = new MutationObserver(scheduleLayoutMetricsRefresh);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-soridraw-theme'] });

    // 650 — restore the verified 488/637 resize ownership. Horizontal browser
    // resizing is already emitted by the workspace ResizeObserver and coalesced
    // to one rAF. Listening to the same width change again on window.resize made
    // the split tree run two geometry refresh paths per native resize tick, which
    // became especially expensive in the 1100~1599 compact/tablet composition.
    // Keep the native listener only for viewport-height changes; still retain the
    // resize marker so secondary transitions/container work stays suspended until
    // the native resize gesture settles.
    let lastViewportHeight = window.innerHeight;
    let resizeEndTimer: number | null = null;
    const handleViewportResize = () => {
      const root = document.documentElement;
      if (!root.classList.contains('soridraw-window-resizing')) {
        root.classList.add('soridraw-window-resizing');
        window.dispatchEvent(new CustomEvent('soridraw-window-resize-start'));
      }

      if (resizeEndTimer !== null) window.clearTimeout(resizeEndTimer);

      const nextViewportHeight = window.innerHeight;
      if (nextViewportHeight !== lastViewportHeight) {
        lastViewportHeight = nextViewportHeight;
        scheduleLayoutMetricsRefresh();
      }

      resizeEndTimer = window.setTimeout(() => {
        resizeEndTimer = null;
        root.classList.remove('soridraw-window-resizing');
        scheduleLayoutMetricsRefresh();
        syncResultTitleHeight();
        window.dispatchEvent(new CustomEvent('soridraw-window-resize-end'));
      }, 110);
    };

    // Rail collapse/expand is not a continuous resize gesture. Recalculate the
    // new grid width synchronously when StudioPageFrame signals it so the
    // builder pixel width cannot spend one paint at the previous rail geometry.
    const handleStudioFrameResize = () => {
      if (!draggingRef.current) refreshLayoutMetrics();
    };

    window.addEventListener('resize', handleViewportResize, { passive: true });
    window.addEventListener('soridraw-studio-frame-resize', handleStudioFrameResize as EventListener);
    window.addEventListener('scroll', scheduleFooterBoundaryRefresh, { passive: true });
    window.addEventListener('scroll', syncCenterModalHostBounds, { passive: true });
    scheduleFooterBoundaryRefresh();
    syncCenterModalHostBounds();

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      if (resizeEndTimer !== null) window.clearTimeout(resizeEndTimer);
      document.documentElement.classList.remove('soridraw-window-resizing');
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('soridraw-studio-frame-resize', handleStudioFrameResize as EventListener);
      window.removeEventListener('scroll', scheduleFooterBoundaryRefresh);
      window.removeEventListener('scroll', syncCenterModalHostBounds);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      if (footerFrameRef.current !== null) {
        window.cancelAnimationFrame(footerFrameRef.current);
        footerFrameRef.current = null;
      }
      if (layoutRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutRefreshFrameRef.current);
        layoutRefreshFrameRef.current = null;
      }
      if (builderModeAnchorFrameRef.current !== null) {
        window.cancelAnimationFrame(builderModeAnchorFrameRef.current);
        builderModeAnchorFrameRef.current = null;
      }
      builderModeScrollAnchorRef.current = null;
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
      lastIsolationViewportHeightRef.current = null;
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
  }, [clearExternalMeasurements, clearRootMeasurements, refreshLayoutMetrics, scheduleFooterBoundaryRefresh, scheduleLayoutMetricsRefresh, syncCenterModalHostBounds, syncResultTitleHeight]);

  // 660 — keep the pointer/divider lane independent from an expensive PROD
  // Studio tablet reflow. 659 already proved that the fixed splitter can follow
  // the pointer directly. The remaining DEV/PROD gap comes from immediately
  // committing every rAF to the large Studio pane tree even when one live pane
  // sits in the confirmed 661~1080px tablet band. Let that layout lane self-pace
  // from its *measured* commit cost while always retaining only the newest X.
  // Fast environments keep ~60fps commits; expensive production frames back off
  // just enough to give pointer delivery/paint breathing room. No hostname/build
  // branch is used, so DEV and PROD run the exact same code.
  const flushPendingPointer = useCallback((forceLayout = false) => {
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
    if (lastDragBuilderPixelRef.current === nextBuilderPixel && !forceLayout) return;

    const nextResultPixel = Math.max(0, safeWidth - nextBuilderPixel);
    const inConfirmedTabletHotBand = finePointerFastPathRef.current && (
      (nextBuilderPixel > 660 && nextBuilderPixel <= 1080)
      || (nextResultPixel > 660 && nextResultPixel <= 1080)
    );

    if (inConfirmedTabletHotBand && !forceLayout) {
      const now = performance.now();
      const elapsed = now - lastDragLayoutCommitAtRef.current;
      if (elapsed < dragLayoutIntervalRef.current) {
        // Do not replay old positions. Keep only the latest pointer X and try
        // again on the next animation frame; the splitter itself already moved
        // immediately in handlePointerMove.
        pendingClientXRef.current = clientX;
        if (dragFrameRef.current === null) {
          dragFrameRef.current = window.requestAnimationFrame(() => {
            flushPendingPointer(false);
          });
        }
        return;
      }
    }

    lastDragBuilderPixelRef.current = nextBuilderPixel;
    const commitStart = performance.now();
    applyPercentToLayout((nextBuilderPixel / safeWidth) * 100);
    const commitCost = Math.max(0, performance.now() - commitStart);
    lastDragLayoutCommitAtRef.current = performance.now();

    if (inConfirmedTabletHotBand) {
      // Adaptive cadence: cheap layouts stay at the native frame cadence.
      // Expensive PROD frames back off progressively instead of monopolising the
      // main thread and starving subsequent pointer events.
      dragLayoutIntervalRef.current = commitCost >= 18
        ? 36
        : commitCost >= 12
          ? 28
          : commitCost >= 8
            ? 20
            : 16;
    } else {
      dragLayoutIntervalRef.current = 16;
    }
  }, [applyPercentToLayout]);

  const schedulePointerUpdate = useCallback((clientX: number) => {
    pendingClientXRef.current = clientX;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      flushPendingPointer(false);
    });
  }, [flushPendingPointer]);

  // 659 — The fixed splitter must never wait for the Studio pane reflow path.
  // In the 661~1080px builder/result tablet band the inner Studio DOM can still
  // need more than one frame to settle even after the 657/658 paint isolation.
  // Drive the body-portal divider directly from the latest pointer coordinate
  // first, then let the existing rAF layout path consume the exact same X value.
  // This keeps pointer -> divider latency independent from pane responsive work.
  const previewSplitterAtClientX = useCallback((clientX: number) => {
    const splitter = splitterRef.current;
    if (!splitter || !draggingRef.current) return;

    const { startX, startPercent, width } = dragRef.current;
    const safeWidth = Math.max(width, 1);
    const bounds = getSplitBounds(safeWidth);
    const deltaPercent = ((clientX - startX) / safeWidth) * 100;
    const rawPercent = clampToBounds(startPercent + deltaPercent, bounds);
    const builderPixel = Math.round(safeWidth * (rawPercent / 100));
    const viewportLeft = metricsRef.current.left + builderPixel;

    splitter.style.removeProperty('transform');
    splitter.style.setProperty('left', `${Math.max(0, Math.round(viewportLeft) - 8)}px`, 'important');
  }, []);

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
    lastDragLayoutCommitAtRef.current = 0;
    dragLayoutIntervalRef.current = 16;
    builderModeScrollAnchorRef.current = null;
    captureBuilderDragScrollAnchor();
    if (builderModeAnchorFrameRef.current !== null) {
      window.cancelAnimationFrame(builderModeAnchorFrameRef.current);
      builderModeAnchorFrameRef.current = null;
    }

    // 520: Freeze the *relationship* between the in-flow action anchor and the
    // builder pane before the drag class is applied. App.tsx normally positions
    // the floating row from this anchor rect; the drag fast path must use the
    // same geometry or the bar visibly jumps as soon as the pointer starts.
    const controls = readExternalControls(true);
    const builderRect = builderRef.current?.getBoundingClientRect();
    const actionAnchorRect = controls.actionAnchor?.getBoundingClientRect();
    if (builderRect && actionAnchorRect && builderRect.width > 0 && actionAnchorRect.width > 0) {
      actionAnchorInsetsRef.current = {
        left: Math.max(0, actionAnchorRect.left - builderRect.left),
        right: Math.max(0, builderRect.right - actionAnchorRect.right),
      };
      // Seed the exact current resting coordinates before any pointer movement.
      // The first rAF frame therefore starts from pixel-identical geometry.
      const rootStyle = document.documentElement.style;
      const actionGutter = getStudioActionFloatingGutter(
        window.innerWidth,
        document.documentElement.dataset.soridrawBuilderMode,
      );
      const restingActionGeometry = resolveStudioActionFloatingGeometry(
        actionAnchorRect.left,
        actionAnchorRect.width,
        actionGutter,
      );
      const currentResultWidth = Math.max(0, metricsRef.current.width - builderRect.width);
      const seedTabletProdParityPath = finePointerFastPathRef.current && (
        (builderRect.width > 660 && builderRect.width <= 1080)
        || (currentResultWidth > 660 && currentResultWidth <= 1080)
      );
      if (seedTabletProdParityPath && controls.floatingActionBar) {
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-left', `${restingActionGeometry.left}px`);
        controls.floatingActionBar.style.setProperty('--soridraw-action-fixed-width', `${restingActionGeometry.width}px`);
      } else {
        rootStyle.setProperty('--soridraw-action-fixed-left', `${restingActionGeometry.left}px`);
        rootStyle.setProperty('--soridraw-action-fixed-width', `${restingActionGeometry.width}px`);
      }
      lastActionControlPixelRef.current = `${restingActionGeometry.left}:${restingActionGeometry.width}`;
    } else {
      actionAnchorInsetsRef.current = null;
      lastActionControlPixelRef.current = null;
    }

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
    previewSplitterAtClientX(latestEvent.clientX);
    schedulePointerUpdate(latestEvent.clientX);
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragRef.current.pointerId) return;

    pendingClientXRef.current = event.clientX;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    flushPendingPointer(true);

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    draggingRef.current = false;
    builderDragScrollAnchorRef.current = null;
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
    if (builderModeScrollAnchorRef.current?.targetMode === modeRef.current.builder) {
      scheduleBuilderModeScrollAnchorRestore();
    }
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

    if (viewMode === 'hidden') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
      return;
    }

    // WORKSPACE navigation keeps both panes mounted so every Sori Studio
    // selection/draft remains intact. "곡 만들기" opens the builder as the
    // single full-width workspace, while every lower WORKSPACE item starts
    // from a clean two-pane split even if either pane was previously folded.
    if (workspaceView === 'create') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(true);
      return;
    }

    if (workspaceView) {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
      return;
    }

    if (previousViewMode !== 'split') {
      setIsBuilderCollapsed(false);
      setIsResultCollapsed(false);
    }
  }, [viewMode, workspaceRequestId, workspaceView]);

  const renderedBounds = getSplitBounds(metricsRef.current.width);

  const centerModalHost = (
    <div id="soridraw-studio-center-modal-root" ref={modalHostRef} className="soridraw-studio-center-modal-host" />
  );

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
      <div
        ref={layoutRef}
        data-workspace-view-mode={viewMode}
        className={`soridraw-studio-split-workspace${isBuilderCollapsed ? ' is-builder-collapsed' : ''}${isResultCollapsed ? ' is-result-collapsed' : ''}`}
      >
        <div id="soridraw-studio-builder-pane" ref={builderRef} data-soridraw-studio-pane="builder" className="soridraw-studio-builder-pane" aria-hidden={isBuilderCollapsed}>
          <div id="soridraw-studio-builder-pane-masthead-host" className="soridraw-studio-pane-masthead-host soridraw-studio-builder-pane-masthead-host">
            {builderMasthead}
          </div>
          {panes[0] ?? null}
        </div>
        <div id="soridraw-studio-result-pane" ref={resultRef} data-soridraw-studio-pane="result" className="soridraw-studio-result-pane" aria-hidden={isResultCollapsed}>
          <div id="soridraw-studio-result-pane-masthead-host" className="soridraw-studio-pane-masthead-host soridraw-studio-result-pane-masthead-host" />
          {panes[1] ?? null}
        </div>
      </div>
      {viewMode !== 'hidden' && (typeof document !== 'undefined' ? createPortal(centerModalHost, document.body) : centerModalHost)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(splitterControl, document.body) : splitterControl)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(builderCollapseControl, document.body) : builderCollapseControl)}
      {viewMode === 'split' && (typeof document !== 'undefined' ? createPortal(resultCollapseControl, document.body) : resultCollapseControl)}
    </>
  );
}
