import React, { Children, type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'soridraw_studio_black_result_pane_percent';
const MIN_RESULT_PERCENT = 30;
const MAX_RESULT_PERCENT = 62;
const DEFAULT_RESULT_PERCENT = 38;

type StudioBlackSplitLayoutProps = {
  children: ReactNode;
};

type SplitStyle = CSSProperties & {
  '--soridraw-studio-result-percent': string;
};

const clampResultPercent = (value: number) =>
  Math.min(MAX_RESULT_PERCENT, Math.max(MIN_RESULT_PERCENT, value));

const readStoredResultPercent = () => {
  if (typeof window === 'undefined') return DEFAULT_RESULT_PERCENT;
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) ? clampResultPercent(saved) : DEFAULT_RESULT_PERCENT;
  } catch {
    return DEFAULT_RESULT_PERCENT;
  }
};

export default function StudioBlackSplitLayout({ children }: StudioBlackSplitLayoutProps) {
  const panes = Children.toArray(children);
  const [resultPercent, setResultPercent] = useState(readStoredResultPercent);
  const [isDragging, setIsDragging] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFloatingActionBounds = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (document.documentElement.dataset.soridrawTheme !== 'studio-black' || window.innerWidth < 1280) {
      document.documentElement.style.removeProperty('--soridraw-studio-builder-left');
      document.documentElement.style.removeProperty('--soridraw-studio-builder-right');
      return;
    }

    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const dividerWidth = 12;
    const builderLeft = rect.left + (rect.width * resultPercent) / 100 + dividerWidth;
    document.documentElement.style.setProperty('--soridraw-studio-builder-left', `${Math.round(builderLeft)}px`);
    document.documentElement.style.setProperty(
      '--soridraw-studio-builder-right',
      `${Math.max(0, Math.round(window.innerWidth - rect.right))}px`,
    );
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(resultPercent));
    } catch {
      // Keep the ratio for the current session when storage is unavailable.
    }

    const frameId = window.requestAnimationFrame(updateFloatingActionBounds);
    window.addEventListener('resize', updateFloatingActionBounds);

    const observer = new MutationObserver(updateFloatingActionBounds);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-soridraw-theme'],
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateFloatingActionBounds);
      observer.disconnect();
    };
  }, [resultPercent]);

  useEffect(() => {
    if (!isDragging) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  useEffect(() => () => {
    document.documentElement.style.removeProperty('--soridraw-studio-builder-left');
    document.documentElement.style.removeProperty('--soridraw-studio-builder-right');
  }, []);

  const updateFromPointer = (clientX: number) => {
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const nextPercent = ((clientX - rect.left) / rect.width) * 100;
    setResultPercent(clampResultPercent(nextPercent));
  };

  const splitStyle: SplitStyle = {
    '--soridraw-studio-result-percent': `${resultPercent}%`,
  };

  return (
    <div
      ref={layoutRef}
      className={`soridraw-studio-split-layout${isDragging ? ' is-dragging' : ''}`}
      style={splitStyle}
    >
      {panes[0] ?? null}

      <div
        className="soridraw-studio-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="생성 결과와 작업 영역 너비 조절"
        aria-valuemin={MIN_RESULT_PERCENT}
        aria-valuemax={MAX_RESULT_PERCENT}
        aria-valuenow={Math.round(resultPercent)}
        tabIndex={0}
        onPointerDown={(event) => {
          if (window.innerWidth < 1280) return;
          draggingRef.current = true;
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current || window.innerWidth < 1280) return;
          updateFromPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          setIsDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setIsDragging(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const delta = event.key === 'ArrowLeft' ? -2 : 2;
          setResultPercent((current) => clampResultPercent(current + delta));
        }}
      >
        <span />
      </div>

      {panes[1] ?? null}
    </div>
  );
}
