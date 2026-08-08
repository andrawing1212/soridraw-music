import React, { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';

const LEFT_RAIL_STORAGE_KEY = 'soridraw_studio_black_left_rail_collapsed_v1';
const RIGHT_RAIL_STORAGE_KEY = 'soridraw_studio_black_right_rail_collapsed_v1';

const readStoredRailState = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
};

type StudioPageFrameProps = {
  workspaceView?: string;
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
};

export default function StudioPageFrame({ workspaceView = 'create', leftRail, rightRail, children }: StudioPageFrameProps) {
  // 503: Auxiliary rails have exactly one state owner: the user's toggle.
  // Browser width no longer swaps a second tablet/PC rail design underneath it.
  // Mobile still hides the rails purely in CSS below 1100px and restores the
  // user's previous expanded/collapsed choices when the desktop shell returns.
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(() => readStoredRailState(LEFT_RAIL_STORAGE_KEY, false));
  const [isRightRailCollapsed, setIsRightRailCollapsed] = useState(() => readStoredRailState(RIGHT_RAIL_STORAGE_KEY, false));

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
    try {
      window.localStorage.setItem(LEFT_RAIL_STORAGE_KEY, String(isLeftRailCollapsed));
      window.localStorage.setItem(RIGHT_RAIL_STORAGE_KEY, String(isRightRailCollapsed));
    } catch {
      // Local storage is optional. The current session still keeps the state.
    }
  }, [isLeftRailCollapsed, isRightRailCollapsed]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      // Studio owns a dedicated layout signal. Do not synthesize a second
      // native `resize` event here; doing so used to wake every global resize
      // listener again whenever either rail changed.
      window.dispatchEvent(new CustomEvent('soridraw-studio-frame-resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLeftRailCollapsed, isRightRailCollapsed]);

  return (
    <div
      className={`soridraw-studio-page-frame${isLeftRailCollapsed ? ' is-left-rail-collapsed' : ''}${isRightRailCollapsed ? ' is-right-rail-collapsed' : ''}`}
      data-workspace-view={workspaceView}
    >
      <div className="soridraw-studio-masthead-divider" aria-hidden="true" />
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
