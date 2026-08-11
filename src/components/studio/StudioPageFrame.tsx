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
};

export default function StudioPageFrame({ workspaceView = 'create', leftRail, rightRail, children, lockViewport = true }: StudioPageFrameProps) {
  const isMobileViewport = useMediaQuery('(max-width: 1099px)');
  const isWideViewport = useMediaQuery('(min-width: 1600px)', true);
  const railViewport: RailViewport = isMobileViewport ? 'mobile' : isWideViewport ? 'wide' : 'compact';
  const isCompactWorkspace = railViewport === 'mobile';
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
