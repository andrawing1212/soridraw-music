/**
 * Canonical SORIDRAW Studio responsive thresholds.
 *
 * Viewport mode is owned here so page rails, split workspace and future
 * Studio pages do not each invent their own PC/tablet/mobile boundaries.
 * Pane mode is intentionally separate: viewport mode chooses the outer shell,
 * while the actual builder/result width chooses each pane's inner composition.
 */
export const STUDIO_TABLET_MIN_PX = 1100;
export const STUDIO_PC_MIN_PX = 1600;
export const STUDIO_BUILDER_COMPACT_PX = 820;
export const STUDIO_RESULT_COMPACT_PX = 680;

export type StudioViewportMode = 'mobile' | 'tablet' | 'pc';

export const getStudioViewportMode = (
  width = typeof window === 'undefined' ? STUDIO_PC_MIN_PX : window.innerWidth,
): StudioViewportMode => {
  if (width < STUDIO_TABLET_MIN_PX) return 'mobile';
  if (width < STUDIO_PC_MIN_PX) return 'tablet';
  return 'pc';
};
