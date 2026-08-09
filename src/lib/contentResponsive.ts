export type SoridrawResponsiveMode = 'mobile' | 'tablet' | 'pc';

const MOBILE_MAX = 680;
const TABLET_MAX = 1080;
const MID_COMPACT_MAX = 820;

type ResponsiveSnapshot = {
  mode: SoridrawResponsiveMode;
  lte1080: boolean;
  lte820: boolean;
  lte680: boolean;
};

const readSnapshot = (width: number): ResponsiveSnapshot => ({
  mode: width <= MOBILE_MAX ? 'mobile' : width <= TABLET_MAX ? 'tablet' : 'pc',
  lte1080: width <= TABLET_MAX,
  lte820: width <= MID_COMPACT_MAX,
  lte680: width <= MOBILE_MAX,
});

const setBooleanData = (element: HTMLElement, key: string, enabled: boolean) => {
  if (enabled) element.dataset[key] = 'true';
  else delete element.dataset[key];
};

/**
 * Music Note / Library content responsive owner.
 *
 * The same real content width produces the same internal UI whether the page is
 * rendered as a normal dark route or inside the Studio result pane. Attribute
 * writes happen only when a threshold is crossed, not on every resize pixel.
 */
export function attachSoridrawResponsiveContract(element: HTMLElement) {
  let last: ResponsiveSnapshot | null = null;

  const applyWidth = (width: number) => {
    if (!Number.isFinite(width) || width <= 0) return;
    const next = readSnapshot(width);
    if (
      last &&
      last.mode === next.mode &&
      last.lte1080 === next.lte1080 &&
      last.lte820 === next.lte820 &&
      last.lte680 === next.lte680
    ) return;

    element.dataset.soridrawResponsiveMode = next.mode;
    setBooleanData(element, 'soridrawWidthLte1080', next.lte1080);
    setBooleanData(element, 'soridrawWidthLte820', next.lte820);
    setBooleanData(element, 'soridrawWidthLte680', next.lte680);
    last = next;
  };

  const readStableBorderWidth = () => element.getBoundingClientRect().width;

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
