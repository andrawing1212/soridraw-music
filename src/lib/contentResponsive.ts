export type SoridrawResponsiveMode = 'mobile' | 'tablet' | 'pc';

const MOBILE_MAX = 660;
const TABLET_MAX = 1080;
type ResponsiveSnapshot = {
  mode: SoridrawResponsiveMode;
};

const readSnapshot = (width: number): ResponsiveSnapshot => ({
  mode: width <= MOBILE_MAX ? 'mobile' : width <= TABLET_MAX ? 'tablet' : 'pc',
});

/**
 * Music Note / Library content responsive owner.
 *
 * The same real content width produces the same internal UI whether the page is
 * rendered as a normal dark route or inside the Studio result pane. Attribute
 * The list/detail UI has no extra 820px/secondary density state: only the
 * published PC/tablet/mobile mode changes can write a responsive attribute.
 */
export function attachSoridrawResponsiveContract(element: HTMLElement) {
  let last: ResponsiveSnapshot | null = null;

  const applyWidth = (width: number) => {
    if (!Number.isFinite(width) || width <= 0) return;
    const next = readSnapshot(width);
    if (last && last.mode === next.mode) return;

    element.dataset.soridrawResponsiveMode = next.mode;
    last = next;
  };

  const readStableBorderWidth = () => element.getBoundingClientRect().width;

  const litePane = element.closest<HTMLElement>('[data-soridraw-lite-pane]');
  if (litePane) {
    // Lite Split V2 owns pane width already. Consume that width directly instead
    // of creating a second ResizeObserver + getBoundingClientRect loop for each
    // page while the divider is moving.
    applyWidth(readStableBorderWidth());
    const handleLitePaneWidth = (event: Event) => {
      const customEvent = event as CustomEvent<{ width?: number }>;
      const width = Number(customEvent.detail?.width);
      if (Number.isFinite(width) && width > 0) applyWidth(width);
    };
    litePane.addEventListener('soridraw-lite-pane-width', handleLitePaneWidth as EventListener);
    return () => litePane.removeEventListener('soridraw-lite-pane-width', handleLitePaneWidth as EventListener);
  }

  // 688: fine-pointer PC Music Note/Library now share Recent's Legacy split
  // owner. The parent already knows the exact result width on every layout
  // commit, so consume only its PC/tablet/mobile boundary notifications. This
  // removes the page-local ResizeObserver + synchronous geometry read that made
  // these two pages behave differently from Recent during outer-window resize.
  const legacyResultPane = element.closest<HTMLElement>('[data-soridraw-studio-pane="result"]');
  if (legacyResultPane) {
    applyWidth(readStableBorderWidth());
    const handleLegacyPaneWidth = (event: Event) => {
      const customEvent = event as CustomEvent<{ width?: number }>;
      const width = Number(customEvent.detail?.width);
      if (Number.isFinite(width) && width > 0) applyWidth(width);
    };
    legacyResultPane.addEventListener('soridraw-studio-pane-width', handleLegacyPaneWidth as EventListener);
    return () => legacyResultPane.removeEventListener('soridraw-studio-pane-width', handleLegacyPaneWidth as EventListener);
  }

  applyWidth(readStableBorderWidth());

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      // IMPORTANT: responsive mode itself changes the page padding.
      // ResizeObserverEntry.contentRect is the content-box width, so using it
      // here creates a feedback loop near the mobile/tablet threshold:
      // tablet padding -> smaller contentRect -> mobile -> smaller padding ->
      // larger contentRect -> tablet -> ...
      // Measure the border-box instead so visual padding changes never alter
      // the width that owns the responsive decision.
      applyWidth(readStableBorderWidth());
    });

    try {
      observer.observe(element, { box: 'border-box' });
    } catch {
      // Older browsers can still use the default observer because the callback
      // reads getBoundingClientRect(), not the unstable contentRect width.
      observer.observe(element);
    }
    return () => observer.disconnect();
  }

  const handleResize = () => applyWidth(readStableBorderWidth());
  window.addEventListener('resize', handleResize, { passive: true });
  return () => window.removeEventListener('resize', handleResize);
}

/**
 * Music Note / Library outer-window resize windowing.
 *
 * These pages can contain hundreds of card/row descendants. During a native
 * browser-window resize, Chromium may revisit every auto content-visibility
 * candidate while the split result pane changes width. Keep only the items that
 * were already in/near the viewport live for the duration of that resize gesture.
 * Off-screen items keep their intrinsic block size through the existing
 * `contain-intrinsic-size` rules, so the visible page geometry does not change.
 *
 * Important: the observer is disconnected while resizing. That prevents the
 * resize itself from causing a second IntersectionObserver feedback path.
 */
export function attachSoridrawResizeViewportWindowing(element: HTMLElement) {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  const ITEM_SELECTOR = '.soridraw-list-perf-item';
  const NEARBY_ATTR = 'data-soridraw-resize-nearby';
  const WINDOWING_ATTR = 'data-soridraw-resize-windowing';
  const observed = new Set<HTMLElement>();
  let intersectionObserver: IntersectionObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let syncFrame: number | null = null;
  let resizeActive = false;

  const markNearby = (target: Element, nearby: boolean) => {
    const item = target as HTMLElement;
    if (nearby) item.setAttribute(NEARBY_ATTR, 'true');
    else item.removeAttribute(NEARBY_ATTR);
  };

  const createIntersectionObserver = () => new IntersectionObserver((entries) => {
    if (resizeActive) return;
    for (const entry of entries) {
      markNearby(entry.target, entry.isIntersecting || entry.intersectionRatio > 0);
    }
  }, {
    // Keep a generous vertical buffer live so continuous horizontal resizing can
    // never expose a temporarily windowed card near either viewport edge.
    root: null,
    rootMargin: '900px 0px 900px 0px',
    threshold: 0,
  });

  const ensureObserver = () => {
    if (!intersectionObserver) intersectionObserver = createIntersectionObserver();
    return intersectionObserver;
  };

  const syncObservedItems = () => {
    syncFrame = null;
    if (resizeActive) return;
    const nextItems = Array.from(element.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    const nextSet = new Set(nextItems);

    for (const item of observed) {
      if (!nextSet.has(item) || !item.isConnected) {
        intersectionObserver?.unobserve(item);
        observed.delete(item);
        item.removeAttribute(NEARBY_ATTR);
      }
    }

    const observer = ensureObserver();
    for (const item of nextItems) {
      if (observed.has(item)) continue;
      observed.add(item);
      observer.observe(item);
    }
  };

  const scheduleSync = () => {
    if (resizeActive || syncFrame !== null) return;
    syncFrame = window.requestAnimationFrame(syncObservedItems);
  };

  const handleResizeStart = () => {
    if (resizeActive) return;
    resizeActive = true;
    if (syncFrame !== null) {
      window.cancelAnimationFrame(syncFrame);
      syncFrame = null;
    }
    // Freeze the last known viewport membership for this gesture. The global
    // resize marker activates the CSS fast path only for Music Note / Library.
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    element.setAttribute(WINDOWING_ATTR, 'true');
  };

  const handleResizeEnd = () => {
    if (!resizeActive) return;
    resizeActive = false;
    element.removeAttribute(WINDOWING_ATTR);
    scheduleSync();
  };

  mutationObserver = new MutationObserver(scheduleSync);
  mutationObserver.observe(element, { childList: true, subtree: true });
  window.addEventListener('soridraw-window-resize-start', handleResizeStart as EventListener);
  window.addEventListener('soridraw-window-resize-end', handleResizeEnd as EventListener);
  scheduleSync();

  return () => {
    if (syncFrame !== null) window.cancelAnimationFrame(syncFrame);
    mutationObserver?.disconnect();
    intersectionObserver?.disconnect();
    window.removeEventListener('soridraw-window-resize-start', handleResizeStart as EventListener);
    window.removeEventListener('soridraw-window-resize-end', handleResizeEnd as EventListener);
    element.removeAttribute(WINDOWING_ATTR);
    for (const item of observed) item.removeAttribute(NEARBY_ATTR);
    observed.clear();
  };
}
