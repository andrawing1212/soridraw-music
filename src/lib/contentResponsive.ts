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

  applyWidth(readStableBorderWidth());

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver((entries) => {
      // 684: ResizeObserver already gives us the post-layout border-box size.
      // Reading getBoundingClientRect() inside the callback can force Chromium
      // to synchronously lay out the page again after the viewport invalidated
      // styles. Prefer borderBoxSize so responsive ownership consumes the
      // browser's existing layout result without starting a second layout pass.
      const entry = entries[0];
      const borderBox = Array.isArray(entry?.borderBoxSize)
        ? entry.borderBoxSize[0]
        : entry?.borderBoxSize;
      const observedWidth = Number(borderBox?.inlineSize);
      if (Number.isFinite(observedWidth) && observedWidth > 0) {
        applyWidth(observedWidth);
        return;
      }

      // Older engines may not expose borderBoxSize. Fall back only there.
      applyWidth(readStableBorderWidth());
    });

    try {
      observer.observe(element, { box: 'border-box' });
    } catch {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }

  const handleResize = () => applyWidth(readStableBorderWidth());
  window.addEventListener('resize', handleResize, { passive: true });
  return () => window.removeEventListener('resize', handleResize);
}
