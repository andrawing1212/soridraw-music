import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

const HOLD_DELAY_MS = 260;
const HOLD_SPEED_PX_PER_SECOND = 520;
type Direction = -1 | 1;
type Options = { onStart?: () => void; onEnd?: () => void };

export function useExploreArrowHoldScroll(
  scrollerRef: RefObject<HTMLDivElement | null>,
  options: Options = {},
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const cancelRef = useRef<((notify?: boolean) => void) | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => () => cancelRef.current?.(false), []);

  const start = (event: PointerEvent<HTMLButtonElement>, direction: Direction) => {
    if (event.button !== 0 || !event.isPrimary || event.currentTarget.disabled) return;
    cancelRef.current?.();
    suppressClickRef.current = false;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const pointerId = event.pointerId;
    let active = false;
    let timer: number | null = null;
    let frame: number | null = null;
    let previousTime: number | null = null;
    let target = 0;
    let previousBehavior = '';
    let previousSnap = '';

    const stop = (notify = true) => {
      if (timer !== null) window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      timer = null;
      frame = null;
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', interrupt);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelRef.current = null;
      if (!active) return;
      active = false;
      scroller.style.scrollBehavior = previousBehavior;
      scroller.style.scrollSnapType = previousSnap;
      if (notify) optionsRef.current.onEnd?.();
    };

    const release = (up: globalThis.PointerEvent) => {
      if (up.pointerId === pointerId) stop();
    };
    const interrupt = () => stop();
    const onVisibility = () => { if (document.hidden) stop(); };

    const tick = (time: number) => {
      frame = null;
      if (!active) return;
      if (scrollerRef.current !== scroller || !scroller.isConnected) { stop(); return; }
      const elapsed = previousTime === null ? 0 : Math.min(50, Math.max(0, time - previousTime));
      previousTime = time;
      const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      target = Math.min(max, Math.max(0, target + direction * HOLD_SPEED_PX_PER_SECOND * elapsed / 1000));
      scroller.scrollLeft = target;
      if ((direction < 0 && target <= 0) || (direction > 0 && target >= max)) return;
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', interrupt);
    document.addEventListener('visibilitychange', onVisibility);
    cancelRef.current = stop;
    timer = window.setTimeout(() => {
      timer = null;
      if (scrollerRef.current !== scroller || !scroller.isConnected) { stop(); return; }
      // A long press is consumed even at the scroll boundary: release must not click again.
      suppressClickRef.current = true;
      active = true;
      previousBehavior = scroller.style.scrollBehavior;
      previousSnap = scroller.style.scrollSnapType;
      scroller.style.scrollBehavior = 'auto';
      scroller.style.scrollSnapType = 'none';
      target = scroller.scrollLeft;
      optionsRef.current.onStart?.();
      frame = window.requestAnimationFrame(tick);
    }, HOLD_DELAY_MS);
  };

  const consumeHoldClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Keyboard clicks (detail 0) still take the normal one-step path.
    if (!suppressClickRef.current || event.detail === 0) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const bind = (direction: Direction) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => start(event, direction),
    onClickCapture: consumeHoldClick,
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) event.preventDefault();
    },
  });
  return bind;
}
