import { useLayoutEffect, type DependencyList, type Dispatch, type RefObject, type SetStateAction } from 'react';

export function useStableContentHeight(
  contentRef: RefObject<HTMLElement>,
  setHeight: Dispatch<SetStateAction<number | string>>,
  deps: DependencyList,
  onHeightChange?: (height: number) => void,
  enabled = true,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    let frameId: number | null = null;
    let settleTimerId: number | null = null;
    let lastObservedWidth = -1;
    let lastMeasuredHeight: number | null = null;

    const measure = () => {
      frameId = null;
      const el = contentRef.current;
      if (!el) return;
      const nextHeight = el.scrollHeight || el.offsetHeight || 0;
      if (nextHeight <= 0 || lastMeasuredHeight === nextHeight) return;
      lastMeasuredHeight = nextHeight;
      setHeight(nextHeight);
      onHeightChange?.(nextHeight);
    };

    const scheduleMeasure = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(measure);
    };

    const isContinuousResize = () => {
      const root = document.documentElement;
      return root.classList.contains('soridraw-split-dragging')
        || root.classList.contains('soridraw-lite-split-dragging')
        || root.classList.contains('soridraw-window-resizing');
    };

    const scheduleSettledMeasure = () => {
      if (isContinuousResize()) return;
      if (settleTimerId !== null) window.clearTimeout(settleTimerId);
      settleTimerId = window.setTimeout(() => {
        settleTimerId = null;
        scheduleMeasure();
      }, 90);
    };

    const handleContinuousResizeEnd = () => scheduleSettledMeasure();

    scheduleMeasure();
    scheduleSettledMeasure();

    const element = contentRef.current;
    const observer = element && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect.width ?? lastObservedWidth;
          if (Math.abs(width - lastObservedWidth) < 0.5) return;
          lastObservedWidth = width;
          scheduleSettledMeasure();
        })
      : null;
    if (observer && element) observer.observe(element);
    window.addEventListener('soridraw-split-drag-end', handleContinuousResizeEnd as EventListener);
    window.addEventListener('soridraw-window-resize-end', handleContinuousResizeEnd as EventListener);

    return () => {
      observer?.disconnect();
      window.removeEventListener('soridraw-split-drag-end', handleContinuousResizeEnd as EventListener);
      window.removeEventListener('soridraw-window-resize-end', handleContinuousResizeEnd as EventListener);
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (settleTimerId !== null) window.clearTimeout(settleTimerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

export const resolveExpandedHeight = (
  preferredHeight: number | undefined,
  measuredHeight: number | string,
  fallbackHeight: number,
) => {
  if (typeof preferredHeight === 'number' && preferredHeight > 0) return preferredHeight;
  if (typeof measuredHeight === 'number' && measuredHeight > 0) return measuredHeight;
  return fallbackHeight;
};
