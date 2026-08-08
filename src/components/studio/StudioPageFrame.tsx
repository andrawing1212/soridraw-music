import React, { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { useMediaQuery } from '../../lib/mediaQueryStore';

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
  // 505: PC keeps the user's manual expanded/collapsed choices. Tablet only
  // forces the SAME collapsed state used by PC; it does not add a tablet-only
  // class or visual variant. Returning to PC restores the prior PC choices.
  const isTabletShell = useMediaQuery('(min-width: 1100px) and (max-width: 1599px)');
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(() => readStoredRailState(LEFT_RAIL_STORAGE_KEY, false));
  const [isRightRailCollapsed, setIsRightRailCollapsed] = useState(() => readStoredRailState(RIGHT_RAIL_STORAGE_KEY, false));
  const effectiveLeftRailCollapsed = isTabletShell || isLeftRailCollapsed;
  const effectiveRightRailCollapsed = isTabletShell || isRightRailCollapsed;

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
  }, [effectiveLeftRailCollapsed, effectiveRightRailCollapsed]);

  return (
    <div
      className={`soridraw-studio-page-frame${effectiveLeftRailCollapsed ? ' is-left-rail-collapsed' : ''}${effectiveRightRailCollapsed ? ' is-right-rail-collapsed' : ''}`}
      data-workspace-view={workspaceView}
    >
      <div className="soridraw-studio-masthead-divider" aria-hidden="true" />
      {leftRail}
      <button
        type="button"
        className="soridraw-studio-left-rail-collapse-toggle"
        onClick={() => { if (!isTabletShell) setIsLeftRailCollapsed((current) => !current); }}
        aria-label={effectiveLeftRailCollapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'}
        title={isTabletShell ? '태블릿에서는 왼쪽 메뉴가 접힌 상태로 고정됩니다' : (effectiveLeftRailCollapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기')}
        aria-expanded={!effectiveLeftRailCollapsed}
        aria-disabled={isTabletShell}
      >
        <span className="soridraw-studio-panel-toggle-icon" aria-hidden="true" />
      </button>

      <div className="soridraw-studio-page-center">{children}</div>

      {rightRail}
      <button
        type="button"
        className="soridraw-studio-right-rail-collapse-toggle"
        onClick={() => { if (!isTabletShell) setIsRightRailCollapsed((current) => !current); }}
        aria-label={effectiveRightRailCollapsed ? '오른쪽 메뉴 펼치기' : '오른쪽 메뉴 접기'}
        title={isTabletShell ? '태블릿에서는 오른쪽 메뉴가 접힌 상태로 고정됩니다' : (effectiveRightRailCollapsed ? '오른쪽 메뉴 펼치기' : '오른쪽 메뉴 접기')}
        aria-expanded={!effectiveRightRailCollapsed}
        aria-disabled={isTabletShell}
      >
        <span className="soridraw-studio-panel-toggle-icon is-right" aria-hidden="true" />
      </button>
    </div>
  );
}
