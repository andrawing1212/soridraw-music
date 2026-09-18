export const STUDIO_ACTION_PANEL_MAX_WIDTH = 896;
export const STUDIO_ACTION_DESKTOP_GUTTER = 18;
export const STUDIO_ACTION_MOBILE_PANE_GUTTER = 8;

export const getStudioActionFloatingGutter = (
  viewportWidth: number,
  builderMode?: string | null,
): number => {
  if (viewportWidth < 1100) return 0;
  return builderMode === 'mobile'
    ? STUDIO_ACTION_MOBILE_PANE_GUTTER
    : STUDIO_ACTION_DESKTOP_GUTTER;
};

export const resolveStudioActionFloatingGeometry = (
  anchorLeft: number,
  anchorWidth: number,
  gutter: number,
) => {
  const safeLeft = Number.isFinite(anchorLeft) ? anchorLeft : 0;
  const safeWidth = Math.max(0, Number.isFinite(anchorWidth) ? anchorWidth : 0);
  const safeGutter = Math.max(0, Number.isFinite(gutter) ? gutter : 0);
  const maxTrackWidth = STUDIO_ACTION_PANEL_MAX_WIDTH + safeGutter * 2;
  const width = Math.min(safeWidth, maxTrackWidth);
  const left = safeLeft + Math.max(0, (safeWidth - width) / 2);

  return {
    left: Math.round(left),
    width: Math.round(width),
  };
};
