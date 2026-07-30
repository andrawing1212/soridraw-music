import React, {
  Children,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const STORAGE_KEY = 'soridraw_studio_black_builder_pane_percent_v4';
const MIN_BUILDER_PERCENT = 24;
const MAX_BUILDER_PERCENT = 76;
const DEFAULT_BUILDER_PERCENT = 56;
const DESKTOP_BREAKPOINT = 1280;

type PaneMode = 'mobile' | 'tablet' | 'desktop';

type StudioBlackSplitLayoutProps = {
  children: ReactNode;
};

type SplitStyle = CSSProperties & {
  '--soridraw-studio-builder-percent': string;
  '--soridraw-studio-splitter-left': string;
};

const clampBuilderPercent = (value: number) =>
  Math.min(MAX_BUILDER_PERCENT, Math.max(MIN_BUILDER_PERCENT, value));

const readStoredBuilderPercent = () => {
  if (typeof window === 'undefined') return DEFAULT_BUILDER_PERCENT;
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) ? clampBuilderPercent(saved) : DEFAULT_BUILDER_PERCENT;
  } catch {
    return DEFAULT_BUILDER_PERCENT;
  }
};

const getPaneMode = (width: number, kind: 'builder' | 'result'): PaneMode => {
  if (kind === 'builder') {
    if (width < 560) return 'mobile';
    if (width < 920) return 'tablet';
    return 'desktop';
  }

  // The generated-song pane intentionally has only two visual states.
  // Below 660px it must render the same compact/mobile composition used on phones.
  return width < 660 ? 'mobile' : 'desktop';
};

export default function StudioBlackSplitLayout({ children }: StudioBlackSplitLayoutProps) {
  const panes = Children.toArray(children);
  const [builderPercent, setBuilderPercent] = useState(readStoredBuilderPercent);
  const [isDragging, setIsDragging] = useState(false);
  const [splitterLeft, setSplitterLeft] = useState(0);
  const [builderMode, setBuilderMode] = useState<PaneMode>('tablet');
  const [resultMode, setResultMode] = useState<PaneMode>('tablet');

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderShellRef = useRef<HTMLDivElement | null>(null);
  const resultShellRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartPercentRef = useRef(DEFAULT_BUILDER_PERCENT);
  const dragLayoutWidthRef = useRef(1);

  const isStudioBlackDesktop = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    return (
      document.documentElement.dataset.soridrawTheme === 'studio-black' &&
      window.innerWidth >= DESKTOP_BREAKPOINT
    );
  }, []);

  const updatePaneModes = useCallback(() => {
    const layoutWidth = layoutRef.current?.getBoundingClientRect().width || 0;

    // Calculate from the actual grid ratio instead of child intrinsic widths.
    // Long result content must never trick the mode detector into thinking
    // the right pane is wider than the visible grid track.
    if (layoutWidth > 0) {
      const gutter = 18;
      const builderWidth = Math.max(0, (layoutWidth * builderPercent) / 100 - gutter);
      const resultWidth = Math.max(0, (layoutWidth * (100 - builderPercent)) / 100 - gutter);
      setBuilderMode(getPaneMode(builderWidth, 'builder'));
      setResultMode(getPaneMode(resultWidth, 'result'));
      return;
    }

    const builderWidth = builderShellRef.current?.clientWidth || 0;
    const resultWidth = resultShellRef.current?.clientWidth || 0;
    if (builderWidth > 0) setBuilderMode(getPaneMode(builderWidth, 'builder'));
    if (resultWidth > 0) setResultMode(getPaneMode(resultWidth, 'result'));
  }, [builderPercent]);

  const updateLayoutMeasurements = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!isStudioBlackDesktop()) {
      setSplitterLeft(0);
      document.documentElement.style.removeProperty('--soridraw-studio-builder-left');
      document.documentElement.style.removeProperty('--soridraw-studio-builder-right');
      return;
    }

    const layoutRect = layoutRef.current?.getBoundingClientRect();
    if (layoutRect && layoutRect.width > 0) {
      const boundary = layoutRect.left + (layoutRect.width * builderPercent) / 100;
      setSplitterLeft(Math.round(boundary));
    }

    const builderRect = builderShellRef.current?.getBoundingClientRect();
    if (builderRect && builderRect.width > 0) {
      document.documentElement.style.setProperty(
        '--soridraw-studio-builder-left',
        `${Math.max(0, Math.round(builderRect.left))}px`,
      );
      document.documentElement.style.setProperty(
        '--soridraw-studio-builder-right',
        `${Math.max(0, Math.round(window.innerWidth - builderRect.right))}px`,
      );
    }

    updatePaneModes();
  }, [builderPercent, isStudioBlackDesktop, updatePaneModes]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(updateLayoutMeasurements);
    return () => window.cancelAnimationFrame(frameId);
  }, [updateLayoutMeasurements]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(builderPercent));
    } catch {
      // Keep the ratio in memory when storage is unavailable.
    }
  }, [builderPercent]);

  useEffect(() => {
    const handleResize = () => updateLayoutMeasurements();
    window.addEventListener('resize', handleResize);

    const themeObserver = new MutationObserver(updateLayoutMeasurements);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-soridraw-theme'],
    });

    const resizeObserver = new ResizeObserver(updateLayoutMeasurements);
    if (layoutRef.current) resizeObserver.observe(layoutRef.current);
    if (builderShellRef.current) resizeObserver.observe(builderShellRef.current);
    if (resultShellRef.current) resizeObserver.observe(resultShellRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [updateLayoutMeasurements]);

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

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--soridraw-studio-builder-left');
      document.documentElement.style.removeProperty('--soridraw-studio-builder-right');
    },
    [],
  );

  const finishDrag = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (event && pointerIdRef.current !== event.pointerId) return;

    const splitter = splitterRef.current;
    const pointerId = pointerIdRef.current;
    if (splitter && pointerId !== null && splitter.hasPointerCapture(pointerId)) {
      splitter.releasePointerCapture(pointerId);
    }

    draggingRef.current = false;
    pointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const splitStyle: SplitStyle = {
    '--soridraw-studio-builder-percent': `${builderPercent}%`,
    '--soridraw-studio-splitter-left': `${splitterLeft}px`,
  };

  return (
    <div
      ref={layoutRef}
      className={`soridraw-studio-split-layout${isDragging ? ' is-dragging' : ''}`}
      data-builder-mode={builderMode}
      data-result-mode={resultMode}
      data-result-layout={resultMode === 'desktop' ? 'desktop' : 'mobile'}
      style={splitStyle}
    >
      <div
        ref={builderShellRef}
        className="soridraw-studio-pane-shell soridraw-studio-builder-shell"
        data-pane-mode={builderMode}
      >
        {panes[0] ?? null}
      </div>

      <div
        ref={splitterRef}
        className="soridraw-studio-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="곡 만들기와 생성 결과 영역 너비 조절"
        aria-valuemin={MIN_BUILDER_PERCENT}
        aria-valuemax={MAX_BUILDER_PERCENT}
        aria-valuenow={Math.round(builderPercent)}
        tabIndex={0}
        onPointerDown={(event) => {
          if (!isStudioBlackDesktop()) return;
          const rect = layoutRef.current?.getBoundingClientRect();
          if (!rect || rect.width <= 0) return;

          draggingRef.current = true;
          pointerIdRef.current = event.pointerId;
          dragStartXRef.current = event.clientX;
          dragStartPercentRef.current = builderPercent;
          dragLayoutWidthRef.current = rect.width;
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsDragging(true);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current || pointerIdRef.current !== event.pointerId) return;
          const deltaPercent = ((event.clientX - dragStartXRef.current) / dragLayoutWidthRef.current) * 100;
          setBuilderPercent(clampBuilderPercent(dragStartPercentRef.current + deltaPercent));
          event.preventDefault();
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={() => {
          draggingRef.current = false;
          pointerIdRef.current = null;
          setIsDragging(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const delta = event.key === 'ArrowLeft' ? -2 : 2;
          setBuilderPercent((current) => clampBuilderPercent(current + delta));
        }}
      >
        <span />
      </div>

      <div
        ref={resultShellRef}
        className="soridraw-studio-pane-shell soridraw-studio-result-shell"
        data-pane-mode={resultMode}
      >
        {panes[1] ?? null}
      </div>
    </div>
  );
}
