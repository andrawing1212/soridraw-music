import React, { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';

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
};

export default function StudioPageFrame({ workspaceView = 'create', leftRail, rightRail, children }: StudioPageFrameProps) {
  const [railViewport, setRailViewport] = useState<RailViewport>(getRailViewport);
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(readInitialLeftRailState);
  const [isRightRailCollapsed, setIsRightRailCollapsed] = useState(readInitialRightRailState);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('soridraw-studio-route-active');
    body.classList.add('soridraw-studio-route-active');

    return () => {
      root.classList.remove('soridraw-studio-route-active');
      body.classList.remove('soridraw-studio-route-active');
      delete root.dataset.soridrawStudioWorkspaceView;
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.soridrawStudioWorkspaceView = workspaceView;
  }, [workspaceView]);

  useEffect(() => {
    let currentViewport = getRailViewport();

    const syncViewport = () => {
      const nextViewport = getRailViewport();
      if (nextViewport === currentViewport) return;
      currentViewport = nextViewport;
      setRailViewport(nextViewport);

      if (nextViewport === 'compact') {
        // Tablet/compact landscape always enters with both auxiliary rails in
        // their space-saving state. They remain independently expandable.
        setIsLeftRailCollapsed(true);
        setIsRightRailCollapsed(true);
        return;
      }

      if (nextViewport === 'wide') {
        // Compact-session choices do not overwrite the user's PC preference.
        setIsLeftRailCollapsed(readStoredRailState(LEFT_RAIL_STORAGE_KEY, false));
        setIsRightRailCollapsed(readStoredRailState(RIGHT_RAIL_STORAGE_KEY, false));
      }
    };

    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('soridraw-studio-frame-resize'));
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLeftRailCollapsed, isRightRailCollapsed]);

  return (
    <div
      className={`soridraw-studio-page-frame${isLeftRailCollapsed ? ' is-left-rail-collapsed' : ''}${isRightRailCollapsed ? ' is-right-rail-collapsed' : ''}`}
      data-rail-viewport={railViewport}
      data-workspace-view={workspaceView}
    >
      {leftRail}
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

      <div className="soridraw-studio-page-center">{children}</div>

      {rightRail}
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
    </div>
  );
}
