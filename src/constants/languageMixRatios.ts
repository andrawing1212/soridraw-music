export const LANGUAGE_MIX_RATIO_OPTIONS = [5, 10, 20, 30, 40, 50, 60] as const;

export type LanguageMixRatioOption = (typeof LANGUAGE_MIX_RATIO_OPTIONS)[number];

export interface LanguageMixRatioBand {
  lowerBound: number;
  upperBound: number;
}

export const LANGUAGE_MIX_RATIO_BANDS: Record<LanguageMixRatioOption, LanguageMixRatioBand> = {
  5: { lowerBound: 0, upperBound: 10 },
  10: { lowerBound: 5, upperBound: 15 },
  20: { lowerBound: 15, upperBound: 25 },
  30: { lowerBound: 25, upperBound: 35 },
  40: { lowerBound: 35, upperBound: 45 },
  50: { lowerBound: 45, upperBound: 55 },
  60: { lowerBound: 55, upperBound: 65 },
};

export function normalizeLanguageMixRatioOption(
  value: unknown,
  options: { fallback?: LanguageMixRatioOption; allowZero?: boolean } = {},
): number {
  const fallback = options.fallback ?? 10;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (options.allowZero && numeric <= 0) return 0;
  if (numeric <= 0) return fallback;

  return LANGUAGE_MIX_RATIO_OPTIONS.reduce<LanguageMixRatioOption>((closest, option) => {
    const optionDistance = Math.abs(option - numeric);
    const closestDistance = Math.abs(closest - numeric);
    return optionDistance < closestDistance ? option : closest;
  }, LANGUAGE_MIX_RATIO_OPTIONS[0]);
}

export function getLanguageMixRatioBand(value: unknown): LanguageMixRatioBand {
  const normalized = normalizeLanguageMixRatioOption(value);
  return LANGUAGE_MIX_RATIO_BANDS[normalized as LanguageMixRatioOption];
}
