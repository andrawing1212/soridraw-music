import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

let activeTooltipDismiss: (() => void) | null = null;

/**
 * Title-help hover guard.
 * - A quick pointer sweep never mounts the tooltip.
 * - Leaving hides immediately (no AnimatePresence exit tail).
 * - Only one menu-title tooltip can be active at a time.
 */
export function useStableHoverTooltip(
  delayMs = 60,
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const dismissRef = useRef<() => void>(() => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current === null || typeof window === 'undefined') return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const hideNow = useCallback(() => {
    clearTimer();
    if (visibleRef.current) {
      visibleRef.current = false;
      setVisible(false);
    }
    if (activeTooltipDismiss === dismissRef.current) {
      activeTooltipDismiss = null;
    }
  }, [clearTimer]);

  dismissRef.current = hideNow;

  const setRequestedVisible = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    const resolved = typeof next === 'function'
      ? (next as (previous: boolean) => boolean)(visibleRef.current)
      : next;

    clearTimer();

    if (!resolved) {
      hideNow();
      return;
    }

    const activate = () => {
      timerRef.current = null;
      const previousDismiss = activeTooltipDismiss;
      if (previousDismiss && previousDismiss !== dismissRef.current) {
        previousDismiss();
      }
      activeTooltipDismiss = dismissRef.current;
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
    };

    if (typeof window === 'undefined' || delayMs <= 0) {
      activate();
      return;
    }

    timerRef.current = window.setTimeout(activate, delayMs);
  }, [clearTimer, delayMs, hideNow]);

  useEffect(() => () => {
    clearTimer();
    if (activeTooltipDismiss === dismissRef.current) {
      activeTooltipDismiss = null;
    }
  }, [clearTimer]);

  return [visible, setRequestedVisible] as const;
}
