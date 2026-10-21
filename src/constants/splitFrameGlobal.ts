// app450: one tiny environment-scoped operation setting. Never a data-cache key.
export const SPLIT_FRAME_MODES = ['pure-pane', 'local-responsive', 'pure-pane-hybrid'] as const;
export type SplitFrameMode = typeof SPLIT_FRAME_MODES[number];
export type SplitFrameEnvironment = 'preview' | 'test' | 'production';
export const DEFAULT_SPLIT_FRAME_MODE: SplitFrameMode = 'pure-pane-hybrid';

export const SPLIT_FRAME_CHOICES: ReadonlyArray<{ value: SplitFrameMode; label: string }> = [
  { value: 'pure-pane', label: '성능우선' },
  { value: 'local-responsive', label: '보통' },
  { value: 'pure-pane-hybrid', label: '품질우선' },
];

export const parseSplitFrameMode = (value: unknown): SplitFrameMode =>
  value === 'pure-pane' || value === 'local-responsive' || value === 'pure-pane-hybrid'
    ? value : DEFAULT_SPLIT_FRAME_MODE;

// Unknown hosts do NOT assume a production/preview write context.
export const getSplitFrameEnvironment = (): SplitFrameEnvironment | null => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (host === 'preview.soridraw.com') return 'preview';
  if (host === 'test.soridraw.com') return 'test';
  if (host === 'soridraw.com' || host === 'www.soridraw.com') return 'production';
  return null;
};
