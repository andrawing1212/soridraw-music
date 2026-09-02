import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Stabilizes hover-only tooltips so fast pointer sweeps do not repeatedly mount
 * and unmount tooltip DOM. Hiding remains immediate; showing waits for the
 * pointer to stay on the same title for the requested delay.
 */
export function useStableHoverTooltip(
  delayMs = 60,
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null || typeof window === 'undefined') return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const setRequestedVisible = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const resolved = typeof next === 'function'
      ? (next as (previous: boolean) => boolean)(visibleRef.current)
      : next;

    clearTimer();

    if (!resolved) {
      visibleRef.current = false;
      setVisible(false);
      return;
    }

    if (typeof window === 'undefined' || delayMs <= 0) {
      visibleRef.current = true;
      setVisible(true);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      visibleRef.current = true;
      setVisible(true);
    }, delayMs);
  }, [clearTimer, delayMs]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [visible, setRequestedVisible] as const;
}
