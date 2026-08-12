import React, { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { useMediaQuery } from '../../lib/mediaQueryStore';

const LEFT_RAIL_STORAGE_KEY = 'soridraw_studio_black_left_rail_collapsed_v1';
const RIGHT_RAIL_STORAGE_KEY = 'soridraw_studio_black_right_rail_collapsed_v1';

type RailViewport = 'mobile' | 'compact' | 'wide';

const getRailViewport = (): RailViewport => {
  if (typeof window === 'undefined') return 'wide';
  if (window.innerWidth < 1100) return 'mobile';
  if (window.innerWidth < 1600) return 'compact';
  return 'wide';
};

const readStoredRailState = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
};

const readInitialLeftRailState = () => (
  getRailViewport() === 'compact'
    ? true
    : readStoredRailState(LEFT_RAIL_STORAGE_KEY, false)
);

const readInitialRightRailState = () => (
  getRailViewport() === 'compact'
    ? true
    : readStoredRailState(RIGHT_RAIL_STORAGE_KEY, false)
);

type StudioPageFrameProps = {
  workspaceView?: string;
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
  lockViewport?: boolean;
  compactMobileLayout?: boolean;
};

export default function StudioPageFrame({ workspaceView = 'create', leftRail, rightRail, children, lockViewport = true, compactMobileLayout = false }: StudioPageFrameProps) {
  const isMobileViewport = useMediaQuery('(max-width: 1099px)');
  const isWideViewport = useMediaQuery('(min-width: 1600px)', true);
  const railViewport: RailViewport = isMobileViewport ? 'mobile' : isWideViewport ? 'wide' : 'compact';
  // 646: compact mobile composition is a split-theme presentation choice, not
  // a generic viewport rule. Dark/light phone layouts keep their existing frame
  // behavior; only Studio Black explicitly opts into the single-page mobile shell.
  const isCompactWorkspace = compactMobileLayout && railViewport === 'mobile';
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(readInitialLeftRailState);
  const [isRightRailCollapsed, setIsRightRailCollapsed] = useState(readInitialRightRailState);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (lockViewport) {
      root.classList.add('soridraw-studio-route-active');
      body.classList.add('soridraw-studio-route-active');
    }

    return () => {
      if (lockViewport) {
        root.classList.remove('soridraw-studio-route-active');
        body.classList.remove('soridraw-studio-route-active');
      }
      delete root.dataset.soridrawStudioWorkspaceView;
    };
  }, [lockViewport]);

  useLayoutEffect(() => {
    document.documentElement.dataset.soridrawStudioWorkspaceView = workspaceView;
  }, [workspaceView]);

  useLayoutEffect(() => {
    if (railViewport === 'compact') {
      // The rail geometry is part of the center workspace width. Commit the
      // compact rail state before paint so the builder never renders one frame
      // with the old 214px rail width and the new 64px center origin.
      setIsLeftRailCollapsed(true);
      setIsRightRailCollapsed(true);
      return;
    }

    if (railViewport === 'wide') {
      // Compact-session choices do not overwrite the user's PC preference.
      // Restore the wide-PC rail contract before paint for the same reason.
      setIsLeftRailCollapsed(readStoredRailState(LEFT_RAIL_STORAGE_KEY, false));
      setIsRightRailCollapsed(readStoredRailState(RIGHT_RAIL_STORAGE_KEY, false));
    }
  }, [railViewport]);

  useEffect(() => {
    // 653 diagnostic probe — fine-pointer PC only. The user consistently sees
    // native window resizing become heavy only in the 1100~1599 tablet band.
    // Previous geometry/containment guesses did not change the symptom, so this
    // one build deliberately removes the expensive center-page subtrees while
    // the browser window is actively being resized in that band. Pane shells and
    // the divider remain alive. If resize becomes smooth, the bottleneck is in
    // tablet content reflow/paint; if it remains slow, the culprit is outside the
    // page subtrees (frame/rail/navigation/geometry). This is intentionally a
    // one-build probe, not the final product behavior.
    const root = document.documentElement;
    let settleTimer: number | null = null;

    const finishProbe = () => {
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
      root.classList.remove('soridraw-tablet-resize-probe');
    };

    const handleNativeResize = () => {
      const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const inTabletBand = window.innerWidth >= 1100 && window.innerWidth < 1600;
      if (!finePointer || !inTabletBand) {
        finishProbe();
        return;
      }

      root.classList.add('soridraw-tablet-resize-probe');
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finishProbe, 120);
    };

    window.addEventListener('resize', handleNativeResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleNativeResize);
      finishProbe();
    };
  }, []);

  useEffect(() => {
    if (railViewport !== 'wide') return;
    try {
      window.localStorage.setItem(LEFT_RAIL_STORAGE_KEY, String(isLeftRailCollapsed));
      window.localStorage.setItem(RIGHT_RAIL_STORAGE_KEY, String(isRightRailCollapsed));
    } catch {
      // Local storage is optional. The current session still keeps the state.
    }
  }, [isLeftRailCollapsed, isRightRailCollapsed, railViewport]);

  useLayoutEffect(() => {
    // The grid columns have already changed in this commit. Notify the split
    // geometry owner synchronously, before paint, so its pixel builder width,
    // masthead and search coordinates are recalculated against the new center
    // width in the same frame. A deferred rAF here caused the visible
    // left/right overshoot when a rail was collapsed or expanded.
    window.dispatchEvent(new CustomEvent('soridraw-studio-frame-resize'));
  }, [isLeftRailCollapsed, isRightRailCollapsed]);

  return (
    <div
      className={`soridraw-studio-page-frame${isLeftRailCollapsed ? ' is-left-rail-collapsed' : ''}${isRightRailCollapsed ? ' is-right-rail-collapsed' : ''}`}
      data-rail-viewport={railViewport}
      data-workspace-view={workspaceView}
      data-compact-workspace={isCompactWorkspace ? 'true' : 'false'}
    >
      <div className="soridraw-studio-masthead-divider" aria-hidden="true" />
      {!isCompactWorkspace && leftRail}
      {!isCompactWorkspace && (
        <button
          type="button"
          className="soridraw-studio-left-rail-collapse-toggle"
          onClick={() => setIsLeftRailCollapsed((current) => !current)}
          aria-label={isLeftRailCollapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'}
          title={isLeftRailCollapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'}
          aria-expanded={!isLeftRailCollapsed}
        >
          <span className="soridraw-studio-panel-toggle-icon" aria-hidden="true" />
        </button>
      )}

      <div className="soridraw-studio-page-center">{children}</div>

      {!isCompactWorkspace && rightRail}
      {!isCompactWorkspace && (
        <button
          type="button"
          className="soridraw-studio-right-rail-collapse-toggle"
          onClick={() => setIsRightRailCollapsed((current) => !current)}
          aria-label={isRightRailCollapsed ? '오른쪽 메뉴 펼치기' : '오른쪽 메뉴 접기'}
          title={isRightRailCollapsed ? '오른쪽 메뉴 펼치기' : '오른쪽 메뉴 접기'}
          aria-expanded={!isRightRailCollapsed}
        >
          <span className="soridraw-studio-panel-toggle-icon is-right" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
