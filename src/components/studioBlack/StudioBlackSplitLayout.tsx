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

const STORAGE_KEY = 'soridraw_studio_black_builder_pane_percent_v5';
const MIN_BUILDER_PERCENT = 22;
const MAX_BUILDER_PERCENT = 78;
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
    if (width < 620) return 'mobile';
    if (width < 880) return 'tablet';
    return 'desktop';
  }

  // The result pane deliberately swaps between the real phone composition
  // and the desktop composition according to the pane itself, not viewport width.
  return width < 760 ? 'mobile' : 'desktop';
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
    // ResizeObserver reports the real visible grid-track widths. Using these
    // values prevents long prompt/lyrics content from pretending the pane is
    // wider and sliding underneath the fixed right dashboard.
    const builderWidth = builderShellRef.current?.getBoundingClientRect().width || 0;
    const resultWidth = resultShellRef.current?.getBoundingClientRect().width || 0;

    if (builderWidth > 0) setBuilderMode(getPaneMode(builderWidth, 'builder'));
    if (resultWidth > 0) setResultMode(getPaneMode(resultWidth, 'result'));

    if (builderWidth > 0 || resultWidth > 0) return;

    const layoutWidth = layoutRef.current?.getBoundingClientRect().width || 0;
    if (layoutWidth <= 0) return;
    const paneGap = 36;
    const usableWidth = Math.max(0, layoutWidth - paneGap);
    setBuilderMode(getPaneMode((usableWidth * builderPercent) / 100, 'builder'));
    setResultMode(getPaneMode((usableWidth * (100 - builderPercent)) / 100, 'result'));
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
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const applyPaneModeAttributes = () => {
      if (root.dataset.soridrawTheme === 'studio-black') {
        root.dataset.soridrawBuilderMode = builderMode;
        root.dataset.soridrawResultMode = resultMode;
      } else {
        delete root.dataset.soridrawBuilderMode;
        delete root.dataset.soridrawResultMode;
      }
    };

    applyPaneModeAttributes();
    window.addEventListener('soridraw-theme-change', applyPaneModeAttributes);
    return () => {
      window.removeEventListener('soridraw-theme-change', applyPaneModeAttributes);
      delete root.dataset.soridrawBuilderMode;
      delete root.dataset.soridrawResultMode;
    };
  }, [builderMode, resultMode]);

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

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const paintedButtons = new Set<HTMLButtonElement>();
    const paintSelection = () => {
      const studioBlackActive = document.documentElement.dataset.soridrawTheme === 'studio-black';
      const selectedButtons = studioBlackActive
        ? Array.from(document.querySelectorAll<HTMLButtonElement>(
            '.soridraw-studio-builder-pane button[data-soridraw-selected="true"], ' +
            '.soridraw-studio-builder-pane button.soridraw-selected-strong, ' +
            '.soridraw-studio-genre-modal-panel button[data-soridraw-selected="true"], ' +
            '.soridraw-studio-cycle-modal-panel button[data-soridraw-selected="true"]',
          ))
        : [];

      const next = new Set(selectedButtons);
      paintedButtons.forEach((button) => {
        if (next.has(button)) return;
        ['background', 'background-color', 'background-image', 'color', '-webkit-text-fill-color', 'border-color', 'box-shadow', 'opacity', 'filter'].forEach((name) =>
          button.style.removeProperty(name),
        );
        button.querySelectorAll<HTMLElement>('span,strong,small,p,div,label,svg').forEach((node) => {
          node.style.removeProperty('color');
          node.style.removeProperty('-webkit-text-fill-color');
          node.style.removeProperty('opacity');
          node.style.removeProperty('text-shadow');
        });
        paintedButtons.delete(button);
      });

      selectedButtons.forEach((button) => {
        button.style.setProperty('background', '#ffb400', 'important');
        button.style.setProperty('background-color', '#ffb400', 'important');
        button.style.setProperty('background-image', 'none', 'important');
        button.style.setProperty('color', '#0b0b0b', 'important');
        button.style.setProperty('-webkit-text-fill-color', '#0b0b0b', 'important');
        button.style.setProperty('border-color', 'transparent', 'important');
        button.style.setProperty('box-shadow', 'none', 'important');
        button.style.setProperty('opacity', '1', 'important');
        button.style.setProperty('filter', 'none', 'important');
        button.querySelectorAll<HTMLElement>('span,strong,small,p,div,label,svg').forEach((node) => {
          node.style.setProperty('color', '#0b0b0b', 'important');
          node.style.setProperty('-webkit-text-fill-color', '#0b0b0b', 'important');
          node.style.setProperty('opacity', '1', 'important');
          node.style.setProperty('text-shadow', 'none', 'important');
        });
        paintedButtons.add(button);
      });
    };

    const frame = window.requestAnimationFrame(paintSelection);
    const observer = new MutationObserver(() => window.requestAnimationFrame(paintSelection));
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-soridraw-selected'],
    });
    window.addEventListener('soridraw-theme-change', paintSelection);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('soridraw-theme-change', paintSelection);
      paintedButtons.forEach((button) => {
        ['background', 'background-color', 'background-image', 'color', '-webkit-text-fill-color', 'border-color', 'box-shadow', 'opacity', 'filter'].forEach((name) =>
          button.style.removeProperty(name),
        );
      });
      paintedButtons.clear();
    };
  }, []);

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
