import React, { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';

const LEFT_RAIL_STORAGE_KEY = 'soridraw_studio_black_left_rail_collapsed_v1';

const readStoredLeftRailState = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LEFT_RAIL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

type StudioPageFrameProps = {
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
};

export default function StudioPageFrame({ leftRail, rightRail, children }: StudioPageFrameProps) {
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(readStoredLeftRailState);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('soridraw-studio-route-active');
    body.classList.add('soridraw-studio-route-active');

    return () => {
      root.classList.remove('soridraw-studio-route-active');
      body.classList.remove('soridraw-studio-route-active');
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LEFT_RAIL_STORAGE_KEY, String(isLeftRailCollapsed));
    } catch {
      // Local storage is optional. The current session still keeps the state.
    }

    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('soridraw-studio-frame-resize'));
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLeftRailCollapsed]);

  return (
    <div className={`soridraw-studio-page-frame${isLeftRailCollapsed ? ' is-left-rail-collapsed' : ''}`}>
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
    </div>
  );
}
