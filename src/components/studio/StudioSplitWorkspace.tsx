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

const STORAGE_KEY = 'soridraw_studio_black_split_percent_v1';
const DEFAULT_PERCENT = 50;
const MIN_PERCENT = 24;
const MAX_PERCENT = 76;

type PaneMode = 'mobile' | 'desktop';

type SplitStyle = CSSProperties & {
  '--soridraw-studio-builder-percent': string;
};

const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

const readStored = () => {
  if (typeof window === 'undefined') return DEFAULT_PERCENT;
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
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

export default function StudioSplitWorkspace({ children }: { children: ReactNode }) {
  const panes = Children.toArray(children);
  const [percent, setPercent] = useState(readStored);
  const [dragging, setDragging] = useState(false);
  const [builderMode, setBuilderMode] = useState<PaneMode>('desktop');
  const [resultMode, setResultMode] = useState<PaneMode>('desktop');
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, startPercent: DEFAULT_PERCENT, width: 1 });

  const isStudioBlack = useCallback(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.soridrawTheme === 'studio-black', []);

  const updateMeasurements = useCallback(() => {
    const builderRect = builderRef.current?.getBoundingClientRect();
    const resultRect = resultRef.current?.getBoundingClientRect();
    const root = document.documentElement;

    if (!isStudioBlack() || !builderRect || !resultRect) {
      delete root.dataset.soridrawBuilderMode;
      delete root.dataset.soridrawResultMode;
      root.style.removeProperty('--soridraw-studio-builder-left');
      root.style.removeProperty('--soridraw-studio-builder-right');
      root.style.removeProperty('--soridraw-studio-builder-width');
      return;
    }

    const nextBuilderMode: PaneMode = builderRect.width < 900 ? 'mobile' : 'desktop';
    const nextResultMode: PaneMode = resultRect.width < 720 ? 'mobile' : 'desktop';
    setBuilderMode(nextBuilderMode);
    setResultMode(nextResultMode);
    root.dataset.soridrawBuilderMode = nextBuilderMode;
    root.dataset.soridrawResultMode = nextResultMode;
    root.style.setProperty('--soridraw-studio-builder-left', `${Math.max(0, builderRect.left)}px`);
    root.style.setProperty('--soridraw-studio-builder-right', `${Math.max(0, window.innerWidth - builderRect.right)}px`);
    root.style.setProperty('--soridraw-studio-builder-width', `${Math.max(0, builderRect.width)}px`);
  }, [isStudioBlack]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updateMeasurements);
    return () => window.cancelAnimationFrame(frame);
  }, [percent, updateMeasurements]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(percent)); } catch { /* ignore */ }
  }, [percent]);

  useEffect(() => {
    const observer = new ResizeObserver(updateMeasurements);
    if (layoutRef.current) observer.observe(layoutRef.current);
    if (builderRef.current) observer.observe(builderRef.current);
    if (resultRef.current) observer.observe(resultRef.current);
    const themeObserver = new MutationObserver(updateMeasurements);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-soridraw-theme'] });
    window.addEventListener('resize', updateMeasurements);
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', updateMeasurements);
      delete document.documentElement.dataset.soridrawBuilderMode;
      delete document.documentElement.dataset.soridrawResultMode;
      document.documentElement.style.removeProperty('--soridraw-studio-builder-left');
      document.documentElement.style.removeProperty('--soridraw-studio-builder-right');
      document.documentElement.style.removeProperty('--soridraw-studio-builder-width');
    };
  }, [updateMeasurements]);

  const updateFromPointer = (clientX: number) => {
    const { startX, startPercent, width } = dragRef.current;
    const deltaPercent = ((clientX - startX) / Math.max(width, 1)) * 100;
    setPercent(clamp(startPercent + deltaPercent));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isStudioBlack()) return;
    const rect = layoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startPercent: percent, width: rect.width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || event.pointerId !== dragRef.current.pointerId) return;
    updateFromPointer(event.clientX);
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== dragRef.current.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    setDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setPercent((current) => clamp(current + (event.key === 'ArrowRight' ? 2 : -2)));
  };

  const style: SplitStyle = { '--soridraw-studio-builder-percent': `${percent}%` };

  return (
    <div ref={layoutRef} className={`soridraw-studio-split-workspace ${dragging ? 'is-dragging' : ''}`} style={style}>
      <div ref={builderRef} className="soridraw-studio-builder-pane" data-pane-mode={builderMode}>{panes[0] ?? null}</div>
      <button
        type="button"
        className="soridraw-studio-splitter"
        aria-label="곡 만들기와 생성 결과 영역 너비 조절"
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        aria-valuenow={Math.round(percent)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={handleKeyDown}
      ><span /></button>
      <div ref={resultRef} className="soridraw-studio-result-pane" data-pane-mode={resultMode}>{panes[1] ?? null}</div>
    </div>
  );
}
